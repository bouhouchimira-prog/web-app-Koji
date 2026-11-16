import { badRequest, ok } from "../../../../../lib/http";
import { readDb, writeDb } from "../../../../../lib/db";
import { fixText } from "../../../../../lib/text";
import { getSupabaseAdmin } from "../../../../../lib/supabase";
import { buildWebUser } from "../../../../../lib/user-profile";
import { checkRateLimit, recordFailedAttempt, rateLimitMessage } from "../../../../../lib/rate-limit";
import { ACCES, PIECES, QUAND, budgetDepuisChoix, offreKojiPage, texteProjet } from "../../../../../lib/kojipage";
import { enregistrerPhoto } from "../../../../../lib/kojipage-serveur";

// Demande de devis depuis la KojiPage (maquettes PRO-13.2 et 13.5) — route
// PUBLIQUE. Message simple ou projet décrit avec l'assistant Koji (pièce,
// surface, travaux, accès, quand, budget facultatif, photos). Adressée à
// cette entreprise seulement, sans jeton (offres Pro et Business). Le
// consentement à la transmission des coordonnées est obligatoire. Aucun prix
// n'est montré au client (décision du 10 nov.).
const t = (v, max) => fixText(String(v ?? "")).trim().slice(0, max);

export async function POST(request, context) {
  const { slug } = await context.params;
  const body = await request.json().catch(() => ({}));

  const name = t(body.name, 80);
  const phone = t(body.phone, 30);
  const email = t(body.email, 120);
  if (!name || (!phone && !email)) return badRequest("Indiquez votre nom et un moyen de vous recontacter (téléphone ou e-mail).", 400);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badRequest("Adresse e-mail invalide.");
  if (body.consentement !== true) return badRequest("Acceptez la transmission de vos coordonnées à l'entreprise pour envoyer la demande.");

  const rate = await checkRateLimit("site-lead", slug);
  if (!rate.allowed) return badRequest(rateLimitMessage(rate.retryAfterSeconds), 429);

  const db = await readDb();
  const site = (db.companySites || []).find((item) => item.slug === slug && item.published);
  if (!site) return badRequest("Ce site n'existe pas ou n'est plus publié.", 404);
  const { data: profile } = await getSupabaseAdmin().from("users").select("*").eq("id", site.userId).maybeSingle();
  const offre = offreKojiPage(buildWebUser({ id: site.userId, email: profile?.email || "", profile }));
  if (!offre.demandes) return badRequest("Cette entreprise ne reçoit pas encore de demandes par sa page. Appelez-la ou écrivez-lui directement.", 403);

  const p = body.projet && typeof body.projet === "object" ? body.projet : null;
  const projet = p ? {
    piece: PIECES.includes(p.piece) ? p.piece : t(p.piece, 40),
    surface: Math.max(0, Math.min(2000, Math.round(Number(p.surface) || 0))) || "",
    travaux: (Array.isArray(p.travaux) ? p.travaux : []).map((x) => t(x, 80)).filter(Boolean).slice(0, 10),
    precisions: t(p.precisions, 600),
    acces: ACCES.includes(p.acces) ? p.acces : "",
    quand: QUAND.includes(p.quand) ? p.quand : t(p.quand, 40)
  } : null;
  const message = t(body.message, 2000);
  if (!message && !projet?.travaux?.length) return badRequest("Décrivez votre projet en quelques mots.");

  // Photos (3 au plus, déjà réduites par le navigateur).
  const photos = [];
  for (const dataUrl of (Array.isArray(body.photos) ? body.photos : []).slice(0, 3)) {
    const m = /^data:(image\/(?:jpeg|png));base64,(.+)$/.exec(String(dataUrl || ""));
    if (!m) continue;
    const buffer = Buffer.from(m[2], "base64");
    if (buffer.length > 1.5 * 1024 * 1024) continue;
    photos.push(await enregistrerPhoto(site.userId, buffer, m[1]).catch(() => ""));
  }

  const now = new Date().toISOString();
  const lead = {
    id: `lead-${Date.now()}`,
    userId: site.userId,
    siteId: site.id,
    slug,
    name, phone, email,
    city: t(body.city, 80),
    prestation: t(body.prestation, 120),
    message,
    projet,
    budgetChoix: t(body.budgetChoix, 40),
    budget: budgetDepuisChoix(body.budgetChoix),
    photos: photos.filter(Boolean),
    source: ["carte", "assistant"].includes(body.source) ? body.source : "page",
    consentementLe: now,
    createdAt: now
  };
  db.companySiteLeads = [lead, ...(db.companySiteLeads || [])];
  db.notifications.unshift({
    id: `notif-site-lead-${lead.id}`,
    userId: site.userId,
    type: "site.lead",
    title: "Nouvelle demande de devis",
    message: `${name.split(/\s+/)[0]} a demandé un devis depuis votre KojiPage${lead.city ? ` (${lead.city})` : ""}.`,
    actionUrl: `/kojipage/demandes?id=${lead.id}`,
    actionLabel: "Voir la demande",
    meta: { leadId: lead.id, resume: projet ? texteProjet(projet).split("\n")[0] : message.slice(0, 120) },
    read: false,
    createdAt: now
  });
  await writeDb(db);
  await recordFailedAttempt("site-lead", slug);
  return ok({ ok: true });
}
