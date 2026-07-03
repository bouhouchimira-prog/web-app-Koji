"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ClientTopbar } from "../../components/ClientTopbar";
import { euro, shortDate } from "../../lib/pricing";

function getStoredUser() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("koji-user") || "null"); } catch { return null; }
}

function formatDate(v) {
  if (!v) return "-";
  try { return shortDate(v); } catch { return v; }
}

function ProgressRing({ percent, size = 72 }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const fill = circ - (circ * Math.min(percent, 100)) / 100;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="progress-ring">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e8edf5" strokeWidth="6" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--blue)" strokeWidth="6"
        strokeDasharray={circ} strokeDashoffset={fill} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--navy)">{percent}%</text>
    </svg>
  );
}

const TASK_STEPS = ["Début", "En cours", "Validé", "Terminé"];

function getTaskStep(task) {
  if (task.done) return 3;
  if (task.clientValidationStatus === "Valide" || task.status === "Valide par client") return 2;
  if (task.pendingValidation || task.startedAt || task.status === "En cours" || task.status === "Terminee (a valider)") return 1;
  return 0;
}

function TaskRow({ task, onValidate }) {
  const [open, setOpen] = useState(false);
  const step = getTaskStep(task);
  const canValidate = step === 1 && (task.pendingValidation || task.status === "Terminee (a valider)");

  return (
    <div className={`ct-task${open ? " open" : ""}`}>
      <button type="button" className="ct-task-head" onClick={() => setOpen((v) => !v)}>
        <span className={`ct-task-dot step-${step}`} />
        <div className="ct-task-info">
          <span className="ct-task-room">{task.room || "Chantier"}</span>
          <strong>{task.label || task.title || task.name}</strong>
        </div>
        <span className={`ct-task-badge step-${step}`}>{TASK_STEPS[step]}</span>
        <svg className={`ct-chevron${open ? " open" : ""}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
      </button>

      {open ? (
        <div className="ct-task-body">
          <div className="ct-status-bar">
            {TASK_STEPS.map((label, i) => (
              <div key={label} className={`ct-step${i <= step ? " active" : ""}${i === step ? " current" : ""}`}>
                <div className="ct-step-dot" />
                {i < TASK_STEPS.length - 1 && <div className="ct-step-line" />}
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div className="ct-task-meta">
            {task.startDate || task.dueDate ? <div><small>Planifié</small><span>{formatDate(task.startDate || task.dueDate)}{task.endDate ? ` → ${formatDate(task.endDate)}` : ""}</span></div> : null}
            <div><small>Équipe</small><span>{task.assignedTo || "Non assignée"}</span></div>
            {task.completedByName ? <div><small>Terminé par</small><span>{task.completedByName}</span></div> : null}
          </div>

          {canValidate ? (
            <div className="ct-validate-block">
              <p>L'équipe a terminé cet ouvrage et attend votre confirmation. Validez si le travail est conforme.</p>
              <button type="button" className="primary-button" onClick={() => onValidate(task.id)}>
                Valider l'ouvrage (procès-verbal)
              </button>
            </div>
          ) : step === 3 ? (
            <div className="ct-done-badge">Ouvrage terminé et validé</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ChantierCard({ quote }) {
  const router = useRouter();
  const tasks = quote.tasks || [];
  const done = tasks.filter((t) => t.done).length;
  const percent = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const isSigned = quote.status === "Signe" || quote.signatureStatus === "Signe";

  return (
    <button type="button" className="ct-chantier ct-chantier-link" onClick={() => router.push(`/client/chantier/${quote.id}`)}>
      <div className="ct-chantier-header">
        <ProgressRing percent={percent} />
        <div className="ct-chantier-info">
          <strong>{quote.project?.title || quote.projectName || quote.project || "Chantier"}</strong>
          <small>{quote.client} · {euro(quote.totalTtc || 0)}</small>
          <small>Devis {quote.quoteNumber} · {isSigned ? "Signé" : quote.status}</small>
        </div>
        <div className="ct-chantier-right">
          <span className={`ct-task-badge step-${isSigned ? 3 : 0}`}>{isSigned ? "Signé" : (quote.status || "En attente")}</span>
        </div>
        <svg className="ct-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
      </div>
      <div className="ct-chantier-footer">
        <span>{done} / {tasks.length} ouvrage(s) terminé(s)</span>
        <div className="ct-progress-bar"><div style={{ width: `${percent}%` }} /></div>
      </div>
    </button>
  );
}

function DevisTrialModal({ onClose, alreadyUsed }) {
  return (
    <div className="ct-modal-overlay" onClick={onClose}>
      <div className="ct-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ct-modal-logo"><img src="/koji-logo.svg" alt="Koji" /></div>
        <h2>Essayez Koji en tant qu'entreprise</h2>
        {alreadyUsed ? (
          <>
            <p>Vous avez déjà utilisé votre devis d'essai gratuit. Pour créer des devis illimités et gérer vos chantiers, passez à Koji Pro.</p>
            <Link className="primary-button" href="/abonnement">Découvrir Koji Pro</Link>
          </>
        ) : (
          <>
            <p>Créez un premier devis gratuitement pour découvrir toute la puissance de Koji côté entreprise — sans engagement.</p>
            <Link className="primary-button" href="/signup?type=entreprise&ref=client-trial">Créer mon compte Koji</Link>
            <p className="ct-modal-note">14 jours d'essai · Aucune carte bancaire requise</p>
          </>
        )}
        <button type="button" className="ghost-button" style={{ marginTop: 8 }} onClick={onClose}>Fermer</button>
      </div>
    </div>
  );
}

export default function ClientHomePage() {
  const [user, setUser] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTrial, setShowTrial] = useState(false);
  const [trialUsed, setTrialUsed] = useState(false);

  useEffect(() => {
    const stored = getStoredUser();
    setUser(stored);
    if (!stored?.email) { setLoading(false); return; }
    const params = new URLSearchParams({ email: stored.email, userId: stored.id || "" });
    fetch(`/api/client/quotes?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => setQuotes(data.quotes || []))
      .finally(() => setLoading(false));
    setTrialUsed(localStorage.getItem("koji-client-devis-trial") === "1");
  }, []);

  const signedQuotes = useMemo(() => quotes.filter((q) => q.status === "Signe" || q.signatureStatus === "Signe"), [quotes]);
  const allTasks = useMemo(() => quotes.flatMap((q) => q.tasks || []), [quotes]);
  const companyInfo = useMemo(() => quotes[0]?.company || null, [quotes]);

  async function handleValidateTask(taskId) {
    if (!user?.id) return;
    const r = await fetch("/api/client/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, taskId, action: "client-validate" })
    });
    if (!r.ok) return;
    const data = await r.json();
    setQuotes((prev) => prev.map((q) => ({
      ...q,
      tasks: (q.tasks || []).map((t) => t.id === taskId ? data.task : t)
    })));
  }

  function handleDevisTrial() {
    if (!trialUsed) localStorage.setItem("koji-client-devis-trial", "1");
    setShowTrial(true);
  }

  if (!user?.email) {
    return (
      <main className="client-space">
        <section className="client-auth-card">
          <div className="koji-mark small">KJ</div>
          <h1>Espace particulier</h1>
          <p>Connectez-vous avec les identifiants reçus de votre artisan.</p>
          <Link className="primary-button" href="/login?type=particulier">Connexion client</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="client-space">
      <ClientTopbar />

      {showTrial ? <DevisTrialModal onClose={() => setShowTrial(false)} alreadyUsed={trialUsed} /> : null}

      <button type="button" className="new-chantier-bar" onClick={handleDevisTrial}>
        <span className="new-chantier-icon">+</span>
        Créer un devis
      </button>

      <div className="ct-welcome">
        <strong>Bonjour, {user.name || user.email.split("@")[0]}</strong>
        <small>Espace client Koji</small>
      </div>

      <div className="ct-stats">
        <div className="ct-stat"><span>{quotes.length}</span><small>Devis reçus</small></div>
        <div className="ct-stat"><span>{signedQuotes.length}</span><small>Signés</small></div>
        <div className="ct-stat"><span>{allTasks.filter((t) => t.done).length}/{allTasks.length}</span><small>Ouvrages</small></div>
      </div>


      <section className="ct-section">
        <h2 className="ct-section-title">Mes chantiers</h2>
        {loading ? <div className="client-empty">Chargement...</div> : null}
        {!loading && quotes.length === 0 ? <div className="client-empty">Aucun devis lié à votre compte.</div> : null}
        {quotes.map((quote) => (
          <ChantierCard key={quote.id} quote={quote} />
        ))}
      </section>
    </main>
  );
}
