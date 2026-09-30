"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ClientTopbar } from "../../../components/ClientTopbar";
import "../client-home.css";
import { ChevronRight, Svg } from "../demandes-ui";

// Profil du particulier (refonte UX, septembre 2026). Même logique qu'avant
// (PATCH /api/client/profile, GET /api/client/quotes) ; seul l'affichage
// change. Les champs sont regroupés : identité, coordonnées, mot de passe.

function getStoredUser() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("koji-user") || "null"); } catch { return null; }
}

function EyeIcon({ open }) {
  return open ? (
    <Svg size={18}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></Svg>
  ) : (
    <Svg size={18}>
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </Svg>
  );
}

const IconLock = () => <Svg size={15}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></Svg>;

export default function ClientProfilePage() {
  const [user, setUser] = useState(null);
  const [personal, setPersonal] = useState({});
  const [saved, setSaved] = useState(false);
  const [company, setCompany] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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
    setSaving(true);
    try {
      const response = await fetch("/api/client/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personal, password: newPassword.trim() || undefined }),
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
        setShowPassword(false);
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1800);
      }
    } catch {
      setError("Impossible d'enregistrer.");
    } finally {
      setSaving(false);
    }
  }

  function champ(key, label, autre = {}) {
    return (
      <label className="kc-field">
        <span>{label}</span>
        <input
          value={personal[key] || ""}
          onChange={(e) => setPersonal((prev) => ({ ...prev, [key]: e.target.value }))}
          {...autre}
        />
      </label>
    );
  }

  const initial = (personal.firstName || personal.lastName || user?.email || "?")[0].toUpperCase();
  const fullName = [personal.firstName, personal.lastName].filter(Boolean).join(" ") || user?.name || user?.email || "";

  return (
    <main className="client-space">
      <ClientTopbar showBack backHref="/client" />

      <div className="kc">
        <section className="kc-profile-head">
          <span className="kc-avatar kc-avatar-lg">{initial}</span>
          <span className="kc-artisan-text">
            <strong>{fullName}</strong>
            <small>{company?.name ? `Client de ${company.name}` : user?.email || ""}</small>
          </span>
        </section>

        <form className="kc-form" onSubmit={saveProfile}>
          <section className="kc-block">
            <div className="kc-block-head"><h2 className="kc-block-title">Identité</h2></div>
            <div className="kc-grid">
              {champ("firstName", "Prénom", { autoComplete: "given-name" })}
              {champ("lastName", "Nom", { autoComplete: "family-name" })}
            </div>
          </section>

          <section className="kc-block">
            <div className="kc-block-head"><h2 className="kc-block-title">Coordonnées</h2></div>
            <p className="kc-form-note"><IconLock /> Visibles par vous seul : les artisans ne les voient jamais.</p>
            <div className="kc-grid">
              <label className="kc-field">
                <span>E-mail</span>
                <input value={user?.email || ""} disabled />
              </label>
              {champ("phone", "Téléphone", { type: "tel", autoComplete: "tel" })}
              <div className="kc-grid-full">{champ("address", "Adresse", { autoComplete: "street-address" })}</div>
              {champ("postalCode", "Code postal", { autoComplete: "postal-code", inputMode: "numeric" })}
              {champ("city", "Ville", { autoComplete: "address-level2" })}
            </div>
          </section>

          <section className="kc-block">
            <div className="kc-block-head"><h2 className="kc-block-title">Connexion</h2></div>
            <div className="kc-grid">
              <label className="kc-field">
                <span>Identifiant</span>
                <input value={user?.portalIdentifier || ""} disabled />
              </label>
              <label className="kc-field">
                <span>Nouveau mot de passe</span>
                <span className="kc-password">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setError(""); }}
                    autoComplete="new-password"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label="Afficher ou masquer">
                    <EyeIcon open={showPassword} />
                  </button>
                </span>
                <small>Laissez vide pour ne pas changer votre mot de passe.</small>
              </label>
            </div>
          </section>

          {error ? <p className="kc-error">{error}</p> : null}
          {saved ? <p className="kc-success">✓ Profil enregistré.</p> : null}

          <button className="kc-btn kc-btn-navy kc-btn-block" type="submit" disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </form>

        <Link href="/client/parametres" className="kc-link-row">
          <span>Paramètres (langue, apparence, aide)</span>
          <ChevronRight />
        </Link>
      </div>
    </main>
  );
}
