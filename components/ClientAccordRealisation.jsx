"use client";

import { useEffect, useState } from "react";
import { apiGet, apiSend } from "../lib/client-api";

// Koji Client : l'entreprise demande l'accord pour montrer le chantier sur
// sa page Koji (photos avant / après, ville seulement).
export function ClientAccordRealisation({ quoteId, entreprise }) {
  const [d, setD] = useState(null);
  const [fait, setFait] = useState("");
  const [erreur, setErreur] = useState("");
  useEffect(() => {
    if (quoteId) apiGet(`/api/client/realisation-accord?quoteId=${encodeURIComponent(quoteId)}`).then((x) => setD(x.demande)).catch(() => null);
  }, [quoteId]);
  if (!d && !fait) return null;
  async function repondre(accord) {
    setErreur("");
    try {
      await apiSend("/api/client/realisation-accord", { quoteId, accord });
      setFait(accord ? "Merci : la réalisation est publiée sur la page de l'entreprise." : "C'est noté : rien n'est publié.");
      setD(null);
    } catch (e) { setErreur(e.message); }
  }
  return (
    <section className="ccd-section cfc" id="realisation">
      <h2>Montrer votre chantier</h2>
      {d ? (
        <>
          <p className="cfc-note">{entreprise || "L'entreprise"} souhaite publier « {d.titre} » sur sa page Koji : photos avant / après et la ville ({d.lieu || "sans adresse"}), jamais votre adresse ni votre nom.</p>
          <div className="cfc-photos">{[...d.avant.slice(0, 2), ...d.apres.slice(0, 2)].map((u, i) => <img key={u} src={u} alt={i < d.avant.slice(0, 2).length ? "Avant" : "Après"} />)}</div>
          <div className="cfc-actions">
            <button type="button" className="cfc-send" onClick={() => repondre(true)}>J'accepte</button>
            <button type="button" className="cfc-cta" onClick={() => repondre(false)}>Je refuse</button>
          </div>
        </>
      ) : <p className="cfc-msg" role="status">{fait}</p>}
      {erreur ? <p className="cfc-msg" role="alert">{erreur}</p> : null}
    </section>
  );
}
