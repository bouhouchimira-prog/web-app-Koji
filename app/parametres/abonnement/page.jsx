"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Shell } from "../../../components/Shell";
import { apiGet, apiSend } from "../../../lib/client-api";
import { useLocale } from "../../../lib/i18n";
import { PLAN_LIMITS } from "../../../lib/plan";

const emptyBusinessPayment = { iban: "", bic: "", bankHolder: "", paymentTerms: "" };

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
  const [businessPayment, setBusinessPayment] = useState(emptyBusinessPayment);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [message, setMessage] = useState("");
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
        const business = user.business || {};
        setBusinessPayment({
          iban: business.iban || "",
          bic: business.bic || "",
          bankHolder: business.bankHolder || "",
          paymentTerms: business.paymentTerms || ""
        });
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

  function setField(field, value) {
    setBusinessPayment((current) => ({ ...current, [field]: value }));
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await apiSend("/api/auth/profile", { business: businessPayment }, "PATCH");
      window.localStorage.setItem("koji-user", JSON.stringify(response.user));
      setMessage(L.parametres.saved);
    } catch (error) {
      setMessage(error.message || L.settings.reportError);
    } finally {
      setSaving(false);
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
      <form className="profile-layout" onSubmit={save}>
        <header className="profile-header">
          <h1>{L.settings.subscription}</h1>
        </header>

        <section className="profile-block">
          <h2>{L.parametres.bank}</h2>
          <p className="muted">{L.parametres.bankSub}</p>
          <div className="profile-grid">
            <label className="profile-field">
              <span>{L.parametres.iban}</span>
              <div className="profile-input">
                <input value={businessPayment.iban} onChange={(event) => setField("iban", event.target.value)} placeholder="FR76 3000 6000 0112 3456 7890 189" />
              </div>
            </label>
            <label className="profile-field">
              <span>{L.parametres.bic}</span>
              <div className="profile-input">
                <input value={businessPayment.bic} onChange={(event) => setField("bic", event.target.value)} placeholder="BNPAFRPP" />
              </div>
            </label>
            <label className="profile-field">
              <span>{L.parametres.bankHolder}</span>
              <div className="profile-input">
                <input value={businessPayment.bankHolder} onChange={(event) => setField("bankHolder", event.target.value)} placeholder={L.parametres.bankHolder} />
              </div>
            </label>
          </div>
        </section>

        <section className="profile-block">
          <h2>{L.parametres.paymentTerms}</h2>
          <p className="muted">{L.parametres.paymentTermsSub}</p>
          <label className="profile-field wide">
            <span>{L.parametres.paymentTermsLabel}</span>
            <textarea
              className="profile-textarea"
              rows={4}
              value={businessPayment.paymentTerms}
              onChange={(event) => setField("paymentTerms", event.target.value)}
              placeholder={L.parametres.paymentTermsLabel}
            />
          </label>
        </section>

        {message ? <p className="profile-message">{message}</p> : null}

        <footer className="profile-actions">
          <button className="button blue" disabled={saving}>{saving ? L.parametres.saving : L.parametres.save}</button>
        </footer>
      </form>

      <div className="profile-layout">
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
