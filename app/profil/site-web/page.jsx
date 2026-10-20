"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Shell } from "../../../components/Shell";
import { apiGet, apiSend } from "../../../lib/client-api";
import { useLocale } from "../../../lib/i18n";

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
    case "globe":
      return "M12 22a10 10 0 100-20 10 10 0 000 20zM2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20";
    default:
      return "";
  }
}

const STEPS = [
  { key: 1, title: "Présentation", sub: "Titre, accroche, photo" },
  { key: 2, title: "Réalisations", sub: "Vos chantiers" },
  { key: 3, title: "L'entreprise", sub: "Description" },
  { key: 4, title: "Contact", sub: "Coordonnées" }
];

function StepBadge({ label, done }) {
  if (!done) return null;
  return <span style={{ fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 12, background: "#E6F5EE", color: "#1E8E5A" }}>{label}</span>;
}

function StepHead({ number, title, sub, done }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <span style={{ width: 34, height: 34, borderRadius: 11, background: "#16233F", color: "#FFFFFF", fontSize: 15, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>{number}</span>
      <div style={{ flex: "1 1 auto" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#16233F" }}>{title}</div>
        <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>{sub}</div>
      </div>
      <StepBadge label="Complet" done={done} />
    </div>
  );
}

function TextField({ label, required, value, onChange, placeholder, counter }) {
  return (
    <div style={{ flex: "1 1 0", minWidth: 0 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#6B7280", marginBottom: 7 }}>
        {label} {required ? <span style={{ color: "#C2570C" }}>*</span> : null}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: "100%", boxSizing: "border-box", height: 46, borderRadius: 12, border: "1px solid #E1E4EC", background: "#FBFBFD", padding: "0 14px", fontSize: 14, fontWeight: 600, color: "#1E2430" }}
      />
      {counter ? <div style={{ textAlign: "right", fontSize: 11.5, color: "#9C9FB0", marginTop: 4 }}>{counter}</div> : null}
    </div>
  );
}

export default function SiteWebPage() {
  const { L } = useLocale();
  const [user, setUser] = useState(null);
  const [site, setSite] = useState(null);
  const [siteLoading, setSiteLoading] = useState(true);
  const [siteSaving, setSiteSaving] = useState(false);
  const [siteMessage, setSiteMessage] = useState("");
  const [siteCopied, setSiteCopied] = useState(false);
  const siteFileRef = useRef(null);
  const contactPhotoRef = useRef(null);
  const [activeRealisationId, setActiveRealisationId] = useState("");
  const [previewKey, setPreviewKey] = useState(0);
  const [specialtyDraft, setSpecialtyDraft] = useState("");
  const [addingSpecialty, setAddingSpecialty] = useState(false);
  const stepRefs = useRef({});
  const [activeStep, setActiveStep] = useState(1);

  useEffect(() => {
    const localUser = readLocalUser();
    const query = localUser?.id ? `/api/auth/profile?userId=${localUser.id}` : "/api/auth/profile";
    apiGet(query)
      .then((payload) => setUser(payload.user || localUser || {}))
      .catch(() => setUser(localUser || {}));
  }, []);

  const websiteAccess = hasWebsiteAccess(user);

  useEffect(() => {
    if (!user) return;
    if (!websiteAccess) { setSiteLoading(false); return; }
    let alive = true;
    setSiteLoading(true);
    apiGet("/api/site")
      .then((payload) => { if (alive) setSite(payload.site); })
      .catch(() => {})
      .finally(() => { if (alive) setSiteLoading(false); });
    return () => { alive = false; };
  }, [user, websiteAccess]);

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

  function setSiteField(field, value) {
    setSite((current) => ({ ...current, [field]: value }));
  }

  function addRealisation() {
    setSite((current) => ({
      ...current,
      realisations: [...(current.realisations || []), { id: `tmp-${Date.now()}`, name: "", photos: [] }]
    }));
  }

  function removeRealisation(id) {
    setSite((current) => ({ ...current, realisations: (current.realisations || []).filter((item) => item.id !== id) }));
  }

  function setRealisationName(id, name) {
    setSite((current) => ({
      ...current,
      realisations: (current.realisations || []).map((item) => (item.id === id ? { ...item, name } : item))
    }));
  }

  function openRealisationPhotoPicker(id) {
    setActiveRealisationId(id);
    siteFileRef.current?.click();
  }

  async function onRealisationPhotoChange(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    const id = activeRealisationId;
    if (!files.length || !site || !id) return;
    try {
      const dataUrls = await Promise.all(files.map((file) => compressImageFile(file)));
      setSite((current) => ({
        ...current,
        realisations: (current.realisations || []).map((item) => (
          item.id === id
            ? { ...item, photos: [...item.photos, ...dataUrls].slice(0, current.maxPhotosPerRealisation || 10) }
            : item
        ))
      }));
    } catch (error) {
      setSiteMessage(error.message || "Impossible d'ajouter cette photo.");
    }
  }

  function removeRealisationPhoto(id, photoIndex) {
    setSite((current) => ({
      ...current,
      realisations: (current.realisations || []).map((item) => (
        item.id === id ? { ...item, photos: item.photos.filter((_, i) => i !== photoIndex) } : item
      ))
    }));
  }

  async function onContactPhotoChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file, 600);
      setSiteField("contactPhotoDataUrl", dataUrl);
    } catch (error) {
      setSiteMessage(error.message || "Impossible d'ajouter cette photo.");
    }
  }

  function addSpecialty() {
    const value = specialtyDraft.trim();
    if (!value) { setAddingSpecialty(false); return; }
    setSite((current) => ({
      ...current,
      specialties: [...new Set([...(current.specialties || []), value])].slice(0, current.maxSpecialties || 16)
    }));
    setSpecialtyDraft("");
    setAddingSpecialty(false);
  }

  function removeSpecialty(value) {
    setSite((current) => ({ ...current, specialties: (current.specialties || []).filter((item) => item !== value) }));
  }

  async function saveSite(publish) {
    if (!site) return;
    setSiteSaving(true);
    setSiteMessage("");
    try {
      const payload = {
        slug: site.slug,
        mode: site.mode,
        customUrl: site.customUrl,
        title: site.title,
        tagline: site.tagline,
        presentationText: site.presentationText,
        ctaPrimary: site.ctaPrimary,
        ctaSecondary: site.ctaSecondary,
        contactPhotoDataUrl: site.contactPhotoDataUrl,
        contactName: site.contactName,
        contactMessage: site.contactMessage,
        realisations: site.realisations,
        companyDescription: site.companyDescription,
        zoneIntervention: site.zoneIntervention,
        horaires: site.horaires,
        specialties: site.specialties,
        contactPhone: site.contactPhone,
        contactEmail: site.contactEmail,
        contactAddress: site.contactAddress,
        contactZoneAffichee: site.contactZoneAffichee,
        showContactForm: site.showContactForm,
        published: publish === undefined ? site.published : publish
      };
      const { site: saved } = await apiSend("/api/site", payload, "PATCH");
      setSite(saved);
      setSiteMessage(saved.published ? "Site publié." : "Modifications enregistrées.");
      setPreviewKey((key) => key + 1);
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

  function scrollToStep(step) {
    setActiveStep(step);
    stepRefs.current[step]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (siteLoading && websiteAccess) {
    // fallthrough to shell below for consistent chrome while loading
  }

  const siteUrl = site?.slug && typeof window !== "undefined" ? `${window.location.origin}/site/${site.slug}` : "";
  const step1Done = Boolean(site?.title && site?.tagline && site?.presentationText);
  const step2Done = Boolean((site?.photoCount || 0) > 0);
  const step3Done = Boolean(site?.companyDescription && site?.zoneIntervention);
  const step4Done = Boolean(site?.contactPhone || site?.contactEmail);

  return (
    <Shell>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link
            href="/profil"
            aria-label="Retour"
            style={{ width: 44, height: 44, borderRadius: 12, border: "1px solid #EDEFF3", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", color: "inherit" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16233F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
          </Link>
          <div style={{ flex: "1 1 auto", minWidth: 0 }}>
            <div style={{ fontSize: 12.5, color: "#9C9FB0", fontWeight: 600 }}>Profil <span style={{ margin: "0 4px" }}>›</span> Site web</div>
            <h1 style={{ margin: "2px 0 0 0", fontSize: 26, fontWeight: 800, color: "#16233F", letterSpacing: "-0.01em" }}>Site web</h1>
            <p style={{ margin: "3px 0 0 0", fontSize: 14, color: "#6B7280" }}>Renseignez vos informations. Votre site est mis en forme automatiquement.</p>
          </div>
          {site?.slug ? (
            <div style={{ display: "flex", gap: 10 }}>
              <a href={`/site/${site.slug}`} target="_blank" rel="noreferrer" style={{ height: 44, padding: "0 20px", borderRadius: 12, border: "1px solid #DADDE6", background: "#FFFFFF", color: "#16233F", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16233F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" /></svg>
                Voir le site
              </a>
              <button type="button" onClick={() => saveSite(true)} disabled={siteSaving} style={{ height: 44, padding: "0 22px", borderRadius: 12, border: "none", background: "linear-gradient(180deg,#E6B94F,#CB9A2E)", color: "#0B1530", fontSize: 14, fontWeight: 800, boxShadow: "0 6px 16px rgba(203,154,46,.28)", cursor: "pointer" }}>
                {siteSaving ? "Enregistrement…" : "Publier les modifications"}
              </button>
            </div>
          ) : null}
        </div>

        {!user ? (
          <section className="panel"><div className="empty-state">{L.common.loading}</div></section>
        ) : !websiteAccess ? (
          <div className="profile-block profile-website-upsell">
            <p>{L.parametres.websiteUpsell}</p>
            <Link href="/parametres/abonnement" className="button secondary profile-link-button">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="profile-link-icon"><path d={icon("globe")} /></svg>
              {L.parametres.websiteUpsellCta}
            </Link>
          </div>
        ) : siteLoading || !site ? (
          <section className="panel"><div className="empty-state">{L.common.loading}</div></section>
        ) : (
          <>
            {/* Adresse de votre site */}
            <div style={{ background: "#FFFFFF", border: "1px solid #EDEFF3", borderRadius: 20, padding: "22px 26px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16233F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></svg>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#16233F" }}>Adresse de votre site</div>
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setSiteField("mode", "koji")}
                  style={{
                    flex: "1 1 280px", textAlign: "left", cursor: "pointer", borderRadius: 16, padding: "18px 20px", display: "flex", gap: 14,
                    border: site.mode === "custom" ? "1px solid #E1E4EC" : "1.5px solid #16233F",
                    background: site.mode === "custom" ? "#FFFFFF" : "#F7F9FF"
                  }}
                >
                  <span style={{ flex: "0 0 auto", width: 22, height: 22, borderRadius: "50%", border: `2px solid ${site.mode === "custom" ? "#CBD0DC" : "#16233F"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {site.mode !== "custom" ? <i style={{ width: 10, height: 10, borderRadius: "50%", background: "#16233F" }} /> : null}
                  </span>
                  <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: "#16233F" }}>Site créé par koji</span>
                      {site.published ? <span style={{ fontSize: 11.5, fontWeight: 700, padding: "4px 10px", borderRadius: 10, background: "#E6F5EE", color: "#1E8E5A" }}>En ligne</span> : null}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, height: 44, borderRadius: 12, background: "#FFFFFF", border: "1px solid #E1E4EC", padding: "0 14px" }}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16233F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></svg>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#16233F", flex: "1 1 auto", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{siteUrl.replace(/^https?:\/\//, "")}</span>
                      <span onClick={(e) => { e.stopPropagation(); copySiteLink(); }} style={{ fontSize: 12.5, fontWeight: 700, color: "#3B5BDB" }}>{siteCopied ? "Copié ✓" : "Copier"}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: "#6B7280", marginTop: 9, lineHeight: 1.5 }}>Créé automatiquement à partir de votre profil. Vous n'avez rien à installer.</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSiteField("mode", "custom")}
                  style={{
                    flex: "1 1 280px", textAlign: "left", cursor: "pointer", borderRadius: 16, padding: "18px 20px", display: "flex", gap: 14,
                    border: site.mode === "custom" ? "1.5px solid #16233F" : "1px solid #E1E4EC",
                    background: "#FFFFFF"
                  }}
                >
                  <span style={{ flex: "0 0 auto", width: 22, height: 22, borderRadius: "50%", border: `2px solid ${site.mode === "custom" ? "#16233F" : "#CBD0DC"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {site.mode === "custom" ? <i style={{ width: 10, height: 10, borderRadius: "50%", background: "#16233F" }} /> : null}
                  </span>
                  <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#16233F" }}>J'ai déjà un site</div>
                    <input
                      value={site.customUrl || ""}
                      onChange={(e) => { e.stopPropagation(); setSiteField("customUrl", e.target.value); }}
                      onClick={(e) => e.stopPropagation()}
                      disabled={site.mode !== "custom"}
                      placeholder="https://www.mon-site.fr"
                      style={{ marginTop: 10, width: "100%", boxSizing: "border-box", height: 44, borderRadius: 12, background: site.mode === "custom" ? "#FFFFFF" : "#FBFBFD", border: "1px solid #E1E4EC", padding: "0 14px", fontSize: 14, color: "#1E2430" }}
                    />
                    <div style={{ fontSize: 12.5, color: "#6B7280", marginTop: 9, lineHeight: 1.5 }}>Votre site existant est alors utilisé sur la carte de visite et dans le QR code. Le site koji est mis en pause.</div>
                  </div>
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 22, alignItems: "flex-start", flexWrap: "wrap" }}>
              {/* Step nav */}
              <div style={{ flex: "0 0 230px", display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 20 }}>
                <div style={{ background: "#FFFFFF", border: "1px solid #EDEFF3", borderRadius: 18, padding: 12, display: "flex", flexDirection: "column", gap: 2 }}>
                  {STEPS.map((step) => (
                    <button
                      key={step.key}
                      type="button"
                      onClick={() => scrollToStep(step.key)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 13, border: "none", cursor: "pointer", textAlign: "left",
                        background: activeStep === step.key ? "#EDEFFB" : "transparent"
                      }}
                    >
                      <span style={{ width: 28, height: 28, borderRadius: 9, background: activeStep === step.key ? "#16233F" : "#EEF0F6", color: activeStep === step.key ? "#FFFFFF" : "#6B7280", fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>{step.key}</span>
                      <div style={{ flex: "1 1 auto" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#16233F" }}>{step.title}</div>
                        <div style={{ fontSize: 12, color: "#6B7280" }}>{step.sub}</div>
                      </div>
                    </button>
                  ))}
                </div>
                <div style={{ background: "#FFFFFF", border: "1px solid #EDEFF3", borderRadius: 18, padding: "16px 18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: "#16233F" }}>Site complété</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#16233F" }}>{site.completion?.pct ?? 0} %</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: "#F1F2F6", overflow: "hidden", marginTop: 10 }}>
                    <div style={{ width: `${site.completion?.pct ?? 0}%`, height: "100%", background: "#16233F", borderRadius: 4 }} />
                  </div>
                  {site.completion?.missing ? (
                    <div style={{ fontSize: 12, color: "#6B7280", marginTop: 9 }}>Ajoutez {site.completion.missing} pour atteindre 100 %.</div>
                  ) : (
                    <div style={{ fontSize: 12, color: "#6B7280", marginTop: 9 }}>Votre site est complet.</div>
                  )}
                </div>
              </div>

              {/* Main column */}
              <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Step 1 — Présentation */}
                <div ref={(el) => { stepRefs.current[1] = el; }} style={{ background: "#FFFFFF", border: "1px solid #EDEFF3", borderRadius: 20, padding: "24px 26px", display: "flex", flexDirection: "column", gap: 18 }}>
                  <StepHead number={1} title="Présentation" sub="Le haut de votre site : ce que les clients voient en premier." done={step1Done} />
                  <div style={{ display: "flex", gap: 16 }}>
                    <TextField label="Titre principal" required value={site.title} onChange={(v) => setSiteField("title", v)} placeholder="Vos travaux de rénovation, à Paris et en Île-de-France" />
                  </div>
                  <div style={{ display: "flex", gap: 16 }}>
                    <TextField label="Phrase d'accroche" value={site.tagline} onChange={(v) => setSiteField("tagline", v)} placeholder="Un chantier soigné, des délais respectés." />
                  </div>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "#6B7280", marginBottom: 7 }}>Texte de présentation</div>
                    <textarea
                      value={site.presentationText}
                      onChange={(e) => setSiteField("presentationText", e.target.value.slice(0, site.limits?.presentationText || 500))}
                      rows={4}
                      placeholder="Décrivez votre entreprise, vos savoir-faire, vos chantiers phares…"
                      style={{ width: "100%", boxSizing: "border-box", borderRadius: 12, border: "1px solid #E1E4EC", background: "#FBFBFD", padding: "12px 14px", fontSize: 14, lineHeight: 1.6, color: "#1E2430", fontWeight: 500, fontFamily: "inherit" }}
                    />
                    <div style={{ textAlign: "right", fontSize: 11.5, color: "#9C9FB0", marginTop: 4 }}>{(site.presentationText || "").length} / {site.limits?.presentationText || 500}</div>
                  </div>
                  <div style={{ display: "flex", gap: 16 }}>
                    <TextField label="Bouton principal" value={site.ctaPrimary} onChange={(v) => setSiteField("ctaPrimary", v)} placeholder="Obtenir un devis" />
                    <TextField label="Bouton secondaire" value={site.ctaSecondary} onChange={(v) => setSiteField("ctaSecondary", v)} placeholder="Découvrir nos chantiers" />
                  </div>
                  <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div style={{ flex: "0 0 auto" }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#6B7280", marginBottom: 7 }}>Photo du contact</div>
                      <button
                        type="button"
                        onClick={() => contactPhotoRef.current?.click()}
                        style={{ width: 150, height: 150, borderRadius: 16, border: "1.5px dashed #CBD0DC", background: "#F7F8FC", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden", cursor: "pointer" }}
                      >
                        {site.contactPhotoDataUrl ? (
                          <img src={site.contactPhotoDataUrl} alt="Contact" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9C9FB0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginTop: 6 }}>Ajouter</span>
                          </>
                        )}
                      </button>
                      <input ref={contactPhotoRef} type="file" accept="image/*" onChange={onContactPhotoChange} style={{ display: "none" }} />
                      <div style={{ fontSize: 12, color: "#9C9FB0", marginTop: 7, maxWidth: 150 }}>Facultatif · JPG ou PNG</div>
                    </div>
                    <div style={{ flex: "1 1 0", minWidth: 220, display: "flex", flexDirection: "column", gap: 14 }}>
                      <TextField label="Nom du contact chantier" value={site.contactName} onChange={(v) => setSiteField("contactName", v)} placeholder="M. Bouhouchi" />
                      <TextField label="Message du contact" value={site.contactMessage} onChange={(v) => setSiteField("contactMessage", v)} placeholder="Je pilote votre projet, du premier rendez-vous à la livraison." />
                    </div>
                  </div>
                </div>

                {/* Step 2 — Réalisations */}
                <div ref={(el) => { stepRefs.current[2] = el; }} style={{ background: "#FFFFFF", border: "1px solid #EDEFF3", borderRadius: 20, padding: "24px 26px", display: "flex", flexDirection: "column", gap: 18 }}>
                  <StepHead number={2} title="Réalisations" sub="Un chantier = un nom + une ou plusieurs photos." done={step2Done} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {(site.realisations || []).map((item) => (
                      <div key={item.id} style={{ border: "1px solid #E7E9F0", borderRadius: 16, padding: "16px 18px", background: "#FCFCFE", display: "flex", flexDirection: "column", gap: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <input
                            value={item.name}
                            onChange={(event) => setRealisationName(item.id, event.target.value)}
                            placeholder="Nom du chantier (ex. Rénovation d'un salon)"
                            style={{ flex: "1 1 auto", height: 44, borderRadius: 12, border: "1px solid #E1E4EC", background: "#FFFFFF", padding: "0 14px", fontSize: 14.5, fontWeight: 700, color: "#1E2430" }}
                          />
                          <button type="button" aria-label="Supprimer ce chantier" onClick={() => removeRealisation(item.id)} style={{ width: 40, height: 40, borderRadius: 11, border: "1px solid #E5E5EC", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9C9FB0" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
                          </button>
                        </div>
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                          {item.photos.map((photo, index) => (
                            <div key={index} style={{ position: "relative", width: 96, height: 72, flex: "0 0 auto" }}>
                              <img src={photo} alt={`${item.name || "Chantier"} ${index + 1}`} style={{ width: 96, height: 72, borderRadius: 12, objectFit: "cover" }} />
                              <button type="button" aria-label="Retirer cette photo" onClick={() => removeRealisationPhoto(item.id, index)} style={{ position: "absolute", right: -6, top: -6, width: 22, height: 22, borderRadius: "50%", background: "#FFFFFF", border: "1px solid #DADDE6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                              </button>
                            </div>
                          ))}
                          {item.photos.length < (site.maxPhotosPerRealisation || 10) ? (
                            <button type="button" onClick={() => openRealisationPhotoPicker(item.id)} style={{ width: 96, height: 72, borderRadius: 12, border: "1.5px dashed #CBD0DC", background: "#F7F8FC", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, flex: "0 0 auto" }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                              <span style={{ fontSize: 11.5, fontWeight: 700, color: "#6B7280" }}>Photos</span>
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={addRealisation} style={{ width: "100%", height: 56, borderRadius: 14, border: "1.5px dashed #E2CE97", background: "#FFFCF4", color: "#8F6A12", fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8F6A12" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                    Ajouter un chantier
                  </button>
                  <input ref={siteFileRef} type="file" accept="image/*" multiple onChange={onRealisationPhotoChange} style={{ display: "none" }} />
                </div>

                {/* Step 3 — L'entreprise */}
                <div ref={(el) => { stepRefs.current[3] = el; }} style={{ background: "#FFFFFF", border: "1px solid #EDEFF3", borderRadius: 20, padding: "24px 26px", display: "flex", flexDirection: "column", gap: 18 }}>
                  <StepHead number={3} title="L'entreprise" sub="Une description de votre entreprise et de votre façon de travailler." done={step3Done} />
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "#6B7280", marginBottom: 7 }}>Description</div>
                    <textarea
                      value={site.companyDescription}
                      onChange={(e) => setSiteField("companyDescription", e.target.value.slice(0, site.limits?.companyDescription || 1000))}
                      rows={5}
                      placeholder="BOUHOUCHI est spécialisée dans..."
                      style={{ width: "100%", boxSizing: "border-box", borderRadius: 12, border: "1px solid #E1E4EC", background: "#FBFBFD", padding: "12px 14px", fontSize: 14, lineHeight: 1.6, color: "#1E2430", fontWeight: 500, fontFamily: "inherit" }}
                    />
                    <div style={{ textAlign: "right", fontSize: 11.5, color: "#9C9FB0", marginTop: 4 }}>{(site.companyDescription || "").length} / {site.limits?.companyDescription || 1000}</div>
                  </div>
                  <div style={{ display: "flex", gap: 16 }}>
                    <TextField label="Zone d'intervention" value={site.zoneIntervention} onChange={(v) => setSiteField("zoneIntervention", v)} placeholder="Paris et Île-de-France" />
                    <TextField label="Horaires" value={site.horaires} onChange={(v) => setSiteField("horaires", v)} placeholder="Du lundi au samedi, de 9h à 18h" />
                  </div>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "#6B7280", marginBottom: 7 }}>Spécialités</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      {(site.specialties || []).map((item) => (
                        <span key={item} style={{ fontSize: 13, fontWeight: 700, padding: "8px 14px", borderRadius: 16, background: "#EDEFFB", color: "#16233F", display: "flex", alignItems: "center", gap: 8 }}>
                          {item}
                          <button type="button" aria-label="Retirer" onClick={() => removeSpecialty(item)} style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", display: "flex" }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                          </button>
                        </span>
                      ))}
                      {addingSpecialty ? (
                        <input
                          autoFocus
                          value={specialtyDraft}
                          onChange={(e) => setSpecialtyDraft(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSpecialty(); } if (e.key === "Escape") { setAddingSpecialty(false); setSpecialtyDraft(""); } }}
                          onBlur={addSpecialty}
                          placeholder="Ex. Carrelage"
                          style={{ height: 36, borderRadius: 16, border: "1.5px solid #16233F", padding: "0 14px", fontSize: 13, fontWeight: 600 }}
                        />
                      ) : (
                        <button type="button" onClick={() => setAddingSpecialty(true)} style={{ fontSize: 13, fontWeight: 700, padding: "8px 14px", borderRadius: 16, border: "1.5px dashed #CBD0DC", color: "#6B7280", background: "transparent", cursor: "pointer" }}>
                          + Ajouter
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Step 4 — Contact */}
                <div ref={(el) => { stepRefs.current[4] = el; }} style={{ background: "#FFFFFF", border: "1px solid #EDEFF3", borderRadius: 20, padding: "24px 26px", display: "flex", flexDirection: "column", gap: 18 }}>
                  <StepHead number={4} title="Contact" sub="Repris de votre profil. Vous pouvez les adapter pour le site." done={step4Done} />
                  <div style={{ display: "flex", gap: 16 }}>
                    <TextField label="Téléphone" value={site.contactPhone} onChange={(v) => setSiteField("contactPhone", v)} placeholder="+33 7 66 21 26 74" />
                    <TextField label="E-mail" value={site.contactEmail} onChange={(v) => setSiteField("contactEmail", v)} placeholder="pro@entreprise.fr" />
                  </div>
                  <div style={{ display: "flex", gap: 16 }}>
                    <TextField label="Adresse" value={site.contactAddress} onChange={(v) => setSiteField("contactAddress", v)} placeholder="98 Quai de la Loire, 75019 Paris" />
                    <TextField label="Zone affichée" value={site.contactZoneAffichee} onChange={(v) => setSiteField("contactZoneAffichee", v)} placeholder="Paris et Île-de-France" />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 0", borderTop: "1px solid #F3F3F8" }}>
                    <div style={{ flex: "1 1 auto" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#1E2430" }}>Afficher le formulaire de demande de devis</div>
                      <div style={{ fontSize: 12.5, color: "#6B7280", marginTop: 2 }}>Les demandes arrivent dans vos notifications koji.</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSiteField("showContactForm", !site.showContactForm)}
                      aria-pressed={site.showContactForm}
                      style={{ flex: "0 0 auto", width: 42, height: 24, borderRadius: 12, background: site.showContactForm ? "#16233F" : "#CBD0DC", position: "relative", border: "none", cursor: "pointer" }}
                    >
                      <i style={{ position: "absolute", top: 3, left: site.showContactForm ? 21 : 3, width: 18, height: 18, borderRadius: "50%", background: "#FFFFFF", boxShadow: "0 1px 3px rgba(0,0,0,.25)", transition: "left 0.15s" }} />
                    </button>
                  </div>
                </div>

                {siteMessage ? <p className="profile-message">{siteMessage}</p> : null}

                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={() => saveSite(site.published)} disabled={siteSaving} className="button secondary">
                    {siteSaving ? "Enregistrement…" : "Enregistrer le brouillon"}
                  </button>
                  {site.published ? (
                    <button type="button" onClick={() => saveSite(false)} disabled={siteSaving} className="button secondary">Dépublier</button>
                  ) : null}
                </div>
              </div>

              {/* Preview sidebar */}
              <div style={{ flex: "0 0 300px", display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 20 }}>
                <div style={{ background: "#FFFFFF", border: "1px solid #EDEFF3", borderRadius: 18, padding: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#16233F", marginBottom: 12 }}>Aperçu du site</div>
                  <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #E1E4EC" }}>
                    <div style={{ height: 22, background: "#EEF0F6", display: "flex", alignItems: "center", gap: 5, paddingLeft: 9 }}>
                      <i style={{ width: 6, height: 6, borderRadius: "50%", background: "#CBD0DC" }} />
                      <i style={{ width: 6, height: 6, borderRadius: "50%", background: "#CBD0DC" }} />
                      <i style={{ width: 6, height: 6, borderRadius: "50%", background: "#CBD0DC" }} />
                      <span style={{ fontSize: 9.5, color: "#7A7F8E", marginLeft: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>/site/{site.slug}</span>
                    </div>
                    <div style={{ width: "100%", height: 200, overflow: "hidden", background: "#000B28" }}>
                      <iframe
                        key={previewKey}
                        src={`/site/${site.slug}`}
                        title="Aperçu du site"
                        style={{ width: 1440, height: 900, border: "none", transform: "scale(0.1861)", transformOrigin: "0 0", pointerEvents: "none" }}
                      />
                    </div>
                  </div>
                  <a href={`/site/${site.slug}`} target="_blank" rel="noreferrer" style={{ marginTop: 14, width: "100%", boxSizing: "border-box", height: 42, borderRadius: 12, border: "1px solid #DADDE6", background: "#FFFFFF", color: "#16233F", fontSize: 13.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, textDecoration: "none" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16233F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" /></svg>
                    Voir le site
                  </a>
                </div>
                <div style={{ background: "#EEF2FF", border: "1px solid #D7DFFB", borderRadius: 16, padding: "14px 16px", fontSize: 12.5, lineHeight: 1.55, color: "#2C3E80", display: "flex", gap: 8 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3B5BDB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto", marginTop: 1 }}><path d="M12 8h.01M11 12h1v5h1M12 21a9 9 0 100-18 9 9 0 000 18" /></svg>
                  Le site se met à jour dès que vous enregistrez.
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}
