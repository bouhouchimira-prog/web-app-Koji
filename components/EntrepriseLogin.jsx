   "use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiSend } from "../lib/client-api";

const KNOWN_EMAILS_KEY = "koji-known-emails";

function readKnownEmails() {
  try {
    const raw = window.localStorage.getItem(KNOWN_EMAILS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function saveKnownEmail(nextEmail) {
  const email = String(nextEmail || "").trim().toLowerCase();
  if (!email) return;
  const known = readKnownEmails();
  if (known.includes(email)) return;
  window.localStorage.setItem(KNOWN_EMAILS_KEY, JSON.stringify([email, ...known].slice(0, 12)));
}

function EyeIcon({ open }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

// Extrait de app/login/page.jsx pour etre reutilisable independamment —
// utilise par la carte "Koji Pro" repliable sur /login (KojiProCard).
export function EntrepriseLogin({ L }) {
  const router = useRouter();
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [knownEmails, setKnownEmails] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendStatus, setResendStatus] = useState("idle"); // idle | sending | sent

  useEffect(() => {
    setKnownEmails(readKnownEmails());
  }, []);

  const needsActivation = /non activ/i.test(error);

  async function resendActivation() {
    setResendStatus("sending");
    try {
      await apiSend("/api/auth/resend-activation", { email: email.trim().toLowerCase() });
    } finally {
      setResendStatus("sent");
    }
  }

  function handleEmailStep(event) {
    event.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError(L.auth.errEmail);
      return;
    }
    setError("");
    setStep("password");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!password) { setError(L.auth.errPassword); return; }
    setLoading(true);
    setError("");
    try {
      const data = await apiSend("/api/auth/login", {
        email: email.trim().toLowerCase(),
        password,
        accountType: "entreprise"
      });
      saveKnownEmail(data.user?.email || email);
      window.localStorage.setItem("koji-user", JSON.stringify(data.user));
      router.push("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h2 className="auth-title">{L.auth.tabCompany}</h2>
      <p className="auth-subtitle-strong">{L.auth.loginCompany}</p>
      <p className="auth-subtitle">
        {step === "email" ? L.auth.subtitleEmail : L.auth.subtitlePassword}
      </p>

      {step === "email" && (
        <form className="auth-form-v2" onSubmit={handleEmailStep}>
          {knownEmails.length > 0 ? (
            <div className="auth-known-list">
              <p className="auth-known-label">{L.auth.recentAccounts}</p>
              {knownEmails.map((k) => (
                <button
                  key={k}
                  type="button"
                  className="auth-known-item"
                  onClick={() => { setEmail(k); setStep("password"); }}
                >
                  <span className="auth-known-avatar">{k[0].toUpperCase()}</span>
                  <span className="auth-known-email">{k}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
                </button>
              ))}
              <div className="auth-known-divider">{L.auth.orUseAnother}</div>
            </div>
          ) : null}
          <div className="auth-field">
            <label>{L.auth.email}</label>
            <input
              type="email"
              className="auth-input-v2"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              placeholder={L.auth.emailPlaceholder}
              autoFocus={!knownEmails.length}
              autoComplete="email"
            />
          </div>
          {error ? <p className="auth-error">{error}</p> : null}
          <button type="submit" className="auth-btn-primary">{L.auth.continueBtn}</button>
          <p className="auth-alt-link">
            {L.auth.noAccount}{" "}
            <Link className="auth-link" href="/signup?type=entreprise">{L.auth.register}</Link>
          </p>
        </form>
      )}

      {step === "password" && (
        <form className="auth-form-v2" onSubmit={handleSubmit}>
          <div className="auth-email-badge">
            <span>{email}</span>
            <button type="button" className="auth-text-btn" onClick={() => { setStep("email"); setPassword(""); setError(""); }}>
              {L.auth.modify}
            </button>
          </div>
          <div className="auth-field">
            <div className="auth-field-label-row">
              <label>{L.auth.password}</label>
              <Link className="auth-link" href="/forgot-password?type=entreprise" style={{ fontSize: "0.82rem" }}>
                {L.auth.forgotPassword}
              </Link>
            </div>
            <div className="auth-input-wrap">
              <input
                className="auth-input-v2"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                placeholder={L.auth.passwordPlaceholder}
                autoFocus
                autoComplete="current-password"
              />
              <button type="button" className="auth-eye-btn" onClick={() => setShowPassword((v) => !v)} aria-label={L.auth.showHide}>
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>
          {error ? <p className="auth-error">{error}</p> : null}
          {needsActivation ? (
            resendStatus === "sent" ? (
              <p className="auth-subtitle" style={{ fontSize: "0.82rem" }}>Email renvoyé, si besoin vérifiez vos spams.</p>
            ) : (
              <button type="button" className="auth-text-btn" onClick={resendActivation} disabled={resendStatus === "sending"}>
                {resendStatus === "sending" ? "Envoi…" : "Renvoyer l'email d'activation"}
              </button>
            )
          ) : null}
          <button type="submit" className="auth-btn-primary" disabled={loading}>
            {loading ? L.auth.loggingIn : L.auth.loginBtn}
          </button>
          <p className="auth-alt-link">
            {L.auth.noAccount}{" "}
            <Link className="auth-link" href="/signup?type=entreprise">{L.auth.register}</Link>
          </p>
        </form>
      )}
    </>
  );
}
