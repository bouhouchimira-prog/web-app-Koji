"use client";

import { Shell } from "../../components/Shell";
import { AuthBrandPanel } from "../../components/AuthBrandPanel";
import { useLocale } from "../../lib/i18n";

export default function MarketplacePage() {
  const { L } = useLocale();
  return (
    <Shell>
      <header className="page-header">
        <div>
          <p className="eyebrow">{L.marketplace.eyebrow}</p>
          <h1>{L.marketplace.title}</h1>
        </div>
      </header>

      <section className="marketplace-soon-card">
        <AuthBrandPanel showStoreBadges={false} />
        <p className="marketplace-soon-text">{L.marketplace.comingSoon}</p>
      </section>
    </Shell>
  );
}
