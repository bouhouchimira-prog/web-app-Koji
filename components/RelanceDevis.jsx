"use client";

import { useState } from "react";
import { apiSend } from "../lib/client-api";
import { messageRelance } from "../lib/devis-liste";

// Relancer un devis envoyé (maquettes PRO-03 et PRO-03.3) : message proposé
// par Koji, modifiable, envoyé par e-mail avec le lien de signature. Utilisé
// depuis la liste des devis et depuis la page de suivi du devis.
export function RelanceDevis({ quote, onClose, onDone }) {
  const [message, setMessage] = useState(() => messageRelance(quote, { entreprise: quote.company?.name || "" }));
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  async function envoyer() {
    setEnvoi(true);
    setErreur("");
    try {
      const { quote: relance } = await apiSend("/api/quotes", { id: quote.id, action: "relancer", message }, "PATCH");
      onDone?.(relance, `Relance envoyée à ${quote.clientEmail}.`);
    } catch (error) {
      setErreur(error.message || "La relance n'est pas partie.");
      setEnvoi(false);
    }
  }

  return (
    <>
      <div className="env-scrim" onClick={envoi ? undefined : onClose} />
      <section className="env-panel dv-rel" role="dialog" aria-modal="true" aria-label={`Relancer le devis ${quote.quoteNumber}`}>
        <div className="env-h">
          <div>
            <h2>Relancer le devis {quote.quoteNumber}</h2>
            <span className="muted">{[quote.client, quote.clientEmail].filter(Boolean).join(" · ")}</span>
          </div>
          <button type="button" className="link" onClick={onClose} disabled={envoi}>Fermer</button>
        </div>
        <label className="dv-rel-m">
          <span className="lab">Message · proposé par Koji</span>
          <textarea rows={10} value={message} onChange={(event) => setMessage(event.target.value)} maxLength={3000} />
        </label>
        <p className="muted">Koji ajoute le lien pour consulter et signer le devis ; le client garde le mot de passe reçu avec le premier envoi.</p>
        {!quote.clientEmail ? <p className="cl-err">Pas d'e-mail client sur ce devis.</p> : null}
        {erreur ? <p className="cl-err" role="alert">{erreur}</p> : null}
        <div className="env-act">
          <button type="button" className="btn btn-main" disabled={envoi || !quote.clientEmail || !message.trim()} onClick={envoyer}>{envoi ? "Envoi…" : "Envoyer la relance"}</button>
        </div>
      </section>
    </>
  );
}
