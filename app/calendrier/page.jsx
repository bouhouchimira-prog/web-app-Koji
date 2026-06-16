"use client";

import { useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiSend } from "../../lib/client-api";
import { shortDate } from "../../lib/pricing";
import { fixText } from "../../lib/text";
import { useApi } from "../../lib/use-api";

const eventTypes = ["Chantier", "Devis", "Urgence", "Maintenance"];
const statuses = ["En attente", "En cours", "Termine", "Annule"];

const initialEvent = {
  title: "",
  eventType: "Chantier",
  projectId: "",
  clientName: "",
  address: "",
  startAt: "",
  endAt: "",
  allDay: false,
  status: "En attente",
  progress: 0,
  notes: "",
  workerIds: []
};

function datetimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function formatEventDate(value) {
  if (!value) return "-";
  try {
    const date = new Date(value);
    return `${shortDate(date)} ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    return value;
  }
}

export default function CalendrierPage() {
  const { data: calendarEvents, setData: setCalendarEvents } = useApi("/api/calendar-events", "calendarEvents");
  const { data: projects } = useApi("/api/projects", "projects");
  const { data: workers } = useApi("/api/workers", "workers");
  const { data: tasks } = useApi("/api/tasks", "tasks");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(initialEvent);
  const [message, setMessage] = useState("");

  const plannedTasks = useMemo(() => {
    return tasks
      .filter((task) => task.startDate || task.dueDate)
      .slice(0, 12)
      .map((task) => ({
        id: `task-${task.id}`,
        title: fixText(task.label),
        eventType: "Tache",
        projectTitle: fixText(task.project),
        startAt: task.startDate || task.dueDate,
        endAt: task.endDate || task.dueDate,
        status: task.status || (task.done ? "Termine" : "À faire"),
        progress: task.done ? 100 : 0,
        workerNames: task.assignedTo && task.assignedTo !== "Equipe" ? fixText(task.assignedTo) : "Non assignee"
      }));
  }, [tasks]);

  const timeline = useMemo(() => {
    const events = calendarEvents.map((event) => ({
      ...event,
      workerNames: (event.workers || []).map((worker) => worker.name).join(", ") || "Aucun participant"
    }));
    return [...events, ...plannedTasks]
      .sort((a, b) => String(a.startAt || "").localeCompare(String(b.startAt || "")));
  }, [calendarEvents, plannedTasks]);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function chooseProject(projectId) {
    const project = projects.find((item) => item.id === projectId);
    setForm((current) => ({
      ...current,
      projectId,
      title: current.title || project?.title || "",
      clientName: project?.client || current.clientName,
      address: project?.address || current.address
    }));
  }

  function toggleWorker(workerId) {
    setForm((current) => ({
      ...current,
      workerIds: current.workerIds.includes(workerId)
        ? current.workerIds.filter((id) => id !== workerId)
        : [...current.workerIds, workerId]
    }));
  }

  async function createEvent(event) {
    event.preventDefault();
    const selectedProject = projects.find((project) => project.id === form.projectId);
    const payload = {
      ...form,
      title: form.title || selectedProject?.title || "Rendez-vous chantier",
      projectTitle: selectedProject?.title || "",
      startAt: form.startAt ? new Date(form.startAt).toISOString() : new Date().toISOString(),
      endAt: form.endAt ? new Date(form.endAt).toISOString() : (form.startAt ? new Date(form.startAt).toISOString() : new Date().toISOString()),
      progress: Number(form.progress || 0)
    };
    const { calendarEvent } = await apiSend("/api/calendar-events", payload);
    setCalendarEvents([calendarEvent, ...calendarEvents]);
    setForm(initialEvent);
    setFormOpen(false);
    setMessage(`Evenement ajoute: ${calendarEvent.title}`);
  }

  async function deleteEvent(event) {
    if (String(event.id || "").startsWith("task-")) return;
    const { calendarEvent } = await apiSend("/api/calendar-events", { id: event.id, action: "delete" }, "PATCH");
    if (calendarEvent?.deleted) setCalendarEvents(calendarEvents.filter((item) => item.id !== event.id));
  }

  if (formOpen) {
    return (
      <Shell>
        <section className="mobile-tool tool-form-view">
          <header className="tool-topline compact">
            <button type="button" className="plain-back" onClick={() => setFormOpen(false)}>{"<"}</button>
            <h1>Nouvel evenement</h1>
            <span />
          </header>

          <form className="mobile-form" onSubmit={createEvent}>
            <div className="mobile-form-grid">
              <label className="mobile-input full">
                <span>Titre</span>
                <input value={form.title} onChange={(event) => setField("title", event.target.value)} placeholder="RDV client, intervention..." />
              </label>
              <label className="mobile-input">
                <span>Type</span>
                <select value={form.eventType} onChange={(event) => setField("eventType", event.target.value)}>
                  {eventTypes.map((type) => <option key={type}>{type}</option>)}
                </select>
              </label>
              <label className="mobile-input">
                <span>Statut</span>
                <select value={form.status} onChange={(event) => setField("status", event.target.value)}>
                  {statuses.map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
              <label className="mobile-input full">
                <span>Chantier lie</span>
                <select value={form.projectId} onChange={(event) => chooseProject(event.target.value)}>
                  <option value="">Sans chantier</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
                </select>
              </label>
              <label className="mobile-input">
                <span>Client</span>
                <input value={form.clientName} onChange={(event) => setField("clientName", event.target.value)} placeholder="Nom client" />
              </label>
              <label className="mobile-input">
                <span>Progression</span>
                <input type="number" min="0" max="100" value={form.progress} onChange={(event) => setField("progress", event.target.value)} />
              </label>
              <label className="mobile-input">
                <span>Debut</span>
                <input type="datetime-local" value={form.startAt} onChange={(event) => setField("startAt", event.target.value)} required />
              </label>
              <label className="mobile-input">
                <span>Fin</span>
                <input type="datetime-local" value={form.endAt} onChange={(event) => setField("endAt", event.target.value)} />
              </label>
              <label className="mobile-input full">
                <span>Adresse</span>
                <input value={form.address} onChange={(event) => setField("address", event.target.value)} placeholder="Lieu du rendez-vous" />
              </label>
              <label className="mobile-input full">
                <span>Notes</span>
                <input value={form.notes} onChange={(event) => setField("notes", event.target.value)} placeholder="Informations utiles" />
              </label>
            </div>

            <div className="calendar-worker-box">
              <h2>Equipe affectee</h2>
              <div className="worker-chip-grid">
                {workers.length === 0 ? <p className="tool-muted">Aucun ouvrier ou sous-traitant ajoute.</p> : null}
                {workers.map((worker) => (
                  <button type="button" className={form.workerIds.includes(worker.id) ? "active" : ""} key={worker.id} onClick={() => toggleWorker(worker.id)}>
                    <span>{worker.name}</span>
                    <small>{worker.type || "Ouvrier"} - {worker.profession || worker.role}</small>
                  </button>
                ))}
              </div>
            </div>

            <button className="mobile-primary">Enregistrer l'evenement</button>
          </form>
        </section>
      </Shell>
    );
  }

  return (
    <Shell>
      <section className="mobile-tool calendar-tool">
        <header className="tool-topline compact">
          <button type="button" className="plain-back" onClick={() => (window.history.length > 1 ? window.history.back() : window.location.assign("/"))}>{"<"}</button>
          <h1>Calendrier</h1>
          <button type="button" className="round-dark" onClick={() => {
            const now = datetimeLocal(new Date().toISOString());
            setForm({ ...initialEvent, startAt: now, endAt: now });
            setFormOpen(true);
          }}>+</button>
        </header>

        {message ? <p className="tool-message">{message}</p> : null}

        <section className="calendar-summary">
          <div><span>Aujourd'hui</span><strong>{timeline.filter((event) => String(event.startAt || "").slice(0, 10) === new Date().toISOString().slice(0, 10)).length}</strong></div>
          <div><span>Chantiers</span><strong>{timeline.filter((event) => event.eventType === "Chantier").length}</strong></div>
          <div><span>Taches</span><strong>{plannedTasks.length}</strong></div>
        </section>

        <div className="calendar-list">
          {timeline.length === 0 ? <div className="tool-empty">Aucun evenement planifie.</div> : null}
          {timeline.map((event) => (
            <article className="calendar-row" key={event.id}>
              <div className="calendar-date">
                <strong>{formatEventDate(event.startAt)}</strong>
                <span>{event.eventType}</span>
              </div>
              <div>
                <strong>{fixText(event.title)}</strong>
                <small>{fixText(event.projectTitle || event.clientName || event.project || "Sans chantier")}</small>
                <small>{fixText(event.workerNames || "Aucun participant")}</small>
              </div>
              <span className="status">{fixText(event.status || "En attente")}</span>
              {!String(event.id || "").startsWith("task-") ? (
                <button type="button" className="mini-danger" onClick={() => deleteEvent(event)}>Supprimer</button>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </Shell>
  );
}
