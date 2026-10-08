"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ClientTopbar } from "../../components/ClientTopbar";
import { euro, shortDate } from "../../lib/pricing";
import { useLocale } from "../../lib/i18n";
import { metierVisuel } from "../../lib/metier-visuel";

const STATUS_LABEL = {
  Publiee: "Publiée",
  "En attente": "En attente",
  Terminee: "Terminée",
  SansSuite: "Sans suite"
};

function getStoredUser() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("koji-user") || "null"); } catch { return null; }
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

  const prenom = (user.name || "").trim().split(/\s+/)[0] || "";

  return (
    <main className="client-space">
      <ClientTopbar />

      <section className="client-radar-hero client-radar-hero-plain">
        <div className="client-radar-hero-top">
          {prenom ? <p className="client-radar-hero-greeting">Bonjour {prenom}</p> : null}
          <h1>Un autre projet de travaux ?</h1>
          <p className="client-radar-hero-sub">
            Décrivez votre projet en quelques minutes. Les artisans de votre secteur vous répondent.
          </p>
        </div>
        <div className="client-radar-hero-bottom">
          <Link href="/client/radar/new" className="client-radar-hero-cta">
            + Publier un chantier
          </Link>
          <p className="client-radar-hero-trust-line">C'est gratuit, et c'est vous qui choisissez votre artisan.</p>
        </div>
      </section>

      <section className="ct-section">
        <div className="ct-section-title-row">
          <h2 className="ct-section-title">Mes demandes{offres.length ? <span className="ct-count">{offres.length}</span> : null}</h2>
          <Link href="/client/radar" className="ct-section-see-all">Tout voir</Link>
        </div>
        {loading ? <div className="client-empty">{L.clientSpace.loading}</div> : null}
        {!loading && offres.length === 0 ? <div className="client-empty">Aucune demande publiée pour l'instant.</div> : null}
        <div className="client-list">
          {offres.slice(0, 5).map((offre) => {
            const visuel = metierVisuel(offre.metier);
            return (
              <Link key={offre.id} href={`/client/radar/${offre.id}`} className="ct-offer-card">
                <span className="ct-offer-metier-badge" style={{ background: visuel.color }} aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    {visuel.icon}
                  </svg>
                </span>
                <div className="ct-offer-card-info">
                  <strong>{offre.description.slice(0, 60)}{offre.description.length > 60 ? "…" : ""}</strong>
                  <small>{offre.metier} · {offre.address} · {shortDate(offre.createdAt)}</small>
                </div>
                <div className="ct-devis-row-right">
                  {offre.priceRangeMin ? (
                    <span className="client-amount">{euro(offre.priceRangeMin)}–{euro(offre.priceRangeMax)}</span>
                  ) : null}
                  <span className={`radar-status-badge${offre.hasArtisanReply ? " contacted" : ""}`}>
                    {offre.hasArtisanReply ? "Un artisan vous a écrit" : (STATUS_LABEL[offre.status] || offre.status)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
