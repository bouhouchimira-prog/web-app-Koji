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

function EyeIcon({ open }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export default function ClientProfilePage() {
  const { L } = useLocale();
  const [user, setUser] = useState(null);
  const [personal, setPersonal] = useState({});
  const [saved, setSaved] = useState(false);
  const [company, setCompany] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

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
    setError("");
    const response = await fetch("/api/client/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personal, password: newPassword.trim() || undefined, currentPassword: currentPassword.trim() || undefined }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Impossible d'enregistrer.");
      return;
    }
    if (data.user) {
      localStorage.setItem("koji-user", JSON.stringify(data.user));
      setUser(data.user);
      setNewPassword("");
      setCurrentPassword("");
      setShowPassword(false);
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

      <form className="client-profile-form client-form" onSubmit={saveProfile}>
        <p className="ct-profil-section-label">{L.clientSpace.myInfo}</p>

        <div className="client-form-grid">
          <label>
            {L.clientSpace.identifierLabel}
            <input value={user?.portalIdentifier || ""} disabled />
          </label>
          <label>
            {L.clientSpace.emailLabel}
            <input value={user?.email || ""} disabled />
          </label>
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

        <label>
          Mot de passe actuel
          <div className="auth-input-wrap">
            <input
              type={showPassword ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => { setCurrentPassword(e.target.value); setError(""); }}
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </div>
          <small className="ct-profil-field-hint">Nécessaire uniquement pour changer de mot de passe.</small>
        </label>

        <label>
          {L.clientSpace.newPasswordLabel}
          <div className="auth-input-wrap">
            <input
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setError(""); }}
              autoComplete="new-password"
              placeholder="••••••••"
            />
            <button type="button" className="auth-eye-btn" onClick={() => setShowPassword((v) => !v)} aria-label={L.auth.showHide}>
              <EyeIcon open={showPassword} />
            </button>
          </div>
          <small className="ct-profil-field-hint">{L.clientSpace.newPasswordHint}</small>
        </label>

        {error ? <p className="auth-error">{error}</p> : null}
        <button className="primary-button" type="submit">{L.clientSpace.saveProfile}</button>
        {saved && <p className="save-feedback">{L.clientSpace.profileSaved}</p>}
      </form>
    </main>
  );
}
