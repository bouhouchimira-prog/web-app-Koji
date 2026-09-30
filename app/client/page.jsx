"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ClientTopbar } from "../../components/ClientTopbar";
import { euro } from "../../lib/pricing";
import { useLocale } from "../../lib/i18n";
import "./client-home.css";
import { ChevronRight, DemandeItem, IconPlus, IconShield, useSuivis } from "./demandes-ui";

// Accueil particulier (refonte UX, septembre 2026) : couleurs Koji Pro,
// un bouton principal « Publier un chantier » et la liste des demandes du
// client avec leur état. Routes existantes uniquement :
// GET /api/chantier-offres, GET /api/marketplace/offres/[id]/positionner
// (côté particulier : liste des entreprises positionnées) et
// GET /api/marketplace/offres/[id]/messages.

const DEMANDES_VISIBLES = 5;

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

// Utilisé aussi par app/client/chantiers/page.jsx : inchangé.
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

// ---------- Page ----------

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
      .catch(() => setOffres([]))
      .finally(() => setLoading(false));
  }, []);

  const suivis = useSuivis(offres, DEMANDES_VISIBLES);

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

  const prenom = String(user.name || "").trim().split(/\s+/)[0] || "";
  const visibles = offres.slice(0, DEMANDES_VISIBLES);
  const restantes = offres.length - visibles.length;
  const aDesDemandes = offres.length > 0;

  return (
    <main className="client-space">
      <ClientTopbar />

      <div className="kc">
        {/* Bandeau d'accueil */}
        <section className="kc-hero">
          <p className="kc-hello">{prenom ? `Bonjour ${prenom}` : "Bonjour"}</p>
          <h1 className="kc-title">{aDesDemandes ? "Un autre projet de travaux\u00a0?" : "Quels travaux voulez-vous faire\u00a0?"}</h1>
          <p className="kc-sub">Décrivez votre projet en quelques minutes. Les artisans de votre secteur vous répondent.</p>
          <Link href="/client/radar/new" className="kc-btn kc-btn-lemon">
            <IconPlus /> Publier un chantier
          </Link>
          <p className="kc-mention">C'est gratuit, et c'est vous qui choisissez votre artisan.</p>
        </section>

        {/* Mes demandes */}
        <section className="kc-block">
          <div className="kc-block-head">
            <h2 className="kc-block-title">
              {aDesDemandes || loading ? "Mes demandes" : "Comment ça marche"}
              {aDesDemandes ? <span className="kc-count">{offres.length}</span> : null}
            </h2>
            {aDesDemandes ? (
              <Link href="/client/radar" className="kc-btn kc-btn-ghost">Tout voir <ChevronRight /></Link>
            ) : null}
          </div>

          {loading ? (
            <div className="kc-empty">Chargement…</div>
          ) : !aDesDemandes ? (
            <ol className="kc-steps">
              <li>
                <span className="kc-step-num">1</span>
                <span><strong>Décrivez vos travaux</strong><small>L'assistant Koji vous pose quelques questions et estime le prix.</small></span>
              </li>
              <li>
                <span className="kc-step-num">2</span>
                <span><strong>Les artisans se positionnent</strong><small>Seuls les artisans du bon métier, près de chez vous, voient votre demande.</small></span>
              </li>
              <li>
                <span className="kc-step-num">3</span>
                <span><strong>Vous choisissez</strong><small>Vous échangez avec eux dans Koji et fixez une visite.</small></span>
              </li>
            </ol>
          ) : (
            <>
              <ul className="kc-list">
                {visibles.map((offre) => <DemandeItem key={offre.id} offre={offre} suivi={suivis[offre.id]} />)}
              </ul>
              {restantes > 0 ? (
                <Link href="/client/radar" className="kc-btn kc-btn-more">
                  Voir {restantes} demande{restantes > 1 ? "s" : ""} de plus <ChevronRight />
                </Link>
              ) : null}
            </>
          )}
        </section>

        {/* Réassurance */}
        <p className="kc-note"><IconShield /> Votre adresse et votre numéro ne sont jamais transmis aux artisans. Tout se passe dans Koji.</p>
      </div>
    </main>
  );
}
