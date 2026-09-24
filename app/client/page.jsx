"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ClientTopbar } from "../../components/ClientTopbar";
import { euro, shortDate } from "../../lib/pricing";
import { useLocale } from "../../lib/i18n";

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

function getTaskStep(task) {
  if (task.done) return 3;
  if (task.clientValidationStatus === "Valide" || task.status === "Valide par client") return 2;
  if (task.pendingValidation || task.startedAt || task.status === "En cours" || task.status === "Terminee (a valider)") return 1;
  return 0;
}

function TaskRow({ task, onValidate, taskSteps }) {
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
        <span className={`ct-task-badge step-${step}`}>{taskSteps[step]}</span>
        <svg className={`ct-chevron${open ? " open" : ""}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
      </button>

      {open ? (
        <div className="ct-task-body">
          <div className="ct-status-bar">
            {taskSteps.map((label, i) => (
              <div key={label} className={`ct-step${i <= step ? " active" : ""}${i === step ? " current" : ""}`}>
                <div className="ct-step-dot" />
                {i < taskSteps.length - 1 && <div className="ct-step-line" />}
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div className="ct-task-meta">
            {task.startDate || task.dueDate ? <div><small>Planifié</small><span>{formatDate(task.startDate || task.dueDate)}{task.endDate ? ` → ${formatDate(task.endDate)}` : ""}</span></div> : null}
            <div><small>Équipe</small><span>{task.assignedTo || "—"}</span></div>
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

export function ChantierCard({ quote, signedLabel, inProgressLabel, waitingLabel }) {
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
          <small>Devis {quote.quoteNumber} · {isSigned ? signedLabel : quote.status}</small>
        </div>
        <div className="ct-chantier-right">
          <span className={`ct-task-badge step-${isSigned ? 3 : 0}`}>{isSigned ? signedLabel : (quote.status || waitingLabel)}</span>
        </div>
        <svg className="ct-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
      </div>
      <div className="ct-chantier-footer">
        <span>{done} / {tasks.length}</span>
        <div className="ct-progress-bar"><div style={{ width: `${percent}%` }} /></div>
      </div>
    </button>
  );
}

export default function ClientHomePage() {
  const { L } = useLocale();
  const [user, setUser] = useState(null);
  const [offres, setOffres] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getStoredUser();
    setUser(stored);
    if (!stored?.email) { setLoading(false); return; }
    fetch("/api/chantier-offres")
      .then((r) => r.json())
      .then((data) => setOffres(data.offres || []))
      .finally(() => setLoading(false));
  }, []);

  if (!user?.email) {
    return (
      <main className="client-space">
        <section className="client-auth-card">
          <div className="koji-mark small">KJ</div>
          <h1>{L.clientSpace.clientPortal}</h1>
          <p>{L.clientSpace.loginMsg}</p>
          <Link className="primary-button" href="/login?type=particulier">{L.clientSpace.loginBtn}</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="client-space">
      <ClientTopbar />

      <section className="client-radar-hero">
        <div className="client-radar-hero-orb" aria-hidden="true" />
        <div className="client-radar-hero-top">
          <p className="client-radar-hero-eyebrow">MARKETPLACE BTP</p>
          <h1>Votre projet de rénovation, simplement.</h1>
          <p className="client-radar-hero-sub">
            Décrivez votre projet à notre assistant KOJI et recevez rapidement des offres d'artisans qualifiés.
          </p>
        </div>
        <div className="client-radar-hero-bottom">
          <Link href="/client/radar/new" className="client-radar-hero-cta">
            Démarrer mon projet <span aria-hidden="true">→</span>
          </Link>
          <div className="client-radar-hero-trust">
            <span>✓ 100% gratuit</span>
            <span>✓ Sans engagement</span>
            <span>✓ Artisans vérifiés</span>
          </div>
        </div>
      </section>

      <section className="ct-section">
        <Link href="/client/radar" className="ct-offer-card">
          <div className="ct-offer-card-info">
            <strong>Mes offres</strong>
            <small>
              {loading
                ? L.clientSpace.loading
                : offres.length === 0
                  ? "Aucune offre publiée pour l'instant"
                  : `${offres.length} offre${offres.length > 1 ? "s" : ""} publiée${offres.length > 1 ? "s" : ""}`}
            </small>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
        </Link>
      </section>
    </main>
  );
}
