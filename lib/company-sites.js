// Shared helpers for the "Site web Koji" feature (db.companySites, blob JSON
// store — see lib/db.js, same "not yet shared with mobile" treatment as
// db.invoices/db.avenants), used by app/api/site/route.js and
// app/api/site/[slug]/route.js.

import { fixText } from "./text";

const MIN_PUBLISH_PHOTOS = 3;
const MAX_PHOTOS_PER_REALISATION = 10;
const MAX_REALISATIONS = 12;
const MAX_SPECIALTIES = 16;
const MAX_TITLE = 140;
const MAX_TAGLINE = 140;
const MAX_CTA_LABEL = 40;
const MAX_PRESENTATION_TEXT = 500;
const MAX_COMPANY_DESCRIPTION = 1000;
const MAX_CONTACT_MESSAGE = 300;
const MAX_CONTACT_NAME = 80;

export const CTA_PRIMARY_DEFAULT = "Obtenir un devis";
export const CTA_SECONDARY_DEFAULT = "Découvrir nos chantiers";

export function slugify(text) {
  return String(text || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

// Scans existing companySites for a collision and appends -2/-3... until
// free — same "scan existing, disambiguate" principle as nextQuoteNumberFor
// (lib/quote-mapping.js) et nextAvenantNumero (lib/avenant-mapping.js).
export function uniqueSlugFor(db, text, excludeId = "") {
  const base = slugify(text) || "entreprise";
  const taken = new Set(
    (db.companySites || [])
      .filter((site) => site.id !== excludeId)
      .map((site) => site.slug)
  );
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function normalizePhotoList(photos) {
  return (Array.isArray(photos) ? photos : [])
    .filter((item) => typeof item === "string" && item.startsWith("data:"))
    .slice(0, MAX_PHOTOS_PER_REALISATION);
}

// "Réalisations" (20 oct, demande d'Amira) : un chantier = un nom + une ou
// plusieurs photos, plutôt qu'une galerie plate sans contexte. Remplace
// l'ancien `site.photos` (tableau de data URLs).
export function normalizeRealisations(input) {
  const list = Array.isArray(input) ? input : [];
  return list
    .slice(0, MAX_REALISATIONS)
    .map((item, index) => ({
      id: item?.id || `real-${Date.now()}-${index}`,
      name: fixText(item?.name || ""),
      photos: normalizePhotoList(item?.photos)
    }))
    .filter((item) => item.name || item.photos.length > 0);
}

// Un site enregistré avant le 20 oct avait un tableau plat `photos` — migré
// en un unique chantier sans nom plutôt que de le faire disparaître
// silencieusement au premier chargement après la mise à jour.
export function migrateLegacyRealisations(site) {
  if (Array.isArray(site?.realisations)) return site.realisations;
  const legacyPhotos = normalizePhotoList(site?.photos);
  return legacyPhotos.length
    ? [{ id: `real-legacy-${site.id || "0"}`, name: "", photos: legacyPhotos }]
    : [];
}

export function totalPhotoCount(realisations) {
  return (Array.isArray(realisations) ? realisations : [])
    .reduce((sum, item) => sum + (Array.isArray(item.photos) ? item.photos.length : 0), 0);
}

export function canPublish(site) {
  return totalPhotoCount(site?.realisations) >= MIN_PUBLISH_PHOTOS;
}

export function normalizeSpecialties(input) {
  return (Array.isArray(input) ? input : [])
    .map((item) => fixText(item || "").trim())
    .filter(Boolean)
    .slice(0, MAX_SPECIALTIES);
}

function capText(value, max) {
  return fixText(value || "").trim().slice(0, max);
}

// Les 4 étapes de l'éditeur (Présentation / Réalisations / L'entreprise /
// Contact, maquette ProfilSiteInfos du 21 oct) — un seul endroit pour
// nettoyer/plafonner chaque champ texte, utilisé par le PATCH de
// app/api/site/route.js. Les realisations et le mode d'adresse (koji vs URL
// perso) sont geres a part (normalizeRealisations / champs mode-customUrl
// simples) car ils ne sont pas de simples chaines.
export function sanitizeSiteContent(body = {}, previous = {}) {
  const pick = (key, max) => capText(body[key] ?? previous[key] ?? "", max);
  return {
    title: pick("title", MAX_TITLE),
    tagline: pick("tagline", MAX_TAGLINE),
    presentationText: pick("presentationText", MAX_PRESENTATION_TEXT),
    ctaPrimary: pick("ctaPrimary", MAX_CTA_LABEL) || CTA_PRIMARY_DEFAULT,
    ctaSecondary: pick("ctaSecondary", MAX_CTA_LABEL) || CTA_SECONDARY_DEFAULT,
    contactPhotoDataUrl: /^data:/.test(body.contactPhotoDataUrl || "") ? body.contactPhotoDataUrl : (previous.contactPhotoDataUrl || ""),
    contactName: pick("contactName", MAX_CONTACT_NAME),
    contactMessage: pick("contactMessage", MAX_CONTACT_MESSAGE),
    companyDescription: pick("companyDescription", MAX_COMPANY_DESCRIPTION),
    zoneIntervention: pick("zoneIntervention", 140),
    horaires: pick("horaires", 140),
    specialties: normalizeSpecialties(body.specialties ?? previous.specialties ?? []),
    contactPhone: pick("contactPhone", 40),
    contactEmail: pick("contactEmail", 120),
    contactAddress: pick("contactAddress", 200),
    contactZoneAffichee: pick("contactZoneAffichee", 140),
    showContactForm: body.showContactForm ?? previous.showContactForm ?? true,
    mode: body.mode === "custom" ? "custom" : "koji",
    customUrl: body.mode === "custom" ? capText(body.customUrl, 200) : ""
  };
}

// Completude de l'editeur (carte "Site complete", meme principe que
// app/profil/page.jsx::completude) — chaque item compte pour 1/N, le
// premier manquant devient le message affiche.
export function computeSiteCompletion(site) {
  const items = [
    { done: Boolean(site.title), label: "un titre principal" },
    { done: Boolean(site.tagline), label: "une phrase d'accroche" },
    { done: Boolean(site.presentationText), label: "un texte de présentation" },
    { done: totalPhotoCount(site.realisations) > 0, label: "au moins une réalisation avec photo" },
    { done: Boolean(site.companyDescription), label: "une description de l'entreprise" },
    { done: Boolean(site.zoneIntervention), label: "votre zone d'intervention" },
    { done: (site.specialties || []).length > 0, label: "au moins une spécialité" },
    { done: Boolean(site.contactPhone || site.contactEmail), label: "un moyen de contact" }
  ];
  const doneCount = items.filter((item) => item.done).length;
  const pct = Math.round((doneCount / items.length) * 100);
  const missing = items.find((item) => !item.done);
  return { pct, missing: missing?.label || "" };
}

// Curated projection served by the PUBLIC route — never SIRET/IBAN/internal
// fields, only what a visitor should see. Chaque champ "site.*" l'emporte
// sur sa valeur par defaut tiree du profil entreprise quand il a ete
// explicitement renseigne dans l'editeur (etape 4 "Contact" : reprises du
// profil mais adaptables pour le site).
export function publicSiteView(site, business = {}, professions = []) {
  const addressParts = [business.addressLine1, business.addressLine2, business.postalCode, business.city]
    .filter(Boolean);
  const specialties = (site.specialties || []).length ? site.specialties : (Array.isArray(professions) ? professions.filter(Boolean) : []);
  return {
    slug: site.slug,
    name: business.raisonSociale || "",
    logoDataUrl: business.logoDataUrl || "",
    title: site.title || "",
    tagline: site.tagline || "",
    presentationText: site.presentationText || "",
    ctaPrimary: site.ctaPrimary || CTA_PRIMARY_DEFAULT,
    ctaSecondary: site.ctaSecondary || CTA_SECONDARY_DEFAULT,
    contactPhotoDataUrl: site.contactPhotoDataUrl || "",
    contactName: site.contactName || "",
    contactMessage: site.contactMessage || "",
    companyDescription: site.companyDescription || "",
    zoneIntervention: site.zoneIntervention || business.zoneAddress || "",
    horaires: site.horaires || "",
    specialties,
    professions: Array.isArray(professions) ? professions.filter(Boolean) : [],
    phone: site.contactPhone || business.phone || "",
    email: site.contactEmail || business.emailPro || "",
    address: site.contactAddress || addressParts.join(", "),
    zoneAffichee: site.contactZoneAffichee || site.zoneIntervention || business.zoneAddress || "",
    showContactForm: site.showContactForm !== false,
    realisations: (site.realisations || []).map((item) => ({ name: item.name, photos: normalizePhotoList(item.photos) }))
  };
}

export const SITE_LIMITS = {
  MIN_PUBLISH_PHOTOS, MAX_PHOTOS_PER_REALISATION, MAX_REALISATIONS, MAX_SPECIALTIES,
  MAX_TITLE, MAX_TAGLINE, MAX_PRESENTATION_TEXT, MAX_COMPANY_DESCRIPTION, MAX_CONTACT_MESSAGE
};
