"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiGet, apiSend, readStoredUser } from "../../lib/client-api";
import { useLocale } from "../../lib/i18n";
import { euro, shortDate } from "../../lib/pricing";
import { useApi } from "../../lib/use-api";

function TaskMessageThread({ task, projectDocuments, workers }) {
  const { L } = useLocale();
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replyFile, setReplyFile] = useState(null);
  const [replyUrl, setReplyUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [localDocs, setLocalDocs] = useState(null);
  const fileRef = useRef(null);

  const [noteText, setNoteText] = useState("");
  const [noteAudience, setNoteAudience] = useState("both");
  const [noteWorkerIds, setNoteWorkerIds] = useState(() => task.workerIds || []);
  const [sendingNote, setSendingNote] = useState(false);

  const assignedWorkers = (workers || []).filter((worker) => (task.workerIds || []).includes(worker.id));

  function toggleNoteWorker(workerId) {
    setNoteWorkerIds((current) => current.includes(workerId)
      ? current.filter((id) => id !== workerId)
      : [...current, workerId]);
  }

  const allDocs = localDocs || projectDocuments.filter(
    (d) => ["client", "company"].includes(d.source) && d.taskId === task.id
  );

  const clientNotes = allDocs.filter((d) => d.source === "client");
  const companyNotes = allDocs.filter((d) => d.source === "company" && !d.replyToId);

  function readCurrentUserId() {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem("koji-user") : null;
    return raw ? (JSON.parse(raw).id || "") : "";
  }

  async function sendNote() {
    if (!noteText.trim()) return;
    setSendingNote(true);
    try {
      const r = await fetch("/api/task-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: readCurrentUserId(), taskId: task.id, message: noteText, audience: noteAudience, workerIds: noteWorkerIds })
      });
      if (r.ok) {
        const data = await r.json();
        setLocalDocs([data.document, ...allDocs]);
        setNoteText("");
      }
    } finally { setSendingNote(false); }
  }

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
    try {
      const r = await fetch("/api/task-replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: readCurrentUserId(),
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

      {companyNotes.map((note) => (
        <div className="follow-company-note" key={note.id}>
          <div className="follow-client-note-head">
            <span className="archive-document-type reply-badge">{L.chantiers.noteSentTo(note.audience)}</span>
            <strong>{note.senderName || "Entreprise"}</strong>
            <small>{note.createdAt ? shortDate(note.createdAt) : ""}</small>
          </div>
          {note.notes ? <p>{note.notes}</p> : null}
        </div>
      ))}

      <div className="follow-note-composer">
        <span className="follow-client-notes-label">{L.chantiers.noteComposer}</span>
        <textarea
          id="ouvrage-note-composer"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder={L.chantiers.notePlaceholder}
          rows={2}
        />
        <div className="follow-note-audience">
          <button type="button" className={noteAudience === "client" ? "active" : ""} onClick={() => setNoteAudience("client")}>{L.chantiers.audienceClient}</button>
          <button type="button" className={noteAudience === "workers" ? "active" : ""} onClick={() => setNoteAudience("workers")}>{L.chantiers.audienceWorkers}</button>
          <button type="button" className={noteAudience === "both" ? "active" : ""} onClick={() => setNoteAudience("both")}>{L.chantiers.audienceBoth}</button>
        </div>
        {(noteAudience === "workers" || noteAudience === "both") ? (
          <div className="follow-note-workers">
            <span className="follow-client-notes-label">{L.chantiers.noteWorkersLabel}</span>
            {assignedWorkers.length === 0 ? <p className="tool-muted">{L.chantiers.noteNoWorkers}</p> : null}
            <div className="follow-note-worker-chips">
              {assignedWorkers.map((worker) => (
                <button
                  type="button"
                  key={worker.id}
                  className={noteWorkerIds.includes(worker.id) ? "active" : ""}
                  onClick={() => toggleNoteWorker(worker.id)}
                >
                  {worker.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <button
          type="button"
          className="mobile-primary"
          disabled={sendingNote || !noteText.trim()}
          onClick={sendNote}
        >
          {sendingNote ? L.chantiers.sending : L.chantiers.sendNote}
        </button>
      </div>
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

function quoteDocumentUrl(quoteId) {
  const token = readStoredUser()?.accessToken || "";
  return `/api/quotes/${quoteId}/documents?type=quote&format=pdf&accessToken=${encodeURIComponent(token)}`;
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
  rdvType: "",
  rdvReason: "",
  rdvDate: "",
  rdvTime: "",
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
  const router = useRouter();
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
  const [startChoiceMade, setStartChoiceMade] = useState(false);
  const [trackingTarget, setTrackingTarget] = useState(null);
  const [planForm, setPlanForm] = useState(emptyPlan);
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [rdvForm, setRdvForm] = useState(emptyRdvForm);
  const [documentForm, setDocumentForm] = useState(emptyDocumentForm);
  const [expenseForm, setExpenseForm] = useState(emptyExpenseForm);
  const [budgetDraft, setBudgetDraft] = useState(null);
  const [message, setMessage] = useState("");
  const [collapsedCards, setCollapsedCards] = useState(() => new Set(["agenda", "budget", "rdv", "documents", "archive"]));
  const [openLineKey, setOpenLineKey] = useState(null);
  const [clientPortalAccess, setClientPortalAccess] = useState(null);
  const [ouvrageExpenseForm, setOuvrageExpenseForm] = useState(emptyExpenseForm);
  const [ouvrageAddOpen, setOuvrageAddOpen] = useState(false);
  const [ouvrageAddTab, setOuvrageAddTab] = useState("team");
  const [quickAddWorkerIds, setQuickAddWorkerIds] = useState([]);

  function toggleCard(key) {
    setCollapsedCards((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Restores exactly where the user was (chantier / ouvrage / past the "start
  // choice" screen) after a page refresh, since that state only ever lived in
  // memory before. Runs once on mount; the sync effect below keeps the URL
  // up to date afterwards so a refresh always has something to restore from.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get("project");
    const lineKey = params.get("line");
    if (projectId) setSelectedProjectId(projectId);
    if (lineKey) setOpenLineKey(lineKey);
    if (params.get("started") === "1") setStartChoiceMade(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (selectedProjectId) params.set("project", selectedProjectId);
    if (openLineKey) params.set("line", openLineKey);
    if (startChoiceMade) params.set("started", "1");
    const query = params.toString();
    window.history.replaceState(null, "", query ? `/chantiers?${query}` : "/chantiers");
  }, [selectedProjectId, openLineKey, startChoiceMade]);

  function selectProject(projectId) {
    setStartChoiceMade(false);
    setOpenLineKey(null);
    setSelectedProjectId(projectId);
  }

  function backToList() {
    setSelectedProjectId("");
    setOpenLineKey(null);
    setStartChoiceMade(false);
  }

  useEffect(() => {
    if (!selectedProjectId) { setClientPortalAccess(null); return; }
    apiGet(`/api/client-portal-info?projectId=${encodeURIComponent(selectedProjectId)}`)
      .then((data) => setClientPortalAccess(data.access || null))
      .catch(() => setClientPortalAccess(null));
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) return;
    setCollapsedCards(new Set(["agenda", "budget", "rdv", "documents", "archive"]));
  }, [selectedProjectId]);

  // All non-archived chantiers, regardless of quote/signature status — used to
  // resolve which chantier is open, so a chantier can be viewed/edited before
  // its devis is signed (not just for the signed-only tracking list below).
  const nonArchivedProjects = useMemo(() => projects.filter((project) => !isArchived(project)), [projects]);
  // Signed-only subset, for the "Suivi des chantiers" tracking list/count.
  const activeProjects = useMemo(() => {
    return nonArchivedProjects.filter((project) => {
      const linkedQuote = quotes.find((q) => q.projectId === project.id);
      if (!linkedQuote) return false;
      return linkedQuote.status === "Signe" || linkedQuote.signatureStatus === "Signe";
    });
  }, [nonArchivedProjects, quotes]);
  // Most recently touched not-yet-sent devis: lets the user resume a
  // chantier/devis they started and left mid-way (app closed, interrupted...).
  const draftQuote = useMemo(() => {
    return quotes
      .filter((quote) => quote.status === "Brouillon")
      .sort((a, b) => String(b.updatedAt || b.createdAtIso || "").localeCompare(String(a.updatedAt || a.createdAtIso || "")))[0] || null;
  }, [quotes]);
  const selectedProject = nonArchivedProjects.find((project) => project.id === selectedProjectId) || null;
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

  const chantierSpentAuto = useMemo(
    () => linkedExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
    [linkedExpenses]
  );
  const chantierMarginAuto = useMemo(() => {
    const total = Number(selectedQuote?.totalHt || selectedQuote?.totalTtc || selectedProject?.budgetHt || 0);
    return total - chantierSpentAuto;
  }, [selectedQuote, selectedProject, chantierSpentAuto]);

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

  // Reopens the "Planifier l'ouvrage" modal on the exact same line after a
  // round trip to Équipe (see goToTeamAndReturn / koji-team-return).
  const reopenLineHandledRef = useRef(false);
  useEffect(() => {
    if (reopenLineHandledRef.current || typeof window === "undefined") return;
    const lineKey = new URLSearchParams(window.location.search).get("reopenLine");
    if (!lineKey || !trackingLines.length) return;
    const line = trackingLines.find((item) => item.key === lineKey);
    if (!line) return;
    reopenLineHandledRef.current = true;
    openPlanner(line);
  }, [trackingLines]); // eslint-disable-line react-hooks/exhaustive-deps

  const openLine = trackingLines.find((line) => line.key === openLineKey) || null;

  // Notes, status and expenses all key off a real task record. Rather than
  // gating those features behind clicking "Planifier" first, silently create
  // a bare task the moment the ouvrage fiche is opened, so they're usable
  // right away — "Planifier" still works the same, it just updates it.
  const ensuringTaskRef = useRef(new Set());
  useEffect(() => {
    if (!openLine || openLine.task || !selectedProject) return;
    if (ensuringTaskRef.current.has(openLine.key)) return;
    ensuringTaskRef.current.add(openLine.key);
    const quoteLine = openLine.quoteLine || {};
    apiSend("/api/tasks", {
      label: quoteLine.label || "Ouvrage",
      project: selectedProject.title,
      projectId: selectedProject.id,
      quoteId: selectedQuote?.id || "",
      quoteItemId: openLine.key,
      code: quoteLine.code || "",
      room: quoteLine.room || "Chantier",
      unit: quoteLine.unit || "",
      quantity: Number(quoteLine.quantity || 0),
      durationHours: Number(quoteLine.correctedTimeHours || quoteLine.normativeTime || 1),
      workerIds: [],
      assignedTo: "",
      participantType: "Ouvriers",
      status: "À faire"
    }).then(({ task }) => {
      setTasks((current) => [task, ...current]);
    }).catch(() => {
      ensuringTaskRef.current.delete(openLine.key);
    });
  }, [openLine, selectedProject, selectedQuote]); // eslint-disable-line react-hooks/exhaustive-deps

  const supplyNeeds = useMemo(() => {
    return projectTasks.flatMap((task) => (task.supplyNeeds || []).map((need) => ({ ...need, taskLabel: task.label })));
  }, [projectTasks]);

  const doneCount = projectTasks.filter((task) => task.done).length;
  const progress = projectTasks.length === 0 ? Number(selectedProject?.progress || 0) : Math.round((doneCount / projectTasks.length) * 100);
  const projectReady = selectedProject ? isReadyForTracking(selectedProject) : false;
  const quoteSigned = selectedQuote ? (selectedQuote.status === "Signe" || selectedQuote.signatureStatus === "Signe") : false;

  function openPlanner(line) {
    const need = line.task?.supplyNeeds?.[0] || {};
    setTrackingTarget(line);
    setPlanForm({
      startDate: line.task?.startDate || "",
      endDate: line.task?.endDate || line.task?.dueDate || "",
      workerIds: line.task?.workerIds || [],
      rdvType: "",
      rdvReason: "",
      rdvDate: "",
      rdvTime: "",
      supplyId: need.supplyId || "",
      supplyQuantity: need.quantity || "",
      supplyNote: need.note || ""
    });
    setMessage("");
  }

  function goToTeamAndReturn() {
    if (!trackingTarget || !selectedProjectId) return;
    window.sessionStorage.setItem("koji-team-return", JSON.stringify({
      projectId: selectedProjectId,
      lineKey: trackingTarget.key
    }));
    router.push("/equipe");
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

    let savedTask;
    if (trackingTarget.task) {
      const { task } = await apiSend("/api/tasks", { id: trackingTarget.task.id, ...payload }, "PATCH");
      savedTask = task;
      const nextTasks = tasks.map((item) => item.id === task.id ? task : item);
      setTasks(nextTasks);
      await refreshProjectProgress(nextTasks);
    } else {
      const { task } = await apiSend("/api/tasks", payload);
      savedTask = task;
      const nextTasks = [task, ...tasks];
      setTasks(nextTasks);
      await refreshProjectProgress(nextTasks);
    }

    if (planForm.rdvType && planForm.rdvDate) {
      const startAt = `${planForm.rdvDate}T${planForm.rdvTime || "09:00"}:00`;
      const rdvTitle = planForm.rdvType === "devis" ? L.chantiers.rdvReasonQuote : (planForm.rdvReason || L.chantiers.rdvReasonOther);
      const { calendarEvent } = await apiSend("/api/calendar-events", {
        title: `${rdvTitle} - ${savedTask.label}`,
        eventType: planForm.rdvType === "devis" ? "Devis" : "Chantier",
        projectId: selectedProject.id,
        projectTitle: selectedProject.title,
        clientName: selectedProject.client || "",
        address: selectedProject.address || "",
        startAt,
        endAt: startAt,
        status: "Planifie"
      });
      setCalendarEvents([calendarEvent, ...calendarEvents]);
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

  function ouvrageStatusKey(task) {
    if (!task) return "debut";
    if (task.done) return "valide";
    if (task.pendingValidation) return "termine";
    if (String(task.status || "").toLowerCase().includes("cours")) return "encours";
    return "debut";
  }

  async function setOuvrageStatus(task, key) {
    if (!task) return;
    if (key === "valide") return validateTask(task);
    const patch = key === "encours"
      ? { status: "En cours", done: false, pendingValidation: false }
      : key === "termine"
        ? { status: "Terminee (a valider)", done: false, pendingValidation: true }
        : { status: "À faire", done: false, pendingValidation: false };
    const { task: updatedTask } = await apiSend("/api/tasks", { id: task.id, ...patch }, "PATCH");
    const nextTasks = tasks.map((item) => item.id === updatedTask.id ? updatedTask : item);
    setTasks(nextTasks);
    await refreshProjectProgress(nextTasks);
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

  function openQuickAdd() {
    setQuickAddWorkerIds(openLine?.task?.workerIds || []);
    setOuvrageAddTab("team");
    setOuvrageAddOpen(true);
  }

  function toggleQuickAddWorker(workerId) {
    setQuickAddWorkerIds((current) => current.includes(workerId)
      ? current.filter((id) => id !== workerId)
      : [...current, workerId]);
  }

  async function saveQuickAddTeam() {
    const task = openLine?.task;
    if (!task) return;
    const selectedWorkers = workers.filter((worker) => quickAddWorkerIds.includes(worker.id));
    const { task: updatedTask } = await apiSend("/api/tasks", {
      id: task.id,
      workerIds: quickAddWorkerIds,
      assignedTo: selectedWorkers.map((worker) => worker.name).join(", ") || "Equipe",
      participantType: selectedWorkers.some((worker) => worker.type === "Sous-traitant") ? "Sous-traitants" : "Ouvriers"
    }, "PATCH");
    setTasks((current) => current.map((item) => item.id === updatedTask.id ? updatedTask : item));
    setMessage("Equipe mise a jour sur l'ouvrage.");
    setOuvrageAddOpen(false);
  }

  async function addOuvrageExpense(event) {
    event.preventDefault();
    const task = openLine?.task;
    if (!selectedProject || !task || !ouvrageExpenseForm.label.trim() || Number(ouvrageExpenseForm.amount || 0) <= 0) return;
    const { expense } = await apiSend("/api/expenses", {
      projectId: selectedProject.id,
      quoteId: selectedQuote?.id || "",
      taskId: task.id,
      label: ouvrageExpenseForm.label,
      category: ouvrageExpenseForm.category,
      amount: ouvrageExpenseForm.amount,
      location: ouvrageExpenseForm.location,
      notes: ouvrageExpenseForm.notes
    });
    setExpenses([expense, ...expenses]);
    setOuvrageExpenseForm(emptyExpenseForm);
    setMessage("Depense ajoutee a l'ouvrage.");
    setOuvrageAddOpen(false);
  }

  function goToNoteComposer() {
    setOuvrageAddOpen(false);
    requestAnimationFrame(() => {
      const el = document.getElementById("ouvrage-note-composer");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus();
      }
    });
  }

  async function closeProject(action) {
    if (!selectedProject) return;
    const { project } = await apiSend("/api/projects", { id: selectedProject.id, action }, "PATCH");
    setProjects(projects.map((item) => item.id === project.id ? project : item));
    setMessage(action === "finish" ? "Chantier termine et archive creee." : "Chantier archive avec son historique.");
  }

  const planningModal = trackingTarget ? (
    <div className="modal-overlay open">
      <div className="tracking-modal">
        <div className="follow-section-head">
          <h2>{L.chantiers.planModal}</h2>
          <button type="button" className="mini-danger" onClick={() => setTrackingTarget(null)}>{L.chantiers.close}</button>
        </div>
        <div className="follow-section-head">
          <h3>{L.chantiers.team}</h3>
          <button type="button" className="mini-outline" onClick={goToTeamAndReturn}>{L.chantiers.goToTeam}</button>
        </div>
        <div className="worker-chip-grid">
          {workers.length === 0 ? <p className="tool-muted">{L.chantiers.addWorkers}</p> : null}
          {workers.map((worker) => (
            <button type="button" className={planForm.workerIds.includes(worker.id) ? "active" : ""} key={worker.id} onClick={() => toggleWorker(worker.id)}>
              <span>{worker.name}</span>
              <small>{worker.type || "Ouvrier"} - {worker.profession || worker.role}</small>
            </button>
          ))}
        </div>
        <div className="mobile-form-grid">
          <label>{L.chantiers.startDate}<input type="date" value={planForm.startDate} onChange={(event) => setPlanForm((current) => ({ ...current, startDate: event.target.value }))} /></label>
          <label>{L.chantiers.endDate}<input type="date" value={planForm.endDate} onChange={(event) => setPlanForm((current) => ({ ...current, endDate: event.target.value }))} /></label>
        </div>
        <h3>{L.chantiers.rdvOptional}</h3>
        <div className="mobile-form-grid">
          <label>{L.chantiers.rdvType}<select value={planForm.rdvType} onChange={(event) => setPlanForm((current) => ({ ...current, rdvType: event.target.value }))}>
            <option value="">{L.chantiers.noRdv}</option>
            <option value="devis">{L.chantiers.rdvReasonQuote}</option>
            <option value="autres">{L.chantiers.rdvReasonOther}</option>
          </select></label>
          {planForm.rdvType === "autres" ? (
            <label>{L.chantiers.rdvReasonOther}<input value={planForm.rdvReason} onChange={(event) => setPlanForm((current) => ({ ...current, rdvReason: event.target.value }))} placeholder={L.chantiers.rdvReasonPlaceholder} /></label>
          ) : null}
          {planForm.rdvType ? (
            <label className="full">{L.chantiers.rdvWhen}
              <div className="url-fetch-row">
                <input type="date" value={planForm.rdvDate} onChange={(event) => setPlanForm((current) => ({ ...current, rdvDate: event.target.value }))} />
                <input type="time" value={planForm.rdvTime} onChange={(event) => setPlanForm((current) => ({ ...current, rdvTime: event.target.value }))} />
              </div>
            </label>
          ) : null}
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
  ) : null;

  if (selectedProject && openLine) {
    const item = openLine.quoteLine || openLine.task || {};
    const task = openLine.task;
    const statusKey = ouvrageStatusKey(task);
    const statusSteps = [
      { key: "debut", label: L.chantiers.statusStart },
      { key: "encours", label: L.chantiers.statusInProgress },
      { key: "termine", label: L.chantiers.statusFinished },
      { key: "valide", label: L.chantiers.statusValidated }
    ];
    const statusIndex = statusSteps.findIndex((step) => step.key === statusKey);
    const ouvragePriceHt = Number(item.totalHt || item.totalTtc || 0);
    const taskExpenses = task ? expenses.filter((expense) => expense.taskId === task.id) : [];
    const ouvrageSpentTotal = taskExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const ouvrageProfit = ouvragePriceHt - ouvrageSpentTotal;

    return (
      <Shell>
        <section className="mobile-tool tool-form-view ouvrage-fiche">
          <header className="tool-topline compact">
            <button type="button" className="plain-back" onClick={() => setOpenLineKey(null)}>{"<"}</button>
            <div className="follow-title">
              <h1>{item.label || task?.label}</h1>
              <p>{item.room || task?.room || "Chantier"}</p>
            </div>
            <span />
          </header>

          <div className="ouvrage-fiche-body">
            <div className="ouvrage-info-card">
              <div>
                <span>{item.code || task?.code || "Ouvrage"}</span>
                <strong>{item.quantity || task?.quantity || 1} {item.unit || task?.unit || ""}</strong>
              </div>
              <div>
                <span>{L.chantiers.team}</span>
                <strong>{task?.assignedTo || L.chantiers.notAssigned}</strong>
              </div>
              <div>
                <span>{L.chantiers.startDate} → {L.chantiers.endDate}</span>
                <strong>{formatDate(task?.startDate)} → {formatDate(task?.endDate || task?.dueDate)}</strong>
              </div>
              {ouvragePriceHt > 0 ? (
                <div>
                  <span>{L.chantiers.validatedPrice}</span>
                  <strong>{euro(ouvragePriceHt)}</strong>
                </div>
              ) : null}
            </div>

            {task ? (
              <div className="ouvrage-status-stepper">
                {statusSteps.map((step, index) => (
                  <button
                    type="button"
                    key={step.key}
                    className={`ouvrage-status-step${index <= statusIndex ? " done" : ""}${step.key === statusKey ? " current" : ""}`}
                    onClick={() => setOuvrageStatus(task, step.key)}
                  >
                    <i />
                    <span>{step.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="tool-muted">{L.chantiers.notPlannedYet}</p>
            )}

            {task?.pendingValidation && task.completedByName ? (
              <small className="follow-line-pending-detail">
                Termine par {task.completedByName} ({task.completedByType?.toLowerCase()}) le {formatDate(task.finishedAt)}
              </small>
            ) : null}

            <div className="ouvrage-action-row">
              <button type="button" className="button blue ouvrage-plan-btn" onClick={() => openPlanner(openLine)}>
                {L.chantiers.plan}
              </button>
              {task ? (
                <button type="button" className="button ouvrage-quickadd-btn" onClick={openQuickAdd}>
                  {L.chantiers.quickAddBtn}
                </button>
              ) : null}
            </div>

            {task && ouvragePriceHt > 0 ? (
              <div className="ouvrage-finance-card">
                <div>
                  <span>{L.chantiers.validatedPrice}</span>
                  <strong>{euro(ouvragePriceHt)}</strong>
                </div>
                <div>
                  <span>{L.chantiers.ouvrageSpent}</span>
                  <strong>{euro(ouvrageSpentTotal)}</strong>
                </div>
                <div>
                  <span>{L.chantiers.ouvrageEarned}</span>
                  <strong className={ouvrageProfit >= 0 ? "positive" : "negative"}>{euro(ouvrageProfit)}</strong>
                </div>
              </div>
            ) : null}

            {task && taskExpenses.length > 0 ? (
              <div className="project-mini-list ouvrage-expense-list">
                <span className="follow-client-notes-label">{L.chantiers.ouvrageExpenses}</span>
                {taskExpenses.map((expense) => (
                  <span key={expense.id}>{expense.category}: {expense.label} - {euro(expense.amount)}</span>
                ))}
              </div>
            ) : null}

            {task ? <TaskMessageThread task={task} projectDocuments={projectDocuments} workers={workers} /> : null}
          </div>
        </section>
        {planningModal}

        {ouvrageAddOpen ? (
          <div className="qa-overlay" onClick={() => setOuvrageAddOpen(false)}>
            <div className="qa-modal" onClick={(event) => event.stopPropagation()}>
              <div className="qa-header">
                <strong>{L.chantiers.quickAddTitle}</strong>
                <button type="button" className="qa-close" onClick={() => setOuvrageAddOpen(false)} aria-label={L.common.close}>✕</button>
              </div>
              <div className="qa-tabs">
                <button type="button" className={`qa-tab${ouvrageAddTab === "team" ? " active" : ""}`} onClick={() => setOuvrageAddTab("team")}>
                  <span>👷</span><span>{L.chantiers.quickAddTeam}</span>
                </button>
                <button type="button" className={`qa-tab${ouvrageAddTab === "expense" ? " active" : ""}`} onClick={() => setOuvrageAddTab("expense")}>
                  <span>💶</span><span>{L.chantiers.quickAddExpense}</span>
                </button>
                <button type="button" className={`qa-tab${ouvrageAddTab === "note" ? " active" : ""}`} onClick={() => setOuvrageAddTab("note")}>
                  <span>💬</span><span>{L.chantiers.quickAddNote}</span>
                </button>
              </div>

              {ouvrageAddTab === "team" ? (
                <div className="qa-form">
                  <p className="tool-muted">{L.chantiers.quickAddTeamHint}</p>
                  <div className="worker-chip-grid">
                    {workers.length === 0 ? <p className="tool-muted">{L.chantiers.addWorkers}</p> : null}
                    {workers.map((worker) => (
                      <button
                        type="button"
                        key={worker.id}
                        className={quickAddWorkerIds.includes(worker.id) ? "active" : ""}
                        onClick={() => toggleQuickAddWorker(worker.id)}
                      >
                        <span>{worker.name}</span>
                        <small>{worker.type || "Ouvrier"} - {worker.profession || worker.role}</small>
                      </button>
                    ))}
                  </div>
                  <div className="qa-actions">
                    <button type="button" className="qa-cancel" onClick={() => setOuvrageAddOpen(false)}>{L.common.cancel}</button>
                    <button type="button" className="qa-submit" onClick={saveQuickAddTeam}>{L.chantiers.quickAddSaveTeam}</button>
                  </div>
                </div>
              ) : null}

              {ouvrageAddTab === "expense" ? (
                <form className="qa-form" onSubmit={addOuvrageExpense}>
                  <div className="qa-field">
                    <label className="qa-label">{L.chantiers.realExpense}</label>
                    <input className="qa-input" value={ouvrageExpenseForm.label} onChange={(event) => setOuvrageExpenseForm((current) => ({ ...current, label: event.target.value }))} placeholder={L.chantiers.realExpense} />
                  </div>
                  <div className="qa-row">
                    <div className="qa-field">
                      <label className="qa-label">{L.chantiers.amount}</label>
                      <input className="qa-input" type="number" step="0.01" min="0.01" value={ouvrageExpenseForm.amount} onChange={(event) => setOuvrageExpenseForm((current) => ({ ...current, amount: event.target.value }))} placeholder="0,00" />
                    </div>
                    <div className="qa-field">
                      <label className="qa-label">{L.chantiers.category}</label>
                      <select className="qa-input" value={ouvrageExpenseForm.category} onChange={(event) => setOuvrageExpenseForm((current) => ({ ...current, category: event.target.value }))}>
                        {["Fournitures", "Main d'oeuvre", "Sous-traitance", "Tickets", "Autres frais"].map((category) => <option key={category}>{category}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="qa-field">
                    <label className="qa-label">{L.chantiers.location}</label>
                    <input className="qa-input" value={ouvrageExpenseForm.location} onChange={(event) => setOuvrageExpenseForm((current) => ({ ...current, location: event.target.value }))} placeholder={L.chantiers.location} />
                  </div>
                  <div className="qa-field">
                    <label className="qa-label">{L.facturation.note}</label>
                    <textarea className="qa-input qa-textarea" rows={2} value={ouvrageExpenseForm.notes} onChange={(event) => setOuvrageExpenseForm((current) => ({ ...current, notes: event.target.value }))} />
                  </div>
                  <div className="qa-actions">
                    <button type="button" className="qa-cancel" onClick={() => setOuvrageAddOpen(false)}>{L.common.cancel}</button>
                    <button type="submit" className="qa-submit">{L.chantiers.addExpense}</button>
                  </div>
                </form>
              ) : null}

              {ouvrageAddTab === "note" ? (
                <div className="qa-form">
                  <p className="tool-muted">{L.chantiers.quickAddNoteHint}</p>
                  <div className="qa-actions">
                    <button type="button" className="qa-cancel" onClick={() => setOuvrageAddOpen(false)}>{L.common.cancel}</button>
                    <button type="button" className="qa-submit" onClick={goToNoteComposer}>{L.chantiers.quickAddGoToNote}</button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </Shell>
    );
  }

  if (selectedProject && selectedQuote && !quoteSigned && !startChoiceMade) {
    return (
      <Shell>
        <div className="mobile-tool chantier-follow">
          <header className="tool-topline compact">
            <button type="button" className="plain-back" onClick={backToList}>{"<"}</button>
            <div className="follow-title">
              <h1>{selectedProject.title}</h1>
              <p>{selectedProject.client || L.chantiers.contact} - {selectedProject.status}</p>
            </div>
            <span />
          </header>
          <div className="start-choice-card">
            <p>{L.chantiers.startChoiceIntro}</p>
            <button type="button" className="button blue" onClick={() => router.push(`/devis?id=${selectedQuote.id}`)}>
              {L.chantiers.startChoiceEditQuote}
            </button>
            <button type="button" className="button" onClick={() => setStartChoiceMade(true)}>
              {L.chantiers.startChoiceBeginSite}
            </button>
          </div>
        </div>
      </Shell>
    );
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
            <button type="button" className="plain-back" onClick={backToList}>{"<"}</button>
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
                  <div className="ouvrage-finance-card chantier-finance-auto">
                    <div>
                      <span>{L.chantiers.autoSpentChantier}</span>
                      <strong>{euro(chantierSpentAuto)}</strong>
                    </div>
                    <div>
                      <span>{L.chantiers.autoMarginChantier}</span>
                      <strong className={chantierMarginAuto >= 0 ? "positive" : "negative"}>{euro(chantierMarginAuto)}</strong>
                    </div>
                  </div>
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
                    {selectedQuote ? <a href={quoteDocumentUrl(selectedQuote.id)}>Devis {selectedQuote.quoteNumber}</a> : <p>Aucun devis genere.</p>}
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

          </section>

          <section className="follow-section">
            <div className="follow-section-head">
              <h2>{L.chantiers.quoteLines}</h2>
              <span>{L.chantiers.lines(trackingLines.length)}</span>
            </div>

            {selectedQuote ? (
              <div className="quote-tracking-summary">
                <a className="quote-tracking-pdf" href={quoteDocumentUrl(selectedQuote.id)} target="_blank" rel="noreferrer">
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
                  return (
                    <article
                      className="follow-line clickable"
                      key={line.key}
                      role="button"
                      tabIndex={0}
                      onClick={() => setOpenLineKey(line.key)}
                      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setOpenLineKey(line.key); } }}
                    >
                      <span className={`select-dot ${task?.done ? "selected" : ""}`} onClick={(event) => { event.stopPropagation(); if (task) toggleDone(task); else openPlanner(line); }} />
                      <div className="follow-line-main">
                        <span>{item.room || task?.room || "Chantier"}</span>
                        <strong>{item.label || task?.label}</strong>
                        {task ? (
                          <small>Equipe: {task.assignedTo || "Non assignee"} - {formatDate(task.startDate)} vers {formatDate(task.endDate || task.dueDate)}</small>
                        ) : null}
                        {task?.pendingValidation ? <em className="follow-line-pending">À valider</em> : null}
                      </div>
                      <button type="button" className="mini-outline" onClick={(event) => { event.stopPropagation(); openPlanner(line); }}>
                        {L.chantiers.plan}
                      </button>
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

          <section className="follow-section project-archive-card">
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
          </section>

          {planningModal}
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

        {draftQuote ? (
          <Link href={`/devis?id=${draftQuote.id}`} className="resume-draft-card">
            <div>
              <strong>{L.chantiers.finishSite}</strong>
              <small>{draftQuote.client || draftQuote.project || draftQuote.quoteNumber}</small>
            </div>
            <span>→</span>
          </Link>
        ) : null}

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
                  <button type="button" className="project-track-row" key={project.id} onClick={() => selectProject(project.id)}>
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

