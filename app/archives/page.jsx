"use client";

import { useState } from "react";
import { Shell } from "../../components/Shell";
import { apiSend } from "../../lib/client-api";
import { euro } from "../../lib/pricing";
import { useApi } from "../../lib/use-api";

export default function ArchivesPage() {
  const { data: projects, setData: setProjects } = useApi("/api/projects", "projects");
  const { data: quotes, setData: setQuotes } = useApi("/api/quotes", "quotes");
  const [activeTab, setActiveTab] = useState("projects");
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
          <button type="button" className="plain-back" onClick={() => window.history.back()}>{"<"}</button>
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

          {activeTab === "projects" ? archivedProjects.map((project) => (
            <article className="archive-row" key={project.id}>
              <span className="archive-icon">CH</span>
              <div>
                <strong>{project.title}</strong>
                <small>{project.client || project.reference}</small>
              </div>
              <button type="button" onClick={() => restoreProject(project)}>Restaurer</button>
              <button type="button" className="danger" onClick={() => deleteProject(project)}>Supprimer</button>
            </article>
          )) : null}

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
