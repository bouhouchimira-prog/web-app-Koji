"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AddressFields } from "../../components/AddressFields";
import { Shell } from "../../components/Shell";
import { apiGet, apiSend } from "../../lib/client-api";
import { useLocale } from "../../lib/i18n";

const professionsList = ["Electricien", "Plombier", "Carreleur", "Menuisier", "Peintre", "Tout corps d'etat"];

const initialBusiness = {
  raisonSociale: "",
  formeJuridique: "",
  siret: "",
  siren: "",
  emailPro: "",
  phone: "",
  website: "",
  qrCodeDataUrl: "",
  addressLine1: "",
  addressLine2: "",
  postalCode: "",
  city: "",
  floor: "",
  accessCode: "",
  accessInstructions: "",
  tva: "",
  defaultVatRate: 20,
  dailyRate: 0,
  hoursPerDay: 7,
  logoDataUrl: "",
  iban: "",
  bic: "",
  bankHolder: "",
  paymentTerms: "",
  zoneAddress: "",
  zoneLat: null,
  zoneLon: null,
  zoneRadiusKm: 20,
  // Documents d'entreprise (15 oct, tableau de bord Profil) — stockes dans
  // le meme objet business_info libre que le reste (voir
  // app/api/auth/profile/route.js, Object.assign sans whitelist), aucune
  // nouvelle colonne necessaire.
  documents: {
    decennale: { fileDataUrl: "", expiryDate: "" },
    urssaf: { fileDataUrl: "", updatedDate: "" },
    kbis: { fileDataUrl: "" }
  }
};

const DOCUMENT_META = {
  decennale: { label: "Assurance décennale" },
  urssaf: { label: "Attestation URSSAF" },
  kbis: { label: "Extrait Kbis" }
};

function readLocalUser() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("koji-user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Gratuit pour les admins, sinon reserve a l'option payante "Site web Koji"
// — meme condition que hasWebsiteAccess cote serveur (app/api/site/route.js).
// Utilise seulement pour le libelle de la carte "Site web" ci-dessous (la
// page /profil/site-web gere elle-meme le blocage reel cote donnees).
function hasWebsiteAccess(user) {
  return Boolean(user?.addonWebsite || user?.isAdmin);
}

function icon(name) {
  switch (name) {
    case "building":
      return "M3 20h18M5 20V6h6v14M11 20V3h8v17M14 7h2M14 11h2M14 15h2M7 10h2M7 14h2";
    case "gavel":
      return "M3 21h8M6 18l7-7M10 7l4 4M8 9l4 4M14 3l7 7";
    case "id":
      return "M4 20V7l2-3h12l2 3v13zM8 11h8M8 15h5M8 7h3";
    case "mail":
      return "M4 6h16v12H4zM4 8l8 6 8-6";
    case "phone":
      return "M6 3l4 2-1 3 2 2 2 2 3-1 2 4-3 2c-6 0-12-6-12-12z";
    case "pin":
      return "M12 21c4-5 6-8 6-11a6 6 0 10-12 0c0 3 2 6 6 11zM12 11a2 2 0 100-4 2 2 0 000 4z";
    case "tag":
      return "M20 12l-8 8-8-8V4h8zM9 8a1.5 1.5 0 110-3 1.5 1.5 0 010 3z";
    case "money":
      return "M3 8h18M3 16h18M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z";
    case "clock":
      return "M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2";
    case "camera":
      return "M4 8h4l2-2h4l2 2h4v10H4zM12 16a3 3 0 100-6 3 3 0 000 6z";
    case "bank":
      return "M3 21h18M3 10h18M5 10V21M19 10V21M12 3L3 10h18L12 3z";
    case "text":
      return "M4 6h16M4 10h16M4 14h10M4 18h6";
    case "pen":
      return "M3 21l4-1 11-11-3-3L4 17l-1 4zM14 6l3 3";
    case "globe":
      return "M12 22a10 10 0 100-20 10 10 0 000 20zM2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20";
    default:
      return "";
  }
}

function Field({ label, iconName, value, onChange, placeholder = "", type = "text", disabled = false, hint = "" }) {
  return (
    <label className="profile-field">
      <span>{label}</span>
      <div className="profile-input">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={icon(iconName)} /></svg>
        <input type={type} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} />
      </div>
      {hint ? <small className="muted">{hint}</small> : null}
    </label>
  );
}

// Champ simple (sans icone, fond plein) — carte "Informations de
// l'entreprise" / "Tarification" du tableau de bord Profil (15 oct,
// maquette fournie par Amira), distinct du composant Field ci-dessus
// (garde ses icones ailleurs sur la page, pas demande sur cette partie).
function PlainField({ label, value, onChange, placeholder = "", type = "text", disabled = false }) {
  return (
    <label className="profile-plain-field">
      <span>{label}</span>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} />
    </label>
  );
}

function initials(name = "") {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "KO";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function ProfilPage() {
  const { L } = useLocale();
  const fileRef = useRef(null);
  const qrFileRef = useRef(null);
  const [user, setUser] = useState(null);
  const [business, setBusiness] = useState(initialBusiness);
  const [professions, setProfessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [zoneTouched, setZoneTouched] = useState(false);
  const [zoneSuggestions, setZoneSuggestions] = useState([]);

  useEffect(() => {
    const localUser = readLocalUser();
    const query = localUser?.id ? `/api/auth/profile?userId=${localUser.id}` : "/api/auth/profile";
    apiGet(query)
      .then((payload) => {
        const fetchedUser = payload.user || localUser || { accountType: "entreprise" };
        setUser(fetchedUser);
        setBusiness({ ...initialBusiness, ...(fetchedUser.business || {}) });
        setProfessions(Array.isArray(fetchedUser.professions) ? fetchedUser.professions : []);
      })
      .catch(() => {
        const fallback = localUser || { accountType: "entreprise" };
        setUser(fallback);
        setBusiness(initialBusiness);
        setProfessions([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const websiteAccess = hasWebsiteAccess(user);

  // Juste de quoi afficher la carte "Site web" (slug + statut publie) sur ce
  // tableau de bord — l'editeur complet (photos, description...) vit sur
  // /profil/site-web, qui refait son propre GET /api/site.
  const [siteSummary, setSiteSummary] = useState(null);
  useEffect(() => {
    if (!websiteAccess) return;
    let alive = true;
    apiGet("/api/site").then((payload) => { if (alive) setSiteSummary(payload.site); }).catch(() => {});
    return () => { alive = false; };
  }, [websiteAccess]);
  const sitePublished = Boolean(siteSummary?.published);
  const siteUrlLabel = siteSummary?.slug && typeof window !== "undefined" ? `${window.location.host}/site/${siteSummary.slug}` : "";

  function setField(field, value) {
    setBusiness((current) => ({ ...current, [field]: value }));
  }

  // Autocompletion d'adresse pour la zone de travail (matching geographique
  // Radar des Chantiers, cahier des charges 3.2/4.3) — meme API BAN gratuite
  // que le parcours de publication d'offre cote particulier.
  useEffect(() => {
    if (!zoneTouched) return;
    const query = (business.zoneAddress || "").trim();
    if (query.length < 3) { setZoneSuggestions([]); return; }
    const handle = setTimeout(() => {
      fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5`)
        .then((r) => r.json())
        .then((data) => setZoneSuggestions(data.features || []))
        .catch(() => setZoneSuggestions([]));
    }, 350);
    return () => clearTimeout(handle);
  }, [business.zoneAddress, zoneTouched]);

  function onZoneAddressChange(value) {
    setBusiness((current) => ({ ...current, zoneAddress: value, zoneLat: null, zoneLon: null }));
    setZoneTouched(true);
  }

  function selectZoneAddress(feature) {
    const [lon, lat] = feature.geometry.coordinates;
    setBusiness((current) => ({ ...current, zoneAddress: feature.properties.label, zoneLat: lat, zoneLon: lon }));
    setZoneTouched(false);
    setZoneSuggestions([]);
  }

  function toggleProfession(value) {
    setProfessions((current) => (
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    ));
  }

  function onLogoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setField("logoDataUrl", String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  function onQrCodeChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setField("qrCodeDataUrl", String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  function setDocumentField(docKey, field, value) {
    setBusiness((current) => ({
      ...current,
      documents: { ...current.documents, [docKey]: { ...current.documents?.[docKey], [field]: value } }
    }));
  }

  function onDocumentFileChange(docKey, event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDocumentField(docKey, "fileDataUrl", String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  function documentStatus(docKey) {
    const doc = business.documents?.[docKey] || {};
    if (!doc.fileDataUrl) return { label: "À ajouter", tone: "warning" };
    if (docKey === "decennale") {
      if (!doc.expiryDate) return { label: "Valide", tone: "ok" };
      const expiry = new Date(`${doc.expiryDate}T00:00:00`);
      if (expiry < new Date()) return { label: "Expirée", tone: "danger" };
      return { label: "Valide", tone: "ok" };
    }
    return { label: "Valide", tone: "ok" };
  }

  const hourlyCost = useMemo(() => {
    const rate = Number(business.dailyRate || 0);
    const hours = Number(business.hoursPerDay || 0);
    if (!hours) return 0;
    return rate / hours;
  }, [business.dailyRate, business.hoursPerDay]);

  // Completude (15 oct) : part des champs/documents cles reellement remplis
  // — rien d'invente, chaque item compte pour 1/N et le premier manquant
  // devient le message "Ajoutez votre X pour atteindre 100%".
  const completude = useMemo(() => {
    const items = [
      { key: "raisonSociale", label: "votre raison sociale", done: Boolean(business.raisonSociale) },
      { key: "siret", label: "votre SIRET", done: Boolean(business.siret) },
      { key: "addressLine1", label: "votre adresse", done: Boolean(business.addressLine1) },
      { key: "emailPro", label: "votre e-mail professionnel", done: Boolean(business.emailPro) },
      { key: "phone", label: "votre téléphone", done: Boolean(business.phone) },
      { key: "logo", label: "votre logo", done: Boolean(business.logoDataUrl) },
      { key: "metiers", label: "au moins un métier", done: professions.length > 0 },
      { key: "decennale", label: "votre assurance décennale", done: Boolean(business.documents?.decennale?.fileDataUrl) },
      { key: "urssaf", label: "votre attestation URSSAF", done: Boolean(business.documents?.urssaf?.fileDataUrl) },
      { key: "kbis", label: "votre Kbis", done: Boolean(business.documents?.kbis?.fileDataUrl) }
    ];
    const doneCount = items.filter((item) => item.done).length;
    const pct = Math.round((doneCount / items.length) * 100);
    const missing = items.find((item) => !item.done);
    return { pct, missing };
  }, [business, professions]);

  const memberSince = useMemo(() => {
    if (!user?.createdAt) return "";
    const date = new Date(user.createdAt);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  }, [user]);

  async function onSave(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const localUser = readLocalUser();
      const payload = {
        userId: user?.id || localUser?.id,
        name: user?.name || localUser?.name || "Utilisateur Koji",
        email: user?.email || localUser?.email || "",
        accountType: user?.accountType || localUser?.accountType || "entreprise",
        business: {
          ...business,
          dailyRate: Number(business.dailyRate || 0),
          hoursPerDay: Number(business.hoursPerDay || 0)
        },
        professions
      };
      const response = await apiSend("/api/auth/profile", payload, "PATCH");
      setUser(response.user);
      window.localStorage.setItem("koji-user", JSON.stringify(response.user));
      setMessage("Informations enregistrees.");
    } catch (error) {
      setMessage(error.message || "Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    setPasswordMessage("");
    if (newPassword.length < 8) { setPasswordMessage("Le nouveau mot de passe doit contenir au moins 8 caractères."); return; }
    if (newPassword !== confirmNewPassword) { setPasswordMessage("Les deux mots de passe ne correspondent pas."); return; }
    setPasswordSaving(true);
    try {
      await apiSend("/api/auth/change-password", { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setPasswordMessage("Mot de passe modifié avec succès.");
    } catch (error) {
      setPasswordMessage(error.message || "Impossible de changer le mot de passe.");
    } finally {
      setPasswordSaving(false);
    }
  }

  const accountLabel = user?.accountType === "particulier" ? L.auth.profilePersonal : L.auth.profileCompany;
  const logoSrc = business.logoDataUrl || "/koji-logo.svg";

  if (loading) {
    return (
      <Shell>
        <section className="panel"><div className="empty-state">{L.common.loading}</div></section>
      </Shell>
    );
  }

  return (
    <Shell>
      <form className="profile-layout" onSubmit={onSave}>
        <input ref={fileRef} type="file" accept="image/*" onChange={onLogoChange} style={{ display: "none" }} />

        <header className="fournitures-dashboard-head">
          <div>
            <h1><span className="title-chip">{accountLabel}</span></h1>
            <p>Les informations de votre entreprise, reprises sur vos devis et factures.</p>
          </div>
          <div className="fournitures-dashboard-head-actions">
            <Link href="/profil/carte-de-visite" className="button secondary">Aperçu client</Link>
            <button className="button blue" disabled={saving}>{saving ? L.parametres.saving : L.parametres.save}</button>
          </div>
        </header>

        <div className="fournitures-kpi-row">
          <div className="fournitures-kpi-card">
            <div className="fournitures-kpi-card-head">
              <span className="fournitures-kpi-icon fournitures-kpi-icon-green">✅</span>
              <span className="title-chip">Complétude</span>
            </div>
            <strong>{completude.pct} %</strong>
            <small className={completude.pct < 100 ? "warning" : "positive"}>
              {completude.missing ? `${completude.missing.label} manquant` : "profil complet"}
            </small>
          </div>
          <div className="fournitures-kpi-card">
            <div className="fournitures-kpi-card-head">
              <span className="fournitures-kpi-icon fournitures-kpi-icon-blue">🕐</span>
              <span className="title-chip">Taux horaire</span>
            </div>
            <strong>{hourlyCost.toFixed(0)} <small style={{ display: "inline", marginTop: 0 }}>€/h</small></strong>
            <small>utilisé pour vos prix</small>
          </div>
          <div className="fournitures-kpi-card">
            <div className="fournitures-kpi-card-head">
              <span className="fournitures-kpi-icon fournitures-kpi-icon-green">🛡️</span>
              <span className="title-chip">Décennale</span>
            </div>
            <strong>{documentStatus("decennale").label}</strong>
            <small className={documentStatus("decennale").tone === "danger" ? "warning" : ""}>
              {business.documents?.decennale?.expiryDate ? `jusqu'au ${new Date(business.documents.decennale.expiryDate).toLocaleDateString("fr-FR")}` : "aucune date renseignée"}
            </small>
          </div>
          <div className="fournitures-kpi-card">
            <div className="fournitures-kpi-card-head">
              <span className="fournitures-kpi-icon fournitures-kpi-icon-purple">⭐</span>
              <span className="title-chip">Membre koji</span>
            </div>
            <strong>{memberSince || "—"}</strong>
            <small>date d'inscription</small>
          </div>
        </div>

        <div className="fournitures-dashboard-body">
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="fournitures-main-card">
              <div className="profile-card-identity">
                <div className="logo-ring logo-ring-plain">
                  {business.logoDataUrl ? <img src={business.logoDataUrl} alt="Logo entreprise" /> : <strong>{initials(business.raisonSociale || user?.name)}</strong>}
                </div>
                <div className="profile-card-identity-main">
                  <strong>{business.raisonSociale || user?.name || "Votre entreprise"}</strong>
                  <small>{professions.join(" · ") || "Aucun métier renseigné"}</small>
                </div>
                <button type="button" className="button secondary" onClick={() => fileRef.current?.click()}>{L.parametres.changeLogo}</button>
              </div>

              <h2 className="profile-section-title">{L.parametres.company}</h2>
              <div className="profile-grid cols-2">
                <PlainField label={L.parametres.raisonSociale} value={business.raisonSociale} onChange={(event) => setField("raisonSociale", event.target.value)} placeholder={L.parametres.raisonSociale} />
                <PlainField label={L.parametres.siret} value={business.siret} onChange={(event) => setField("siret", event.target.value)} placeholder="12345678901234" />
              </div>
              <div className="profile-grid cols-2">
                <PlainField label="Adresse" value={business.addressLine1} onChange={(event) => setField("addressLine1", event.target.value)} placeholder="Rue, ville..." />
                <label className="profile-plain-field">
                  <span>Zone d'intervention</span>
                  <input
                    type="text"
                    value={business.zoneAddress || ""}
                    onChange={(event) => onZoneAddressChange(event.target.value)}
                    placeholder="Adresse, ville..."
                    autoComplete="off"
                  />
                  {zoneSuggestions.length > 0 ? (
                    <ul className="radar-address-suggestions">
                      {zoneSuggestions.map((feature) => (
                        <li key={feature.properties.id}>
                          <button type="button" onClick={() => selectZoneAddress(feature)}>{feature.properties.label}</button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </label>
              </div>
              <div className="profile-grid cols-2">
                <PlainField label={L.parametres.emailPro} type="email" value={business.emailPro} onChange={(event) => setField("emailPro", event.target.value)} placeholder="pro@entreprise.fr" />
                <PlainField label={L.parametres.phone} value={business.phone} onChange={(event) => setField("phone", event.target.value)} placeholder="+33..." />
              </div>

              <h2 className="profile-section-title">{L.parametres.pricing}</h2>
              <div className="profile-grid cols-3">
                <PlainField label="Taux horaire" type="number" value={hourlyCost.toFixed(2)} disabled />
                <PlainField label={L.parametres.dailyRate} type="number" value={String(business.dailyRate ?? 0)} onChange={(event) => setField("dailyRate", event.target.value)} />
                <PlainField label="TVA par défaut (%)" type="number" value={String(business.defaultVatRate ?? 20)} onChange={(event) => setField("defaultVatRate", event.target.value)} placeholder="20" />
              </div>
            </div>

            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <Link
                href="/profil/carte-de-visite"
                style={{
                  flex: "1 1 0", minWidth: 260, background: "#FFFFFF", border: "1px solid #EDEFF3", borderRadius: 18,
                  padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12, textDecoration: "none", color: "inherit"
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div style={{ width: 128, height: 80 }}>
                    <div style={{ transform: "scale(.82)", transformOrigin: "0 0" }}>
                      <div style={{ position: "relative", width: 156, height: 98 }}>
                        <div style={{
                          position: "absolute", left: 8, top: 18, width: 104, height: 66, borderRadius: 9, background: "#FBF9F5",
                          border: "1px solid #E6E1D6", transform: "rotate(-6deg)", boxShadow: "0 6px 14px rgba(22,35,63,.14)", overflow: "hidden"
                        }}>
                          <div style={{ height: 4, background: "linear-gradient(90deg,#E6B94F,#CB9A2E)" }} />
                          <div style={{ position: "absolute", left: 8, top: 11, width: 16, height: 16, borderRadius: 5, border: "1px dashed #CFC7B6", background: "#F3EFE6" }} />
                          <div style={{ position: "absolute", left: 8, top: 33, width: 50, height: 7, borderRadius: 2, background: "#16233F" }} />
                          <div style={{ position: "absolute", left: 8, top: 44, width: 22, height: 2, background: "#CB9A2E" }} />
                          <div style={{ position: "absolute", left: 8, top: 51, width: 36, height: 3, borderRadius: 2, background: "#C9CEDB" }} />
                          <div style={{ position: "absolute", left: 8, top: 57, width: 44, height: 3, borderRadius: 2, background: "#C9CEDB" }} />
                          <div style={{ position: "absolute", right: 7, bottom: 6, width: 20, height: 20, borderRadius: 3, background: "repeating-conic-gradient(#16233F 0 25%,#FFFFFF 0 50%) 0 0/6px 6px" }} />
                        </div>
                        <div style={{
                          position: "absolute", left: 42, top: 10, width: 104, height: 66, borderRadius: 9,
                          background: "radial-gradient(120% 90% at 50% 0%,#1D2F57,#0B1530 70%)", transform: "rotate(5deg)",
                          boxShadow: "0 8px 18px rgba(22,35,63,.28)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4
                        }}>
                          <svg width="22" height="22" viewBox="0 0 57 57" aria-hidden="true"><path d="M55.5 2.8L54.7 2.2L42.3 2.2L41.4 2.6L36.8 2.5L35.5 2.8L34.2 4.1L33.3 5.4L31.3 7.3L30.8 8.2L24.4 14.6L23.8 15.5L22.1 17.2L21.2 18.6L19.3 20.3L18.8 21.2L11.2 28.9L10.4 29.2L9.8 28.4L9.8 3.2L9.2 2.5L2.5 2.6L2.0 3.6L2.0 49.5L2.2 49.8L2.7 49.9L5.6 46.5L7.6 44.6L8.1 43.8L15.5 36.3L16.1 35.4L18.7 32.8L19.6 31.5L21.6 29.6L22.1 28.8L28.5 22.3L29.1 21.4L31.7 18.8L32.6 17.5L34.6 15.6L35.1 14.8L38.8 11.1L40.5 10.3L46.3 10.3L47.1 11.1L47.6 12.5L47.6 39.4L46.9 41.9L45.9 43.8L43.5 45.8L41.0 46.8L38.7 47.1L36.7 46.7L34.7 45.8L33.3 44.4L32.5 43.9L24.6 35.1L24.0 35.2L20.3 39.3L19.6 40.4L19.5 41.2L21.3 43.6L23.8 46.1L24.2 46.8L26.8 49.4L27.4 50.3L29.3 51.8L30.2 52.2L31.5 53.3L32.2 53.3L34.5 54.3L35.8 54.4L36.9 54.8L40.3 54.9L42.4 54.7L43.4 54.1L45.0 53.9L49.3 51.5L52.7 48.1L53.0 47.0L54.8 43.9L55.4 41.1L55.3 39.5L55.7 38.6L55.7 3.2Z" fill="#E8DCCB" fillRule="evenodd" /></svg>
                          <div style={{ width: 30, height: 3, borderRadius: 2, background: "rgba(255,255,255,.5)" }} />
                        </div>
                      </div>
                    </div>
                  </div>
                  <span style={{ flex: "0 0 auto", width: 36, height: 36, borderRadius: "50%", background: "#16233F", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#16233F" }}>{L.parametres.businessCard}</div>
                  <div style={{ fontSize: 12.5, color: "#6B7280", lineHeight: 1.45 }}>{L.parametres.businessCardSub}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, padding: "4px 10px", borderRadius: 10, background: "#E6F5EE", color: "#1E8E5A" }}>Prête à imprimer</span>
                </div>
              </Link>

              <Link
                href="/profil/site-web"
                style={{
                  flex: "1 1 0", minWidth: 260, background: "#FFFFFF", border: "1.5px solid #16233F",
                  boxShadow: "0 12px 28px rgba(22,35,63,.10)", borderRadius: 18, padding: "18px 20px",
                  display: "flex", flexDirection: "column", gap: 12, textDecoration: "none", color: "inherit"
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div style={{ width: 128, height: 80 }}>
                    <div style={{ transform: "scale(.82)", transformOrigin: "0 0" }}>
                      <div style={{
                        position: "relative", width: 156, height: 98, borderRadius: 10, overflow: "hidden",
                        background: "linear-gradient(180deg,#000B28,#00081F)", boxShadow: "0 8px 18px rgba(22,35,63,.25)"
                      }}>
                        <div style={{ height: 12, background: "rgba(255,255,255,.08)", display: "flex", alignItems: "center", gap: 3, paddingLeft: 6 }}>
                          <i style={{ width: 4, height: 4, borderRadius: "50%", background: "#E6B94F" }} />
                          <i style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(255,255,255,.4)" }} />
                          <i style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(255,255,255,.4)" }} />
                        </div>
                        <div style={{ padding: "8px 10px" }}>
                          <div style={{ width: 84, height: 6, borderRadius: 2, background: "#FFFFFF" }} />
                          <div style={{ width: 60, height: 6, borderRadius: 2, background: "#FFFFFF", marginTop: 4 }} />
                          <div style={{ width: 48, height: 3, borderRadius: 2, background: "#E6B94F", marginTop: 6 }} />
                          <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                            <div style={{ flex: 1, height: 14, borderRadius: 3, background: "#B3875E" }} />
                            <div style={{ flex: 1, height: 14, borderRadius: 3, background: "#7FA9A5" }} />
                            <div style={{ flex: 1, height: 14, borderRadius: 3, background: "#D8C7A8" }} />
                          </div>
                          <div style={{ width: 34, height: 10, borderRadius: 6, background: "linear-gradient(180deg,#E6B94F,#CB9A2E)", marginTop: 8 }} />
                        </div>
                      </div>
                    </div>
                  </div>
                  <span style={{ flex: "0 0 auto", width: 36, height: 36, borderRadius: "50%", background: "#16233F", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#16233F" }}>{L.parametres.siteWebKoji}</div>
                  <div style={{ fontSize: 12.5, color: "#6B7280", lineHeight: 1.45 }}>
                    {websiteAccess ? siteUrlLabel || L.parametres.websiteSub : L.parametres.websiteUpsell}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {websiteAccess ? (
                    <>
                      <span style={{ fontSize: 11.5, fontWeight: 700, padding: "4px 10px", borderRadius: 10, background: sitePublished ? "#E6F5EE" : "#F1F2F6", color: sitePublished ? "#1E8E5A" : "#8A8F9E" }}>
                        {sitePublished ? "En ligne" : "Brouillon"}
                      </span>
                      <span style={{ fontSize: 11.5, fontWeight: 700, padding: "4px 10px", borderRadius: 10, background: "#FBF1DA", color: "#8F6A12" }}>Créé par koji</span>
                    </>
                  ) : (
                    <span style={{ fontSize: 11.5, fontWeight: 700, padding: "4px 10px", borderRadius: 10, background: "#FBF1DA", color: "#8F6A12" }}>Option payante</span>
                  )}
                </div>
              </Link>
            </div>
          </div>

          <div>
            <div className="fournitures-sidebar-card">
              <strong className="title-chip">Profil complété</strong>
              <div className="profile-completion-row">
                <div className="ct-progress-bar" style={{ width: "100%" }}><div style={{ width: `${completude.pct}%` }} /></div>
                <b>{completude.pct} %</b>
              </div>
              {completude.missing ? <small className="muted">Ajoutez {completude.missing.label} pour atteindre 100 %.</small> : <small className="muted">Votre profil est complet.</small>}
            </div>

            <div className="fournitures-sidebar-card">
              <strong className="title-chip">Mes métiers</strong>
              <div className="metiers-list">
                {professionsList.map((item) => (
                  <button
                    type="button"
                    key={item}
                    className={`metier-chip ${professions.includes(item) ? "active" : ""}`}
                    onClick={() => toggleProfession(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="fournitures-sidebar-card">
              <strong className="title-chip">Documents</strong>
              {Object.entries(DOCUMENT_META).map(([key, meta]) => {
                const status = documentStatus(key);
                const doc = business.documents?.[key] || {};
                return (
                  <div className="profile-document-row" key={key}>
                    <div>
                      <strong>{meta.label}</strong>
                      {key === "decennale" ? (
                        <input type="date" className="profile-document-date" value={doc.expiryDate || ""} onChange={(event) => setDocumentField("decennale", "expiryDate", event.target.value)} />
                      ) : (
                        <small>{doc.fileDataUrl ? "Document ajouté" : "Non fourni"}</small>
                      )}
                    </div>
                    <label className={`profile-document-badge tone-${status.tone}`}>
                      {status.label}
                      <input type="file" accept="image/*,application/pdf" onChange={(event) => onDocumentFileChange(key, event)} style={{ display: "none" }} />
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <section className="profile-block">
          <h2>{L.parametres.signatures}</h2>
          <p className="muted">{L.parametres.signaturesSub}</p>
          <Link href="/signature" className="button secondary profile-link-button">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="profile-link-icon"><path d={icon("pen")} /></svg>
            {L.parametres.openSignatures}
          </Link>
        </section>

        <section className="profile-block">
          <h2>Informations complémentaires</h2>
          <div className="profile-grid">
            <Field label={L.parametres.formeJuridique} iconName="gavel" value={business.formeJuridique} onChange={(event) => setField("formeJuridique", event.target.value)} placeholder="SARL, SAS..." />
            <Field label={L.parametres.siren} iconName="id" value={business.siren} onChange={(event) => setField("siren", event.target.value)} placeholder="123456789" />
            <Field label={L.parametres.accountEmail} iconName="mail" type="email" value={user?.email || ""} disabled hint={L.parametres.accountEmailSub} />
            <Field label={L.parametres.website} iconName="tag" value={business.website || ""} onChange={(event) => setField("website", event.target.value)} placeholder="www.entreprise.fr" />
            <Field label={L.parametres.tva} iconName="tag" value={business.tva} onChange={(event) => setField("tva", event.target.value)} placeholder="FR..." />
            <Field label={L.parametres.hoursPerDay} iconName="clock" type="number" value={String(business.hoursPerDay ?? 7)} onChange={(event) => setField("hoursPerDay", event.target.value)} />
            <Field label="Rayon d'intervention (km)" iconName="pin" type="number" value={String(business.zoneRadiusKm ?? 20)} onChange={(event) => setField("zoneRadiusKm", event.target.value)} />
            <label className="profile-field wide">
              <span>{L.parametres.qrCode}</span>
              <div className="qr-upload-row">
                {business.qrCodeDataUrl ? <img src={business.qrCodeDataUrl} alt="QR code" className="qr-upload-preview" /> : null}
                <button type="button" className="button secondary" onClick={() => qrFileRef.current?.click()}>
                  {business.qrCodeDataUrl ? L.parametres.changeQrCode : L.parametres.addQrCode}
                </button>
                {business.qrCodeDataUrl ? (
                  <button type="button" className="button danger" onClick={() => setField("qrCodeDataUrl", "")}>{L.common.delete}</button>
                ) : null}
              </div>
              <small className="muted">{L.parametres.qrCodeSub}</small>
              <input ref={qrFileRef} type="file" accept="image/png,image/jpeg" onChange={onQrCodeChange} style={{ display: "none" }} />
            </label>
          </div>
          <p className="muted" style={{ marginTop: 14 }}>Détails de l'adresse (étage, digicode, complément...)</p>
          <AddressFields
            value={{
              address: business.addressLine1,
              city: business.city,
              postalCode: business.postalCode,
              floor: business.floor,
              accessCode: business.accessCode,
              complement: business.addressLine2,
              accessInstructions: business.accessInstructions
            }}
            onChange={(next) => setBusiness((current) => ({
              ...current,
              addressLine1: next.address,
              city: next.city,
              postalCode: next.postalCode,
              floor: next.floor,
              accessCode: next.accessCode,
              addressLine2: next.complement,
              accessInstructions: next.accessInstructions
            }))}
          />
        </section>

        <section className="profile-block">
          <h2>Sécurité</h2>
          <p className="muted">Changez votre mot de passe de connexion.</p>
          <div className="profile-grid">
            <Field label="Mot de passe actuel" iconName="text" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
            <Field label="Nouveau mot de passe" iconName="text" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} hint="8 caractères minimum" />
            <Field label="Confirmer le nouveau mot de passe" iconName="text" type="password" value={confirmNewPassword} onChange={(event) => setConfirmNewPassword(event.target.value)} />
          </div>
          {passwordMessage ? <p className="profile-message">{passwordMessage}</p> : null}
          <button type="button" className="button secondary" onClick={changePassword} disabled={passwordSaving || !currentPassword || !newPassword}>
            {passwordSaving ? "Modification…" : "Changer le mot de passe"}
          </button>
        </section>

        <section className="profile-block">
          <h2>{L.parametres.bank}</h2>
          <p className="muted">{L.parametres.bankSub}</p>
          <div className="profile-grid">
            <Field label={L.parametres.iban} iconName="bank" value={business.iban || ""} onChange={(event) => setField("iban", event.target.value)} placeholder="FR76 3000 6000 0112 3456 7890 189" />
            <Field label={L.parametres.bic} iconName="bank" value={business.bic || ""} onChange={(event) => setField("bic", event.target.value)} placeholder="BNPAFRPP" />
            <Field label={L.parametres.bankHolder} iconName="id" value={business.bankHolder || ""} onChange={(event) => setField("bankHolder", event.target.value)} placeholder={L.parametres.bankHolder} />
          </div>
        </section>

        <section className="profile-block">
          <h2>{L.parametres.paymentTerms}</h2>
          <p className="muted">{L.parametres.paymentTermsSub}</p>
          <label className="profile-field wide">
            <span>{L.parametres.paymentTermsLabel}</span>
            <textarea
              className="profile-textarea"
              value={business.paymentTerms || ""}
              onChange={(event) => setField("paymentTerms", event.target.value)}
              placeholder={L.parametres.paymentTermsLabel}
              rows={4}
            />
          </label>
        </section>

        {message ? <p className="profile-message">{message}</p> : null}

        <footer className="profile-actions">
          <button className="button blue" disabled={saving}>{saving ? L.parametres.saving : L.parametres.save}</button>
        </footer>
      </form>
    </Shell>
  );
}
