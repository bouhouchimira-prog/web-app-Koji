"use client";

import "./home-pro.css";

// Erreur (gabarit DA Koji Pro, maquette PRO-19, états techniques).
export default function Error({ reset }) {
  return (
    <div className="pro public-pro wide">
      <div className="head">
        <div className="stack">
          <span className="eyebrow">Erreur</span>
          <h1>Quelque chose n'a pas marché</h1>
          <span className="muted">Rien n'est perdu : votre dernière saisie est gardée. Réessayez dans un instant.</span>
        </div>
        <div className="hact">
          <button type="button" className="btn btn-main" onClick={() => reset()}>Réessayer</button>
          <a className="btn btn-sec" href="mailto:contact@kojibuild.com">Prévenir le support</a>
        </div>
      </div>
    </div>
  );
}
