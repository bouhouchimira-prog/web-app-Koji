"use client";

import { useEffect, useMemo, useState } from "react";
import "./worker.css";
import { useLocale } from "../../lib/i18n";
import { LangSwitcher } from "../../components/LangSwitcher";
import { SettingsPanel } from "../../components/SettingsPanel";

const SESSION_KEY = "koji-worker-session";

const CLAIM_CATEGORIES = [
  "Problème chantier",
  "Manque de matériel",
  "Problème technique",
  "Problème sécurité",
  "Autre",
];

function text(value, fallback = "") {
  return String(value || fallback || "").trim();
}

function formatDate(value, noneLabel = "—") {
  if (!value) return noneLabel;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function sameDay(value) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

function minutesLabel(minutes) {
  const total = Number(minutes || 0);
  const hours = Math.floor(total / 60);
  const rest = Math.round(total % 60);
  if (!hours) return `${rest} min`;
  return `${hours}h${String(rest).padStart(2, "0")}`;
}

function taskTitle(task) {
  return text(task.title || task.name || task.workName || task.ouvrageName || task.label, "Tâche sans nom");
}

function taskProjectName(task) {
  return text(task.projectName || task.chantierName || task.project?.name || task.quoteProjectName, "Chantier");
}

function taskStatus(task) {
  return text(task.status || task.state, "À faire");
}

function taskProgress(task) {
  const status = taskStatus(task).toLowerCase();
  if (status.includes("termin")) return 100;
  if (status.includes("cours")) return 55;
  const planned = Number(task.plannedMinutes || task.estimatedMinutes || task.durationMinutes || 0);
  const consumed = Number(task.consumedMinutes || task.totalMinutes || task.timeSpentMinutes || 0);
  if (planned > 0) return Math.min(100, Math.round((consumed / planned) * 100));
  return 0;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Error(data.error || "Action impossible pour le moment.");
  return data;
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function WorkerPage() {
  const { L } = useLocale();
  const [worker, setWorker] = useState(null);
  const [portal, setPortal] = useState(null);
  const [view, setView] = useState("home");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [login, setLogin] = useState({ identifier: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [forms, setForms] = useState({});

  useEffect(() => {
    const saved = window.localStorage.getItem(SESSION_KEY);
    if (!saved) {
      setLoading(false);
      return;
    }
    try {
      const parsed = JSON.parse(saved);
      if (parsed?.id) {
        setWorker(parsed);
        loadPortal(parsed)
          .catch((exception) => {
            window.localStorage.removeItem(SESSION_KEY);
            setWorker(null);
            setError(exception.message);
          })
          .finally(() => setLoading(false));
        return;
      }
    } catch {
      window.localStorage.removeItem(SESSION_KEY);
    }
    setLoading(false);
  }, []);

  const selectedProject = useMemo(() => {
    const projects = [...(portal?.activeProjects || []), ...(portal?.archivedProjects || [])];
    return projects.find((project) => project.id === selectedProjectId) || null;
  }, [portal, selectedProjectId]);

  const todayTasks = useMemo(() => {
    return (portal?.tasks || []).filter((task) => sameDay(task.dueDate || task.startDate || task.plannedStartDate));
  }, [portal]);

  async function loadPortal(nextWorker = worker) {
    if (!nextWorker?.id) return;
    setError("");
    const data = await fetchJson("/api/worker-portal");
    setPortal(data);
  }

  async function handleLogin(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await fetchJson("/api/worker-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(login),
      });
      setWorker(data.worker);
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(data.worker));
      await loadPortal(data.worker);
      setView("home");
    } catch (exception) {
      setError(exception.message);
    } finally {
      setBusy(false);
    }
  }

  async function runAction(payload) {
    if (!worker?.id) return;
    setBusy(true);
    setError("");
    try {
      const data = await fetchJson("/api/worker-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setPortal(data);
    } catch (exception) {
      setError(exception.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(task, type, event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFile(file);
    await runAction({ action: type, taskId: task.id, name: file.name, mimeType: file.type, dataUrl });
    event.target.value = "";
  }

  function updateTaskForm(taskId, patch) {
    setForms((current) => ({ ...current, [taskId]: { ...(current[taskId] || {}), ...patch } }));
  }

  async function sendUrgentAlert(task) {
    const form = forms[task.id] || {};
    const message = (form.urgMsg || "").trim();
    if (!message) return;
    updateTaskForm(task.id, { urgSending: true });
    try {
      await fetchJson("/api/urgent-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "worker",
          senderName: text(worker?.name || worker?.loginId || "Ouvrier"),
          type: form.urgType || "urgence",
          message,
          projectId: task.projectId || "",
          taskIds: [task.id],
          taskLabels: [taskTitle(task)]
        })
      });
      updateTaskForm(task.id, { urgSent: true, urgSending: false, urgMsg: "", showUrgence: false });
    } catch {
      updateTaskForm(task.id, { urgSending: false });
    }
  }

  function logout() {
    window.localStorage.removeItem(SESSION_KEY);
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setWorker(null);
    setPortal(null);
    setSelectedProjectId("");
    setView("home");
  }

  if (loading) {
    return <main className="worker-page"><div className="worker-loader">{L.worker.loading}</div></main>;
  }

  if (!worker) {
    return (
      <main className="worker-login-shell">
        <section className="worker-brand-panel">
          <div className="worker-brand-mark">KJ</div>
          <p>{L.worker.title}</p>
          <h1>{L.worker.tagline}</h1>
        </section>
        <form className="worker-login-card" onSubmit={handleLogin}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}><LangSwitcher /></div>
          <span className="worker-kicker">{L.worker.loginKicker}</span>
          <h2>{L.worker.loginTitle}</h2>
          <label>
            {L.worker.identifierLabel}
            <input
              value={login.identifier}
              onChange={(event) => setLogin({ ...login, identifier: event.target.value })}
              placeholder="OUV-ABCDEF"
              required
            />
          </label>
          <label>
            {L.worker.passwordPh}
            <input
              type="password"
              value={login.password}
              onChange={(event) => setLogin({ ...login, password: event.target.value })}
              placeholder={L.worker.passwordPh}
              required
            />
          </label>
          {error ? <p className="worker-error">{error}</p> : null}
          <button className="worker-primary" disabled={busy}>{busy ? L.worker.loggingIn : L.worker.loginBtn}</button>
          <small>{L.worker.loginHint}</small>
        </form>
      </main>
    );
  }

  return (
    <main className="worker-page">
      <header className="worker-topbar">
        <div>
          <span className="worker-kicker">Koji Worker</span>
          <h1>{worker.name || worker.loginId}</h1>
          <p>{worker.profession || worker.role || "Ouvrier"} · {worker.loginId}</p>
        </div>
        <nav className="worker-nav" aria-label="Navigation worker">
          <button className={view === "home" ? "active" : ""} onClick={() => { setView("home"); setSelectedProjectId(""); }}>{L.worker.home}</button>
          <button className={view === "attendance" ? "active" : ""} onClick={() => { setView("attendance"); setSelectedProjectId(""); }}>{L.worker.attendanceTitle}</button>
          <button className={view === "archives" ? "active" : ""} onClick={() => { setView("archives"); setSelectedProjectId(""); }}>{L.worker.archives}</button>
          <button className={view === "notifications" ? "active" : ""} onClick={() => { setView("notifications"); setSelectedProjectId(""); }}>
            {L.worker.notifications} {portal?.unreadCount ? <b>{portal.unreadCount}</b> : null}
          </button>
          <button className={view === "settings" ? "active" : ""} onClick={() => { setView("settings"); setSelectedProjectId(""); }}>{L.nav.settings}</button>
          <LangSwitcher />
          <button onClick={logout}>{L.worker.logout}</button>
        </nav>
      </header>

      {error ? <p className="worker-error worker-floating-error">{error}</p> : null}

      {selectedProject ? renderProjectDetail(selectedProject) : null}
      {!selectedProject && view === "home" ? renderHome() : null}
      {!selectedProject && view === "attendance" ? renderAttendance() : null}
      {!selectedProject && view === "archives" ? renderArchives() : null}
      {!selectedProject && view === "notifications" ? renderNotifications() : null}
      {!selectedProject && view === "settings" ? renderSettings() : null}
    </main>
  );

  function renderHome() {
    return (
      <div className="worker-stack">
        <section className="worker-section">
          <div className="worker-section-head">
            <h2>{L.worker.activeProjects}</h2>
            <span>{portal?.activeProjects?.length || 0}</span>
          </div>
          <div className="worker-project-grid">
            {(portal?.activeProjects || []).map((project) => (
              <button className="worker-project-card" key={project.id} onClick={() => setSelectedProjectId(project.id)}>
                <span className="worker-status">{project.status || L.worker.inProgress}</span>
                <h3>{project.name || "Chantier"}</h3>
                <p>{project.address || "—"}</p>
                <small>{project.companyName || project.clientName || "Koji"}</small>
                <div className="worker-date-grid">
                  <span>{L.worker.start2}<br /><strong>{formatDate(project.startDate || project.plannedStartDate, L.worker.toDefine)}</strong></span>
                  <span>{L.worker.endPlanned}<br /><strong>{formatDate(project.endDate || project.plannedEndDate, L.worker.toDefine)}</strong></span>
                </div>
                <div className="worker-progress"><i style={{ width: `${project.progress || 0}%` }} /></div>
                <em>{L.worker.progress(project.progress || 0)}</em>
              </button>
            ))}
            {!portal?.activeProjects?.length ? <div className="worker-empty">{L.worker.noProjects}</div> : null}
          </div>
        </section>

        <section className="worker-section">
          <div className="worker-section-head">
            <h2>{L.worker.todoNow}</h2>
            <span>{todayTasks.length}</span>
          </div>
          <div className="worker-task-list">
            {todayTasks.map((task) => renderTaskCard(task))}
            {!todayTasks.length ? <div className="worker-empty">{L.worker.noTodayTasks}</div> : null}
          </div>
        </section>
      </div>
    );
  }

  function renderProjectDetail(project) {
    const tasks = project.tasks || (portal?.tasks || []).filter((task) => task.projectId === project.id);
    return (
      <div className="worker-stack">
        <button className="worker-back" onClick={() => setSelectedProjectId("")}>{L.worker.back}</button>
        <section className="worker-section worker-project-detail">
          <span className="worker-status">{project.status || L.worker.inProgress}</span>
          <h2>{project.name || "Chantier"}</h2>
          <p>{project.address || "—"}</p>
          <div className="worker-progress"><i style={{ width: `${project.progress || 0}%` }} /></div>
        </section>
        <section className="worker-section">
          <div className="worker-section-head">
            <h2>{L.worker.affectedWorks}</h2>
            <span>{tasks.length}</span>
          </div>
          <div className="worker-task-list">{tasks.map((task) => renderTaskCard(task))}</div>
        </section>
      </div>
    );
  }

  function renderTaskCard(task) {
    const form = forms[task.id] || {};
    const planned = Number(task.plannedMinutes || task.estimatedMinutes || task.durationMinutes || 0);
    const consumed = Number(task.consumedMinutes || task.totalMinutes || task.timeSpentMinutes || 0);
    const overrun = planned > 0 && consumed > planned;
    const progress = taskProgress(task);

    return (
      <article className={`worker-task-card ${overrun ? "is-overrun" : ""}`} key={task.id}>
        <div className="worker-task-main">
          <span>{task.piece || task.room || taskProjectName(task)}</span>
          <h3>{taskTitle(task)}</h3>
          <p>{task.description || L.worker.noDesc}</p>
          <div className="worker-task-meta">
            <small>{L.worker.plannedDur}: {minutesLabel(planned)}</small>
            <small>{L.worker.consumed}: {minutesLabel(consumed)}</small>
            <small>{L.worker.status}: {taskStatus(task)}</small>
          </div>
          <div className="worker-progress"><i style={{ width: `${progress}%` }} /></div>
          {overrun ? <strong className="worker-alert">{L.worker.timeOverrun(minutesLabel(consumed - planned))}</strong> : null}
        </div>

        {task.subWorks?.length ? (
          <div className="worker-subworks">
            {task.subWorks.map((subWork, index) => (
              <div key={subWork.id || index}>
                <strong>{subWork.name || subWork.title || "Sous-ouvrage"}</strong>
                <span>{subWork.description || ""}</span>
                <small>{subWork.status || "À faire"} · prévu {formatDate(subWork.plannedDate)} · réalisé {formatDate(subWork.realDate)}</small>
              </div>
            ))}
          </div>
        ) : null}

        <div className="worker-action-row">
          <button onClick={() => runAction({ action: "start", taskId: task.id })} disabled={busy}>{L.worker.start}</button>
          <button onClick={() => runAction({ action: "pause", taskId: task.id })} disabled={busy}>{L.worker.pause}</button>
          <button onClick={() => runAction({ action: "resume", taskId: task.id })} disabled={busy}>{L.worker.resume}</button>
          <button onClick={() => runAction({ action: "finish", taskId: task.id })} disabled={busy}>{L.worker.finish}</button>
        </div>

        <div className="worker-file-row">
          <label>{L.worker.addPhoto}<input type="file" accept="image/*" capture="environment" onChange={(event) => handleFile(task, "photo", event)} /></label>
          <label>{L.worker.addDocument}<input type="file" accept="application/pdf,image/*" onChange={(event) => handleFile(task, "document", event)} /></label>
        </div>

        <div className="worker-report-grid">
          <div>
            <h4>{L.worker.claim}</h4>
            <select value={form.category || CLAIM_CATEGORIES[0]} onChange={(event) => updateTaskForm(task.id, { category: event.target.value })}>
              {CLAIM_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
            </select>
            <textarea placeholder={L.worker.comment} value={form.claimMessage || ""} onChange={(event) => updateTaskForm(task.id, { claimMessage: event.target.value })} />
            <button onClick={() => runAction({ action: "claim", taskId: task.id, category: form.category, message: form.claimMessage })}>{L.worker.makeClaim}</button>
          </div>
          <div>
            <h4>{L.worker.delay}</h4>
            <input placeholder={L.worker.reason} value={form.delayReason || ""} onChange={(event) => updateTaskForm(task.id, { delayReason: event.target.value })} />
            <input placeholder={L.worker.estimatedDelay} value={form.estimatedDelay || ""} onChange={(event) => updateTaskForm(task.id, { estimatedDelay: event.target.value })} />
            <textarea placeholder={L.worker.comment} value={form.delayComment || ""} onChange={(event) => updateTaskForm(task.id, { delayComment: event.target.value })} />
            <button onClick={() => runAction({ action: "delay", taskId: task.id, reason: form.delayReason, estimatedDelay: form.estimatedDelay, comment: form.delayComment })}>{L.worker.reportDelay}</button>
          </div>
        </div>

        <div className="worker-urgence-block">
          {form.urgSent ? (
            <div className="worker-urgence-sent">{L.worker.urgentSent}</div>
          ) : !form.showUrgence ? (
            <button className="worker-urgence-btn" onClick={() => updateTaskForm(task.id, { showUrgence: true })}>
              {L.worker.reportUrgent}
            </button>
          ) : (
            <div className="worker-urgence-form">
              <strong>{L.worker.urgentTitle(taskTitle(task))}</strong>
              <select value={form.urgType || "urgence"} onChange={(e) => updateTaskForm(task.id, { urgType: e.target.value })}>
                <option value="urgence">⚡ Urgence générale</option>
                <option value="degat">🧱 Dégât matériel</option>
                <option value="fuite">💧 Fuite / dégât des eaux</option>
                <option value="incendie">🔥 Incendie / fumée</option>
                <option value="autre">⚠️ Autre problème urgent</option>
              </select>
              <textarea
                placeholder="Décrivez le problème urgent (localisation, gravité…)"
                value={form.urgMsg || ""}
                onChange={(e) => updateTaskForm(task.id, { urgMsg: e.target.value })}
              />
              <div className="worker-urgence-actions">
                <button onClick={() => updateTaskForm(task.id, { showUrgence: false })}>{L.common.cancel}</button>
                <button
                  className="worker-urgence-send"
                  disabled={!form.urgMsg?.trim() || form.urgSending}
                  onClick={() => sendUrgentAlert(task)}
                >
                  {form.urgSending ? "..." : L.worker.sendAlert}
                </button>
              </div>
            </div>
          )}
        </div>
      </article>
    );
  }

  function renderAttendance() {
    const today = portal?.attendanceToday;
    const week = portal?.attendanceWeek;
    const isClockedIn = Boolean(today && !today.endTime);
    return (
      <div className="worker-stack">
        <section className="worker-section worker-attendance-card">
          <div className="worker-section-head"><h2>{L.worker.attendanceTitle}</h2></div>
          <div className="worker-clock-status">
            <strong>{isClockedIn ? L.worker.clockedInSince(today.startTime) : L.worker.notClockedIn}</strong>
            <button
              className={`worker-primary ${isClockedIn ? "worker-clockout-btn" : ""}`}
              disabled={busy}
              onClick={() => runAction({ action: isClockedIn ? "clockOut" : "clockIn" })}
            >
              {isClockedIn ? L.worker.clockOut : L.worker.clockIn}
            </button>
          </div>
        </section>
        <section className="worker-section">
          <div className="worker-section-head">
            <h2>{L.worker.thisWeek}</h2>
            <span>{week ? `${week.workedLabel} / ${week.contractLabel}` : "-"}</span>
          </div>
          <div className="worker-attendance-list">
            {(week?.entries || []).map((entry) => (
              <div className="worker-attendance-row" key={entry.id}>
                <strong>{formatDate(entry.date)}</strong>
                <span>{entry.startTime} → {entry.endTime || "…"}</span>
                <small>{minutesLabel(entry.durationMinutes)}</small>
              </div>
            ))}
            {!week?.entries?.length ? <div className="worker-empty">{L.worker.noAttendance}</div> : null}
          </div>
        </section>
      </div>
    );
  }

  function renderArchives() {
    return (
      <div className="worker-stack">
        <section className="worker-section">
          <div className="worker-section-head"><h2>{L.worker.doneProjects}</h2><span>{portal?.archivedProjects?.length || 0}</span></div>
          <div className="worker-project-grid">
            {(portal?.archivedProjects || []).map((project) => (
              <button className="worker-project-card" key={project.id} onClick={() => setSelectedProjectId(project.id)}>
                <span className="worker-status">{L.worker.finished}</span>
                <h3>{project.name || "Chantier"}</h3>
                <p>{project.address || "—"}</p>
                <small>{project.companyName || "Koji"}</small>
                <div className="worker-date-grid">
                  <span>{L.worker.start2}<br /><strong>{formatDate(project.startDate, L.worker.toDefine)}</strong></span>
                  <span>{L.worker.end}<br /><strong>{formatDate(project.endDate || project.updatedAt, L.worker.toDefine)}</strong></span>
                </div>
              </button>
            ))}
            {!portal?.archivedProjects?.length ? <div className="worker-empty">{L.worker.noArchived}</div> : null}
          </div>
        </section>
        <section className="worker-section">
          <div className="worker-section-head"><h2>{L.worker.fullHistory}</h2><span>{portal?.history?.length || 0}</span></div>
          <div className="worker-history-list">
            {(portal?.history || []).map((item) => <p key={item.id || `${item.type}-${item.createdAt}`}><strong>{item.label || item.type}</strong><span>{formatDateTime(item.createdAt)}</span></p>)}
            {!portal?.history?.length ? <div className="worker-empty">{L.worker.noHistory}</div> : null}
          </div>
        </section>
      </div>
    );
  }

  function renderNotifications() {
    return (
      <section className="worker-section">
        <div className="worker-section-head">
          <h2>{L.worker.notifCenter}</h2>
          <button onClick={() => runAction({ action: "bulk-read-notifications" })}>{L.worker.markAllRead}</button>
        </div>
        <div className="worker-notification-list">
          {(portal?.notifications || []).map((notification) => (
            <article className={notification.read ? "is-read" : ""} key={notification.id}>
              <span>{notification.title || L.worker.notifications}</span>
              <p>{notification.message}</p>
              <small>{formatDateTime(notification.createdAt)}</small>
              {!notification.read ? <button onClick={() => runAction({ action: "read-notification", notificationId: notification.id })}>{L.worker.markRead}</button> : null}
            </article>
          ))}
          {!portal?.notifications?.length ? <div className="worker-empty">{L.worker.noNotifications}</div> : null}
        </div>
      </section>
    );
  }

  function renderSettings() {
    return (
      <section className="worker-section">
        <SettingsPanel accountType="ouvrier" />
      </section>
    );
  }
}
