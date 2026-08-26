"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Shell } from "../components/Shell";
import { apiSend, readStoredUser } from "../lib/client-api";
import { useLocale } from "../lib/i18n";
import { euro, shortDate } from "../lib/pricing";
import { useApi } from "../lib/use-api";

const URGENT_LABELS = { degat: "Dégât", fuite: "Fuite", urgence: "Urgence", incendie: "Incendie", autre: "Alerte" };
const URGENT_ICONS  = { degat: "🧱", fuite: "💧", urgence: "⚡", incendie: "🔥", autre: "⚠️" };

const QA_TYPE_KEYS  = ["tache", "rdv", "depense", "note", "intervention"];
const QA_TYPE_EMOJIS = { tache: "✅", rdv: "📅", depense: "💰", note: "📝", intervention: "🔧" };

function timeAgo(value) {
  if (!value) return "";
  const diff = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value));
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function IconProject() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function IconQuote() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

function IconIntervention() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function IconArchive() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconMapPin() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconWorker() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function formatAgendaDate(dateStr) {
  if (!dateStr) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const d = new Date(dateStr + "T00:00:00");
  if (d.getTime() === today.getTime()) return "Aujourd'hui";
  if (d.getTime() === tomorrow.getTime()) return "Demain";
  return new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" }).format(d);
}

function extractTime(isoStr) {
  if (!isoStr) return null;
  const m = String(isoStr).match(/T(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : null;
}

function AgendaCard({ item, onMarkDone }) {
  const router = useRouter();
  const { L } = useLocale();
  const [open, setOpen] = useState(false);
  const isRdv = item.type === "rdv";

  return (
    <article className={`home-agenda-item${open ? " open" : ""}`}>
      <button
        type="button"
        className="home-agenda-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={`home-agenda-date-badge${item.isToday ? " today" : ""}`}>
          {item.dateLabel}
          {item.time ? <em className="home-agenda-time-em">{item.time}</em> : null}
        </span>
        <span className={`home-agenda-type-chip${isRdv ? " rdv" : " task"}`}>
          {isRdv ? L.agenda.rdv : L.agenda.task}
        </span>
        <div className="home-agenda-main">
          <strong>{item.title}</strong>
          {item.subtitle ? <small>{item.subtitle}</small> : null}
        </div>
        <svg
          className={`home-agenda-chevron${open ? " open" : ""}`}
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open ? (
        <div className="home-agenda-body">
          {isRdv ? (
            <>
              {item.address ? (
                <div className="home-agenda-detail"><IconMapPin /> {item.address}</div>
              ) : null}
              {item.workers?.length > 0 ? (
                <div className="home-agenda-detail">
                  <IconWorker /> {item.workers.map((w) => w.name || w).filter(Boolean).join(", ")}
                </div>
              ) : null}
              {item.eventType ? (
                <div className="home-agenda-detail"><IconCalendar /> {item.eventType}</div>
              ) : null}
              {item.notes ? <p className="home-agenda-notes">{item.notes}</p> : null}
              <div className="home-agenda-footer">
                <button type="button" className="home-agenda-nav" onClick={() => router.push("/planning")}>
                  {L.agenda.seePlan}
                </button>
              </div>
            </>
          ) : (
            <>
              {item.assignedTo ? (
                <div className="home-agenda-detail"><IconWorker /> {item.assignedTo}</div>
              ) : null}
              <div className="home-agenda-footer">
                <button type="button" className="home-agenda-done" onClick={() => onMarkDone(item.raw)}>
                  <IconCheck /> {L.agenda.markDone}
                </button>
                {item.projectId ? (
                  <button
                    type="button"
                    className="home-agenda-nav"
                    onClick={() => router.push(`/chantiers?project=${item.projectId}`)}
                  >
                    {L.agenda.seeProject}
                  </button>
                ) : null}
              </div>
            </>
          )}
        </div>
      ) : null}
    </article>
  );
}

function QuickAddModal({ projects, onClose, onTaskAdded, onEventAdded, onOpenIntervention }) {
  const { L } = useLocale();
  const todayStr = new Date().toISOString().slice(0, 10);
  const [type, setType]         = useState("tache");
  const [label, setLabel]       = useState("");
  const [date, setDate]         = useState(todayStr);
  const [time, setTime]         = useState("09:00");
  const [client, setClient]     = useState("");
  const [amount, setAmount]     = useState("");
  const [category, setCategory] = useState("Matériaux");
  const [eventType, setEventType] = useState("RDV Client");
  const [notes, setNotes]       = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [projectId, setProjectId] = useState("");
  const [sending, setSending]   = useState(false);
  const [done, setDone]         = useState(false);
  const [error, setError]       = useState("");

  const activeProjects = projects.filter((p) => p.status !== "Archive");
  const selectedProject = activeProjects.find((p) => p.id === projectId);

  function resetForm() {
    setLabel(""); setDate(todayStr); setTime("09:00");
    setClient(""); setAmount(""); setNotes(""); setAssignedTo(""); setError("");
  }

  function switchType(t) {
    if (t === "intervention") { onOpenIntervention?.(); return; }
    setType(t);
    resetForm();
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!label.trim()) { setError(L.common.error + " — champ vide"); return; }
    if (type === "depense") {
      if (!projectId) { setError(L.common.error); return; }
      if (Number(amount) <= 0) { setError(L.common.error); return; }
    }
    setSending(true);
    try {
      if (type === "tache" || type === "note") {
        const { task } = await apiSend("/api/tasks", {
          label: label.trim(),
          project: selectedProject?.title || "",
          projectId: projectId || "",
          startDate: date,
          dueDate: date,
          assignedTo: assignedTo.trim() || L.nav.team,
          notes: notes.trim(),
        }, "POST");
        onTaskAdded?.(task);
      } else if (type === "rdv") {
        const { calendarEvent } = await apiSend("/api/calendar-events", {
          title: label.trim(),
          eventType,
          clientName: client.trim() || selectedProject?.client || "",
          projectId: projectId || "",
          projectTitle: selectedProject?.title || "",
          startAt: `${date}T${time}:00`,
          endAt: `${date}T${time}:00`,
          allDay: false,
          notes: notes.trim(),
        }, "POST");
        onEventAdded?.(calendarEvent);
      } else if (type === "depense") {
        await apiSend("/api/expenses", {
          label: label.trim(),
          amount: Number(amount),
          category,
          projectId,
          projectTitle: selectedProject?.title || "",
          notes: notes.trim(),
        }, "POST");
      }
      setDone(true);
      setTimeout(() => onClose(), 1100);
    } catch {
      setError(L.common.error);
      setSending(false);
    }
  }

  const qa = L.quickAdd;
  const submitLabel = { tache: qa.submitTask, rdv: qa.submitRdv, depense: qa.submitExpense, note: qa.submitNote }[type];
  const qaTypes = QA_TYPE_KEYS.map((k) => ({
    key: k,
    emoji: QA_TYPE_EMOJIS[k],
    label: { tache: qa.typeTask, rdv: qa.typeRdv, depense: qa.typeExpense, note: qa.typeNote, intervention: qa.typeIntervention }[k],
  }));

  return (
    <div className="qa-overlay" onClick={onClose}>
      <div className="qa-modal" onClick={(e) => e.stopPropagation()}>
        <div className="qa-header">
          <strong>{qa.title}</strong>
          <button type="button" className="qa-close" onClick={onClose} aria-label={L.common.close}>✕</button>
        </div>

        <div className="qa-tabs">
          {qaTypes.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`qa-tab${type === t.key ? " active" : ""}`}
              onClick={() => switchType(t.key)}
            >
              <span>{t.emoji}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {done ? (
          <div className="qa-success">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="9 12 12 15 16 9" />
            </svg>
            {qa.success}
          </div>
        ) : (
          <form className="qa-form" onSubmit={submit}>

            {/* Label / texte principal */}
            <div className="qa-field">
              <label className="qa-label">
                {type === "note" ? qa.fieldNote : type === "depense" ? qa.fieldLabel : type === "rdv" ? qa.fieldRdv : qa.fieldTask}
              </label>
              <input
                type="text"
                className="qa-input"
                autoFocus
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={
                  type === "rdv"     ? (qa.shortcuts[1] || "") :
                  type === "depense" ? (qa.shortcuts[2] || "") :
                  type === "note"    ? qa.fieldNote :
                  (qa.shortcuts[0] || "")
                }
              />
              {type === "tache" ? (
                <div className="qa-chips">
                  {qa.shortcuts.map((s) => (
                    <button key={s} type="button" className="qa-chip" onClick={() => setLabel(s)}>{s}</button>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Date (toutes sauf note pure) */}
            {type !== "note" ? (
              <div className="qa-row">
                <div className="qa-field">
                  <label className="qa-label">{qa.fieldDate}</label>
                  <input type="date" className="qa-input" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                {type === "rdv" ? (
                  <div className="qa-field">
                    <label className="qa-label">{qa.fieldTime}</label>
                    <input type="time" className="qa-input" value={time} onChange={(e) => setTime(e.target.value)} />
                  </div>
                ) : null}
              </div>
            ) : null}

            {type === "rdv" ? (
              <div className="qa-row">
                <div className="qa-field">
                  <label className="qa-label">{qa.fieldRdvType}</label>
                  <select className="qa-input" value={eventType} onChange={(e) => setEventType(e.target.value)}>
                    {qa.rdvTypes.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="qa-field">
                  <label className="qa-label">{qa.fieldClient}</label>
                  <input type="text" className="qa-input" placeholder={qa.fieldClient} value={client} onChange={(e) => setClient(e.target.value)} />
                </div>
              </div>
            ) : null}

            {type === "depense" ? (
              <div className="qa-row">
                <div className="qa-field">
                  <label className="qa-label">{qa.fieldAmount} <span className="qa-req">*</span></label>
                  <input type="number" step="0.01" min="0.01" className="qa-input" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div className="qa-field">
                  <label className="qa-label">{qa.fieldCategory}</label>
                  <select className="qa-input" value={category} onChange={(e) => setCategory(e.target.value)}>
                    {qa.expenseCats.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            ) : null}

            {type === "tache" ? (
              <div className="qa-field">
                <label className="qa-label">{qa.fieldAssign} <span className="qa-opt">{qa.optional}</span></label>
                <input type="text" className="qa-input" placeholder={qa.fieldAssign} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} />
              </div>
            ) : null}

            <div className="qa-field">
              <label className="qa-label">
                {qa.fieldProject}
                {type === "depense"
                  ? <span className="qa-req"> *</span>
                  : <span className="qa-opt"> {qa.optional}</span>}
              </label>
              <select className="qa-input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">{qa.noProject}</option>
                {activeProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}{p.client ? ` · ${p.client}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {type === "rdv" || type === "note" ? (
              <div className="qa-field">
                <label className="qa-label">{qa.fieldNotes} <span className="qa-opt">{qa.optional}</span></label>
                <textarea className="qa-input qa-textarea" rows={3} placeholder={qa.fieldNotes} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            ) : null}

            {error ? <div className="qa-error">{error}</div> : null}

            <div className="qa-actions">
              <button type="button" className="qa-cancel" onClick={onClose}>{qa.cancel}</button>
              <button type="submit" className="qa-submit" disabled={sending || !label.trim()}>
                {sending ? qa.adding : submitLabel}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    "En cours": { bg: "#e0f2fe", color: "#0369a1" },
    "Devis genere": { bg: "#fef9c3", color: "#854d0e" },
    "En attente signature": { bg: "#fce7f3", color: "#9d174d" },
    "Signe": { bg: "#dcfce7", color: "#166534" },
    "Archive": { bg: "#f1f5f9", color: "#64748b" },
    "Brouillon": { bg: "#f1f5f9", color: "#475569" },
    "Pret a envoyer": { bg: "#fef3c7", color: "#92400e" },
    "Envoye": { bg: "#dbeafe", color: "#1d4ed8" },
  };
  const style = map[status] || { bg: "#f1f5f9", color: "#64748b" };
  return (
    <span className="home-status-badge" style={{ background: style.bg, color: style.color }}>
      {status}
    </span>
  );
}

function Section({ title, href, children, count, headerAction }) {
  return (
    <section className="home-section">
      <div className="home-section-head">
        {href ? (
          <Link href={href} className="home-section-title-link">
            <h2>{title}</h2>
            {count != null ? <span className="home-section-count">{count}</span> : null}
            <ChevronRight />
          </Link>
        ) : (
          <div className="home-section-title-link">
            <h2>{title}</h2>
          </div>
        )}
        {headerAction || null}
      </div>
      <div className="home-section-card">{children}</div>
    </section>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { L } = useLocale();
  const { data: projects, setData: setProjects } = useApi("/api/projects", "projects");
  const { data: quotes, setData: setQuotes } = useApi("/api/quotes", "quotes");
  const { data: invoices } = useApi("/api/invoices", "invoices");
  const { data: expenses } = useApi("/api/expenses", "expenses");
  const { data: interventions, setData: setInterventions } = useApi("/api/interventions", "interventions");
  const { data: tasks, setData: setTasks } = useApi("/api/tasks", "tasks");
  const { data: calendarEvents, setData: setCalendarEvents } = useApi("/api/calendar-events", "calendarEvents");
  const { data: urgentAlerts, setData: setUrgentAlerts } = useApi("/api/urgent-alerts", "alerts");

  const [confirmDeleteQuote, setConfirmDeleteQuote] = useState(null);
  const [confirmDeleteProject, setConfirmDeleteProject] = useState(null);
  const [confirmDeleteIntervention, setConfirmDeleteIntervention] = useState(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [greetingName, setGreetingName] = useState("");
  const [revenueOpen, setRevenueOpen] = useState(false);

  useEffect(() => {
    const user = readStoredUser();
    if (!user) return;
    setGreetingName(user.name || (user.email ? user.email.split("@")[0] : ""));
  }, []);

  const activeProjects = projects.filter((p) => p.status !== "Archive");
  const activeInterventions = interventions.filter((i) => i.status !== "archivee");
  const today = new Date().toISOString().slice(0, 10);

  function interventionWorkStatus(item) {
    if (item.completedAt) return "terminee";
    return item.date && item.date <= today ? "en_cours" : "a_faire";
  }

  function interventionStatus(item) {
    if (item.status === "facturee") return { label: L.interventions.statusLabels.facturee, className: "status-green" };
    const work = interventionWorkStatus(item);
    const className = work === "terminee" ? "status-green" : work === "en_cours" ? "status-blue" : "status-neutral";
    return { label: L.interventions.workStatusLabels[work], className };
  }

  const agendaItems = useMemo(() => {
    const rdvItems = calendarEvents
      .filter((e) => {
        const d = (e.startAt || "").slice(0, 10);
        return d >= today && e.status !== "Termine";
      })
      .map((e) => {
        const dateStr = (e.startAt || "").slice(0, 10);
        return {
          type: "rdv",
          id: `rdv-${e.id}`,
          sortKey: e.startAt || dateStr,
          dateLabel: formatAgendaDate(dateStr),
          isToday: dateStr === today,
          time: e.allDay ? null : extractTime(e.startAt),
          title: e.title,
          subtitle: [e.clientName, e.projectTitle].filter(Boolean).join(" · "),
          address: e.address,
          workers: e.workers || [],
          notes: e.notes,
          eventType: e.eventType,
          projectId: e.projectId,
          raw: e,
        };
      });

    const taskItems = tasks
      .filter((t) => {
        if (t.done) return false;
        const d = (t.startDate || t.dueDate || "").slice(0, 10);
        return d && d >= today;
      })
      .map((t) => {
        const dateStr = (t.startDate || t.dueDate || "").slice(0, 10);
        return {
          type: "ouvrage",
          id: `task-${t.id}`,
          sortKey: dateStr + (t.startTime ? `T${t.startTime}` : "T00:00"),
          dateLabel: formatAgendaDate(dateStr),
          isToday: dateStr === today,
          time: t.startTime || null,
          title: t.label,
          subtitle: t.project || "",
          assignedTo: t.assignedTo,
          projectId: t.projectId,
          raw: t,
        };
      });

    return [...rdvItems, ...taskItems].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [calendarEvents, tasks, today]);

  const quotesInProgress = quotes.filter((q) => ["Brouillon", "Pret a envoyer", "Envoye"].includes(q.status));
  const billedRevenue = invoices.filter((i) => i.status !== "Annulee").reduce((s, i) => s + Number(i.amountTtc || 0), 0);
  // Devis envoyes au client, pas encore signes — l'intitule "en attente de
  // signature" doit vraiment representer ca, pas un reliquat facturation.
  const waitingRevenue = quotes.filter((q) => q.signatureStatus === "En attente").reduce((s, q) => s + Number(q.totalTtc || 0), 0);
  // Aucun mecanisme de refus cote client n'existe encore (le lien de
  // signature ne propose que "signer") — Annule est la seule approximation
  // disponible aujourd'hui (devis annules par l'entreprise elle-meme).
  const refusedRevenue = quotes.filter((q) => q.status === "Annule").reduce((s, q) => s + Number(q.totalTtc || 0), 0);
  const expensesByCategory = expenses.reduce((acc, expense) => {
    const category = expense.category || "Autres frais";
    acc[category] = (acc[category] || 0) + Number(expense.amount || 0);
    return acc;
  }, {});
  const totalExpenses = Object.values(expensesByCategory).reduce((s, v) => s + v, 0);
  const netEarned = billedRevenue - totalExpenses;

  async function markTaskDone(task) {
    try {
      const { task: updated } = await apiSend("/api/tasks", { id: task.id, action: "toggle" }, "PATCH");
      setTasks((prev) => prev.map((t) => t.id === updated.id ? updated : t));
    } catch { /**/ }
  }

  async function archiveQuote(quoteId) {
    try {
      const { quote } = await apiSend("/api/quotes", { id: quoteId, action: "archive" }, "PATCH");
      setQuotes((prev) => prev.map((q) => q.id === quote.id ? quote : q));
    } catch { /**/ }
  }

  async function deleteQuote(quoteId) {
    try {
      await apiSend("/api/quotes", { id: quoteId, action: "delete" }, "PATCH");
      setQuotes((prev) => prev.filter((q) => q.id !== quoteId));
    } catch { /**/ }
    setConfirmDeleteQuote(null);
  }

  async function archiveProject(projectId) {
    try {
      const { project } = await apiSend("/api/projects", { id: projectId, action: "archive" }, "PATCH");
      setProjects((prev) => prev.map((p) => p.id === project.id ? project : p));
    } catch { /**/ }
  }

  async function deleteProject(projectId) {
    try {
      await apiSend("/api/projects", { id: projectId, action: "delete" }, "PATCH");
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch { /**/ }
    setConfirmDeleteProject(null);
  }

  async function archiveIntervention(interventionId) {
    try {
      const { intervention } = await apiSend("/api/interventions", { id: interventionId, status: "archivee" }, "PATCH");
      setInterventions((prev) => prev.map((item) => item.id === intervention.id ? intervention : item));
    } catch { /**/ }
  }

  async function deleteIntervention(interventionId) {
    try {
      await apiSend("/api/interventions", { id: interventionId, action: "delete" }, "PATCH");
      setInterventions((prev) => prev.filter((item) => item.id !== interventionId));
    } catch { /**/ }
    setConfirmDeleteIntervention(null);
  }

  async function resolveAlert(alertId) {
    try {
      await apiSend("/api/urgent-alerts", { id: alertId, action: "resolve" }, "PATCH");
      setUrgentAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch { /**/ }
  }

  return (
    <Shell>
      {showQuickAdd ? (
        <QuickAddModal
          projects={projects}
          onClose={() => setShowQuickAdd(false)}
          onTaskAdded={(task) => setTasks((prev) => [task, ...prev])}
          onEventAdded={(event) => setCalendarEvents((prev) => [event, ...prev])}
          onOpenIntervention={() => { setShowQuickAdd(false); router.push("/interventions?new=1"); }}
        />
      ) : null}
      <div className="home-feed">

        {greetingName ? <h1 className="home-greeting">Bonjour {greetingName}</h1> : null}

        {/* Alertes urgentes */}
        {urgentAlerts.length > 0 ? (
          <div className="home-urgent-section">
            <div className="home-urgent-header">
              <span className="home-urgent-pulse" />
              <strong>Alertes urgentes</strong>
              <span className="home-urgent-count">{urgentAlerts.length}</span>
            </div>
            <div className="home-urgent-list">
              {urgentAlerts.map((alert) => (
                <div key={alert.id} className="home-urgent-card">
                  <button
                    type="button"
                    className="home-urgent-card-body"
                    onClick={() => router.push(`/chantiers?project=${alert.projectId}`)}
                  >
                    <div className="home-urgent-top">
                      <span className="home-urgent-type-badge">
                        {URGENT_ICONS[alert.type] || "⚠️"} {URGENT_LABELS[alert.type] || "Urgence"}
                      </span>
                      <span className="home-urgent-source-badge">
                        {alert.source === "client" ? "👤 Client" : "👷 Ouvrier"} · {alert.senderName}
                      </span>
                      <span className="home-urgent-time">{timeAgo(alert.createdAt)}</span>
                    </div>
                    <strong className="home-urgent-project">{alert.projectTitle}</strong>
                    <p className="home-urgent-msg">{alert.message}</p>
                    {alert.taskLabels?.length > 0 ? (
                      <div className="home-urgent-tasks">
                        {alert.taskLabels.map((label, i) => (
                          <span key={i} className="home-urgent-task-tag">{label}</span>
                        ))}
                      </div>
                    ) : null}
                  </button>
                  <div className="home-urgent-actions">
                    <button
                      type="button"
                      className="home-urgent-goto"
                      onClick={() => router.push(`/chantiers?project=${alert.projectId}`)}
                    >
                      Voir le chantier →
                    </button>
                    <button
                      type="button"
                      className="home-urgent-resolve"
                      onClick={() => resolveAlert(alert.id)}
                    >
                      {L.agenda.resolve}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <Link className="home-primary-action" href="/devis?new=1">
          <span className="home-primary-plus">+</span>
          {activeProjects.length === 0 ? L.home.firstProject : L.home.newProject}
        </Link>

        {/* Chiffre d'affaires */}
        <section className="home-section">
          <button type="button" className="home-section-head home-revenue-toggle" onClick={() => setRevenueOpen((v) => !v)}>
            <div className="home-section-title-link">
              <h2>{L.home.revenue}</h2>
            </div>
            <span className={`home-revenue-chevron${revenueOpen ? " open" : ""}`}><ChevronRight /></span>
          </button>
          {revenueOpen ? (
            <div className="home-section-card home-revenue-detail">
              <div className="home-revenue-line home-revenue-top">
                <span>{L.home.billed}</span>
                <strong>{euro(billedRevenue)}</strong>
              </div>

              <p className="home-revenue-subhead">{L.home.revenueExpenses}</p>
              {Object.keys(expensesByCategory).length === 0 ? (
                <p className="home-revenue-empty">{L.common.noData}</p>
              ) : (
                Object.entries(expensesByCategory).map(([category, amount]) => (
                  <div className="home-revenue-line" key={category}>
                    <span>{category}</span>
                    <strong>{euro(amount)}</strong>
                  </div>
                ))
              )}
              <div className="home-revenue-line home-revenue-total-expenses">
                <span>{L.home.revenueTotalExpenses}</span>
                <strong>{euro(totalExpenses)}</strong>
              </div>

              <div className="home-revenue-line home-revenue-net">
                <span>{L.home.revenueNet}</span>
                <strong className={netEarned >= 0 ? "positive" : "negative"}>{euro(netEarned)}</strong>
              </div>
              <div className="home-revenue-line">
                <span>{L.home.waitingSig}</span>
                <strong>{euro(waitingRevenue)}</strong>
              </div>
              <div className="home-revenue-line">
                <span>{L.home.revenueRefused}</span>
                <strong>{euro(refusedRevenue)}</strong>
              </div>

              <Link href="/facturation" className="home-revenue-more-link">{L.home.viewBilling} →</Link>
            </div>
          ) : null}
        </section>

        {/* À faire maintenant */}
        <Section
          title={L.home.todoNow}
          href="/planning"
          count={agendaItems.length || null}
          headerAction={
            <button type="button" className="home-section-add-btn" onClick={() => setShowQuickAdd(true)}>
              {L.home.add}
            </button>
          }
        >
          {agendaItems.length === 0 ? (
            <div className="home-empty">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#c5b8a7" strokeWidth="1.5"><polyline points="20 6 9 17 4 12" /></svg>
              <strong>{L.home.upToDate}</strong>
              <span>{L.home.upToDateSub}</span>
            </div>
          ) : (
            <div className="home-agenda-list">
              {agendaItems.map((item) => (
                <AgendaCard key={item.id} item={item} onMarkDone={markTaskDone} />
              ))}
            </div>
          )}
        </Section>

        {/* Devis en cours */}
        <Section title={L.home.quotesSection} href="/devis" count={quotesInProgress.length || null}>
          {quotesInProgress.length === 0 ? (
            <div className="home-empty">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#c5b8a7" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
              <strong>{L.home.noQuotes}</strong>
              <span>{L.home.noQuotesSub}</span>
            </div>
          ) : (
            <div className="home-list">
              {quotesInProgress.slice(0, 5).map((quote) => (
                <article className="home-list-item home-quote-item" key={quote.id}>
                  <Link href={`/devis?id=${quote.id}`} className="home-list-link home-quote-link">
                    <div className="home-list-icon home-icon-quote">
                      <IconQuote />
                    </div>
                    <div className="home-list-main">
                      <strong>{quote.client}</strong>
                      <small>{[quote.quoteNumber, quote.project].filter(Boolean).join(" · ")}</small>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <StatusBadge status={quote.status} />
                      <div style={{ fontSize: "0.78rem", color: "#7e715f", fontWeight: 700, marginTop: 3 }}>{euro(quote.totalTtc)}</div>
                    </div>
                  </Link>
                  <div className="home-task-actions">
                    {confirmDeleteQuote === quote.id ? (
                      <span className="home-task-confirm">
                        <button className="home-task-btn home-task-btn-danger" onClick={() => deleteQuote(quote.id)}>{L.common.delete}</button>
                        <button className="home-task-btn" onClick={() => setConfirmDeleteQuote(null)}>{L.common.no}</button>
                      </span>
                    ) : (
                      <>
                        <button className="home-task-btn" title={L.common.archive} onClick={() => archiveQuote(quote.id)}>
                          <IconArchive />
                        </button>
                        <button className="home-task-btn home-task-btn-delete" title={L.common.delete} onClick={() => setConfirmDeleteQuote(quote.id)}>
                          <IconTrash />
                        </button>
                      </>
                    )}
                  </div>
                </article>
              ))}
              {quotesInProgress.length > 5 ? (
                <Link href="/devis" className="home-more-link">
                  {L.home.seeMore(quotesInProgress.length - 5)} <ChevronRight />
                </Link>
              ) : null}
            </div>
          )}
        </Section>

        {/* Chantiers */}
        <Section title={L.home.projects} href="/chantiers" count={activeProjects.length || null}>
          {activeProjects.length === 0 ? (
            <div className="home-empty">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#c5b8a7" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
              <strong>{L.home.noProjects}</strong>
              <span>{L.home.noProjectsSub}</span>
            </div>
          ) : (
            <div className="home-list">
              {activeProjects.slice(0, 5).map((project) => (
                <article className="home-list-item home-quote-item" key={project.id}>
                  <Link href={`/chantiers?project=${project.id}`} className="home-list-link home-quote-link">
                    <div className="home-list-icon home-icon-project">
                      <IconProject />
                    </div>
                    <div className="home-list-main">
                      <strong>{project.title}</strong>
                      <small>{[project.client, project.startDate ? shortDate(project.startDate) : null].filter(Boolean).join(" · ")}</small>
                    </div>
                    <StatusBadge status={project.status} />
                  </Link>
                  <div className="home-task-actions">
                    {confirmDeleteProject === project.id ? (
                      <span className="home-task-confirm">
                        <button className="home-task-btn home-task-btn-danger" onClick={() => deleteProject(project.id)}>{L.common.delete}</button>
                        <button className="home-task-btn" onClick={() => setConfirmDeleteProject(null)}>{L.common.no}</button>
                      </span>
                    ) : (
                      <>
                        <button className="home-task-btn" title={L.common.archive} onClick={() => archiveProject(project.id)}>
                          <IconArchive />
                        </button>
                        <button className="home-task-btn home-task-btn-delete" title={L.common.delete} onClick={() => setConfirmDeleteProject(project.id)}>
                          <IconTrash />
                        </button>
                      </>
                    )}
                  </div>
                </article>
              ))}
              {activeProjects.length > 5 ? (
                <Link href="/chantiers" className="home-more-link">
                  {L.home.seeMore(activeProjects.length - 5)} <ChevronRight />
                </Link>
              ) : null}
            </div>
          )}
        </Section>

        {/* Interventions */}
        <Section title={L.interventions.title} href="/interventions" count={activeInterventions.length || null}>
          {activeInterventions.length === 0 ? (
            <div className="home-empty">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#c5b8a7" strokeWidth="1.5"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>
              <strong>{L.interventions.empty}</strong>
            </div>
          ) : (
            <div className="home-list">
              {activeInterventions.slice(0, 5).map((item) => {
                const status = interventionStatus(item);
                return (
                  <article className="home-list-item home-quote-item" key={item.id}>
                    <Link href={`/interventions?open=${item.id}`} className="home-list-link home-quote-link">
                      <div className="home-list-icon home-icon-intervention">
                        <IconIntervention />
                      </div>
                      <div className="home-list-main">
                        <strong>{item.client}</strong>
                        <small>{[item.site, shortDate(item.date)].filter(Boolean).join(" · ")}</small>
                      </div>
                      <span className={`intervention-status-badge ${status.className}`}>{status.label}</span>
                    </Link>
                    <div className="home-task-actions">
                      {confirmDeleteIntervention === item.id ? (
                        <span className="home-task-confirm">
                          <button className="home-task-btn home-task-btn-danger" onClick={() => deleteIntervention(item.id)}>{L.common.delete}</button>
                          <button className="home-task-btn" onClick={() => setConfirmDeleteIntervention(null)}>{L.common.no}</button>
                        </span>
                      ) : (
                        <>
                          <button className="home-task-btn" title={L.common.archive} onClick={() => archiveIntervention(item.id)}>
                            <IconArchive />
                          </button>
                          <button className="home-task-btn home-task-btn-delete" title={L.common.delete} onClick={() => setConfirmDeleteIntervention(item.id)}>
                            <IconTrash />
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
              {activeInterventions.length > 5 ? (
                <Link href="/interventions" className="home-more-link">
                  {L.home.seeMore(activeInterventions.length - 5)} <ChevronRight />
                </Link>
              ) : null}
            </div>
          )}
        </Section>

      </div>
    </Shell>
  );
}
