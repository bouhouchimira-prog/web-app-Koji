"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../lib/client-api";
import { ecartsVersions, historiqueDevis, libelleEcart, messageVersion, noteMiseAJour, resumeEcarts, signe } from "../lib/devis-versions";

// Versions du devis (maquette PRO-03.6) : les versions envoyées et celle en
// préparation, ce qui change de l'une à l'autre (lignes concernées
// seulement, totaux HT et TTC avant / après), ce qui se met à jour seul, le
// message proposé au client, la demande du client et l'historique. Une
// seule version signable à la fois ; la précédente reste consultable.

function IconBack() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>;
}

function IconSend() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 16-2-7z" /></svg>;
}

function euro(n) {
  return Number(n || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function court(jour) {
  const d = new Date(`${String(jour || "").slice(0, 10)}T12:00:00Z`);
  return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", day: "numeric", month: "short" }).format(d) : "";
}

const num = (v) => Number(v?.number) || 1;

export function DevisVersions({ quote, brouillon, client, tauxTva, acompteTtc, finValidite, signe: devisSigne, onRetour, onModifier, onEnvoyer }) {
  const envoyees = useMemo(() => (Array.isArray(quote.versions) ? quote.versions : []), [quote.versions]);
  const toutes = useMemo(() => (brouillon ? [...envoyees, brouillon] : envoyees), [envoyees, brouillon]);
  const [choisie, setChoisie] = useState(() => Math.max(0, toutes.length - 1));
  const [messages, setMessages] = useState([]);
  const version = toutes[Math.min(choisie, toutes.length - 1)] || null;
  const precedente = choisie > 0 ? toutes[choisie - 1] : null;
  const ecarts = precedente && version ? ecartsVersions(precedente, version, { tauxTva }) : null;
  const enPreparation = Boolean(brouillon) && version === brouillon;
  const [message, setMessage] = useState("");

  useEffect(() => {
    apiGet(`/api/quotes/${quote.id}/messages`).then((d) => setMessages(d.messages || [])).catch(() => {});
  }, [quote.id]);

  // Message proposé : suit les écarts de la version en préparation tant
  // qu'il n'a pas été retouché.
  const propose = brouillon && envoyees.length
    ? messageVersion({ client, numero: num(brouillon), ecarts: ecartsVersions(envoyees.at(-1), brouillon, { tauxTva }), totalTtc: brouillon.totalTtc })
    : "";
  const texte = message || propose;

  const derniereEnvoi = envoyees.at(-1)?.sentAt || quote.sentAt || "";
  const demande = messages.filter((m) => !m.entreprise && (!derniereEnvoi || String(m.le) > String(derniereEnvoi))).at(-1);
  const historique = historiqueDevis(quote, { messages });

  return (
    <div className="dv sv vr">
      <header className="dv-top">
        <button type="button" className="back" onClick={onRetour}><IconBack />Devis</button>
        <div className="dv-title">
          <strong>Devis {quote.quoteNumber}{quote.project ? ` · ${quote.project}` : ""}</strong>
          <span className="muted">
            {version ? `Version ${num(version)} · ${euro(version.totalHt)} HT · ${euro(version.totalTtc)} TTC` : "Aucune version envoyée"}
            {enPreparation && finValidite ? ` · validité recalculée : jusqu'au ${court(finValidite)}` : ""}
          </span>
          <strong className="dv-t-m">Versions du devis</strong>
          <small className="dv-t-m">{quote.quoteNumber}{client ? ` · ${client}` : ""}</small>
        </div>
        {brouillon && !devisSigne ? (
          <div className="dv-act">
            <button type="button" className="btn btn-sec" onClick={onModifier}>Modifier dans l'éditeur</button>
            <button type="button" className="btn btn-main" onClick={() => onEnvoyer(texte)}><IconSend />Envoyer la version {num(brouillon)}</button>
          </div>
        ) : null}
      </header>

      <div className="sv-body">
        <section className="vr-main">
          <div className="vr-tabs" role="tablist" aria-label="Versions">
            {toutes.map((v, i) => (
              <button key={`${v.number}-${i}`} type="button" role="tab" aria-selected={i === choisie} className={i === choisie ? "on" : ""} onClick={() => setChoisie(i)}>
                <b>Version {num(v)}</b>
                <small>{v === brouillon ? "en préparation" : `${court(v.sentAt)} · ${i < envoyees.length - 1 ? "remplacée" : devisSigne ? "signée" : "envoyée"}`}</small>
              </button>
            ))}
          </div>

          {!version ? (
            <div className="card"><p className="muted">Le devis n'a pas encore été envoyé : la version 1 partira au premier envoi.</p></div>
          ) : ecarts ? (
            <div className="card vr-card">
              <div className="card-h">
                <h2>Ce qui change entre la version {num(precedente)} et la version {num(version)}</h2>
              </div>
              <p className="muted vr-resume">{resumeEcarts(ecarts)}</p>
              {ecarts.lignes.length ? (
                <div className="vr-table">
                  <div className="vr-row vr-head"><span /><span>Ligne</span><span>Version {num(precedente)}</span><span>Version {num(version)}</span><span>Écart HT</span></div>
                  {ecarts.lignes.map((l, i) => (
                    <div className={`vr-row vr-${l.kind}`} key={`${l.kind}-${l.label}-${i}`}>
                      <span className="vr-k">{libelleEcart(l.kind)}</span>
                      <span className="vr-l">
                        {l.labelAvant ? <>{l.labelAvant} <span aria-hidden="true">→</span> {l.label}</> : l.label}
                        {l.lot ? <small>{l.lot}</small> : null}
                      </span>
                      <span>{l.avant == null ? "—" : euro(l.avant)}</span>
                      <span>{l.apres == null ? "—" : euro(l.apres)}</span>
                      <b>{signe(l.ecart)}</b>
                    </div>
                  ))}
                  <div className="vr-row vr-tot"><span /><span>Total HT</span><span>{euro(ecarts.totalHt.avant)}</span><span>{euro(ecarts.totalHt.apres)}</span><b>{signe(ecarts.totalHt.ecart)}</b></div>
                  <div className="vr-row vr-tot"><span /><span>Total TTC · TVA {String(tauxTva).replace(".", ",")} %</span><span>{euro(ecarts.totalTtc.avant)}</span><span>{euro(ecarts.totalTtc.apres)}</span><b>{signe(ecarts.totalTtc.ecart)}</b></div>
                </div>
              ) : (
                <p className="muted">Pas encore de changement : modifie le devis dans l'éditeur, les écarts s'affichent ici.</p>
              )}
              {enPreparation ? (
                <p className="vr-note">{noteMiseAJour({ numero: num(version), numeroDevis: quote.quoteNumber, acompteTtc, finValidite })}</p>
              ) : null}
            </div>
          ) : (
            <div className="card vr-card">
              <div className="card-h"><h2>Version {num(version)} · {version.lines?.length || 0} ligne{(version.lines?.length || 0) > 1 ? "s" : ""}</h2></div>
              <div className="vr-table">
                {(version.lines || []).map((l, i) => (
                  <div className="vr-row vr-lst" key={`${l.id}-${i}`}><span className="vr-l">{l.label}{l.room ? <small>{l.room}</small> : null}</span><b>{euro(l.totalHt)}</b></div>
                ))}
                <div className="vr-row vr-lst vr-tot"><span>Total HT</span><b>{euro(version.totalHt)}</b></div>
              </div>
            </div>
          )}

          {enPreparation && envoyees.length ? (
            <label className="ed vr-msg">
              <span className="ed-l">Message joint · proposé par Koji</span>
              <textarea rows={4} value={texte} onChange={(e) => setMessage(e.target.value)} />
            </label>
          ) : null}
          {devisSigne ? <p className="muted">Devis signé : toute modification passe maintenant par un avenant.</p> : null}
          {brouillon && !devisSigne ? (
            <div className="svm-act">
              <button type="button" className="btn btn-sec" onClick={onModifier}>Modifier</button>
              <button type="button" className="btn btn-main" onClick={() => onEnvoyer(texte)}>Envoyer la v{num(brouillon)}</button>
            </div>
          ) : null}
        </section>

        <aside className="dv-side">
          {demande ? (
            <div className="card">
              <div className="card-h"><h2>Demande {client ? "du client" : "de la cliente"}</h2></div>
              <p className="vr-demande">« {demande.texte} »</p>
              <p className="sv-note">{demande.auteur || client} · {court(demande.le)}</p>
            </div>
          ) : null}
          <div className="card">
            <div className="card-h"><h2>Historique</h2></div>
            {historique.length ? (
              <ol className="tl">
                {historique.map((e, i) => (
                  <li key={`${e.label}-${i}`} className="done">
                    <span className="dot"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg></span>
                    <div><strong>{e.label}</strong><small>{e.quand}</small></div>
                  </li>
                ))}
                {brouillon ? (
                  <li className="now"><span className="dot" /><div><strong>Version {num(brouillon)} en préparation</strong><small>à vérifier puis envoyer</small></div></li>
                ) : null}
              </ol>
            ) : <p className="muted">Rien d'envoyé pour l'instant.</p>}
          </div>
          {quote.projectId && devisSigne ? <Link className="link" href={`/avenant?quoteId=${quote.id}`}>Faire un avenant</Link> : null}
        </aside>
      </div>
    </div>
  );
}
