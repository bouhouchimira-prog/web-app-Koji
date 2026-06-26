"use client";

import Link from "next/link";
import { useState } from "react";
import { Shell } from "../components/Shell";
import { apiSend } from "../lib/client-api";
import { euro, shortDate } from "../lib/pricing";
import { useApi } from "../lib/use-api";

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function IconTask() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="6" height="6" rx="1" /><path d="M3 17h6M13 6h8M13 12h8M13 18h5" />
    </svg>
  );
}

function IconProject() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function IconQuote() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function IconArchive() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}

function StatusBadge({ status }) {
  const map = {
    "En cours": { bg: "#e0f2fe", color: "#0369a1" },
    "Devis genere": { bg: "#fef9c3", color: "#854d0e" },
    "En attente signature": { bg: "#fce7f3", color: "#9d174d" },
    "Signe": { bg: "#dcfce7", color: "#166534" },
    "Archive": { bg: "#f1f5f9", color: "#64748b" },
    "Brouillon": { bg: "#f1f5f9", color: "#475569" },
    "Pret a envoyer": { bg: "#fef3c7", color: "#92400e" },
    "Envoye": { bg: "#dbeafe", color: "#1d4ed8" },
  };
  const style = map[status] || { bg: "#f1f5f9", color: "#64748b" };
  return (
    <span className="home-status-badge" style={{ background: style.bg, color: style.color }}>
      {status}
    </span>
  );
}

function Section({ title, href, children, count }) {
  return (
    <section className="home-section">
      <div className="home-section-head">
        {href ? (
          <Link href={href} className="home-section-title-link">
            <h2>{title}</h2>
            {count != null ? <span className="home-section-count">{count}</span> : null}
            <ChevronRight />
          </Link>
        ) : (
          <div className="home-section-title-link">
            <h2>{title}</h2>
          </div>
        )}
      </div>
      <div className="home-section-card">{children}</div>
    </section>
  );
}

export default function HomePage() {
  const { data: projects, setData: setProjects } = useApi("/api/projects", "projects");
  const { data: quotes, setData: setQuotes } = useApi("/api/quotes", "quotes");
  const { data: invoices } = useApi("/api/invoices", "invoices");
  const { data: tasks, setData: setTasks } = useApi("/api/tasks", "tasks");

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmDeleteQuote, setConfirmDeleteQuote] = useState(null);
  const [confirmDeleteProject, setConfirmDeleteProject] = useState(null);

  const activeProjects = projects.filter((p) => p.status !== "Archive");
  const today = new Date().toISOString().slice(0, 10);
  const todoTasks = tasks.filter((task) => {
    const taskDate = String(task.dueDate || task.startDate || "").slice(0, 10);
    return !task.done && taskDate === today;
  });
  const quotesInProgress = quotes.filter((q) => ["Brouillon", "Pret a envoyer", "Envoye"].includes(q.status));
  const signedRevenue = quotes.filter((q) => q.status === "Signe" || q.signatureStatus === "Signe").reduce((s, q) => s + Number(q.totalTtc || 0), 0);
  const billedRevenue = invoices.filter((i) => i.status !== "Annulee").reduce((s, i) => s + Number(i.amountTtc || 0), 0);
  const waitingRevenue = Math.max(0, signedRevenue - billedRevenue);

  async function markTaskDone(task) {
    try {
      const { task: updated } = await apiSend("/api/tasks", { id: task.id, action: "toggle" }, "PATCH");
      setTasks((prev) => prev.map((t) => t.id === updated.id ? updated : t));
    } catch { /**/ }
  }

  async function deleteTask(taskId) {
    try {
      await apiSend("/api/tasks", { id: taskId, action: "delete" }, "PATCH");
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch { /**/ }
    setConfirmDelete(null);
  }

  async function archiveQuote(quoteId) {
    try {
      const { quote } = await apiSend("/api/quotes", { id: quoteId, action: "archive" }, "PATCH");
      setQuotes((prev) => prev.map((q) => q.id === quote.id ? quote : q));
    } catch { /**/ }
  }

  async function deleteQuote(quoteId) {
    try {
      await apiSend("/api/quotes", { id: quoteId, action: "delete" }, "PATCH");
      setQuotes((prev) => prev.filter((q) => q.id !== quoteId));
    } catch { /**/ }
    setConfirmDeleteQuote(null);
  }

  async function archiveProject(projectId) {
    try {
      const { project } = await apiSend("/api/projects", { id: projectId, action: "archive" }, "PATCH");
      setProjects((prev) => prev.map((p) => p.id === project.id ? project : p));
    } catch { /**/ }
  }

  async function deleteProject(projectId) {
    try {
      await apiSend("/api/projects", { id: projectId, action: "delete" }, "PATCH");
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch { /**/ }
    setConfirmDeleteProject(null);
  }

  return (
    <Shell>
      <div className="home-feed">

        <Link className="home-primary-action" href="/chantier/new">
          <span className="home-primary-plus">+</span>
          {activeProjects.length === 0 ? "Créer votre premier chantier" : "Créer un nouveau chantier"}
        </Link>

        {/* À faire maintenant */}
        <Section title="À faire maintenant" href="/planning" count={todoTasks.length || null}>
          {todoTasks.length === 0 ? (
            <div className="home-empty">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#c5b8a7" strokeWidth="1.5"><polyline points="20 6 9 17 4 12" /></svg>
              <strong>Tout est à jour !</strong>
              <span>Aucune tâche prévue pour aujourd'hui.</span>
            </div>
          ) : (
            <div className="home-list">
              {todoTasks.map((task) => (
                <article className="home-list-item home-task-item" key={task.id}>
                  <div className="home-list-icon home-icon-task">
                    <IconTask />
                  </div>
                  <div className="home-list-main">
                    <strong>{task.label}</strong>
                    <small>
                      {[task.project, task.assignedTo, task.dueDate ? shortDate(task.dueDate) : null].filter(Boolean).join(" · ")}
                    </small>
                  </div>
                  <div className="home-task-actions">
                    <button
                      className="home-task-btn home-task-btn-done"
                      title="Marquer comme fait"
                      onClick={() => markTaskDone(task)}
                    >
                      <IconCheck />
                    </button>
                    {confirmDelete === task.id ? (
                      <span className="home-task-confirm">
                        <button className="home-task-btn home-task-btn-danger" onClick={() => deleteTask(task.id)}>Suppr.</button>
                        <button className="home-task-btn" onClick={() => setConfirmDelete(null)}>Non</button>
                      </span>
                    ) : (
                      <button
                        className="home-task-btn home-task-btn-delete"
                        title="Supprimer"
                        onClick={() => setConfirmDelete(task.id)}
                      >
                        <IconTrash />
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </Section>

        {/* Chantiers */}
        <Section title="Chantiers" href="/chantiers" count={activeProjects.length || null}>
          {activeProjects.length === 0 ? (
            <div className="home-empty">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#c5b8a7" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
              <strong>Aucun chantier</strong>
              <span>Commencez par créer votre premier chantier.</span>
            </div>
          ) : (
            <div className="home-list">
              {activeProjects.slice(0, 5).map((project) => (
                <article className="home-list-item home-quote-item" key={project.id}>
                  <Link href="/chantiers" className="home-list-link home-quote-link">
                    <div className="home-list-icon home-icon-project">
                      <IconProject />
                    </div>
                    <div className="home-list-main">
                      <strong>{project.title}</strong>
                      <small>{[project.client, project.startDate ? shortDate(project.startDate) : null].filter(Boolean).join(" · ")}</small>
                    </div>
                    <StatusBadge status={project.status} />
                  </Link>
                  <div className="home-task-actions">
                    {confirmDeleteProject === project.id ? (
                      <span className="home-task-confirm">
                        <button className="home-task-btn home-task-btn-danger" onClick={() => deleteProject(project.id)}>Suppr.</button>
                        <button className="home-task-btn" onClick={() => setConfirmDeleteProject(null)}>Non</button>
                      </span>
                    ) : (
                      <>
                        <button
                          className="home-task-btn"
                          title="Archiver"
                          onClick={() => archiveProject(project.id)}
                        >
                          <IconArchive />
                        </button>
                        <button
                          className="home-task-btn home-task-btn-delete"
                          title="Supprimer"
                          onClick={() => setConfirmDeleteProject(project.id)}
                        >
                          <IconTrash />
                        </button>
                      </>
                    )}
                  </div>
                </article>
              ))}
              {activeProjects.length > 5 ? (
                <Link href="/chantiers" className="home-more-link">
                  Voir les {activeProjects.length - 5} autres chantiers <ChevronRight />
                </Link>
              ) : null}
            </div>
          )}
        </Section>

        {/* Devis en cours */}
        <Section title="Devis en cours" href="/devis" count={quotesInProgress.length || null}>
          {quotesInProgress.length === 0 ? (
            <div className="home-empty">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#c5b8a7" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
              <strong>Aucun devis en cours</strong>
              <span>Les devis apparaîtront ici.</span>
            </div>
          ) : (
            <div className="home-list">
              {quotesInProgress.slice(0, 5).map((quote) => (
                <article className="home-list-item home-quote-item" key={quote.id}>
                  <Link href={`/devis?id=${quote.id}`} className="home-list-link home-quote-link">
                    <div className="home-list-icon home-icon-quote">
                      <IconQuote />
                    </div>
                    <div className="home-list-main">
                      <strong>{quote.client}</strong>
                      <small>{[quote.quoteNumber, quote.project].filter(Boolean).join(" · ")}</small>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <StatusBadge status={quote.status} />
                      <div style={{ fontSize: "0.78rem", color: "#7e715f", fontWeight: 700, marginTop: 3 }}>{euro(quote.totalTtc)}</div>
                    </div>
                  </Link>
                  <div className="home-task-actions">
                    {confirmDeleteQuote === quote.id ? (
                      <span className="home-task-confirm">
                        <button className="home-task-btn home-task-btn-danger" onClick={() => deleteQuote(quote.id)}>Suppr.</button>
                        <button className="home-task-btn" onClick={() => setConfirmDeleteQuote(null)}>Non</button>
                      </span>
                    ) : (
                      <>
                        <button
                          className="home-task-btn"
                          title="Archiver"
                          onClick={() => archiveQuote(quote.id)}
                        >
                          <IconArchive />
                        </button>
                        <button
                          className="home-task-btn home-task-btn-delete"
                          title="Supprimer"
                          onClick={() => setConfirmDeleteQuote(quote.id)}
                        >
                          <IconTrash />
                        </button>
                      </>
                    )}
                  </div>
                </article>
              ))}
              {quotesInProgress.length > 5 ? (
                <Link href="/devis" className="home-more-link">
                  Voir les {quotesInProgress.length - 5} autres devis <ChevronRight />
                </Link>
              ) : null}
            </div>
          )}
        </Section>

        {/* Chiffre d'affaires */}
        <Section title="Chiffre d'affaires">
          <div className="home-revenue-grid">
            <div className="home-revenue-card home-revenue-billed">
              <span>Facturé</span>
              <strong>{euro(billedRevenue)}</strong>
            </div>
            <div className="home-revenue-card home-revenue-waiting">
              <span>En attente de signature</span>
              <strong>{euro(waitingRevenue)}</strong>
            </div>
          </div>
        </Section>

      </div>
    </Shell>
  );
}
