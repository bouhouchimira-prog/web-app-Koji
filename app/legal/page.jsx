"use client";

import "../home-pro.css";
import { useLocale } from "../../lib/i18n";

// Pages légales : gabarit DA Koji Pro (maquette PRO-20). Public, donc hors Shell :
// la classe .pro pose les jetons de couleur, .legal-pro le fond et la colonne.
export default function LegalPage() {
  const { L } = useLocale();

  return (
    <div className="pro public-pro">
      <div className="head">
        <div className="stack">
          <button type="button" className="link" onClick={() => (window.history.length > 1 ? window.history.back() : window.location.assign("/"))}>← Retour</button>
          <span className="eyebrow">Informations légales</span>
          <h1>{L.settings.legal}</h1>
        </div>
      </div>

      {L.legal.draftBanner ? <p className="notice" role="status">{L.legal.draftBanner}</p> : null}

      <div className="kj-col">
        {L.legal.sections.map((section, index) => (
          <section key={index} className="card">
            <div className="card-h"><h2>{section.title}</h2></div>
            {section.paragraphs.map((paragraph, pIndex) => (
              <p key={pIndex} className="kj-p">{paragraph}</p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
