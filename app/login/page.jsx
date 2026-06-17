"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AuthBrandPanel } from "../../components/AuthBrandPanel";
import { apiSend } from "../../lib/client-api";

const KNOWN_EMAILS_KEY = "koji-known-emails";
const WORKER_SESSION_KEY = "koji-worker-session";

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

function EntrepriseLogin() {
  const router = useRouter();
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [knownEmails, setKnownEmails] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setKnownEmails(readKnownEmails());
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
      <h2 className="auth-title">Connexion Entreprise</h2>
      <p className="auth-subtitle">
        {step === "email" ? "Entrez votre adresse email." : "Entrez votre mot de passe."}
      </p>

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
            <Link className="auth-link" href="/signup?type=entreprise">S&apos;inscrire</Link>
          </p>
        </form>
      )}

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
              <Link className="auth-link" href="/forgot-password?type=entreprise" style={{ fontSize: "0.82rem" }}>
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
            <Link className="auth-link" href="/signup?type=entreprise">S&apos;inscrire</Link>
          </p>
        </form>
      )}
    </>
  );
}

function ParticulierLogin() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      setError("Renseignez l'identifiant et le mot de passe.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await apiSend("/api/auth/client-portal-login", {
        identifier: identifier.trim(),
        password: password.trim()
      });
      window.localStorage.setItem("koji-user", JSON.stringify(data.user));
      router.push("/client");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h2 className="auth-title">Espace Client</h2>
      <p className="auth-subtitle">
        Entrez l&apos;identifiant et le mot de passe reçus de votre artisan.
      </p>
      <form className="auth-form-v2" onSubmit={handleSubmit}>
        <div className="auth-field">
          <label>Identifiant</label>
          <input
            type="text"
            className="auth-input-v2"
            value={identifier}
            onChange={(e) => { setIdentifier(e.target.value); setError(""); }}
            placeholder="Koji-CH1234"
            autoFocus
            autoComplete="username"
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
              placeholder="Koji-XXXX-XXXX"
              autoComplete="current-password"
            />
            <button type="button" className="auth-eye-btn" onClick={() => setShowPassword((v) => !v)} aria-label="Afficher/masquer">
              <EyeIcon open={showPassword} />
            </button>
          </div>
        </div>
        {error ? <p className="auth-error">{error}</p> : null}
        <button
          type="submit"
          className="auth-btn-primary"
          disabled={loading || !identifier.trim() || !password.trim()}
        >
          {loading ? "Vérification..." : "Accéder à mon espace"}
        </button>
        <p className="auth-alt-link" style={{ color: "#9aa5b4", fontSize: "0.82rem", textAlign: "center" }}>
          Vous avez reçu ces identifiants par e-mail ou SMS de votre artisan.
        </p>
      </form>
    </>
  );
}

function OuvrierLogin() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      setError("Renseignez l'identifiant et le mot de passe.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await apiSend("/api/worker-auth", {
        identifier: identifier.trim(),
        password: password.trim()
      });
      window.localStorage.setItem(WORKER_SESSION_KEY, JSON.stringify(data.worker));
      router.push("/worker");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h2 className="auth-title">Espace Ouvrier</h2>
      <p className="auth-subtitle">
        Entrez votre identifiant et mot de passe pour suivre vos tâches.
      </p>
      <form className="auth-form-v2" onSubmit={handleSubmit}>
        <div className="auth-field">
          <label>Identifiant</label>
          <input
            type="text"
            className="auth-input-v2"
            value={identifier}
            onChange={(e) => { setIdentifier(e.target.value); setError(""); }}
            placeholder="OUV-XXXXXX"
            autoFocus
            autoComplete="username"
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
              placeholder="KJ-XXXX-XXXX"
              autoComplete="current-password"
            />
            <button type="button" className="auth-eye-btn" onClick={() => setShowPassword((v) => !v)} aria-label="Afficher/masquer">
              <EyeIcon open={showPassword} />
            </button>
          </div>
        </div>
        {error ? <p className="auth-error">{error}</p> : null}
        <button
          type="submit"
          className="auth-btn-primary"
          disabled={loading || !identifier.trim() || !password.trim()}
        >
          {loading ? "Vérification..." : "Accéder à mon espace"}
        </button>
        <p className="auth-alt-link" style={{ color: "#9aa5b4", fontSize: "0.82rem", textAlign: "center" }}>
          Votre identifiant vous a été transmis par votre entreprise.
        </p>
      </form>
    </>
  );
}

function LoginScreen() {
  const params = useSearchParams();
  const typeParam = params.get("type");

  const initialType = typeParam === "ouvrier" ? "ouvrier" : typeParam === "particulier" ? "particulier" : "entreprise";
  const [accountType, setAccountType] = useState(initialType);

  return (
    <main className="auth-screen-v2">
      <AuthBrandPanel />
      <section className="auth-panel-v2">
        <div className="auth-card">

          <div className="auth-type-toggle auth-type-toggle-3">
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
              Client
            </button>
            <button
              type="button"
              className={accountType === "ouvrier" ? "active" : ""}
              onClick={() => setAccountType("ouvrier")}
            >
              Ouvrier
            </button>
          </div>

          {accountType === "entreprise" && <EntrepriseLogin />}
          {accountType === "particulier" && <ParticulierLogin />}
          {accountType === "ouvrier" && <OuvrierLogin />}

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
