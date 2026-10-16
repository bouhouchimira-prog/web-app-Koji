"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { AuthBrandPanel } from "../../components/AuthBrandPanel";
import { apiSend } from "../../lib/client-api";
import { useLocale } from "../../lib/i18n";

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

function MailIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#0a1538" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

// Inscription "Koji" (particulier) reservee au panneau Koji de /login
// (inscription inline sur place) — cette page ne gere plus que l'entreprise
// ("Koji Pro"), donc plus besoin de selecteur de type ici.
function SignupScreen() {
  const { L } = useLocale();
  const accountType = "entreprise";

  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [devUrl, setDevUrl] = useState("");

  function passwordStrength(pwd) {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  }

  const strength = passwordStrength(password);
  const strengthLabels = L.auth.strength;
  const strengthLabel = strengthLabels[strength] || "";
  const strengthColor = ["", "#e53e3e", "#dd6b20", "#d69e2e", "#38a169", "#2b6cb0"][strength] || "";

  async function handleEmailStep(event) {
    event.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError(L.auth.errEmail);
      return;
    }
    setError("");
    setStep("details");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!name.trim()) { setError(L.auth.errName); return; }
    if (password.length < 8) { setError(L.auth.errPasswordLen); return; }
    if (password !== confirmPassword) { setError(L.auth.errPasswordMatch); return; }
    setLoading(true);
    setError("");
    try {
      const data = await apiSend("/api/auth/signup", {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        accountType
      });
      if (data.directActivationUrl) setDevUrl(data.directActivationUrl);
      // La confirmation par e-mail de Supabase Auth est desactivee sur ce
      // projet (voir app/api/auth/signup/route.js) — le compte est deja
      // actif, inutile d'afficher un ecran "verifiez vos mails" qui ne
      // correspond a rien de reel (aucun e-mail n'est envoye dans ce cas).
      setStep(data.activationRequired ? "confirm" : "ready");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (step === "ready") {
    return (
      <main className="auth-screen-v2">
        <AuthBrandPanel />
        <section className="auth-panel-v2">
          <div className="auth-confirm-card">
            <div className="auth-confirm-icon"><MailIcon /></div>
            <h2>Compte créé</h2>
            <p className="auth-confirm-sub">Votre compte est prêt, vous pouvez vous connecter dès maintenant.</p>
            <Link className="auth-btn-primary" style={{ display: "block", textAlign: "center", textDecoration: "none" }} href="/login?type=entreprise">
              {L.auth.signIn}
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (step === "confirm") {
    return (
      <main className="auth-screen-v2">
        <AuthBrandPanel />
        <section className="auth-panel-v2">
          <div className="auth-confirm-card">
            <div className="auth-confirm-icon"><MailIcon /></div>
            <h2>{L.auth.checkEmail}</h2>
            <p className="auth-confirm-sub">{L.auth.confirmSub(email)}</p>
            {devUrl ? (
              <div style={{ background: "#eef6ff", border: "1px solid #b3d4ff", borderRadius: 10, padding: "14px 16px", margin: "12px 0" }}>
                <p style={{ margin: "0 0 10px", fontSize: "0.88rem", color: "#0a1538" }}>{L.auth.emailNotSent}</p>
                <a href={devUrl} className="auth-btn-primary" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
                  {L.auth.activateBtn}
                </a>
              </div>
            ) : null}
            <p className="auth-confirm-hint">
              {L.auth.noEmailReceived}{" "}
              <button type="button" className="auth-text-btn" onClick={() => setStep("email")}>
                {L.auth.retry}
              </button>
            </p>
            <Link className="auth-link" href="/login?type=entreprise">{L.auth.goToLogin}</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-screen-v2">
      <AuthBrandPanel />
      <section className="auth-panel-v2">
        <div className="auth-card">

          <p className="auth-pro-card-title" style={{ marginBottom: 12 }}>{L.auth.tabCompany}</p>

          <h2 className="auth-title">{L.auth.createAccount}</h2>
          <p className="auth-subtitle">
            {step === "email" ? L.auth.subtitleSignup1 : L.auth.subtitleSignup2}
          </p>

          {step === "email" && (
            <form className="auth-form-v2" onSubmit={handleEmailStep}>
              <div className="auth-field">
                <label>{L.auth.email}</label>
                <input
                  type="email"
                  className="auth-input-v2"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  placeholder={L.auth.emailPlaceholder}
                  autoFocus
                  autoComplete="email"
                />
              </div>
              {error ? <p className="auth-error">{error}</p> : null}
              <button type="submit" className="auth-btn-primary">{L.auth.continueBtn}</button>
              <p className="auth-alt-link">
                {L.auth.alreadyAccount}{" "}
                <Link className="auth-link" href="/login?type=entreprise">{L.auth.signIn}</Link>
              </p>
            </form>
          )}

          {step === "details" && (
            <form className="auth-form-v2" onSubmit={handleSubmit}>
              <div className="auth-email-badge">
                <span>{email}</span>
                <button type="button" className="auth-text-btn" onClick={() => { setStep("email"); setError(""); }}>
                  {L.auth.modify}
                </button>
              </div>

              <div className="auth-field">
                <label>{L.auth.fullName}</label>
                <input
                  className="auth-input-v2"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(""); }}
                  placeholder={L.auth.namePlaceholder}
                  autoFocus
                  autoComplete="name"
                />
              </div>

              <div className="auth-field">
                <label>{L.auth.password}</label>
                <div className="auth-input-wrap">
                  <input
                    className="auth-input-v2"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    placeholder={L.auth.passwordMin}
                    autoComplete="new-password"
                  />
                  <button type="button" className="auth-eye-btn" onClick={() => setShowPassword((v) => !v)} aria-label={L.auth.showHide}>
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
                {password ? (
                  <div className="auth-strength">
                    <div className="auth-strength-bar">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="auth-strength-seg" style={{ background: i <= strength ? strengthColor : "#e2e8f0" }} />
                      ))}
                    </div>
                    <span style={{ color: strengthColor }}>{strengthLabel}</span>
                  </div>
                ) : null}
              </div>

              <div className="auth-field">
                <label>{L.auth.confirmPassword}</label>
                <div className="auth-input-wrap">
                  <input
                    className="auth-input-v2"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                    placeholder={L.auth.repeatPassword}
                    autoComplete="new-password"
                  />
                  <button type="button" className="auth-eye-btn" onClick={() => setShowConfirmPassword((v) => !v)} aria-label={L.auth.showHide}>
                    <EyeIcon open={showConfirmPassword} />
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword ? (
                  <p className="auth-field-hint" style={{ color: "#e53e3e", marginTop: 4, fontSize: "0.82rem" }}>
                    {L.auth.passwordMismatch}
                  </p>
                ) : null}
                {confirmPassword && password === confirmPassword ? (
                  <p className="auth-field-hint" style={{ color: "#38a169", marginTop: 4, fontSize: "0.82rem" }}>
                    {L.auth.passwordMatch}
                  </p>
                ) : null}
              </div>

              {error ? <p className="auth-error">{error}</p> : null}

              <button type="submit" className="auth-btn-primary" disabled={loading}>
                {loading ? L.auth.creating : L.auth.createBtn}
              </button>

              <p className="auth-alt-link">
                {L.auth.alreadyAccount}{" "}
                <Link className="auth-link" href="/login?type=entreprise">{L.auth.signIn}</Link>
              </p>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupScreen />
    </Suspense>
  );
}
