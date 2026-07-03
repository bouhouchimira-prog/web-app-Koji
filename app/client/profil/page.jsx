"use client";

import Link from "next/link";
import { ClientTopbar } from "../../../components/ClientTopbar";
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
  const [company, setCompany] = useState(null);

  useEffect(() => {
    const stored = getStoredUser();
    setUser(stored);
    setPersonal(stored?.personal || {});
    if (stored?.email) {
      const params = new URLSearchParams({ email: stored.email, userId: stored.id || "" });
      fetch(`/api/client/quotes?${params.toString()}`)
        .then((r) => r.json())
        .then((data) => {
          const firstQuote = data.quotes?.[0];
          if (firstQuote?.company) setCompany(firstQuote.company);
        })
        .catch(() => {});
    }
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
      <ClientTopbar showBack backHref="/client" />

      {company?.name ? (
        <div className="ct-profil-company">
          <p className="ct-profil-company-label">Votre entreprise</p>
          {company.logoDataUrl ? <img src={company.logoDataUrl} alt="Logo" className="ct-company-logo" /> : null}
          <strong>{company.name}</strong>
          {company.addressLine1 ? <small>{company.addressLine1}{company.addressLine2 ? `, ${company.addressLine2}` : ""}</small> : null}
          {company.email ? <small>{company.email}</small> : null}
          {company.phone ? <small>{company.phone}</small> : null}
          {company.siret ? <small>SIRET : {company.siret}</small> : null}
        </div>
      ) : null}

      <form className="client-card client-form" onSubmit={saveProfile}>
        <p className="ct-profil-company-label">Mes informations</p>
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
