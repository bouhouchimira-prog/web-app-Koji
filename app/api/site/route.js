import { badRequest, ok } from "../../../lib/http";
import { addHistory, getUserScope, readDb, resolveUserId, scopedItems, writeDb } from "../../../lib/db";
import { getAuth } from "../../../lib/server-auth";
import { buildWebUser } from "../../../lib/user-profile";
import {
  slugify, uniqueSlugFor, canPublish, normalizeRealisations, migrateLegacyRealisations, totalPhotoCount,
  sanitizeSiteContent, computeSiteCompletion, CTA_PRIMARY_DEFAULT, CTA_SECONDARY_DEFAULT, SITE_LIMITS
} from "../../../lib/company-sites";

// "Site web Koji" (option payante, addonWebsite) : un enregistrement par
// entreprise dans le blob JSON (comme db.invoices/db.avenants — pas encore
// partage avec l'app mobile). Les coordonnees affichees sur la page publique
// (nom, logo, telephone, email, adresse) restent lues en direct depuis le
// profil entreprise au moment de servir /api/site/[slug], mais chaque champ
// peut etre adapte pour le site (etape 4 "Contact" de l'editeur) — voir
// sanitizeSiteContent/publicSiteView dans lib/company-sites.js.

async function loadWebUser(request, body = null) {
  const auth = getAuth(request, body);
  if (!auth) return { error: badRequest("Session expirée. Reconnectez-vous.", 401) };
  const { data: profile, error } = await auth.supabase.from("users").select("*").eq("id", auth.userId).maybeSingle();
  if (error) return { error: badRequest(`Lecture du profil impossible: ${error.message}`, 500) };
  const user = buildWebUser({ id: auth.userId, email: profile?.email || "", profile });
  return { user };
}

// Gratuit pour les admins (comme la carte de visite l'etait a l'origine,
// voir app/api/business-card/route.js), sinon reserve a l'option payante
// "Site web Koji" (addonWebsite).
function hasWebsiteAccess(user) {
  return Boolean(user.addonWebsite || user.isAdmin);
}

function normalizeSite(site) {
  const realisations = migrateLegacyRealisations(site);
  const full = { ...site, realisations };
  return {
    ...full,
    photoCount: totalPhotoCount(realisations),
    canPublish: canPublish(full),
    completion: computeSiteCompletion(full),
    minPhotos: SITE_LIMITS.MIN_PUBLISH_PHOTOS,
    maxPhotosPerRealisation: SITE_LIMITS.MAX_PHOTOS_PER_REALISATION,
    maxRealisations: SITE_LIMITS.MAX_REALISATIONS,
    maxSpecialties: SITE_LIMITS.MAX_SPECIALTIES,
    limits: {
      title: SITE_LIMITS.MAX_TITLE,
      tagline: SITE_LIMITS.MAX_TAGLINE,
      presentationText: SITE_LIMITS.MAX_PRESENTATION_TEXT,
      companyDescription: SITE_LIMITS.MAX_COMPANY_DESCRIPTION,
      contactMessage: SITE_LIMITS.MAX_CONTACT_MESSAGE
    }
  };
}

export async function GET(request) {
  const { user, error } = await loadWebUser(request);
  if (error) return error;
  if (!hasWebsiteAccess(user)) {
    return badRequest("Le Site web Koji n'est pas inclus dans votre formule actuelle.", 402);
  }

  const db = await readDb();
  const userId = await getUserScope(request, db);
  const existing = scopedItems(db.companySites, userId)[0] || null;
  if (existing) return ok({ site: normalizeSite(existing) });

  const business = user.business || {};
  const addressParts = [business.addressLine1, business.addressLine2, business.postalCode, business.city].filter(Boolean);

  return ok({
    site: normalizeSite({
      id: "",
      userId: "",
      slug: uniqueSlugFor(db, business.raisonSociale || ""),
      published: false,
      mode: "koji",
      customUrl: "",
      title: "",
      tagline: "",
      presentationText: "",
      ctaPrimary: CTA_PRIMARY_DEFAULT,
      ctaSecondary: CTA_SECONDARY_DEFAULT,
      contactPhotoDataUrl: "",
      contactName: "",
      contactMessage: "",
      companyDescription: "",
      zoneIntervention: business.zoneAddress || "",
      horaires: "",
      specialties: Array.isArray(user.professions) ? user.professions.filter(Boolean) : [],
      contactPhone: business.phone || "",
      contactEmail: business.emailPro || "",
      contactAddress: addressParts.join(", "),
      contactZoneAffichee: business.zoneAddress || "",
      showContactForm: true,
      realisations: []
    })
  });
}

export async function PATCH(request) {
  const body = await request.json();
  const { user, error } = await loadWebUser(request, body);
  if (error) return error;
  if (!hasWebsiteAccess(user)) {
    return badRequest("Le Site web Koji n'est pas inclus dans votre formule actuelle.", 402);
  }

  const db = await readDb();
  const userId = await resolveUserId(request, body, db);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const now = new Date().toISOString();
  const existingIndex = db.companySites.findIndex((item) => item.userId === userId);
  const previous = existingIndex === -1 ? null : db.companySites[existingIndex];

  const requestedSlug = slugify(body.slug || previous?.slug || user.business?.raisonSociale || "");
  const slug = uniqueSlugFor(db, requestedSlug, previous?.id || "");
  const realisations = normalizeRealisations(body.realisations ?? migrateLegacyRealisations(previous) ?? []);
  const content = sanitizeSiteContent(body, previous || {});

  const draft = {
    id: previous?.id || `site-${Date.now()}`,
    userId,
    slug,
    ...content,
    realisations,
    published: Boolean(body.published ?? previous?.published ?? false),
    createdAt: previous?.createdAt || now,
    updatedAt: now
  };

  if (draft.published && !canPublish(draft)) {
    return badRequest(`Ajoutez au moins ${SITE_LIMITS.MIN_PUBLISH_PHOTOS} photos avant de publier votre site.`, 400);
  }

  if (existingIndex === -1) db.companySites.unshift(draft);
  else db.companySites[existingIndex] = draft;

  addHistory(db, {
    userId,
    type: "companySite.saved",
    label: draft.published ? `Site web publié : ${draft.slug}` : `Site web enregistré : ${draft.slug}`,
    entityId: draft.id,
    entityType: "companySite"
  });

  await writeDb(db);
  return ok({ site: normalizeSite(draft) });
}
