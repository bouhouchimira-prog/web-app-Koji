"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AuthBrandPanel } from "../../components/AuthBrandPanel";
import { EntrepriseLogin } from "../../components/EntrepriseLogin";
import { LangSwitcher } from "../../components/LangSwitcher";
import { apiSend } from "../../lib/client-api";
import { useLocale } from "../../lib/i18n";
import "../home-pro.css";

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

function SwitchArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function SwitchProfileCard({ label, cta, onClick }) {
  return (
    <button type="button" style={{
      marginTop: 24,
      padding: "14px 16px",
      background: "var(--card)",
      border: "1px solid var(--line)",
      borderRadius: 2,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      width: "100%",
      fontSize: 14,
      cursor: "pointer"
    }} onClick={onClick}>
      <span style={{ color: "var(--ink)", fontWeight: 500 }}>{label}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--grey)", fontSize: 13 }}>{cta}<SwitchArrowIcon /></span>
    </button>
  );
}

function ParticulierLogin({ L, sso }) {
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
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, color: "var(--ink)" }}>{L.auth.connexionTitle}</h2>
      <p style={{ fontSize: 14, color: "var(--grey)", marginBottom: 24 }}>{L.auth.heroSubtitleParticulier}</p>
      {sso}
      <form style={{ display: "flex", flexDirection: "column", gap: 16 }} onSubmit={handleSubmit}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{L.auth.email}</label>
          <input
            type="text"
            style={{
              padding: "10px 12px",
              border: "1px solid var(--line)",
              borderRadius: 2,
              fontSize: 14,
              fontFamily: "inherit",
              backgroundColor: "var(--card)",
              color: "var(--ink)"
            }}
            value={identifier}
            onChange={(e) => { setIdentifier(e.target.value); setError(""); }}
            placeholder={L.auth.emailPlaceholder}
            autoFocus
            autoComplete="username"
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{L.auth.password}</label>
            <Link className="link" href="/forgot-password?type=particulier" style={{ textDecoration: "none" }}>
              {L.auth.forgotPassword}
            </Link>
          </div>
          <div style={{ position: "relative", display: "flex" }}>
            <input
              style={{
                flex: 1,
                padding: "10px 12px",
                border: "1px solid var(--line)",
                borderRadius: 2,
                fontSize: 14,
                fontFamily: "inherit",
                backgroundColor: "var(--card)",
                color: "var(--ink)"
              }}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              placeholder="Koji-XXXX-XXXX"
              autoComplete="current-password"
            />
            <button
              type="button"
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--grey)",
                padding: 4
              }}
              onClick={() => setShowPassword((v) => !v)}
              aria-label={L.auth.showHide}
            >
              <EyeIcon open={showPassword} />
            </button>
          </div>
        </div>
        {error ? <p style={{ fontSize: 13, color: "#d32f2f", backgroundColor: "rgba(211, 47, 47, 0.08)", padding: "10px 12px", borderRadius: 2, margin: 0 }}>{error}</p> : null}
        <button
          type="submit"
          className="btn btn-main"
          style={{ marginTop: 8 }}
          disabled={loading || !identifier.trim() || !password.trim()}
        >
          {loading ? L.auth.verifying : L.auth.accessBtn}
        </button>
      </form>
    </>
  );
}

// Inscription "Koji" (particulier), directement sur place dans le panneau —
// plus de page /signup separee pour ce profil (reservee a Koji Pro
// desormais). Meme validation par e-mail que /api/auth/particulier-signup
// prevoit deja (compte inactif jusqu'au clic sur le lien recu).
function ParticulierSignup({ L, onBack, sso }) {
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
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ fontSize: 14, color: "var(--grey)", margin: 0 }}>{L.auth.confirmSub(email)}</p>
        {devUrl ? (
          <a href={devUrl} className="btn btn-main" style={{ textAlign: "center", textDecoration: "none" }}>
            {L.auth.activateBtn}
          </a>
        ) : null}
        <button type="button" className="link" onClick={onBack} style={{ textDecoration: "none" }}>{L.auth.backToLogin}</button>
      </div>
    );
  }

  return (
    <>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, color: "var(--ink)" }}>{L.auth.createAccount}</h2>
      <p style={{ fontSize: 14, color: "var(--grey)", marginBottom: 24 }}>{L.auth.subtitleSignup2}</p>
      {sso}
      <form style={{ display: "flex", flexDirection: "column", gap: 16 }} onSubmit={handleSubmit}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{L.auth.fullName}</label>
          <input
            style={{
              padding: "10px 12px",
              border: "1px solid var(--line)",
              borderRadius: 2,
              fontSize: 14,
              fontFamily: "inherit",
              backgroundColor: "var(--card)",
              color: "var(--ink)"
            }}
            value={name}
            onChange={(e) => { setName(e.target.value); setError(""); }}
            placeholder={L.auth.namePlaceholder}
            autoFocus
            autoComplete="name"
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{L.auth.email}</label>
          <input
            type="email"
            style={{
              padding: "10px 12px",
              border: "1px solid var(--line)",
              borderRadius: 2,
              fontSize: 14,
              fontFamily: "inherit",
              backgroundColor: "var(--card)",
              color: "var(--ink)"
            }}
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
            placeholder={L.auth.emailPlaceholder}
            autoComplete="email"
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{L.auth.password}</label>
          <div style={{ position: "relative", display: "flex" }}>
            <input
              style={{
                flex: 1,
                padding: "10px 12px",
                border: "1px solid var(--line)",
                borderRadius: 2,
                fontSize: 14,
                fontFamily: "inherit",
                backgroundColor: "var(--card)",
                color: "var(--ink)"
              }}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              placeholder={L.auth.passwordMin}
              autoComplete="new-password"
            />
            <button
              type="button"
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--grey)",
                padding: 4
              }}
              onClick={() => setShowPassword((v) => !v)}
              aria-label={L.auth.showHide}
            >
              <EyeIcon open={showPassword} />
            </button>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{L.auth.confirmPassword}</label>
          <input
            style={{
              padding: "10px 12px",
              border: "1px solid var(--line)",
              borderRadius: 2,
              fontSize: 14,
              fontFamily: "inherit",
              backgroundColor: "var(--card)",
              color: "var(--ink)"
            }}
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
            placeholder={L.auth.repeatPassword}
            autoComplete="new-password"
          />
        </div>
        {error ? <p style={{ fontSize: 13, color: "#d32f2f", backgroundColor: "rgba(211, 47, 47, 0.08)", padding: "10px 12px", borderRadius: 2, margin: 0 }}>{error}</p> : null}
        <button type="submit" className="btn btn-main" disabled={loading}>
          {loading ? L.auth.creating : L.auth.createBtn}
        </button>
      </form>
    </>
  );
}

// Panneau "Koji" (particulier) complet : bascule entre connexion et
// inscription sur place, sans jamais quitter /login. Porte lui-meme les
// onglets Connexion/Creer un compte et le badge "Espace particulier" (18
// oct, nouveau design) puisque c'est lui qui possede l'etat `mode`.
function KojiPanel({ L, onSwitchProfile, sso }) {
  const [mode, setMode] = useState("login");
  return (
    <>
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--grey)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12, display: "inline-block" }}>{L.auth.espaceParticulier}</span>
      <div style={{ display: "flex", gap: 3, borderBottom: "1px solid var(--frame)", marginBottom: 24 }}>
        <button type="button" style={{
          padding: "8px 14px",
          background: mode === "login" ? "var(--tab-h)" : "var(--tab)",
          border: "1px solid var(--frame)",
          borderBottom: "none",
          borderRadius: "2px 2px 0 0",
          color: mode === "login" ? "var(--ink)" : "var(--tabtxt)",
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
          textDecoration: "none"
        }} onClick={() => setMode("login")}>
          {L.auth.connexionTitle}
        </button>
        <button type="button" style={{
          padding: "8px 14px",
          background: mode === "signup" ? "var(--tab-h)" : "var(--tab)",
          border: "1px solid var(--frame)",
          borderBottom: "none",
          borderRadius: "2px 2px 0 0",
          color: mode === "signup" ? "var(--ink)" : "var(--tabtxt)",
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
          textDecoration: "none"
        }} onClick={() => setMode("signup")}>
          {L.auth.createAccountTab}
        </button>
      </div>
      {mode === "login" ? <ParticulierLogin L={L} sso={sso} /> : <ParticulierSignup L={L} onBack={() => setMode("login")} sso={sso} />}
      {onSwitchProfile ? (
        <SwitchProfileCard label={L.auth.switchToEntrepriseLabel} cta={L.auth.switchToEntrepriseCta} onClick={onSwitchProfile} />
      ) : null}
    </>
  );
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
function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#000">
      <path d="M16.36 1.43c0 1.14-.42 2.19-1.25 3.02-.88.9-2.14 1.59-3.24 1.5-.14-1.1.44-2.24 1.24-3.02.86-.85 2.28-1.5 3.25-1.5zM20.6 17.1c-.5 1.16-.75 1.68-1.4 2.7-.9 1.42-2.18 3.2-3.75 3.22-1.4.02-1.76-.9-3.66-.9-1.9 0-2.3.88-3.66.92-1.53.05-2.7-1.53-3.6-2.94-2.47-3.85-2.73-8.37-1.2-10.78 1.08-1.72 2.79-2.72 4.4-2.72 1.64 0 2.67.94 4.02.94 1.31 0 2.11-.94 4.01-.94 1.44 0 2.97.78 4.05 2.13-3.56 1.95-2.98 7.03.79 8.37z" />
    </svg>
  );
}

// Ecran de connexion en 3 etapes : "quel profil ?" -> formulaire du profil
// choisi -> (dans le formulaire) options Google/Apple (Microsoft retire le
// 30 sept, aucune app OAuth Microsoft prevue). Google est desormais branche
// pour les DEUX profils : cote Koji Pro (entreprise), la session Supabase
// obtenue est la session finale (app/api/auth/google/finish) ; cote Koji
// (particulier), ces comptes ne sont pas sur Supabase Auth — la session
// Supabase sert uniquement a prouver l'email verifie, puis
// app/api/auth/google/finish-particulier retrouve ou cree le compte dans
// db.users et pose un jeton de portail (voir app/auth/google/callback pour
// le branchement des deux, via ?profile=... dans redirectTo). Apple reste
// "Bientot disponible" (pas d'app Sign in with Apple enregistree).
function SsoOptions({ profile, L }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGoogle() {
    setError("");
    setLoading(true);
    try {
      const { getSupabaseBrowser } = await import("../../lib/supabase-browser");
      const supabase = getSupabaseBrowser();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/google/callback?profile=${profile}`,
          // Sans ca, Google saute l'ecran de choix de compte des qu'un seul
          // compte est deja connecte dans le navigateur et que l'app a deja
          // ete autorisee une fois (4 oct, remonte par Amira) — toujours
          // montrer le choix, meme dans ce cas.
          queryParams: { prompt: "select_account" }
        }
      });
      if (oauthError) throw oauthError;
      // La suite se passe hors de cette page : Supabase redirige vers Google,
      // puis vers /auth/google/callback une fois revenu.
    } catch (err) {
      setError(err.message || "Connexion Google impossible.");
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="button"
          className="btn btn-sec"
          style={{ flex: 1 }}
          disabled={loading}
          onClick={handleGoogle}
        >
          <GoogleIcon /> {loading ? "Redirection…" : "Google"}
        </button>
        <button type="button" className="btn btn-sec" style={{ flex: 1, position: "relative" }} disabled title="Bientôt disponible">
          <AppleIcon /> Apple <span style={{ fontSize: 10, color: "var(--grey)", fontWeight: 500 }}>Bientôt</span>
        </button>
      </div>
      {error ? <p style={{ fontSize: 13, color: "#d32f2f", backgroundColor: "rgba(211, 47, 47, 0.08)", padding: "10px 12px", borderRadius: 2, margin: 0 }}>{error}</p> : null}
      <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--grey)", fontSize: 13 }}>
        <div style={{ flex: 1, height: 1, backgroundColor: "var(--line)" }}></div>
        <span>{L.auth.orWithEmail}</span>
        <div style={{ flex: 1, height: 1, backgroundColor: "var(--line)" }}></div>
      </div>
    </div>
  );
}

function LoginScreen() {
  const { L } = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const typeParam = params.get("type");
  const [profile, setProfile] = useState(
    typeParam === "entreprise" ? "entreprise" : typeParam === "particulier" ? "particulier" : null
  );

  useEffect(() => {
    if (typeParam === "ouvrier") { router.replace("/worker"); return; }
    if (!profile) router.replace("/");
  }, [profile, typeParam, router]);

  if (!profile) return null;

  const sso = <SsoOptions profile={profile} L={L} />;

  return (
    <div className="pro" style={{
      minHeight: "100vh",
      display: "flex",
      backgroundColor: profile === "entreprise" ? "var(--bg)" : "#ffffff"
    }}>
      {/* Brand Panel - Koji/Entreprise Sidebar */}
      <AuthBrandPanel profile={profile} />

      {/* Login Form */}
      <section style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "40px 32px",
        maxWidth: 480,
        margin: "0 auto"
      }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
            <Link href="/" className="link" style={{
              textDecoration: "none"
            }}>
              ← Retour
            </Link>
            <LangSwitcher />
          </div>

          {profile === "particulier" ? (
            <KojiPanel L={L} sso={sso} onSwitchProfile={() => setProfile("entreprise")} />
          ) : (
            <EntrepriseLogin L={L} sso={sso} onSwitchProfile={() => setProfile("particulier")} />
          )}

          <p style={{
            fontSize: 13,
            color: "var(--grey)",
            textAlign: "center",
            marginTop: 32,
            borderTop: "1px solid var(--line)",
            paddingTop: 24
          }}>
            Besoin d'aide ? <a href="mailto:contact@kojibuild.com" style={{ color: "var(--ink)", textDecoration: "none", fontWeight: 600 }}>contact@kojibuild.com</a>
          </p>
        </div>
      </section>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginScreen />
    </Suspense>
  );
}
