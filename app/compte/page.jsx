"use client";

import { useEffect, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiGet } from "../../lib/client-api";
import { useLocale } from "../../lib/i18n";

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
  const { L } = useLocale();
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
          <p className="eyebrow">{L.nav.parametres}</p>
          <h1>{L.auth.myAccount}</h1>
          <p className="muted">{L.auth.accountSub}</p>
        </div>
      </header>

      {!user ? (
        <section className="panel">
          <div className="empty-state">{L.auth.noUser}</div>
        </section>
      ) : (
        <section className="grid cols-2">
          <article className="panel">
            <h2>{L.auth.info}</h2>
            <p className="muted">{L.auth.fullName}: {user.name || "—"}</p>
            <p className="muted">{L.auth.email}: {user.email || "—"}</p>
            <p className="muted">{L.devis.propertyType}: {user.accountType === "particulier" ? L.auth.profilePersonal : L.auth.profileCompany}</p>
          </article>
          <article className="panel">
            <h2>{L.auth.stateTitle}</h2>
            <p className="muted">{L.auth.accountActive}: {user.isActive ? L.common.yes : L.common.no}</p>
            <p className="muted">{L.auth.tradeComplete}: {user.profileComplete ? L.common.yes : L.common.no}</p>
            <p className="muted">{L.auth.businessComplete}: {user.businessInfoComplete ? L.common.yes : L.common.no}</p>
          </article>
        </section>
      )}
    </Shell>
  );
}
