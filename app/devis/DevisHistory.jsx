"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { useLocale } from "../../lib/i18n";
import { useApi } from "../../lib/use-api";

function money(value) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(Number(value || 0));
}

const STATUS_COLORS = {
  "Brouillon": { bg: "#f1f5f9", color: "#475569" },
  "Pret a envoyer": { bg: "#fef3c7", color: "#92400e" },
  "Envoye": { bg: "#dbeafe", color: "#1d4ed8" },
  "Signe": { bg: "#dcfce7", color: "#166534" },
  "Refuse": { bg: "#fee2e2", color: "#b91c1c" },
  "Annule": { bg: "#fee2e2", color: "#b91c1c" },
  "Archive": { bg: "#f1f5f9", color: "#64748b" },
};

function StatusBadge({ status }) {
  const style = STATUS_COLORS[status] || { bg: "#f1f5f9", color: "#64748b" };
  const label = status === "Annule" ? "Refusé" : status === "Pret a envoyer" ? "Prêt à envoyer" : status;
  return <span className="status-pill" style={{ color: style.color, background: style.bg }}>{label}</span>;
}

// Statut "Devis" (15 oct, tableau de bord d'Amira) — pas un vrai champ, juste
// un regroupement du quote.status reel (Brouillon/Pret a envoyer/Envoye/
// Signe/Refuse/Annule/Archive) pour les 4 onglets de la maquette.
function bucketOf(status) {
  if (status === "Signe") return "accepte";
  if (status === "Envoye") return "envoye";
  if (status === "Refuse" || status === "Annule") return "refuse";
  return "brouillon";
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

const FILTER_TABS = [
  { id: "tous", label: "Tous" },
  { id: "brouillon", label: "Brouillons" },
  { id: "envoye", label: "Envoyés" },
  { id: "accepte", label: "Acceptés" },
  { id: "refuse", label: "Refusés" }
];

const RELANCE_DAYS = 5;

export default function DevisHistory() {
  const { L } = useLocale();
  const { data: quotes } = useApi("/api/quotes", "quotes");
  const [filterTab, setFilterTab] = useState("tous");

  const activeQuotes = useMemo(() => quotes.filter((q) => q.status !== "Archive"), [quotes]);

  const buckets = useMemo(() => {
    const out = { brouillon: [], envoye: [], accepte: [], refuse: [] };
    activeQuotes.forEach((q) => out[bucketOf(q.status)].push(q));
    return out;
  }, [activeQuotes]);

  const kpis = useMemo(() => {
    const now = new Date();
    const sentThisMonth = activeQuotes.filter((q) => {
      if (!q.sentAt) return false;
      const d = new Date(q.sentAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    const toRelancer = buckets.envoye.filter((q) => q.sentAt && daysSince(q.sentAt) >= RELANCE_DAYS);
    const decided = buckets.accepte.length + buckets.refuse.length;
    const acceptanceRate = decided > 0 ? Math.round((buckets.accepte.length / decided) * 100) : 0;
    const montantEnAttente = buckets.envoye.reduce((sum, q) => sum + Number(q.totalHt || 0), 0);
    return {
      sentThisMonth: sentThisMonth.length,
      pending: buckets.envoye.length,
      toRelancer: toRelancer.length,
      acceptanceRate,
      decided,
      montantEnAttente
    };
  }, [activeQuotes, buckets]);

  const pipeline = useMemo(() => {
    const rows = [
      { key: "brouillon", label: "Brouillons", count: buckets.brouillon.length, color: "#64748b" },
      { key: "envoye", label: "Envoyés", count: buckets.envoye.length, color: "#1d4ed8" },
      { key: "accepte", label: "Acceptés", count: buckets.accepte.length, color: "#15803d" },
      { key: "refuse", label: "Refusés", count: buckets.refuse.length, color: "#b91c1c" }
    ];
    const max = Math.max(1, ...rows.map((r) => r.count));
    return rows.map((r) => ({ ...r, pct: Math.round((r.count / max) * 100) }));
  }, [buckets]);

  const toRelancer = useMemo(() => {
    return buckets.envoye
      .filter((q) => q.sentAt && daysSince(q.sentAt) >= RELANCE_DAYS)
      .sort((a, b) => String(a.sentAt).localeCompare(String(b.sentAt)))
      .slice(0, 6);
  }, [buckets]);

  const filteredQuotes = useMemo(() => {
    const list = filterTab === "tous" ? activeQuotes : buckets[filterTab] || [];
    return [...list].sort((a, b) => String(b.createdAtIso || b.createdAt || "").localeCompare(String(a.createdAtIso || a.createdAt || "")));
  }, [activeQuotes, buckets, filterTab]);

  return (
    <Shell>
      <section className="fournitures-dashboard">
        <header className="fournitures-dashboard-head">
          <div>
            <h1><span className="title-chip">Devis</span></h1>
            <p>Créez, envoyez et suivez vos devis jusqu'à la signature.</p>
          </div>
          <div className="fournitures-dashboard-head-actions">
            <Link href="/bibliotheque-ouvrages" className="button secondary">Bibliothèque koji</Link>
            <Link href="/devis?new=1" className="button blue">+ Nouveau devis</Link>
          </div>
        </header>

        <div className="fournitures-kpi-row">
          <div className="fournitures-kpi-card">
            <div className="fournitures-kpi-card-head">
              <span className="fournitures-kpi-icon fournitures-kpi-icon-blue">📄</span>
              <span className="title-chip">Devis envoyés</span>
            </div>
            <strong>{kpis.sentThisMonth}</strong>
            <small>ce mois-ci</small>
          </div>
          <div className="fournitures-kpi-card">
            <div className="fournitures-kpi-card-head">
              <span className="fournitures-kpi-icon fournitures-kpi-icon-amber">⏳</span>
              <span className="title-chip">En attente de réponse</span>
            </div>
            <strong>{kpis.pending}</strong>
            <small className={kpis.toRelancer > 0 ? "warning" : ""}>
              {kpis.toRelancer > 0 ? `dont ${kpis.toRelancer} à relancer` : "aucune à relancer"}
            </small>
          </div>
          <div className="fournitures-kpi-card">
            <div className="fournitures-kpi-card-head">
              <span className="fournitures-kpi-icon fournitures-kpi-icon-green">✅</span>
              <span className="title-chip">Taux d'acceptation</span>
            </div>
            <strong>{kpis.acceptanceRate} %</strong>
            <small>{kpis.decided > 0 ? `sur ${kpis.decided} devis traités` : "aucun devis traité"}</small>
          </div>
          <div className="fournitures-kpi-card">
            <div className="fournitures-kpi-card-head">
              <span className="fournitures-kpi-icon fournitures-kpi-icon-purple">📊</span>
              <span className="title-chip">Montant en attente</span>
            </div>
            <strong>{money(kpis.montantEnAttente)} <small style={{ display: "inline", marginTop: 0 }}>HT</small></strong>
          </div>
        </div>

        <div className="fournitures-dashboard-body">
          <div className="fournitures-main-card">
            <div className="fournitures-main-card-head">
              <strong className="title-chip">Derniers devis</strong>
              <div className="fournitures-filter-tabs">
                {FILTER_TABS.map((tab) => (
                  <button
                    type="button"
                    key={tab.id}
                    className={filterTab === tab.id ? "active" : ""}
                    onClick={() => setFilterTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredQuotes.length === 0 ? (
              <div className="tool-empty">{L.devis.noQuotes}</div>
            ) : (
              <div className="fournitures-table devis-table">
                <div className="fournitures-table-head-row devis-table-row">
                  <div>N°</div>
                  <div>CLIENT ET OBJET</div>
                  <div>MONTANT HT</div>
                  <div>STATUT</div>
                </div>
                {filteredQuotes.map((quote) => (
                  <div className="fournitures-table-row-wrap" key={quote.id}>
                    <Link href={`/devis?id=${quote.id}`} className="fournitures-table-row devis-table-row">
                      <div className="fournitures-table-cell">
                        <strong>{quote.quoteNumber}</strong>
                      </div>
                      <div className="fournitures-table-cell">
                        <strong>{quote.client || "Client"}</strong>
                        <small>{quote.project || ""}</small>
                      </div>
                      <div className="fournitures-table-cell fournitures-table-amount">{money(quote.totalHt)}</div>
                      <div><StatusBadge status={quote.status || "Brouillon"} /></div>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="fournitures-sidebar-card">
              <strong className="title-chip">Pipeline</strong>
              {pipeline.map((row) => (
                <div className="devis-pipeline-row" key={row.key}>
                  <div className="devis-pipeline-row-head">
                    <span>{row.label}</span>
                    <strong>{row.count}</strong>
                  </div>
                  <div className="devis-pipeline-bar"><div style={{ width: `${row.pct}%`, background: row.color }} /></div>
                </div>
              ))}
            </div>

            <div className="fournitures-sidebar-card">
              <strong className="title-chip">À relancer</strong>
              {toRelancer.length === 0 ? (
                <div className="tool-empty">Rien à relancer.</div>
              ) : (
                toRelancer.map((quote) => (
                  <div className="devis-relance-row" key={quote.id}>
                    <span className="devis-relance-avatar">{(quote.client || "?").slice(0, 2).toUpperCase()}</span>
                    <div className="devis-relance-main">
                      <strong>{quote.client || "Client"}</strong>
                      <small>Envoyé il y a {daysSince(quote.sentAt)} jour{daysSince(quote.sentAt) > 1 ? "s" : ""}</small>
                    </div>
                    <Link href={`/devis?id=${quote.id}`} className="mini-button primary">Relancer</Link>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </Shell>
  );
}
