"use client";

import { useEffect, useState } from "react";
import { apiGet, apiSend } from "../lib/client-api";

// Koji Client (maquette PRO-14.1) : l'entreprise présente un sous-traitant ;
// le client l'accepte avec ses conditions de paiement, comme la loi le
// demande pour les travaux sous-traités.
export function ClientSousTraitant({ quoteId }) {
  const [liste, setListe] = useState([]);
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");
  useEffect(() => {
    if (quoteId) apiGet(`/api/client/sous-traitance?quoteId=${encodeURIComponent(quoteId)}`).then((x) => setListe(x.contrats || [])).catch(() => null);
  }, [quoteId]);
  if (!liste.length && !message) return null;
  async function repondre(id, accord) {
    setErreur("");
    try {
      await apiSend("/api/client/sous-traitance", { quoteId, id, accord });
      setListe((l) => l.filter((x) => x.id !== id));
      setMessage(accord ? "Merci : le sous-traitant est accepté." : "C'est noté : l'entreprise est prévenue.");
    } catch (e) { setErreur(e.message); }
  }
  return (
    <section className="ccd-section cfc" id="sous-traitance">
      <h2>Un sous-traitant pour votre chantier</h2>
      {liste.map((c) => (
        <div key={c.id} className="cfc-form">
          <p>{c.message}</p>
          <div className="cfc-row"><span><b>Paiement du sous-traitant</b><small>{c.paiement}</small></span></div>
          <p className="cfc-note">Votre accord est demandé par la loi pour les travaux sous-traités.</p>
          <div className="cfc-actions">
            <button type="button" className="cfc-send" onClick={() => repondre(c.id, true)}>Accepter le sous-traitant</button>
            <button type="button" className="cfc-cta" onClick={() => repondre(c.id, false)}>Refuser</button>
          </div>
        </div>
      ))}
      {message ? <p className="cfc-msg" role="status">{message}</p> : null}
      {erreur ? <p className="cfc-msg" role="alert">{erreur}</p> : null}
    </section>
  );
}
