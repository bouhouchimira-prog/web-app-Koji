"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AuthBrandPanel } from "../../components/AuthBrandPanel";
import { apiSend } from "../../lib/client-api";

function ForgotPasswordScreen() {
  const params = useSearchParams();
  const typeParam = params.get("type");
  const accountType = useMemo(() => (typeParam === "particulier" ? "particulier" : "entreprise"), [typeParam]);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [devResetUrl, setDevResetUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setDevResetUrl("");
    try {
      const data = await apiSend("/api/auth/forgot-password", { email, accountType });
      setMessage(data.message || "Si ce compte existe, un e-mail a ete envoye.");
      if (data.devResetUrl) setDevResetUrl(data.devResetUrl);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-screen">
      <AuthBrandPanel />

      <section className="auth-panel">
        <div className="auth-switch">
          <Link href="/forgot-password?type=entreprise" className={accountType === "entreprise" ? "active" : ""}>Profil entreprise</Link>
          <Link href="/forgot-password?type=particulier" className={accountType === "particulier" ? "active" : ""}>Profil particulier</Link>
        </div>

        <h2>Mot de passe oublie</h2>
        <form className="auth-form" onSubmit={submit}>
          <input
            className="auth-input"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Adresse e-mail"
            type="email"
          />
          {message ? <p className="muted">{message}</p> : null}
          {devResetUrl ? (
            <p className="muted">
              Lien de test: <a className="auth-link" href={devResetUrl}>Creer un nouveau mot de passe</a>
            </p>
          ) : null}
          <button className="button blue" disabled={!email.trim() || loading}>
            {loading ? "Envoi..." : "Envoyer le lien"}
          </button>
        </form>

        <p className="muted" style={{ marginTop: 22 }}>
          Retour a la <Link className="auth-link" href={`/login?type=${accountType}`}>connexion</Link>
        </p>
      </section>
    </main>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordScreen />
    </Suspense>
  );
}
