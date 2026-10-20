import { badRequest, ok } from "../../../../../lib/http";
import { readDb, writeDb } from "../../../../../lib/db";
import { fixText } from "../../../../../lib/text";
import { checkRateLimit, recordFailedAttempt, rateLimitMessage } from "../../../../../lib/rate-limit";

// Formulaire "Demande de devis" du site public (/site/[slug]) — route
// PUBLIQUE, aucune session requise, meme esprit que le GET de
// app/api/site/[slug]/route.js. Pas de boite de reception dediee
// aujourd'hui : la demande est stockee dans db.companySiteLeads ET pousse
// une notification a l'entreprise (meme db.notifications que
// quote.signed/radar.message, lue par app/notifications) — zero nouvelle UI
// a construire pour que la demande arrive quelque part de reel.
//
// checkRateLimit/recordFailedAttempt (lib/rate-limit.js) ont ete ecrits pour
// le brute-force de connexion, mais sont deja generiques (scope+identifiant,
// fenetre glissante, verrou) — reutilises tels quels ici pour plafonner les
// soumissions d'un meme site (8 / 15 min), seule protection anti-spam dont
// ce formulaire public a besoin.
export async function POST(request, context) {
  const { slug } = await context.params;
  const body = await request.json().catch(() => ({}));

  const name = fixText(body.name || "").trim();
  const phone = fixText(body.phone || "").trim();
  const email = fixText(body.email || "").trim();
  const city = fixText(body.city || "").trim();
  const prestation = fixText(body.prestation || "").trim();
  const message = fixText(body.message || "").trim();

  if (!name || (!phone && !email)) {
    return badRequest("Indiquez votre nom et un moyen de vous recontacter (téléphone ou e-mail).", 400);
  }

  const rate = await checkRateLimit("site-lead", slug);
  if (!rate.allowed) return badRequest(rateLimitMessage(rate.retryAfterSeconds), 429);

  const db = await readDb();
  const site = db.companySites.find((item) => item.slug === slug && item.published);
  if (!site) return badRequest("Ce site n'existe pas ou n'est plus publié.", 404);

  const now = new Date().toISOString();
  const lead = {
    id: `lead-${Date.now()}`,
    userId: site.userId,
    siteId: site.id,
    slug,
    name,
    phone,
    email,
    city,
    prestation,
    message,
    createdAt: now
  };
  db.companySiteLeads.unshift(lead);

  db.notifications.unshift({
    id: `notif-site-lead-${lead.id}`,
    userId: site.userId,
    type: "site.lead",
    title: "Nouvelle demande de devis",
    message: `${name} a demandé un devis depuis votre site web${city ? ` (${city})` : ""}.`,
    actionUrl: "/profil/site-web",
    actionLabel: "Voir le site web",
    meta: { name, phone, email, city, prestation, message },
    read: false,
    createdAt: now
  });

  await writeDb(db);
  await recordFailedAttempt("site-lead", slug);

  return ok({ ok: true });
}
