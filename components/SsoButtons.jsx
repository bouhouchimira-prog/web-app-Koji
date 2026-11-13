"use client";

import { useState } from "react";

// Connexion Google et Apple (Supabase OAuth), partagée par /login (Koji et
// Koji Pro) et /signup. `variant` : "row" (deux boutons côte à côte puis
// « ou avec votre e-mail », panneau Koji) ou "stack" (maquette PRO-00 :
// « Continuer avec Google / Apple » pleine largeur). Microsoft : retiré le
// 30 sept. (aucune application OAuth Microsoft).
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
// 30 sept, aucune app OAuth Microsoft prevue). Google et Apple sont branches
// pour les DEUX profils : cote Koji Pro (entreprise), la session Supabase
// obtenue est la session finale (app/api/auth/google/finish) ; cote Koji
// (particulier), ces comptes ne sont pas sur Supabase Auth — la session
// Supabase sert uniquement a prouver l'email verifie, puis
// app/api/auth/google/finish-particulier retrouve ou cree le compte dans
// db.users et pose un jeton de portail (voir app/auth/google/callback pour
// le branchement des deux, via ?profile=... dans redirectTo).
export function SsoButtons({ profile, L, variant = "row" }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGoogle() {
    setError("");
    setLoading(true);
    try {
      const { getSupabaseBrowser } = await import("../lib/supabase-browser");
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

  async function handleApple() {
    setError("");
    setLoading(true);
    try {
      const { getSupabaseBrowser } = await import("../lib/supabase-browser");
      const supabase = getSupabaseBrowser();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: {
          redirectTo: `${window.location.origin}/auth/google/callback?profile=${profile}`,
          scopes: "email name"
        }
      });
      if (oauthError) throw oauthError;
    } catch (err) {
      setError(err.message || "Connexion Apple impossible.");
      setLoading(false);
    }
  }

  // Maquette PRO-00 : boutons pleine largeur « Continuer avec … », sous le
  // formulaire et le séparateur « ou » (le séparateur est dans le formulaire).
  if (variant === "stack") {
    return (
      <div className="el-soc">
        <button type="button" disabled={loading} onClick={handleGoogle}>
          <GoogleIcon /> {loading ? "Redirection…" : "Continuer avec Google"}
        </button>
        <button type="button" disabled={loading} onClick={handleApple}>
          <AppleIcon /> {loading ? "Redirection…" : "Continuer avec Apple"}
        </button>
        {error ? <p className="el-error">{error}</p> : null}
      </div>
    );
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
        <button
          type="button"
          className="btn btn-sec"
          style={{ flex: 1 }}
          disabled={loading}
          onClick={handleApple}
        >
          <AppleIcon /> {loading ? "Redirection…" : "Apple"}
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
