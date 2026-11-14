"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { AuthBrandPanel } from "../../components/AuthBrandPanel";
import { apiSend } from "../../lib/client-api";
import { useLocale } from "../../lib/i18n";
import { EntrepriseAuthLayout } from "../../components/EntrepriseAuthLayout";
import { NouveauMotDePasse } from "../../components/EntrepriseAccountScreens";
import { NOM_APP, appDepuisJeton } from "../../lib/reset-app";

// Espace particulier, liens d'activation des anciens comptes et liens
// Supabase (#access_token) : écran d'origine.
function SetPasswordLegacy() {
  const { L } = useLocale();
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
  const [fini, setFini] = useState(false);
  // Supabase recovery links carry the session in the URL hash
  // (#access_token=...&type=recovery) instead of a ?token= query param.
  const [accessToken, setAccessToken] = useState("");

  useEffect(() => {
    if (typeof window === "undefined" || !window.location.hash) return;
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const supabaseToken = hashParams.get("access_token");
    if (supabaseToken) setAccessToken(supabaseToken);
  }, []);

  // Demande venue d'une app (lib/reset-app.js) : &app= dans le lien e-mail,
  // ou, pour les liens Supabase des anciennes versions, le compte du jeton.
  // Couleurs de l'app concernée, et fin « Retournez dans l'app … » plutôt
  // qu'un lien vers la connexion du site Pro.
  const appParam = params.get("app");
  const appRetour = appParam === "koji" || appParam === "pro" ? appParam : accessToken ? appDepuisJeton(accessToken) : null;
  const marque = appRetour === "koji" ? "particulier" : appRetour === "pro" ? "entreprise" : accountType;

  const valid = password.length >= 8 && confirmPassword.length >= 8 && password === confirmPassword;

  async function submit(event) {
    event.preventDefault();
    if ((!token && !accessToken) || !valid) return;
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const data = await apiSend("/api/auth/set-password", { token, mode, password, accessToken, accountType });
      if (data?.user) {
        window.localStorage.setItem("koji-user", JSON.stringify(data.user));
      }
      if (appRetour) {
        setFini(true);
        return;
      }
      setInfo(data.message || "Mot de passe enregistre.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (fini) {
    return (
      <main className={`auth-screen${marque === "entreprise" ? " auth-pro" : ""}`}>
        <AuthBrandPanel profile={marque} />
        <section className="auth-panel">
          <h2>Mot de passe enregistré</h2>
          <p style={{ color: "#0f8e4c", fontWeight: 400 }}>
            Retournez dans l'app <b>{NOM_APP[appRetour]}</b> et connectez-vous avec votre adresse e-mail et ce nouveau mot de passe.
          </p>
          <p className="muted">Vous pouvez fermer cette page.</p>
        </section>
      </main>
    );
  }

  return (
    <main className={`auth-screen${marque === "entreprise" ? " auth-pro" : ""}`}>
      <AuthBrandPanel profile={marque} />

      <section className="auth-panel">
        <h2>{mode === "reset" ? L.auth.newPassword : L.auth.activateAccount}</h2>
        <form className="auth-form" onSubmit={submit}>
          <input
            className="auth-input"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={L.auth.newPassword}
            type={showPassword ? "text" : "password"}
          />
          <small className="muted">{L.auth.passwordMinHint}</small>
          <input
            className="auth-input"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder={L.auth.confirmPassPh}
            type={showPassword ? "text" : "password"}
          />
          <label className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} />
            {L.auth.showPassword}
          </label>
          {error ? <p style={{ color: "var(--red)", fontWeight: 400 }}>{error}</p> : null}
          {info ? <p style={{ color: "#0f8e4c", fontWeight: 400 }}>{info}</p> : null}
          <button className="button blue" disabled={!valid || loading}>
            {loading ? L.auth.validating : L.common.save}
          </button>
        </form>

        {appRetour ? null : (
          <p className="muted" style={{ marginTop: 22 }}>
            {L.auth.backToLogin} <Link className="auth-link" href={`/login?type=${accountType}`}>{L.auth.loginBtn}</Link>
          </p>
        )}
      </section>
    </main>
  );
}

// Koji Pro, lien « Mot de passe oublié » : maquette PRO-00.1.
function SetPasswordScreen() {
  const params = useSearchParams();
  const app = params.get("app");
  const entrepriseReset = params.get("type") !== "particulier" && params.get("mode") === "reset" && params.get("token");
  // Demande venue de l'app Koji (particulier) : écran aux couleurs de Koji,
  // pas la maquette Koji Pro (même jeton, même route côté serveur).
  if (!entrepriseReset || app === "koji") return <SetPasswordLegacy />;
  return (
    <EntrepriseAuthLayout>
      <NouveauMotDePasse token={params.get("token")} app={app === "pro" ? "pro" : null} />
    </EntrepriseAuthLayout>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <SetPasswordScreen />
    </Suspense>
  );
}
