"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LangSwitcher } from "./LangSwitcher";
import { useLocale } from "../lib/i18n";
import { apiGet, apiSend } from "../lib/client-api";
import { PLAN_LIMITS } from "../lib/plan";

function getStoredTheme() {
  if (typeof window === "undefined") return "light";
  return localStorage.getItem("koji-theme") === "dark" ? "dark" : "light";
}

const emptyBusinessPayment = { iban: "", bic: "", bankHolder: "", paymentTerms: "" };

// Shared across the entreprise (/parametres), particulier (/client/profil)
// and ouvrier (app/worker/page.jsx) profiles. Two variants:
// - "cards": one .profile-block section per item, matching the entreprise
//   page's existing Signatures/Carte de visite/Tarification cards exactly,
//   so the new items don't introduce a second visual language on that page.
// - "compact" (default): the .settings-row list style, used where there's
//   no .profile-block precedent to match (client/worker profiles).
export function SettingsPanel({ accountType, variant = "compact" }) {
  const { L } = useLocale();
  const [theme, setTheme] = useState("light");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const [reportSent, setReportSent] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportSending, setReportSending] = useState(false);

  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [plan, setPlan] = useState("");
  const [businessPayment, setBusinessPayment] = useState(emptyBusinessPayment);
  const [bizSaving, setBizSaving] = useState(false);
  const [bizMessage, setBizMessage] = useState("");

  const isEntreprise = accountType === "entreprise";

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  useEffect(() => {
    if (!isEntreprise) return;
    apiGet("/api/auth/profile")
      .then((payload) => {
        const user = payload.user;
        if (!user) return;
        setPlan(user.plan || "");
        const business = user.business || {};
        setBusinessPayment({
          iban: business.iban || "",
          bic: business.bic || "",
          bankHolder: business.bankHolder || "",
          paymentTerms: business.paymentTerms || ""
        });
      })
      .catch(() => {});
  }, [isEntreprise]);

  function applyTheme(next) {
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("koji-theme", next);
  }

  function setBizField(field, value) {
    setBusinessPayment((current) => ({ ...current, [field]: value }));
  }

  async function saveBusinessPayment() {
    setBizSaving(true);
    setBizMessage("");
    try {
      const response = await apiSend("/api/auth/profile", { business: businessPayment }, "PATCH");
      const business = response.user?.business || {};
      setBusinessPayment({
        iban: business.iban || "",
        bic: business.bic || "",
        bankHolder: business.bankHolder || "",
        paymentTerms: business.paymentTerms || ""
      });
      window.localStorage.setItem("koji-user", JSON.stringify(response.user));
      setBizMessage(L.parametres.saved);
    } catch (error) {
      setBizMessage(error.message || L.settings.reportError);
    } finally {
      setBizSaving(false);
    }
  }

  function openReport() {
    setReportMessage("");
    setReportError("");
    setReportSent(false);
    setReportOpen(true);
  }

  async function submitReport(event) {
    event.preventDefault();
    if (!reportMessage.trim()) return;
    setReportSending(true);
    setReportError("");
    try {
      await apiSend("/api/support/report", {
        message: reportMessage.trim(),
        accountType,
        page: typeof window !== "undefined" ? window.location.pathname : ""
      });
      setReportSent(true);
      setReportMessage("");
      window.setTimeout(() => setReportOpen(false), 1800);
    } catch (error) {
      setReportError(error.message || L.settings.reportError);
    } finally {
      setReportSending(false);
    }
  }

  const themeToggle = (
    <div className="settings-theme-toggle">
      <button type="button" className={theme === "light" ? "active" : ""} onClick={() => applyTheme("light")}>{L.settings.light}</button>
      <button type="button" className={theme === "dark" ? "active" : ""} onClick={() => applyTheme("dark")}>{L.settings.dark}</button>
    </div>
  );

  const planLabel = PLAN_LIMITS[plan]?.label || L.settings.trialPlan;

  const subscriptionDetails = isEntreprise && subscriptionOpen ? (
    <div className="settings-subscription-body">
      <div className="settings-plan-row">
        <span>{L.settings.currentPlan}</span>
        <strong>{planLabel}</strong>
        <Link href="/abonnement" className="settings-change-plan">{L.settings.changePlan}</Link>
      </div>

      <div className="profile-grid">
        <label className="profile-field">
          <span>{L.parametres.iban}</span>
          <div className="profile-input">
            <input value={businessPayment.iban} onChange={(event) => setBizField("iban", event.target.value)} placeholder="FR76 3000 6000 0112 3456 7890 189" />
          </div>
        </label>
        <label className="profile-field">
          <span>{L.parametres.bic}</span>
          <div className="profile-input">
            <input value={businessPayment.bic} onChange={(event) => setBizField("bic", event.target.value)} placeholder="BNPAFRPP" />
          </div>
        </label>
        <label className="profile-field">
          <span>{L.parametres.bankHolder}</span>
          <div className="profile-input">
            <input value={businessPayment.bankHolder} onChange={(event) => setBizField("bankHolder", event.target.value)} placeholder={L.parametres.bankHolder} />
          </div>
        </label>
      </div>

      <label className="profile-field wide">
        <span>{L.parametres.paymentTermsLabel}</span>
        <textarea
          className="profile-textarea"
          rows={3}
          value={businessPayment.paymentTerms}
          onChange={(event) => setBizField("paymentTerms", event.target.value)}
          placeholder={L.parametres.paymentTermsLabel}
        />
      </label>

      {bizMessage ? <p className="profile-message">{bizMessage}</p> : null}
      <button type="button" className="button blue" onClick={saveBusinessPayment} disabled={bizSaving}>
        {bizSaving ? L.parametres.saving : L.parametres.save}
      </button>
    </div>
  ) : null;

  const reportModal = reportOpen ? (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setReportOpen(false)}>
      <div className="mini-modal" onClick={(event) => event.stopPropagation()}>
        <h2>{L.settings.reportProblem}</h2>
        <form onSubmit={submitReport} className="settings-report-form">
          <textarea
            rows={4}
            className="profile-textarea"
            value={reportMessage}
            onChange={(event) => setReportMessage(event.target.value)}
            placeholder={L.settings.reportPlaceholder}
            autoFocus
          />
          {reportError ? <p className="profile-message error">{reportError}</p> : null}
          {reportSent ? <p className="profile-message">{L.settings.reportSent}</p> : null}
          <div>
            <button type="button" onClick={() => setReportOpen(false)}>{L.common.cancel}</button>
            <button type="submit" disabled={reportSending || !reportMessage.trim()}>{L.common.send}</button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  if (variant === "cards") {
    return (
      <>
        <section className="profile-block">
          <h2>{L.settings.subscription}</h2>
          <p className="muted">{L.settings.subscriptionSub}</p>
          {isEntreprise ? (
            <button type="button" className="button secondary profile-link-button" onClick={() => setSubscriptionOpen((v) => !v)}>
              {subscriptionOpen ? L.settings.hide : L.settings.manage}
            </button>
          ) : (
            <Link href="/abonnement" className="button secondary profile-link-button">{L.settings.manage}</Link>
          )}
          {subscriptionDetails}
        </section>

        <section className="profile-block">
          <h2>{L.settings.language}</h2>
          <LangSwitcher />
        </section>

        <section className="profile-block">
          <h2>{L.settings.appearance}</h2>
          <p className="muted">{L.settings.appearanceSub}</p>
          {themeToggle}
        </section>

        <section className="profile-block">
          <h2>{L.settings.security}</h2>
          <div className="profile-card-actions">
            <button type="button" className="button secondary profile-link-button" onClick={openReport}>{L.settings.reportProblem}</button>
            <Link href="/aide" className="button secondary profile-link-button">{L.settings.help}</Link>
            <Link href="/legal" className="button secondary profile-link-button">{L.settings.legal}</Link>
          </div>
        </section>

        {reportModal}
      </>
    );
  }

  return (
    <section className="settings-panel">
      <p className="settings-panel-title">{L.settings.title}</p>

      <div className="settings-row">
        <div className="settings-row-text">
          <strong>{L.settings.subscription}</strong>
          <span>{L.settings.subscriptionSub}</span>
        </div>
        {isEntreprise ? (
          <button type="button" className="button secondary" onClick={() => setSubscriptionOpen((v) => !v)}>
            {subscriptionOpen ? L.settings.hide : L.settings.manage}
          </button>
        ) : (
          <Link className="button secondary" href="/abonnement">{L.settings.manage}</Link>
        )}
      </div>
      {subscriptionDetails}

      <div className="settings-row">
        <div className="settings-row-text">
          <strong>{L.settings.language}</strong>
        </div>
        <LangSwitcher />
      </div>

      <div className="settings-row">
        <div className="settings-row-text">
          <strong>{L.settings.appearance}</strong>
          <span>{L.settings.appearanceSub}</span>
        </div>
        {themeToggle}
      </div>

      <p className="settings-panel-title">{L.settings.security}</p>

      <button type="button" className="settings-row settings-row-link" onClick={openReport}>
        <strong>{L.settings.reportProblem}</strong>
        <span className="settings-row-chevron">›</span>
      </button>
      <Link className="settings-row settings-row-link" href="/aide">
        <strong>{L.settings.help}</strong>
        <span className="settings-row-chevron">›</span>
      </Link>
      <Link className="settings-row settings-row-link" href="/legal">
        <strong>{L.settings.legal}</strong>
        <span className="settings-row-chevron">›</span>
      </Link>

      {reportModal}
    </section>
  );
}
