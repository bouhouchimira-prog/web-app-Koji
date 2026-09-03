"use client";

import Link from "next/link";
import { Shell } from "../../components/Shell";
import { useLocale } from "../../lib/i18n";
import { useApi } from "../../lib/use-api";
import { euro, shortDate } from "../../lib/pricing";

function RadarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
    </svg>
  );
}

export default function MarketplacePage() {
  const { L } = useLocale();
  const { data: offres, loading } = useApi("/api/marketplace/offres", "offres");

  return (
    <Shell>
      <header className="page-header">
        <div>
          <p className="eyebrow">{L.marketplace.eyebrow}</p>
          <h1>{L.marketplace.title}</h1>
        </div>
      </header>

      <section className="mobile-tool">
        <div className="home-list">
          {loading ? <div className="tool-empty">Chargement…</div> : null}
          {!loading && offres.length === 0 ? (
            <div className="tool-empty">Aucun chantier publié pour l'instant sur Radar des Chantiers.</div>
          ) : null}
          {offres.map((offre) => (
            <Link href={`/marketplace/${offre.id}`} className="home-list-item home-list-link" key={offre.id}>
              <div className="home-list-icon home-icon-radar"><RadarIcon /></div>
              <div className="home-list-main">
                <strong>{offre.description.slice(0, 70)}{offre.description.length > 70 ? "…" : ""}</strong>
                <small>{[offre.metier, offre.address].filter(Boolean).join(" · ")}</small>
              </div>
              <div style={{ textAlign: "right" }}>
                {offre.budget ? <div style={{ fontSize: "0.78rem", color: "#7e715f", fontWeight: 700 }}>{euro(offre.budget)}</div> : null}
                <small style={{ color: "#94a3b8", fontSize: "11.5px" }}>{shortDate(offre.createdAt)}</small>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </Shell>
  );
}
