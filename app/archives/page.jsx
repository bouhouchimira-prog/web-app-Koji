"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shell } from "../../components/Shell";
import { apiSend } from "../../lib/client-api";
import { useLocale } from "../../lib/i18n";
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
  const { L } = useLocale();
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

  // Tableau de bord (15 oct) — valeur archivee = devis archives + anciens
  // chantiers ajoutes manuellement (les seuls a porter un budget ici).
  const archivedValue = archivedQuotes.reduce((sum, q) => sum + Number(q.totalTtc || 0), 0)
    + otherProjects.reduce((sum, p) => sum + Number(p.budgetHt || 0), 0);

  const listRows = activeTab === "projects" ? archivedProjects : activeTab === "other" ? otherProjects : [];
  const emptyText = activeTab === "quotes" ? L.archives.noQuotes : L.archives.noProjects;
  const listEmpty = activeTab === "quotes" ? archivedQuotes.length === 0 : listRows.length === 0;

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow">Gestion</span>
          <h1>{L.archives.title}</h1>
          <span className="muted">Vos chantiers et devis archivés, consultables et restaurables à tout moment.</span>
        </div>
        <div className="hact">
          <button type="button" className="btn btn-main" onClick={() => { setCreating((current) => !current); setActiveTab("other"); }}>
            + Ancien chantier
          </button>
        </div>
      </div>

      <div className="kpis">
        <button type="button" className={activeTab === "projects" ? "on" : ""} onClick={() => setActiveTab("projects")}>
          <div className="l">Chantiers archivés</div><div className="v">{archivedProjects.length}</div><div className="s">terminés</div>
        </button>
        <button type="button" className={activeTab === "quotes" ? "on" : ""} onClick={() => setActiveTab("quotes")}>
          <div className="l">Devis archivés</div><div className="v">{archivedQuotes.length}</div><div className="s">classés</div>
        </button>
        <button type="button" className={activeTab === "other" ? "on" : ""} onClick={() => setActiveTab("other")}>
          <div className="l">Anciens chantiers</div><div className="v">{otherProjects.length}</div><div className="s">ajoutés manuellement</div>
        </button>
        <div>
          <div className="l">Valeur archivée</div><div className="v">{euro(archivedValue)}</div><div className="s">devis + anciens chantiers</div>
        </div>
      </div>

      <div className="kp-seg" role="group" aria-label="Type d'archive" style={{ marginBottom: 16 }}>
        <button type="button" className={activeTab === "projects" ? "on" : ""} aria-pressed={activeTab === "projects"} onClick={() => setActiveTab("projects")}>{L.nav.projects}</button>
        <button type="button" className={activeTab === "quotes" ? "on" : ""} aria-pressed={activeTab === "quotes"} onClick={() => setActiveTab("quotes")}>{L.nav.quotes}</button>
        <button type="button" className={activeTab === "other" ? "on" : ""} aria-pressed={activeTab === "other"} onClick={() => setActiveTab("other")}>{L.archives.manual}</button>
      </div>

      {listEmpty ? (
        <div className="tbl"><p className="empty">{emptyText}</p></div>
      ) : activeTab === "quotes" ? (
        <>
          <div className="tbl fit has-cards">
            <table>
              <thead><tr><th>Devis</th><th>Client</th><th>Montant TTC</th><th /></tr></thead>
              <tbody>
                {archivedQuotes.map((quote) => (
                  <tr key={quote.id}>
                    <td><strong>{quote.quoteNumber}</strong></td>
                    <td>{quote.client || "—"}</td>
                    <td>{euro(quote.totalTtc)}</td>
                    <td>
                      <div className="ed-act">
                        <a className="link" href={`/api/quotes/${quote.id}/documents?type=quote&format=pdf`} target="_blank" rel="noreferrer">{L.common.download}</a>
                        <button type="button" className="btn btn-sec" onClick={() => restoreQuote(quote)}>{L.archives.restore}</button>
                        <button type="button" className="link" onClick={() => deleteQuote(quote)}>{L.archives.delete}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mlist">
            {archivedQuotes.map((quote) => (
              <div className="m-card" key={quote.id}>
                <div className="top2">
                  <div><div className="nm">{quote.quoteNumber}</div><div className="meta">{quote.client || "—"}</div></div>
                  <b>{euro(quote.totalTtc)}</b>
                </div>
                <div className="ed-act">
                  <a className="link" href={`/api/quotes/${quote.id}/documents?type=quote&format=pdf`} target="_blank" rel="noreferrer">{L.common.download}</a>
                  <button type="button" className="btn btn-sec" onClick={() => restoreQuote(quote)}>{L.archives.restore}</button>
                  <button type="button" className="link" onClick={() => deleteQuote(quote)}>{L.archives.delete}</button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="tbl fit has-cards">
            <table>
              <thead><tr><th>Chantier</th><th>Référence</th><th>Dates</th><th /></tr></thead>
              <tbody>
                {listRows.map((project) => (
                  <tr key={project.id}>
                    <td><strong>{project.title}</strong><small className="muted" style={{ display: "block" }}>{project.client || ""}</small></td>
                    <td>{project.reference || "—"}</td>
                    <td>{formatDate(project.startDate)} → {formatDate(project.endDate)}</td>
                    <td>
                      <div className="ed-act">
                        <button type="button" className="link" onClick={() => router.push(`/archives/${project.id}`)}>{L.archives.view}</button>
                        <button type="button" className="btn btn-sec" onClick={() => restoreProject(project)}>{L.archives.restore}</button>
                        <button type="button" className="link" onClick={() => deleteProject(project)}>{L.archives.delete}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mlist">
            {listRows.map((project) => (
              <div className="m-card" key={project.id}>
                <div className="top2">
                  <div><div className="nm">{project.title}</div><div className="meta">{project.client || project.reference || "—"}</div></div>
                </div>
                <div className="line">{formatDate(project.startDate)} → {formatDate(project.endDate)}</div>
                <div className="ed-act">
                  <button type="button" className="link" onClick={() => router.push(`/archives/${project.id}`)}>{L.archives.view}</button>
                  <button type="button" className="btn btn-sec" onClick={() => restoreProject(project)}>{L.archives.restore}</button>
                  <button type="button" className="link" onClick={() => deleteProject(project)}>{L.archives.delete}</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {creating ? (
        <div className="pmodal-bg" onClick={() => { setCreating(false); setNewProject(emptyNewProject); }}>
          <form className="pmodal" role="dialog" aria-modal="true" aria-label={L.archives.createProject} onClick={(event) => event.stopPropagation()} onSubmit={createPastProject}>
            <div className="card-h">
              <h2>{L.archives.createProject}</h2>
              <button type="button" className="link" onClick={() => { setCreating(false); setNewProject(emptyNewProject); }}>Fermer</button>
            </div>
            <div className="fgrid">
              <label className="full">{L.archives.projectTitle}<input value={newProject.title} onChange={(event) => setNewProjectField("title", event.target.value)} required /></label>
              <label className="full">{L.archives.client}<input value={newProject.client} onChange={(event) => setNewProjectField("client", event.target.value)} /></label>
              <label className="full">{L.archives.address}<input value={newProject.address} onChange={(event) => setNewProjectField("address", event.target.value)} /></label>
              <label>{L.archives.startDate}<input type="date" value={newProject.startDate} onChange={(event) => setNewProjectField("startDate", event.target.value)} /></label>
              <label>{L.archives.endDate}<input type="date" value={newProject.endDate} onChange={(event) => setNewProjectField("endDate", event.target.value)} /></label>
              <label className="full">{L.archives.budget}<input type="number" step="0.01" value={newProject.budgetHt} onChange={(event) => setNewProjectField("budgetHt", event.target.value)} placeholder="0.00" /></label>
              <label className="full">{L.archives.notes}<input value={newProject.notes} onChange={(event) => setNewProjectField("notes", event.target.value)} /></label>
            </div>
            <div className="pm-act">
              <button type="button" className="btn btn-sec" onClick={() => { setCreating(false); setNewProject(emptyNewProject); }}>{L.archives.cancel}</button>
              <button type="submit" className="btn btn-main">{L.archives.save}</button>
            </div>
          </form>
        </div>
      ) : null}
    </Shell>
  );
}
