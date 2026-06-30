"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Shell } from "../../../components/Shell";
import { apiSend } from "../../../lib/client-api";
import { euro, shortDate } from "../../../lib/pricing";
import { useApi } from "../../../lib/use-api";

const DOCUMENT_TYPES = ["Devis", "Photo", "Facture", "Reçu", "Note"];
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

export default function ArchiveDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: projects, loading: projectsLoading } = useApi("/api/projects", "projects");
  const { data: projectArchives } = useApi("/api/project-archives", "projectArchives");
  const { data: projectDocuments, setData: setProjectDocuments } = useApi("/api/project-documents", "projectDocuments");
  const { data: projectMessages } = useApi("/api/project-messages", "messages");
  const [docForm, setDocForm] = useState(emptyDocForm);

  const project = projects.find((item) => item.id === params.id);
  const archive = projectArchives.find((item) => item.projectId === params.id);
  const documents = projectDocuments.filter((document) => document.projectId === params.id);
  const messages = projectMessages.filter((message) => message.projectId === params.id);

  function setDocField(field, value) {
    setDocForm((current) => ({ ...current, [field]: value }));
  }

  async function onDocFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = await fileToDataUrl(file);
    setDocForm((current) => ({ ...current, url, fileName: file.name, title: current.title || file.name }));
  }

  async function addArchiveDocument(event) {
    event.preventDefault();
    if (!docForm.title.trim() && !docForm.url) return;
    const { projectDocument } = await apiSend("/api/project-documents", {
      projectId: params.id,
      type: docForm.type,
      title: docForm.title || docForm.fileName || docForm.type,
      fileName: docForm.fileName,
      url: docForm.url,
      amount: docForm.amount,
      notes: docForm.notes
    });
    setProjectDocuments([projectDocument, ...projectDocuments]);
    setDocForm(emptyDocForm);
  }

  async function deleteArchiveDocument(document) {
    await apiSend("/api/project-documents", { id: document.id, action: "delete" }, "PATCH");
    setProjectDocuments(projectDocuments.filter((item) => item.id !== document.id));
  }

  async function restoreProject() {
    await apiSend("/api/projects", { id: params.id, action: "restore" }, "PATCH");
    router.push("/archives");
  }

  async function deleteProject() {
    await apiSend("/api/projects", { id: params.id, action: "delete" }, "PATCH");
    router.push("/archives");
  }

  if (projectsLoading) {
    return (
      <Shell>
        <section className="panel"><div className="empty-state">Chargement...</div></section>
      </Shell>
    );
  }

  if (!project) {
    return (
      <Shell>
        <section className="mobile-tool">
          <header className="tool-topline">
            <button type="button" className="plain-back" onClick={() => router.push("/archives")}>{"<"}</button>
            <h1>Introuvable</h1>
            <span />
          </header>
          <div className="tool-empty">Ce chantier n'existe plus.</div>
        </section>
      </Shell>
    );
  }

  const validatedQuote = archive?.quotes?.find((q) => q.status === "Signe" || q.signatureStatus === "Signe");
  const planningTasks = [...(archive?.tasks || [])].sort((a, b) => String(a.startDate || a.dueDate || "").localeCompare(String(b.startDate || b.dueDate || "")));
  const pastEvents = (archive?.appointments || []).filter((e) => String(e.startAt || "") <= new Date().toISOString());

  return (
    <Shell>
      <section className="mobile-tool">
        <header className="tool-topline">
          <button type="button" className="plain-back" onClick={() => router.push("/archives")}>{"<"}</button>
          <div className="follow-title">
            <h1>{project.title}</h1>
            <p>{project.client || project.reference}</p>
          </div>
          <span />
        </header>

        <div className="archive-row-block archive-detail-page">
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
              <button type="button" onClick={restoreProject}>Restaurer</button>
              <button type="button" className="danger" onClick={deleteProject}>Supprimer</button>
            </div>
          </div>

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
              <form className="archive-doc-form" onSubmit={addArchiveDocument}>
                <select value={docForm.type} onChange={(event) => setDocField("type", event.target.value)}>
                  {DOCUMENT_TYPES.map((type) => <option key={type}>{type}</option>)}
                </select>
                <input value={docForm.title} onChange={(event) => setDocField("title", event.target.value)} placeholder="Titre (ex: Devis chantier, Facture electricien...)" />
                {docForm.type !== "Note" ? (
                  <>
                    <input type="number" step="0.01" value={docForm.amount} onChange={(event) => setDocField("amount", event.target.value)} placeholder="Montant (optionnel)" />
                    <input type="file" accept="image/*,.pdf" onChange={onDocFile} />
                  </>
                ) : (
                  <input value={docForm.notes} onChange={(event) => setDocField("notes", event.target.value)} placeholder="Contenu de la note" />
                )}
                <button type="submit" className="mini-button">Ajouter</button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </Shell>
  );
}
