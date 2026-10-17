"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Shell } from "../components/Shell";
import { PublicLanding } from "../components/PublicLanding";
import { apiGet, apiSend, readStoredUser } from "../lib/client-api";
import { useLocale } from "../lib/i18n";
import { euro, shortDate } from "../lib/pricing";
import { useApi } from "../lib/use-api";
import { metierVisuel } from "../lib/metier-visuel";
import "./dashboard.css";

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

function IconQuote() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" />
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

// ── Bloc "Chantiers disponibles" (design repris de la branche dashboard-imed
// du fork github.com/imedlachiheb/web-app-Koji, à sa demande) : mêmes routes
// existantes (/api/marketplace/offres/[id]/positionner et /messages), juste
// une présentation plus riche (vignette par métier, statut de suivi, etc.)
const OFFRES_VISIBLES = 6;
const NOUVEAU_HEURES = 48;
const MAX_POSITIONNEMENTS = 5; // même limite que /api/marketplace/offres/[id]/positionner

function IconBolt({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
    </svg>
  );
}

function IconPhoto() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-8 8" />
    </svg>
  );
}

// L'API renvoie l'adresse complète : on n'affiche que la ville.
function villeSeule(address) {
  const text = String(address || "").trim();
  const match = text.match(/\b\d{5}\s+(.+)$/);
  if (match) return match[1].trim();
  const parts = text.split(",").map((p) => p.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1].replace(/^\d{5}\s*/, "") : "";
}

// Titre court tiré de la description (l'app n'a pas encore de champ titre) :
// on garde le début de la phrase, avant les précisions.
const TITRE_COUPURES = [",", ".", ";", " : ", " - ", " qui ", " car ", " dans ", " pour ", " avec ", " depuis ", " et "];
const TITRE_MAX = 40;

function titreCourt(description) {
  let text = String(description || "").replace(/\s+/g, " ").trim();
  if (!text) return "Chantier";
  for (const sep of TITRE_COUPURES) {
    const index = text.indexOf(sep);
    if (index >= 15) text = text.slice(0, index);
  }
  if (text.length > TITRE_MAX) {
    const cut = text.slice(0, TITRE_MAX);
    text = `${cut.slice(0, cut.lastIndexOf(" ")) || cut}…`;
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function estNouveau(createdAt) {
  const time = new Date(createdAt || 0).getTime();
  return Number.isFinite(time) && Date.now() - time < NOUVEAU_HEURES * 3600 * 1000;
}

function publieLe(createdAt) {
  if (!createdAt) return "";
  const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
  if (diff < 3600) return "Publié à l'instant";
  if (diff < 86400) return `Publié il y a ${Math.floor(diff / 3600)} h`;
  const jours = Math.floor(diff / 86400);
  return jours === 1 ? "Publié hier" : `Publié il y a ${jours} jours`;
}

// Où en est un positionnement, d'après la conversation du chantier
// (route existante GET /api/marketplace/offres/[id]/messages).
function suiviDepuisMessages(messages) {
  const fil = Array.isArray(messages) ? messages : [];
  const dernier = fil[fil.length - 1];
  const propositions = fil.filter((m) => m.kind === "rdv_proposal" && m.rdvDate);
  const proposition = propositions[propositions.length - 1];
  const reponse = proposition ? fil.find((m) => m.kind === "rdv_response" && m.respondsToId === proposition.id) : null;
  const visite = proposition
    ? { date: proposition.rdvDate, statut: reponse?.rdvStatus === "accepted" ? "confirmee" : reponse?.rdvStatus === "declined" ? "refusee" : "proposee" }
    : null;
  const clientARepondu = Boolean(dernier && dernier.senderType === "particulier" && (dernier.kind || "text") === "text");
  return { clientARepondu, visite };
}

function dateVisite(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

function libelleSuivi(suivi) {
  if (suivi?.clientARepondu) return { texte: "Le client vous a répondu", ton: "action" };
  if (suivi?.visite?.statut === "confirmee") return { texte: `Visite confirmée · ${dateVisite(suivi.visite.date)}`, ton: "ok" };
  if (suivi?.visite?.statut === "proposee") return { texte: `Visite proposée · ${dateVisite(suivi.visite.date)}`, ton: "info" };
  if (suivi?.visite?.statut === "refusee") return { texte: "Visite refusée, proposez une autre date", ton: "action" };
  return { texte: "En attente du client", ton: "attente" };
}

function Vignette({ offre }) {
  const visuel = metierVisuel(offre.metier);
  return (
    <span className="kd-thumb" style={{ background: visuel.color }} aria-hidden="true">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {visuel.icon}
      </svg>
      {offre.photosCount ? <small><IconPhoto />{offre.photosCount}</small> : null}
    </span>
  );
}

function OffreCard({ offre, etat, onPositionner }) {
  const ville = villeSeule(offre.address);
  return (
    <article className="kd-offre">
      <Link href={`/marketplace/${offre.id}`} className="kd-offre-link">
        <Vignette offre={offre} />
        <span className="kd-offre-body">
          <strong className="kd-offre-title">{titreCourt(offre.description)}</strong>
          <span className="kd-offre-place">
            <span>{offre.metier}</span>
            {ville ? <span className="kd-ville"><IconMapPin /><span className="kd-ville-name">{ville}</span></span> : null}
          </span>
          {estNouveau(offre.createdAt)
            ? <span className="kd-new">Nouveau</span>
            : <span className="kd-when">{publieLe(offre.createdAt)}</span>}
        </span>
      </Link>
      <div className="kd-offre-actions">
        {etat?.positionnee ? (
          <span className="kd-positionne"><IconCheck /> Positionné</span>
        ) : (
          <button type="button" className="kd-btn kd-btn-navy" disabled={etat?.envoi} onClick={() => onPositionner(offre.id)}>
            {etat?.envoi ? "Envoi…" : "Me positionner"}
          </button>
        )}
        {etat?.erreur ? <p className="kd-offre-error" role="alert">{etat.erreur}</p> : null}
      </div>
    </article>
  );
}

function DashboardHome() {
  const router = useRouter();
  const { L } = useLocale();
  const { data: projects } = useApi("/api/projects", "projects");
  const { data: quotes, setData: setQuotes } = useApi("/api/quotes", "quotes");
  const { data: invoices } = useApi("/api/invoices", "invoices");
  const { data: tasks, setData: setTasks } = useApi("/api/tasks", "tasks");
  const { data: calendarEvents, setData: setCalendarEvents } = useApi("/api/calendar-events", "calendarEvents");
  const { data: urgentAlerts, setData: setUrgentAlerts } = useApi("/api/urgent-alerts", "alerts");
  const { data: offres, loading: offresLoading } = useApi("/api/marketplace/offres", "offres");

  const [confirmDeleteQuote, setConfirmDeleteQuote] = useState(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [greetingName, setGreetingName] = useState("");
  // "Mode Urgences" (26 sept, demande d'Amira) : fonctionnalite Koji Premium
  // — meme verrou que les pages de PREMIUM_PATHS dans components/Shell.jsx
  // (isAdmin ou premiumTools), pas un nouveau systeme de permission.
  const [premiumUnlocked, setPremiumUnlocked] = useState(false);
  const [profileComplete, setProfileComplete] = useState(true);
  const [positions, setPositions] = useState({}); // { [offreId]: { positionnee, envoi, erreur } }
  const [suivis, setSuivis] = useState({}); // { [offreId]: { clientARepondu, visite } }
  const [info, setInfo] = useState("");

  useEffect(() => {
    const user = readStoredUser();
    if (!user) return;
    setPremiumUnlocked(Boolean(user.isAdmin || user.premiumTools));
    setProfileComplete(Boolean(user.profileComplete && user.businessInfoComplete));
    setGreetingName(user.name || (user.email ? user.email.split("@")[0] : ""));
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const currentMonthLabel = new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(new Date());

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

  // Statut « déjà positionné » de chaque chantier (pas de route qui liste
  // tous les positionnements d'une entreprise : voir docs/NOTES-POUR-AMIRA.md)
  const idsOffres = offres.map((o) => o.id).join(",");
  useEffect(() => {
    if (!idsOffres) return;
    let annule = false;
    idsOffres.split(",").forEach(async (id) => {
      try {
        const data = await apiGet(`/api/marketplace/offres/${id}/positionner`);
        const positionnee = Boolean(data?.positionnee || data?.positionnement?.status === "Active");
        if (!annule && positionnee) setPositions((prev) => ({ ...prev, [id]: { positionnee: true } }));
      } catch { /**/ }
    });
    return () => { annule = true; };
  }, [idsOffres]);

  useEffect(() => {
    if (!info) return undefined;
    const timer = setTimeout(() => setInfo(""), 3500);
    return () => clearTimeout(timer);
  }, [info]);

  async function positionner(offreId) {
    setPositions((prev) => ({ ...prev, [offreId]: { envoi: true } }));
    try {
      await apiSend(`/api/marketplace/offres/${offreId}/positionner`, {});
      setPositions((prev) => ({ ...prev, [offreId]: { positionnee: true } }));
      setInfo("Positionnement envoyé au client");
    } catch (error) {
      setPositions((prev) => ({ ...prev, [offreId]: { erreur: error.message || "Le positionnement n'a pas pu être envoyé." } }));
    }
  }

  const mesPositionnements = offres.filter((o) => positions[o.id]?.positionnee);
  const idsPositionnes = mesPositionnements.map((o) => o.id).join(",");
  const reponsesClients = mesPositionnements.filter((o) => suivis[o.id]?.clientARepondu);
  const offresDisponibles = offres.filter((o) => !positions[o.id]?.positionnee);
  const offresVisibles = offresDisponibles.slice(0, OFFRES_VISIBLES);
  const offresRestantes = offresDisponibles.length - offresVisibles.length;
  const nouveauxChantiers = offresDisponibles.filter((o) => estNouveau(o.createdAt)).length;

  // Suivi de chaque positionnement : réponse du client, visite
  useEffect(() => {
    if (!idsPositionnes) return undefined;
    let annule = false;
    idsPositionnes.split(",").forEach(async (id) => {
      try {
        const data = await apiGet(`/api/marketplace/offres/${id}/messages`);
        if (!annule) setSuivis((prev) => ({ ...prev, [id]: suiviDepuisMessages(data?.messages) }));
      } catch { /**/ }
    });
    return () => { annule = true; };
  }, [idsPositionnes]);

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

        <div className="kd">
          {/* Bandeau d'accueil */}
          <section className="kd-hero">
            <p className="kd-hello">{greetingName ? `Bonjour ${greetingName}` : "Bonjour"}</p>
            <p className="kd-hero-label">Chiffre d'affaires de {currentMonthLabel}</p>
            {billedRevenue > 0 ? (
              <p className="kd-hero-amount">{euro(billedRevenue)}</p>
            ) : (
              <p className="kd-hero-first">Vos premiers gains apparaîtront ici</p>
            )}

            {premiumUnlocked ? (
              <Link href="/interventions" className="kd-urgence">
                <span className="kd-urgence-text">
                  <strong><IconBolt /> Mode Urgences</strong>
                  <small>Recevez les petits dépannages urgents près de chez vous.</small>
                </span>
                <span className="kd-btn kd-btn-lemon">Passer en ligne</span>
              </Link>
            ) : (
              <Link href="/abonnement" className="kd-urgence">
                <span className="kd-urgence-text">
                  <strong><IconBolt /> Mode Urgences</strong>
                  <small>Fonctionnalité Koji Premium — recevez les dépannages urgents près de chez vous.</small>
                </span>
                <span className="kd-btn kd-btn-lemon">Découvrir</span>
              </Link>
            )}

            <div className="kd-hero-chips">
              {reponsesClients.length > 0 ? (
                <Link href={`/marketplace/${reponsesClients[0].id}`} className="kd-chip kd-chip-alert">
                  {reponsesClients.length === 1 ? "1 client vous a répondu" : `${reponsesClients.length} clients vous ont répondu`}
                </Link>
              ) : null}
              <Link href="/marketplace" className="kd-chip kd-chip-lemon">
                {nouveauxChantiers > 0
                  ? `${nouveauxChantiers} nouveau${nouveauxChantiers > 1 ? "x" : ""} chantier${nouveauxChantiers > 1 ? "s" : ""}`
                  : `${offresDisponibles.length} chantier${offresDisponibles.length > 1 ? "s" : ""} disponible${offresDisponibles.length > 1 ? "s" : ""}`}
              </Link>
              <Link href="/devis" className="kd-chip">{quotesInProgress.length} devis en cours</Link>
            </div>
          </section>

          {/* Profil entreprise à compléter */}
          {!profileComplete ? (
            <section className="kd-profil">
              <span className="kd-profil-text">
                <strong>Complétez votre profil entreprise</strong>
                <small>Un profil complet inspire confiance aux clients qui choisissent entre plusieurs entreprises.</small>
              </span>
              <Link href="/profil" className="kd-btn kd-btn-navy">Compléter mon profil</Link>
            </section>
          ) : null}

          {/* Mes positionnements */}
          {mesPositionnements.length > 0 ? (
            <section className="kd-block">
              <div className="kd-block-head">
                <h2 className="kd-block-title">
                  Mes positionnements
                  <span className="kd-count">{mesPositionnements.length}/{MAX_POSITIONNEMENTS}</span>
                </h2>
              </div>
              <ul className="kd-positions">
                {mesPositionnements.map((offre) => {
                  const visuel = metierVisuel(offre.metier);
                  const ville = villeSeule(offre.address);
                  const suivi = libelleSuivi(suivis[offre.id]);
                  return (
                    <li key={offre.id}>
                      <Link href={`/marketplace/${offre.id}`} className="kd-position">
                        <span className="kd-position-thumb" style={{ background: visuel.color }} aria-hidden="true">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            {visuel.icon}
                          </svg>
                        </span>
                        <span className="kd-position-text">
                          <strong>{titreCourt(offre.description)}</strong>
                          <small>{[offre.metier, ville].filter(Boolean).join(" · ")}</small>
                        </span>
                        <span className={`kd-position-status is-${suivi.ton}`}>{suivi.texte}</span>
                        <span className="kd-position-chevron"><ChevronRight /></span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {mesPositionnements.length >= MAX_POSITIONNEMENTS ? (
                <p className="kd-position-note">Vous avez atteint la limite de {MAX_POSITIONNEMENTS} chantiers en même temps. Retirez-vous de l'un d'eux pour vous positionner ailleurs.</p>
              ) : null}
            </section>
          ) : null}

          {/* Chantiers disponibles */}
          <section className="kd-block">
            <div className="kd-block-head">
              <h2 className="kd-block-title">
                Chantiers disponibles
                {offresDisponibles.length ? <span className="kd-count">{offresDisponibles.length}</span> : null}
              </h2>
              <Link href="/marketplace" className="kd-btn kd-btn-lemon">Voir les chantiers <ChevronRight /></Link>
            </div>

            {offresLoading ? (
              <div className="kd-empty">Chargement…</div>
            ) : offresDisponibles.length === 0 ? (
              <div className="kd-empty">
                <strong>Aucun chantier disponible pour le moment</strong>
                <span>Les chantiers publiés dans votre métier et votre zone apparaîtront ici.</span>
              </div>
            ) : (
              <>
                <div className="kd-offres">
                  {offresVisibles.map((offre) => (
                    <OffreCard key={offre.id} offre={offre} etat={positions[offre.id]} onPositionner={positionner} />
                  ))}
                </div>
                {offresRestantes > 0 ? (
                  <Link href="/marketplace" className="kd-btn kd-btn-more">
                    Voir {offresRestantes} chantier{offresRestantes > 1 ? "s" : ""} de plus <ChevronRight />
                  </Link>
                ) : null}
              </>
            )}
          </section>

          {info ? <div className="kd-toast" role="status">{info}</div> : null}
        </div>

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

      </div>
    </Shell>
  );
}

// "/" sert deux publics (23 septembre) : la page publique de presentation
// (visiteur non connecte, voir components/PublicLanding.jsx) et le tableau
// de bord entreprise existant (DashboardHome ci-dessus, inchange) — decide
// une seule fois via le meme cache localStorage "koji-user" que Shell.jsx
// utilise deja pour sa propre verification de session, pour ne jamais
// monter le tableau de bord (et ses appels API authentifies) tant que la
// decision n'est pas prise.
export default function RootPage() {
  const [status, setStatus] = useState("checking"); // checking | guest | member

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("koji-user");
      const parsed = raw ? JSON.parse(raw) : null;
      setStatus(parsed?.id ? "member" : "guest");
    } catch {
      setStatus("guest");
    }
  }, []);

  if (status === "checking") return null;
  if (status === "guest") return <PublicLanding />;
  return <DashboardHome />;
}
