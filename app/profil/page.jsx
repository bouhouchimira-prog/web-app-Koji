"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AddressFields } from "../../components/AddressFields";
import { Shell } from "../../components/Shell";
import { apiGet, apiSend, fetchWithAuthRetry } from "../../lib/client-api";
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
  const [cardLoading, setCardLoading] = useState(false);
  const [cardMessage, setCardMessage] = useState("");
  const [site, setSite] = useState(null);
  const [siteLoading, setSiteLoading] = useState(false);
  const [siteSaving, setSiteSaving] = useState(false);
  const [siteMessage, setSiteMessage] = useState("");
  const [siteCopied, setSiteCopied] = useState(false);
  const siteFileRef = useRef(null);
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

  // Site web Koji (23 septembre) : ne charge le brouillon/enregistrement que
  // pour les comptes ayant l'option payante OU les admins (gratuit pour eux,
  // meme principe que la carte de visite a l'origine) — GET /api/site
  // renverrait de toute facon 402 sinon (voir app/api/site/route.js).
  const websiteAccess = hasWebsiteAccess(user);
  useEffect(() => {
    if (!websiteAccess) return;
    let alive = true;
    setSiteLoading(true);
    apiGet("/api/site")
      .then((payload) => { if (alive) setSite(payload.site); })
      .catch(() => {})
      .finally(() => { if (alive) setSiteLoading(false); });
    return () => { alive = false; };
  }, [websiteAccess]);

  function setField(field, value) {
    setBusiness((current) => ({ ...current, [field]: value }));
  }

  // Redimensionne une photo cote navigateur avant de la stocker en data URL
  // (meme principe que le logo, app/profil/page.jsx:onLogoChange, mais
  // obligatoire ici puisque plusieurs photos rejoignent le meme blob JSON
  // partage koji_web_state, qui n'a pas de stockage fichier dedie).
  function compressImageFile(file, maxWidth = 1600) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Image invalide."));
        img.onload = () => {
          const scale = Math.min(1, maxWidth / img.width);
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        };
        img.src = String(reader.result || "");
      };
      reader.readAsDataURL(file);
    });
  }

  async function onSitePhotoChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !site) return;
    try {
      const dataUrl = await compressImageFile(file);
      setSite((current) => ({ ...current, photos: [...(current.photos || []), dataUrl].slice(0, current.maxPhotos || 8) }));
    } catch (error) {
      setSiteMessage(error.message || "Impossible d'ajouter cette photo.");
    }
  }

  function removeSitePhoto(index) {
    setSite((current) => ({ ...current, photos: (current.photos || []).filter((_, i) => i !== index) }));
  }

  function setSiteField(field, value) {
    setSite((current) => ({ ...current, [field]: value }));
  }

  async function saveSite(publish) {
    if (!site) return;
    setSiteSaving(true);
    setSiteMessage("");
    try {
      const payload = {
        slug: site.slug,
        tagline: site.tagline,
        description: site.description,
        photos: site.photos,
        published: publish === undefined ? site.published : publish
      };
      const { site: saved } = await apiSend("/api/site", payload, "PATCH");
      setSite(saved);
      setSiteMessage(saved.published ? "Site publié." : "Modifications enregistrées.");
    } catch (error) {
      setSiteMessage(error.message || "Erreur lors de l'enregistrement.");
    } finally {
      setSiteSaving(false);
    }
  }

  function copySiteLink() {
    if (!site?.slug || typeof window === "undefined") return;
    const url = `${window.location.origin}/site/${site.slug}`;
    navigator.clipboard?.writeText(url).then(() => {
      setSiteCopied(true);
      setTimeout(() => setSiteCopied(false), 2000);
    }).catch(() => {});
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

  async function openBusinessCard(mode) {
    setCardLoading(true);
    setCardMessage("");
    try {
      const path = mode === "preview" ? "/api/business-card?preview=1" : "/api/business-card";
      const response = await fetchWithAuthRetry(() => fetch(path, { cache: "no-store" }));
      if (response.status === 402) {
        setCardMessage(L.parametres.businessCardUpsell);
        return;
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de la generation.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      if (mode === "preview") {
        window.open(url, "_blank");
      } else {
        const link = document.createElement("a");
        link.href = url;
        link.download = "Carte_visite.pdf";
        link.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (error) {
      setCardMessage(error.message || "Erreur lors de la generation.");
    } finally {
      setCardLoading(false);
    }
  }

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
            <button type="button" className="button secondary" onClick={() => openBusinessCard("preview")} disabled={cardLoading}>Aperçu client</button>
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

        <section className="profile-block">
          <h2>{L.parametres.businessCard}</h2>
          <p className="muted">{L.parametres.businessCardSub}</p>
          <div className="profile-card-actions">
            <button type="button" className="button secondary profile-link-button" onClick={() => openBusinessCard("preview")} disabled={cardLoading}>
              <svg viewBox="0 0 24 24" aria-hidden="true" className="profile-link-icon"><path d={icon("id")} /></svg>
              {L.parametres.previewBusinessCard}
            </button>
            <button type="button" className="button secondary profile-link-button" onClick={() => openBusinessCard("download")} disabled={cardLoading}>
              <svg viewBox="0 0 24 24" aria-hidden="true" className="profile-link-icon"><path d={icon("id")} /></svg>
              {L.parametres.downloadBusinessCard}
            </button>
          </div>
          {cardMessage ? <p className="profile-message">{cardMessage}</p> : null}
        </section>

        <section className="profile-block">
          <h2>{L.parametres.siteWebKoji}</h2>
          <p className="muted">{L.parametres.websiteSub}</p>

          {!websiteAccess ? (
            <div className="profile-website-upsell">
              <p>{L.parametres.websiteUpsell}</p>
              <Link href="/parametres/abonnement" className="button secondary profile-link-button">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="profile-link-icon"><path d={icon("globe")} /></svg>
                {L.parametres.websiteUpsellCta}
              </Link>
            </div>
          ) : siteLoading || !site ? (
            <p className="muted">{L.common.loading}</p>
          ) : (
            <div className="profile-website-editor">
              <label className="profile-field">
                <span>{L.parametres.websiteSlug}</span>
                <div className="profile-input">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d={icon("globe")} /></svg>
                  <input value={site.slug} onChange={(event) => setSiteField("slug", event.target.value)} />
                </div>
                <span className="profile-website-url-preview">
                  {typeof window !== "undefined" ? window.location.origin : ""}/site/{site.slug || "…"}
                </span>
              </label>

              <label className="profile-field">
                <span>{L.parametres.websiteTagline}</span>
                <div className="profile-input">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d={icon("tag")} /></svg>
                  <input value={site.tagline} onChange={(event) => setSiteField("tagline", event.target.value)} placeholder={L.parametres.websiteTaglinePh} />
                </div>
              </label>

              <label className="profile-field profile-field-wide">
                <span>{L.parametres.websiteDescription}</span>
                <textarea
                  className="profile-website-textarea"
                  rows={4}
                  value={site.description}
                  onChange={(event) => setSiteField("description", event.target.value)}
                  placeholder={L.parametres.websiteDescriptionPh}
                />
              </label>

              <div className="profile-website-photos">
                <div className="profile-website-photos-head">
                  <span>{L.parametres.websitePhotos}</span>
                  <span className={`profile-website-photos-count ${site.photos.length >= site.minPhotos ? "ok" : ""}`}>
                    {L.parametres.websitePhotosHint(site.minPhotos, site.photos.length)}
                  </span>
                </div>
                <div className="profile-website-photo-grid">
                  {site.photos.map((photo, index) => (
                    <div key={index} className="profile-website-photo-tile">
                      <img src={photo} alt={`Photo ${index + 1}`} />
                      <button type="button" onClick={() => removeSitePhoto(index)}>{L.parametres.websiteRemovePhoto}</button>
                    </div>
                  ))}
                  {site.photos.length < (site.maxPhotos || 8) ? (
                    <button type="button" className="profile-website-photo-add" onClick={() => siteFileRef.current?.click()}>
                      {L.parametres.websiteAddPhoto}
                    </button>
                  ) : null}
                </div>
                <input ref={siteFileRef} type="file" accept="image/*" onChange={onSitePhotoChange} style={{ display: "none" }} />
              </div>

              {siteMessage ? <p className="profile-message">{siteMessage}</p> : null}

              <div className="profile-website-actions">
                <button type="button" className="button secondary" onClick={() => saveSite(site.published)} disabled={siteSaving}>
                  {L.parametres.websiteSave}
                </button>
                {site.published ? (
                  <button type="button" className="button secondary" onClick={() => saveSite(false)} disabled={siteSaving}>
                    {L.parametres.websiteUnpublish}
                  </button>
                ) : (
                  <button type="button" className="button" onClick={() => saveSite(true)} disabled={siteSaving || site.photos.length < site.minPhotos}>
                    {L.parametres.websitePublish}
                  </button>
                )}
              </div>

              <div className={`profile-website-live ${site.published ? "" : "draft"}`}>
                <span>{site.published ? L.parametres.websitePublished : L.parametres.websiteDraftHint}</span>
                <a href={`/site/${site.slug}`} target="_blank" rel="noreferrer" className="button secondary profile-link-button">
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="profile-link-icon"><path d={icon("globe")} /></svg>
                  {site.published ? L.parametres.websiteOpenLink : L.parametres.websitePreview}
                </a>
                {site.published ? (
                  <button type="button" onClick={copySiteLink}>{siteCopied ? L.parametres.websiteLinkCopied : L.parametres.websiteCopyLink}</button>
                ) : null}
              </div>
            </div>
          )}
        </section>

        {message ? <p className="profile-message">{message}</p> : null}

        <footer className="profile-actions">
          <button className="button blue" disabled={saving}>{saving ? L.parametres.saving : L.parametres.save}</button>
        </footer>
      </form>
    </Shell>
  );
}
