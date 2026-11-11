"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AuthBrandPanel } from "../../components/AuthBrandPanel";
import { EntrepriseLogin } from "../../components/EntrepriseLogin";
import { SsoButtons } from "../../components/SsoButtons";
import { EntrepriseAuthLayout } from "../../components/EntrepriseAuthLayout";
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
        {error ? <p role="alert" style={{ fontSize: 13, color: "#d32f2f", backgroundColor: "rgba(211, 47, 47, 0.08)", padding: "10px 12px", borderRadius: 2, margin: 0 }}>{error}</p> : null}
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
        {error ? <p role="alert" style={{ fontSize: 13, color: "#d32f2f", backgroundColor: "rgba(211, 47, 47, 0.08)", padding: "10px 12px", borderRadius: 2, margin: 0 }}>{error}</p> : null}
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

  // Koji Pro : maquette PRO-00 (gabarit commun avec /signup).
  if (profile === "entreprise") {
    return (
      <EntrepriseAuthLayout aside={<LangSwitcher />}>
        <EntrepriseLogin L={L} />
      </EntrepriseAuthLayout>
    );
  }

  const sso = <SsoButtons profile={profile} L={L} />;

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

          <KojiPanel L={L} sso={sso} onSwitchProfile={() => setProfile("entreprise")} />

          <p style={{
            fontSize: 13,
            color: "var(--grey)",
            textAlign: "center",
            marginTop: 32,
            borderTop: "1px solid var(--line)",
            paddingTop: 24
          }}>
            Besoin d'aide ? <a href="mailto:contact@getkoji.io" style={{ color: "var(--ink)", textDecoration: "none", fontWeight: 600 }}>contact@getkoji.io</a>
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
