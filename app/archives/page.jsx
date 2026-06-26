"use client";

import { useState } from "react";
import { Shell } from "../../components/Shell";
import { apiSend } from "../../lib/client-api";
import { euro, shortDate } from "../../lib/pricing";
import { useApi } from "../../lib/use-api";

const DOCUMENT_TYPES = ["Devis", "Photo", "Facture", "Reçu", "Note"];

const emptyNewProject = {
  title: "",
  client: "",
  address: "",
  startDate: "",
  endDate: "",
  budgetHt: "",
  notes: ""
};

const emptyDocForm = { type: "Devis", title: "", amount: "", notes: "", fileName: "", url: "" };

function formatDate(value) {
  if (!value) return "-";
  try {
    return shortDate(value);
  } catch {
    return value;
  }
}

function formatDateTime(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return value;
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ArchivesPage() {
  const { data: projects, setData: setProjects } = useApi("/api/projects", "projects");
  const { data: quotes, setData: setQuotes } = useApi("/api/quotes", "quotes");
  const { data: projectArchives } = useApi("/api/project-archives", "projectArchives");
  const { data: projectDocuments, setData: setProjectDocuments } = useApi("/api/project-documents", "projectDocuments");
  const { data: projectMessages } = useApi("/api/project-messages", "messages");
  const [activeTab, setActiveTab] = useState("projects");
  const [expandedId, setExpandedId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newProject, setNewProject] = useState(emptyNewProject);
  const [docForms, setDocForms] = useState({});
  const archivedProjects = projects.filter((item) => item.status === "Archive" && item.source !== "manual-archive");
  const otherProjects = projects.filter((item) => item.status === "Archive" && item.source === "manual-archive");
  const archivedQuotes = quotes.filter((item) => item.status === "Archive");

  function setNewProjectField(field, value) {
    setNewProject((current) => ({ ...current, [field]: value }));
  }

  function docFormFor(projectId) {
    return docForms[projectId] || emptyDocForm;
  }

  function setDocField(projectId, field, value) {
    setDocForms((current) => ({ ...current, [projectId]: { ...docFormFor(projectId), [field]: value } }));
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
    setExpandedId(archived.id);
  }

  async function onDocFile(projectId, event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = await fileToDataUrl(file);
    setDocForms((current) => ({
      ...current,
      [projectId]: { ...docFormFor(projectId), url, fileName: file.name, title: docFormFor(projectId).title || file.name }
    }));
  }

  async function addArchiveDocument(project, event) {
    event.preventDefault();
    const form = docFormFor(project.id);
    if (!form.title.trim() && !form.url) return;
    const { projectDocument } = await apiSend("/api/project-documents", {
      projectId: project.id,
      type: form.type,
      title: form.title || form.fileName || form.type,
      fileName: form.fileName,
      url: form.url,
      amount: form.amount,
      notes: form.notes
    });
    setProjectDocuments([projectDocument, ...projectDocuments]);
    setDocForms((current) => ({ ...current, [project.id]: emptyDocForm }));
  }

  async function deleteArchiveDocument(document) {
    await apiSend("/api/project-documents", { id: document.id, action: "delete" }, "PATCH");
    setProjectDocuments(projectDocuments.filter((item) => item.id !== document.id));
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

          {(activeTab === "projects" ? archivedProjects : activeTab === "other" ? otherProjects : []).map((project) => {
            const archive = projectArchives.find((a) => a.projectId === project.id);
            const expanded = expandedId === project.id;
            const validatedQuote = archive?.quotes?.find((q) => q.status === "Signe" || q.signatureStatus === "Signe");
            const planningTasks = [...(archive?.tasks || [])].sort((a, b) => String(a.startDate || a.dueDate || "").localeCompare(String(b.startDate || b.dueDate || "")));
            const pastEvents = (archive?.appointments || []).filter((e) => String(e.startAt || "") <= new Date().toISOString());
            const documents = projectDocuments.filter((document) => document.projectId === project.id);
            const messages = projectMessages.filter((message) => message.projectId === project.id);
            const docForm = docFormFor(project.id);
            return (
              <article className="archive-row-block" key={project.id}>
                <div className="archive-row">
                  <span className="archive-icon">CH</span>
                  <div>
                    <strong>{project.title}</strong>
                    <small>{project.client || project.reference}</small>
                    <small className="archive-row-dates">
                      Ref {project.reference || "-"} · Debut {formatDate(project.startDate)} · Fin {formatDate(project.endDate)}
                    </small>
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
                          <p key={q.id}>
                            {q.quoteNumber} - {euro(q.totalTtc)} - {q.signatureStatus === "Signe" ? "Validé par le client" : (q.status || "Brouillon")}
                            {" "}<a href={`/api/quotes/${q.id}/documents?type=quote&format=pdf`} target="_blank" rel="noreferrer">Télécharger</a>
                          </p>
                        ))
                      )}
                    </div>
                    <div className="archive-detail-section">
                      <h3>Validation des ouvrages</h3>
                      <p className="tool-muted">{validatedQuote ? `Devis ${validatedQuote.quoteNumber} signé et validé par le client.` : "Aucune validation client enregistrée."}</p>
                    </div>
                    <div className="archive-detail-section">
                      <h3>Planning des tâches</h3>
                      {planningTasks.length === 0 ? <p className="tool-muted">Aucune tâche enregistrée.</p> : planningTasks.map((task) => (
                        <p key={task.id} className="archive-document-row">
                          <span className={`archive-document-type${task.done ? " done" : ""}`}>{task.done ? "Fait" : "Prevu"}</span>
                          <span>{task.label} - {task.room || "Piece"} - {formatDate(task.startDate || task.dueDate)}{task.endDate && task.endDate !== task.startDate ? ` au ${formatDate(task.endDate)}` : ""} - {task.assignedTo || "Equipe"}</span>
                        </p>
                      ))}
                    </div>
                    <div className="archive-detail-section">
                      <h3>Rendez-vous effectués</h3>
                      {pastEvents.length === 0 ? <p className="tool-muted">Aucun rendez-vous.</p> : pastEvents.map((event) => (
                        <p key={event.id}>{event.title} - {formatDate(event.startAt)}</p>
                      ))}
                    </div>
                    <div className="archive-detail-section">
                      <h3>Conversations avec le client</h3>
                      {messages.length === 0 ? <p className="tool-muted">Aucun email ou SMS envoye pour ce chantier.</p> : messages.map((message) => (
                        <p key={message.id} className="archive-document-row">
                          <span className="archive-document-type">{message.channel === "email" ? "Email" : "SMS"}</span>
                          <span>{formatDateTime(message.createdAt)} - {message.to} - {message.subject || message.text}</span>
                        </p>
                      ))}
                    </div>
                    <div className="archive-detail-section">
                      <h3>Notes</h3>
                      {project.notes ? <p>{project.notes}</p> : null}
                      {documents.filter((document) => document.type === "Note").length === 0 && !project.notes ? <p className="tool-muted">Aucune note enregistrée.</p> : null}
                      {documents.filter((document) => document.type === "Note").map((document) => (
                        <p key={document.id} className="archive-document-row">
                          <span>{document.title}</span>
                          <button type="button" className="mini-danger" onClick={() => deleteArchiveDocument(document)}>Supprimer</button>
                        </p>
                      ))}
                    </div>
                    <div className="archive-detail-section">
                      <h3>Dépenses</h3>
                      {(archive?.expenses || []).length === 0 ? <p className="tool-muted">Aucune dépense enregistrée.</p> : (archive.expenses).map((expense) => (
                        <p key={expense.id}>{expense.category}: {expense.label} - {euro(expense.amount)}</p>
                      ))}
                      {archive?.summary ? <p className="archive-detail-total">Total dépenses: {euro(archive.summary.expensesTotal)} - Gain: {euro(archive.summary.gain)}</p> : null}
                    </div>
                    <div className="archive-detail-section">
                      <h3>Documents pour la comptabilité</h3>
                      {documents.filter((document) => document.type !== "Note").length === 0 ? <p className="tool-muted">Aucun document ajouté.</p> : documents.filter((document) => document.type !== "Note").map((document) => (
                        <p key={document.id} className="archive-document-row">
                          <span className="archive-document-type">{document.type}</span>
                          <span>{document.title}{document.amount ? ` - ${euro(document.amount)}` : ""}</span>
                          {document.url ? <a href={document.url} download={document.fileName || document.title} target="_blank" rel="noreferrer">Télécharger</a> : null}
                          <button type="button" className="mini-danger" onClick={() => deleteArchiveDocument(document)}>Supprimer</button>
                        </p>
                      ))}
                      <form className="archive-doc-form" onSubmit={(event) => addArchiveDocument(project, event)}>
                        <select value={docForm.type} onChange={(event) => setDocField(project.id, "type", event.target.value)}>
                          {DOCUMENT_TYPES.map((type) => <option key={type}>{type}</option>)}
                        </select>
                        <input value={docForm.title} onChange={(event) => setDocField(project.id, "title", event.target.value)} placeholder="Titre (ex: Devis chantier, Facture electricien...)" />
                        {docForm.type !== "Note" ? (
                          <>
                            <input type="number" step="0.01" value={docForm.amount} onChange={(event) => setDocField(project.id, "amount", event.target.value)} placeholder="Montant (optionnel)" />
                            <input type="file" accept="image/*,.pdf" onChange={(event) => onDocFile(project.id, event)} />
                          </>
                        ) : (
                          <input value={docForm.notes} onChange={(event) => setDocField(project.id, "notes", event.target.value)} placeholder="Contenu de la note" />
                        )}
                        <button type="submit" className="mini-button">Ajouter</button>
                      </form>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}

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
