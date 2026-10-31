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

const STEPS = [
  { key: 1, title: "Présentation", sub: "Titre, accroche, photo" },
  { key: 2, title: "Réalisations", sub: "Vos chantiers" },
  { key: 3, title: "L'entreprise", sub: "Description" },
  { key: 4, title: "Contact", sub: "Coordonnées" }
];

function Field({ label, required, value, onChange, placeholder, full }) {
  return (
    <label className={full ? "full" : undefined}>
      <span>{label}{required ? <span style={{ color: "#C2570C" }}>{" *"}</span> : null}</span>
      <input value={value || ""} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
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

  const siteHost = siteUrl.replace(/^https?:\/\//, "");
  const steps = [
    { n: 1, label: "Présentation", done: step1Done },
    { n: 2, label: "Réalisations", done: step2Done },
    { n: 3, label: "L'entreprise", done: step3Done },
    { n: 4, label: "Contact", done: step4Done }
  ];

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow">{site?.slug ? `/site/${site.slug} · ${site.published ? "en ligne" : "brouillon"}` : "Profil et compte"}</span>
          <h1>KojiPage</h1>
          <span className="muted">Renseignez vos informations. Votre site est mis en forme automatiquement.</span>
        </div>
        {site?.slug ? (
          <div className="hact">
            <a className="btn btn-sec" href={`/site/${site.slug}`} target="_blank" rel="noreferrer">Voir ma page</a>
            <button type="button" className="btn btn-sec" onClick={copySiteLink}>{siteCopied ? "Lien copié" : "Copier le lien"}</button>
            <button type="button" className="btn btn-main" onClick={() => saveSite(true)} disabled={siteSaving}>
              {siteSaving ? "Enregistrement…" : "Publier les modifications"}
            </button>
          </div>
        ) : null}
      </div>

      {site && websiteAccess ? (
        <div className="tbar">
          <div className="wtabs" role="tablist" aria-label="KojiPage">
            <a className="on" role="tab" aria-selected="true" href="/profil/site-web">Profil</a>
            <a role="tab" aria-selected="false" href="/profil/carte-de-visite">Carte de visite</a>
          </div>
        </div>
      ) : null}

      {!user ? (
        <section className="card"><p className="empty">{L.common.loading}</p></section>
      ) : !websiteAccess ? (
        <section className="card">
          <div className="card-h"><h2>Site web Koji</h2></div>
          <p className="muted">{L.parametres.websiteUpsell}</p>
          <div className="ed-act">
            <Link href="/parametres/abonnement" className="btn btn-main">{L.parametres.websiteUpsellCta}</Link>
          </div>
        </section>
      ) : siteLoading || !site ? (
        <section className="card"><p className="empty">{L.common.loading}</p></section>
      ) : (
        <div className="kj-grid">
          <div className="kj-col">
            <section className="card">
              <div className="card-h">
                <h2>Page complète à {site.completion?.pct ?? 0} %</h2>
                <span className="sm2">{site.completion?.missing ? `Il manque ${site.completion.missing}` : "Votre page est complète"}</span>
              </div>
              <div className="kj-bar"><i style={{ width: `${site.completion?.pct ?? 0}%` }} /></div>
              <div className="kj-cks">
                {steps.map((step) => (
                  <button key={step.n} type="button" className={`kj-ck kj-ck-btn${step.done ? " ok" : ""}`} onClick={() => scrollToStep(step.n)}>
                    <span className="kj-cb">{step.done ? <svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-11" /></svg> : null}</span>
                    <span className="t">{step.label}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="card">
              <div className="card-h"><h2>Adresse de la page</h2></div>
              <button type="button" className={`kj-tg${site.mode !== "custom" ? " on" : ""}`} aria-pressed={site.mode !== "custom"} onClick={() => setSiteField("mode", "koji")}>
                <span>Site créé par Koji<small>Créé à partir de votre profil. Vous n'avez rien à installer.</small></span>
                <i><b /></i>
              </button>
              <div style={{ paddingBottom: 10 }}>
                <span className="sm2" style={{ display: "block", marginBottom: 4 }}>{siteHost}</span>
              </div>
              <button type="button" className={`kj-tg${site.mode === "custom" ? " on" : ""}`} aria-pressed={site.mode === "custom"} onClick={() => setSiteField("mode", "custom")}>
                <span>J'ai déjà un site<small>Votre site existant est utilisé sur la carte de visite et dans le QR code.</small></span>
                <i><b /></i>
              </button>
              <input
                className="kj-url"
                value={site.customUrl || ""}
                onChange={(e) => setSiteField("customUrl", e.target.value)}
                disabled={site.mode !== "custom"}
                placeholder="https://www.mon-site.fr"
              />
            </section>

            <section ref={(el) => { stepRefs.current[1] = el; }} className="card">
              <div className="card-h"><h2>Présentation</h2>{step1Done ? <span className="tag tag-b">Complet</span> : null}</div>
              <p className="kj-p">Le haut de votre site : ce que les clients voient en premier.</p>
              <div className="fgrid">
                <Field full label="Titre principal" required value={site.title} onChange={(v) => setSiteField("title", v)} placeholder="Vos travaux de rénovation, à Paris et en Île-de-France" />
                <Field full label="Phrase d'accroche" value={site.tagline} onChange={(v) => setSiteField("tagline", v)} placeholder="Un chantier soigné, des délais respectés." />
                <label className="full">
                  Texte de présentation
                  <textarea
                    value={site.presentationText}
                    onChange={(e) => setSiteField("presentationText", e.target.value.slice(0, site.limits?.presentationText || 500))}
                    rows={4}
                    placeholder="Décrivez votre entreprise, vos savoir-faire, vos chantiers phares…"
                  />
                  <span className="kj-cnt">{(site.presentationText || "").length} / {site.limits?.presentationText || 500}</span>
                </label>
                <Field label="Bouton principal" value={site.ctaPrimary} onChange={(v) => setSiteField("ctaPrimary", v)} placeholder="Obtenir un devis" />
                <Field label="Bouton secondaire" value={site.ctaSecondary} onChange={(v) => setSiteField("ctaSecondary", v)} placeholder="Découvrir nos chantiers" />
                <div>
                  <span className="flab">Photo du contact · facultatif</span>
                  <button type="button" className="kj-phi" onClick={() => contactPhotoRef.current?.click()}>
                    {site.contactPhotoDataUrl ? <img src={site.contactPhotoDataUrl} alt="Contact" /> : "Ajouter une photo"}
                  </button>
                  <input ref={contactPhotoRef} type="file" accept="image/*" onChange={onContactPhotoChange} style={{ display: "none" }} />
                </div>
                <div>
                  <Field label="Nom du contact chantier" value={site.contactName} onChange={(v) => setSiteField("contactName", v)} placeholder="M. Bouhouchi" />
                  <Field label="Message du contact" value={site.contactMessage} onChange={(v) => setSiteField("contactMessage", v)} placeholder="Je pilote votre projet, du premier rendez-vous à la livraison." />
                </div>
              </div>
            </section>

            <section ref={(el) => { stepRefs.current[2] = el; }} className="card">
              <div className="card-h"><h2>Réalisations</h2>{step2Done ? <span className="tag tag-b">Complet</span> : null}</div>
              <p className="kj-p">Un chantier = un nom + une ou plusieurs photos.</p>
              <div className="kj-col" style={{ gap: 12 }}>
                {(site.realisations || []).map((item) => (
                  <div key={item.id} className="kj-real">
                    <div className="kj-real-h">
                      <input value={item.name} onChange={(event) => setRealisationName(item.id, event.target.value)} placeholder="Nom du chantier (ex. Rénovation d'un salon)" />
                      <button type="button" className="btn btn-sec" onClick={() => removeRealisation(item.id)}>Supprimer</button>
                    </div>
                    <div className="kj-thumbs">
                      {item.photos.map((photo, index) => (
                        <div key={index} className="kj-thumb">
                          <img src={photo} alt={`${item.name || "Chantier"} ${index + 1}`} />
                          <button type="button" className="kj-thumb-x" aria-label="Retirer cette photo" onClick={() => removeRealisationPhoto(item.id, index)}>×</button>
                        </div>
                      ))}
                      {item.photos.length < (site.maxPhotosPerRealisation || 10) ? (
                        <button type="button" className="kj-thumb kj-thumb-add" onClick={() => openRealisationPhotoPicker(item.id)}>+ Photos</button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
              <div className="ed-act" style={{ marginTop: 12 }}>
                <button type="button" className="btn btn-sec" onClick={addRealisation}>Ajouter un chantier</button>
              </div>
              <input ref={siteFileRef} type="file" accept="image/*" multiple onChange={onRealisationPhotoChange} style={{ display: "none" }} />
            </section>

            <section ref={(el) => { stepRefs.current[3] = el; }} className="card">
              <div className="card-h"><h2>L'entreprise</h2>{step3Done ? <span className="tag tag-b">Complet</span> : null}</div>
              <p className="kj-p">Une description de votre entreprise et de votre façon de travailler.</p>
              <div className="fgrid">
                <label className="full">
                  Description
                  <textarea
                    value={site.companyDescription}
                    onChange={(e) => setSiteField("companyDescription", e.target.value.slice(0, site.limits?.companyDescription || 1000))}
                    rows={5}
                    placeholder="BOUHOUCHI est spécialisée dans..."
                  />
                  <span className="kj-cnt">{(site.companyDescription || "").length} / {site.limits?.companyDescription || 1000}</span>
                </label>
                <Field label="Zone d'intervention" value={site.zoneIntervention} onChange={(v) => setSiteField("zoneIntervention", v)} placeholder="Paris et Île-de-France" />
                <Field label="Horaires" value={site.horaires} onChange={(v) => setSiteField("horaires", v)} placeholder="Du lundi au samedi, de 9h à 18h" />
              </div>
              <div style={{ marginTop: 16 }}>
                <span className="flab">Spécialités</span>
                <div className="kj-chips" style={{ marginTop: 8 }}>
                  {(site.specialties || []).map((item) => (
                    <span key={item} className="kj-chip">
                      {item}
                      <button type="button" aria-label="Retirer" onClick={() => removeSpecialty(item)}>×</button>
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
                      style={{ height: 36, padding: "0 12px", border: "1px solid var(--ink)", borderRadius: 2, font: "inherit", fontSize: 13 }}
                    />
                  ) : (
                    <button type="button" className="kj-chip-add" onClick={() => setAddingSpecialty(true)}>+ Ajouter</button>
                  )}
                </div>
              </div>
            </section>

            <section ref={(el) => { stepRefs.current[4] = el; }} className="card">
              <div className="card-h"><h2>Contact</h2>{step4Done ? <span className="tag tag-b">Complet</span> : null}</div>
              <p className="kj-p">Repris de votre profil. Vous pouvez les adapter pour le site.</p>
              <div className="fgrid">
                <Field label="Téléphone" value={site.contactPhone} onChange={(v) => setSiteField("contactPhone", v)} placeholder="+33 7 66 21 26 74" />
                <Field label="E-mail" value={site.contactEmail} onChange={(v) => setSiteField("contactEmail", v)} placeholder="pro@entreprise.fr" />
                <Field label="Adresse" value={site.contactAddress} onChange={(v) => setSiteField("contactAddress", v)} placeholder="98 Quai de la Loire, 75019 Paris" />
                <Field label="Zone affichée" value={site.contactZoneAffichee} onChange={(v) => setSiteField("contactZoneAffichee", v)} placeholder="Paris et Île-de-France" />
              </div>
              <button type="button" className={`kj-tg${site.showContactForm ? " on" : ""}`} aria-pressed={Boolean(site.showContactForm)} onClick={() => setSiteField("showContactForm", !site.showContactForm)} style={{ marginTop: 12 }}>
                <span>Afficher le formulaire de demande de devis<small>Les demandes arrivent dans vos notifications koji.</small></span>
                <i><b /></i>
              </button>
            </section>

            {siteMessage ? <p className="notice" role="status">{siteMessage}</p> : null}

            <div className="kj-acts">
              <button type="button" className="btn btn-sec" onClick={() => saveSite(site.published)} disabled={siteSaving}>
                {siteSaving ? "Enregistrement…" : "Enregistrer le brouillon"}
              </button>
              {site.published ? (
                <button type="button" className="btn btn-sec" onClick={() => saveSite(false)} disabled={siteSaving}>Dépublier</button>
              ) : null}
            </div>
          </div>

          <aside className="kj-prev">
            <div className="kj-ph-h"><span className="lab">Aperçu</span><span className="sm2">Le site se met à jour à l'enregistrement</span></div>
            <div className="kj-screen">
              <iframe key={previewKey} src={`/site/${site.slug}`} title="Aperçu du site" />
            </div>
            <a className="btn btn-sec" href={`/site/${site.slug}`} target="_blank" rel="noreferrer">Voir le site</a>
          </aside>
        </div>
      )}
    </Shell>
  );
}
