"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowser } from "../../../../lib/supabase-browser";

// Page de retour apres le redirect Google (voir SsoOptions dans
// app/login/page.jsx). Supabase a deja echange le code PKCE et pose la
// session dans le stockage local du navigateur des l'arrivee sur cette page
// (detectSessionInUrl: true) — il ne reste qu'a recuperer cette session et
// la transformer en cookies HttpOnly, exactement comme /api/auth/login le
// fait deja pour la connexion email/mot de passe.
//
// Deux profils possibles (30 sept, ?profile=entreprise|particulier dans
// redirectTo) : cote entreprise (Koji Pro), la session Supabase EST la
// session finale (/api/auth/google/finish). Cote particulier (Koji), les
// comptes ne vivent pas dans Supabase Auth — la session Supabase ne sert
// qu'a prouver l'email, /api/auth/google/finish-particulier retrouve ou
// cree le compte dans db.users et pose un jeton de portail a la place.
function GoogleCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const profile = searchParams.get("profile") === "particulier" ? "particulier" : "entreprise";

    async function finish() {
      const supabase = getSupabaseBrowser();
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (cancelled) return;
      if (sessionError || !data.session) {
        setError("Connexion Google impossible. Réessayez depuis la page de connexion.");
        return;
      }
      try {
        const endpoint = profile === "particulier" ? "/api/auth/google/finish-particulier" : "/api/auth/google/finish";
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token
          })
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Connexion impossible.");
        if (profile === "particulier") {
          window.localStorage.setItem("koji-user", JSON.stringify(body.account));
          router.push("/client");
        } else {
          window.localStorage.setItem("koji-user", JSON.stringify(body.user));
          router.push("/");
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Connexion impossible.");
      }
    }

    finish();
    return () => { cancelled = true; };
  }, [router, searchParams]);

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

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={null}>
      <GoogleCallbackContent />
    </Suspense>
  );
}
