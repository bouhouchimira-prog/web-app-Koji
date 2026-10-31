"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ProAccountNav } from "../../../components/ProAccountNav";
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
  }, [L]);

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

  const PLAN_NAMES = { start: "Start", pro: "Pro", business: "Business" };
  const currentPlan = plan === "pro" || plan === "business" ? plan : "start";
  const connectLabel = connectStatus.onboarded ? "Configuré" : connectStatus.hasAccount ? "À finaliser" : "Non configuré";

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow">Profil et compte</span>
          <h1>{L.settings.subscription}</h1>
          <span className="muted">Votre formule, sa facturation et la réception des paiements de vos clients.</span>
        </div>
      </div>
      {billingMessage ? <p className="notice" role="status">{billingMessage}</p> : null}

      <div className="pf-g">
        <ProAccountNav current="abonnement" />
        <div className="pf-c">
          {loading ? <div className="tbl"><p className="empty">{L.common.loading}</p></div> : (
            <>
              <div className="pf-g2">
                <section className="card">
                  <div className="card-h"><h2>Votre formule</h2><span className="tag tag-b">{PLAN_NAMES[currentPlan]}</span></div>
                  <div className="kv"><span>Formule</span><b>Koji {PLAN_NAMES[currentPlan]}</b></div>
                  {billingStatus ? (
                    <div className="kv">
                      <span>{L.settings.billingInterval}</span>
                      <b>
                        {L.settings[BILLING_STATUS_KEYS[billingStatus] || "billingStatusActive"]}
                        {billingInterval ? ` · ${billingInterval === "year" ? L.settings.billingYearly : L.settings.billingMonthly}` : ""}
                      </b>
                    </div>
                  ) : null}
                  {hasBillingAccount ? (
                    <div className="ed-act ab-act">
                      <button type="button" className="btn btn-sec" onClick={openBillingPortal} disabled={portalLoading}>
                        {portalLoading ? L.common.loading : L.settings.manageBilling}
                      </button>
                    </div>
                  ) : null}
                </section>

                <section className="card">
                  <div className="card-h"><h2>Recevoir des paiements</h2><span className={connectStatus.onboarded ? "tag tag-b" : "tag tag-o"}>{connectLabel}</span></div>
                  <p className="muted">Pour encaisser les paiements échelonnés du Radar des chantiers, via Stripe.</p>
                  {connectMessage ? <p className="notice notice-err" role="alert">{connectMessage}</p> : null}
                  {!connectStatus.onboarded ? (
                    <div className="ed-act ab-act">
                      <button type="button" className="btn btn-sec" onClick={startConnectOnboarding} disabled={connectLoading}>
                        {connectLoading ? L.common.loading : connectStatus.hasAccount ? "Terminer la configuration Stripe" : "Configurer Stripe"}
                      </button>
                    </div>
                  ) : null}
                </section>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Pleine largeur : les trois formules ne tiennent pas dans la colonne à côté du menu. */}
      {loading ? null : (
        <section className="card ab-change">
          <div className="card-h"><h2>{L.settings.changePlan}</h2></div>
          {planError ? <p className="notice notice-err" role="alert">{planError}</p> : null}
          <div className="ab-plans">
            <PricingPlans
              currentPlan={currentPlan}
              onChoosePlan={handleChoosePlan}
              pendingPlan={pendingPlan}
              showHero={false}
            />
          </div>
        </section>
      )}
    </Shell>
  );
}
