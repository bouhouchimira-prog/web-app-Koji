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

const WEEKDAY_SHORT = ["DIM", "LUN", "MAR", "MER", "JEU", "VEN", "SAM"];

function dayBadge(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return { dow: "", day: "" };
  return { dow: WEEKDAY_SHORT[d.getDay()], day: String(d.getDate()) };
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

  // Tableau de bord (15 oct) — "Cette semaine" en colonne laterale, meme
  // calcul/presentation que la carte equivalente de Chantiers.
  const weekEvents = useMemo(() => {
    const now = new Date();
    const in7Days = new Date(now); in7Days.setDate(in7Days.getDate() + 7);
    return timeline
      .filter((event) => {
        const d = new Date(event.startAt || "");
        return !Number.isNaN(d.getTime()) && d >= now && d <= in7Days;
      })
      .slice(0, 6);
  }, [timeline]);

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
      <section className="fournitures-dashboard">
        <header className="fournitures-dashboard-head">
          <div>
            <h1><span className="title-chip">{L.calendrier.title}</span></h1>
            <p>Vos rendez-vous, visites et tâches planifiées, en un coup d'œil.</p>
          </div>
          <div className="fournitures-dashboard-head-actions">
            <button type="button" className="button blue" onClick={openCreateEvent}>+ Nouvel événement</button>
          </div>
        </header>

        {message ? <p className="tool-message">{message}</p> : null}

        <div className="fournitures-kpi-row">
          <button type="button" className={`fournitures-kpi-card clickable ${filter === "today" ? "kpi-active" : ""}`} onClick={() => toggleFilter("today")}>
            <div className="fournitures-kpi-card-head">
              <span className="fournitures-kpi-icon fournitures-kpi-icon-blue">📅</span>
              <span className="title-chip">{L.agenda.today}</span>
            </div>
            <strong>{timeline.filter((event) => String(event.startAt || "").slice(0, 10) === todayKey).length}</strong>
            <small>événements</small>
          </button>
          <div className="fournitures-kpi-card">
            <div className="fournitures-kpi-card-head">
              <span className="fournitures-kpi-icon fournitures-kpi-icon-green">🗓️</span>
              <span className="title-chip">Cette semaine</span>
            </div>
            <strong>{weekEvents.length}</strong>
            <small>à venir</small>
          </div>
          <button type="button" className={`fournitures-kpi-card clickable ${filter === "chantier" ? "kpi-active" : ""}`} onClick={() => toggleFilter("chantier")}>
            <div className="fournitures-kpi-card-head">
              <span className="fournitures-kpi-icon fournitures-kpi-icon-amber">🏗️</span>
              <span className="title-chip">{L.nav.projects}</span>
            </div>
            <strong>{timeline.filter((event) => event.eventType === "Chantier").length}</strong>
            <small>rendez-vous</small>
          </button>
          <button type="button" className={`fournitures-kpi-card clickable ${filter === "planning" ? "kpi-active" : ""}`} onClick={() => toggleFilter("planning")}>
            <div className="fournitures-kpi-card-head">
              <span className="fournitures-kpi-icon fournitures-kpi-icon-purple">✅</span>
              <span className="title-chip">{L.planning.title}</span>
            </div>
            <strong>{plannedTasks.length}</strong>
            <small>tâches planifiées</small>
          </button>
        </div>

        <div className="fournitures-dashboard-body">
          <div className="fournitures-main-card">
            <div className="fournitures-main-card-head">
              <strong className="title-chip">Agenda</strong>
              {filter !== "all" ? <button type="button" className="mini-button" onClick={() => setFilter("all")}>Réinitialiser le filtre</button> : null}
            </div>

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
          </div>

          <div className="fournitures-sidebar-card">
            <strong className="title-chip">Cette semaine</strong>
            {weekEvents.length === 0 ? (
              <div className="tool-empty">Rien de prévu cette semaine.</div>
            ) : (
              weekEvents.map((event) => {
                const badge = dayBadge(event.startAt);
                return (
                  <button type="button" className="chantiers-week-row" key={event.id} onClick={() => openRow(event)}>
                    <span className="chantiers-week-badge"><small>{badge.dow}</small><strong>{badge.day}</strong></span>
                    <span className="chantiers-week-main">
                      <strong>{fixText(event.title)}</strong>
                      <small>{fixText(event.projectTitle || event.clientName || "Sans chantier")}</small>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </section>
    </Shell>
  );
}
