"use client";

import Link from "next/link";
import { DM_Sans } from "next/font/google";
import { useEffect, useMemo, useState } from "react";
import { readStoredUser } from "../../../lib/client-api";
import { fixText } from "../../../lib/text";
import { useApi } from "../../../lib/use-api";
import "../../home-pro.css";

// PRO-11.1 : un seul outil d'export, trois modèles (semaine tous chantiers,
// un chantier, un intervenant). Page imprimable : « Enregistrer en PDF » du
// navigateur produit le PDF. Destinataire « Client » : sous-traitants non
// nommés et rendez-vous internes retirés.

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

function mondayOf(date) {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return day;
}

function longDate(date) {
  return date ? new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" }).format(date) : "—";
}

function days(start, end) {
  return Math.round((end - start) / 86400000) + 1;
}

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--f" });

const MODELS = [
  { id: "semaine", label: "Semaine, tous chantiers" },
  { id: "chantier", label: "Un chantier" },
  { id: "intervenant", label: "Un intervenant" }
];

export default function PlanningExportPage() {
  const { data: tasks, loading: loadingTasks } = useApi("/api/tasks", "tasks");
  const { data: events } = useApi("/api/calendar-events", "calendarEvents");
  const { data: projects } = useApi("/api/projects", "projects");
  const { data: workers } = useApi("/api/workers", "workers");
  const thisMonday = mondayOf(new Date());
  const [model, setModel] = useState("semaine");
  const [projectId, setProjectId] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [from, setFrom] = useState(dayKey(thisMonday));
  const [to, setTo] = useState(dayKey(new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() + 6)));
  const [audience, setAudience] = useState("interne");
  const [withRdv, setWithRdv] = useState(true);
  const [company, setCompany] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (MODELS.some((item) => item.id === params.get("model"))) setModel(params.get("model"));
    if (params.get("project")) setProjectId(params.get("project"));
    if (params.get("worker")) setWorkerId(params.get("worker"));
    if (parseDay(params.get("from"))) setFrom(params.get("from"));
    if (parseDay(params.get("to"))) setTo(params.get("to"));
    setCompany(fixText(readStoredUser()?.business?.raisonSociale || ""));
  }, []);

  const workerById = useMemo(() => Object.fromEntries(workers.map((worker) => [worker.id, worker])), [workers]);
  const project = projects.find((item) => item.id === projectId) || null;
  const worker = workerById[workerId] || null;

  const rows = useMemo(() => {
    const start = parseDay(from);
    const end = parseDay(to);
    const inPeriod = (row) => model === "chantier" || (!start || row.end >= start) && (!end || row.start <= end);
    const nameOf = (id) => {
      const person = workerById[id];
      if (!person) return "";
      return audience === "client" && person.type === "Sous-traitant" ? "Sous-traitant" : fixText(person.name || "");
    };
    const taskRows = tasks.map((task) => {
      const s = parseDay(task.startDate || task.dueDate || task.endDate);
      if (!s) return null;
      const e = parseDay(task.endDate || task.dueDate || task.startDate) || s;
      const ids = Array.isArray(task.workerIds) ? task.workerIds : [];
      return {
        id: task.id,
        start: s,
        end: e < s ? s : e,
        projectId: task.projectId || "",
        project: fixText(projects.find((item) => item.id === task.projectId)?.title || task.project || "Sans chantier"),
        label: fixText([task.room && task.room !== task.label ? task.room : "", task.label].filter(Boolean).join(" · ") || "Tâche"),
        workerIds: ids,
        who: [...new Set(ids.map(nameOf).filter(Boolean))].join(", ") || "à attribuer",
        done: Boolean(task.done)
      };
    }).filter(Boolean);
    const eventRows = withRdv && audience !== "client" ? events.map((event) => {
      const s = parseDay(event.startAt);
      if (!s) return null;
      const e = parseDay(event.endAt) || s;
      const ids = Array.isArray(event.workerIds) ? event.workerIds : [];
      return {
        id: event.id,
        start: s,
        end: e < s ? s : e,
        projectId: event.projectId || "",
        project: fixText(event.projectTitle || event.clientName || "Rendez-vous"),
        label: `Rendez-vous · ${fixText(event.title || "")}`,
        workerIds: ids,
        who: ids.map(nameOf).filter(Boolean).join(", ") || "—",
        done: event.status === "Termine"
      };
    }).filter(Boolean) : [];
    return [...taskRows, ...eventRows]
      .filter((row) => model !== "chantier" || (projectId && row.projectId === projectId))
      .filter((row) => model !== "intervenant" || (workerId && row.workerIds.includes(workerId)))
      .filter(inPeriod)
      .sort((a, b) => a.start - b.start || a.project.localeCompare(b.project));
  }, [tasks, events, projects, workerById, model, projectId, workerId, from, to, audience, withRdv]);

  const title = model === "chantier"
    ? `Planning du chantier ${project ? fixText(project.title) : ""}`
    : model === "intervenant"
      ? `Planning de ${worker ? (audience === "client" && worker.type === "Sous-traitant" ? "l'intervenant" : fixText(worker.name)) : "l'intervenant"}`
      : "Planning de la semaine";
  const period = model === "chantier" ? "chantier entier" : `du ${longDate(parseDay(from))} au ${longDate(parseDay(to))}`;
  const ready = model === "semaine" || (model === "chantier" && projectId) || (model === "intervenant" && workerId);

  return (
    <div className={`pro pe ${dmSans.variable}`}>
      <div className="pe-tools">
        <Link href="/calendrier" className="link">← Calendrier</Link>
        <label>Modèle
          <select value={model} onChange={(event) => setModel(event.target.value)}>
            {MODELS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        {model === "chantier" ? (
          <label>Chantier
            <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              <option value="">Choisir…</option>
              {projects.filter((item) => !item.archivedAt).map((item) => <option key={item.id} value={item.id}>{fixText(item.title)}</option>)}
            </select>
          </label>
        ) : null}
        {model === "intervenant" ? (
          <label>Intervenant
            <select value={workerId} onChange={(event) => setWorkerId(event.target.value)}>
              <option value="">Choisir…</option>
              {workers.map((item) => <option key={item.id} value={item.id}>{fixText(item.name)}{item.type === "Sous-traitant" ? " (sous-traitant)" : ""}</option>)}
            </select>
          </label>
        ) : null}
        {model !== "chantier" ? (
          <>
            <label>Du<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
            <label>Au<input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} /></label>
          </>
        ) : null}
        <label>Pour
          <select value={audience} onChange={(event) => setAudience(event.target.value)}>
            <option value="interne">Interne (tout)</option>
            <option value="client">Client (sous-traitants non nommés)</option>
          </select>
        </label>
        {audience !== "client" ? (
          <label className="chk"><input type="checkbox" checked={withRdv} onChange={(event) => setWithRdv(event.target.checked)} />Rendez-vous</label>
        ) : null}
        <button type="button" className="btn btn-main" onClick={() => window.print()} disabled={!ready}>Imprimer ou enregistrer en PDF</button>
      </div>

      <article className="pe-doc">
        <header className="pe-h">
          <div>
            <strong>{company || "Mon entreprise"}</strong>
            <h1>{title}</h1>
            <span>{period} · {rows.length} ligne{rows.length > 1 ? "s" : ""}</span>
          </div>
          <small>Édité le {new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date())}</small>
        </header>
        {!ready ? (
          <p className="empty">{model === "chantier" ? "Choisissez un chantier." : "Choisissez un intervenant."}</p>
        ) : loadingTasks ? (
          <p className="empty">Chargement…</p>
        ) : rows.length === 0 ? (
          <p className="empty">Rien de planifié sur cette période.</p>
        ) : (
          <table className="pe-t">
            <thead>
              <tr>
                <th>Début</th>
                <th>Fin</th>
                <th className="r">Jours</th>
                {model !== "chantier" ? <th>Chantier</th> : null}
                <th>Lot, tâche</th>
                {model !== "intervenant" ? <th>Intervenant</th> : null}
                <th>État</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.id}-${row.start.getTime()}`}>
                  <td>{longDate(row.start)}</td>
                  <td>{longDate(row.end)}</td>
                  <td className="r">{days(row.start, row.end)}</td>
                  {model !== "chantier" ? <td>{row.project}</td> : null}
                  <td>{row.label}</td>
                  {model !== "intervenant" ? <td>{row.who}</td> : null}
                  <td>{row.done ? "terminé" : "prévu"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
    </div>
  );
}
