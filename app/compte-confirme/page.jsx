"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthBrandPanel } from "../../components/AuthBrandPanel";
import { NOM_APP, appDepuisJeton } from "../../lib/reset-app";

// Lien « Confirmez votre adresse » envoyé par Supabase à la création d'un
// compte dans une app (14 nov 2026). Supabase a déjà confirmé l'adresse en
// ouvrant le lien et renvoie ici avec la session dans l'URL (#access_token…,
// via le script de app/layout.jsx). On le dit, et on renvoie vers l'app :
// c'est là que la personne se connecte. Rien n'est enregistré sur le site.
export default function CompteConfirmePage() {
  const [etat, setEtat] = useState({ pret: false, confirme: false, app: null });

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const jeton = params.get("access_token");
    setEtat({ pret: true, confirme: Boolean(jeton), app: jeton ? appDepuisJeton(jeton) : null });
    // La session n'a rien à faire dans la barre d'adresse ni l'historique.
    if (jeton) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  if (!etat.pret) return null;

  const app = etat.app || "pro";
  const profil = app === "koji" ? "particulier" : "entreprise";

  return (
    <main className={`auth-screen${profil === "entreprise" ? " auth-pro" : ""}`}>
      <AuthBrandPanel profile={profil} />
      <section className="auth-panel">
        {etat.confirme ? (
          <>
            <h2>Adresse confirmée</h2>
            <p style={{ color: "#0f8e4c", fontWeight: 400 }}>
              Votre compte est activé. Retournez dans l'app <b>{NOM_APP[app]}</b> et connectez-vous avec votre adresse e-mail et votre mot de passe.
            </p>
            <p className="muted">Vous pouvez fermer cette page.</p>
          </>
        ) : (
          <>
            <h2>Ce lien ne fonctionne plus</h2>
            <p className="muted">
              Il a peut-être déjà servi ou a expiré. Essayez de vous connecter dans l'app : si l'adresse est déjà confirmée, ça marchera.
            </p>
          </>
        )}
        {profil === "entreprise" ? (
          <p className="muted" style={{ marginTop: 22 }}>
            Sur ordinateur ? <Link className="auth-link" href="/login?type=entreprise">Se connecter au site Koji Pro</Link>
          </p>
        ) : null}
      </section>
    </main>
  );
}
