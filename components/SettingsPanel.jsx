"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "../lib/i18n";
import { apiGet, apiSend } from "../lib/client-api";

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

  // Export des donnees (RGPD art. 20) et demande de suppression de compte
  // (RGPD art. 17, 30 septembre) — memes composants partages entre les 3
  // profils que le signalement technique ci-dessus.
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteSent, setDeleteSent] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteSending, setDeleteSending] = useState(false);

  // Entreprise gets its own dedicated page (bank details + plan) since a
  // real payment method requires more than an inline expandable card;
  // ouvrier has no bank/payment info at all, so "Gérer" just goes straight to
  // the plan picker. Koji (particulier) has no subscription at all — Radar
  // des Chantiers is entirely free, no plan to manage — so that row is
  // hidden rather than pointed at the (irrelevant) entreprise plan picker.
  const subscriptionHref = accountType === "entreprise" ? "/parametres/abonnement" : "/abonnement";
  const showSubscription = accountType !== "particulier";
  // Chaque profil a sa propre page Aide (16 oct) — avant ça, le lien
  // pointait toujours vers /aide (contenu entreprise), y compris depuis le
  // profil particulier.
  const helpHref = accountType === "particulier" ? "/client/aide" : "/aide";

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

  async function exportData() {
    setExporting(true);
    setExportError("");
    try {
      const data = await apiGet("/api/account/export");
      const blob = new Blob([JSON.stringify(data.export, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `koji-donnees-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(error.message || L.settings.exportDataError);
    } finally {
      setExporting(false);
    }
  }

  function openDelete() {
    setDeleteReason("");
    setDeleteError("");
    setDeleteSent(false);
    setDeleteOpen(true);
  }

  async function submitDelete(event) {
    event.preventDefault();
    setDeleteSending(true);
    setDeleteError("");
    try {
      await apiSend("/api/account/deletion-request", { reason: deleteReason.trim(), accountType });
      setDeleteSent(true);
      setDeleteReason("");
      window.setTimeout(() => setDeleteOpen(false), 1800);
    } catch (error) {
      setDeleteError(error.message || L.settings.deleteAccountError);
    } finally {
      setDeleteSending(false);
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

  const deleteModal = deleteOpen ? (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setDeleteOpen(false)}>
      <div className="mini-modal" onClick={(event) => event.stopPropagation()}>
        <h2>{L.settings.deleteAccount}</h2>
        <p className="muted">{L.settings.deleteAccountIntro}</p>
        <form onSubmit={submitDelete} className="settings-report-form">
          <textarea
            rows={3}
            className="profile-textarea"
            value={deleteReason}
            onChange={(event) => setDeleteReason(event.target.value)}
            placeholder={L.settings.deleteAccountPlaceholder}
            autoFocus
          />
          {deleteError ? <p className="profile-message error">{deleteError}</p> : null}
          {deleteSent ? <p className="profile-message">{L.settings.deleteAccountSent}</p> : null}
          <div>
            <button type="button" onClick={() => setDeleteOpen(false)}>{L.common.cancel}</button>
            <button type="submit" disabled={deleteSending}>{L.common.send}</button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  // DA Koji Pro (31 oct) : cartes .card, fenêtres .pmodal. L'abonnement a
  // sa propre entrée dans la navigation du compte (components/ProAccountNav).
  if (variant === "pro") {
    const proModal = (open, close, title, intro, onSubmit, value, setValue, placeholder, error, sent, sentText, sending, rows) => (open ? (
      <div className="pmodal-bg" onClick={close}>
        <form className="pmodal" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()} onSubmit={onSubmit}>
          <div className="card-h">
            <h2>{title}</h2>
            <button type="button" className="link" onClick={close}>Fermer</button>
          </div>
          {intro ? <p className="muted">{intro}</p> : null}
          <div className="fgrid">
            <label className="full">Message
              <textarea rows={rows} value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} autoFocus />
            </label>
          </div>
          {error ? <p className="notice notice-err" role="alert">{error}</p> : null}
          {sent ? <p className="notice" role="status">{sentText}</p> : null}
          <div className="pm-act">
            <button type="button" className="btn btn-sec" onClick={close}>{L.common.cancel}</button>
            <button type="submit" className="btn btn-main" disabled={sending}>{L.common.send}</button>
          </div>
        </form>
      </div>
    ) : null);

    return (
      <>
        <section className="card">
          <div className="card-h"><h2>{L.settings.language}</h2></div>
          <p className="muted">{L.settings.languageSub}</p>
          <div className="pf-chips" role="group" aria-label={L.settings.language}>
            {LANGUAGES.map((item) => (
              <button type="button" key={item.code} className={`pf-chip${lang === item.code ? " on" : ""}`} aria-pressed={lang === item.code} onClick={() => setLang(item.code)}>
                {item.label}
              </button>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card-h"><h2>{L.settings.appearance}</h2></div>
          <p className="muted">{L.settings.appearanceSub}</p>
          <div>
            <div className="kp-seg" role="group" aria-label={L.settings.appearance}>
              <button type="button" className={theme === "light" ? "on" : ""} aria-pressed={theme === "light"} onClick={() => applyTheme("light")}>{L.settings.light}</button>
              <button type="button" className={theme === "dark" ? "on" : ""} aria-pressed={theme === "dark"} onClick={() => applyTheme("dark")}>{L.settings.dark}</button>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-h"><h2>Assistance</h2></div>
          <button type="button" className="row pf-go st-row" onClick={openReport}>
            <div className="t"><strong>{L.settings.reportProblem}</strong><small>Décrivez ce qui ne marche pas, l'équipe Koji vous répond.</small></div>
            <span aria-hidden="true">›</span>
          </button>
          <Link href={helpHref} className="row pf-go st-row">
            <div className="t"><strong>{L.settings.help}</strong><small>Questions fréquentes et contact.</small></div>
            <span aria-hidden="true">›</span>
          </Link>
          <Link href="/legal" className="row pf-go st-row">
            <div className="t"><strong>{L.settings.legal}</strong><small>Conditions, confidentialité, mentions.</small></div>
            <span aria-hidden="true">›</span>
          </Link>
        </section>

        <section className="card">
          <div className="card-h"><h2>Vos données</h2></div>
          <button type="button" className="row pf-go st-row" onClick={exportData} disabled={exporting}>
            <div className="t"><strong>{L.settings.exportData}</strong><small>Un fichier avec toutes les données de votre compte.</small></div>
            <span aria-hidden="true">{exporting ? "…" : "›"}</span>
          </button>
          {exportError ? <p className="notice notice-err" role="alert">{exportError}</p> : null}
          <button type="button" className="row pf-go st-row" onClick={openDelete}>
            <div className="t"><strong>{L.settings.deleteAccount}</strong><small>{L.settings.deleteAccountIntro}</small></div>
            <span aria-hidden="true">›</span>
          </button>
        </section>

        {proModal(reportOpen, () => setReportOpen(false), L.settings.reportProblem, "", submitReport, reportMessage, setReportMessage, L.settings.reportPlaceholder, reportError, reportSent, L.settings.reportSent, reportSending || !reportMessage.trim(), 4)}
        {proModal(deleteOpen, () => setDeleteOpen(false), L.settings.deleteAccount, L.settings.deleteAccountIntro, submitDelete, deleteReason, setDeleteReason, L.settings.deleteAccountPlaceholder, deleteError, deleteSent, L.settings.deleteAccountSent, deleteSending, 3)}
      </>
    );
  }

  if (variant === "cards") {
    return (
      <>
        {showSubscription ? (
          <section className="profile-block">
            <h2>{L.settings.subscription}</h2>
            <p className="muted">{L.settings.subscriptionSub}</p>
            <Link href={subscriptionHref} className="button secondary profile-link-button">{L.settings.manage}</Link>
          </section>
        ) : null}

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
            <Link href={helpHref} className="button secondary profile-link-button">{L.settings.help}</Link>
            <Link href="/legal" className="button secondary profile-link-button">{L.settings.legal}</Link>
            <button type="button" className="button secondary profile-link-button" onClick={exportData} disabled={exporting}>{L.settings.exportData}</button>
            <button type="button" className="button secondary profile-link-button" onClick={openDelete}>{L.settings.deleteAccount}</button>
          </div>
          {exportError ? <p className="profile-message error">{exportError}</p> : null}
        </section>

        {reportModal}
        {deleteModal}
      </>
    );
  }

  return (
    <section className="settings-panel">
      <p className="settings-panel-title">{L.settings.title}</p>

      {showSubscription ? (
        <div className="settings-row">
          <div className="settings-row-text">
            <strong>{L.settings.subscription}</strong>
            <span>{L.settings.subscriptionSub}</span>
          </div>
          <Link className="button secondary" href={subscriptionHref}>{L.settings.manage}</Link>
        </div>
      ) : null}

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
      <Link className="settings-row settings-row-link" href={helpHref}>
        <strong>{L.settings.help}</strong>
        <span className="settings-row-chevron">›</span>
      </Link>
      <Link className="settings-row settings-row-link" href="/legal">
        <strong>{L.settings.legal}</strong>
        <span className="settings-row-chevron">›</span>
      </Link>
      <button type="button" className="settings-row settings-row-link" onClick={exportData} disabled={exporting}>
        <strong>{L.settings.exportData}</strong>
        <span className="settings-row-chevron">›</span>
      </button>
      {exportError ? <p className="profile-message error">{exportError}</p> : null}
      <button type="button" className="settings-row settings-row-link" onClick={openDelete}>
        <strong>{L.settings.deleteAccount}</strong>
        <span className="settings-row-chevron">›</span>
      </button>

      {reportModal}
      {deleteModal}
    </section>
  );
}
