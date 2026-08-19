"use client";

import { Suspense, useEffect, useState } from "react";
import { Shell } from "../../components/Shell";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "../../lib/i18n";
import { apiSend, readStoredUser } from "../../lib/client-api";

const PRO_MONTHLY = 49.99;
const PRO_YEARLY = 499.9;
const WEBSITE_MONTHLY = 14.99;
const WEBSITE_YEARLY = 149.9;

const FEATURES = [
  "Création de chantiers et devis illimités",
  "Suivi de chantiers en temps réel",
  "Suivi des travaux et de l'équipe",
  "Pointage des ouvriers",
  "Calendrier & planning",
  "Génération de devis en PDF & Word",
  "Signature électronique des devis",
  "Facturation (acomptes, factures intermédiaires et finales)",
  "Espace client dédié pour vos clients",
  "Bibliothèque d'ouvrages & fournisseurs",
  "Carte de visite Koji offerte",
];

function formatPrice(value) {
  return value.toFixed(2).replace(".", ",");
}

export default function AbonnementPage() {
  return (
    <Suspense fallback={null}>
      <AbonnementContent />
    </Suspense>
  );
}

function AbonnementContent() {
  const { L } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [interval, setInterval] = useState("month");
  const [website, setWebsite] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [accountType, setAccountType] = useState("entreprise");

  useEffect(() => {
    const user = readStoredUser();
    if (user?.accountType) setAccountType(user.accountType);
  }, []);

  useEffect(() => {
    if (searchParams.get("checkout") === "cancel") setError(L.abonnement.checkoutCanceled);
  }, [searchParams, L]);

  async function handleSubscribe() {
    setError("");
    setPending(true);
    try {
      const response = await apiSend("/api/billing/checkout", { interval, addons: { website } });
      window.location.href = response.url;
    } catch (err) {
      setError(err.message || L.abonnement.checkoutError);
      setPending(false);
    }
  }

  if (accountType !== "entreprise") {
    return (
      <Shell>
        <header className="page-header" style={{ textAlign: "center" }}>
          <div>
            <p className="eyebrow">ABONNEMENT</p>
            <h1>{L.abonnement.title}</h1>
          </div>
        </header>
        <section className="panel">
          <div className="empty-state">{L.abonnement.contact}</div>
        </section>
      </Shell>
    );
  }

  const period = interval === "month" ? L.abonnement.perMonth : L.abonnement.perYear;
  const proPrice = interval === "month" ? PRO_MONTHLY : PRO_YEARLY;
  const websitePrice = interval === "month" ? WEBSITE_MONTHLY : WEBSITE_YEARLY;
  const total = proPrice + (website ? websitePrice : 0);

  return (
    <Shell>
      <header className="page-header" style={{ textAlign: "center" }}>
        <div>
          <p className="eyebrow">ABONNEMENT</p>
          <h1>{L.abonnement.title}</h1>
          <p className="page-subtitle">{L.abonnement.subtitle}</p>
        </div>
      </header>

      <div className="settings-theme-toggle" style={{ margin: "0 auto 24px" }}>
        <button type="button" className={interval === "month" ? "active" : ""} onClick={() => setInterval("month")}>
          {L.abonnement.intervalMonthly}
        </button>
        <button type="button" className={interval === "year" ? "active" : ""} onClick={() => setInterval("year")}>
          {L.abonnement.intervalYearly} · {L.abonnement.yearlySaving}
        </button>
      </div>

      {error ? <p className="profile-message error" style={{ textAlign: "center" }}>{error}</p> : null}

      <section className="plans-grid plan-card-single-grid">
        <article className="plan-card plan-card-featured plan-card-single">
          <div className="plan-badge">Koji Pro</div>
          <div className="plan-header">
            <h2 style={{ color: "#2563eb" }}>{L.abonnement.singlePlanName}</h2>
            <div className="plan-price">
              <span className="plan-amount">{formatPrice(proPrice)} €</span>
              <span className="plan-period">{period}</span>
            </div>
          </div>
          <ul className="plan-features">
            {FEATURES.map((f) => (
              <li key={f}>
                <span className="plan-check" style={{ color: "#2563eb" }}>✓</span>
                {f}
              </li>
            ))}
          </ul>

          <label className="plan-addon-row">
            <input type="checkbox" checked={website} onChange={(event) => setWebsite(event.target.checked)} />
            <span className="plan-addon-text">
              <strong>{L.abonnement.addonWebsite}</strong>
              <span>{L.abonnement.addonWebsiteDesc}</span>
              <span className="plan-addon-price">+ {formatPrice(websitePrice)} € {period}</span>
            </span>
          </label>

          <div className="plan-soon-row">
            <span>{L.abonnement.marketplaceTitle}</span>
            <span className="plan-soon-badge">{L.abonnement.marketplaceComingSoon}</span>
          </div>

          <div className="plan-total-row">
            <span>{L.abonnement.total}</span>
            <strong>{formatPrice(total)} € {period}</strong>
          </div>

          <button
            type="button"
            className="button"
            style={{ background: "#2563eb", color: "#fff", border: "none", width: "100%" }}
            onClick={handleSubscribe}
            disabled={pending}
          >
            {pending ? L.abonnement.redirecting : `${L.abonnement.choose} — ${formatPrice(total)} €${period}`}
          </button>
        </article>
      </section>

      <div style={{ textAlign: "center", marginTop: 24 }}>
        <button type="button" className="button secondary" onClick={() => router.back()}>
          {L.common.back}
        </button>
      </div>
    </Shell>
  );
}
