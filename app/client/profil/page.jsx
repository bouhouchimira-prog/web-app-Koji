"use client";

import { ClientTopbar } from "../../../components/ClientTopbar";
import { useEffect, useState } from "react";
import { useLocale } from "../../../lib/i18n";

const FIELD_DEFS = [
  { key: "firstName",  label: "Prénom" },
  { key: "lastName",   label: "Nom" },
  { key: "phone",      label: "Téléphone", hint: "Visible uniquement par l'artisan que vous retenez." },
  { key: "address",    label: "Adresse" },
  { key: "city",       label: "Ville" },
  { key: "postalCode", label: "Code postal" },
];

const PRO_FIELD_DEFS = [
  { key: "raisonSociale", label: "Raison sociale" },
  { key: "siret", label: "SIRET" },
];

const ORG_TYPES = ["Entreprise", "Agence d'architecture", "Maître d'œuvre", "Syndic / bailleur", "Autre"];
const CHANTIERS_PAR_AN = ["1 à 5", "6 à 20", "Plus de 20"];

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

function CheckDot({ done }) {
  return (
    <span className="profile-checklist-dot">
      {done ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
      ) : null}
    </span>
  );
}

export default function ClientProfilePage() {
  const { L } = useLocale();
  const [user, setUser] = useState(null);
  const [personal, setPersonal] = useState({});
  const [profileKind, setProfileKind] = useState("particulier");
  const [pro, setPro] = useState({});
  const [saved, setSaved] = useState(false);
  const [quotes, setQuotes] = useState([]);
  const [offres, setOffres] = useState([]);
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteSent, setDeleteSent] = useState(false);
  const [deleteSending, setDeleteSending] = useState(false);

  useEffect(() => {
    const stored = getStoredUser();
    setUser(stored);
    setPersonal(stored?.personal || {});
    setProfileKind(stored?.profileKind || "particulier");
    setPro(stored?.pro || {});
    if (stored?.email) {
      fetch("/api/client/quotes").then((r) => r.json()).then((data) => setQuotes(data.quotes || [])).catch(() => {});
      fetch("/api/chantier-offres").then((r) => r.json()).then((data) => setOffres(data.offres || [])).catch(() => {});
    }
  }, []);

  async function saveProfile(event) {
    event.preventDefault();
    if (!user?.email) return;
    setError("");
    const response = await fetch("/api/client/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personal,
        profileKind,
        pro: profileKind === "professionnel" ? pro : undefined,
        password: newPassword.trim() || undefined,
        currentPassword: currentPassword.trim() || undefined
      }),
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

  async function submitDelete(event) {
    event.preventDefault();
    setDeleteSending(true);
    try {
      const response = await fetch("/api/account/deletion-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: deleteReason.trim(), accountType: "particulier" })
      });
      if (!response.ok) throw new Error();
      setDeleteSent(true);
      setDeleteReason("");
      window.setTimeout(() => setDeleteOpen(false), 1800);
    } catch {
      setError("Impossible d'envoyer la demande. Réessayez.");
    } finally {
      setDeleteSending(false);
    }
  }

  const initial = (personal.firstName || personal.lastName || user?.email || "?")[0].toUpperCase();
  const fullName = [personal.firstName, personal.lastName].filter(Boolean).join(" ") || user?.email || "";

  const signedQuotes = quotes.filter((q) => q.status === "Signe" || q.signatureStatus === "Signe");
  const checklist = [
    { label: "Compte créé", done: true },
    { label: "Prénom et nom", done: Boolean(personal.firstName && personal.lastName) },
    { label: "Téléphone", done: Boolean(personal.phone) },
    { label: "Adresse", done: Boolean(personal.address && personal.city && personal.postalCode) },
  ];
  const completion = Math.round((checklist.filter((c) => c.done).length / checklist.length) * 100);

  return (
    <main className="client-space">
      <ClientTopbar showBack backHref="/client" />

      <div className="ct-profil-header">
        <div className="ct-profil-avatar">{initial}</div>
        <div className="ct-profil-header-info">
          <strong>{fullName}</strong>
          <span>{user?.email}</span>
        </div>
      </div>

      <div className="fournitures-dashboard-body" style={{ marginTop: 16 }}>
        <form className="fournitures-main-card" onSubmit={saveProfile} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <p className="ct-profil-section-label">Vous êtes</p>
            <div className="account-kind-row">
              <button type="button" className={`account-kind-option${profileKind === "particulier" ? " active" : ""}`} onClick={() => setProfileKind("particulier")}>
                <span className="account-kind-dot">{profileKind === "particulier" ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12.5l4.5 4.5L19 7" /></svg> : null}</span>
                <span>
                  <strong>Particulier</strong>
                  <small>Je veux faire des travaux chez moi.</small>
                </span>
              </button>
              <button type="button" className={`account-kind-option${profileKind === "professionnel" ? " active" : ""}`} onClick={() => setProfileKind("professionnel")}>
                <span className="account-kind-dot">{profileKind === "professionnel" ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12.5l4.5 4.5L19 7" /></svg> : null}</span>
                <span>
                  <strong>Professionnel</strong>
                  <small>Entreprise, agence d'architecture, maître d'œuvre… avec plusieurs chantiers.</small>
                </span>
              </button>
            </div>
          </div>

          <div>
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
              {FIELD_DEFS.map(({ key, label, hint }) => (
                <label key={key}>
                  {label}
                  <input
                    value={personal[key] || ""}
                    onChange={(e) => setPersonal((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                  {hint ? <small className="ct-profil-field-hint">{hint}</small> : null}
                </label>
              ))}
            </div>
          </div>

          {profileKind === "professionnel" ? (
            <div>
              <p className="ct-profil-section-label">Ma structure</p>
              <div className="client-form-grid">
                {PRO_FIELD_DEFS.map(({ key, label }) => (
                  <label key={key}>
                    {label}
                    <input value={pro[key] || ""} onChange={(e) => setPro((prev) => ({ ...prev, [key]: e.target.value }))} />
                  </label>
                ))}
              </div>
              <div style={{ marginTop: 10 }}>
                <small className="ct-profil-field-hint">Type d'organisation</small>
                <div className="fournitures-filter-tabs" style={{ marginTop: 6 }}>
                  {ORG_TYPES.map((type) => (
                    <button type="button" key={type} className={pro.orgType === type ? "active" : ""} onClick={() => setPro((prev) => ({ ...prev, orgType: type }))}>{type}</button>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <small className="ct-profil-field-hint">Chantiers par an</small>
                <div className="fournitures-filter-tabs" style={{ marginTop: 6 }}>
                  {CHANTIERS_PAR_AN.map((range) => (
                    <button type="button" key={range} className={pro.chantiersParAn === range ? "active" : ""} onClick={() => setPro((prev) => ({ ...prev, chantiersParAn: range }))}>{range}</button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div>
            <p className="ct-profil-section-label">Sécurité</p>
            <div className="client-form-grid">
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
            </div>
          </div>

          {error ? <p className="auth-error">{error}</p> : null}
          <div>
            <button className="primary-button" type="submit">{L.clientSpace.saveProfile}</button>
            {saved && <p className="save-feedback">{L.clientSpace.profileSaved}</p>}
          </div>
        </form>

        <div>
          <div className="fournitures-sidebar-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <strong className="title-chip">Profil complété</strong>
              <strong>{completion}%</strong>
            </div>
            <div className="ct-progress-bar"><div style={{ width: `${completion}%` }} /></div>
            <div style={{ marginTop: 10 }}>
              {checklist.map((item) => (
                <div key={item.label} className={`profile-checklist-row${item.done ? "" : " pending"}`}>
                  <CheckDot done={item.done} />
                  {item.label}
                </div>
              ))}
            </div>
          </div>

          <div className="fournitures-sidebar-card">
            <strong className="title-chip">Mes projets</strong>
            <div className="mini-stat-grid" style={{ marginTop: 10 }}>
              <div className="mini-stat-box">
                <small>Offres publiées</small>
                <strong>{offres.length}</strong>
              </div>
              <div className="mini-stat-box">
                <small>Devis signés</small>
                <strong>{signedQuotes.length}</strong>
              </div>
            </div>
          </div>

          <div className="danger-card">
            <strong>Supprimer mon compte</strong>
            <p>Votre profil, vos offres et vos échanges seront supprimés définitivement. Cette action est irréversible.</p>
            <button type="button" className="button secondary profile-link-button" onClick={() => { setDeleteOpen(true); setDeleteSent(false); }}>Supprimer mon compte</button>
          </div>
        </div>
      </div>

      {deleteOpen ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setDeleteOpen(false)}>
          <div className="mini-modal" onClick={(event) => event.stopPropagation()}>
            <h2>Supprimer mon compte</h2>
            <p className="muted">Décrivez brièvement la raison (optionnel) — votre demande sera traitée par notre équipe.</p>
            <form onSubmit={submitDelete} className="settings-report-form">
              <textarea rows={3} className="profile-textarea" value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} autoFocus />
              {deleteSent ? <p className="profile-message">Demande envoyée.</p> : null}
              <div>
                <button type="button" onClick={() => setDeleteOpen(false)}>Annuler</button>
                <button type="submit" disabled={deleteSending}>Envoyer</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
