"use client";

import { useEffect, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiGet } from "../../lib/client-api";

function readLocalUser() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("koji-user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function ComptePage() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const localUser = readLocalUser();
    if (!localUser?.id) return;
    apiGet(`/api/auth/profile?userId=${localUser.id}`)
      .then((payload) => {
        setUser(payload.user || null);
        if (payload.user) {
          window.localStorage.setItem("koji-user", JSON.stringify(payload.user));
        }
      })
      .catch(() => setUser(localUser));
  }, []);

  return (
    <Shell>
      <header className="page-header">
        <div>
          <p className="eyebrow">COMPTE</p>
          <h1>Mon compte</h1>
          <p className="muted">Profil, type de compte et informations de connexion.</p>
        </div>
      </header>

      {!user ? (
        <section className="panel">
          <div className="empty-state">Aucun utilisateur connecte.</div>
        </section>
      ) : (
        <section className="grid cols-2">
          <article className="panel">
            <h2>Informations</h2>
            <p className="muted">Nom: {user.name || "Non renseigne"}</p>
            <p className="muted">E-mail: {user.email || "Non renseigne"}</p>
            <p className="muted">Type: {user.accountType === "particulier" ? "Profil particulier" : "Profil entreprise"}</p>
          </article>
          <article className="panel">
            <h2>Etat</h2>
            <p className="muted">Compte active: {user.isActive ? "Oui" : "Non"}</p>
            <p className="muted">Profil metier complete: {user.profileComplete ? "Oui" : "Non"}</p>
            <p className="muted">Infos entreprise completees: {user.businessInfoComplete ? "Oui" : "Non"}</p>
          </article>
        </section>
      )}
    </Shell>
  );
}
