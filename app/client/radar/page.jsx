"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ClientTopbar } from "../../../components/ClientTopbar";
import { shortDate } from "../../../lib/pricing";

const STATUS_LABEL = {
  Publiee: "Publiée",
  "En attente": "En attente",
  Terminee: "Terminée",
  SansSuite: "Sans suite"
};

export default function ClientRadarPage() {
  const [offres, setOffres] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/chantier-offres")
      .then((r) => r.json())
      .then((data) => setOffres(data.offres || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="client-space">
      <ClientTopbar showBack backHref="/client" />

      <div className="ct-welcome">
        <strong>Publier un chantier</strong>
        <small>Publiez vos travaux, les entreprises du BTP vous contactent. Gratuit et illimité.</small>
      </div>

      <section className="ct-section">
        <Link href="/client/radar/new" className="client-publish-cta">
          <span className="new-chantier-icon">+</span>
          Publier un chantier
        </Link>
      </section>

      <section className="ct-section">
        <div className="ct-section-title-row">
          <h2 className="ct-section-title">Mes demandes</h2>
        </div>
        {loading ? <div className="client-empty">Chargement…</div> : null}
        {!loading && offres.length === 0 ? <div className="client-empty">Aucune offre publiée pour l'instant.</div> : null}
        <div className="client-list">
          {offres.map((offre) => (
            <Link key={offre.id} href={`/client/radar/${offre.id}`} className="ct-offer-card">
              <div className="ct-offer-card-info">
                <strong>{offre.description.slice(0, 60)}{offre.description.length > 60 ? "…" : ""}</strong>
                <small>{offre.address} · {shortDate(offre.createdAt)}</small>
              </div>
              <div className="ct-devis-row-right">
                <span className="radar-status-badge">{STATUS_LABEL[offre.status] || offre.status}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
