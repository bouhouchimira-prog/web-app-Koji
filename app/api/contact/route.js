import { badRequest, ok } from "../../../lib/http";
import { readDb, writeDb } from "../../../lib/db";
import { sendContactRequestEmail } from "../../../lib/mailer";

// Formulaire public « Contact et démonstration » (maquette SITE-06,
// getkoji.io/entreprise/contact). Sans compte. La demande est gardée
// (db.contactRequests, avec la preuve du consentement) et envoyée à la boîte
// de contact ; si l'e-mail ne part pas, elle reste enregistrée et la
// personne voit quand même que c'est reçu.
const OBJETS = {
  demonstration: "Une démonstration",
  question: "Une question",
  reprise: "Reprendre mon existant",
  autre: "Autre chose"
};
const CONSENT_TEXT = "J'accepte d'être recontacté par Koji à ce sujet.";
const MAX_REQUESTS = 20000;

function clean(value, max) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest("Requête invalide.");
  }

  // Champ piège rempli = robot : réponse normale, rien n'est gardé.
  if (clean(body?.website, 200)) return ok({ ok: true });

  const nom = clean(body?.nom, 120);
  const entreprise = clean(body?.entreprise, 160);
  const coordonnees = clean(body?.coordonnees, 160);
  const message = String(body?.message || "").trim().slice(0, 2000);
  const objet = OBJETS[body?.objet] || OBJETS.autre;

  if (!nom) return badRequest("Indiquez votre nom.");
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(coordonnees);
  const telephone = coordonnees.replace(/[^\d+]/g, "").length >= 9;
  if (!email && !telephone) return badRequest("Indiquez un téléphone ou un e-mail pour qu'on puisse vous répondre.");
  if (body?.consent !== true) return badRequest("Cochez la case pour qu'on puisse vous recontacter.");

  const db = await readDb();
  db.contactRequests = Array.isArray(db.contactRequests) ? db.contactRequests : [];
  if (db.contactRequests.length >= MAX_REQUESTS) db.contactRequests.shift();
  const now = new Date().toISOString();
  const entry = {
    id: `contact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    objet,
    nom,
    entreprise,
    coordonnees,
    message,
    consentAt: now,
    consentText: CONSENT_TEXT,
    createdAt: now,
    mailSent: false
  };
  db.contactRequests.push(entry);
  await writeDb(db);

  const sent = await sendContactRequestEmail({ objet, nom, entreprise, coordonnees, message });
  if (sent.ok) {
    entry.mailSent = true;
    await writeDb(db);
  }
  return ok({ ok: true }, 201);
}
