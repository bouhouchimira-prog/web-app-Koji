"use client";

import { Shell } from "../../components/Shell";
import { AuthBrandPanel } from "../../components/AuthBrandPanel";

export default function MarketplacePage() {
  return (
    <Shell>
      <header className="page-header">
        <div>
          <p className="eyebrow">MARKETPLACE</p>
          <h1>Chantiers disponibles</h1>
        </div>
      </header>

      <section className="marketplace-soon-card">
        <AuthBrandPanel />
        <p className="marketplace-soon-text">Votre marketplace Kôji sera bientôt disponible.</p>
      </section>
    </Shell>
  );
}
