"use client";

import "../app/client/cli02.css";

// Koji Client · lignes de paiement (maquette CLI-02) : payé, à payer, à
// venir, retenue de garantie. Partagé par l'onglet Paiements d'un chantier
// et la page « Paiements » de tous les chantiers. Pas de paiement en ligne :
// chaque facture se télécharge.
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
