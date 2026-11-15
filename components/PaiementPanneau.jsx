"use client";

import { useState } from "react";
import { apiSend } from "../lib/client-api";
import { fixText } from "../lib/text";
import { MOYENS, PLAFOND_ESPECES, encaisse, resteDu } from "../lib/encaissements";

// Marquer payée (maquette PRO-06.3) : tout ou une partie, date, moyen,
// référence facultative, reçu PDF au client avec le solde restant.
const euro = (n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n) || 0);
const Coche = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>;
const aujourdhui = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());

export function creditsSur(invoice, invoices = []) {
  return invoices.filter((a) => a.kind === "avoir" && a.refInvoiceId === invoice.id && a.status !== "Annulee").reduce((s, a) => s - Number(a.amountTtc || 0), 0);
}

export function PaiementPanneau({ invoice, invoices = [], quote = null, onClose, onDone }) {
  const du = resteDu(invoice, creditsSur(invoice, invoices));
  const [tout, setTout] = useState(true);
  const [montant, setMontant] = useState(String(du));
  const [jour, setJour] = useState(aujourdhui());
  const [moyen, setMoyen] = useState("virement");
  const [reference, setReference] = useState("");
  const [recu, setRecu] = useState(Boolean(invoice.clientEmail));
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState("");
  const recuMontant = tout ? du : Math.round((Number(String(montant).replace(",", ".")) || 0) * 100) / 100;
  const resteFacture = Math.max(0, Math.round((du - recuMontant) * 100) / 100);
  // Reste sur le chantier : devis − tout ce qui est encaissé sur ses factures.
  const totalDevis = Number(quote?.totalTtc || 0);
  const encaisseDevis = quote ? invoices.filter((f) => f.kind !== "avoir" && f.quoteId === quote.id && f.status !== "Annulee").reduce((s, f) => s + encaisse(f), 0) : 0;
  const resteChantier = quote && totalDevis > 0 ? Math.max(0, Math.round((totalDevis - encaisseDevis - recuMontant) * 100) / 100) : null;
  const particulier = quote?.clientType !== "societe";
  const client = fixText(invoice.client || "le client");

  async function enregistrer() {
    setBusy(true);
    setErreur("");
    try {
      const { invoice: maj } = await apiSend("/api/invoices", { id: invoice.id, action: "payment", amount: recuMontant, date: jour, moyen, reference, recu }, "PATCH");
      onDone?.(maj);
    } catch (e) {
      setErreur(e.message || "Le paiement n'a pas pu être enregistré.");
      setBusy(false);
    }
  }

  return (
    <>
      <div className="env-scrim" onClick={busy ? undefined : onClose} />
      <section className="env-panel" role="dialog" aria-modal="true" aria-label="Marquer payée">
        <div className="env-h"><h2>Marquer payée · {invoice.invoiceNumber}</h2><button type="button" className="link" onClick={onClose}>Fermer</button></div>
        <div className="env-sum">
          <div><span className="lab">Facture</span><strong>{[fixText(invoice.type || "Facture"), fixText(invoice.projectTitle || "")].filter(Boolean).join(" · ")}</strong><span className="muted">{euro(invoice.amountTtc)} TTC{du < Number(invoice.amountTtc || 0) - 0.01 ? ` · reste dû ${euro(du)}` : ""}</span></div>
        </div>
        <div className="env-ch">
          <span className="lab">Montant reçu</span>
          <div className="kp-seg" role="group" aria-label="Montant reçu">
            <button type="button" className={tout ? "on" : ""} aria-pressed={tout} onClick={() => setTout(true)}>Tout · {euro(du)}</button>
            <button type="button" className={!tout ? "on" : ""} aria-pressed={!tout} onClick={() => setTout(false)}>Une partie</button>
          </div>
        </div>
        <div className="env-sum">
          <div>
            <span className="lab">Montant</span>
            {tout ? <strong>{euro(du)}</strong> : <input type="number" min="0.01" max={du} step="0.01" value={montant} onChange={(e) => setMontant(e.target.value)} aria-label="Montant reçu" />}
          </div>
          <div><span className="lab">Reçu le</span><input type="date" value={jour} max={aujourdhui()} onChange={(e) => setJour(e.target.value)} aria-label="Reçu le" /></div>
        </div>
        <div className="env-ch">
          <span className="lab">Moyen</span>
          {Object.entries(MOYENS).map(([id, label]) => (
            <button key={id} type="button" className={`ck${moyen === id ? " on" : ""}`} aria-pressed={moyen === id} onClick={() => setMoyen(id)}><Coche />{label}</button>
          ))}
        </div>
        {moyen === "especes" && particulier && recuMontant > PLAFOND_ESPECES ? (
          <p className="notice" role="alert">Paiement en espèces d'un particulier limité à {euro(PLAFOND_ESPECES)} : au-delà, demandez un autre moyen.</p>
        ) : null}
        <label className="env-ch"><span className="lab">Référence du virement · facultatif</span><input type="text" value={reference} maxLength={140} onChange={(e) => setReference(e.target.value)} placeholder="VIR LEFEVRE SIT1" /></label>
        <div className="env-ch">
          <span className="lab">Reçu</span>
          <button type="button" className={`ck${recu ? " on" : ""}`} aria-pressed={recu} disabled={!invoice.clientEmail} onClick={() => setRecu((v) => !v)}>
            <Coche />Envoyer un reçu à {client}{invoice.clientEmail ? "" : " (pas d'e-mail sur la facture)"}
          </button>
          <span className="sm2">PDF « paiement reçu », avec le solde restant.</span>
        </div>
        <div className="ac-amt">
          <div><span>Après ce paiement, reste sur la facture</span><b>{euro(resteFacture)}</b></div>
          {resteChantier !== null ? <div><span>Reste sur le chantier</span><b>{euro(resteChantier)}</b></div> : null}
        </div>
        {erreur ? <p className="err" role="alert">{erreur}</p> : null}
        <div className="env-act">
          <button type="button" className="btn btn-sec" onClick={onClose} disabled={busy}>Annuler</button>
          <button type="button" className="btn btn-main" onClick={enregistrer} disabled={busy || !(recuMontant > 0) || recuMontant > du + 0.01}>{busy ? "Enregistrement…" : "Enregistrer le paiement"}</button>
        </div>
      </section>
    </>
  );
}
