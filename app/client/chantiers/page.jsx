"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ClientTopbar } from "../../../components/ClientTopbar";
import { euro, shortDate } from "../../../lib/pricing";

function getStoredUser() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("koji-user") || "null"); } catch { return null; }
}

// Tableau de bord "Mes chantiers" cote particulier (16 oct, maquette
// Artifact) — meme principe que la refonte Chantiers cote entreprise (15
// oct, voir app/chantiers/page.jsx) : statut et avancement sont derives a
// la volee depuis les taches (jamais stockes de facon fiable, voir le
// commentaire equivalent cote entreprise), rien d'invente.
const STATUS_META = {
  a_venir: { label: "À venir", color: "#1d4ed8", bg: "#dbeafe" },
  en_cours: { label: "En cours", color: "#b45309", bg: "#fef3c7" },
  termine: { label: "Terminé", color: "#15803d", bg: "#dcfce7" }
};

const FILTER_TABS = [
  { id: "tous", label: "Tous" },
  { id: "en_cours", label: "En cours" },
  { id: "a_venir", label: "À venir" },
  { id: "termine", label: "Terminés" }
];

function computeStatus(progress) {
  if (progress >= 100) return "termine";
  if (progress <= 0) return "a_venir";
  return "en_cours";
}

export default function ClientChantiersPage() {
  const router = useRouter();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState("tous");

  useEffect(() => {
    const user = getStoredUser();
    if (!user?.email) { setLoading(false); return; }
    fetch("/api/client/quotes")
      .then((r) => r.json())
      .then((data) => setQuotes(data.quotes || []))
      .finally(() => setLoading(false));
  }, []);

  const chantiers = useMemo(() => {
    return quotes
      .filter((q) => q.status === "Signe" || q.signatureStatus === "Signe")
      .map((quote) => {
        const tasks = quote.tasks || [];
        const done = tasks.filter((t) => t.done).length;
        const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
        const dueDates = tasks.map((t) => t.endDate || t.dueDate).filter(Boolean).sort();
        const startDates = tasks.map((t) => t.startDate).filter(Boolean).sort();
        return {
          quote,
          progress,
          status: computeStatus(progress),
          dueDate: dueDates.at(-1) || "",
          startDate: startDates[0] || "",
          title: quote.project?.title || quote.projectName || quote.project || "Chantier",
          address: quote.project?.address || ""
        };
      });
  }, [quotes]);

  const kpis = useMemo(() => {
    const enCours = chantiers.filter((c) => c.status === "en_cours");
    const aVenir = chantiers.filter((c) => c.status === "a_venir");
    const termines = chantiers.filter((c) => c.status === "termine");
    const nextStart = aVenir.map((c) => c.startDate).filter(Boolean).sort()[0] || "";
    const budgetTotal = chantiers.reduce((sum, c) => sum + Number(c.quote.totalTtc || 0), 0);
    return { enCours, aVenir, termines, nextStart, budgetTotal };
  }, [chantiers]);

  const filteredChantiers = useMemo(() => {
    if (filterTab === "tous") return chantiers;
    return chantiers.filter((c) => c.status === filterTab);
  }, [chantiers, filterTab]);

  const upcomingSteps = useMemo(() => {
    const now = new Date();
    return chantiers
      .flatMap((c) => (c.quote.tasks || []).map((t) => ({ ...t, chantierTitle: c.title })))
      .filter((t) => !t.done && (t.dueDate || t.startDate))
      .map((t) => ({ ...t, when: t.dueDate || t.startDate }))
      .filter((t) => new Date(t.when) >= now)
      .sort((a, b) => String(a.when).localeCompare(String(b.when)))
      .slice(0, 5);
  }, [chantiers]);

  const recentDocuments = useMemo(() => {
    return [...chantiers]
      .sort((a, b) => String(b.quote.signedAt || b.quote.createdAt || "").localeCompare(String(a.quote.signedAt || a.quote.createdAt || "")))
      .slice(0, 4);
  }, [chantiers]);

  return (
    <main className="client-space">
      <ClientTopbar showBack backHref="/client" />

      <section className="fournitures-dashboard">
        <header className="fournitures-dashboard-head">
          <div>
            <h1><span className="title-chip">Mes chantiers</span></h1>
            <p>Suivez l'avancement de vos travaux, étape par étape.</p>
          </div>
          <div className="fournitures-dashboard-head-actions">
            <Link href="/client/radar/new" className="button blue">+ Publier un chantier</Link>
          </div>
        </header>

        {loading ? <div className="client-empty">Chargement…</div> : null}

        {!loading ? (
          <>
            <div className="fournitures-kpi-row">
              <div className="fournitures-kpi-card">
                <div className="fournitures-kpi-card-head">
                  <span className="fournitures-kpi-icon fournitures-kpi-icon-amber">🏗️</span>
                  <span className="title-chip">En cours</span>
                </div>
                <strong>{kpis.enCours.length}</strong>
                <small>sur {chantiers.length} chantier{chantiers.length > 1 ? "s" : ""}</small>
              </div>
              <div className="fournitures-kpi-card">
                <div className="fournitures-kpi-card-head">
                  <span className="fournitures-kpi-icon fournitures-kpi-icon-blue">📅</span>
                  <span className="title-chip">À venir</span>
                </div>
                <strong>{kpis.aVenir.length}</strong>
                <small>{kpis.nextStart ? `début le ${shortDate(kpis.nextStart)}` : "aucun pour l'instant"}</small>
              </div>
              <div className="fournitures-kpi-card">
                <div className="fournitures-kpi-card-head">
                  <span className="fournitures-kpi-icon fournitures-kpi-icon-green">✅</span>
                  <span className="title-chip">Terminés</span>
                </div>
                <strong>{kpis.termines.length}</strong>
                <small>cette année</small>
              </div>
              <div className="fournitures-kpi-card">
                <div className="fournitures-kpi-card-head">
                  <span className="fournitures-kpi-icon fournitures-kpi-icon-purple">💶</span>
                  <span className="title-chip">Budget total</span>
                </div>
                <strong>{euro(kpis.budgetTotal)}</strong>
                <small>TTC tous chantiers</small>
              </div>
            </div>

            <div className="fournitures-dashboard-body">
              <div className="fournitures-main-card">
                <div className="fournitures-main-card-head">
                  <strong className="title-chip">Chantiers</strong>
                  <div className="fournitures-filter-tabs">
                    {FILTER_TABS.map((tab) => (
                      <button type="button" key={tab.id} className={filterTab === tab.id ? "active" : ""} onClick={() => setFilterTab(tab.id)}>
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredChantiers.length === 0 ? (
                  <div className="tool-empty">Aucun chantier signé pour l'instant.</div>
                ) : (
                  <div className="fournitures-table chantiers-table">
                    {filteredChantiers.map((c) => {
                      const meta = STATUS_META[c.status];
                      return (
                        <div className="fournitures-table-row-wrap" key={c.quote.id}>
                          <button type="button" className="fournitures-table-row chantiers-table-row" onClick={() => router.push(`/client/chantier/${c.quote.id}`)}>
                            <div className="fournitures-table-cell">
                              <strong>{c.title}</strong>
                              <small>{c.address || `Devis ${c.quote.quoteNumber}`} · {euro(c.quote.totalTtc || 0)} TTC</small>
                            </div>
                            <div className="chantiers-progress-cell">
                              <div className="ct-progress-bar"><div style={{ width: `${c.progress}%` }} /></div>
                              <small>{c.progress}%</small>
                            </div>
                            <div>
                              <span className="status-pill" style={{ color: meta.color, background: meta.bg }}>{meta.label}</span>
                            </div>
                            <div className="fournitures-table-cell">
                              {c.startDate ? shortDate(c.startDate) : "—"} → {c.dueDate ? shortDate(c.dueDate) : "—"}
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <div className="fournitures-sidebar-card">
                  <strong className="title-chip">Prochaines étapes</strong>
                  {upcomingSteps.length === 0 ? (
                    <div className="tool-empty">Rien de prévu pour l'instant.</div>
                  ) : (
                    upcomingSteps.map((step) => (
                      <div className="chantiers-week-row" key={step.id}>
                        <span className="chantiers-week-badge">
                          <small>{new Date(step.when).toLocaleDateString("fr-FR", { month: "short" }).toUpperCase().replace(".", "")}</small>
                          <strong>{new Date(step.when).getDate()}</strong>
                        </span>
                        <span className="chantiers-week-main">
                          <strong>{step.label}</strong>
                          <small>{step.chantierTitle}</small>
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className="fournitures-sidebar-card">
                  <strong className="title-chip">Documents récents</strong>
                  {recentDocuments.length === 0 ? (
                    <div className="tool-empty">Aucun document pour l'instant.</div>
                  ) : (
                    recentDocuments.map((c) => (
                      <a key={c.quote.id} className="chantiers-week-row" href={`/api/client/quotes/${c.quote.id}/pdf`} target="_blank" rel="noreferrer">
                        <span className="chantiers-week-badge"><small>PDF</small></span>
                        <span className="chantiers-week-main">
                          <strong>Devis {c.quote.quoteNumber}</strong>
                          <small>{c.title}</small>
                        </span>
                      </a>
                    ))
                  )}
                </div>

                <div className="aide-support-card">
                  <strong>UN NOUVEAU PROJET ?</strong>
                  <p>Décrivez-le à l'assistant koji, il prépare votre demande.</p>
                  <Link href="/client/radar/new" className="button white">Publier un chantier</Link>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
