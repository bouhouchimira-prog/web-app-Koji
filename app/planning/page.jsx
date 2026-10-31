"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiSend } from "../../lib/client-api";
import { useLocale } from "../../lib/i18n";
import { fixText } from "../../lib/text";
import { useApi } from "../../lib/use-api";

// Attribution des tâches aux intervenants (ouvert depuis le Calendrier,
// DA Koji Pro).

const initialTask = {
  label: "",
  room: "Salon",
  dueDate: "",
  durationHours: 1
};

function shortDay(value) {
  const text = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const [y, m, d] = text.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(y, m - 1, d));
}

export default function PlanningPage() {
  const { L } = useLocale();
  const { data: tasks, setData: setTasks } = useApi("/api/tasks", "tasks");
  const { data: projects } = useApi("/api/projects", "projects");
  const { data: workers } = useApi("/api/workers", "workers");
  // null : pas encore initialisé (premier chantier par défaut) ; "" : tous.
  const [projectId, setProjectId] = useState(null);
  const [taskForm, setTaskForm] = useState(initialTask);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [assignTask, setAssignTask] = useState(null);
  const [participantType, setParticipantType] = useState("Ouvrier");
  const [workerSearch, setWorkerSearch] = useState("");
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (projectId === null && projects.length) setProjectId(projects[0].id);
  }, [projectId, projects]);

  const selectedProject = projects.find((project) => project.id === projectId);

  const projectTasks = useMemo(() => {
    if (!selectedProject) return tasks;
    return tasks.filter((task) => task.projectId === selectedProject.id || task.project === selectedProject.title);
  }, [selectedProject, tasks]);

  const workerNames = useMemo(() => Object.fromEntries(workers.map((worker) => [worker.id, worker.name])), [workers]);
  const unassignedCount = projectTasks.filter((task) => !task.done && !(task.workerIds || []).length).length;

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
    setMessage(`Tâche ajoutée : ${fixText(task.label)}`);
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
    setMessage(`Tâche attribuée : ${fixText(task.label)}`);
  }

  function assigneesOf(task) {
    const names = (task.workerIds || []).map((id) => workerNames[id]).filter(Boolean);
    if (names.length) return names.join(", ");
    return task.assignedTo && task.assignedTo !== "Equipe" ? fixText(task.assignedTo) : "";
  }

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow">
            <Link href="/calendrier" className="link">Calendrier</Link>
            {" · "}{projectTasks.length} tâche{projectTasks.length > 1 ? "s" : ""}{unassignedCount ? ` · ${unassignedCount} sans intervenant` : ""}
          </span>
          <h1>Attribuer les tâches</h1>
        </div>
        <div className="acts">
          <button type="button" className="btn btn-main" onClick={() => setNewTaskOpen((open) => !open)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            {L.planning.newTask}
          </button>
        </div>
      </div>

      {message ? <p className="notice" role="status">{message}</p> : null}

      <div className="tbar">
        <label className="search search-wide pl-filter">
          <span className="flab">{L.planning.project}</span>
          <select value={projectId ?? ""} onChange={(event) => setProjectId(event.target.value)} aria-label={L.planning.project}>
            <option value="">{L.planning.allProjects}</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
          </select>
        </label>
      </div>

      {newTaskOpen ? (
        <form className="card" onSubmit={createTask}>
          <div className="card-h">
            <h2>{L.planning.newTask}</h2>
            <span className="muted">{selectedProject ? fixText(selectedProject.title) : "Sans chantier"}</span>
          </div>
          <div className="fgrid fgrid3">
            <label>{L.planning.taskLabel}<input value={taskForm.label} onChange={(event) => setTaskField("label", event.target.value)} required /></label>
            <label>{L.planning.room}<input value={taskForm.room} onChange={(event) => setTaskField("room", event.target.value)} /></label>
            <label>{L.planning.dueDate}<input type="date" value={taskForm.dueDate} onChange={(event) => setTaskField("dueDate", event.target.value)} /></label>
          </div>
          <div className="ed-act">
            <button type="button" className="btn btn-sec" onClick={() => setNewTaskOpen(false)}>{L.common.cancel}</button>
            <button type="submit" className="btn btn-sec">{L.planning.createTask}</button>
          </div>
        </form>
      ) : null}

      {projectTasks.length === 0 ? (
        <div className="tbl"><div className="empty">{L.planning.noTasks}</div></div>
      ) : (
        <>
          <div className="tbl has-cards">
            <table>
              <thead>
                <tr>
                  <th>Tâche</th>
                  <th>Chantier</th>
                  <th>Date</th>
                  <th>Intervenants</th>
                  <th aria-label="Action" />
                </tr>
              </thead>
              <tbody>
                {projectTasks.map((task) => {
                  const assignees = assigneesOf(task);
                  const date = shortDay(task.startDate || task.dueDate);
                  const end = shortDay(task.endDate);
                  return (
                    <tr key={task.id} tabIndex={0} onClick={() => openAssign(task)} onKeyDown={(event) => { if (event.key === "Enter") openAssign(task); }}>
                      <td className="n">{fixText(task.label)}<div className="sm">{fixText(task.room || "Chantier")}</div></td>
                      <td>{fixText(task.project || "—")}</td>
                      <td className="sm2">{date ? (end && end !== date ? `${date} → ${end}` : date) : "sans date"}</td>
                      <td>{assignees || <span className="tag tag-o">À attribuer</span>}</td>
                      <td className="r">
                        <button type="button" className="btn btn-sec" onClick={(event) => { event.stopPropagation(); openAssign(task); }}>{L.planning.assign}</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mlist">
            {projectTasks.map((task) => {
              const assignees = assigneesOf(task);
              return (
                <button type="button" className="m-card" key={task.id} onClick={() => openAssign(task)}>
                  <div className="top2">
                    <div>
                      <div className="nm">{fixText(task.label)}</div>
                      <div className="meta">{[fixText(task.project || ""), fixText(task.room || "")].filter(Boolean).join(" · ")}</div>
                    </div>
                    {assignees ? null : <span className="tag tag-o">À attribuer</span>}
                  </div>
                  <div className="line">{assignees || L.planning.noWorkers}</div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {assignTask ? (
        <div className="pmodal-bg" onClick={() => setAssignTask(null)}>
          <div className="pmodal" role="dialog" aria-modal="true" aria-label={L.planning.assign} onClick={(event) => event.stopPropagation()}>
            <div className="card-h">
              <h2>{L.planning.assign}</h2>
              <button type="button" className="link" onClick={() => setAssignTask(null)}>Fermer</button>
            </div>
            <p className="muted">{fixText(assignTask.label)} · {fixText(assignTask.project || "Sans chantier")}</p>
            <div className="kp-seg" role="group" aria-label="Type d'intervenant">
              <button type="button" className={participantType === "Ouvrier" ? "on" : ""} aria-pressed={participantType === "Ouvrier"} onClick={() => setParticipantType("Ouvrier")}>{L.planning.worker}</button>
              <button type="button" className={participantType === "Sous-traitant" ? "on" : ""} aria-pressed={participantType === "Sous-traitant"} onClick={() => setParticipantType("Sous-traitant")}>{L.planning.subcontractor}</button>
            </div>
            <label className="search">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4.5-4.5" /></svg>
              <input value={workerSearch} onChange={(event) => setWorkerSearch(event.target.value)} placeholder={L.planning.search} aria-label={L.planning.search} />
            </label>
            <div className="sq-list">
              {visibleWorkers.length === 0 ? <p className="muted">{L.planning.noWorkers}</p> : visibleWorkers.map((worker) => {
                const on = selectedWorkers.includes(worker.id);
                return (
                  <button type="button" key={worker.id} className={`sq-pick${on ? " on" : ""}`} aria-pressed={on} onClick={() => toggleWorker(worker.id)}>
                    <b>{worker.name}</b>
                    <small>{[worker.profession || worker.role || participantType, worker.availability].filter(Boolean).join(" · ")}</small>
                  </button>
                );
              })}
            </div>
            <div><Link href="/equipe" className="link">+ Ajouter un intervenant dans Équipe</Link></div>
            <div className="pm-act">
              <button type="button" className="btn btn-sec" onClick={() => setAssignTask(null)}>{L.common.cancel}</button>
              <button type="button" className="btn btn-main" onClick={validateAssignment} disabled={selectedWorkers.length === 0}>{L.common.confirm}</button>
            </div>
          </div>
        </div>
      ) : null}
    </Shell>
  );
}
