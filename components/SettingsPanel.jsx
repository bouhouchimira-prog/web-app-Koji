"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "../lib/i18n";
import { apiSend } from "../lib/client-api";

function getStoredTheme() {
  if (typeof window === "undefined") return "light";
  return localStorage.getItem("koji-theme") === "dark" ? "dark" : "light";
}

const LANGUAGES = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
  { code: "ar", label: "العربية" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
];

// Shared across the entreprise (/parametres), particulier (/client/profil)
// and ouvrier (app/worker/page.jsx) profiles. Two variants:
// - "cards": one .profile-block section per item, matching the entreprise
//   page's existing Signatures/Carte de visite/Tarification cards exactly,
//   so the new items don't introduce a second visual language on that page.
// - "compact" (default): the .settings-row list style, used where there's
//   no .profile-block precedent to match (client/worker profiles).
export function SettingsPanel({ accountType, variant = "compact" }) {
  const { L, lang, setLang } = useLocale();
  const [theme, setTheme] = useState("light");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const [reportSent, setReportSent] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportSending, setReportSending] = useState(false);

  // Entreprise gets its own dedicated page (bank details + plan) since a
  // real payment method requires more than an inline expandable card;
  // particulier/ouvrier have no bank/payment info at all, so "Gérer" just
  // goes straight to the plan picker.
  const subscriptionHref = accountType === "entreprise" ? "/parametres/abonnement" : "/abonnement";

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  function applyTheme(next) {
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("koji-theme", next);
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

  const languagePicker = (
    <div className="settings-lang-grid">
      {LANGUAGES.map((item) => (
        <button
          type="button"
          key={item.code}
          className={`settings-lang-pill ${lang === item.code ? "active" : ""}`}
          onClick={() => setLang(item.code)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );

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
          <Link href={subscriptionHref} className="button secondary profile-link-button">{L.settings.manage}</Link>
        </section>

        <section className="profile-block">
          <h2>{L.settings.language}</h2>
          <p className="muted">{L.settings.languageSub}</p>
          {languagePicker}
        </section>

        <section className="profile-block">
          <h2>{L.settings.appearance}</h2>
          <p className="muted">{L.settings.appearanceSub}</p>
          {themeToggle}
        </section>

        <section className="profile-block">
          <h2>{L.settings.security}</h2>
          <div className="profile-card-actions profile-card-actions-column">
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
        <Link className="button secondary" href={subscriptionHref}>{L.settings.manage}</Link>
      </div>

      <div className="settings-row settings-row-column">
        <div className="settings-row-text">
          <strong>{L.settings.language}</strong>
          <span>{L.settings.languageSub}</span>
        </div>
        {languagePicker}
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
