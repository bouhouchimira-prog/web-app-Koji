"use client";

import { useState } from "react";
import { apiSend } from "../lib/client-api";
import { ECHEANCES_ACOMPTE, POURCENTAGES_ACOMPTE, dateEcheance, erreurAcompte, messageAcompte, montantAcompte, tvaIncluse } from "../lib/facture-acompte";

// Facture d'acompte (maquette PRO-03.4) : panneau depuis le devis signé.
// Seul le pourcentage se choisit (pré-réglé sur le devis) ; la facture
// reprend le client, les montants et la TVA du devis. « Enregistrer en
// brouillon » la garde dans Factures ; « Envoyer la facture d'acompte »
// l'émet et l'envoie par e-mail avec son PDF.

function IconCheck() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>;
}

function IconSend() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 16-2-7z" /></svg>;
}

function euro(n) {
  return Number(n || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function jourCourt(jour) {
  const d = new Date(`${String(jour || "").slice(0, 10)}T12:00:00Z`);
  return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", day: "numeric", month: "short" }).format(d) : "";
}

const aujourdhui = () => new Date().toISOString().slice(0, 10);

export function FactureAcompte({ quote, totals, client, debut, pourcentagePrevu, restant, brouillon, onClose, onDone }) {
  const [pourcentage, setPourcentage] = useState(() => Number(brouillon?.percent) || Number(pourcentagePrevu) || 30);
  const [autre, setAutre] = useState(() => !POURCENTAGES_ACOMPTE.includes(Number(brouillon?.percent) || Number(pourcentagePrevu) || 30));
  const [echeance, setEcheance] = useState("reception");
  const [message, setMessage] = useState(() => messageAcompte({ client: client?.name || "", pourcentage: Number(brouillon?.percent) || Number(pourcentagePrevu) || 30, debut }));
  const [adresse, setAdresse] = useState(client?.email || quote?.clientEmail || "");
  const [email, setEmail] = useState(true);
  const [envoi, setEnvoi] = useState("");
  const [erreur, setErreur] = useState("");

  const montant = brouillon ? Number(brouillon.amountTtc) || 0 : montantAcompte(totals.ttc, pourcentage);
  // Signé au domicile (PRO-03.7) : aucun paiement avant 7 jours.
  const bloqueJusquau = quote?.acompteAPartirDu && quote.acompteAPartirDu > aujourdhui() ? quote.acompteAPartirDu : "";
  const tva = tvaIncluse(montant, totals.vatRate);
  const signeLe = quote?.signedAt ? ` · signé le ${jourCourt(quote.signedAt)}` : "";

  function choisir(p) {
    setAutre(false);
    setPourcentage(p);
    setMessage((m) => m.replace(/de [\d,]+ % prévue/, `de ${String(p).replace(".", ",")} % prévue`));
  }

  async function creer() {
    const jours = ECHEANCES_ACOMPTE.find((e) => e.id === echeance)?.jours || 0;
    const { invoice } = await apiSend("/api/invoices", {
      quoteId: quote.id,
      projectId: quote.projectId,
      type: "Acompte initial",
      amountMode: "deposit",
      depositPercent: pourcentage,
      dueDate: dateEcheance(aujourdhui(), jours),
      notes: `Acompte sur devis ${quote.quoteNumber}`
    });
    return invoice;
  }

  async function valider(envoyer) {
    const manque = erreurAcompte({ pourcentage, montant, restant: brouillon ? null : restant, envoyer, email, adresse });
    if (manque) {
      setErreur(manque);
      return;
    }
    setEnvoi(envoyer ? "envoi" : "brouillon");
    setErreur("");
    let facture = brouillon || null;
    try {
      if (!facture) facture = await creer();
      if (!envoyer) {
        onDone?.(facture, `Facture d'acompte ${facture.invoiceNumber} enregistrée en brouillon.`);
        return;
      }
      const { invoice } = await apiSend("/api/invoices", { id: facture.id, action: "send", email, to: adresse.trim(), message }, "PATCH");
      onDone?.(invoice, email ? `Facture d'acompte ${invoice.invoiceNumber} envoyée à ${adresse.trim()}.` : `Facture d'acompte ${invoice.invoiceNumber} émise.`);
    } catch (error) {
      // La facture créée reste en brouillon : on la garde pour la renvoyer.
      if (facture && !brouillon) onDone?.(facture, "", { garderOuvert: true });
      setErreur(`${error.message || "La facture n'est pas partie."}${facture ? ` Elle reste en brouillon (${facture.invoiceNumber}).` : ""}`);
      setEnvoi("");
    }
  }

  return (
    <>
      <div className="env-scrim" onClick={envoi ? undefined : onClose} />
      <section className="env-panel ac-env" role="dialog" aria-modal="true" aria-label="Facture d'acompte">
        <div className="env-h">
          <h2>Facture d'acompte</h2>
          <button type="button" className="link" onClick={onClose} disabled={Boolean(envoi)}>Fermer</button>
        </div>

        <div className="env-sum">
          <div>
            <span className="lab">Devis signé</span>
            <strong>{quote.quoteNumber}{client?.name ? ` · ${client.name}` : ""}</strong>
            <span className="muted">{euro(totals.ht)} HT · {euro(totals.ttc)} TTC{signeLe}</span>
          </div>
          <div>
            <span className="lab">Facture</span>
            <strong>{brouillon?.invoiceNumber || "Nouvelle facture"}</strong>
            <span className="muted">Acompte sur devis {quote.quoteNumber}{brouillon ? " · brouillon" : ""}</span>
          </div>
        </div>

        <div className="ac-pct">
          <span className="lab">Acompte</span>
          <div className="chips" role="group" aria-label="Pourcentage de l'acompte">
            {POURCENTAGES_ACOMPTE.map((p) => (
              <button key={p} type="button" className={`chip${!autre && pourcentage === p ? " on" : ""}`} aria-pressed={!autre && pourcentage === p} disabled={Boolean(brouillon) || Boolean(envoi)} onClick={() => choisir(p)}>{p} %</button>
            ))}
            <button type="button" className={`chip${autre ? " on" : ""}`} aria-pressed={autre} disabled={Boolean(brouillon) || Boolean(envoi)} onClick={() => setAutre(true)}>Autre</button>
            {autre ? (
              <label className="ac-autre">
                <input type="number" min="1" max="100" step="1" value={pourcentage} disabled={Boolean(brouillon) || Boolean(envoi)} onChange={(e) => setPourcentage(Number(e.target.value) || 0)} aria-label="Pourcentage de l'acompte" />
                <span>%</span>
              </label>
            ) : null}
          </div>
        </div>

        <div className="ac-amt">
          <div><span>Base TTC</span><b>{euro(totals.ttc)}</b></div>
          <div><span>{String(pourcentage).replace(".", ",")} %</span><b>{euro(montant)}</b></div>
          <div className="big"><span>Montant de la facture</span><b>{euro(montant)} TTC</b><small>dont TVA {String(totals.vatRate).replace(".", ",")} % {euro(tva)}</small></div>
        </div>

        <div className="env-grid">
          <label className="ed">
            <span className="ed-l">Échéance</span>
            <select className="selv" value={echeance} disabled={Boolean(brouillon) || Boolean(envoi)} onChange={(e) => setEcheance(e.target.value)}>
              {ECHEANCES_ACOMPTE.map((e) => <option key={e.id} value={e.id}>{e.libelle}</option>)}
            </select>
          </label>
          <div className="ed">
            <span className="ed-l">Règlement</span>
            <div className="selv">Virement · IBAN sur la facture</div>
          </div>
        </div>

        <label className="ed">
          <span className="ed-l">Message au client</span>
          <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} disabled={Boolean(envoi)} />
        </label>

        <div className="env-ch">
          <span className="lab">Envoi</span>
          <label className={`ck${email ? " on" : ""}`}>
            <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} disabled={Boolean(envoi)} />
            {email ? <IconCheck /> : null}
            E-mail avec le PDF
          </label>
          {email ? (
            <input className="ac-mail" type="email" value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="E-mail du client" aria-label="E-mail du client" disabled={Boolean(envoi)} />
          ) : null}
        </div>

        {bloqueJusquau ? (
          <p className="notice">Signé chez le client : aucun paiement avant le {jourCourt(bloqueJusquau)} (Code de la consommation, L221-10). Enregistre la facture en brouillon ; elle pourra partir à partir de cette date.</p>
        ) : null}
        {erreur ? <p className="err" role="alert">{erreur}</p> : null}

        <div className="env-act">
          {!brouillon ? (
            <button type="button" className="btn btn-sec" onClick={() => valider(false)} disabled={Boolean(envoi)}>{envoi === "brouillon" ? "Enregistrement…" : "Enregistrer en brouillon"}</button>
          ) : null}
          <button type="button" className="btn btn-main" onClick={() => valider(true)} disabled={Boolean(envoi) || Boolean(bloqueJusquau)}>
            <IconSend />{envoi === "envoi" ? "Envoi…" : "Envoyer la facture d'acompte"}
          </button>
        </div>
      </section>
    </>
  );
}
