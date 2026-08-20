"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Shell } from "../../../components/Shell";
import { apiGet, apiSend } from "../../../lib/client-api";
import { useLocale } from "../../../lib/i18n";
import { PLAN_LIMITS } from "../../../lib/plan";

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
  const [addonWebsite, setAddonWebsite] = useState(false);
  const [addonLoading, setAddonLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [billingMessage, setBillingMessage] = useState("");

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
        setAddonWebsite(Boolean(user.addonWebsite));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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

  async function toggleAddonWebsite() {
    const next = !addonWebsite;
    setAddonLoading(true);
    setBillingMessage("");
    try {
      await apiSend("/api/billing/addon", { enable: next });
      setAddonWebsite(next);
    } catch (error) {
      setBillingMessage(error.message || L.settings.addonError);
    } finally {
      setAddonLoading(false);
    }
  }

  const planLabel = PLAN_LIMITS[plan]?.label || L.settings.trialPlan;

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
          <div className="settings-plan-row">
            <span>{L.settings.currentPlan}</span>
            <strong>{planLabel}</strong>
          </div>
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

          {plan === "pro" && billingStatus === "active" ? (
            <label className="plan-addon-row">
              <input type="checkbox" checked={addonWebsite} onChange={toggleAddonWebsite} disabled={addonLoading} />
              <span className="plan-addon-text">
                <strong>{L.abonnement.addonWebsite}</strong>
                <span>{L.abonnement.addonWebsiteDesc}</span>
              </span>
            </label>
          ) : null}

          <div className="plan-soon-row">
            <span>{L.abonnement.marketplaceTitle}</span>
            <span className="plan-soon-badge">{L.abonnement.marketplaceComingSoon}</span>
          </div>

          <div className="profile-card-actions profile-card-actions-column">
            {hasBillingAccount ? (
              <button type="button" className="button secondary profile-link-button" onClick={openBillingPortal} disabled={portalLoading}>
                {portalLoading ? L.common.loading : L.settings.manageBilling}
              </button>
            ) : null}
            <Link href="/abonnement" className="button secondary profile-link-button">{L.settings.changePlan}</Link>
          </div>
        </section>
      </div>
    </Shell>
  );
}
