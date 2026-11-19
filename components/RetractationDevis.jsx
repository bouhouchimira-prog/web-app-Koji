"use client";

import { useState } from "react";

// « Je changerai d'avis » (maquette PRO-03.7) : le délai, le formulaire type
// et « Me rétracter » avec une confirmation. Le même bloc sur la page du lien
// de signature et dans l'onglet Devis de Koji Client ; seule l'action change
// (onRetracter lance la requête et lève une erreur lisible en cas d'échec).
// Action destructrice : boutons en contour, jamais en marine plein.
export function RetractationDevis({ delai, possible, formulaire = [], onRetracter, lien = "Je changerai d'avis : où est le formulaire ?", ouvertParDefaut = false }) {
  const [ouvert, setOuvert] = useState(ouvertParDefaut);
  const [confirmer, setConfirmer] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  async function seRetracter() {
    setEnvoi(true);
    setErreur("");
    try {
      await onRetracter();
    } catch (e) {
      setErreur(e?.message || "La rétractation n'a pas pu être enregistrée.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <>
      <button type="button" className="kc2-lien" onClick={() => setOuvert((v) => !v)} aria-expanded={ouvert}>{lien}</button>
      {ouvert ? (
        <div className="ksg-form-r">
          <p>{possible ? delai : "Le délai de rétractation est terminé."}</p>
          {possible ? <p>Le formulaire est à la dernière page de votre exemplaire. Vous pouvez aussi l'envoyer à l'entreprise, ou annuler ici.</p> : null}
          {formulaire.map((l, i) => <p key={i} style={i === 0 ? {} : { fontWeight: 400 }}>{l}</p>)}
          {possible ? (
            confirmer ? (
              <div className="kc2-form" style={{ marginTop: 6 }}>
                <p>Confirmez-vous l'annulation de ce devis ? L'entreprise en sera prévenue et vous rembourse les sommes versées sous 14 jours.</p>
                <div className="kc2-actions">
                  <button type="button" className="kc-sec" onClick={() => setConfirmer(false)}>Garder le devis</button>
                  <button type="button" className="kc-sec" onClick={seRetracter} disabled={envoi}>{envoi ? "Envoi…" : "Je me rétracte"}</button>
                </div>
              </div>
            ) : <button type="button" className="kc-sec" style={{ marginTop: 6 }} onClick={() => setConfirmer(true)}>Me rétracter</button>
          ) : null}
          {erreur ? <p className="kc-alerte" role="alert">{erreur}</p> : null}
        </div>
      ) : null}
    </>
  );
}
