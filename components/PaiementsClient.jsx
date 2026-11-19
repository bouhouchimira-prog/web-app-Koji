"use client";

import { useEffect, useState } from "react";
import "../app/client/cli02.css";
import "../app/client/paiement-en-ligne.css";

// « Payer » (maquette CLI-02) : seulement si le serveur l'a proposé
// (aPayer.payer, compte Stripe de l'entreprise confirmé). Le navigateur
// n'envoie que la facture : le montant est le reste dû calculé par le
// serveur, la page de paiement est celle du prestataire (Stripe Checkout).
export function BoutonPayer({ aPayer, retour = "chantier", className = "kc-btn sm kc2-plein" }) {
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  if (!aPayer?.payer || !aPayer.factureId) return null;
  async function payer() {
    if (envoi) return;
    setEnvoi(true);
    setErreur("");
    try {
      const r = await fetch(`/api/client/factures/${encodeURIComponent(aPayer.factureId)}/paiement`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retour })
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !/^https:\/\//.test(String(data.url || ""))) throw new Error(data.error || "Le paiement n'a pas pu démarrer.");
      window.location.assign(data.url);
    } catch (e) {
      setErreur(e.message || "Le paiement n'a pas pu démarrer.");
      setEnvoi(false);
    }
  }
  return (
    <>
      <button type="button" className={`${className} kc-payer`} onClick={payer} disabled={envoi}>{envoi ? "Ouverture du paiement…" : aPayer.payer.libelle}</button>
      {erreur ? <p className="kc-alerte" role="alert">{erreur}</p> : null}
    </>
  );
}

// Retour de la page de paiement (?paiement=ok|annule).
export function RetourPaiement() {
  const [etat, setEtat] = useState("");
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("paiement");
    if (p === "ok" || p === "annule") setEtat(p);
  }, []);
  if (!etat) return null;
  return (
    <p className={etat === "ok" ? "kc2-ok" : "kc-alerte"} role="status">
      {etat === "ok"
        ? "Paiement transmis. Il apparaît ici dès que le prestataire le confirme, en général en quelques secondes ; le reçu arrive dans Documents."
        : "Paiement abandonné : rien n'a été prélevé."}
    </p>
  );
}

// Koji Client · lignes de paiement (maquette CLI-02) : payé, à payer, à
// venir, retenue de garantie. Partagé par l'onglet Paiements d'un chantier
// et la page « Paiements » de tous les chantiers.
export function ListePaiements({ paiements }) {
  return (
    <>
      {paiements.lignes.length ? (
        <div className="kc2-pays">
          {paiements.lignes.map((l) => (
            <div key={l.id} className={`kc2-pay ${l.etat === "paye" ? "ok" : l.etat === "a_venir" ? "next" : paiements.aPayer?.factureId === l.id ? "due" : ""}`}>
              <div><b>{l.titre}</b><small>{l.detail}{l.pdf ? <> · <a href={l.pdf} download>PDF</a></> : null}</small></div>
              <em>{l.montant}</em>
            </div>
          ))}
        </div>
      ) : <p className="kc2-vide">{paiements.vide}</p>}
      {paiements.retenue ? <div className="kc-info">{paiements.retenue}</div> : null}
    </>
  );
}
