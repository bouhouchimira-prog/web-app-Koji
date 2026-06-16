"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AuthBrandPanel } from "../../components/AuthBrandPanel";
import { apiSend } from "../../lib/client-api";

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

function LoginScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const typeParam = params.get("type");
  const prefillEmail = params.get("email") || "";

  const [accountType, setAccountType] = useState(typeParam === "particulier" ? "particulier" : "entreprise");
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [knownEmails, setKnownEmails] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const known = readKnownEmails();
    setKnownEmails(known);
  }, []);

  function handleEmailStep(event) {
    event.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Entrez une adresse email valide.");
      return;
    }
    setError("");
    setStep("password");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!password) { setError("Entrez votre mot de passe."); return; }
    setLoading(true);
    setError("");
    try {
      const data = await apiSend("/api/auth/login", {
        email: email.trim().toLowerCase(),
        password,
        accountType
      });
      saveKnownEmail(data.user?.email || email);
      window.localStorage.setItem("koji-user", JSON.stringify(data.user));
      router.push(data.user?.accountType === "particulier" ? "/client" : "/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-screen-v2">
      <AuthBrandPanel />
      <section className="auth-panel-v2">
        <div className="auth-card">

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

          <h2 className="auth-title">Connexion</h2>
          <p className="auth-subtitle">
            {step === "email" ? "Entrez votre adresse email." : "Entrez votre mot de passe."}
          </p>

          {/* Step 1 — email (with known-emails shortcuts) */}
          {step === "email" && (
            <form className="auth-form-v2" onSubmit={handleEmailStep}>
              {knownEmails.length > 0 ? (
                <div className="auth-known-list">
                  <p className="auth-known-label">Comptes récents</p>
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
                  <div className="auth-known-divider">ou utilisez un autre compte</div>
                </div>
              ) : null}

              <div className="auth-field">
                <label>Adresse email</label>
                <input
                  type="email"
                  className="auth-input-v2"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  placeholder="vous@exemple.fr"
                  autoFocus={!knownEmails.length}
                  autoComplete="email"
                />
              </div>
              {error ? <p className="auth-error">{error}</p> : null}
              <button type="submit" className="auth-btn-primary">Continuer</button>
              <p className="auth-alt-link">
                Pas encore de compte ?{" "}
                <Link className="auth-link" href={`/signup?type=${accountType}`}>S&apos;inscrire</Link>
              </p>
            </form>
          )}

          {/* Step 2 — password */}
          {step === "password" && (
            <form className="auth-form-v2" onSubmit={handleSubmit}>
              <div className="auth-email-badge">
                <span>{email}</span>
                <button type="button" className="auth-text-btn" onClick={() => { setStep("email"); setPassword(""); setError(""); }}>
                  Modifier
                </button>
              </div>

              <div className="auth-field">
                <div className="auth-field-label-row">
                  <label>Mot de passe</label>
                  <Link className="auth-link" href={`/forgot-password?type=${accountType}`} style={{ fontSize: "0.82rem" }}>
                    Mot de passe oublié ?
                  </Link>
                </div>
                <div className="auth-input-wrap">
                  <input
                    className="auth-input-v2"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    placeholder="Votre mot de passe"
                    autoFocus
                    autoComplete="current-password"
                  />
                  <button type="button" className="auth-eye-btn" onClick={() => setShowPassword((v) => !v)} aria-label="Afficher/masquer">
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              </div>

              {error ? <p className="auth-error">{error}</p> : null}
              <button type="submit" className="auth-btn-primary" disabled={loading}>
                {loading ? "Connexion..." : "Se connecter"}
              </button>
              <p className="auth-alt-link">
                Pas encore de compte ?{" "}
                <Link className="auth-link" href={`/signup?type=${accountType}`}>S&apos;inscrire</Link>
              </p>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginScreen />
    </Suspense>
  );
}
