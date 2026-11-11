import { badRequest, ok } from "../../../lib/http";
import { readDb, writeDb } from "../../../lib/db";
import { isEmail } from "../../../lib/validators";

// Inscription à la fiche du mois de la rubrique Ressources (maquette
// SITE-05). Public, sans compte. On garde la preuve du consentement (date,
// texte accepté, page) comme le demande le RGPD ; rien n'est envoyé d'ici :
// l'outil d'envoi reste à choisir. Réponse identique qu'une adresse soit
// nouvelle ou déjà inscrite.
const CONSENT_TEXT = "J'accepte de recevoir une fiche par mois de Koji à cette adresse.";
const MAX_SUBSCRIBERS = 50000;

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest("Requête invalide.");
  }

  // Champ piège rempli = robot : on fait comme si tout allait bien.
  if (String(body?.website || "").trim()) return ok({ ok: true });

  const email = String(body?.email || "").trim().toLowerCase();
  if (email.length > 254 || isEmail(email)) return badRequest("Adresse e-mail invalide.");
  if (body?.consent !== true) return badRequest("Le consentement est nécessaire pour vous inscrire.");

  const db = await readDb();
  db.newsletterSubscribers = Array.isArray(db.newsletterSubscribers) ? db.newsletterSubscribers : [];
  const existing = db.newsletterSubscribers.find((entry) => entry.email === email);
  if (existing) {
    if (existing.unsubscribedAt) {
      existing.unsubscribedAt = null;
      existing.consentAt = new Date().toISOString();
      existing.consentText = CONSENT_TEXT;
      await writeDb(db);
    }
    return ok({ ok: true });
  }
  if (db.newsletterSubscribers.length >= MAX_SUBSCRIBERS) {
    return badRequest("Inscriptions momentanément fermées. Écrivez-nous à contact@getkoji.io.", 503);
  }

  db.newsletterSubscribers.push({
    email,
    consentAt: new Date().toISOString(),
    consentText: CONSENT_TEXT,
    source: "ressources",
    unsubscribedAt: null
  });
  await writeDb(db);
  return ok({ ok: true }, 201);
}
