"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AuthBrandPanel } from "../../components/AuthBrandPanel";
import { apiSend } from "../../lib/client-api";

const KNOWN_EMAILS_KEY = "koji-known-emails";

function saveKnownEmail(nextEmail) {
  const email = String(nextEmail || "").trim().toLowerCase();
  if (!email) return;
  try {
    const raw = window.localStorage.getItem(KNOWN_EMAILS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const known = Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    if (known.includes(email)) return;
    window.localStorage.setItem(KNOWN_EMAILS_KEY, JSON.stringify([email, ...known].slice(0, 12)));
  } catch {
    window.localStorage.setItem(KNOWN_EMAILS_KEY, JSON.stringify([email]));
  }
}

function SignupScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const typeParam = params.get("type");
  const accountType = useMemo(() => (typeParam === "particulier" ? "particulier" : "entreprise"), [typeParam]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [info, setInfo] = useState("");
  const [activationUrl, setActivationUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const valid = name.trim() && email.trim() && password.length >= 6;

  async function submit(event) {
    event.preventDefault();
    if (!valid) return;
    setLoading(true);
    setError("");
    setInfo("");
    setActivationUrl("");
    try {
      const data = await apiSend("/api/auth/signup", { name, email, password, accountType });
      saveKnownEmail(data.user?.email || email);
      window.localStorage.setItem("koji-user", JSON.stringify(data.user));
      setInfo(data.message || "Compte cree.");
      if (data.devActivationUrl) setActivationUrl(data.devActivationUrl);
      router.push(data.user?.accountType === "particulier" ? "/client" : "/");
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
          <Link href="/signup?type=entreprise" className={accountType === "entreprise" ? "active" : ""}>Profil entreprise</Link>
          <Link href="/signup?type=particulier" className={accountType === "particulier" ? "active" : ""}>Profil particulier</Link>
        </div>

        <h2>Inscription</h2>
        <form className="auth-form" onSubmit={submit}>
          <input className="auth-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nom complet" />
          <input className="auth-input" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Adresse e-mail" type="email" />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              className="auth-input"
              style={{ flex: 1 }}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mot de passe (6 caracteres min.)"
              type={showPassword ? "text" : "password"}
            />
            <button
              type="button"
              className="button secondary"
              style={{ minWidth: 88 }}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? "Masquer" : "Afficher"}
            </button>
          </div>
          {error ? <p style={{ color: "var(--red)", fontWeight: 400 }}>{error}</p> : null}
          {info ? <p style={{ color: "#0f8e4c", fontWeight: 400 }}>{info}</p> : null}
          {activationUrl ? (
            <p className="muted" style={{ fontSize: 14 }}>
              Lien d&apos;activation de test: <a className="auth-link" href={activationUrl}>Activer mon compte</a>
            </p>
          ) : null}
          <button className="button blue" disabled={!valid || loading}>{loading ? "Creation..." : "Creer mon compte"}</button>
        </form>
        <p className="muted" style={{ marginTop: 22 }}>Deja un compte ? <Link className="auth-link" href={`/login?type=${accountType}`}>Connexion</Link></p>
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
