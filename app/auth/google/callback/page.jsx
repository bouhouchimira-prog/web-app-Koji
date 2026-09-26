"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "../../../../lib/supabase-browser";

// Page de retour apres le redirect Google (voir SsoOptions dans
// app/login/page.jsx). Supabase a deja echange le code PKCE et pose la
// session dans le stockage local du navigateur des l'arrivee sur cette page
// (detectSessionInUrl: true) — il ne reste qu'a recuperer cette session et
// la transformer en cookies HttpOnly, exactement comme /api/auth/login le
// fait deja pour la connexion email/mot de passe.
export default function GoogleCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      const supabase = getSupabaseBrowser();
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (cancelled) return;
      if (sessionError || !data.session) {
        setError("Connexion Google impossible. Réessayez depuis la page de connexion.");
        return;
      }
      try {
        const response = await fetch("/api/auth/google/finish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token
          })
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Connexion impossible.");
        window.localStorage.setItem("koji-user", JSON.stringify(body.user));
        router.push("/");
      } catch (err) {
        if (!cancelled) setError(err.message || "Connexion impossible.");
      }
    }

    finish();
    return () => { cancelled = true; };
  }, [router]);

  return (
    <main className="auth-screen-v2">
      <section className="auth-panel-v2" style={{ width: "100%" }}>
        <div className="auth-card" style={{ textAlign: "center" }}>
          {error ? (
            <>
              <p className="auth-error">{error}</p>
              <a className="auth-link" href="/login">Retour à la connexion</a>
            </>
          ) : (
            <p className="auth-subtitle">Connexion en cours…</p>
          )}
        </div>
      </section>
    </main>
  );
}
