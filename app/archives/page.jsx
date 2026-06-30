"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shell } from "../../components/Shell";
import { apiSend } from "../../lib/client-api";
import { euro, shortDate } from "../../lib/pricing";
import { useApi } from "../../lib/use-api";

const emptyNewProject = {
  title: "",
  client: "",
  address: "",
  startDate: "",
  endDate: "",
  budgetHt: "",
  notes: ""
};

function formatDate(value) {
  if (!value) return "-";
  try {
    return shortDate(value);
  } catch {
    return value;
  }
}

export default function ArchivesPage() {
  const router = useRouter();
  const { data: projects, setData: setProjects } = useApi("/api/projects", "projects");
  const { data: quotes, setData: setQuotes } = useApi("/api/quotes", "quotes");
  const [activeTab, setActiveTab] = useState("projects");
  const [creating, setCreating] = useState(false);
  const [newProject, setNewProject] = useState(emptyNewProject);

  function hasRealQuote(project) {
    return quotes.some((quote) => quote.projectId === project.id || quote.project === project.title);
  }
  function isManualProject(project) {
    return project.source === "manual-archive" || !hasRealQuote(project);
  }
  const archivedProjects = projects.filter((item) => item.status === "Archive" && !isManualProject(item));
  const otherProjects = projects.filter((item) => item.status === "Archive" && isManualProject(item));
  const archivedQuotes = quotes.filter((item) => item.status === "Archive");

  function setNewProjectField(field, value) {
    setNewProject((current) => ({ ...current, [field]: value }));
  }

  async function createPastProject(event) {
    event.preventDefault();
    if (!newProject.title.trim()) return;
    const { project } = await apiSend("/api/projects", {
      title: newProject.title,
      client: newProject.client,
      address: newProject.address,
      startDate: newProject.startDate,
      endDate: newProject.endDate,
      dueDate: newProject.endDate || newProject.startDate,
      budgetHt: newProject.budgetHt,
      notes: newProject.notes,
      source: "manual-archive",
      status: "Devis a preparer"
    });
    const { project: archived } = await apiSend("/api/projects", { id: project.id, action: "archive" }, "PATCH");
    setProjects([archived, ...projects]);
    setNewProject(emptyNewProject);
    setCreating(false);
    setActiveTab("other");
    router.push(`/archives/${archived.id}`);
  }

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
          <button
            type="button"
            className="round-dark"
            onClick={() => {
              setCreating((current) => !current);
              setActiveTab("other");
            }}
            title="Ajouter un ancien chantier"
          >
            +
          </button>
        </header>

        {creating ? (
          <form className="archive-create-form" onSubmit={createPastProject}>
            <h3>Ancien chantier deja termine</h3>
            <p className="tool-muted">Digitalisez un chantier passe pour la comptabilite : devis, photos, factures, recus et notes.</p>
            <label className="mobile-input full">
              <span>Nom du chantier</span>
              <input value={newProject.title} onChange={(event) => setNewProjectField("title", event.target.value)} placeholder="Ex: Renovation appartement Dupont" required />
            </label>
            <label className="mobile-input full">
              <span>Client</span>
              <input value={newProject.client} onChange={(event) => setNewProjectField("client", event.target.value)} placeholder="Nom du client" />
            </label>
            <label className="mobile-input full">
              <span>Adresse</span>
              <input value={newProject.address} onChange={(event) => setNewProjectField("address", event.target.value)} placeholder="Adresse du chantier" />
            </label>
            <div className="mobile-form-grid">
              <label className="mobile-input">
                <span>Date de debut</span>
                <input type="date" value={newProject.startDate} onChange={(event) => setNewProjectField("startDate", event.target.value)} />
              </label>
              <label className="mobile-input">
                <span>Date de fin</span>
                <input type="date" value={newProject.endDate} onChange={(event) => setNewProjectField("endDate", event.target.value)} />
              </label>
            </div>
            <label className="mobile-input full">
              <span>Montant total TTC</span>
              <input type="number" step="0.01" value={newProject.budgetHt} onChange={(event) => setNewProjectField("budgetHt", event.target.value)} placeholder="0.00" />
            </label>
            <label className="mobile-input full">
              <span>Notes</span>
              <input value={newProject.notes} onChange={(event) => setNewProjectField("notes", event.target.value)} placeholder="Remarques, contexte du chantier..." />
            </label>
            <div className="archive-create-actions">
              <button type="button" className="mini-button" onClick={() => { setCreating(false); setNewProject(emptyNewProject); }}>Annuler</button>
              <button type="submit" className="mobile-primary">Creer le chantier archive</button>
            </div>
          </form>
        ) : null}

        <div className="segmented">
          <button type="button" className={activeTab === "projects" ? "active" : ""} onClick={() => setActiveTab("projects")}>Chantiers</button>
          <button type="button" className={activeTab === "quotes" ? "active" : ""} onClick={() => setActiveTab("quotes")}>Devis</button>
          <button type="button" className={activeTab === "other" ? "active" : ""} onClick={() => setActiveTab("other")}>Autre</button>
        </div>

        <div className="archive-list">
          {activeTab === "projects" && archivedProjects.length === 0 ? <div className="tool-empty">Aucun chantier archive.</div> : null}
          {activeTab === "quotes" && archivedQuotes.length === 0 ? <div className="tool-empty">Aucun devis archive.</div> : null}
          {activeTab === "other" && otherProjects.length === 0 ? <div className="tool-empty">Aucun ancien chantier ajoute. Utilisez le bouton + pour en digitaliser un.</div> : null}

          {(activeTab === "projects" ? archivedProjects : activeTab === "other" ? otherProjects : []).map((project) => (
            <article className="archive-row" key={project.id}>
              <span className="archive-icon">CH</span>
              <div>
                <strong>{project.title}</strong>
                <small>{project.client || project.reference}</small>
                <small className="archive-row-dates">
                  Ref {project.reference || "-"} · Debut {formatDate(project.startDate)} · Fin {formatDate(project.endDate)}
                </small>
              </div>
              <div className="archive-row-actions">
                <button type="button" onClick={() => router.push(`/archives/${project.id}`)}>Voir le détail</button>
                <button type="button" onClick={() => restoreProject(project)}>Restaurer</button>
                <button type="button" className="danger" onClick={() => deleteProject(project)}>Supprimer</button>
              </div>
            </article>
          ))}

          {activeTab === "quotes" ? archivedQuotes.map((quote) => (
            <article className="archive-row" key={quote.id}>
              <span className="archive-icon">DV</span>
              <div>
                <strong>{quote.quoteNumber}</strong>
                <small>{quote.client} - {euro(quote.totalTtc)}</small>
              </div>
              <a className="mini-button" href={`/api/quotes/${quote.id}/documents?type=quote&format=pdf`} target="_blank" rel="noreferrer">Télécharger</a>
              <button type="button" onClick={() => restoreQuote(quote)}>Restaurer</button>
              <button type="button" className="danger" onClick={() => deleteQuote(quote)}>Supprimer</button>
            </article>
          )) : null}
        </div>
      </section>
    </Shell>
  );
}
