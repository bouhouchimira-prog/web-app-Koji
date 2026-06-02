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

export default function ProjectsTrackingPage() {
  const { data: projects, setData: setProjects } = useApi("/api/projects", "projects");
  const { data: quotes } = useApi("/api/quotes", "quotes");
  const { data: tasks, setData: setTasks } = useApi("/api/tasks", "tasks");
  const { data: workers } = useApi("/api/workers", "workers");
  const { data: supplies } = useApi("/api/supplies", "supplies");

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [trackingTarget, setTrackingTarget] = useState(null);
  const [planForm, setPlanForm] = useState(emptyPlan);
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

  if (selectedProject) {
    return (
      <Shell>
        <div className="mobile-tool chantier-follow">
          <header className="tool-topline compact">
            <button type="button" className="plain-back" onClick={() => setSelectedProjectId("")}>{"<"}</button>
            <div className="follow-title">
              <h1>{selectedProject.title}</h1>
              <p>{selectedProject.client || "Client"} · {selectedProject.status}</p>
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
                          {item.code || task?.code || "Ouvrage"} · {item.quantity || task?.quantity || 1} {item.unit || task?.unit || ""}
                        </small>
                        <small>
                          Equipe: {task?.assignedTo || "Non assignee"} · {formatDate(task?.startDate)} → {formatDate(task?.endDate || task?.dueDate)}
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
                    <span>{need.quantity} {need.unit} · {need.status}</span>
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
                      <small>{worker.type || "Ouvrier"} · {worker.profession || worker.role}</small>
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
          <button type="button" className="plain-back" onClick={() => window.history.back()}>{"<"}</button>
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
                      <small>{project.client || "Client"} · {project.reference}</small>
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
