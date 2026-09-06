"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthBrandPanel } from "../../components/AuthBrandPanel";
import { EntrepriseLogin } from "../../components/EntrepriseLogin";
import { LangSwitcher } from "../../components/LangSwitcher";
import { apiSend } from "../../lib/client-api";
import { useLocale } from "../../lib/i18n";

const WORKER_SESSION_KEY = "koji-worker-session";

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

function ParticulierLogin({ L, onSignup }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      setError(L.auth.errIdentifier);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await apiSend("/api/auth/particulier-login", {
        identifier: identifier.trim(),
        password: password.trim()
      });
      if (data.kind === "worker") {
        window.localStorage.setItem(WORKER_SESSION_KEY, JSON.stringify(data.account));
        router.push("/worker");
      } else {
        window.localStorage.setItem("koji-user", JSON.stringify(data.account));
        router.push("/client");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h2 className="auth-title">{L.auth.loginParticulier}</h2>
      <p className="auth-subtitle">{L.auth.subtitleParticulier}</p>
      <form className="auth-form-v2" onSubmit={handleSubmit}>
        <div className="auth-field">
          <label>{L.auth.email}</label>
          <input
            type="text"
            className="auth-input-v2"
            value={identifier}
            onChange={(e) => { setIdentifier(e.target.value); setError(""); }}
            placeholder={L.auth.emailPlaceholder}
            autoFocus
            autoComplete="username"
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
              placeholder="Koji-XXXX-XXXX"
              autoComplete="current-password"
            />
            <button type="button" className="auth-eye-btn" onClick={() => setShowPassword((v) => !v)} aria-label={L.auth.showHide}>
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
          {loading ? L.auth.verifying : L.auth.accessBtn}
        </button>
        <p className="auth-alt-link">
          {L.auth.noAccount}{" "}
          {onSignup ? (
            <button type="button" className="auth-link auth-link-btn" onClick={onSignup}>{L.auth.register}</button>
          ) : (
            <Link className="auth-link" href="/signup?type=particulier">{L.auth.register}</Link>
          )}
        </p>
      </form>
    </>
  );
}

// Inscription "Koji" (particulier), directement sur place dans le panneau —
// plus de page /signup separee pour ce profil (reservee a Koji Pro
// desormais). Meme validation par e-mail que /api/auth/particulier-signup
// prevoit deja (compte inactif jusqu'au clic sur le lien recu).
function ParticulierSignup({ L, onBack }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [devUrl, setDevUrl] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    if (!name.trim()) { setError(L.auth.errName); return; }
    if (password.length < 8) { setError(L.auth.errPasswordLen); return; }
    if (password !== confirmPassword) { setError(L.auth.errPasswordMatch); return; }
    setLoading(true);
    setError("");
    try {
      const data = await apiSend("/api/auth/particulier-signup", {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password
      });
      if (data.directActivationUrl) setDevUrl(data.directActivationUrl);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="auth-inline-confirm">
        <p className="auth-subtitle">{L.auth.confirmSub(email)}</p>
        {devUrl ? (
          <a href={devUrl} className="auth-btn-primary" style={{ display: "block", textAlign: "center", textDecoration: "none", marginBottom: 10 }}>
            {L.auth.activateBtn}
          </a>
        ) : null}
        <button type="button" className="auth-link auth-link-btn" onClick={onBack}>{L.auth.backToLogin}</button>
      </div>
    );
  }

  return (
    <>
      <h2 className="auth-title">{L.auth.createAccount}</h2>
      <p className="auth-subtitle">{L.auth.subtitleSignup2}</p>
      <form className="auth-form-v2" onSubmit={handleSubmit}>
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
          <label>{L.auth.email}</label>
          <input
            type="email"
            className="auth-input-v2"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
            placeholder={L.auth.emailPlaceholder}
            autoComplete="email"
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
        </div>
        <div className="auth-field">
          <label>{L.auth.confirmPassword}</label>
          <input
            className="auth-input-v2"
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
            placeholder={L.auth.repeatPassword}
            autoComplete="new-password"
          />
        </div>
        {error ? <p className="auth-error">{error}</p> : null}
        <button type="submit" className="auth-btn-primary" disabled={loading}>
          {loading ? L.auth.creating : L.auth.createBtn}
        </button>
        <p className="auth-alt-link">
          {L.auth.alreadyAccount}{" "}
          <button type="button" className="auth-link auth-link-btn" onClick={onBack}>{L.auth.signIn}</button>
        </p>
      </form>
    </>
  );
}

// Panneau "Koji" (particulier) complet : bascule entre connexion et
// inscription sur place, sans jamais quitter /login.
function KojiPanel({ L }) {
  const [mode, setMode] = useState("login");
  return mode === "login"
    ? <ParticulierLogin L={L} onSignup={() => setMode("signup")} />
    : <ParticulierSignup L={L} onBack={() => setMode("login")} />;
}

// Section "Connexion Entreprise", repliee en 2 boutons par defaut — le
// formulaire (email, mot de passe...) ne s'affiche qu'apres avoir appuye sur
// "Se connecter". Auto-depliee si on arrive avec ?type=entreprise (ex:
// session entreprise expiree ailleurs dans l'app, qui redirige vers ce lien
// precis) pour ne pas ajouter un clic superflu a une entreprise qui doit
// deja se reconnecter. Remise sur la meme page que Koji (particulier) le 6
// septembre, a la demande d'Amira — les deux profils cohabitent de nouveau
// sur /login au lieu d'etre sur deux adresses separees. Presentee "en
// grand", au meme gabarit que le panneau Koji au-dessus (pas de petite carte
// bordee), avec "Connexion Entreprise" pour seul intitule (plus de label
// "Koji Pro" separe qui doublonnait le titre du formulaire une fois deplie).
function KojiProCard({ L, startOpen }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <div className="auth-pro-section">
      {open ? (
        <EntrepriseLogin L={L} />
      ) : (
        <>
          <h2 className="auth-title">{L.auth.loginCompany}</h2>
          <div className="auth-pro-card-actions">
            <button type="button" className="auth-pro-btn" onClick={() => setOpen(true)}>{L.auth.loginBtn}</button>
            <Link href="/signup?type=entreprise" className="auth-pro-btn secondary">{L.auth.register}</Link>
          </div>
        </>
      )}
    </div>
  );
}

function LoginScreen() {
  const { L } = useLocale();
  const params = useSearchParams();
  const typeParam = params.get("type");
  const proStartsOpen = typeParam === "entreprise";

  return (
    <main className="auth-screen-v2">
      <AuthBrandPanel />
      <section className="auth-panel-v2">
        <div className="auth-card">
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}><LangSwitcher /></div>

          <KojiPanel L={L} />

          <KojiProCard L={L} startOpen={proStartsOpen} />
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
