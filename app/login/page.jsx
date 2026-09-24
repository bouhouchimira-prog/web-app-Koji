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

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.5 6 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.5 6 29.5 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.4 0 10.3-1.9 14.1-5.1l-6.5-5.5C29.5 35.4 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.4l6.5 5.5C41.5 36 44 30.5 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 23 23">
      <path fill="#f35325" d="M1 1h10v10H1z" /><path fill="#81bc06" d="M12 1h10v10H12z" />
      <path fill="#05a6f0" d="M1 12h10v10H1z" /><path fill="#ffba08" d="M12 12h10v10H12z" />
    </svg>
  );
}
function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#000">
      <path d="M16.36 1.43c0 1.14-.42 2.19-1.25 3.02-.88.9-2.14 1.59-3.24 1.5-.14-1.1.44-2.24 1.24-3.02.86-.85 2.28-1.5 3.25-1.5zM20.6 17.1c-.5 1.16-.75 1.68-1.4 2.7-.9 1.42-2.18 3.2-3.75 3.22-1.4.02-1.76-.9-3.66-.9-1.9 0-2.3.88-3.66.92-1.53.05-2.7-1.53-3.6-2.94-2.47-3.85-2.73-8.37-1.2-10.78 1.08-1.72 2.79-2.72 4.4-2.72 1.64 0 2.67.94 4.02.94 1.31 0 2.11-.94 4.01-.94 1.44 0 2.97.78 4.05 2.13-3.56 1.95-2.98 7.03.79 8.37z" />
    </svg>
  );
}

// Ecran de connexion en 3 etapes : "quel profil ?" -> formulaire du profil
// choisi -> (dans le formulaire) options Google/Microsoft/Apple, visibles
// comme dans la maquette de reference d'Amira mais desactivees et marquees
// "Bientot disponible" — aucune de ces connexions n'est reellement branchee
// (pas d'app OAuth enregistree cote Google/Microsoft/Apple), les afficher
// comme actives serait trompeur.
function SsoOptions() {
  return (
    <div className="auth-sso-group">
      <button type="button" className="auth-sso-btn" disabled title="Bientôt disponible">
        <GoogleIcon /> Continuer avec Google <span className="auth-sso-soon">Bientôt</span>
      </button>
      <button type="button" className="auth-sso-btn" disabled title="Bientôt disponible">
        <MicrosoftIcon /> Continuer avec Microsoft <span className="auth-sso-soon">Bientôt</span>
      </button>
      <button type="button" className="auth-sso-btn" disabled title="Bientôt disponible">
        <AppleIcon /> Continuer avec Apple <span className="auth-sso-soon">Bientôt</span>
      </button>
      <div className="auth-sso-divider"><span>ou</span></div>
    </div>
  );
}

function ProfileChooser({ onChoose }) {
  return (
    <div className="auth-profile-chooser">
      <h2 className="auth-title">Bienvenue sur koji</h2>
      <p className="auth-subtitle">Choisissez votre profil pour continuer.</p>
      <button type="button" className="auth-profile-card" onClick={() => onChoose("particulier")}>
        <span className="auth-profile-card-icon particulier">🏠</span>
        <span className="auth-profile-card-text">
          <strong>Koji</strong>
          <small>Publiez vos offres</small>
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
      </button>
      <button type="button" className="auth-profile-card" onClick={() => onChoose("entreprise")}>
        <span className="auth-profile-card-icon entreprise">🛠️</span>
        <span className="auth-profile-card-text">
          <strong>Koji Pro</strong>
          <small>Trouvez des offres et gérez vos travaux</small>
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
      </button>
    </div>
  );
}

function LoginScreen() {
  const { L } = useLocale();
  const params = useSearchParams();
  const typeParam = params.get("type");
  const [profile, setProfile] = useState(
    typeParam === "entreprise" ? "entreprise" : typeParam === "particulier" ? "particulier" : null
  );

  return (
    <main className="auth-screen-v2">
      <AuthBrandPanel />
      <section className="auth-panel-v2">
        <div className="auth-card">
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}><LangSwitcher /></div>

          {!profile ? (
            <ProfileChooser onChoose={setProfile} />
          ) : (
            <>
              <button type="button" className="auth-back-btn" onClick={() => setProfile(null)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                Changer de profil
              </button>
              <SsoOptions />
              {profile === "particulier" ? <KojiPanel L={L} /> : <EntrepriseLogin L={L} />}
            </>
          )}

          <p className="auth-help-footer">
            Besoin d'aide ? <a href="mailto:contact@kojibuild.com">contact@kojibuild.com</a>
          </p>
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
