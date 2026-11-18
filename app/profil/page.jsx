"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AddressFields } from "../../components/AddressFields";
import { DevisFactures, DisponibilitesCard, EtapesProfil, IdentiteResume, QualificationsCard } from "./ProfilSections";
import { ProAccountNav } from "../../components/ProAccountNav";
import { Shell } from "../../components/Shell";
import { apiGet, apiSend } from "../../lib/client-api";
import { useLocale } from "../../lib/i18n";

const professionsList = ["Electricien", "Plombier", "Carreleur", "Menuisier", "Peintre", "Tout corps d'etat"];
// Libellés affichés (les valeurs enregistrées restent celles ci-dessus).
const PROFESSION_LABELS = { Electricien: "Électricien", "Tout corps d'etat": "Tout corps d'état" };

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
  const [tab, setTab] = useState("entreprise");

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("tab");
    if (["devis", "securite"].includes(wanted)) setTab(wanted);
  }, []);

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


  // Juste de quoi afficher la carte "Site web" (slug + statut publie) sur ce
  // tableau de bord — l'editeur complet (photos, description...) vit sur
  // /profil/site-web, qui refait son propre GET /api/site.
  const [siteSummary, setSiteSummary] = useState(null);
  // KojiPage (PRO-13) : incluse dans toutes les offres, statut lu sur /api/kojipage.
  useEffect(() => {
    let alive = true;
    apiGet("/api/kojipage").then((payload) => { if (alive) setSiteSummary({ slug: payload.site?.slug, published: payload.enLigne }); }).catch(() => {});
    return () => { alive = false; };
  }, []);
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
      { key: "raisonSociale", short: "Raison sociale", label: "votre raison sociale", done: Boolean(business.raisonSociale) },
      { key: "siret", short: "SIRET", label: "votre SIRET", done: Boolean(business.siret) },
      { key: "addressLine1", short: "Adresse", label: "votre adresse", done: Boolean(business.addressLine1) },
      { key: "emailPro", short: "E-mail pro", label: "votre e-mail professionnel", done: Boolean(business.emailPro) },
      { key: "phone", short: "Téléphone", label: "votre téléphone", done: Boolean(business.phone) },
      { key: "logo", short: "Logo", label: "votre logo", done: Boolean(business.logoDataUrl) },
      { key: "metiers", short: "Métiers", label: "au moins un métier", done: professions.length > 0 },
      { key: "decennale", short: "Décennale", label: "votre assurance décennale", done: Boolean(business.documents?.decennale?.fileDataUrl) },
      { key: "urssaf", short: "URSSAF", label: "votre attestation URSSAF", done: Boolean(business.documents?.urssaf?.fileDataUrl) },
      { key: "kbis", short: "Kbis", label: "votre Kbis", done: Boolean(business.documents?.kbis?.fileDataUrl) }
    ];
    const doneCount = items.filter((item) => item.done).length;
    const pct = Math.round((doneCount / items.length) * 100);
    const missing = items.find((item) => !item.done);
    return { pct, missing, items };
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
      setMessage("Informations enregistrées.");
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

  function pickTab(next) {
    setTab(next);
    const params = new URLSearchParams(window.location.search);
    if (next === "entreprise") params.delete("tab"); else params.set("tab", next);
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }

  const companyName = business.raisonSociale || user?.name || "Votre entreprise";
  const docRows = Object.entries(DOCUMENT_META);
  const decennale = business.documents?.decennale || {};

  if (loading) {
    return (
      <Shell variant="pro">
        <div className="tbl"><p className="empty">{L.common.loading}</p></div>
      </Shell>
    );
  }

  return (
    <Shell variant="pro">
      <form className="pf-form" onSubmit={onSave}>
        <input ref={fileRef} type="file" accept="image/*" onChange={onLogoChange} hidden />
        <input ref={qrFileRef} type="file" accept="image/png,image/jpeg" onChange={onQrCodeChange} hidden />

        <div className="head">
          <div className="stack">
            <span className="eyebrow">{["Profil et compte", companyName, memberSince ? `membre depuis ${memberSince}` : ""].filter(Boolean).join(" · ")}</span>
            <h1>Profil et compte</h1>
            <span className="muted">Les informations de votre entreprise, reprises sur vos devis et factures.</span>
          </div>
          <div className="acts">
            <Link href="/demarrage" className="btn btn-sec">Démarrage guidé</Link>
            <Link href="/kojipage/carte" className="btn btn-sec">Carte de visite</Link>
            {tab !== "securite" ? <button type="submit" className="btn btn-main" disabled={saving}>{saving ? L.parametres.saving : L.parametres.save}</button> : null}
          </div>
        </div>

        {message ? <p className="notice" role="status">{message}</p> : null}

        <div className="pf-g">
          <ProAccountNav current={tab} onPick={pickTab} badges={{}} />

          <div className="pf-c">
            {tab === "entreprise" ? (
              <>
                <EtapesProfil rafraichir={user} />

                <section className="card">
                  <div className="card-h"><h2>Identité</h2><span className="sm2">reprise sur vos devis et factures</span></div>
                  <IdentiteResume business={business} />
                  <div className="fgrid">
                    <label className="full">{L.parametres.raisonSociale}
                      <input value={business.raisonSociale} onChange={(event) => setField("raisonSociale", event.target.value)} placeholder={L.parametres.raisonSociale} />
                    </label>
                    <label>{L.parametres.formeJuridique}
                      <input value={business.formeJuridique} onChange={(event) => setField("formeJuridique", event.target.value)} placeholder="SARL, SAS..." />
                    </label>
                    <label>{L.parametres.siret}
                      <input value={business.siret} onChange={(event) => setField("siret", event.target.value)} placeholder="12345678901234" />
                    </label>
                    <label>{L.parametres.siren}
                      <input value={business.siren} onChange={(event) => setField("siren", event.target.value)} placeholder="123456789" />
                    </label>
                    <label>{L.parametres.tva}
                      <input value={business.tva} onChange={(event) => setField("tva", event.target.value)} placeholder="FR..." />
                    </label>
                    <div className="full">
                      <div className="legacy addr">
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
                      </div>
                    </div>
                  </div>
                </section>

                <section className="card">
                  <div className="card-h"><h2>Coordonnées</h2></div>
                  <div className="fgrid">
                    <label>{L.parametres.emailPro}
                      <input type="email" value={business.emailPro} onChange={(event) => setField("emailPro", event.target.value)} placeholder="pro@entreprise.fr" />
                    </label>
                    <label>{L.parametres.phone}
                      <input value={business.phone} onChange={(event) => setField("phone", event.target.value)} placeholder="+33..." />
                    </label>
                    <label>{L.parametres.website}
                      <input value={business.website || ""} onChange={(event) => setField("website", event.target.value)} placeholder="www.entreprise.fr" />
                    </label>
                    <label>{L.parametres.accountEmail}
                      <input type="email" value={user?.email || ""} disabled />
                      <small className="muted">{L.parametres.accountEmailSub}</small>
                    </label>
                  </div>
                </section>

                <div className="pf-g2">
                  <section className="card">
                    <div className="card-h"><h2>Métiers et zone</h2><span className="sm2">utilisés par le Radar</span></div>
                    <div className="pf-chips" role="group" aria-label="Mes métiers">
                      {professionsList.map((item) => {
                        const on = professions.includes(item);
                        return (
                          <button type="button" key={item} className={`pf-chip${on ? " on" : ""}`} aria-pressed={on} onClick={() => toggleProfession(item)}>
                            {on ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l4 4 10-10" /></svg> : "+ "}{PROFESSION_LABELS[item] || item}
                          </button>
                        );
                      })}
                    </div>
                    <div className="fgrid pf-zone-f">
                      <label className="full pf-zone-in">Zone d'intervention
                        <input type="text" value={business.zoneAddress || ""} onChange={(event) => onZoneAddressChange(event.target.value)} placeholder="Adresse, ville..." autoComplete="off" />
                        {zoneSuggestions.length > 0 ? (
                          <span className="pf-sugg" role="listbox">
                            {zoneSuggestions.map((feature) => (
                              <button type="button" key={feature.properties.id} onClick={() => selectZoneAddress(feature)}>{feature.properties.label}</button>
                            ))}
                          </span>
                        ) : null}
                      </label>
                      <label>Rayon d'intervention (km)
                        <input type="number" min="0" value={String(business.zoneRadiusKm ?? 20)} onChange={(event) => setField("zoneRadiusKm", event.target.value)} />
                      </label>
                    </div>
                  </section>

                  <section className="card">
                    <div className="card-h"><h2>Documents et assurance</h2></div>
                    {docRows.map(([key, meta]) => {
                      const status = documentStatus(key);
                      const doc = business.documents?.[key] || {};
                      return (
                        <div className="pf-doc" key={key}>
                          <div>
                            <strong>{meta.label}</strong>
                            <small>
                              {key === "decennale"
                                ? (decennale.expiryDate ? `valable jusqu'au ${new Date(`${decennale.expiryDate}T00:00:00`).toLocaleDateString("fr-FR")}` : "date de fin à renseigner")
                                : (doc.fileDataUrl ? "document ajouté" : "non fourni")}
                            </small>
                            {key === "decennale" ? (
                              <input type="date" className="pf-date" value={decennale.expiryDate || ""} onChange={(event) => setDocumentField("decennale", "expiryDate", event.target.value)} aria-label="Date de fin de la décennale" />
                            ) : null}
                          </div>
                          <span className={status.tone === "ok" ? "tag tag-e" : status.tone === "danger" ? "tag tag-b" : "tag tag-o"}>{status.label}</span>
                          <label className="link pf-file">
                            {doc.fileDataUrl ? "Remplacer" : "Ajouter"}
                            <input type="file" accept="image/*,application/pdf" onChange={(event) => onDocumentFileChange(key, event)} hidden />
                          </label>
                        </div>
                      );
                    })}
                  </section>
                </div>

                <div className="pf-g2">
                  <QualificationsCard business={business} setField={setField} />
                  <DisponibilitesCard business={business} setField={setField} />
                  <section className="card">
                    <div className="card-h"><h2>Image</h2></div>
                    <div className="pf-logo">
                      <span className="pf-lg">{business.logoDataUrl ? <img src={business.logoDataUrl} alt="Logo de l'entreprise" /> : initials(companyName)}</span>
                      <div>
                        <strong>Logo</strong>
                        <small>devis, factures, KojiPage, carte de visite</small>
                        <button type="button" className="link" onClick={() => fileRef.current?.click()}>{L.parametres.changeLogo}</button>
                      </div>
                    </div>
                    <div className="pf-logo">
                      <span className="pf-lg pf-qr">{business.qrCodeDataUrl ? <img src={business.qrCodeDataUrl} alt="QR code" /> : "QR"}</span>
                      <div>
                        <strong>{L.parametres.qrCode}</strong>
                        <small>{L.parametres.qrCodeSub}</small>
                        <span className="pf-lk">
                          <button type="button" className="link" onClick={() => qrFileRef.current?.click()}>{business.qrCodeDataUrl ? L.parametres.changeQrCode : L.parametres.addQrCode}</button>
                          {business.qrCodeDataUrl ? <button type="button" className="link" onClick={() => setField("qrCodeDataUrl", "")}>{L.common.delete}</button> : null}
                        </span>
                      </div>
                    </div>
                  </section>

                  <section className="card">
                    <div className="card-h"><h2>Vu par vos clients</h2></div>
                    <Link href="/kojipage/carte" className="row pf-go">
                      <div className="t">
                        <strong>{L.parametres.businessCard}</strong>
                        <small>{L.parametres.businessCardSub}</small>
                      </div>
                      <span className="tag tag-e">Ouvrir</span>
                    </Link>
                    <Link href="/kojipage" className="row pf-go">
                      <div className="t">
                        <strong>KojiPage</strong>
                        <small>{siteUrlLabel || "Votre vitrine : réalisations, prestations, avis, demandes de devis"}</small>
                      </div>
                      <span className={sitePublished ? "tag tag-b" : "tag tag-o"}>{sitePublished ? "En ligne" : "Pas encore en ligne"}</span>
                    </Link>
                  </section>
                </div>
              </>
            ) : null}

            {tab === "devis" ? <DevisFactures business={business} setField={setField} labels={L.parametres} /> : null}

            {tab === "securite" ? (
              <section className="card">
                <div className="card-h"><h2>Mot de passe</h2></div>
                <p className="muted">Changez votre mot de passe de connexion.</p>
                <div className="fgrid">
                  <label className="full">Mot de passe actuel
                    <input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
                  </label>
                  <label>Nouveau mot de passe
                    <input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
                    <small className="muted">8 caractères minimum</small>
                  </label>
                  <label>Confirmer le nouveau mot de passe
                    <input type="password" autoComplete="new-password" value={confirmNewPassword} onChange={(event) => setConfirmNewPassword(event.target.value)} />
                  </label>
                </div>
                {passwordMessage ? <p className="notice" role="status">{passwordMessage}</p> : null}
                <div className="ed-act">
                  <button type="button" className="btn btn-main" onClick={changePassword} disabled={passwordSaving || !currentPassword || !newPassword}>
                    {passwordSaving ? "Modification…" : "Changer le mot de passe"}
                  </button>
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </form>
    </Shell>
  );
}
