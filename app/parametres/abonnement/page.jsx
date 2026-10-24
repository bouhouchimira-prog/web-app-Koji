"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Shell } from "../../../components/Shell";
import { PricingPlans } from "../../../components/PricingPlans";
import { apiGet, apiSend } from "../../../lib/client-api";
import { useLocale } from "../../../lib/i18n";

const BILLING_STATUS_KEYS = {
  active: "billingStatusActive",
  trialing: "billingStatusActive",
  past_due: "billingStatusPastDue",
  unpaid: "billingStatusPastDue",
  canceled: "billingStatusCanceled"
};

export default function ParametresAbonnementPage() {
  return (
    <Suspense fallback={null}>
      <ParametresAbonnementContent />
    </Suspense>
  );
}

function ParametresAbonnementContent() {
  const { L } = useLocale();
  const searchParams = useSearchParams();
  const [plan, setPlan] = useState("");
  const [billingStatus, setBillingStatus] = useState("");
  const [billingInterval, setBillingInterval] = useState("");
  const [hasBillingAccount, setHasBillingAccount] = useState(false);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [billingMessage, setBillingMessage] = useState("");
  const [connectStatus, setConnectStatus] = useState({ hasAccount: false, onboarded: false });
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectMessage, setConnectMessage] = useState("");
  const [pendingPlan, setPendingPlan] = useState("");
  const [planError, setPlanError] = useState("");

  useEffect(() => {
    if (searchParams.get("checkout") === "success") setBillingMessage(L.settings.checkoutSuccess);
  }, [searchParams, L]);

  useEffect(() => {
    apiGet("/api/auth/profile")
      .then((payload) => {
        const user = payload.user;
        if (!user) return;
        setPlan(user.plan || "");
        setBillingStatus(user.billingStatus || "");
        setBillingInterval(user.billingInterval || "");
        setHasBillingAccount(Boolean(user.hasBillingAccount));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    apiGet("/api/billing/connect")
      .then((data) => setConnectStatus({ hasAccount: Boolean(data.hasAccount), onboarded: Boolean(data.onboarded) }))
      .catch(() => {});
  }, []);

  async function startConnectOnboarding() {
    setConnectLoading(true);
    setConnectMessage("");
    try {
      const response = await apiSend("/api/billing/connect", {});
      window.location.href = response.url;
    } catch (error) {
      setConnectMessage(error.message || "Impossible de démarrer la configuration.");
      setConnectLoading(false);
    }
  }

  async function openBillingPortal() {
    setPortalLoading(true);
    setBillingMessage("");
    try {
      const response = await apiSend("/api/billing/portal", {});
      window.location.href = response.url;
    } catch (error) {
      setBillingMessage(error.message || L.settings.billingError);
      setPortalLoading(false);
    }
  }

  // Cartes de prix integrees ici (24 oct, demande d'Amira : ne plus avoir a
  // changer de page pour changer de formule) — deja connectee a ce stade
  // (page dans le Shell), pas besoin de la branche "pas de compte -> signup"
  // que app/abonnement/page.jsx (publique) doit gerer elle.
  async function handleChoosePlan(plan, interval) {
    if (plan === "start") return; // Deja la formule gratuite par defaut, rien a faire ici.
    setPlanError("");
    setPendingPlan(plan);
    try {
      const response = await apiSend("/api/billing/checkout", { interval, plan });
      window.location.href = response.url;
    } catch (error) {
      setPlanError(error.message || "Impossible de démarrer le paiement.");
      setPendingPlan("");
    }
  }

  if (loading) {
    return (
      <Shell>
        <section className="panel"><div className="empty-state">{L.common.loading}</div></section>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="profile-layout">
        <header className="profile-header">
          <h1>{L.settings.subscription}</h1>
        </header>

        <section className="profile-block">
          <h2>{L.settings.subscription}</h2>
          {billingStatus ? (
            <div className="settings-plan-row">
              <span>{L.settings.billingInterval}</span>
              <strong>
                {L.settings[BILLING_STATUS_KEYS[billingStatus] || "billingStatusActive"]}
                {billingInterval ? ` · ${billingInterval === "year" ? L.settings.billingYearly : L.settings.billingMonthly}` : ""}
              </strong>
            </div>
          ) : null}
          {billingMessage ? <p className="profile-message">{billingMessage}</p> : null}

          <div className="plan-soon-row plan-included-row">
            <span>Recevoir des paiements (Radar des Chantiers)</span>
            <span className="plan-soon-badge plan-included-badge">{connectStatus.onboarded ? "Configuré" : connectStatus.hasAccount ? "À finaliser" : "Non configuré"}</span>
          </div>
          {connectMessage ? <p className="profile-message">{connectMessage}</p> : null}
          {!connectStatus.onboarded ? (
            <button type="button" className="button secondary profile-link-button" onClick={startConnectOnboarding} disabled={connectLoading}>
              {connectLoading ? L.common.loading : connectStatus.hasAccount ? "Terminer la configuration Stripe" : "Configurer Stripe pour recevoir des paiements"}
            </button>
          ) : null}

          {hasBillingAccount ? (
            <div className="profile-card-actions profile-card-actions-column">
              <button type="button" className="button secondary profile-link-button" onClick={openBillingPortal} disabled={portalLoading}>
                {portalLoading ? L.common.loading : L.settings.manageBilling}
              </button>
            </div>
          ) : null}
        </section>

        <section className="profile-block">
          <h2>{L.settings.changePlan}</h2>
          {planError ? <p className="profile-message error">{planError}</p> : null}
          <PricingPlans
            currentPlan={plan === "pro" || plan === "business" ? plan : "start"}
            onChoosePlan={handleChoosePlan}
            pendingPlan={pendingPlan}
            showHero={false}
          />
        </section>
      </div>
    </Shell>
  );
}
