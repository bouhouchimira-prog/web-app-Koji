"use client";

import { useEffect, useMemo, useState } from "react";
import "./worker.css";

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

function formatDate(value) {
  if (!value) return "À définir";
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
        loadPortal(parsed).finally(() => setLoading(false));
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
    const data = await fetchJson(`/api/worker-portal?workerId=${encodeURIComponent(nextWorker.id)}`);
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
        body: JSON.stringify({ ...payload, workerId: worker.id }),
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
    setWorker(null);
    setPortal(null);
    setSelectedProjectId("");
    setView("home");
  }

  if (loading) {
    return <main className="worker-page"><div className="worker-loader">Chargement du portail ouvrier...</div></main>;
  }

  if (!worker) {
    return (
      <main className="worker-login-shell">
        <section className="worker-brand-panel">
          <div className="worker-brand-mark">KJ</div>
          <p>Espace ouvrier</p>
          <h1>Vos chantiers, vos tâches et votre planning.</h1>
        </section>
        <form className="worker-login-card" onSubmit={handleLogin}>
          <span className="worker-kicker">Connexion Worker</span>
          <h2>Accès ouvrier</h2>
          <label>
            Identifiant OUV, e-mail ou téléphone
            <input
              value={login.identifier}
              onChange={(event) => setLogin({ ...login, identifier: event.target.value })}
              placeholder="OUV-ABCDEF"
              required
            />
          </label>
          <label>
            Mot de passe
            <input
              type="password"
              value={login.password}
              onChange={(event) => setLogin({ ...login, password: event.target.value })}
              placeholder="Mot de passe provisoire"
              required
            />
          </label>
          {error ? <p className="worker-error">{error}</p> : null}
          <button className="worker-primary" disabled={busy}>{busy ? "Connexion..." : "Connexion"}</button>
          <small>Les identifiants sont envoyés par l'entreprise lors de l'ajout du profil ouvrier.</small>
        </form>
      </main>
    );
  }

  return (
    <main className="worker-page">
      <header className="worker-topbar">
        <div>
          <span className="worker-kicker">Kôji Worker</span>
          <h1>{worker.name || worker.loginId}</h1>
          <p>{worker.profession || worker.role || "Ouvrier"} · {worker.loginId}</p>
        </div>
        <nav className="worker-nav" aria-label="Navigation worker">
          <button className={view === "home" ? "active" : ""} onClick={() => { setView("home"); setSelectedProjectId(""); }}>Home</button>
          <button className={view === "archives" ? "active" : ""} onClick={() => { setView("archives"); setSelectedProjectId(""); }}>Archives</button>
          <button className={view === "notifications" ? "active" : ""} onClick={() => { setView("notifications"); setSelectedProjectId(""); }}>
            Notifications {portal?.unreadCount ? <b>{portal.unreadCount}</b> : null}
          </button>
          <button onClick={logout}>Déconnexion</button>
        </nav>
      </header>

      {error ? <p className="worker-error worker-floating-error">{error}</p> : null}

      {selectedProject ? renderProjectDetail(selectedProject) : null}
      {!selectedProject && view === "home" ? renderHome() : null}
      {!selectedProject && view === "archives" ? renderArchives() : null}
      {!selectedProject && view === "notifications" ? renderNotifications() : null}
    </main>
  );

  function renderHome() {
    return (
      <div className="worker-stack">
        <section className="worker-section">
          <div className="worker-section-head">
            <h2>Mes chantiers en cours</h2>
            <span>{portal?.activeProjects?.length || 0} actif(s)</span>
          </div>
          <div className="worker-project-grid">
            {(portal?.activeProjects || []).map((project) => (
              <button className="worker-project-card" key={project.id} onClick={() => setSelectedProjectId(project.id)}>
                <span className="worker-status">{project.status || "En cours"}</span>
                <h3>{project.name || "Chantier"}</h3>
                <p>{project.address || "Adresse à compléter"}</p>
                <small>{project.companyName || project.clientName || "Entreprise Kôji"}</small>
                <div className="worker-date-grid">
                  <span>Début<br /><strong>{formatDate(project.startDate || project.plannedStartDate)}</strong></span>
                  <span>Fin prévue<br /><strong>{formatDate(project.endDate || project.plannedEndDate)}</strong></span>
                </div>
                <div className="worker-progress"><i style={{ width: `${project.progress || 0}%` }} /></div>
                <em>{project.progress || 0}% d'avancement</em>
              </button>
            ))}
            {!portal?.activeProjects?.length ? <div className="worker-empty">Aucun chantier affecté pour le moment.</div> : null}
          </div>
        </section>

        <section className="worker-section">
          <div className="worker-section-head">
            <h2>À faire maintenant</h2>
            <span>{todayTasks.length} tâche(s)</span>
          </div>
          <div className="worker-task-list">
            {todayTasks.map((task) => renderTaskCard(task))}
            {!todayTasks.length ? <div className="worker-empty">Aucune tâche prévue aujourd'hui.</div> : null}
          </div>
        </section>
      </div>
    );
  }

  function renderProjectDetail(project) {
    const tasks = project.tasks || (portal?.tasks || []).filter((task) => task.projectId === project.id);
    return (
      <div className="worker-stack">
        <button className="worker-back" onClick={() => setSelectedProjectId("")}>Retour</button>
        <section className="worker-section worker-project-detail">
          <span className="worker-status">{project.status || "En cours"}</span>
          <h2>{project.name || "Chantier"}</h2>
          <p>{project.address || "Adresse à compléter"}</p>
          <div className="worker-progress"><i style={{ width: `${project.progress || 0}%` }} /></div>
        </section>
        <section className="worker-section">
          <div className="worker-section-head">
            <h2>Ouvrages affectés</h2>
            <span>{tasks.length} élément(s)</span>
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
          <p>{task.description || "Aucune description renseignée."}</p>
          <div className="worker-task-meta">
            <small>Durée prévue: {minutesLabel(planned)}</small>
            <small>Temps consommé: {minutesLabel(consumed)}</small>
            <small>Statut: {taskStatus(task)}</small>
          </div>
          <div className="worker-progress"><i style={{ width: `${progress}%` }} /></div>
          {overrun ? <strong className="worker-alert">Le temps prévu est dépassé de {minutesLabel(consumed - planned)}.</strong> : null}
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
          <button onClick={() => runAction({ action: "start", taskId: task.id })} disabled={busy}>Démarrer</button>
          <button onClick={() => runAction({ action: "pause", taskId: task.id })} disabled={busy}>Pause</button>
          <button onClick={() => runAction({ action: "resume", taskId: task.id })} disabled={busy}>Reprendre</button>
          <button onClick={() => runAction({ action: "finish", taskId: task.id })} disabled={busy}>Terminer</button>
        </div>

        <div className="worker-file-row">
          <label>Ajouter photo<input type="file" accept="image/*" capture="environment" onChange={(event) => handleFile(task, "photo", event)} /></label>
          <label>Ajouter document<input type="file" accept="application/pdf,image/*" onChange={(event) => handleFile(task, "document", event)} /></label>
        </div>

        <div className="worker-report-grid">
          <div>
            <h4>Réclamation</h4>
            <select value={form.category || CLAIM_CATEGORIES[0]} onChange={(event) => updateTaskForm(task.id, { category: event.target.value })}>
              {CLAIM_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
            </select>
            <textarea placeholder="Commentaire" value={form.claimMessage || ""} onChange={(event) => updateTaskForm(task.id, { claimMessage: event.target.value })} />
            <button onClick={() => runAction({ action: "claim", taskId: task.id, category: form.category, message: form.claimMessage })}>Faire une réclamation</button>
          </div>
          <div>
            <h4>Retard</h4>
            <input placeholder="Motif" value={form.delayReason || ""} onChange={(event) => updateTaskForm(task.id, { delayReason: event.target.value })} />
            <input placeholder="Durée estimée" value={form.estimatedDelay || ""} onChange={(event) => updateTaskForm(task.id, { estimatedDelay: event.target.value })} />
            <textarea placeholder="Commentaire" value={form.delayComment || ""} onChange={(event) => updateTaskForm(task.id, { delayComment: event.target.value })} />
            <button onClick={() => runAction({ action: "delay", taskId: task.id, reason: form.delayReason, estimatedDelay: form.estimatedDelay, comment: form.delayComment })}>Signaler un retard</button>
          </div>
        </div>

        <div className="worker-urgence-block">
          {form.urgSent ? (
            <div className="worker-urgence-sent">✅ Alerte urgente transmise à l'entreprise</div>
          ) : !form.showUrgence ? (
            <button className="worker-urgence-btn" onClick={() => updateTaskForm(task.id, { showUrgence: true })}>
              🚨 Signaler une urgence
            </button>
          ) : (
            <div className="worker-urgence-form">
              <strong>🚨 Alerte urgente — {taskTitle(task)}</strong>
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
                <button onClick={() => updateTaskForm(task.id, { showUrgence: false })}>Annuler</button>
                <button
                  className="worker-urgence-send"
                  disabled={!form.urgMsg?.trim() || form.urgSending}
                  onClick={() => sendUrgentAlert(task)}
                >
                  {form.urgSending ? "Envoi..." : "Envoyer l'alerte"}
                </button>
              </div>
            </div>
          )}
        </div>
      </article>
    );
  }

  function renderArchives() {
    return (
      <div className="worker-stack">
        <section className="worker-section">
          <div className="worker-section-head"><h2>Chantiers terminés</h2><span>{portal?.archivedProjects?.length || 0}</span></div>
          <div className="worker-project-grid">
            {(portal?.archivedProjects || []).map((project) => (
              <button className="worker-project-card" key={project.id} onClick={() => setSelectedProjectId(project.id)}>
                <span className="worker-status">Terminé</span>
                <h3>{project.name || "Chantier"}</h3>
                <p>{project.address || "Adresse à compléter"}</p>
                <small>{project.companyName || "Entreprise Kôji"}</small>
                <div className="worker-date-grid">
                  <span>Début<br /><strong>{formatDate(project.startDate)}</strong></span>
                  <span>Fin<br /><strong>{formatDate(project.endDate || project.updatedAt)}</strong></span>
                </div>
              </button>
            ))}
            {!portal?.archivedProjects?.length ? <div className="worker-empty">Aucun chantier terminé.</div> : null}
          </div>
        </section>
        <section className="worker-section">
          <div className="worker-section-head"><h2>Historique complet</h2><span>{portal?.history?.length || 0}</span></div>
          <div className="worker-history-list">
            {(portal?.history || []).map((item) => <p key={item.id || `${item.type}-${item.createdAt}`}><strong>{item.label || item.type}</strong><span>{formatDateTime(item.createdAt)}</span></p>)}
            {!portal?.history?.length ? <div className="worker-empty">Aucun historique pour le moment.</div> : null}
          </div>
        </section>
      </div>
    );
  }

  function renderNotifications() {
    return (
      <section className="worker-section">
        <div className="worker-section-head">
          <h2>Centre de notifications</h2>
          <button onClick={() => runAction({ action: "bulk-read-notifications" })}>Tout marquer comme lu</button>
        </div>
        <div className="worker-notification-list">
          {(portal?.notifications || []).map((notification) => (
            <article className={notification.read ? "is-read" : ""} key={notification.id}>
              <span>{notification.title || "Notification"}</span>
              <p>{notification.message}</p>
              <small>{formatDateTime(notification.createdAt)}</small>
              {!notification.read ? <button onClick={() => runAction({ action: "read-notification", notificationId: notification.id })}>Lu</button> : null}
            </article>
          ))}
          {!portal?.notifications?.length ? <div className="worker-empty">Aucune notification.</div> : null}
        </div>
      </section>
    );
  }
}
