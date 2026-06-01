"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
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

function LoginScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const typeParam = params.get("type");
  const accountType = useMemo(() => (typeParam === "particulier" ? "particulier" : "entreprise"), [typeParam]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [knownEmails, setKnownEmails] = useState([]);
  const [selectedKnownEmail, setSelectedKnownEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const emailValue = (selectedKnownEmail || email).trim();
  const usingPassword = Boolean(password.trim());
  const valid = Boolean(emailValue && (usingPassword || selectedKnownEmail));

  useEffect(() => {
    const known = readKnownEmails();
    setKnownEmails(known);
    if (known.length) setSelectedKnownEmail(known[0]);
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (!valid) return;
    setLoading(true);
    setError("");
    try {
      const data = usingPassword
        ? await apiSend("/api/auth/login", { email: emailValue, password, accountType })
        : await apiSend("/api/auth/quick-login", { email: emailValue, accountType });
      if (remember) saveKnownEmail(data.user?.email || emailValue);
      window.localStorage.setItem("koji-user", JSON.stringify(data.user));
      router.push("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-screen">
      <AuthBrandPanel />

      <section className="auth-panel">
        <div className="auth-switch">
          <Link href="/login?type=entreprise" className={accountType === "entreprise" ? "active" : ""}>Profil entreprise</Link>
          <Link href="/login?type=particulier" className={accountType === "particulier" ? "active" : ""}>Profil particulier</Link>
        </div>

        <h2>Connexion</h2>
        <form className="auth-form" onSubmit={submit}>
          <input className="auth-input" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Adresse e-mail" type="email" />
          {knownEmails.length ? (
            <select
              className="auth-input"
              value={selectedKnownEmail}
              onChange={(event) => setSelectedKnownEmail(event.target.value)}
            >
              <option value="">Utiliser l&apos;e-mail + mot de passe</option>
              {knownEmails.map((candidate) => (
                <option key={candidate} value={candidate}>{candidate}</option>
              ))}
            </select>
          ) : null}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              className="auth-input"
              style={{ flex: 1 }}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={selectedKnownEmail ? "Optionnel (connexion directe activee)" : "Mot de passe"}
              type={showPassword ? "text" : "password"}
            />
            <button
              type="button"
              className="button secondary"
              onClick={() => setShowPassword((value) => !value)}
              style={{ minWidth: 88 }}
            >
              {showPassword ? "Masquer" : "Afficher"}
            </button>
          </div>
          <div className="auth-row">
            <label>
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
              />{" "}
              Se souvenir
            </label>
            <Link className="auth-link" href={`/forgot-password?type=${accountType}`}>Mot de passe oublie ?</Link>
          </div>
          {error ? <p style={{ color: "var(--red)", fontWeight: 900 }}>{error}</p> : null}
          <button className="button blue" disabled={!valid || loading}>{loading ? "Connexion..." : "Connexion"}</button>
        </form>
        <p className="muted" style={{ marginTop: 22 }}>Pas encore de compte ? <Link className="auth-link" href={`/signup?type=${accountType}`}>S&apos;inscrire</Link></p>
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
