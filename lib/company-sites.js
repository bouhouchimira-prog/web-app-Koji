// Shared helpers for the "Site web Koji" feature (db.companySites, blob JSON
// store — see lib/db.js, same "not yet shared with mobile" treatment as
// db.invoices/db.avenants), used by app/api/site/route.js and
// app/api/site/[slug]/route.js.

const MIN_PUBLISH_PHOTOS = 3;
const MAX_PHOTOS = 8;

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
// (lib/quote-mapping.js) and nextAvenantNumero (lib/avenant-mapping.js).
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

export function canPublish(site) {
  return Array.isArray(site?.photos) && site.photos.length >= MIN_PUBLISH_PHOTOS;
}

export function normalizePhotos(photos) {
  return (Array.isArray(photos) ? photos : [])
    .filter((item) => typeof item === "string" && item.startsWith("data:"))
    .slice(0, MAX_PHOTOS);
}

// Curated projection served by the PUBLIC route — never SIRET/IBAN/internal
// fields, only what a visitor should see.
export function publicSiteView(site, business = {}) {
  const addressParts = [business.addressLine1, business.addressLine2, business.postalCode, business.city]
    .filter(Boolean);
  return {
    slug: site.slug,
    name: business.raisonSociale || "",
    logoDataUrl: business.logoDataUrl || "",
    phone: business.phone || "",
    email: business.emailPro || "",
    address: addressParts.join(", "),
    tagline: site.tagline || "",
    description: site.description || "",
    photos: normalizePhotos(site.photos)
  };
}

export const SITE_LIMITS = { MIN_PUBLISH_PHOTOS, MAX_PHOTOS };
