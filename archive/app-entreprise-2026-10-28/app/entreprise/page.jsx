"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

// Accueil / Dashboard for entreprise users.
// Shows KPIs, quick actions, recent activity.
export default function EntrepriseAccueil() {
  const router = useRouter();
  const [kpis, setKpis] = useState({
    devisPending: 0,
    chantiersActifs: 0,
    factures: 0,
    messagesNonLus: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadKpis();
  }, []);

  const loadKpis = async () => {
    try {
      setLoading(true);
      // TODO: Call API to fetch KPIs
      // For now, show placeholders
      setKpis({
        devisPending: 5,
        chantiersActifs: 3,
        factures: 12,
        messagesNonLus: 2,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return <div style={{ color: "red" }}>Erreur: {error}</div>;
  }

  return (
    <div>
      {/* Page title */}
      <h1 style={{ marginBottom: "32px" }}>Accueil</h1>

      {/* KPI Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "32px",
        }}
      >
        {[
          { label: "Devis en attente", value: kpis.devisPending, href: "/entreprise/devis", color: "#ff8c42" },
          { label: "Chantiers actifs", value: kpis.chantiersActifs, href: "/entreprise/chantiers", color: "#4aa3e0" },
          { label: "Factures", value: kpis.factures, href: "/entreprise/facturation", color: "#2ecc71" },
          { label: "Messages", value: kpis.messagesNonLus, href: "/entreprise/notifications", color: "#9b59b6" },
        ].map((kpi) => (
          <Link key={kpi.label} href={kpi.href}>
            <a
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid #e0e6ed",
                borderRadius: "8px",
                padding: "24px",
                textDecoration: "none",
                cursor: "pointer",
                transition: "all 0.3s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)")}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
            >
              <div
                style={{
                  fontSize: "32px",
                  fontWeight: "800",
                  color: kpi.color,
                  marginBottom: "8px",
                }}
              >
                {loading ? "—" : kpi.value}
              </div>
              <div style={{ fontSize: "14px", color: "#718096" }}>{kpi.label}</div>
            </a>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div style={{ marginBottom: "32px" }}>
        <h2 style={{ marginBottom: "16px" }}>Actions rapides</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
          {[
            { label: "Créer un devis", href: "/entreprise/devis-ia/new", color: "#0052cc" },
            { label: "Nouveau chantier", href: "/entreprise/chantiers/new", color: "#059669" },
            { label: "Voir les messages", href: "/entreprise/messages", color: "#9b59b6" },
          ].map((action) => (
            <Link key={action.label} href={action.href}>
              <a
                style={{
                  display: "inline-block",
                  backgroundColor: action.color,
                  color: "white",
                  padding: "12px 16px",
                  borderRadius: "6px",
                  textDecoration: "none",
                  fontWeight: "500",
                  fontSize: "14px",
                  cursor: "pointer",
                  transition: "opacity 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                {action.label}
              </a>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent activity placeholder */}
      <div>
        <h2 style={{ marginBottom: "16px" }}>Activité récente</h2>
        <div
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e0e6ed",
            borderRadius: "8px",
            padding: "24px",
            color: "#718096",
            textAlign: "center",
          }}
        >
          Aucune activité récente
        </div>
      </div>
    </div>
  );
}
