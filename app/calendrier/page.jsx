"use client";

import { useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiSend } from "../../lib/client-api";
import { useLocale } from "../../lib/i18n";
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
  const { L } = useLocale();
  const { data: calendarEvents, setData: setCalendarEvents } = useApi("/api/calendar-events", "calendarEvents");
  const { data: projects } = useApi("/api/projects", "projects");
  const { data: workers } = useApi("/api/workers", "workers");
  const { data: tasks } = useApi("/api/tasks", "tasks");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(initialEvent);
  const [editingEventId, setEditingEventId] = useState(null);
  const [detailTask, setDetailTask] = useState(null);
  const [filter, setFilter] = useState("all");
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

  const todayKey = new Date().toISOString().slice(0, 10);

  const filteredTimeline = useMemo(() => {
    if (filter === "today") return timeline.filter((event) => String(event.startAt || "").slice(0, 10) === todayKey);
    if (filter === "chantier") return timeline.filter((event) => event.eventType === "Chantier");
    if (filter === "planning") return timeline.filter((event) => String(event.id || "").startsWith("task-"));
    return timeline;
  }, [timeline, filter, todayKey]);

  function toggleFilter(value) {
    setFilter((current) => (current === value ? "all" : value));
  }

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

  function closeForm() {
    setFormOpen(false);
    setEditingEventId(null);
  }

  function openCreateEvent() {
    const now = datetimeLocal(new Date().toISOString());
    setForm({ ...initialEvent, startAt: now, endAt: now });
    setEditingEventId(null);
    setFormOpen(true);
  }

  function openEditEvent(event) {
    setForm({
      title: event.title || "",
      eventType: event.eventType || "Chantier",
      projectId: event.projectId || "",
      clientName: event.clientName || "",
      address: event.address || "",
      startAt: datetimeLocal(event.startAt),
      endAt: datetimeLocal(event.endAt),
      allDay: Boolean(event.allDay),
      status: event.status || "En attente",
      progress: Number(event.progress || 0),
      notes: event.notes || "",
      workerIds: Array.isArray(event.workerIds) ? event.workerIds : []
    });
    setEditingEventId(event.id);
    setFormOpen(true);
  }

  function openRow(event) {
    if (String(event.id || "").startsWith("task-")) {
      setDetailTask(event);
    } else {
      openEditEvent(event);
    }
  }

  async function submitEvent(event) {
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
    if (editingEventId) {
      const { calendarEvent } = await apiSend("/api/calendar-events", { id: editingEventId, ...payload }, "PATCH");
      setCalendarEvents(calendarEvents.map((item) => (item.id === calendarEvent.id ? calendarEvent : item)));
      setMessage(`Evenement mis a jour: ${calendarEvent.title}`);
    } else {
      const { calendarEvent } = await apiSend("/api/calendar-events", payload);
      setCalendarEvents([calendarEvent, ...calendarEvents]);
      setMessage(`Evenement ajoute: ${calendarEvent.title}`);
    }
    setForm(initialEvent);
    closeForm();
  }

  async function deleteEvent(event) {
    if (String(event.id || "").startsWith("task-")) return;
    const { calendarEvent } = await apiSend("/api/calendar-events", { id: event.id, action: "delete" }, "PATCH");
    if (calendarEvent?.deleted) setCalendarEvents(calendarEvents.filter((item) => item.id !== event.id));
  }

  // Aujourd'hui en evidence (anime), les prochains en cartes, le passe en
  // petit et discret — remplace le simple tri chronologique croissant unique
  // par 3 groupes visuellement distincts, calcules a partir de la meme
  // filteredTimeline (les filtres du haut continuent de s'appliquer).
  const eventGroups = useMemo(() => {
    const today = [];
    const upcoming = [];
    const past = [];
    for (const event of filteredTimeline) {
      const day = String(event.startAt || "").slice(0, 10);
      if (day === todayKey) today.push(event);
      else if (day > todayKey) upcoming.push(event);
      else past.push(event);
    }
    today.sort((a, b) => String(a.startAt || "").localeCompare(String(b.startAt || "")));
    upcoming.sort((a, b) => String(a.startAt || "").localeCompare(String(b.startAt || "")));
    past.sort((a, b) => String(b.startAt || "").localeCompare(String(a.startAt || "")));
    return { today, upcoming, past };
  }, [filteredTimeline, todayKey]);

  function renderEventRow(event, variant) {
    const isTask = String(event.id || "").startsWith("task-");
    return (
      <article
        className={`calendar-row clickable calendar-row-${variant}`}
        key={event.id}
        role="button"
        tabIndex={0}
        onClick={() => openRow(event)}
        onKeyDown={(keyEvent) => { if (keyEvent.key === "Enter" || keyEvent.key === " ") { keyEvent.preventDefault(); openRow(event); } }}
      >
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
        {!isTask ? (
          <button type="button" className="mini-danger" onClick={(clickEvent) => { clickEvent.stopPropagation(); deleteEvent(event); }}>{L.calendrier.delete}</button>
        ) : null}
      </article>
    );
  }

  if (detailTask) {
    return (
      <Shell>
        <section className="mobile-tool tool-form-view">
          <header className="tool-topline compact">
            <button type="button" className="plain-back" onClick={() => setDetailTask(null)}>{"<"}</button>
            <h1>{fixText(detailTask.title)}</h1>
            <span />
          </header>

          <div className="mobile-form">
            <div className="mobile-input full"><span>{L.calendrier.eventType}</span><strong>{fixText(detailTask.eventType)}</strong></div>
            <div className="mobile-input full"><span>{L.calendrier.project}</span><strong>{fixText(detailTask.projectTitle || L.calendrier.noProject)}</strong></div>
            <div className="mobile-input full"><span>{L.calendrier.startAt}</span><strong>{formatEventDate(detailTask.startAt)}</strong></div>
            <div className="mobile-input full"><span>{L.calendrier.endAt}</span><strong>{formatEventDate(detailTask.endAt)}</strong></div>
            <div className="mobile-input full"><span>{L.calendrier.workers}</span><strong>{fixText(detailTask.workerNames)}</strong></div>
            <div className="mobile-input full"><span>{L.calendrier.status}</span><strong>{fixText(detailTask.status)}</strong></div>
            <p className="tool-muted">{L.calendrier.taskFromPlanning}</p>
          </div>
        </section>
      </Shell>
    );
  }

  if (formOpen) {
    return (
      <Shell>
        <section className="mobile-tool tool-form-view">
          <header className="tool-topline compact">
            <button type="button" className="plain-back" onClick={closeForm}>{"<"}</button>
            <h1>{editingEventId ? L.calendrier.editEvent : L.calendrier.newEvent}</h1>
            <span />
          </header>

          <form className="mobile-form" onSubmit={submitEvent}>
            <div className="mobile-form-grid">
              <label className="mobile-input full">
                <span>{L.calendrier.eventTitle}</span>
                <input value={form.title} onChange={(event) => setField("title", event.target.value)} />
              </label>
              <label className="mobile-input">
                <span>{L.calendrier.eventType}</span>
                <select value={form.eventType} onChange={(event) => setField("eventType", event.target.value)}>
                  {eventTypes.map((type) => <option key={type}>{type}</option>)}
                </select>
              </label>
              <label className="mobile-input">
                <span>{L.calendrier.status}</span>
                <select value={form.status} onChange={(event) => setField("status", event.target.value)}>
                  {statuses.map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
              <label className="mobile-input full">
                <span>{L.calendrier.project}</span>
                <select value={form.projectId} onChange={(event) => chooseProject(event.target.value)}>
                  <option value="">{L.calendrier.noProject}</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
                </select>
              </label>
              <label className="mobile-input">
                <span>{L.calendrier.client}</span>
                <input value={form.clientName} onChange={(event) => setField("clientName", event.target.value)} />
              </label>
              <label className="mobile-input">
                <span>%</span>
                <input type="number" min="0" max="100" value={form.progress} onChange={(event) => setField("progress", event.target.value)} />
              </label>
              <label className="mobile-input">
                <span>{L.calendrier.startAt}</span>
                <input type="datetime-local" value={form.startAt} onChange={(event) => setField("startAt", event.target.value)} required />
              </label>
              <label className="mobile-input">
                <span>{L.calendrier.endAt}</span>
                <input type="datetime-local" value={form.endAt} onChange={(event) => setField("endAt", event.target.value)} />
              </label>
              <label className="mobile-input full">
                <span>{L.calendrier.address}</span>
                <input value={form.address} onChange={(event) => setField("address", event.target.value)} />
              </label>
              <label className="mobile-input full">
                <span>{L.calendrier.notes}</span>
                <input value={form.notes} onChange={(event) => setField("notes", event.target.value)} />
              </label>
            </div>

            <div className="calendar-worker-box">
              <h2>{L.calendrier.workers}</h2>
              <div className="worker-chip-grid">
                {workers.length === 0 ? <p className="tool-muted">{L.calendrier.noParticipants}</p> : null}
                {workers.map((worker) => (
                  <button type="button" className={form.workerIds.includes(worker.id) ? "active" : ""} key={worker.id} onClick={() => toggleWorker(worker.id)}>
                    <span>{worker.name}</span>
                    <small>{worker.type || "Ouvrier"} - {worker.profession || worker.role}</small>
                  </button>
                ))}
              </div>
            </div>

            <button className="mobile-primary">{L.calendrier.save}</button>
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
          <h1>{L.calendrier.title}</h1>
          <button type="button" className="round-dark" onClick={openCreateEvent}>+</button>
        </header>

        {message ? <p className="tool-message">{message}</p> : null}

        <section className="calendar-summary">
          <div
            className={filter === "today" ? "active" : ""}
            role="button"
            tabIndex={0}
            onClick={() => toggleFilter("today")}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleFilter("today"); } }}
          >
            <span>{L.agenda.today}</span><strong>{timeline.filter((event) => String(event.startAt || "").slice(0, 10) === todayKey).length}</strong>
          </div>
          <div
            className={filter === "chantier" ? "active" : ""}
            role="button"
            tabIndex={0}
            onClick={() => toggleFilter("chantier")}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleFilter("chantier"); } }}
          >
            <span>{L.nav.projects}</span><strong>{timeline.filter((event) => event.eventType === "Chantier").length}</strong>
          </div>
          <div
            className={filter === "planning" ? "active" : ""}
            role="button"
            tabIndex={0}
            onClick={() => toggleFilter("planning")}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleFilter("planning"); } }}
          >
            <span>{L.planning.title}</span><strong>{plannedTasks.length}</strong>
          </div>
        </section>

        <div className="calendar-list">
          {filteredTimeline.length === 0 ? <div className="tool-empty">{L.calendrier.noEvents}</div> : null}

          {eventGroups.today.length > 0 ? (
            <section className="calendar-group calendar-group-today">
              <h2 className="calendar-group-title">Aujourd'hui</h2>
              <div className="calendar-list-inner">
                {eventGroups.today.map((event) => renderEventRow(event, "today"))}
              </div>
            </section>
          ) : null}

          {eventGroups.upcoming.length > 0 ? (
            <section className="calendar-group calendar-group-upcoming">
              <h2 className="calendar-group-title">À venir</h2>
              <div className="calendar-card-grid">
                {eventGroups.upcoming.map((event) => renderEventRow(event, "upcoming"))}
              </div>
            </section>
          ) : null}

          {eventGroups.past.length > 0 ? (
            <section className="calendar-group calendar-group-past">
              <h2 className="calendar-group-title">Passé</h2>
              <div className="calendar-list-inner">
                {eventGroups.past.map((event) => renderEventRow(event, "past"))}
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </Shell>
  );
}
