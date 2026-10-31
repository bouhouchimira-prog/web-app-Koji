"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiSend } from "../../lib/client-api";
import { useLocale } from "../../lib/i18n";
import { fixText } from "../../lib/text";
import { useApi } from "../../lib/use-api";

// Calendrier, maquette PRO-11 (DA Koji Pro, 30 oct) : planning de la semaine
// par intervenant, ou sur 4 semaines par chantier. Une seule source : les
// tâches (dates + intervenants) et les rendez-vous du calendrier.

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

const DOW = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const DAY_MS = 86400000;

function pad(n) {
  return String(n).padStart(2, "0");
}

function dayKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDay(value) {
  const text = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const [y, m, d] = text.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function localDay(value) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? null : new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, n) {
  const next = new Date(date);
  next.setDate(next.getDate() + n);
  return next;
}

function mondayOf(date) {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return addDays(day, -((day.getDay() + 6) % 7));
}

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / DAY_MS + 1) / 7);
}

function rangeLabel(start, end) {
  const month = (d) => new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(d);
  if (start.getMonth() === end.getMonth()) return `${start.getDate()} → ${end.getDate()} ${month(end)} ${end.getFullYear()}`;
  return `${start.getDate()} ${month(start)} → ${end.getDate()} ${month(end)} ${end.getFullYear()}`;
}

function dayTitle(date) {
  const text = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function timeOf(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getHours()} h${date.getMinutes() ? ` ${pad(date.getMinutes())}` : ""}`;
}

function datetimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function plural(n, one, many) {
  return `${n} ${n > 1 ? many || `${one}s` : one}`;
}

// Couloirs : deux barres qui se chevauchent dans une même ligne passent l'une
// sous l'autre.
function assignLanes(items) {
  const laneEnds = [];
  const sorted = [...items].sort((a, b) => a.startIdx - b.startIdx || b.endIdx - a.endIdx);
  const placed = sorted.map((item) => {
    let lane = laneEnds.findIndex((end) => end < item.startIdx);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.endIdx);
    } else {
      laneEnds[lane] = item.endIdx;
    }
    return { ...item, lane };
  });
  return { items: placed, laneCount: Math.max(1, laneEnds.length) };
}

export default function CalendrierPage() {
  const { L } = useLocale();
  const { data: calendarEvents, setData: setCalendarEvents } = useApi("/api/calendar-events", "calendarEvents");
  const { data: projects } = useApi("/api/projects", "projects");
  const { data: workers } = useApi("/api/workers", "workers");
  const { data: tasks } = useApi("/api/tasks", "tasks");
  const [view, setView] = useState("intervenant");
  const [offset, setOffset] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(initialEvent);
  const [editingEventId, setEditingEventId] = useState(null);
  const [detailTask, setDetailTask] = useState(null);
  const [message, setMessage] = useState("");

  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);
  const todayKey = dayKey(today);

  // Par chantier : 4 semaines, jours ouvrés seulement (sinon 28 colonnes
  // trop étroites pour lire une tâche d'un jour).
  const step = view === "chantier" ? 4 : 1;
  const days = useMemo(() => {
    const start = addDays(mondayOf(today), offset * 7);
    const all = Array.from({ length: step * 7 }, (_, i) => addDays(start, i));
    return view === "chantier" ? all.filter((date) => date.getDay() !== 0 && date.getDay() !== 6) : all;
  }, [today, offset, step, view]);
  const span = days.length;
  const rangeStart = days[0];
  const rangeEnd = days[days.length - 1];

  const workerById = useMemo(() => Object.fromEntries(workers.map((worker) => [worker.id, worker])), [workers]);

  const taskItems = useMemo(() => tasks.map((task) => {
    const start = parseDay(task.startDate || task.dueDate || task.endDate);
    if (!start) return null;
    const endRaw = parseDay(task.endDate || task.dueDate || task.startDate) || start;
    const project = projects.find((item) => item.id === task.projectId);
    const workerIds = Array.isArray(task.workerIds) ? task.workerIds.filter((id) => workerById[id]) : [];
    const isSub = workerIds.some((id) => workerById[id]?.type === "Sous-traitant");
    return {
      kind: "task",
      id: task.id,
      task,
      start,
      end: endRaw < start ? start : endRaw,
      label: fixText(task.label || "Tâche"),
      project: fixText(project?.title || task.project || "Sans chantier"),
      projectId: task.projectId || task.project || "",
      workerIds,
      workerNames: workerIds.map((id) => workerById[id]?.name).filter(Boolean).join(", ") || (task.assignedTo && task.assignedTo !== "Equipe" ? fixText(task.assignedTo) : ""),
      tone: workerIds.length ? (isSub ? "kst" : "kteam") : "kna",
      done: Boolean(task.done)
    };
  }).filter(Boolean), [tasks, projects, workerById]);

  const eventItems = useMemo(() => calendarEvents.map((event) => {
    const start = localDay(event.startAt);
    if (!start) return null;
    const endRaw = localDay(event.endAt) || start;
    return {
      kind: "event",
      id: event.id,
      event,
      start,
      end: endRaw < start ? start : endRaw,
      label: fixText(event.title || "Rendez-vous"),
      project: fixText(event.projectTitle || event.clientName || ""),
      projectId: event.projectId || "",
      time: event.allDay ? "" : timeOf(event.startAt),
      workerIds: Array.isArray(event.workerIds) ? event.workerIds : [],
      workerNames: (event.workers || []).map((worker) => worker.name).filter(Boolean).join(", "),
      tone: "krdv",
      done: event.status === "Termine"
    };
  }).filter(Boolean), [calendarEvents]);

  // Position d'une barre dans les colonnes affichées (null si hors période).
  function clip(item) {
    let startIdx = -1;
    let endIdx = -1;
    days.forEach((date, i) => {
      if (date >= item.start && date <= item.end) {
        if (startIdx === -1) startIdx = i;
        endIdx = i;
      }
    });
    return startIdx === -1 ? null : { ...item, startIdx, endIdx };
  }

  function clipAll(list) {
    return list.map(clip).filter(Boolean);
  }

  // Vue « Par intervenant » + conflits (un intervenant sur deux chantiers le
  // même jour).
  const { workerRows, conflicts } = useMemo(() => {
    const rows = [];
    const found = [];
    const rdv = clipAll(eventItems).map((item) => ({ ...item, title: item.label, sub: [item.time, item.project].filter(Boolean).join(" · ") }));
    if (rdv.length) rows.push({ id: "rdv", title: "Rendez-vous", sub: plural(rdv.length, "rendez-vous", "rendez-vous"), ...assignLanes(rdv) });

    const sortedWorkers = [...workers].sort((a, b) => (a.type === "Sous-traitant") - (b.type === "Sous-traitant") || String(a.name).localeCompare(String(b.name)));
    sortedWorkers.forEach((worker) => {
      const items = clipAll(taskItems.filter((item) => item.workerIds.includes(worker.id)))
        .map((item) => ({ ...item, title: item.project, sub: item.label }));
      if (!items.length) return;
      const byDay = new Map();
      items.filter((item) => !item.done).forEach((item) => {
        for (let i = item.startIdx; i <= item.endIdx; i += 1) {
          if (!byDay.has(i)) byDay.set(i, new Map());
          byDay.get(i).set(item.projectId, item.project);
        }
      });
      const conflictDays = new Set([...byDay.entries()].filter(([, projectsOfDay]) => projectsOfDay.size > 1).map(([i]) => i));
      conflictDays.forEach((i) => found.push({ id: `${worker.id}-${i}`, worker: worker.name, date: days[i], projects: [...byDay.get(i).values()] }));
      const marked = items.map((item) => {
        let conflict = false;
        for (let i = item.startIdx; i <= item.endIdx; i += 1) if (conflictDays.has(i)) conflict = true;
        return { ...item, conflict: conflict && !item.done };
      });
      const kindLabel = worker.type === "Sous-traitant" ? "sous-traitant" : "équipe";
      rows.push({ id: worker.id, title: worker.name, sub: [kindLabel, worker.profession || worker.role].filter(Boolean).join(" · "), ...assignLanes(marked) });
    });

    const unassigned = clipAll(taskItems.filter((item) => !item.workerIds.length && !item.done))
      .map((item) => ({ ...item, title: item.project, sub: item.label }));
    if (unassigned.length) rows.push({ id: "na", title: "À attribuer", sub: plural(unassigned.length, "tâche"), ...assignLanes(unassigned) });
    return { workerRows: rows, conflicts: found };
  }, [eventItems, taskItems, workers, days]); // eslint-disable-line react-hooks/exhaustive-deps

  // Vue « Par chantier » : une ligne par chantier, ses tâches et ses RDV.
  const projectRows = useMemo(() => {
    const groups = new Map();
    clipAll([...taskItems, ...eventItems]).forEach((item) => {
      const key = item.projectId || item.project || "sans";
      if (!groups.has(key)) groups.set(key, { title: item.project || "Sans chantier", items: [] });
      groups.get(key).items.push({
        ...item,
        title: item.label,
        sub: item.kind === "event" ? [item.time, item.workerNames].filter(Boolean).join(" · ") || "rendez-vous" : item.workerNames || "à attribuer"
      });
    });
    return [...groups.entries()]
      .map(([key, group]) => {
        const project = projects.find((item) => item.id === key);
        return { id: key, title: group.title, sub: fixText(project?.client || ""), ...assignLanes(group.items) };
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [taskItems, eventItems, projects, days]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = view === "chantier" ? projectRows : workerRows;

  const todayItems = useMemo(() => {
    const covers = (item) => item.start <= today && item.end >= today && !item.done;
    return [
      ...eventItems.filter(covers).map((item) => ({ ...item, title: item.label, sub: [item.time, item.project].filter(Boolean).join(" · ") })),
      ...taskItems.filter(covers).map((item) => ({ ...item, title: `${item.project} · ${item.label}`, sub: item.workerNames || "à attribuer" }))
    ].sort((a, b) => String(a.event?.startAt || "").localeCompare(String(b.event?.startAt || "")));
  }, [eventItems, taskItems, today]);

  const toPlan = useMemo(() => {
    const undated = tasks
      .filter((task) => !task.done && !task.startDate && !task.dueDate && !task.endDate)
      .map((task) => ({ id: task.id, title: fixText(task.label || "Tâche"), sub: `${fixText(task.project || "Sans chantier")} · sans date` }));
    const unassigned = taskItems
      .filter((item) => !item.done && !item.workerIds.length && item.end >= today)
      .map((item) => ({ id: item.id, title: item.label, sub: `${item.project} · sans intervenant · ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(item.start)}` }));
    return [...unassigned, ...undated];
  }, [tasks, taskItems, today]);

  const agendaDays = useMemo(() => {
    const result = [];
    for (let i = 0; i < 14; i += 1) {
      const date = addDays(today, i);
      const covers = (item) => item.start <= date && item.end >= date && !item.done;
      const items = [
        ...eventItems.filter(covers).map((item) => ({ ...item, title: item.label, sub: [item.time, item.project].filter(Boolean).join(" · ") })),
        ...taskItems.filter(covers).map((item) => ({ ...item, title: `${item.project} · ${item.label}`, sub: item.workerNames || "à attribuer" }))
      ];
      if (items.length) result.push({ date, items });
    }
    return result;
  }, [eventItems, taskItems, today]);

  const weekCount = useMemo(() => {
    const weekEnd = addDays(mondayOf(today), 6 + offset * 7);
    const weekStart = addDays(mondayOf(today), offset * 7);
    const visible = (item) => item.end >= weekStart && item.start <= weekEnd;
    const activeProjects = new Set(taskItems.filter(visible).map((item) => item.projectId));
    const busyWorkers = new Set(taskItems.filter(visible).flatMap((item) => item.workerIds));
    return { projects: activeProjects.size, workers: busyWorkers.size, rdv: eventItems.filter(visible).length };
  }, [taskItems, eventItems, today, offset]);

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

  function openItem(item) {
    if (item.kind === "event") openEditEvent(item.event);
    else setDetailTask(item);
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
      setMessage(`Rendez-vous mis à jour : ${calendarEvent.title}`);
    } else {
      const { calendarEvent } = await apiSend("/api/calendar-events", payload);
      setCalendarEvents([calendarEvent, ...calendarEvents]);
      setMessage(`Rendez-vous ajouté : ${calendarEvent.title}`);
    }
    setForm(initialEvent);
    closeForm();
  }

  async function deleteEvent() {
    if (!editingEventId) return;
    const { calendarEvent } = await apiSend("/api/calendar-events", { id: editingEventId, action: "delete" }, "PATCH");
    if (calendarEvent?.deleted) setCalendarEvents(calendarEvents.filter((item) => item.id !== editingEventId));
    setMessage("Rendez-vous supprimé.");
    closeForm();
  }

  function renderGrid() {
    const compact = view === "chantier";
    if (!rows.length) {
      return <p className="k-empty">{view === "chantier" ? "Aucun chantier planifié sur ces 4 semaines." : "Rien de planifié cette semaine."}</p>;
    }
    return (
      <div className="k-scroll">
        <div className={`k-grid${compact ? " k-compact" : ""}`} style={{ "--k-days": span }}>
          <div className="k-head">
            <div className="k-corner" />
            {days.map((date) => {
              const isToday = dayKey(date) === todayKey;
              const weekend = date.getDay() === 0 || date.getDay() === 6;
              return (
                <div key={dayKey(date)} className={`k-dh${isToday ? " today" : ""}${weekend ? " we" : ""}`}>
                  <span>{DOW[date.getDay()]}</span>
                  <b>{date.getDate()}</b>
                  {isToday && !compact ? <small>Aujourd'hui</small> : null}
                </div>
              );
            })}
          </div>
          {rows.map((row) => (
            <div className="k-row" key={row.id} style={{ gridTemplateRows: `repeat(${row.laneCount}, var(--k-lane))` }}>
              <div className="k-who" style={{ gridRow: `1 / span ${row.laneCount}` }}>
                <strong>{row.title}</strong>
                {row.sub ? <small>{row.sub}</small> : null}
              </div>
              {days.map((date, i) => {
                const isToday = dayKey(date) === todayKey;
                const weekend = date.getDay() === 0 || date.getDay() === 6;
                return <div key={dayKey(date)} className={`k-bg${isToday ? " today" : ""}${weekend ? " we" : ""}`} style={{ gridRow: `1 / span ${row.laneCount}`, gridColumn: i + 2 }} />;
              })}
              {row.items.map((item) => (
                <button
                  type="button"
                  key={`${item.kind}-${item.id}`}
                  className={`k-ev ${item.tone}${item.done ? " kdone" : ""}${item.conflict ? " kcf" : ""}`}
                  style={{ gridRow: item.lane + 1, gridColumn: `${item.startIdx + 2} / span ${item.endIdx - item.startIdx + 1}` }}
                  title={[item.title, item.sub].filter(Boolean).join(" · ")}
                  onClick={() => openItem(item)}
                >
                  <b>{item.title}</b>
                  {item.sub ? <span>{item.sub}</span> : null}
                  {item.conflict ? <em>Conflit</em> : null}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const eyebrow = [
    plural(weekCount.projects, "chantier actif", "chantiers actifs"),
    plural(weekCount.workers, "intervenant"),
    `${weekCount.rdv} RDV cette semaine`
  ].join(" · ");

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow">{eyebrow}</span>
          <h1>{L.calendrier.title}</h1>
        </div>
        <div className="hact">
          <Link href="/planning" className="btn btn-sec">Attribuer les tâches</Link>
          <button type="button" className="btn btn-main" onClick={openCreateEvent}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            Planifier un RDV
          </button>
        </div>
      </div>

      {message ? <p className="notice" role="status">{message}</p> : null}

      <div className="k-tabs">
        <div className="wtabs" role="tablist" aria-label="Vue du planning">
          <button type="button" role="tab" aria-selected={view === "intervenant"} className={view === "intervenant" ? "on" : ""} onClick={() => { setView("intervenant"); setOffset(0); }}>Par intervenant</button>
          <button type="button" role="tab" aria-selected={view === "chantier"} className={view === "chantier" ? "on" : ""} onClick={() => { setView("chantier"); setOffset(0); }}>Par chantier</button>
        </div>
      </div>

      <section className="k-panel" aria-label="Planning">
        <div className="k-tb">
          <div className="k-nav">
            <button type="button" className="k-ib" onClick={() => setOffset((value) => value - step)} aria-label="Période précédente">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
            </button>
            <button type="button" className="k-ib" onClick={() => setOffset((value) => value + step)} aria-label="Période suivante">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
            </button>
            <button type="button" className="btn btn-sec" onClick={() => setOffset(0)} disabled={offset === 0}>Aujourd'hui</button>
            <strong>{rangeLabel(rangeStart, rangeEnd)}</strong>
            <span>{step === 1 ? `Semaine ${isoWeek(rangeStart)}` : `Semaines ${isoWeek(rangeStart)} à ${isoWeek(rangeEnd)} · jours ouvrés`}</span>
          </div>
        </div>
        {renderGrid()}
        <div className="k-legend" aria-hidden="true">
          <span><i className="lt" />Équipe</span>
          <span><i className="ls" />Sous-traitant</span>
          <span><i className="lr" />Rendez-vous</span>
          <span><i className="ln" />À attribuer</span>
          <span><i className="lc" />Conflit</span>
        </div>
      </section>

      <div className="k-agenda">
        {agendaDays.length === 0 ? (
          <div className="tbl"><p className="empty">Rien de prévu dans les 14 prochains jours.</p></div>
        ) : agendaDays.map(({ date, items }) => (
          <section className="card" key={dayKey(date)}>
            <div className="card-h">
              <h2>{dayTitle(date)}</h2>
              {dayKey(date) === todayKey ? <span className="tag tag-b">Aujourd'hui</span> : null}
            </div>
            {items.map((item) => (
              <button type="button" className="row" key={`${item.kind}-${item.id}`} onClick={() => openItem(item)}>
                <div className="t"><strong>{item.title}</strong><small>{item.sub}</small></div>
                <span className={item.kind === "event" ? "tag tag-e" : "tag tag-o"}>{item.kind === "event" ? "RDV" : "Tâche"}</span>
              </button>
            ))}
          </section>
        ))}
      </div>

      <div className="k-cards">
        <section className="card k-today">
          <div className="card-h"><h2>Aujourd'hui · {new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric" }).format(today)}</h2></div>
          {todayItems.length === 0 ? <p className="empty">Rien de prévu aujourd'hui.</p> : todayItems.map((item) => (
            <button type="button" className="row" key={`${item.kind}-${item.id}`} onClick={() => openItem(item)}>
              <div className="t"><strong>{item.title}</strong><small>{item.sub}</small></div>
            </button>
          ))}
        </section>

        <section className="card">
          <div className="card-h"><h2>À régler{conflicts.length ? <span className="kcnt">{conflicts.length}</span> : null}</h2></div>
          {conflicts.length === 0 ? <p className="empty">Aucun conflit cette semaine.</p> : conflicts.map((conflict) => (
            <div className="row" key={conflict.id}>
              <div className="t">
                <strong>{conflict.worker} sur deux chantiers</strong>
                <small>{dayTitle(conflict.date)} : {conflict.projects.join(" et ")}</small>
              </div>
              <span className="tag tag-b">Conflit</span>
            </div>
          ))}
        </section>

        <section className="card">
          <div className="card-h">
            <h2>À planifier{toPlan.length ? <span className="kcnt">{toPlan.length}</span> : null}</h2>
            {toPlan.length ? <Link href="/planning" className="link">Attribuer</Link> : null}
          </div>
          {toPlan.length === 0 ? <p className="empty">Toutes les tâches ont une date et un intervenant.</p> : toPlan.slice(0, 6).map((entry) => (
            <div className="row" key={entry.id}>
              <div className="t"><strong>{entry.title}</strong><small>{entry.sub}</small></div>
            </div>
          ))}
          {toPlan.length > 6 ? <p className="muted">et {toPlan.length - 6} autre{toPlan.length - 6 > 1 ? "s" : ""}</p> : null}
        </section>
      </div>

      {detailTask ? (
        <div className="pmodal-bg" onClick={() => setDetailTask(null)}>
          <div className="pmodal" role="dialog" aria-modal="true" aria-label={detailTask.label} onClick={(event) => event.stopPropagation()}>
            <div className="card-h">
              <h2>{detailTask.label}</h2>
              <button type="button" className="link" onClick={() => setDetailTask(null)}>Fermer</button>
            </div>
            <div>
              <div className="kv"><span>{L.calendrier.project}</span><b>{detailTask.project}</b></div>
              {detailTask.task.room ? <div className="kv"><span>Pièce</span><b>{fixText(detailTask.task.room)}</b></div> : null}
              <div className="kv"><span>Dates</span><b>{new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(detailTask.start)} → {new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(detailTask.end)}</b></div>
              <div className="kv"><span>{L.calendrier.workers}</span><b>{detailTask.workerNames || "À attribuer"}</b></div>
              <div className="kv"><span>{L.calendrier.status}</span><b>{detailTask.done ? "Terminée" : fixText(detailTask.task.status || "À faire")}</b></div>
            </div>
            <p className="muted">{L.calendrier.taskFromPlanning}</p>
            <div className="pm-act">
              <Link href="/planning" className="btn btn-sec">Attribuer</Link>
              {detailTask.task.projectId ? <Link href={`/chantiers?project=${detailTask.task.projectId}`} className="btn btn-main">Ouvrir le chantier</Link> : null}
            </div>
          </div>
        </div>
      ) : null}

      {formOpen ? (
        <div className="pmodal-bg" onClick={closeForm}>
          <form className="pmodal" role="dialog" aria-modal="true" aria-label={editingEventId ? L.calendrier.editEvent : L.calendrier.newEvent} onClick={(event) => event.stopPropagation()} onSubmit={submitEvent}>
            <div className="card-h">
              <h2>{editingEventId ? L.calendrier.editEvent : L.calendrier.newEvent}</h2>
              <button type="button" className="link" onClick={closeForm}>Fermer</button>
            </div>
            <div className="fgrid">
              <label className="full">{L.calendrier.eventTitle}<input value={form.title} onChange={(event) => setField("title", event.target.value)} /></label>
              <label>{L.calendrier.eventType}
                <select value={form.eventType} onChange={(event) => setField("eventType", event.target.value)}>
                  {eventTypes.map((type) => <option key={type}>{type}</option>)}
                </select>
              </label>
              <label>{L.calendrier.status}
                <select value={form.status} onChange={(event) => setField("status", event.target.value)}>
                  {statuses.map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
              <label className="full">{L.calendrier.project}
                <select value={form.projectId} onChange={(event) => chooseProject(event.target.value)}>
                  <option value="">{L.calendrier.noProject}</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
                </select>
              </label>
              <label>{L.calendrier.client}<input value={form.clientName} onChange={(event) => setField("clientName", event.target.value)} /></label>
              <label>Avancement (%)<input type="number" min="0" max="100" value={form.progress} onChange={(event) => setField("progress", event.target.value)} /></label>
              <label>{L.calendrier.startAt}<input type="datetime-local" value={form.startAt} onChange={(event) => setField("startAt", event.target.value)} required /></label>
              <label>{L.calendrier.endAt}<input type="datetime-local" value={form.endAt} onChange={(event) => setField("endAt", event.target.value)} /></label>
              <label className="full">{L.calendrier.address}<input value={form.address} onChange={(event) => setField("address", event.target.value)} /></label>
              <label className="full">{L.calendrier.notes}<input value={form.notes} onChange={(event) => setField("notes", event.target.value)} /></label>
            </div>
            <div className="pm-sec">
              <h3>{L.calendrier.workers}</h3>
              {workers.length === 0 ? <p className="muted">{L.calendrier.noParticipants}</p> : (
                <div className="chips">
                  {workers.map((worker) => {
                    const on = form.workerIds.includes(worker.id);
                    return (
                      <button type="button" key={worker.id} className={`chip${on ? " on" : ""}`} aria-pressed={on} onClick={() => toggleWorker(worker.id)}>
                        <b>{worker.name}</b>
                        <small>{worker.type || "Ouvrier"} · {worker.profession || worker.role}</small>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="pm-act">
              {editingEventId ? <button type="button" className="btn btn-sec k-del" onClick={deleteEvent}>{L.calendrier.delete}</button> : null}
              <button type="button" className="btn btn-sec" onClick={closeForm}>{L.common.cancel}</button>
              <button type="submit" className="btn btn-main">{L.calendrier.save}</button>
            </div>
          </form>
        </div>
      ) : null}
    </Shell>
  );
}
