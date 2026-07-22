"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Shell } from "../../../components/Shell";
import { apiSend, readStoredUser } from "../../../lib/client-api";
import { euro, shortDate } from "../../../lib/pricing";
import { useApi } from "../../../lib/use-api";
import { useLocale } from "../../../lib/i18n";

const DOCUMENT_TYPES = ["Devis", "Photo", "Facture", "Reçu", "Note"];
const emptyDocForm = { type: "Devis", title: "", amount: "", notes: "", fileName: "", url: "" };

function formatDate(value) {
  if (!value) return "-";
  try { return shortDate(value); } catch { return value; }
}

function formatDateTime(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return value; }
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
  const { L } = useLocale();
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
        <section className="panel"><div className="empty-state">{L.clientSpace.loading}</div></section>
      </Shell>
    );
  }

  if (!project) {
    return (
      <Shell>
        <section className="mobile-tool">
          <header className="tool-topline">
            <button type="button" className="plain-back" onClick={() => router.push("/archives")}>{"<"}</button>
            <h1>{L.archives.notFound}</h1>
            <span />
          </header>
          <div className="tool-empty">{L.archives.notFound}</div>
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
                {L.archives.ref} {project.reference || "-"} · {L.archives.startLabel} {formatDate(project.startDate)} · {L.archives.endLabel} {formatDate(project.endDate)}
              </small>
            </div>
            <div className="archive-row-actions">
              <button type="button" onClick={restoreProject}>{L.archives.restore}</button>
              <button type="button" className="danger" onClick={deleteProject}>{L.archives.delete}</button>
            </div>
          </div>

          <div className="archive-detail">
            <div className="archive-detail-section">
              <h3>{L.archives.quotesSection}</h3>
              {(archive?.quotes || []).length === 0 ? <p className="tool-muted">{L.archives.noQuotesLinked}</p> : (
                (archive.quotes).map((q) => (
                  <p key={q.id}>
                    {q.quoteNumber} - {euro(q.totalTtc)} - {q.signatureStatus === "Signe" ? L.archives.validatedByClient : (q.status || "Brouillon")}
                    {" "}<a href={`/api/quotes/${q.id}/documents?type=quote&format=pdf&accessToken=${encodeURIComponent(readStoredUser()?.accessToken || "")}`} target="_blank" rel="noreferrer">{L.common.download}</a>
                  </p>
                ))
              )}
            </div>
            <div className="archive-detail-section">
              <h3>{L.archives.clientValidation}</h3>
              <p className="tool-muted">{validatedQuote ? `${L.archives.quotesSection} ${validatedQuote.quoteNumber} ${L.archives.validatedByClient}.` : L.archives.noValidation}</p>
            </div>
            <div className="archive-detail-section">
              <h3>{L.archives.taskPlanningTitle}</h3>
              {planningTasks.length === 0 ? <p className="tool-muted">{L.archives.noTasks}</p> : planningTasks.map((task) => (
                <p key={task.id} className="archive-document-row">
                  <span className={`archive-document-type${task.done ? " done" : ""}`}>{task.done ? L.archives.taskDone : L.archives.taskPlanned}</span>
                  <span>{task.label} - {task.room || "—"} - {formatDate(task.startDate || task.dueDate)}{task.endDate && task.endDate !== task.startDate ? ` → ${formatDate(task.endDate)}` : ""} - {task.assignedTo || "—"}</span>
                </p>
              ))}
            </div>
            <div className="archive-detail-section">
              <h3>{L.archives.pastAppts}</h3>
              {pastEvents.length === 0 ? <p className="tool-muted">{L.archives.noAppts}</p> : pastEvents.map((event) => (
                <p key={event.id}>{event.title} - {formatDate(event.startAt)}</p>
              ))}
            </div>
            <div className="archive-detail-section">
              <h3>{L.archives.conversations}</h3>
              {messages.length === 0 ? <p className="tool-muted">{L.archives.noMessages}</p> : messages.map((message) => (
                <p key={message.id} className="archive-document-row">
                  <span className="archive-document-type">{message.channel === "email" ? "Email" : "SMS"}</span>
                  <span>{formatDateTime(message.createdAt)} - {message.to} - {message.subject || message.text}</span>
                </p>
              ))}
            </div>
            <div className="archive-detail-section">
              <h3>{L.archives.noteSection}</h3>
              {project.notes ? <p>{project.notes}</p> : null}
              {documents.filter((document) => document.type === "Note").length === 0 && !project.notes ? <p className="tool-muted">{L.archives.noNotes}</p> : null}
              {documents.filter((document) => document.type === "Note").map((document) => (
                <p key={document.id} className="archive-document-row">
                  <span>{document.title}</span>
                  <button type="button" className="mini-danger" onClick={() => deleteArchiveDocument(document)}>{L.common.delete}</button>
                </p>
              ))}
            </div>
            <div className="archive-detail-section">
              <h3>{L.archives.expenses}</h3>
              {(archive?.expenses || []).length === 0 ? <p className="tool-muted">{L.archives.noExpenses}</p> : (archive.expenses).map((expense) => (
                <p key={expense.id}>{expense.category}: {expense.label} - {euro(expense.amount)}</p>
              ))}
              {archive?.summary ? <p className="archive-detail-total">{L.archives.totalExpenses} {euro(archive.summary.expensesTotal)} - {L.archives.gain} {euro(archive.summary.gain)}</p> : null}
            </div>
            <div className="archive-detail-section">
              <h3>{L.archives.accountingDocs}</h3>
              {documents.filter((document) => document.type !== "Note").length === 0 ? <p className="tool-muted">{L.archives.noDocs}</p> : documents.filter((document) => document.type !== "Note").map((document) => (
                <p key={document.id} className="archive-document-row">
                  <span className="archive-document-type">{document.type}</span>
                  <span>{document.title}{document.amount ? ` - ${euro(document.amount)}` : ""}</span>
                  {document.url ? <a href={document.url} download={document.fileName || document.title} target="_blank" rel="noreferrer">{L.common.download}</a> : null}
                  <button type="button" className="mini-danger" onClick={() => deleteArchiveDocument(document)}>{L.common.delete}</button>
                </p>
              ))}
              <form className="archive-doc-form" onSubmit={addArchiveDocument}>
                <select value={docForm.type} onChange={(event) => setDocField("type", event.target.value)}>
                  {DOCUMENT_TYPES.map((type) => <option key={type}>{type}</option>)}
                </select>
                <input value={docForm.title} onChange={(event) => setDocField("title", event.target.value)} placeholder={L.archives.docTitlePh} />
                {docForm.type !== "Note" ? (
                  <>
                    <input type="number" step="0.01" value={docForm.amount} onChange={(event) => setDocField("amount", event.target.value)} placeholder={L.archives.amountOptional} />
                    <input type="file" accept="image/*,.pdf" onChange={onDocFile} />
                  </>
                ) : (
                  <input value={docForm.notes} onChange={(event) => setDocField("notes", event.target.value)} placeholder={L.archives.noteContent} />
                )}
                <button type="submit" className="mini-button">{L.archives.addBtn}</button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </Shell>
  );
}
