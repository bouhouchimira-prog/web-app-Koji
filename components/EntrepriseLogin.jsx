"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiSend } from "../lib/client-api";
import { SsoButtons } from "./SsoButtons";
import "./entreprise-login.css";

// Connexion Koji Pro (maquette PRO-00, « Ordinateur · se connecter ») :
// onglets Se connecter / Créer un compte, e-mail et mot de passe sur le même
// écran, « Mot de passe oublié ? », bouton jaune, « ou », Google et Apple,
// rappel pour les compagnons invités. Pas d'entrée particulier ici : Koji
// a sa propre entrée (/particulier).
//
// Pas encore dans l'app, donc absent de l'écran : connexion par téléphone
// et code SMS (aucun fournisseur SMS) et Microsoft (retiré le 30 sept.).
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
  try {
    const known = readKnownEmails().filter((item) => item !== email);
    window.localStorage.setItem(KNOWN_EMAILS_KEY, JSON.stringify([email, ...known].slice(0, 12)));
  } catch { /* navigation privée */ }
}

export function EyeIcon({ open }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

// Onglets communs à la connexion et à l'inscription.
export function EntrepriseAuthTabs({ active }) {
  return (
    <nav className="el-tabs" aria-label="Compte">
      {active === "login" ? (
        <span className="el-tab on" aria-current="page">Se connecter</span>
      ) : (
        <Link href="/login?type=entreprise" className="el-tab">Se connecter</Link>
      )}
      {active === "signup" ? (
        <span className="el-tab on" aria-current="page">Créer un compte</span>
      ) : (
        <Link href="/signup?type=entreprise" className="el-tab">Créer un compte</Link>
      )}
    </nav>
  );
}

export function EntrepriseLogin({ L }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendStatus, setResendStatus] = useState("idle");

  // Adresse déjà remplie : celle du lien (?email=, après une activation ou un
  // nouveau mot de passe), sinon la dernière utilisée sur cet appareil.
  useEffect(() => {
    let fromLink = "";
    try { fromLink = new URLSearchParams(window.location.search).get("email") || ""; } catch { /* rien */ }
    const [last] = readKnownEmails();
    if (fromLink || last) setEmail(fromLink || last);
  }, []);

  // Destination après connexion (?next=/demarrage), seulement une page du site.
  function destination() {
    try {
      const next = new URLSearchParams(window.location.search).get("next") || "";
      return next.startsWith("/") && !next.startsWith("//") ? next : "/";
    } catch {
      return "/";
    }
  }

  const needsActivation = /non activ/i.test(error);

  async function resendActivation() {
    setResendStatus("sending");
    try {
      await apiSend("/api/auth/resend-activation", { email: email.trim().toLowerCase() });
    } finally {
      setResendStatus("sent");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError(L.auth.errEmail);
      return;
    }
    if (!password) {
      setError(L.auth.errPassword);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await apiSend("/api/auth/login", { email: trimmed, password, accountType: "entreprise" });
      saveKnownEmail(data.user?.email || trimmed);
      window.localStorage.setItem("koji-user", JSON.stringify(data.user));
      router.push(destination());
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="el">
      <EntrepriseAuthTabs active="login" />

      <form className="el-form" onSubmit={handleSubmit} noValidate>
        <div className="el-field">
          <label htmlFor="el-email">E-mail</label>
          <input
            id="el-email"
            type="email"
            className="el-input"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
            placeholder={L.auth.emailPlaceholder}
            autoComplete="email"
            autoFocus
          />
        </div>
        <div className="el-field">
          <label htmlFor="el-password">Mot de passe</label>
          <div className="el-input-wrap">
            <input
              id="el-password"
              className="el-input"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              autoComplete="current-password"
            />
            <button type="button" className="el-eye-btn" onClick={() => setShowPassword((v) => !v)} aria-label={L.auth.showHide}>
              <EyeIcon open={showPassword} />
            </button>
          </div>
        </div>
        <Link className="el-link" href="/forgot-password?type=entreprise">Mot de passe oublié ?</Link>

        {error ? <p className="el-error" role="alert">{error}</p> : null}
        {needsActivation ? (
          resendStatus === "sent" ? (
            <p className="el-note">E-mail renvoyé ; si besoin, vérifiez vos indésirables.</p>
          ) : (
            <button type="button" className="el-text-btn" onClick={resendActivation} disabled={resendStatus === "sending"}>
              {resendStatus === "sending" ? "Envoi…" : "Renvoyer l'e-mail d'activation"}
            </button>
          )
        ) : null}

        <button type="submit" className="el-btn-primary" disabled={loading}>
          {loading ? L.auth.loggingIn : "Se connecter"}
        </button>
      </form>

      <div className="el-or"><span>ou</span></div>
      <SsoButtons profile="entreprise" L={L} variant="stack" />

      <small className="el-note">Compagnon ou sous-traitant invité ? Ouvrez le lien reçu par message, pas besoin de compte.</small>
    </div>
  );
}
