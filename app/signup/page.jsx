"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthBrandPanel } from "../../components/AuthBrandPanel";
import { apiSend } from "../../lib/client-api";

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

function SignupScreen() {
  const params = useSearchParams();
  const typeParam = params.get("type");
  const [accountType, setAccountType] = useState(typeParam === "particulier" ? "particulier" : "entreprise");

  // step: "email" | "details" | "confirm"
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
  const strengthLabel = ["", "Très faible", "Faible", "Moyen", "Bon", "Excellent"][strength] || "";
  const strengthColor = ["", "#e53e3e", "#dd6b20", "#d69e2e", "#38a169", "#2b6cb0"][strength] || "";

  async function handleEmailStep(event) {
    event.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Entrez une adresse email valide.");
      return;
    }
    setError("");
    setStep("details");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!name.trim()) { setError("Entrez votre nom complet."); return; }
    if (password.length < 8) { setError("Le mot de passe doit contenir au moins 8 caractères."); return; }
    if (password !== confirmPassword) { setError("Les mots de passe ne correspondent pas."); return; }
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
      setStep("confirm");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (step === "confirm") {
    return (
      <main className="auth-screen-v2">
        <AuthBrandPanel />
        <section className="auth-panel-v2">
          <div className="auth-confirm-card">
            <div className="auth-confirm-icon"><MailIcon /></div>
            <h2>Vérifiez votre boîte mail</h2>
            <p className="auth-confirm-sub">
              Un email d&apos;activation a été envoyé à <strong>{email}</strong>.<br />
              Cliquez sur le lien dans l&apos;email pour activer votre compte.
            </p>
            {devUrl ? (
              <div style={{ background: "#eef6ff", border: "1px solid #b3d4ff", borderRadius: 10, padding: "14px 16px", margin: "12px 0" }}>
                <p style={{ margin: "0 0 10px", fontSize: "0.88rem", color: "#0a1538" }}>
                  L&apos;e-mail n&apos;a pas pu être envoyé. Cliquez ici pour activer votre compte :
                </p>
                <a href={devUrl} className="auth-btn-primary" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
                  Activer mon compte
                </a>
              </div>
            ) : null}
            <p className="auth-confirm-hint">
              Vous n&apos;avez pas reçu d&apos;email ?{" "}
              <button type="button" className="auth-text-btn" onClick={() => setStep("email")}>
                Recommencer
              </button>
            </p>
            <Link className="auth-link" href="/login">Aller à la connexion</Link>
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

          {/* Account type toggle */}
          <div className="auth-type-toggle">
            <button
              type="button"
              className={accountType === "entreprise" ? "active" : ""}
              onClick={() => setAccountType("entreprise")}
            >
              Entreprise
            </button>
            <button
              type="button"
              className={accountType === "particulier" ? "active" : ""}
              onClick={() => setAccountType("particulier")}
            >
              Particulier
            </button>
          </div>

          <h2 className="auth-title">Créer un compte</h2>
          <p className="auth-subtitle">
            {step === "email"
              ? "Entrez votre adresse email pour commencer."
              : "Complétez vos informations pour finaliser l'inscription."}
          </p>

          {/* Step 1: email */}
          {step === "email" && (
            <form className="auth-form-v2" onSubmit={handleEmailStep}>
              <div className="auth-field">
                <label>Adresse email</label>
                <input
                  type="email"
                  className="auth-input-v2"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  placeholder="vous@exemple.fr"
                  autoFocus
                  autoComplete="email"
                />
              </div>
              {error ? <p className="auth-error">{error}</p> : null}
              <button type="submit" className="auth-btn-primary">Continuer</button>
              <p className="auth-alt-link">
                Déjà un compte ?{" "}
                <Link className="auth-link" href={`/login?type=${accountType}`}>Se connecter</Link>
              </p>
            </form>
          )}

          {/* Step 2: name + password */}
          {step === "details" && (
            <form className="auth-form-v2" onSubmit={handleSubmit}>
              <div className="auth-email-badge">
                <span>{email}</span>
                <button type="button" className="auth-text-btn" onClick={() => { setStep("email"); setError(""); }}>
                  Modifier
                </button>
              </div>

              <div className="auth-field">
                <label>Nom complet</label>
                <input
                  className="auth-input-v2"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(""); }}
                  placeholder="Prénom et nom"
                  autoFocus
                  autoComplete="name"
                />
              </div>

              <div className="auth-field">
                <label>Mot de passe</label>
                <div className="auth-input-wrap">
                  <input
                    className="auth-input-v2"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    placeholder="8 caractères minimum"
                    autoComplete="new-password"
                  />
                  <button type="button" className="auth-eye-btn" onClick={() => setShowPassword((v) => !v)} aria-label="Afficher/masquer">
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
                <label>Confirmer le mot de passe</label>
                <div className="auth-input-wrap">
                  <input
                    className="auth-input-v2"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                    placeholder="Répétez le mot de passe"
                    autoComplete="new-password"
                  />
                  <button type="button" className="auth-eye-btn" onClick={() => setShowConfirmPassword((v) => !v)} aria-label="Afficher/masquer">
                    <EyeIcon open={showConfirmPassword} />
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword ? (
                  <p className="auth-field-hint" style={{ color: "#e53e3e", marginTop: 4, fontSize: "0.82rem" }}>
                    Les mots de passe ne correspondent pas.
                  </p>
                ) : null}
                {confirmPassword && password === confirmPassword ? (
                  <p className="auth-field-hint" style={{ color: "#38a169", marginTop: 4, fontSize: "0.82rem" }}>
                    Les mots de passe correspondent.
                  </p>
                ) : null}
              </div>

              {error ? <p className="auth-error">{error}</p> : null}

              <button type="submit" className="auth-btn-primary" disabled={loading}>
                {loading ? "Création en cours..." : "Créer mon compte"}
              </button>

              <p className="auth-alt-link">
                Déjà un compte ?{" "}
                <Link className="auth-link" href={`/login?type=${accountType}`}>Se connecter</Link>
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
