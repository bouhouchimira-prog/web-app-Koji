"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Shell } from "../../../components/Shell";
import { apiSend } from "../../../lib/client-api";
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
  const { data: projectMessages } = useApi(`/api/project-messages?projectId=${params.id}`, "messages");
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
      <Shell variant="pro">
        <section className="card"><p className="empty">{L.clientSpace.loading}</p></section>
      </Shell>
    );
  }

  if (!project) {
    return (
      <Shell variant="pro">
        <div className="head">
          <div className="stack">
            <button type="button" className="link" onClick={() => router.push("/archives")}>← Archives</button>
            <h1>{L.archives.notFound}</h1>
          </div>
        </div>
        <div className="tbl"><p className="empty">{L.archives.notFound}</p></div>
      </Shell>
    );
  }

  const validatedQuote = archive?.quotes?.find((q) => q.status === "Signe" || q.signatureStatus === "Signe");
  const planningTasks = [...(archive?.tasks || [])].sort((a, b) => String(a.startDate || a.dueDate || "").localeCompare(String(b.startDate || b.dueDate || "")));
  const pastEvents = (archive?.appointments || []).filter((e) => String(e.startAt || "") <= new Date().toISOString());
  const noteDocuments = documents.filter((document) => document.type === "Note");
  const accountingDocuments = documents.filter((document) => document.type !== "Note");

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <button type="button" className="link" onClick={() => router.push("/archives")}>← Archives</button>
          <span className="eyebrow">{L.archives.ref} {project.reference || "-"} · {L.archives.startLabel} {formatDate(project.startDate)} · {L.archives.endLabel} {formatDate(project.endDate)}</span>
          <h1>{project.title}</h1>
          <span className="muted">{project.client || project.reference}</span>
        </div>
        <div className="hact">
          <button type="button" className="btn btn-sec" onClick={restoreProject}>{L.archives.restore}</button>
          <button type="button" className="btn btn-sec" onClick={deleteProject}>{L.archives.delete}</button>
        </div>
      </div>

      <div className="pf-g2">
        <div className="kj-col">
          <section className="card">
            <div className="card-h"><h2>{L.archives.quotesSection}</h2></div>
            {(archive?.quotes || []).length === 0 ? <p className="muted">{L.archives.noQuotesLinked}</p> : (
              (archive.quotes).map((q) => (
                <div className="kv" key={q.id}>
                  <span>{q.quoteNumber} · {q.signatureStatus === "Signe" ? L.archives.validatedByClient : (q.status || "Brouillon")}</span>
                  <b>{euro(q.totalTtc)} <a className="link" href={`/api/quotes/${q.id}/documents?type=quote&format=pdf`} target="_blank" rel="noreferrer">{L.common.download}</a></b>
                </div>
              ))
            )}
          </section>

          <section className="card">
            <div className="card-h"><h2>{L.archives.clientValidation}</h2></div>
            <p className="muted">{validatedQuote ? `${L.archives.quotesSection} ${validatedQuote.quoteNumber} ${L.archives.validatedByClient}.` : L.archives.noValidation}</p>
          </section>

          <section className="card">
            <div className="card-h"><h2>{L.archives.taskPlanningTitle}</h2></div>
            {planningTasks.length === 0 ? <p className="muted">{L.archives.noTasks}</p> : planningTasks.map((task) => (
              <div className="kv" key={task.id}>
                <span>{task.label} · {task.room || "—"} · {task.assignedTo || "—"}</span>
                <b><span className={task.done ? "tag tag-b" : "tag dim"}>{task.done ? L.archives.taskDone : L.archives.taskPlanned}</span> {formatDate(task.startDate || task.dueDate)}{task.endDate && task.endDate !== task.startDate ? ` → ${formatDate(task.endDate)}` : ""}</b>
              </div>
            ))}
          </section>

          <section className="card">
            <div className="card-h"><h2>{L.archives.pastAppts}</h2></div>
            {pastEvents.length === 0 ? <p className="muted">{L.archives.noAppts}</p> : pastEvents.map((event) => (
              <div className="kv" key={event.id}><span>{event.title}</span><b>{formatDate(event.startAt)}</b></div>
            ))}
          </section>

          <section className="card">
            <div className="card-h"><h2>{L.archives.conversations}</h2></div>
            {messages.length === 0 ? <p className="muted">{L.archives.noMessages}</p> : messages.map((message) => (
              <div className="kv" key={message.id}>
                <span><span className="tag dim">{message.channel === "email" ? "Email" : "SMS"}</span> {message.to} · {message.subject || message.text}</span>
                <b>{formatDateTime(message.createdAt)}</b>
              </div>
            ))}
          </section>
        </div>

        <div className="kj-col">
          <section className="card">
            <div className="card-h"><h2>{L.archives.noteSection}</h2></div>
            {project.notes ? <p className="kj-p">{project.notes}</p> : null}
            {noteDocuments.length === 0 && !project.notes ? <p className="muted">{L.archives.noNotes}</p> : null}
            {noteDocuments.map((document) => (
              <div className="kv" key={document.id}>
                <span>{document.title}</span>
                <button type="button" className="link" onClick={() => deleteArchiveDocument(document)}>{L.common.delete}</button>
              </div>
            ))}
          </section>

          <section className="card">
            <div className="card-h"><h2>{L.archives.expenses}</h2></div>
            {(archive?.expenses || []).length === 0 ? <p className="muted">{L.archives.noExpenses}</p> : (archive.expenses).map((expense) => (
              <div className="kv" key={expense.id}><span>{expense.category}: {expense.label}</span><b>{euro(expense.amount)}</b></div>
            ))}
            {archive?.summary ? (
              <div className="kv"><span>{L.archives.totalExpenses}</span><b>{euro(archive.summary.expensesTotal)} · {L.archives.gain} {euro(archive.summary.gain)}</b></div>
            ) : null}
          </section>

          <section className="card">
            <div className="card-h"><h2>{L.archives.accountingDocs}</h2></div>
            {accountingDocuments.length === 0 ? <p className="muted">{L.archives.noDocs}</p> : accountingDocuments.map((document) => (
              <div className="kv" key={document.id}>
                <span><span className="tag dim">{document.type}</span> {document.title}{document.amount ? ` · ${euro(document.amount)}` : ""}</span>
                <b>
                  {document.url ? <a className="link" href={document.url} download={document.fileName || document.title} target="_blank" rel="noreferrer">{L.common.download}</a> : null}
                  {" "}<button type="button" className="link" onClick={() => deleteArchiveDocument(document)}>{L.common.delete}</button>
                </b>
              </div>
            ))}
            <form className="fgrid" style={{ marginTop: 16 }} onSubmit={addArchiveDocument}>
              <label>
                Type
                <select value={docForm.type} onChange={(event) => setDocField("type", event.target.value)}>
                  {DOCUMENT_TYPES.map((type) => <option key={type}>{type}</option>)}
                </select>
              </label>
              <label>
                {L.archives.docTitlePh}
                <input value={docForm.title} onChange={(event) => setDocField("title", event.target.value)} placeholder={L.archives.docTitlePh} />
              </label>
              {docForm.type !== "Note" ? (
                <>
                  <label>
                    {L.archives.amountOptional}
                    <input type="number" step="0.01" value={docForm.amount} onChange={(event) => setDocField("amount", event.target.value)} placeholder={L.archives.amountOptional} />
                  </label>
                  <label>
                    Fichier
                    <input type="file" accept="image/*,.pdf" onChange={onDocFile} />
                  </label>
                </>
              ) : (
                <label className="full">
                  {L.archives.noteContent}
                  <input value={docForm.notes} onChange={(event) => setDocField("notes", event.target.value)} placeholder={L.archives.noteContent} />
                </label>
              )}
              <div className="ed-act full">
                <button type="submit" className="btn btn-main">{L.archives.addBtn}</button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </Shell>
  );
}
