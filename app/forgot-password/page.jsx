"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AuthBrandPanel } from "../../components/AuthBrandPanel";
import { apiSend } from "../../lib/client-api";
import { useLocale } from "../../lib/i18n";

function ForgotPasswordScreen() {
  const { L } = useLocale();
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
      setMessage(data.message || "Si ce compte existe, un e-mail a été envoyé.");
      if (data.devResetUrl) setDevResetUrl(data.devResetUrl);
    } catch (error) {
      setMessage(error.message || "Une erreur est survenue. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-screen">
      <AuthBrandPanel />

      <section className="auth-panel">
        <div className="auth-switch">
          <Link href="/forgot-password?type=entreprise" className={accountType === "entreprise" ? "active" : ""}>{L.auth.profileCompany}</Link>
          <Link href="/forgot-password?type=particulier" className={accountType === "particulier" ? "active" : ""}>{L.auth.profilePersonal}</Link>
        </div>

        <h2>{L.auth.forgotTitle}</h2>
        <p style={{ color: "#737b88", fontSize: "0.9rem", marginBottom: 16 }}>{L.auth.forgotSub}</p>
        <form className="auth-form" onSubmit={submit}>
          <input
            className="auth-input"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={L.auth.emailPlaceholder}
            type="email"
          />
          {message ? <p className="muted">{message}</p> : null}
          {devResetUrl ? (
            <div style={{ background: "#eef6ff", border: "1px solid #b3d4ff", borderRadius: 10, padding: "14px 16px" }}>
              <p style={{ margin: "0 0 10px", fontSize: "0.88rem", color: "#0a1538" }}>
                {L.auth.emailNotSent}
              </p>
              <a className="button blue" href={devResetUrl} style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
                {L.auth.activateBtn}
              </a>
            </div>
          ) : null}
          <button className="button blue" disabled={!email.trim() || loading}>
            {loading ? L.auth.sending : L.auth.sendLink}
          </button>
        </form>

        <p className="muted" style={{ marginTop: 22 }}>
          {L.auth.backToLogin} <Link className="auth-link" href={`/login?type=${accountType}`}>{L.auth.loginBtn}</Link>
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
