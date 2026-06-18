"use client";

import { useState } from "react";
import { Shell } from "../../components/Shell";
import { apiSend } from "../../lib/client-api";
import { euro, shortDate } from "../../lib/pricing";
import { useApi } from "../../lib/use-api";

function formatDate(value) {
  if (!value) return "-";
  try {
    return shortDate(value);
  } catch {
    return value;
  }
}

export default function ArchivesPage() {
  const { data: projects, setData: setProjects } = useApi("/api/projects", "projects");
  const { data: quotes, setData: setQuotes } = useApi("/api/quotes", "quotes");
  const { data: projectArchives } = useApi("/api/project-archives", "projectArchives");
  const [activeTab, setActiveTab] = useState("projects");
  const [expandedId, setExpandedId] = useState(null);
  const archivedProjects = projects.filter((item) => item.status === "Archive");
  const archivedQuotes = quotes.filter((item) => item.status === "Archive");

  async function restoreProject(project) {
    const { project: restored } = await apiSend("/api/projects", { id: project.id, action: "restore" }, "PATCH");
    setProjects(projects.map((item) => (item.id === restored.id ? restored : item)));
  }

  async function deleteProject(project) {
    const { project: deleted } = await apiSend("/api/projects", { id: project.id, action: "delete" }, "PATCH");
    if (deleted?.deleted) setProjects(projects.filter((item) => item.id !== project.id));
  }

  async function restoreQuote(quote) {
    const { quote: restored } = await apiSend("/api/quotes", { id: quote.id, action: "restore" }, "PATCH");
    setQuotes(quotes.map((item) => (item.id === restored.id ? restored : item)));
  }

  async function deleteQuote(quote) {
    const { quote: deleted } = await apiSend("/api/quotes", { id: quote.id, action: "delete" }, "PATCH");
    if (deleted?.deleted) setQuotes(quotes.filter((item) => item.id !== quote.id));
  }

  return (
    <Shell>
      <section className="mobile-tool">
        <header className="tool-topline">
          <button type="button" className="plain-back" onClick={() => (window.history.length > 1 ? window.history.back() : window.location.assign("/"))}>{"<"}</button>
          <h1>Archives</h1>
          <span />
        </header>

        <div className="segmented">
          <button type="button" className={activeTab === "projects" ? "active" : ""} onClick={() => setActiveTab("projects")}>Chantiers</button>
          <button type="button" className={activeTab === "quotes" ? "active" : ""} onClick={() => setActiveTab("quotes")}>Devis</button>
        </div>

        <div className="archive-list">
          {activeTab === "projects" && archivedProjects.length === 0 ? <div className="tool-empty">Aucun chantier archive.</div> : null}
          {activeTab === "quotes" && archivedQuotes.length === 0 ? <div className="tool-empty">Aucun devis archive.</div> : null}

          {activeTab === "projects" ? archivedProjects.map((project) => {
            const archive = projectArchives.find((a) => a.projectId === project.id);
            const expanded = expandedId === project.id;
            const validatedQuote = archive?.quotes?.find((q) => q.status === "Signe" || q.signatureStatus === "Signe");
            const doneTasks = (archive?.tasks || []).filter((t) => t.done);
            const pastEvents = (archive?.appointments || []).filter((e) => String(e.startAt || "") <= new Date().toISOString());
            return (
              <article className="archive-row-block" key={project.id}>
                <div className="archive-row">
                  <span className="archive-icon">CH</span>
                  <div>
                    <strong>{project.title}</strong>
                    <small>{project.client || project.reference}</small>
                  </div>
                  <div className="archive-row-actions">
                    <button type="button" onClick={() => setExpandedId(expanded ? null : project.id)}>{expanded ? "Masquer" : "Voir le détail"}</button>
                    <button type="button" onClick={() => restoreProject(project)}>Restaurer</button>
                    <button type="button" className="danger" onClick={() => deleteProject(project)}>Supprimer</button>
                  </div>
                </div>
                {expanded ? (
                  <div className="archive-detail">
                    <div className="archive-detail-section">
                      <h3>Devis</h3>
                      {(archive?.quotes || []).length === 0 ? <p className="tool-muted">Aucun devis lié.</p> : (
                        (archive.quotes).map((q) => (
                          <p key={q.id}>{q.quoteNumber} - {euro(q.totalTtc)} - {q.signatureStatus === "Signe" ? "Validé par le client" : (q.status || "Brouillon")}</p>
                        ))
                      )}
                    </div>
                    <div className="archive-detail-section">
                      <h3>Validation des ouvrages</h3>
                      <p className="tool-muted">{validatedQuote ? `Devis ${validatedQuote.quoteNumber} signé et validé par le client.` : "Aucune validation client enregistrée."}</p>
                    </div>
                    <div className="archive-detail-section">
                      <h3>Tâches réalisées</h3>
                      {doneTasks.length === 0 ? <p className="tool-muted">Aucune tâche réalisée.</p> : doneTasks.map((task) => (
                        <p key={task.id}>{task.label} - {formatDate(task.updatedAt || task.createdAt)}</p>
                      ))}
                    </div>
                    <div className="archive-detail-section">
                      <h3>Rendez-vous effectués</h3>
                      {pastEvents.length === 0 ? <p className="tool-muted">Aucun rendez-vous.</p> : pastEvents.map((event) => (
                        <p key={event.id}>{event.title} - {formatDate(event.startAt)}</p>
                      ))}
                    </div>
                    <div className="archive-detail-section">
                      <h3>Dépenses</h3>
                      {(archive?.expenses || []).length === 0 ? <p className="tool-muted">Aucune dépense enregistrée.</p> : (archive.expenses).map((expense) => (
                        <p key={expense.id}>{expense.category}: {expense.label} - {euro(expense.amount)}</p>
                      ))}
                      {archive?.summary ? <p className="archive-detail-total">Total dépenses: {euro(archive.summary.expensesTotal)} - Gain: {euro(archive.summary.gain)}</p> : null}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          }) : null}

          {activeTab === "quotes" ? archivedQuotes.map((quote) => (
            <article className="archive-row" key={quote.id}>
              <span className="archive-icon">DV</span>
              <div>
                <strong>{quote.quoteNumber}</strong>
                <small>{quote.client} - {euro(quote.totalTtc)}</small>
              </div>
              <button type="button" onClick={() => restoreQuote(quote)}>Restaurer</button>
              <button type="button" className="danger" onClick={() => deleteQuote(quote)}>Supprimer</button>
            </article>
          )) : null}
        </div>
      </section>
    </Shell>
  );
}
