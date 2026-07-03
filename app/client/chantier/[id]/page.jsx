"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ClientTopbar } from "../../../../components/ClientTopbar";
import { useEffect, useRef, useState } from "react";
import { euro, shortDate } from "../../../../lib/pricing";

function getStoredUser() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("koji-user") || "null"); } catch { return null; }
}

function fmt(v) { if (!v) return "-"; try { return shortDate(v); } catch { return v; } }

function fmtFull(v) {
  if (!v) return "-";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(v));
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const TASK_STEPS = ["Début", "En cours", "Validé", "Terminé"];

function getStep(task) {
  if (task.done) return 3;
  if (task.clientValidationStatus === "Valide" || task.status === "Valide par client") return 2;
  if (task.pendingValidation || task.startedAt || task.status === "En cours" || task.status === "Terminee (a valider)") return 1;
  return 0;
}

function StatusBar({ step }) {
  return (
    <div className="ct-status-bar">
      {TASK_STEPS.map((label, i) => (
        <div key={label} className={`ct-step${i <= step ? " active" : ""}${i === step ? " current" : ""}`}>
          <div className="ct-step-dot" />
          {i < TASK_STEPS.length - 1 && <div className="ct-step-line" />}
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

const URGENCE_TYPES = [
  { value: "urgence", label: "⚡ Urgence générale" },
  { value: "degat", label: "🧱 Dégât matériel" },
  { value: "fuite", label: "💧 Fuite / dégât des eaux" },
  { value: "incendie", label: "🔥 Incendie / fumée" },
  { value: "autre", label: "⚠️ Autre problème urgent" },
];

function TaskCard({ task, userId, projectId, quoteId, onValidate }) {
  const [open, setOpen] = useState(false);
  const [noteType, setNoteType] = useState("Note");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteText, setNoteText] = useState("");
  const [noteFile, setNoteFile] = useState(null);
  const [noteUrl, setNoteUrl] = useState("");
  const [docs, setDocs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showUrgence, setShowUrgence] = useState(false);
  const [urgType, setUrgType] = useState("urgence");
  const [urgMsg, setUrgMsg] = useState("");
  const [urgSending, setUrgSending] = useState(false);
  const [urgSent, setUrgSent] = useState(false);
  const fileRef = useRef(null);
  const step = getStep(task);
  const canValidate = step === 1 && (task.pendingValidation || task.status === "Terminee (a valider)");

  async function submitUrgence() {
    if (!urgMsg.trim() || urgSending) return;
    setUrgSending(true);
    try {
      const user = getStoredUser();
      await fetch("/api/urgent-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "client",
          senderName: user?.name || user?.email?.split("@")[0] || "Client",
          type: urgType,
          message: urgMsg.trim(),
          projectId: projectId || "",
          quoteId: quoteId || "",
          taskIds: [task.id],
          taskLabels: [task.label || task.name || "Ouvrage"]
        })
      });
      setUrgSent(true);
      setUrgMsg("");
      setTimeout(() => { setShowUrgence(false); setUrgSent(false); }, 3000);
    } finally { setUrgSending(false); }
  }

  useEffect(() => {
    if (!open || !task.id) return;
    fetch(`/api/task-replies?taskId=${task.id}`)
      .then((r) => r.json())
      .then((d) => setDocs(d.documents || []))
      .catch(() => {});
  }, [open, task.id]);

  async function onFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = await fileToDataUrl(file);
    setNoteFile(file.name);
    setNoteUrl(url);
    if (!noteTitle) setNoteTitle(file.name);
  }

  async function submitNote(event) {
    event.preventDefault();
    if (!noteTitle.trim() && !noteText.trim() && !noteUrl) return;
    setSaving(true);
    try {
      const r = await fetch("/api/client/task-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId, taskId: task.id, projectId,
          type: noteType,
          title: noteTitle.trim() || noteText.trim().slice(0, 60) || noteType,
          fileName: noteFile || "", url: noteUrl, notes: noteText
        })
      });
      if (!r.ok) { setSaving(false); return; }
      const data = await r.json();
      if (data.document) {
        setDocs((prev) => [data.document, ...prev]);
        setNoteTitle(""); setNoteText(""); setNoteFile(null); setNoteUrl("");
        if (fileRef.current) fileRef.current.value = "";
      }
    } finally { setSaving(false); }
  }

  return (
    <article className={`ccd-task${open ? " open" : ""}`}>
      <button type="button" className="ccd-task-head" onClick={() => setOpen((v) => !v)}>
        <span className={`ct-task-dot step-${step}`} />
        <div className="ccd-task-info">
          <span className="ct-task-room">{task.room || "Chantier"}</span>
          <strong>{task.label || task.name}</strong>
          {task.validatedAt || task.finishedAt ? (
            <small>Réalisé le {fmt(task.validatedAt || task.finishedAt)}</small>
          ) : task.startDate || task.dueDate ? (
            <small>Prévu le {fmt(task.startDate || task.dueDate)}</small>
          ) : null}
        </div>
        <span className={`ct-task-badge step-${step}`}>{TASK_STEPS[step]}</span>
        <svg className={`ct-chevron${open ? " open" : ""}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
      </button>

      {open ? (
        <div className="ccd-task-body">
          <StatusBar step={step} />

          <div className="ccd-task-details">
            {task.assignedTo ? <div><small>Équipe</small><span>{task.assignedTo}</span></div> : null}
            {task.startDate ? <div><small>Début</small><span>{fmtFull(task.startDate)}</span></div> : null}
            {task.endDate ? <div><small>Fin prévue</small><span>{fmtFull(task.endDate)}</span></div> : null}
            {task.finishedAt ? <div><small>Réalisé le</small><span>{fmtFull(task.finishedAt)}</span></div> : null}
            {task.completedByName ? <div><small>Par</small><span>{task.completedByName}</span></div> : null}
          </div>

          {canValidate ? (
            <div className="ct-validate-block">
              <p>L'équipe a terminé cet ouvrage — confirmez-vous que le travail est correct ?</p>
              <button type="button" className="primary-button" onClick={() => onValidate(task.id)}>
                Valider l'ouvrage (procès-verbal)
              </button>
            </div>
          ) : null}

          {docs.length > 0 ? (
            <div className="ccd-thread">
              <p className="ccd-docs-label">Conversation sur cet ouvrage</p>
              {docs.map((doc) => (
                <div key={doc.id} className={`ccd-thread-msg ${doc.source === "company" ? "from-company" : "from-client"}`}>
                  <div className="ccd-thread-msg-head">
                    <span className={`ct-task-badge ${doc.source === "company" ? "step-3" : "step-1"}`}>
                      {doc.source === "company" ? "Entreprise" : doc.type}
                    </span>
                    <strong>{doc.source === "company" ? (doc.senderName || "Entreprise") : (doc.clientName || "Vous")}</strong>
                    <small>{doc.createdAt ? new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(new Date(doc.createdAt)) : ""}</small>
                  </div>
                  {doc.notes ? <p>{doc.notes}</p> : null}
                  {doc.url ? <a href={doc.url} download={doc.fileName || doc.title} target="_blank" rel="noreferrer">Télécharger le fichier</a> : null}
                </div>
              ))}
            </div>
          ) : null}

          <form className="ccd-note-form" onSubmit={submitNote}>
            <p className="ccd-docs-label">Ajouter une note / document / photo</p>
            <div className="ccd-note-row">
              <select value={noteType} onChange={(e) => setNoteType(e.target.value)}>
                {["Note", "Photo", "Document", "Réclamation"].map((t) => <option key={t}>{t}</option>)}
              </select>
              <input value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="Titre (ex: Problème carrelage...)" />
            </div>
            <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Votre message..." rows={2} />
            <div className="ccd-note-actions">
              <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: "none" }} onChange={onFileChange} />
              <button type="button" className="ghost-button" onClick={() => fileRef.current?.click()}>
                {noteFile ? `📎 ${noteFile}` : "Joindre un fichier"}
              </button>
              <button type="submit" className="primary-button" disabled={saving || (!noteTitle.trim() && !noteText.trim() && !noteUrl)}>
                {saving ? "Envoi..." : "Envoyer"}
              </button>
            </div>
          </form>

          {/* Signalement urgence par ouvrage */}
          <div className="ccd-urgence-block">
            {urgSent ? (
              <div className="ccd-urgence-sent">✅ Alerte urgente envoyée à l'entreprise</div>
            ) : !showUrgence ? (
              <button type="button" className="ccd-urgence-trigger" onClick={() => setShowUrgence(true)}>
                🚨 Signaler une urgence sur cet ouvrage
              </button>
            ) : (
              <div className="ccd-urgence-form">
                <p className="ccd-urgence-title">🚨 Signaler une urgence — <em>{task.label || task.name}</em></p>
                <select value={urgType} onChange={(e) => setUrgType(e.target.value)}>
                  {URGENCE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <textarea
                  value={urgMsg}
                  onChange={(e) => setUrgMsg(e.target.value)}
                  placeholder="Décrivez précisément le problème (localisation, gravité…)"
                  rows={3}
                />
                <div className="ccd-urgence-actions">
                  <button type="button" className="ghost-button" onClick={() => setShowUrgence(false)}>Annuler</button>
                  <button type="button" className="urgence-send-btn" onClick={submitUrgence} disabled={!urgMsg.trim() || urgSending}>
                    {urgSending ? "Envoi..." : "Envoyer l'alerte"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </article>
  );
}

export default function ClientChantierPage() {
  const params = useParams();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [quote, setQuote] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGeneralUrgence, setShowGeneralUrgence] = useState(false);
  const [genUrgType, setGenUrgType] = useState("urgence");
  const [genUrgMsg, setGenUrgMsg] = useState("");
  const [genUrgTasks, setGenUrgTasks] = useState([]);
  const [genUrgSending, setGenUrgSending] = useState(false);
  const [genUrgSent, setGenUrgSent] = useState(false);

  useEffect(() => {
    const stored = getStoredUser();
    setUser(stored);
    if (!stored?.email) { setLoading(false); return; }
    const p = new URLSearchParams({ email: stored.email, userId: stored.id || "", id: params.id });
    fetch(`/api/client/quotes?${p.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        const q = data.quote || null;
        setQuote(q);
        if (q?.projectId) {
          fetch(`/api/project-messages?projectId=${q.projectId}`)
            .then((r) => r.json())
            .then((d) => setMessages(d.messages || []))
            .catch(() => {});
        }
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  async function submitGeneralUrgence() {
    if (!genUrgMsg.trim() || genUrgSending) return;
    setGenUrgSending(true);
    const allTasks = quote?.tasks || [];
    const selectedTasks = genUrgTasks.length > 0
      ? allTasks.filter((t) => genUrgTasks.includes(t.id))
      : [];
    try {
      await fetch("/api/urgent-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "client",
          senderName: user?.name || user?.email?.split("@")[0] || "Client",
          type: genUrgType,
          message: genUrgMsg.trim(),
          projectId: quote?.projectId || "",
          quoteId: params.id || "",
          taskIds: selectedTasks.map((t) => t.id),
          taskLabels: selectedTasks.map((t) => t.label || t.name || "Ouvrage")
        })
      });
      setGenUrgSent(true);
      setGenUrgMsg(""); setGenUrgTasks([]);
      setTimeout(() => { setShowGeneralUrgence(false); setGenUrgSent(false); }, 3000);
    } finally { setGenUrgSending(false); }
  }

  function toggleGenTask(taskId) {
    setGenUrgTasks((prev) => prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]);
  }

  async function handleValidate(taskId) {
    if (!user?.id) return;
    const r = await fetch("/api/client/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, taskId, action: "client-validate" })
    });
    if (!r.ok) return;
    const data = await r.json();
    setQuote((prev) => prev ? { ...prev, tasks: (prev.tasks || []).map((t) => t.id === taskId ? data.task : t) } : prev);
  }

  const tasks = quote?.tasks || [];
  const done = tasks.filter((t) => t.done).length;
  const percent = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const isSigned = quote?.status === "Signe" || quote?.signatureStatus === "Signe";

  return (
    <main className="client-space">
      <ClientTopbar showBack backHref="/client" />

      {loading ? (
        <div className="client-empty" style={{ marginTop: 32 }}>Chargement...</div>
      ) : !quote ? (
        <div className="client-empty" style={{ marginTop: 32 }}>Chantier introuvable.</div>
      ) : (
        <>
          {/* Devis header */}
          <div className="ccd-header">
            <div className="ccd-header-top">
              <div>
                <h1 className="ccd-title">{quote.project?.title || quote.projectName || quote.project || "Chantier"}</h1>
                <p className="ccd-client">{quote.client}</p>
              </div>
              {isSigned ? (
                <a className="ghost-button" href={`/api/quotes/${quote.id}/documents?type=quote&format=pdf`} target="_blank" rel="noreferrer">Télécharger le devis PDF</a>
              ) : null}
            </div>

            <div className="ccd-meta">
              <div><small>Montant TTC</small><strong>{euro(quote.totalTtc || 0)}</strong></div>
              <div><small>Devis N°</small><strong>{quote.quoteNumber}</strong></div>
              <div><small>Date de création</small><strong>{fmtFull(quote.quoteDate || quote.createdAt)}</strong></div>
              {quote.sentAt ? <div><small>Date d'envoi</small><strong>{fmtFull(quote.sentAt)}</strong></div> : null}
              {quote.signedAt ? <div><small>Date de signature</small><strong>{fmtFull(quote.signedAt)}</strong></div> : null}
              {quote.signaturePlace ? <div><small>Lieu de signature</small><strong>{quote.signaturePlace}</strong></div> : null}
            </div>

            {/* Progress */}
            <div className="ccd-progress">
              <div className="ccd-progress-info">
                <span>{done} / {tasks.length} ouvrage(s) terminé(s)</span>
                <strong>{percent}%</strong>
              </div>
              <div className="ccd-progress-bar"><div style={{ width: `${percent}%` }} /></div>
            </div>
          </div>

          {/* Urgence générale */}
          <div className="ccd-general-urgence">
            {genUrgSent ? (
              <div className="ccd-urgence-sent">✅ Alerte urgente envoyée à votre entreprise</div>
            ) : !showGeneralUrgence ? (
              <button type="button" className="ccd-urgence-trigger full" onClick={() => setShowGeneralUrgence(true)}>
                🚨 Signaler une urgence (dégât, fuite, problème grave...)
              </button>
            ) : (
              <div className="ccd-urgence-form open">
                <p className="ccd-urgence-title">🚨 Signaler une situation urgente</p>
                <select value={genUrgType} onChange={(e) => setGenUrgType(e.target.value)}>
                  {URGENCE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <textarea
                  value={genUrgMsg}
                  onChange={(e) => setGenUrgMsg(e.target.value)}
                  placeholder="Décrivez précisément le problème urgent (localisation, gravité, danger immédiat…)"
                  rows={4}
                />
                {tasks.length > 0 ? (
                  <div className="ccd-urgence-tasks">
                    <p className="ccd-urgence-tasks-label">Ouvrages concernés (optionnel) :</p>
                    {tasks.map((task) => (
                      <label key={task.id} className="ccd-urgence-task-check">
                        <input
                          type="checkbox"
                          checked={genUrgTasks.includes(task.id)}
                          onChange={() => toggleGenTask(task.id)}
                        />
                        <span>{task.label || task.name || "Ouvrage"}</span>
                        {task.room ? <small>{task.room}</small> : null}
                      </label>
                    ))}
                  </div>
                ) : null}
                <div className="ccd-urgence-actions">
                  <button type="button" className="ghost-button" onClick={() => setShowGeneralUrgence(false)}>Annuler</button>
                  <button type="button" className="urgence-send-btn" onClick={submitGeneralUrgence} disabled={!genUrgMsg.trim() || genUrgSending}>
                    {genUrgSending ? "Envoi..." : "Envoyer l'alerte urgente"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Ouvrages */}
          <section className="ccd-section">
            <h2 className="ccd-section-title">Ouvrages du chantier</h2>
            {tasks.length === 0 ? (
              <div className="client-empty">Aucun ouvrage planifié pour ce chantier.</div>
            ) : tasks.map((task) => (
              <TaskCard key={task.id} task={task} userId={user?.id} projectId={quote.projectId} quoteId={params.id} onValidate={handleValidate} />
            ))}
          </section>

          {/* Discussions */}
          {messages.length > 0 ? (
            <section className="ccd-section">
              <h2 className="ccd-section-title">Échanges avec votre entreprise</h2>
              <div className="ccd-messages">
                {messages.map((msg) => (
                  <div key={msg.id} className="ccd-message">
                    <span className={`ct-task-badge step-1`}>{msg.channel === "email" ? "Email" : "SMS"}</span>
                    <div>
                      <small>{new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(msg.createdAt))}</small>
                      <p>{msg.subject || msg.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
