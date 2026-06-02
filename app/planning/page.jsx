"use client";

import { useEffect, useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiSend } from "../../lib/client-api";
import { fixText } from "../../lib/text";
import { useApi } from "../../lib/use-api";

const initialTask = {
  label: "",
  room: "Salon",
  dueDate: "",
  durationHours: 1
};

export default function PlanningPage() {
  const { data: tasks, setData: setTasks } = useApi("/api/tasks", "tasks");
  const { data: projects } = useApi("/api/projects", "projects");
  const { data: workers } = useApi("/api/workers", "workers");
  const [projectId, setProjectId] = useState("");
  const [taskForm, setTaskForm] = useState(initialTask);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [assignTask, setAssignTask] = useState(null);
  const [participantType, setParticipantType] = useState("Ouvrier");
  const [workerSearch, setWorkerSearch] = useState("");
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!projectId && projects.length) setProjectId(projects[0].id);
  }, [projectId, projects]);

  const selectedProject = projects.find((project) => project.id === projectId);

  const projectTasks = useMemo(() => {
    if (!selectedProject) return tasks;
    return tasks.filter((task) => task.projectId === selectedProject.id || task.project === selectedProject.title);
  }, [selectedProject, tasks]);

  const visibleWorkers = useMemo(() => {
    const needle = workerSearch.trim().toLowerCase();
    return workers.filter((worker) => {
      if ((worker.type || "Ouvrier") !== participantType) return false;
      if (!needle) return true;
      return [worker.name, worker.profession, worker.role].join(" ").toLowerCase().includes(needle);
    });
  }, [participantType, workerSearch, workers]);

  function setTaskField(field, value) {
    setTaskForm((current) => ({ ...current, [field]: value }));
  }

  async function createTask(event) {
    event.preventDefault();
    const project = selectedProject || {};
    const { task } = await apiSend("/api/tasks", {
      ...taskForm,
      projectId: project.id || "",
      project: project.title || "Chantier",
      dueDate: taskForm.dueDate || new Date().toISOString().slice(0, 10)
    });
    setTasks([task, ...tasks]);
    setTaskForm(initialTask);
    setNewTaskOpen(false);
  }

  function openAssign(task) {
    setAssignTask(task);
    setSelectedWorkers(Array.isArray(task.workerIds) ? task.workerIds : []);
    setWorkerSearch("");
  }

  function toggleWorker(id) {
    setSelectedWorkers((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function validateAssignment() {
    if (!assignTask || selectedWorkers.length === 0) return;
    const { task } = await apiSend("/api/tasks", {
      id: assignTask.id,
      action: "assign",
      workerIds: selectedWorkers,
      participantType: participantType === "Ouvrier" ? "Ouvriers" : "Sous-traitants"
    }, "PATCH");
    setTasks(tasks.map((item) => (item.id === task.id ? task : item)));
    setAssignTask(null);
    setSelectedWorkers([]);
    setSuccess(true);
  }

  if (success) {
    return (
      <Shell>
        <section className="mobile-tool success-view">
          <div className="big-check"><span>OK</span></div>
          <h1>Affectation Confirmee!</h1>
          <p>Les artisans ont ete notifies dans le suivi du chantier.</p>
          <button type="button" className="mobile-primary" onClick={() => setSuccess(false)}>Voir le planning</button>
          <button type="button" className="text-action" onClick={() => window.location.href = "/"}>Retour a l'accueil</button>
        </section>
      </Shell>
    );
  }

  if (assignTask) {
    return (
      <Shell>
        <section className="mobile-tool">
          <header className="tool-topline compact">
            <button type="button" className="plain-back" onClick={() => setAssignTask(null)}>{"<"}</button>
            <h1>Selectionner des participants</h1>
            <button type="button" className="round-pill" onClick={validateAssignment} disabled={selectedWorkers.length === 0}>Valider</button>
          </header>
          <div className="search-pill">
            <input value={workerSearch} onChange={(event) => setWorkerSearch(event.target.value)} placeholder="Rechercher un participant..." />
          </div>
          <div className="segmented large">
            <button type="button" className={participantType === "Ouvrier" ? "active" : ""} onClick={() => setParticipantType("Ouvrier")}>Ouvriers</button>
            <button type="button" className={participantType === "Sous-traitant" ? "active" : ""} onClick={() => setParticipantType("Sous-traitant")}>Sous-traitants</button>
          </div>
          <h2 className="tool-subtitle">Favoris</h2>
          <div className="people-list">
            {visibleWorkers.length === 0 ? <div className="tool-empty">Aucun participant disponible.</div> : null}
            {visibleWorkers.map((worker) => (
              <button type="button" className="person-row as-button" key={worker.id} onClick={() => toggleWorker(worker.id)}>
                <div className="avatar">
                  {(worker.name || "AB").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
                  <i className={worker.availability === "Disponible" ? "online" : ""} />
                </div>
                <div>
                  <strong>{worker.name}</strong>
                  <small>{worker.profession || worker.role || participantType}</small>
                </div>
                <span className={selectedWorkers.includes(worker.id) ? "select-dot selected" : "select-dot"} />
              </button>
            ))}
          </div>
          <button type="button" className="mobile-primary sticky-bottom" onClick={() => window.location.href = "/equipe"}>Ajouter</button>
        </section>
      </Shell>
    );
  }

  return (
    <Shell>
      <section className="mobile-tool">
        <header className="tool-topline">
          <button type="button" className="plain-back" onClick={() => window.history.back()}>{"<"}</button>
          <h1>Planifier une tâche</h1>
          <span />
        </header>

        <label className="mobile-input full">
          <span>Chantier</span>
          <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
            <option value="">Choisir un chantier</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
          </select>
        </label>

        <h2 className="tool-subtitle">Tâches du chantier</h2>
        <p className="tool-muted">Touchez une tâche pour assigner un ouvrier et des dates.</p>

        <div className="task-list">
          {projectTasks.length === 0 ? <div className="tool-empty">Aucune tache pour ce chantier.</div> : null}
          {projectTasks.map((task) => (
            <article className="task-card" key={task.id}>
              <i />
              <div>
                <small>{fixText(task.room || "Chantier")}</small>
                <strong>{fixText(task.label)}</strong>
                <span>{task.assignedTo && task.assignedTo !== "Equipe" ? fixText(task.assignedTo) : "Non assignée"}</span>
              </div>
              <button type="button" onClick={() => openAssign(task)}>Affecter</button>
            </article>
          ))}
        </div>

        {newTaskOpen ? (
          <form className="inline-panel" onSubmit={createTask}>
            <label>Nom de la tache<input value={taskForm.label} onChange={(event) => setTaskField("label", event.target.value)} required /></label>
            <label>Piece<input value={taskForm.room} onChange={(event) => setTaskField("room", event.target.value)} /></label>
            <label>Date<input type="date" value={taskForm.dueDate} onChange={(event) => setTaskField("dueDate", event.target.value)} /></label>
            <button className="mobile-primary compact">Enregistrer la tache</button>
          </form>
        ) : null}

        <button type="button" className="floating-action-button" onClick={() => setNewTaskOpen((open) => !open)}>+ Nouvelle tache</button>
      </section>
    </Shell>
  );
}
