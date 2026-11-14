"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiGet, apiSend } from "../lib/client-api";
import { statutDevis } from "../lib/devis-liste";
import { conditionsEnvoyees, etapesSuivi, noteSuivi, quandParis, retractationJusquau, versionDevis } from "../lib/devis-suivi";
import { demarragePropose, proposerPlanning } from "../lib/planning-chantier";

// Après l'envoi (maquette PRO-03.3) : le devis envoyé ou signé en lecture
// seule, à droite le suivi (Envoyé → Vu → Signé → Chantier lancé), les
// conditions envoyées et les messages du client ; une fois signé, lancer le
// chantier, l'acompte et les documents. « Modifier » repasse dans l'éditeur
// et le prochain envoi crée la version suivante.

function IconBack() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>;
}

function IconCheck() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>;
}

function IconPlus() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;
}

function euro(n) {
  return Number(n || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function jourCourt(jour) {
  const d = new Date(`${String(jour || "").slice(0, 10)}T12:00:00Z`);
  return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", day: "numeric", month: "short" }).format(d) : "";
}

// Une phrase finie par une date abrégée (« 18 nov. ») ne prend pas un 2e point.
const point = (t) => (t.endsWith(".") ? t : `${t}.`);

function finDeMois(jour) {
  const d = new Date(`${String(jour || "").slice(0, 10)}T12:00:00Z`);
  return Number.isFinite(d.getTime()) ? `fin ${new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", month: "short" }).format(d)}` : "";
}

function dureeLisible(joursOuvres) {
  const n = Number(joursOuvres) || 0;
  if (n >= 10) {
    const semaines = Math.round(n / 5);
    return `${semaines} semaine${semaines > 1 ? "s" : ""}`;
  }
  return `${n} jour${n > 1 ? "s" : ""} ouvré${n > 1 ? "s" : ""}`;
}

function Suivi({ quote, aujourdhui, chantierLance, messages }) {
  const etapes = etapesSuivi(quote, { aujourdhui, chantierLance });
  return (
    <div className="card">
      <div className="card-h"><h2>Suivi</h2></div>
      <ol className="tl">
        {etapes.map((e) => (
          <li key={e.cle} className={e.etat}>
            <span className="dot">{e.etat === "done" ? <IconCheck /> : null}</span>
            <div><strong>{e.label}</strong>{e.detail ? <small>{e.detail}</small> : null}</div>
          </li>
        ))}
      </ol>
      <div className="sv-note">{noteSuivi(quote, { aujourdhui, messages })}</div>
    </div>
  );
}

function Messages({ quote, messages, onOuvrir }) {
  const dernier = messages.at(-1);
  return (
    <div className="card">
      <div className="card-h"><h2>Messages</h2><button type="button" className="link" onClick={onOuvrir}>Ouvrir</button></div>
      <div className="sv-note">
        {dernier
          ? `${messages.length} message${messages.length > 1 ? "s" : ""}. Dernier ${dernier.entreprise ? "de toi" : `de ${dernier.auteur || quote.client || "la cliente"}`} : « ${dernier.texte.slice(0, 120)}${dernier.texte.length > 120 ? "…" : ""} »`
          : "Aucun message sur ce devis. Le client peut poser une question depuis sa page de signature ; tu réponds ici."}
      </div>
    </div>
  );
}

function FilMessages({ quote, messages, onClose, onEnvoye }) {
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  async function envoyer() {
    setEnvoi(true);
    setErreur("");
    try {
      const { message } = await apiSend(`/api/quotes/${quote.id}/messages`, { texte });
      onEnvoye(message);
      setTexte("");
    } catch (error) {
      setErreur(error.message || "Le message n'est pas parti.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <>
      <div className="env-scrim" onClick={envoi ? undefined : onClose} />
      <section className="env-panel sv-fil" role="dialog" aria-modal="true" aria-label={`Messages du devis ${quote.quoteNumber}`}>
        <div className="env-h">
          <div>
            <h2>Messages</h2>
            <span className="muted">Devis {quote.quoteNumber}{quote.client ? ` · ${quote.client}` : ""}</span>
          </div>
          <button type="button" className="link" onClick={onClose} disabled={envoi}>Fermer</button>
        </div>
        <div className="msgs">
          {messages.length === 0 ? <p className="muted">Aucun message pour l'instant.</p> : messages.map((m) => (
            <div key={m.id} className={`msg ${m.entreprise ? "u" : "k"}`}>
              <small className="sv-msg-h">{m.entreprise ? "Toi" : m.auteur || "Client"} · {quandParis(m.le)}</small>
              {m.texte}
              {m.pieces.length ? <small className="sv-msg-p">{m.pieces.join(", ")}</small> : null}
            </div>
          ))}
        </div>
        <label className="ed">
          <span className="ed-l">Répondre</span>
          <textarea rows={3} value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={3000} />
        </label>
        {erreur ? <p className="err" role="alert">{erreur}</p> : null}
        <div className="env-act">
          <button type="button" className="btn btn-main" disabled={envoi || !texte.trim()} onClick={envoyer}>{envoi ? "Envoi…" : "Envoyer"}</button>
        </div>
      </section>
    </>
  );
}

export function DevisSuivi({
  quote,
  aujourdhui,
  lots,
  totals,
  client,
  chantier,
  depositInvoice,
  depositBusy,
  onCreerAcompte,
  onRelancer,
  onModifier,
  onApercu
}) {
  const signe = quote.status === "Signe" || quote.signatureStatus === "Signe";
  const statut = statutDevis(quote, aujourdhui);
  const [messages, setMessages] = useState([]);
  const [filOuvert, setFilOuvert] = useState(false);
  const [chantierLance, setChantierLance] = useState(false);

  useEffect(() => {
    let actif = true;
    apiGet(`/api/quotes/${quote.id}/messages`).then((d) => { if (actif) setMessages(d.messages || []); }).catch(() => {});
    return () => { actif = false; };
  }, [quote.id]);

  // Chantier lancé : au moins une tâche du chantier planifiée (PRO-02.1).
  useEffect(() => {
    if (!signe || !quote.projectId) return undefined;
    let actif = true;
    apiGet("/api/tasks").then((d) => {
      const lance = (d.tasks || []).some((t) => t.projectId === quote.projectId && (t.startDate || t.endDate || t.dueDate));
      if (actif) setChantierLance(lance);
    }).catch(() => {});
    return () => { actif = false; };
  }, [signe, quote.projectId]);

  const version = versionDevis(quote);
  const jalons = Array.isArray(quote.paymentMilestones) ? quote.paymentMilestones : [];
  const acompte = jalons.length ? Number(jalons[0]?.percent) || 0 : 0;
  const debut = demarragePropose(aujourdhui);
  const planning = proposerPlanning(quote, { debut });
  const situations = /situations/i.test(jalons[1]?.label || "");
  const retract = retractationJusquau(quote);
  const nbLots = lots.filter((l) => l.lignes.length).length;
  const prochaineVersion = Number(quote.versions?.at(-1)?.number || quote.versionNumber || 1) + 1;
  const lienLancer = quote.projectId ? `/chantiers?project=${quote.projectId}${chantierLance ? "" : "&lancer=1"}` : "";
  const pdf = `/api/quotes/${quote.id}/documents?type=quote&format=pdf&preview=1`;

  const actionsEnvoye = (
    <>
      {statut.id !== "expire" ? (
        <button type="button" className={`btn ${statut.id === "relancer" ? "btn-main" : "btn-sec"}`} onClick={onRelancer}>Relancer</button>
      ) : null}
      <button type="button" className="btn btn-sec" onClick={onModifier}>Modifier, version {prochaineVersion}</button>
    </>
  );
  const actionsSigne = (
    <>
      <button type="button" className="btn btn-sec" onClick={onApercu}>Aperçu PDF</button>
      {lienLancer ? (
        chantierLance
          ? <Link className="btn btn-sec" href={lienLancer}>Voir le chantier</Link>
          : <Link className="btn btn-main" href={lienLancer}><IconPlus />Lancer le chantier</Link>
      ) : null}
    </>
  );

  return (
    <div className="dv sv">
      <header className="dv-top">
        <Link href="/devis" className="back"><IconBack />Devis</Link>
        <div className="dv-title">
          <strong>Devis {quote.quoteNumber}{quote.project ? ` · ${quote.project}` : ""}</strong>
          <span className="muted">{[client.name, `${euro(totals.ht)} HT`, `${euro(totals.ttc)} TTC`].filter(Boolean).join(" · ")}</span>
          <strong className="dv-t-m">Devis {quote.quoteNumber}</strong>
          <small className="dv-t-m">{[quote.project, client.name].filter(Boolean).join(" · ")}</small>
        </div>
        {signe ? (
          <span className="signed"><span className="seal"><IconCheck /></span>Signé</span>
        ) : (
          <span className={`tag ${statut.id === "envoye" ? "tag-e" : "tag-o"}`}>{statut.label}</span>
        )}
        <div className="dv-act">{signe ? actionsSigne : actionsEnvoye}</div>
      </header>

      <div className="sv-body">
        <section className="dv-doc ro">
          <div className="dv-doc-h">
            <div className="dv-cli">
              <div><span className="lab">Client</span><strong>{client.name || "Client"}</strong><span className="muted">{client.detail || "—"}</span></div>
              <div><span className="lab">Chantier</span><strong>{chantier.titre || "—"}</strong><span className="muted">{chantier.detail || "—"}</span></div>
              <div><span className="lab">Version</span><strong>{version.titre}</strong><span className="muted">{version.detail}</span></div>
            </div>
          </div>
          <div className="m-sec sv-m-h"><h2>Devis</h2><button type="button" className="link" onClick={onApercu}>PDF</button></div>
          <div className="dv-lines">
            {lots.filter((l) => l.lignes.length).map((lot) => (
              <div className="lot" key={lot.nom}>
                <div className="lot-h"><span className="lc">{lot.code}</span><span className="ln">{lot.nom}</span><span className="ls">{euro(lot.total)}</span></div>
                {lot.lignes.map((l) => (
                  <div className="dl ro" key={l.id}>
                    <span className="dd">{l.label}{l.variante ? <span className="tag tag-o dl-var">Variante</span> : null}</span>
                    <span className="dq">{l.quantite}</span>
                    <span className="dp">{euro(l.pu)}</span>
                    <span className="dt">{euro(l.total)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="dv-tot">
            <div><span>Total HT</span><b>{euro(totals.ht)}</b></div>
            <div><span>TVA {String(totals.vatRate).replace(".", ",")} %</span><b>{euro(totals.tva)}</b></div>
            <div className="ttc"><span>Total TTC</span><b>{euro(totals.ttc)}</b></div>
          </div>
        </section>

        <aside className="dv-side">
          <div className="svm-amt">
            <b>{euro(totals.ht)} HT</b>
            <span className="muted">{euro(totals.ttc)} TTC · version {Number(quote.versions?.at(-1)?.number || quote.versionNumber || 1)}</span>
          </div>
          <Suivi quote={quote} aujourdhui={aujourdhui} chantierLance={chantierLance} messages={messages.filter((m) => !m.entreprise).length} />
          <div className="svm-act">{signe ? actionsSigne : actionsEnvoye}</div>

          {signe ? (
            <>
              {quote.projectId && !chantierLance ? (
                <div className="card next">
                  <div className="card-h"><h2>Lancer le chantier</h2></div>
                  <div className="sv-note">
                    {point(`Koji crée le chantier avec ${nbLots > 1 ? `les ${nbLots} lots` : "le lot"} du devis, le client en suivi, et propose un planning à partir du ${jourCourt(debut)}`)} Tu pourras ajuster avant de confirmer au client.
                  </div>
                  <div className="kv"><span>Démarrage proposé</span><b>{jourCourt(debut)}</b></div>
                  <div className="kv"><span>Durée estimée</span><b>{dureeLisible(planning.joursOuvres)}</b></div>
                  {situations ? <div className="kv"><span>Première situation</span><b>{finDeMois(debut)}</b></div> : null}
                </div>
              ) : null}
              <div className="card">
                <div className="card-h"><h2>Acompte</h2></div>
                <div className="kv"><span>Prévu au devis</span><b>{acompte > 0 ? `${acompte} % · ${euro(Number(quote.totalTtc || 0) * acompte / 100)} TTC` : "Sans acompte"}</b></div>
                {depositInvoice ? (
                  <div className="sv-note">
                    Facture {depositInvoice.invoiceNumber || "en brouillon"} · {depositInvoice.status === "Brouillon" ? "brouillon" : depositInvoice.status === "Payee" ? "payée" : "envoyée"}.{" "}
                    <Link className="link" href="/facturation">Ouvrir dans Factures</Link>
                  </div>
                ) : acompte > 0 ? (
                  <>
                    <div className="sv-note">Pas encore facturé. La facture reprend le numéro du devis et part au client avec un message.</div>
                    <button type="button" className="btn btn-sec sv-wide" disabled={depositBusy || !quote.projectId} onClick={() => onCreerAcompte(acompte)}>
                      {depositBusy ? "Création…" : "Créer la facture d'acompte"}
                    </button>
                  </>
                ) : null}
              </div>
              <div className="card">
                <div className="card-h"><h2>Documents</h2>{quote.projectId ? <Link className="link" href={`/chantiers?project=${quote.projectId}`}>Tout voir</Link> : null}</div>
                <div className="kv"><span>Devis signé</span><b><a className="link" href={pdf} target="_blank" rel="noreferrer">PDF{quote.signedAt ? ` · ${jourCourt(quote.signedAt)}` : ""}</a></b></div>
                {retract ? <div className="kv"><span>Rétractation</span><b>jusqu'au {jourCourt(retract)}</b></div> : null}
              </div>
            </>
          ) : (
            <>
              <div className="card">
                <div className="card-h"><h2>Conditions envoyées</h2></div>
                {conditionsEnvoyees(quote).map(([k, v]) => <div className="kv" key={k}><span>{k}</span><b>{v}</b></div>)}
              </div>
              <Messages quote={quote} messages={messages} onOuvrir={() => setFilOuvert(true)} />
            </>
          )}
        </aside>
      </div>

      {filOuvert ? (
        <FilMessages
          quote={quote}
          messages={messages}
          onClose={() => setFilOuvert(false)}
          onEnvoye={(m) => setMessages((liste) => [...liste, m])}
        />
      ) : null}
    </div>
  );
}
