"use client";

import Link from "next/link";
import { useState } from "react";
import { apiSend } from "../lib/client-api";

// Recharger des jetons du Radar (maquette PRO-04, décision du 14 novembre) :
// paiement Stripe au prix du jeton de votre offre (page Tarifs), crédité
// dès que le paiement est reçu.
const QUANTITES = [5, 10, 20, 50];
const prix = (n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(n);

export function RechargeJetons({ jetons, manque = 0, retour = "/marketplace", onClose }) {
  const prixHt = Number(jetons?.prixHt) || 10;
  const [quantite, setQuantite] = useState(QUANTITES.find((q) => q >= manque) || 20);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  async function payer() {
    setEnvoi(true);
    setErreur("");
    try {
      const { url } = await apiSend("/api/radar/jetons", { quantite, retour });
      window.location.href = url;
    } catch (error) {
      setErreur(error.message || "Le paiement n'a pas pu démarrer.");
      setEnvoi(false);
    }
  }

  return (
    <>
      <div className="env-scrim" onClick={envoi ? undefined : onClose} />
      <section className="env-panel" role="dialog" aria-modal="true" aria-label="Recharger des jetons">
        <div className="env-h">
          <h2>Recharger des jetons</h2>
          <button type="button" className="link" onClick={onClose}>Fermer</button>
        </div>
        <div className="env-ch">
          <span className="lab">Votre solde</span>
          <p className="rx-p"><b>{jetons?.solde ?? 0} jeton{(jetons?.solde ?? 0) > 1 ? "s" : ""}</b>{jetons?.reserves ? ` · ${jetons.reserves} réservé${jetons.reserves > 1 ? "s" : ""}` : ""}{manque ? ` · il en manque ${manque} pour ce chantier` : ""}</p>
        </div>
        <div className="env-ch">
          <span className="lab">Combien de jetons</span>
          <div className="rx-qt">
            {QUANTITES.map((q) => (
              <button key={q} type="button" className={`rd-sl${quantite === q ? " on" : ""}`} onClick={() => setQuantite(q)} aria-pressed={quantite === q}>
                <b>{q} jetons</b>
                <span>{prix(q * prixHt)} HT</span>
              </button>
            ))}
          </div>
        </div>
        <div className="rd-tok">
          <span className="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M9 12h6M12 9v6" /></svg></span>
          <div>
            <strong>{prix(quantite * prixHt)} HT · {prix(quantite * prixHt * 1.2)} TTC</strong>
            <small>{prix(prixHt)} HT le jeton avec votre offre. Débités seulement quand un client confirme un rendez-vous avec vous ; sinon rendus.</small>
          </div>
        </div>
        {erreur ? <p className="err" role="alert">{erreur}</p> : null}
        <div className="env-act">
          <Link className="btn btn-sec" href="/entreprise/tarifs">Voir les offres</Link>
          <button type="button" className="btn btn-main" onClick={payer} disabled={envoi}>{envoi ? "Ouverture du paiement…" : "Payer et recharger"}</button>
        </div>
      </section>
    </>
  );
}
