"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const fields = [
  ["firstName", "Prenom"],
  ["lastName", "Nom"],
  ["phone", "Telephone"],
  ["address", "Adresse"],
  ["city", "Ville"],
  ["postalCode", "Code postal"],
];

function getStoredUser() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem("koji-user") || "null");
  } catch {
    return null;
  }
}

export default function ClientProfilePage() {
  const [user, setUser] = useState(null);
  const [personal, setPersonal] = useState({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = getStoredUser();
    setUser(stored);
    setPersonal(stored?.personal || {});
  }, []);

  async function saveProfile(event) {
    event.preventDefault();
    if (!user?.email) return;
    const response = await fetch("/api/client/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, email: user.email, personal }),
    });
    const data = await response.json();
    if (data.user) {
      localStorage.setItem("koji-user", JSON.stringify(data.user));
      setUser(data.user);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    }
  }

  return (
    <main className="client-space">
      <header className="client-topbar compact-topbar">
        <Link className="icon-button" href="/client"><span aria-hidden="true">&lt;</span></Link>
        <div>
          <p className="eyebrow">Profil particulier</p>
          <h1>Mes informations</h1>
        </div>
      </header>

      <form className="client-card client-form" onSubmit={saveProfile}>
        <label>
          Adresse e-mail
          <input value={user?.email || ""} disabled />
        </label>
        <div className="client-form-grid">
          {fields.map(([key, label]) => (
            <label key={key}>
              {label}
              <input value={personal[key] || ""} onChange={(event) => setPersonal((current) => ({ ...current, [key]: event.target.value }))} />
            </label>
          ))}
        </div>
        <button className="primary-button" type="submit">Enregistrer</button>
        {saved ? <p className="save-feedback">Profil particulier enregistre.</p> : null}
      </form>
    </main>
  );
}
