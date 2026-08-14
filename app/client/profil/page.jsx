"use client";

import { ClientTopbar } from "../../../components/ClientTopbar";
import { useEffect, useState } from "react";
import { useLocale } from "../../../lib/i18n";

const FIELD_DEFS = [
  { key: "firstName",  label: "Prénom" },
  { key: "lastName",   label: "Nom" },
  { key: "phone",      label: "Téléphone" },
  { key: "address",    label: "Adresse" },
  { key: "city",       label: "Ville" },
  { key: "postalCode", label: "Code postal" },
];

function getStoredUser() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("koji-user") || "null"); } catch { return null; }
}

export default function ClientProfilePage() {
  const { L } = useLocale();
  const [user, setUser] = useState(null);
  const [personal, setPersonal] = useState({});
  const [saved, setSaved] = useState(false);
  const [company, setCompany] = useState(null);

  useEffect(() => {
    const stored = getStoredUser();
    setUser(stored);
    setPersonal(stored?.personal || {});
    if (stored?.email) {
      fetch("/api/client/quotes")
        .then((r) => r.json())
        .then((data) => { const firstQuote = data.quotes?.[0]; if (firstQuote?.company) setCompany(firstQuote.company); })
        .catch(() => {});
    }
  }, []);

  async function saveProfile(event) {
    event.preventDefault();
    if (!user?.email) return;
    const response = await fetch("/api/client/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personal }),
    });
    const data = await response.json();
    if (data.user) {
      localStorage.setItem("koji-user", JSON.stringify(data.user));
      setUser(data.user);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    }
  }

  const initial = (personal.firstName || personal.lastName || user?.email || "?")[0].toUpperCase();
  const fullName = [personal.firstName, personal.lastName].filter(Boolean).join(" ") || user?.email || "";

  return (
    <main className="client-space">
      <ClientTopbar showBack backHref="/client" />

      <div className="ct-profil-header">
        <div className="ct-profil-avatar">{initial}</div>
        <div className="ct-profil-header-info">
          <strong>{fullName}</strong>
          {company?.name && <span>{company.name}</span>}
        </div>
      </div>

      <form className="client-card client-form" onSubmit={saveProfile}>
        <p className="ct-profil-section-label">{L.clientSpace.myInfo}</p>

        <label>
          {L.clientSpace.emailLabel}
          <input value={user?.email || ""} disabled />
        </label>

        <div className="client-form-grid">
          {FIELD_DEFS.map(({ key, label }) => (
            <label key={key}>
              {label}
              <input
                value={personal[key] || ""}
                onChange={(e) => setPersonal((prev) => ({ ...prev, [key]: e.target.value }))}
              />
            </label>
          ))}
        </div>

        <button className="primary-button" type="submit">{L.clientSpace.saveProfile}</button>
        {saved && <p className="save-feedback">{L.clientSpace.profileSaved}</p>}
      </form>
    </main>
  );
}
