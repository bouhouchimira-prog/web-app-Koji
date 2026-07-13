"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiGet, apiSend } from "../../lib/client-api";
import { useLocale } from "../../lib/i18n";
import { euro, shortDate } from "../../lib/pricing";
import { useApi } from "../../lib/use-api";

function TaskMessageThread({ task, projectDocuments }) {
  const { L } = useLocale();
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replyFile, setReplyFile] = useState(null);
  const [replyUrl, setReplyUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [localDocs, setLocalDocs] = useState(null);
  const fileRef = useRef(null);

  const allDocs = localDocs || projectDocuments.filter(
    (d) => ["client", "company"].includes(d.source) && d.taskId === task.id
  );

  const clientNotes = allDocs.filter((d) => d.source === "client");
  if (clientNotes.length === 0) return null;

  async function onFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setReplyUrl(String(reader.result || "")); setReplyFile(file.name); };
    reader.readAsDataURL(file);
  }

  async function sendReply(noteId) {
    if (!replyText.trim() && !replyUrl) return;
    setSending(true);
    const raw = typeof window !== "undefined" ? window.localStorage.getItem("koji-user") : null;
    const currentUserId = raw ? (JSON.parse(raw).id || "") : "";
    try {
      const r = await fetch("/api/task-replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUserId,
          taskId: task.id,
          replyToId: noteId,
          message: replyText,
          fileName: replyFile || "",
          fileUrl: replyUrl
        })
      });
      if (r.ok) {
        const data = await r.json();
        setLocalDocs([data.reply, ...allDocs]);
        setReplyText(""); setReplyFile(null); setReplyUrl("");
        setReplyingTo(null);
        if (fileRef.current) fileRef.current.value = "";
      }
    } finally { setSending(false); }
  }

  return (
    <div className="follow-client-notes">
      <span className="follow-client-notes-label">💬 {L.chantiers.clientMessages}</span>
      {clientNotes.map((note) => {
        const replies = allDocs.filter((d) => d.source === "company" && d.replyToId === note.id);
        const isReplying = replyingTo === note.id;
        return (
          <div key={note.id}>
            <div className="follow-client-note">
              <div className="follow-client-note-head">
                <span className="archive-document-type">{note.type}</span>
                <strong>{note.clientName || "Client"}</strong>
                <small>{note.createdAt ? shortDate(note.createdAt) : ""}</small>
              </div>
              {note.notes ? <p>{note.notes}</p> : null}
              {note.url ? <a href={note.url} download={note.fileName || note.title} target="_blank" rel="noreferrer">{L.chantiers.downloadFile}</a> : null}
              <button type="button" className="reply-trigger-btn" onClick={() => { setReplyingTo(isReplying ? null : note.id); setReplyText(""); }}>
                {isReplying ? L.common.cancel : `↩ ${L.chantiers.reply}`}
              </button>
            </div>

            {replies.map((rep) => (
              <div key={rep.id} className="follow-company-reply">
                <div className="follow-client-note-head">
                  <span className="archive-document-type reply-badge">{L.chantiers.replyLabel}</span>
                  <strong>{rep.senderName || "Entreprise"}</strong>
                  <small>{rep.createdAt ? shortDate(rep.createdAt) : ""}</small>
                </div>
                {rep.notes ? <p>{rep.notes}</p> : null}
                {rep.url ? <a href={rep.url} download={rep.fileName || rep.title} target="_blank" rel="noreferrer">{L.common.download}</a> : null}
              </div>
            ))}

            {isReplying ? (
              <div className="follow-reply-form">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={L.chantiers.replyPlaceholder}
                  rows={2}
                />
                <div className="follow-reply-actions">
                  <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: "none" }} onChange={onFileChange} />
                  <button type="button" className="mini-button" onClick={() => fileRef.current?.click()}>
                    {replyFile ? `📎 ${replyFile}` : L.chantiers.attach}
                  </button>
                  <button
                    type="button"
                    className="mobile-primary"
                    disabled={sending || (!replyText.trim() && !replyUrl)}
                    onClick={() => sendReply(note.id)}
                  >
                    {sending ? L.chantiers.sending : L.common.send}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function CardChevron({ collapsed }) {
  return (
    <svg className="card-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function quoteItemId(item, index) {
  return `${item.roomId || item.room || "chantier"}-${item.taskId || item.code || index}`;
}

function isArchived(project) {
  return String(project.status || "").toLowerCase().includes("archive");
}

function isReadyForTracking(project) {
  const status = String(project.status || "").toLowerCase();
  return status.includes("cours") || status.includes("signe") || status.includes("accept") || status.includes("planifier");
}

function formatDate(value) {
  if (!value) return "-";
  try {
    return shortDate(value);
  } catch {
    return value;
  }
}

const emptyPlan = {
  startDate: "",
  endDate: "",
  workerIds: [],
  supplyId: "",
  supplyQuantity: "",
  supplyNote: ""
};

const emptyTaskForm = { label: "", dueDate: "", location: "" };
const emptyRdvForm = { title: "", date: "", time: "", contact: "", address: "" };
const emptyDocumentForm = { title: "", type: "Document", amount: "", category: "", location: "", url: "" };
const emptyExpenseForm = { label: "", category: "Fournitures", amount: "", location: "", notes: "" };

function defaultBudgetRows(project) {
  const budget = Number(project?.budgetHt || 0);
  return [
    { id: "labor", label: "Main d'oeuvre", estimated: budget, real: 0 },
    { id: "supplies", label: "Fournitures", estimated: 0, real: 0 },
    { id: "global", label: "Budget global", estimated: budget, real: 0 }
  ];
}

function dateTimeFromEvent(event) {
  const start = String(event?.startAt || "");
  return start ? `${formatDate(start)} ${start.slice(11, 16)}`.trim() : "-";
}

export default function ProjectsTrackingPage() {
  const { L } = useLocale();
  const { data: projects, setData: setProjects } = useApi("/api/projects", "projects");
  const { data: quotes } = useApi("/api/quotes", "quotes");
  const { data: tasks, setData: setTasks } = useApi("/api/tasks", "tasks");
  const { data: workers } = useApi("/api/workers", "workers");
  const { data: supplies } = useApi("/api/supplies", "supplies");
  const { data: calendarEvents, setData: setCalendarEvents } = useApi("/api/calendar-events", "calendarEvents");
  const { data: invoices } = useApi("/api/invoices", "invoices");
  const { data: projectDocuments, setData: setProjectDocuments } = useApi("/api/project-documents", "projectDocuments");
  const { data: projectArchives } = useApi("/api/project-archives", "projectArchives");
  const { data: history } = useApi("/api/history", "history");
  const { data: expenses, setData: setExpenses } = useApi("/api/expenses", "expenses");

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [trackingTarget, setTrackingTarget] = useState(null);
  const [planForm, setPlanForm] = useState(emptyPlan);
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [rdvForm, setRdvForm] = useState(emptyRdvForm);
  const [documentForm, setDocumentForm] = useState(emptyDocumentForm);
  const [expenseForm, setExpenseForm] = useState(emptyExpenseForm);
  const [budgetDraft, setBudgetDraft] = useState(null);
  const [message, setMessage] = useState("");
  const [marketplaceDesc, setMarketplaceDesc] = useState("");
  const [collapsedCards, setCollapsedCards] = useState(() => new Set());
  const [expandedLineKey, setExpandedLineKey] = useState(null);
  const [clientPortalAccess, setClientPortalAccess] = useState(null);

  function toggleCard(key) {
    setCollapsedCards((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const projectId = new URLSearchParams(window.location.search).get("project");
    if (projectId) setSelectedProjectId(projectId);
  }, []);

  useEffect(() => {
    if (!selectedProjectId) { setClientPortalAccess(null); return; }
    apiGet(`/api/client-portal-info?projectId=${encodeURIComponent(selectedProjectId)}`)
      .then((data) => setClientPortalAccess(data.access || null))
      .catch(() => setClientPortalAccess(null));
  }, [selectedProjectId]);

  const activeProjects = useMemo(() => {
    return projects.filter((project) => {
      if (isArchived(project)) return false;
      const linkedQuote = quotes.find((q) => q.projectId === project.id);
      if (!linkedQuote) return false;
      return linkedQuote.status === "Signe" || linkedQuote.signatureStatus === "Signe";
    });
  }, [projects, quotes]);
  const selectedProject = activeProjects.find((project) => project.id === selectedProjectId) || null;
  const selectedQuote = useMemo(() => {
    if (!selectedProject) return null;
    return quotes.find((quote) => quote.projectId === selectedProject.id)
      || quotes.find((quote) => quote.project === selectedProject.title)
      || null;
  }, [quotes, selectedProject]);

  const projectTasks = useMemo(() => {
    if (!selectedProject) return [];
    return tasks.filter((task) => task.projectId === selectedProject.id || task.project === selectedProject.title);
  }, [selectedProject, tasks]);

  const upcomingTasks = useMemo(() => {
    return projectTasks
      .filter((task) => !task.done)
      .sort((a, b) => String(a.dueDate || a.startDate || "").localeCompare(String(b.dueDate || b.startDate || "")));
  }, [projectTasks]);

  const completedTasks = useMemo(() => {
    return projectTasks
      .filter((task) => task.done)
      .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
  }, [projectTasks]);

  const projectEvents = useMemo(() => {
    if (!selectedProject) return [];
    return calendarEvents
      .filter((event) => event.projectId === selectedProject.id || event.projectTitle === selectedProject.title)
      .sort((a, b) => String(a.startAt || "").localeCompare(String(b.startAt || "")));
  }, [calendarEvents, selectedProject]);

  const nextRdv = useMemo(() => {
    const now = new Date().toISOString();
    return projectEvents.find((event) => String(event.startAt || "") >= now) || null;
  }, [projectEvents]);

  const linkedInvoices = useMemo(() => {
    if (!selectedProject) return [];
    return invoices.filter((invoice) => invoice.projectId === selectedProject.id || invoice.projectTitle === selectedProject.title);
  }, [invoices, selectedProject]);

  const linkedDocuments = useMemo(() => {
    if (!selectedProject) return [];
    return projectDocuments.filter((document) => document.projectId === selectedProject.id);
  }, [projectDocuments, selectedProject]);

  const linkedExpenses = useMemo(() => {
    if (!selectedProject) return [];
    return expenses.filter((expense) => expense.projectId === selectedProject.id);
  }, [expenses, selectedProject]);

  const linkedHistory = useMemo(() => {
    if (!selectedProject) return [];
    return history.filter((item) => item.meta?.projectId === selectedProject.id || item.entityId === selectedProject.id).slice(0, 8);
  }, [history, selectedProject]);

  const linkedArchive = useMemo(() => {
    if (!selectedProject) return null;
    return projectArchives.find((archive) => archive.projectId === selectedProject.id) || null;
  }, [projectArchives, selectedProject]);

  const budgetRows = useMemo(() => {
    if (!selectedProject) return [];
    if (budgetDraft?.projectId === selectedProject.id) return budgetDraft.items;
    return Array.isArray(selectedProject.budgetItems) && selectedProject.budgetItems.length > 0
      ? selectedProject.budgetItems
      : defaultBudgetRows(selectedProject);
  }, [budgetDraft, selectedProject]);

  const budgetTotal = useMemo(() => {
    return budgetRows.reduce((acc, row) => ({
      estimated: acc.estimated + Number(row.estimated || 0),
      real: acc.real + Number(row.real || 0)
    }), { estimated: 0, real: 0 });
  }, [budgetRows]);

  const trackingLines = useMemo(() => {
    if (!selectedProject) return [];
    const matchedTaskIds = new Set();
    const quoteLines = (selectedQuote?.items || []).map((item, index) => {
      const key = quoteItemId(item, index);
      const task = projectTasks.find((candidate) => candidate.quoteItemId === key)
        || projectTasks.find((candidate) => candidate.label === item.label && candidate.room === item.room);
      if (task) matchedTaskIds.add(task.id);
      return { key, quoteLine: item, task };
    });
    const extraTasks = projectTasks
      .filter((task) => !matchedTaskIds.has(task.id))
      .map((task) => ({ key: task.quoteItemId || task.id, quoteLine: null, task }));
    return [...quoteLines, ...extraTasks];
  }, [projectTasks, selectedProject, selectedQuote]);

  const supplyNeeds = useMemo(() => {
    return projectTasks.flatMap((task) => (task.supplyNeeds || []).map((need) => ({ ...need, taskLabel: task.label })));
  }, [projectTasks]);

  const doneCount = projectTasks.filter((task) => task.done).length;
  const progress = projectTasks.length === 0 ? Number(selectedProject?.progress || 0) : Math.round((doneCount / projectTasks.length) * 100);
  const projectReady = selectedProject ? isReadyForTracking(selectedProject) : false;

  function openPlanner(line) {
    const need = line.task?.supplyNeeds?.[0] || {};
    setTrackingTarget(line);
    setPlanForm({
      startDate: line.task?.startDate || "",
      endDate: line.task?.endDate || line.task?.dueDate || "",
      workerIds: line.task?.workerIds || [],
      supplyId: need.supplyId || "",
      supplyQuantity: need.quantity || "",
      supplyNote: need.note || ""
    });
    setMessage("");
  }

  function toggleWorker(workerId) {
    setPlanForm((current) => ({
      ...current,
      workerIds: current.workerIds.includes(workerId)
        ? current.workerIds.filter((id) => id !== workerId)
        : [...current.workerIds, workerId]
    }));
  }

  function buildSupplyNeeds() {
    if (!planForm.supplyId) return [];
    const supply = supplies.find((item) => item.id === planForm.supplyId);
    return [{
      supplyId: planForm.supplyId,
      name: supply?.name || "Fourniture",
      quantity: Number(planForm.supplyQuantity || 1),
      unit: supply?.unit || "",
      note: planForm.supplyNote || "",
      status: "A commander"
    }];
  }

  async function refreshProjectProgress(nextTasks) {
    if (!selectedProject) return;
    const linked = nextTasks.filter((task) => task.projectId === selectedProject.id || task.project === selectedProject.title);
    const nextProgress = linked.length === 0 ? 0 : Math.round((linked.filter((task) => task.done).length / linked.length) * 100);
    const patch = {
      id: selectedProject.id,
      status: selectedProject.status === "En attente signature" ? "En cours" : selectedProject.status,
      progress: nextProgress,
      startDate: linked.map((task) => task.startDate).filter(Boolean).sort()[0] || selectedProject.startDate || "",
      endDate: linked.map((task) => task.endDate || task.dueDate).filter(Boolean).sort().at(-1) || selectedProject.endDate || ""
    };
    const { project } = await apiSend("/api/projects", patch, "PATCH");
    setProjects(projects.map((item) => item.id === project.id ? project : item));
  }

  async function savePlanning() {
    if (!trackingTarget || !selectedProject) return;
    const quoteLine = trackingTarget.quoteLine || {};
    const selectedWorkers = workers.filter((worker) => planForm.workerIds.includes(worker.id));
    const payload = {
      label: trackingTarget.task?.label || quoteLine.label || "Ouvrage",
      project: selectedProject.title,
      projectId: selectedProject.id,
      quoteId: selectedQuote?.id || trackingTarget.task?.quoteId || "",
      quoteItemId: trackingTarget.key,
      code: quoteLine.code || trackingTarget.task?.code || "",
      room: quoteLine.room || trackingTarget.task?.room || "Chantier",
      unit: quoteLine.unit || trackingTarget.task?.unit || "",
      quantity: Number(quoteLine.quantity || trackingTarget.task?.quantity || 0),
      dueDate: planForm.endDate || planForm.startDate || trackingTarget.task?.dueDate || "",
      startDate: planForm.startDate,
      endDate: planForm.endDate,
      durationHours: Number(quoteLine.correctedTimeHours || quoteLine.normativeTime || trackingTarget.task?.durationHours || 1),
      workerIds: planForm.workerIds,
      assignedTo: selectedWorkers.map((worker) => worker.name).join(", ") || "Equipe",
      participantType: selectedWorkers.some((worker) => worker.type === "Sous-traitant") ? "Sous-traitants" : "Ouvriers",
      supplyNeeds: buildSupplyNeeds(),
      status: "Planifiee"
    };

    if (trackingTarget.task) {
      const { task } = await apiSend("/api/tasks", { id: trackingTarget.task.id, ...payload }, "PATCH");
      const nextTasks = tasks.map((item) => item.id === task.id ? task : item);
      setTasks(nextTasks);
      await refreshProjectProgress(nextTasks);
    } else {
      const { task } = await apiSend("/api/tasks", payload);
      const nextTasks = [task, ...tasks];
      setTasks(nextTasks);
      await refreshProjectProgress(nextTasks);
    }

    setTrackingTarget(null);
    setPlanForm(emptyPlan);
    setMessage("Suivi de l'ouvrage enregistre.");
  }

  async function toggleDone(task) {
    const { task: updatedTask } = await apiSend("/api/tasks", { id: task.id, action: "toggle" }, "PATCH");
    const nextTasks = tasks.map((item) => item.id === updatedTask.id ? updatedTask : item);
    setTasks(nextTasks);
    await refreshProjectProgress(nextTasks);
  }

  async function validateTask(task) {
    const { task: updatedTask } = await apiSend("/api/tasks", { id: task.id, action: "validate" }, "PATCH");
    const nextTasks = tasks.map((item) => item.id === updatedTask.id ? updatedTask : item);
    setTasks(nextTasks);
    await refreshProjectProgress(nextTasks);
    setMessage(`Ouvrage "${updatedTask.label}" valide.`);
  }

  function setBudgetValue(rowId, field, value) {
    if (!selectedProject) return;
    const source = budgetDraft?.projectId === selectedProject.id ? budgetDraft.items : budgetRows;
    setBudgetDraft({
      projectId: selectedProject.id,
      items: source.map((row) => row.id === rowId ? { ...row, [field]: Number(value || 0) } : row)
    });
  }

  async function saveBudgetRows() {
    if (!selectedProject) return;
    const { project } = await apiSend("/api/projects", {
      id: selectedProject.id,
      budgetItems: budgetRows
    }, "PATCH");
    setProjects(projects.map((item) => item.id === project.id ? project : item));
    setBudgetDraft(null);
    setMessage("Budget enregistre. Une alerte est creee si le reel depasse l'estime.");
  }

  async function addProjectTask(event) {
    event.preventDefault();
    if (!selectedProject || !taskForm.label.trim()) return;
    const { task } = await apiSend("/api/tasks", {
      label: taskForm.label,
      project: selectedProject.title,
      projectId: selectedProject.id,
      room: "Chantier",
      dueDate: taskForm.dueDate || new Date().toISOString().slice(0, 10),
      startDate: taskForm.dueDate || "",
      assignedTo: "Equipe",
      status: "À faire",
      location: taskForm.location
    });
    setTasks([task, ...tasks]);
    setTaskForm(emptyTaskForm);
    setMessage("Tache ajoutee au chantier.");
  }

  async function addRdv(event) {
    event.preventDefault();
    if (!selectedProject) return;
    const date = rdvForm.date || new Date().toISOString().slice(0, 10);
    const time = rdvForm.time || "09:00";
    const startAt = `${date}T${time}:00`;
    const { calendarEvent } = await apiSend("/api/calendar-events", {
      title: rdvForm.title || "Rendez-vous chantier",
      eventType: "RDV",
      clientName: rdvForm.contact || selectedProject.client || "",
      projectId: selectedProject.id,
      projectTitle: selectedProject.title,
      address: rdvForm.address || selectedProject.address || "",
      startAt,
      endAt: startAt,
      status: "Planifie"
    });
    setCalendarEvents([calendarEvent, ...calendarEvents]);
    setRdvForm(emptyRdvForm);
    setMessage("Rendez-vous ajoute.");
  }

  async function addDocument(event) {
    event.preventDefault();
    if (!selectedProject || !documentForm.title.trim()) return;
    const { projectDocument } = await apiSend("/api/project-documents", {
      projectId: selectedProject.id,
      quoteId: selectedQuote?.id || "",
      title: documentForm.title,
      type: documentForm.type,
      amount: documentForm.amount,
      category: documentForm.category,
      location: documentForm.location,
      url: documentForm.url,
      source: "manuel"
    });
    setProjectDocuments([projectDocument, ...projectDocuments]);
    setDocumentForm(emptyDocumentForm);
    setMessage("Document ajoute au chantier.");
  }

  async function addExpense(event) {
    event.preventDefault();
    if (!selectedProject || !expenseForm.label.trim() || Number(expenseForm.amount || 0) <= 0) return;
    const { expense } = await apiSend("/api/expenses", {
      projectId: selectedProject.id,
      quoteId: selectedQuote?.id || "",
      label: expenseForm.label,
      category: expenseForm.category,
      amount: expenseForm.amount,
      location: expenseForm.location,
      notes: expenseForm.notes
    });
    setExpenses([expense, ...expenses]);
    setExpenseForm(emptyExpenseForm);
    setMessage("Depense reelle ajoutee au chantier.");
  }

  async function closeProject(action) {
    if (!selectedProject) return;
    const { project } = await apiSend("/api/projects", { id: selectedProject.id, action }, "PATCH");
    setProjects(projects.map((item) => item.id === project.id ? project : item));
    setMessage(action === "finish" ? "Chantier termine et archive creee." : "Chantier archive avec son historique.");
  }

  async function publishMarketplace(action) {
    if (!selectedProject) return;
    const raw = typeof window !== "undefined" ? window.localStorage.getItem("koji-user") : null;
    const userId = raw ? (JSON.parse(raw).id || "") : "";
    const { project } = await apiSend("/api/marketplace", { action, projectId: selectedProject.id, userId, description: marketplaceDesc });
    setProjects(projects.map((item) => item.id === project.id ? project : item));
    setMessage(action === "publish" ? "Chantier publié sur la marketplace." : "Chantier retiré de la marketplace.");
  }

  if (selectedProject) {
    return (
      <Shell>
        <div className="mobile-tool chantier-follow">
          {(clientPortalAccess?.portalIdentifier || selectedQuote?.clientPortalAccess?.portalIdentifier) ? (
            <div className="client-portal-id-banner">
              <div>
                <span>Identifiant client à partager</span>
                <strong>{clientPortalAccess?.portalIdentifier || selectedQuote?.clientPortalAccess?.portalIdentifier}</strong>
              </div>
              {(clientPortalAccess?.password || selectedQuote?.clientPortalAccess?.password) ? (
                <div>
                  <span>Mot de passe</span>
                  <strong>{clientPortalAccess?.password || selectedQuote?.clientPortalAccess?.password}</strong>
                </div>
              ) : null}
              {clientPortalAccess?.email ? (
                <div>
                  <span>Email client</span>
                  <strong>{clientPortalAccess.email}</strong>
                </div>
              ) : null}
            </div>
          ) : null}
          <header className="tool-topline compact">
            <button type="button" className="plain-back" onClick={() => setSelectedProjectId("")}>{"<"}</button>
            <div className="follow-title">
              <h1>{selectedProject.title}</h1>
              <p>{selectedProject.client || L.chantiers.contact} - {selectedProject.status}</p>
            </div>
            <Link className="round-pill" href="/planning">Planning</Link>
          </header>

          {!projectReady ? (
            <div className="tool-message">{L.chantiers.trackingActive}</div>
          ) : null}
          {message ? <div className="tool-message">{message}</div> : null}

          <section className="follow-summary">
            <div>
              <span>{L.chantiers.progress}</span>
              <strong>{progress}%</strong>
              <i><b style={{ width: `${progress}%` }} /></i>
            </div>
            <div><span>{L.chantiers.budgetDevis}</span><strong>{euro(selectedQuote?.totalTtc || selectedProject.budgetHt || 0)}</strong></div>
            <div><span>{L.chantiers.start}</span><strong>{formatDate(selectedProject.startDate)}</strong></div>
            <div><span>{L.chantiers.end}</span><strong>{formatDate(selectedProject.endDate || selectedProject.dueDate)}</strong></div>
          </section>

          <section className="project-overview-grid">
            <article className="project-overview-card">
              <button type="button" className="follow-section-head follow-section-head-toggle" onClick={() => toggleCard("agenda")}>
                <h2>{L.chantiers.agenda}</h2>
                <span>{L.chantiers.upcoming(upcomingTasks.length)}</span>
                <CardChevron collapsed={collapsedCards.has("agenda")} />
              </button>
              {!collapsedCards.has("agenda") ? (
                <>
                  <form className="project-mini-form" onSubmit={addProjectTask}>
                    <input value={taskForm.label} onChange={(event) => setTaskForm((current) => ({ ...current, label: event.target.value }))} placeholder={L.chantiers.newTask} />
                    <input type="date" value={taskForm.dueDate} onChange={(event) => setTaskForm((current) => ({ ...current, dueDate: event.target.value }))} />
                    <input value={taskForm.location} onChange={(event) => setTaskForm((current) => ({ ...current, location: event.target.value }))} placeholder={L.chantiers.location} />
                    <button type="submit">{L.chantiers.add}</button>
                  </form>
                  <div className="project-mini-list">
                    {upcomingTasks.length === 0 ? <p>{L.chantiers.noTasks}</p> : upcomingTasks.slice(0, 4).map((task) => (
                      <button type="button" key={task.id} onClick={() => toggleDone(task)}>
                        <strong>{task.label}</strong>
                        <span>{formatDate(task.dueDate || task.startDate)} - {task.assignedTo || "Equipe"}</span>
                      </button>
                    ))}
                  </div>
                  {completedTasks.length > 0 ? (
                    <details className="project-history-details">
                      <summary>{L.chantiers.taskHistory}</summary>
                      {completedTasks.slice(0, 6).map((task) => <p key={task.id}>{task.label} - {formatDate(task.updatedAt || task.createdAt)}</p>)}
                    </details>
                  ) : null}
                </>
              ) : null}
            </article>

            <article className="project-overview-card">
              <button type="button" className="follow-section-head follow-section-head-toggle" onClick={() => toggleCard("budget")}>
                <h2>{L.chantiers.budget}</h2>
                <span>{L.chantiers.total}: {euro(budgetTotal.real)} / {euro(budgetTotal.estimated)}</span>
                <CardChevron collapsed={collapsedCards.has("budget")} />
              </button>
              {!collapsedCards.has("budget") ? (
                <>
                  <div className="budget-follow-list">
                    {budgetRows.map((row) => {
                      const overBudget = Number(row.real || 0) > Number(row.estimated || 0);
                      return (
                        <div className={`budget-follow-row ${overBudget ? "over-budget" : ""}`} key={row.id}>
                          <strong>{row.label}</strong>
                          <label>{L.chantiers.estimated}<input type="number" value={row.estimated} onChange={(event) => setBudgetValue(row.id, "estimated", event.target.value)} /></label>
                          <label>{L.chantiers.real}<input type="number" value={row.real} onChange={(event) => setBudgetValue(row.id, "real", event.target.value)} /></label>
                          <span>{overBudget ? L.chantiers.overBudget : L.chantiers.ok}</span>
                        </div>
                      );
                    })}
                  </div>
                  <button type="button" className="mini-outline" onClick={saveBudgetRows}>{L.chantiers.saveBudget}</button>
                  <form className="project-mini-form expense-mini-form" onSubmit={addExpense}>
                    <input value={expenseForm.label} onChange={(event) => setExpenseForm((current) => ({ ...current, label: event.target.value }))} placeholder={L.chantiers.realExpense} />
                    <select value={expenseForm.category} onChange={(event) => setExpenseForm((current) => ({ ...current, category: event.target.value }))}>
                      {["Fournitures", "Main d'oeuvre", "Sous-traitance", "Tickets", "Autres frais"].map((category) => <option key={category}>{category}</option>)}
                    </select>
                    <input type="number" value={expenseForm.amount} onChange={(event) => setExpenseForm((current) => ({ ...current, amount: event.target.value }))} placeholder={L.chantiers.amount} />
                    <input value={expenseForm.location} onChange={(event) => setExpenseForm((current) => ({ ...current, location: event.target.value }))} placeholder={L.chantiers.location} />
                    <input value={expenseForm.notes} onChange={(event) => setExpenseForm((current) => ({ ...current, notes: event.target.value }))} placeholder={L.facturation.note} />
                    <button type="submit">{L.chantiers.addExpense}</button>
                  </form>
                  {linkedExpenses.length > 0 ? (
                    <div className="project-mini-list">
                      {linkedExpenses.slice(0, 4).map((expense) => (
                        <span key={expense.id}>{expense.category}: {expense.label} - {euro(expense.amount)}</span>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : null}
            </article>

            <article className="project-overview-card">
              <button type="button" className="follow-section-head follow-section-head-toggle" onClick={() => toggleCard("rdv")}>
                <h2>{L.chantiers.rdv}</h2>
                <span>{projectEvents.length} RDV</span>
                <CardChevron collapsed={collapsedCards.has("rdv")} />
              </button>
              {!collapsedCards.has("rdv") ? (
                <>
                  <div className="next-rdv-card">
                    <strong>{nextRdv ? nextRdv.title : L.chantiers.noRdv}</strong>
                    <span>{nextRdv ? dateTimeFromEvent(nextRdv) : L.chantiers.noRdvPlanned}</span>
                    <small>{nextRdv?.clientName || ""} {nextRdv?.address ? `- ${nextRdv.address}` : ""}</small>
                  </div>
                  <form className="project-mini-form" onSubmit={addRdv}>
                    <input value={rdvForm.title} onChange={(event) => setRdvForm((current) => ({ ...current, title: event.target.value }))} placeholder={L.chantiers.rdvObject} />
                    <input type="date" value={rdvForm.date} onChange={(event) => setRdvForm((current) => ({ ...current, date: event.target.value }))} />
                    <input type="time" value={rdvForm.time} onChange={(event) => setRdvForm((current) => ({ ...current, time: event.target.value }))} />
                    <input value={rdvForm.contact} onChange={(event) => setRdvForm((current) => ({ ...current, contact: event.target.value }))} placeholder={L.chantiers.contact} />
                    <input value={rdvForm.address} onChange={(event) => setRdvForm((current) => ({ ...current, address: event.target.value }))} placeholder={L.chantiers.address} />
                    <button type="submit">{L.chantiers.add}</button>
                  </form>
                </>
              ) : null}
            </article>

            <article className="project-overview-card">
              <button type="button" className="follow-section-head follow-section-head-toggle" onClick={() => toggleCard("documents")}>
                <h2>{L.chantiers.documents}</h2>
                <span>{linkedDocuments.length + linkedInvoices.length + linkedExpenses.length + (selectedQuote ? 1 : 0)} total</span>
                <CardChevron collapsed={collapsedCards.has("documents")} />
              </button>
              {!collapsedCards.has("documents") ? (
                <>
                  <div className="project-mini-list">
                    {selectedQuote ? <a href={`/api/quotes/${selectedQuote.id}/documents?type=quote&format=pdf`}>Devis {selectedQuote.quoteNumber}</a> : <p>Aucun devis genere.</p>}
                    {linkedInvoices.map((invoice) => <span key={invoice.id}>{invoice.invoiceNumber} - {euro(invoice.amountTtc)}</span>)}
                    {linkedDocuments.map((document) => <span key={document.id}>{document.type}: {document.title}</span>)}
                  </div>
                  <form className="project-mini-form" onSubmit={addDocument}>
                    <input value={documentForm.title} onChange={(event) => setDocumentForm((current) => ({ ...current, title: event.target.value }))} placeholder={L.chantiers.docNameOrPhoto} />
                    <select value={documentForm.type} onChange={(event) => setDocumentForm((current) => ({ ...current, type: event.target.value }))}>
                      {["Document", "Photo", "Facture", "Ticket", "Bon de commande", "Justificatif"].map((type) => <option key={type}>{type}</option>)}
                    </select>
                    <input value={documentForm.category} onChange={(event) => setDocumentForm((current) => ({ ...current, category: event.target.value }))} placeholder={L.chantiers.category} />
                    <input type="number" value={documentForm.amount} onChange={(event) => setDocumentForm((current) => ({ ...current, amount: event.target.value }))} placeholder={L.chantiers.amount} />
                    <input value={documentForm.location} onChange={(event) => setDocumentForm((current) => ({ ...current, location: event.target.value }))} placeholder={L.chantiers.location} />
                    <input value={documentForm.url} onChange={(event) => setDocumentForm((current) => ({ ...current, url: event.target.value }))} placeholder={L.chantiers.fileLink} />
                    <button type="submit">{L.chantiers.linkToProject}</button>
                  </form>
                </>
              ) : null}
            </article>

            <article className="project-overview-card project-archive-card">
              <button type="button" className="follow-section-head follow-section-head-toggle" onClick={() => toggleCard("archive")}>
                <h2>{L.chantiers.archive}</h2>
                <span>{selectedProject.archiveId || linkedArchive ? L.chantiers.archiveCreated : L.chantiers.archivePending}</span>
                <CardChevron collapsed={collapsedCards.has("archive")} />
              </button>
              {!collapsedCards.has("archive") ? (
                <>
                  <p>{L.chantiers.archiveDesc}</p>
                  <div className="archive-action-row">
                    {String(selectedProject.status || "").toLowerCase().includes("termine") ? (
                      <button type="button" className="mini-outline" onClick={() => closeProject("archive")}>{L.chantiers.archiveProject}</button>
                    ) : (
                      <button type="button" className="mini-outline" onClick={() => closeProject("finish")}>{L.chantiers.markFinished}</button>
                    )}
                  </div>
                  {(selectedProject.archiveSummary || linkedArchive?.summary) ? (
                    <div className="archive-summary-grid">
                      {Object.entries(selectedProject.archiveSummary || linkedArchive.summary).filter(([, value]) => typeof value === "number").map(([key, value]) => (
                        <span key={key}><small>{key}</small><strong>{typeof value === "number" ? euro(value) : String(value)}</strong></span>
                      ))}
                    </div>
                  ) : null}
                  {linkedHistory.length > 0 ? (
                    <details className="project-history-details">
                      <summary>{L.chantiers.projectHistory}</summary>
                      {linkedHistory.map((item) => <p key={item.id}>{item.label} - {formatDate(item.createdAt)}</p>)}
                    </details>
                  ) : null}
                </>
              ) : null}
            </article>

            <article className="project-overview-card">
              <button type="button" className="follow-section-head follow-section-head-toggle" onClick={() => toggleCard("marketplace")}>
                <h2>{L.chantiers.marketplace}</h2>
                <span>{selectedProject.marketplace?.published ? L.chantiers.published : L.chantiers.unpublished}</span>
                <CardChevron collapsed={collapsedCards.has("marketplace")} />
              </button>
              {!collapsedCards.has("marketplace") ? (
                selectedProject.marketplace?.published ? (
                  <>
                    <p className="marketplace-own-status">{L.chantiers.marketplacePublic}</p>
                    <button type="button" className="mini-outline" onClick={() => publishMarketplace("unpublish")}>{L.chantiers.unpublishBtn}</button>
                  </>
                ) : (
                  <>
                    <p>{L.chantiers.marketplaceDesc}</p>
                    <textarea
                      className="project-mini-textarea"
                      placeholder={L.chantiers.marketplacePlaceholder}
                      value={marketplaceDesc}
                      onChange={(e) => setMarketplaceDesc(e.target.value)}
                      rows={3}
                    />
                    <button type="button" className="button blue" style={{ marginTop: 8 }} onClick={() => publishMarketplace("publish")}>{L.chantiers.publishBtn}</button>
                  </>
                )
              ) : null}
            </article>
          </section>

          <section className="follow-section">
            <div className="follow-section-head">
              <h2>{L.chantiers.quoteLines}</h2>
              <span>{L.chantiers.lines(trackingLines.length)}</span>
            </div>

            {selectedQuote ? (
              <div className="quote-tracking-summary">
                <a className="quote-tracking-pdf" href={`/api/quotes/${selectedQuote.id}/documents?type=quote&format=pdf`} target="_blank" rel="noreferrer">
                  Devis {selectedQuote.quoteNumber} - PDF
                </a>
                <div className="quote-tracking-dates">
                  <span><small>{L.chantiers.quoteCreated}</small><strong>{formatDate(selectedQuote.quoteDate || selectedQuote.createdAt)}</strong></span>
                  <span><small>{L.chantiers.quoteSent}</small><strong>{formatDate(selectedQuote.sentAt) || "-"}</strong></span>
                  <span><small>{L.chantiers.quoteSigned}</small><strong>{formatDate(selectedQuote.signedAt) || "-"}</strong></span>
                  <span><small>{L.chantiers.quoteSignPlace}</small><strong>{selectedQuote.signaturePlace || "-"}</strong></span>
                </div>
                {selectedQuote.signerMessage ? (
                  <div className="quote-tracking-message">
                    <small>{L.chantiers.clientMessage}</small>
                    <p>{selectedQuote.signerMessage}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {trackingLines.length === 0 ? (
              <div className="tool-empty">{L.chantiers.noQuoteLines}</div>
            ) : (
              <div className="follow-line-list">
                {trackingLines.map((line) => {
                  const item = line.quoteLine || line.task || {};
                  const task = line.task;
                  const expanded = expandedLineKey === line.key;
                  return (
                    <article className={`follow-line follow-line-collapsible${expanded ? " open" : ""}`} key={line.key}>
                      <button
                        type="button"
                        className="follow-line-head"
                        onClick={() => setExpandedLineKey(expanded ? null : line.key)}
                      >
                        <span className={`select-dot ${task?.done ? "selected" : ""}`} onClick={(event) => { event.stopPropagation(); if (task) toggleDone(task); else openPlanner(line); }} />
                        <div className="follow-line-main">
                          <span>{item.room || task?.room || "Chantier"}</span>
                          <strong>{item.label || task?.label}</strong>
                          {task?.pendingValidation ? <em className="follow-line-pending">À valider</em> : null}
                        </div>
                        <CardChevron collapsed={!expanded} />
                      </button>
                      {expanded ? (
                        <div className="follow-line-body">
                          <small>
                            {item.code || task?.code || "Ouvrage"} - {item.quantity || task?.quantity || 1} {item.unit || task?.unit || ""}
                          </small>
                          <small>
                            Equipe: {task?.assignedTo || "Non assignee"} - {formatDate(task?.startDate)} vers {formatDate(task?.endDate || task?.dueDate)}
                          </small>
                          {task?.pendingValidation ? (
                            <small className="follow-line-pending-detail">
                              Termine par {task.completedByName} ({task.completedByType?.toLowerCase()}) le {formatDate(task.finishedAt)}
                            </small>
                          ) : null}
                          {task ? <TaskMessageThread task={task} projectDocuments={projectDocuments} projects={projects} /> : null}
                          <div className="follow-line-actions">
                            <button type="button" className="mini-outline" onClick={() => openPlanner(line)}>
                              {task ? L.chantiers.modify : L.chantiers.plan}
                            </button>
                            {task?.pendingValidation ? (
                              <button type="button" className="mobile-primary" onClick={() => validateTask(task)}>{L.chantiers.validate}</button>
                            ) : task ? (
                              <button type="button" className="mini-outline" onClick={() => toggleDone(task)}>{task.done ? L.chantiers.markNotDone : L.chantiers.markDone}</button>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="follow-section">
            <div className="follow-section-head">
              <h2>{L.chantiers.supplies}</h2>
              <Link href="/fournitures">{L.chantiers.manageSupplies}</Link>
            </div>
            {supplyNeeds.length === 0 ? (
              <div className="tool-empty">{L.chantiers.noSupplies}</div>
            ) : (
              <div className="follow-supply-list">
                {supplyNeeds.map((need, index) => (
                  <article key={`${need.supplyId}-${index}`}>
                    <strong>{need.name}</strong>
                    <span>{need.quantity} {need.unit} - {need.status}</span>
                    <small>{need.taskLabel}</small>
                  </article>
                ))}
              </div>
            )}
          </section>

          {trackingTarget ? (
            <div className="modal-overlay open">
              <div className="tracking-modal">
                <div className="follow-section-head">
                  <h2>{L.chantiers.planModal}</h2>
                  <button type="button" className="mini-danger" onClick={() => setTrackingTarget(null)}>{L.chantiers.close}</button>
                </div>
                <div className="mobile-form-grid">
                  <label>{L.chantiers.startDate}<input type="date" value={planForm.startDate} onChange={(event) => setPlanForm((current) => ({ ...current, startDate: event.target.value }))} /></label>
                  <label>{L.chantiers.endDate}<input type="date" value={planForm.endDate} onChange={(event) => setPlanForm((current) => ({ ...current, endDate: event.target.value }))} /></label>
                </div>
                <h3>{L.chantiers.team}</h3>
                <div className="worker-chip-grid">
                  {workers.length === 0 ? <p className="tool-muted">{L.chantiers.addWorkers}</p> : null}
                  {workers.map((worker) => (
                    <button type="button" className={planForm.workerIds.includes(worker.id) ? "active" : ""} key={worker.id} onClick={() => toggleWorker(worker.id)}>
                      <span>{worker.name}</span>
                      <small>{worker.type || "Ouvrier"} - {worker.profession || worker.role}</small>
                    </button>
                  ))}
                </div>
                <h3>{L.chantiers.missingSupply}</h3>
                <div className="mobile-form-grid">
                  <label>{L.chantiers.supply}<select value={planForm.supplyId} onChange={(event) => setPlanForm((current) => ({ ...current, supplyId: event.target.value }))}>
                    <option value="">{L.chantiers.noShortage}</option>
                    {supplies.map((supply) => <option value={supply.id} key={supply.id}>{supply.name}</option>)}
                  </select></label>
                  <label>{L.chantiers.quantity}<input value={planForm.supplyQuantity} onChange={(event) => setPlanForm((current) => ({ ...current, supplyQuantity: event.target.value }))} placeholder="Ex: 2" /></label>
                  <label className="full">{L.chantiers.note}<input value={planForm.supplyNote} onChange={(event) => setPlanForm((current) => ({ ...current, supplyNote: event.target.value }))} placeholder="Ex: a commander" /></label>
                </div>
                <button type="button" className="mobile-primary" onClick={savePlanning}>{L.chantiers.savePlanning}</button>
              </div>
            </div>
          ) : null}
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mobile-tool chantier-follow">
        <header className="tool-topline compact">
          <button type="button" className="plain-back" onClick={() => (window.history.length > 1 ? window.history.back() : window.location.assign("/"))}>{"<"}</button>
          <h1>{L.chantiers.title}</h1>
          <span />
        </header>

        <Link href="/chantier/new" className="new-chantier-bar">
          <span className="new-chantier-icon">+</span>
          {L.chantiers.newProject}
        </Link>

        <section className="follow-section">
          <div className="follow-section-head">
            <h2>{L.chantiers.tracking}</h2>
            <span>{activeProjects.length}</span>
          </div>
          {activeProjects.length === 0 ? (
            <div className="tool-empty">{L.chantiers.noSigned}</div>
          ) : (
            <div className="project-track-list">
              {activeProjects.map((project) => {
                const quote = quotes.find((item) => item.projectId === project.id);
                return (
                  <button type="button" className="project-track-row" key={project.id} onClick={() => setSelectedProjectId(project.id)}>
                    <span className="home-list-icon">X</span>
                    <div>
                      <strong>{project.title}</strong>
                      <small>{project.client || "Client"} - {project.reference}</small>
                    </div>
                    <em>{project.status}</em>
                    <b>{euro(quote?.totalTtc || project.budgetHt || 0)}</b>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}

