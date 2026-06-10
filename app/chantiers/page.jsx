"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiSend } from "../../lib/client-api";
import { euro, shortDate } from "../../lib/pricing";
import { useApi } from "../../lib/use-api";

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

  const activeProjects = useMemo(() => projects.filter((project) => !isArchived(project)), [projects]);
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
      status: "A faire",
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

  if (selectedProject) {
    return (
      <Shell>
        <div className="mobile-tool chantier-follow">
          <header className="tool-topline compact">
            <button type="button" className="plain-back" onClick={() => setSelectedProjectId("")}>{"<"}</button>
            <div className="follow-title">
              <h1>{selectedProject.title}</h1>
              <p>{selectedProject.client || "Client"} - {selectedProject.status}</p>
            </div>
            <Link className="round-pill" href="/planning">Planning</Link>
          </header>

          {!projectReady ? (
            <div className="tool-message">Le suivi complet s'active apres acceptation du devis par le client.</div>
          ) : null}
          {message ? <div className="tool-message">{message}</div> : null}

          <section className="follow-summary">
            <div>
              <span>Progression</span>
              <strong>{progress}%</strong>
              <i><b style={{ width: `${progress}%` }} /></i>
            </div>
            <div><span>Budget devis</span><strong>{euro(selectedQuote?.totalTtc || selectedProject.budgetHt || 0)}</strong></div>
            <div><span>Debut</span><strong>{formatDate(selectedProject.startDate)}</strong></div>
            <div><span>Fin</span><strong>{formatDate(selectedProject.endDate || selectedProject.dueDate)}</strong></div>
          </section>

          <section className="project-overview-grid">
            <article className="project-overview-card">
              <div className="follow-section-head">
                <h2>Agenda / A faire</h2>
                <span>{upcomingTasks.length} a venir</span>
              </div>
              <form className="project-mini-form" onSubmit={addProjectTask}>
                <input value={taskForm.label} onChange={(event) => setTaskForm((current) => ({ ...current, label: event.target.value }))} placeholder="Nouvelle tache" />
                <input type="date" value={taskForm.dueDate} onChange={(event) => setTaskForm((current) => ({ ...current, dueDate: event.target.value }))} />
                <input value={taskForm.location} onChange={(event) => setTaskForm((current) => ({ ...current, location: event.target.value }))} placeholder="Lieu (optionnel)" />
                <button type="submit">Ajouter</button>
              </form>
              <div className="project-mini-list">
                {upcomingTasks.length === 0 ? <p>Aucune tache a venir.</p> : upcomingTasks.slice(0, 4).map((task) => (
                  <button type="button" key={task.id} onClick={() => toggleDone(task)}>
                    <strong>{task.label}</strong>
                    <span>{formatDate(task.dueDate || task.startDate)} - {task.assignedTo || "Equipe"}</span>
                  </button>
                ))}
              </div>
              {completedTasks.length > 0 ? (
                <details className="project-history-details">
                  <summary>Historique des taches realisees</summary>
                  {completedTasks.slice(0, 6).map((task) => <p key={task.id}>{task.label} - {formatDate(task.updatedAt || task.createdAt)}</p>)}
                </details>
              ) : null}
            </article>

            <article className="project-overview-card">
              <div className="follow-section-head">
                <h2>Budget</h2>
                <span>Total: {euro(budgetTotal.real)} / {euro(budgetTotal.estimated)}</span>
              </div>
              <div className="budget-follow-list">
                {budgetRows.map((row) => {
                  const overBudget = Number(row.real || 0) > Number(row.estimated || 0);
                  return (
                    <div className={`budget-follow-row ${overBudget ? "over-budget" : ""}`} key={row.id}>
                      <strong>{row.label}</strong>
                      <label>Estime<input type="number" value={row.estimated} onChange={(event) => setBudgetValue(row.id, "estimated", event.target.value)} /></label>
                      <label>Reel<input type="number" value={row.real} onChange={(event) => setBudgetValue(row.id, "real", event.target.value)} /></label>
                      <span>{overBudget ? "Depassement" : "OK"}</span>
                    </div>
                  );
                })}
              </div>
              <button type="button" className="mini-outline" onClick={saveBudgetRows}>Enregistrer le budget</button>
              <form className="project-mini-form expense-mini-form" onSubmit={addExpense}>
                <input value={expenseForm.label} onChange={(event) => setExpenseForm((current) => ({ ...current, label: event.target.value }))} placeholder="Depense reelle" />
                <select value={expenseForm.category} onChange={(event) => setExpenseForm((current) => ({ ...current, category: event.target.value }))}>
                  {["Fournitures", "Main d'oeuvre", "Sous-traitance", "Tickets", "Autres frais"].map((category) => <option key={category}>{category}</option>)}
                </select>
                <input type="number" value={expenseForm.amount} onChange={(event) => setExpenseForm((current) => ({ ...current, amount: event.target.value }))} placeholder="Montant" />
                <input value={expenseForm.location} onChange={(event) => setExpenseForm((current) => ({ ...current, location: event.target.value }))} placeholder="Lieu (optionnel)" />
                <input value={expenseForm.notes} onChange={(event) => setExpenseForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Note" />
                <button type="submit">Ajouter depense</button>
              </form>
              {linkedExpenses.length > 0 ? (
                <div className="project-mini-list">
                  {linkedExpenses.slice(0, 4).map((expense) => (
                    <span key={expense.id}>{expense.category}: {expense.label} - {euro(expense.amount)}</span>
                  ))}
                </div>
              ) : null}
            </article>

            <article className="project-overview-card">
              <div className="follow-section-head">
                <h2>Rendez-vous</h2>
                <span>{projectEvents.length} RDV</span>
              </div>
              <div className="next-rdv-card">
                <strong>{nextRdv ? nextRdv.title : "Aucun RDV"}</strong>
                <span>{nextRdv ? dateTimeFromEvent(nextRdv) : "Pas de rendez-vous prevu"}</span>
                <small>{nextRdv?.clientName || ""} {nextRdv?.address ? `- ${nextRdv.address}` : ""}</small>
              </div>
              <form className="project-mini-form" onSubmit={addRdv}>
                <input value={rdvForm.title} onChange={(event) => setRdvForm((current) => ({ ...current, title: event.target.value }))} placeholder="Objet du RDV" />
                <input type="date" value={rdvForm.date} onChange={(event) => setRdvForm((current) => ({ ...current, date: event.target.value }))} />
                <input type="time" value={rdvForm.time} onChange={(event) => setRdvForm((current) => ({ ...current, time: event.target.value }))} />
                <input value={rdvForm.contact} onChange={(event) => setRdvForm((current) => ({ ...current, contact: event.target.value }))} placeholder="Contact" />
                <input value={rdvForm.address} onChange={(event) => setRdvForm((current) => ({ ...current, address: event.target.value }))} placeholder="Adresse" />
                <button type="submit">Ajouter</button>
              </form>
            </article>

            <article className="project-overview-card">
              <div className="follow-section-head">
                <h2>Documents</h2>
                <span>{linkedDocuments.length + linkedInvoices.length + linkedExpenses.length + (selectedQuote ? 1 : 0)} total</span>
              </div>
              <div className="project-mini-list">
                {selectedQuote ? <a href={`/api/quotes/${selectedQuote.id}/documents?type=quote&format=pdf`}>Devis {selectedQuote.quoteNumber}</a> : <p>Aucun devis genere.</p>}
                {linkedInvoices.map((invoice) => <span key={invoice.id}>{invoice.invoiceNumber} - {euro(invoice.amountTtc)}</span>)}
                {linkedDocuments.map((document) => <span key={document.id}>{document.type}: {document.title}</span>)}
              </div>
              <form className="project-mini-form" onSubmit={addDocument}>
                <input value={documentForm.title} onChange={(event) => setDocumentForm((current) => ({ ...current, title: event.target.value }))} placeholder="Nom du document ou photo" />
                <select value={documentForm.type} onChange={(event) => setDocumentForm((current) => ({ ...current, type: event.target.value }))}>
                  {["Document", "Photo", "Facture", "Ticket", "Bon de commande", "Justificatif"].map((type) => <option key={type}>{type}</option>)}
                </select>
                <input value={documentForm.category} onChange={(event) => setDocumentForm((current) => ({ ...current, category: event.target.value }))} placeholder="Categorie" />
                <input type="number" value={documentForm.amount} onChange={(event) => setDocumentForm((current) => ({ ...current, amount: event.target.value }))} placeholder="Montant" />
                <input value={documentForm.location} onChange={(event) => setDocumentForm((current) => ({ ...current, location: event.target.value }))} placeholder="Localisation (optionnel)" />
                <input value={documentForm.url} onChange={(event) => setDocumentForm((current) => ({ ...current, url: event.target.value }))} placeholder="Lien fichier ou photo" />
                <button type="submit">Lier au chantier</button>
              </form>
            </article>

            <article className="project-overview-card project-archive-card">
              <div className="follow-section-head">
                <h2>Archive</h2>
                <span>{selectedProject.archiveId || linkedArchive ? "Creee" : "En attente"}</span>
              </div>
              <p>La cloture regroupe taches, RDV, devis, factures, tickets, photos, documents, depenses et historique.</p>
              <div className="archive-action-row">
                <button type="button" className="mini-outline" onClick={() => closeProject("finish")}>Terminer</button>
                <button type="button" className="mini-outline" onClick={() => closeProject("archive")}>Archiver</button>
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
                  <summary>Historique du chantier</summary>
                  {linkedHistory.map((item) => <p key={item.id}>{item.label} - {formatDate(item.createdAt)}</p>)}
                </details>
              ) : null}
            </article>
          </section>

          <section className="follow-section">
            <div className="follow-section-head">
              <h2>Ouvrages du devis</h2>
              <span>{trackingLines.length} ligne(s)</span>
            </div>
            {trackingLines.length === 0 ? (
              <div className="tool-empty">Aucun ouvrage lie au devis pour le moment.</div>
            ) : (
              <div className="follow-line-list">
                {trackingLines.map((line) => {
                  const item = line.quoteLine || line.task || {};
                  const task = line.task;
                  return (
                    <article className="follow-line" key={line.key}>
                      <button type="button" className={`select-dot ${task?.done ? "selected" : ""}`} onClick={() => task ? toggleDone(task) : openPlanner(line)} />
                      <div className="follow-line-main">
                        <span>{item.room || task?.room || "Chantier"}</span>
                        <strong>{item.label || task?.label}</strong>
                        <small>
                          {item.code || task?.code || "Ouvrage"} - {item.quantity || task?.quantity || 1} {item.unit || task?.unit || ""}
                        </small>
                        <small>
                          Equipe: {task?.assignedTo || "Non assignee"} - {formatDate(task?.startDate)} vers {formatDate(task?.endDate || task?.dueDate)}
                        </small>
                      </div>
                      <button type="button" className="mini-outline" onClick={() => openPlanner(line)}>
                        {task ? "Modifier" : "Planifier"}
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="follow-section">
            <div className="follow-section-head">
              <h2>Fournitures chantier</h2>
              <Link href="/fournitures">Gerer</Link>
            </div>
            {supplyNeeds.length === 0 ? (
              <div className="tool-empty">Aucun manque de fourniture signale.</div>
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
                  <h2>Planifier l'ouvrage</h2>
                  <button type="button" className="mini-danger" onClick={() => setTrackingTarget(null)}>Fermer</button>
                </div>
                <div className="mobile-form-grid">
                  <label>Date de debut<input type="date" value={planForm.startDate} onChange={(event) => setPlanForm((current) => ({ ...current, startDate: event.target.value }))} /></label>
                  <label>Date de fin<input type="date" value={planForm.endDate} onChange={(event) => setPlanForm((current) => ({ ...current, endDate: event.target.value }))} /></label>
                </div>
                <h3>Equipe</h3>
                <div className="worker-chip-grid">
                  {workers.length === 0 ? <p className="tool-muted">Ajoutez d'abord des ouvriers ou sous-traitants dans Equipe.</p> : null}
                  {workers.map((worker) => (
                    <button type="button" className={planForm.workerIds.includes(worker.id) ? "active" : ""} key={worker.id} onClick={() => toggleWorker(worker.id)}>
                      <span>{worker.name}</span>
                      <small>{worker.type || "Ouvrier"} - {worker.profession || worker.role}</small>
                    </button>
                  ))}
                </div>
                <h3>Fourniture manquante</h3>
                <div className="mobile-form-grid">
                  <label>Fourniture<select value={planForm.supplyId} onChange={(event) => setPlanForm((current) => ({ ...current, supplyId: event.target.value }))}>
                    <option value="">Aucun manque</option>
                    {supplies.map((supply) => <option value={supply.id} key={supply.id}>{supply.name}</option>)}
                  </select></label>
                  <label>Quantite<input value={planForm.supplyQuantity} onChange={(event) => setPlanForm((current) => ({ ...current, supplyQuantity: event.target.value }))} placeholder="Ex: 2" /></label>
                  <label className="full">Note<input value={planForm.supplyNote} onChange={(event) => setPlanForm((current) => ({ ...current, supplyNote: event.target.value }))} placeholder="Ex: a commander pendant le chantier" /></label>
                </div>
                <button type="button" className="mobile-primary" onClick={savePlanning}>Enregistrer le suivi</button>
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
          <h1>Chantiers</h1>
          <Link className="round-dark" href="/chantier/new" aria-label="Creer un chantier">+</Link>
        </header>

        <section className="follow-section">
          <div className="follow-section-head">
            <h2>Suivi des chantiers</h2>
            <span>{activeProjects.length} chantier(s)</span>
          </div>
          {activeProjects.length === 0 ? (
            <div className="tool-empty">Aucun chantier accepte pour le moment.</div>
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

