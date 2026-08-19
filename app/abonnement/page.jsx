"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "../../lib/i18n";
import { apiSend, readStoredUser } from "../../lib/client-api";

function getPlans(L) {
  return [
    {
      id: "go",
      name: "Koji GO",
      monthly: 19.99,
      yearly: 199.9,
      color: "#2563eb",
      features: [
        "4 " + (L.devis?.title || "devis"),
        "Nombre illimité de versions par devis",
        "Génération PDF & Word",
        "Signature électronique",
        "Espace client particulier",
      ],
    },
    {
      id: "premium",
      name: "Koji Premium",
      monthly: 49.99,
      yearly: 499.9,
      color: "#f5c842",
      badge: L.abonnement.popular,
      features: [
        "Devis illimités",
        "Nombre illimité de versions par devis",
        "Accès Marketplace",
        "Bibliothèque d'ouvrages avancée",
        "Gestion d'équipe",
        "Notifications SMS",
      ],
    },
    {
      id: "business",
      name: "Koji Business",
      monthly: 99.99,
      yearly: 999.9,
      color: "#1f8a4c",
      features: [
        "Accès illimité à Koji et à tous ses outils",
        "Devis et chantiers illimités",
        "Multi-utilisateurs",
        "Support prioritaire",
        "Intégration comptable",
        "Rapports personnalisés",
      ],
    },
  ];
}

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
  const plans = useMemo(() => getPlans(L), [L]);
  const [interval, setInterval] = useState("month");
  const [pendingPlan, setPendingPlan] = useState("");
  const [error, setError] = useState("");
  const [accountType, setAccountType] = useState("entreprise");

  useEffect(() => {
    const user = readStoredUser();
    if (user?.accountType) setAccountType(user.accountType);
  }, []);

  useEffect(() => {
    if (searchParams.get("checkout") === "cancel") setError(L.abonnement.checkoutCanceled);
  }, [searchParams, L]);

  async function handleSubscribe(plan) {
    setError("");
    setPendingPlan(plan.id);
    try {
      const response = await apiSend("/api/billing/checkout", { plan: plan.id, interval });
      window.location.href = response.url;
    } catch (err) {
      setError(err.message || L.abonnement.checkoutError);
      setPendingPlan("");
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

      <section className="plans-grid">
        {plans.map((plan) => {
          const price = interval === "month" ? plan.monthly : plan.yearly;
          const period = interval === "month" ? L.abonnement.perMonth : L.abonnement.perYear;
          const loading = pendingPlan === plan.id;
          return (
            <article className={`plan-card${plan.badge ? " plan-card-featured" : ""}`} key={plan.id}>
              {plan.badge && <div className="plan-badge">{plan.badge}</div>}
              <div className="plan-header">
                <h2 style={{ color: plan.color }}>{plan.name}</h2>
                <div className="plan-price">
                  <span className="plan-amount">{formatPrice(price)} €</span>
                  <span className="plan-period">{period}</span>
                </div>
              </div>
              <ul className="plan-features">
                {plan.features.map((f) => (
                  <li key={f}>
                    <span className="plan-check" style={{ color: plan.color }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="button"
                style={{ background: plan.color, color: "#fff", border: "none", width: "100%" }}
                onClick={() => handleSubscribe(plan)}
                disabled={Boolean(pendingPlan)}
              >
                {loading ? L.abonnement.redirecting : `${L.abonnement.choose} — ${formatPrice(price)} €${period}`}
              </button>
            </article>
          );
        })}
      </section>

      <div style={{ textAlign: "center", marginTop: 24 }}>
        <button type="button" className="button secondary" onClick={() => router.back()}>
          {L.common.back}
        </button>
      </div>
    </Shell>
  );
}
