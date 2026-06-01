"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AuthBrandPanel } from "../../components/AuthBrandPanel";
import { apiSend } from "../../lib/client-api";

function SetPasswordScreen() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const mode = params.get("mode") === "reset" ? "reset" : "activation";
  const typeParam = params.get("type");
  const accountType = useMemo(() => (typeParam === "particulier" ? "particulier" : "entreprise"), [typeParam]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const valid = password.length >= 6 && confirmPassword.length >= 6 && password === confirmPassword;

  async function submit(event) {
    event.preventDefault();
    if (!token || !valid) return;
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const data = await apiSend("/api/auth/set-password", { token, mode, password });
      if (data?.user) {
        window.localStorage.setItem("koji-user", JSON.stringify(data.user));
      }
      setInfo(data.message || "Mot de passe enregistre.");
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
        <h2>{mode === "reset" ? "Nouveau mot de passe" : "Activation du compte"}</h2>
        <form className="auth-form" onSubmit={submit}>
          <input
            className="auth-input"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Nouveau mot de passe"
            type={showPassword ? "text" : "password"}
          />
          <input
            className="auth-input"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Confirmer le mot de passe"
            type={showPassword ? "text" : "password"}
          />
          <label className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} />
            Afficher le mot de passe
          </label>
          {error ? <p style={{ color: "var(--red)", fontWeight: 900 }}>{error}</p> : null}
          {info ? <p style={{ color: "#0f8e4c", fontWeight: 900 }}>{info}</p> : null}
          <button className="button blue" disabled={!valid || loading}>
            {loading ? "Validation..." : "Enregistrer"}
          </button>
        </form>

        <p className="muted" style={{ marginTop: 22 }}>
          Retour a la <Link className="auth-link" href={`/login?type=${accountType}`}>connexion</Link>
        </p>
      </section>
    </main>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <SetPasswordScreen />
    </Suspense>
  );
}
