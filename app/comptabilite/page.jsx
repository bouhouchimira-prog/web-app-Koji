"use client";

import { Shell } from "../../components/Shell";

// Page "Comptabilités" (12 oct, demande d'Amira) — ajoutee au menu Koji
// Premium, contenu a definir avec elle plus tard. Simple message d'attente
// pour l'instant, plutot qu'un lien casse vers une page inexistante.
export default function ComptabilitePage() {
  return (
    <Shell>
      <section className="mobile-tool">
        <header className="tool-topline">
          <button type="button" className="plain-back" onClick={() => (window.history.length > 1 ? window.history.back() : window.location.assign("/"))}>{"<"}</button>
          <h1>Comptabilités</h1>
          <span />
        </header>
        <div className="tool-empty">
          <strong>Bientôt disponible</strong>
          <span>Cet outil est en cours de construction.</span>
        </div>
      </section>
    </Shell>
  );
}
