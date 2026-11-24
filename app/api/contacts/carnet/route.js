import Anthropic from "@anthropic-ai/sdk";
import { randomBytes } from "node:crypto";
import { badRequest, ok } from "../../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../../lib/db";
import { resolveEntreprise, loadEntrepriseProfile } from "../../../../lib/entreprise-auth";
import { CONTACT_ROLES, contactDisplayName } from "../../../../lib/contacts";
import { DOCS_VIGILANCE, doublon, lireCsvContacts, piecesDuPro, chantiersDuPro, vigilance } from "../../../../lib/contacts-pro";
import { contexteCarnet, ficheCarnet, importerClientsDesDevis, ligneCarnet } from "../../../../lib/contacts-serveur";
import { importerClientsDesChantiers } from "../../../../lib/client-du-chantier";
import { annuaireContact } from "../../../../lib/sirene";
import { sendClientMessageEmail } from "../../../../lib/mailer";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { fixObjectText, fixText } from "../../../../lib/text";

// Contacts (maquettes PRO-10 à 10.3) : carnet unique, prochaine action par
// fiche, documents de vigilance des sous-traitants, ajout par carte de
// visite, SIREN ou fichier. Contacts dans db.contacts (même carnet que
// /api/contacts, qu'utilisent le devis et l'ancienne page Clients).
export const maxDuration = 60;
const texte = (v, max = 160) => fixText(String(v ?? "")).replace(/\s+/g, " ").trim().slice(0, max);
const today = () => new Date().toISOString().slice(0, 10);
const jourOk = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(String(d || "")) ? d : "");
const baseUrl = (request) => process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

async function contexte(request, body) {
  const entreprise = await resolveEntreprise(request, body);
  if (!entreprise) return { erreur: badRequest("Connexion requise.", 401) };
  return { entreprise };
}

function liste(db, ctx, userId, { archives = false } = {}) {
  const aujourdhui = today();
  const toutes = (db.contacts || []).filter((c) => c.userId === userId).map((c) => ligneCarnet(c, ctx, aujourdhui).ligne);
  // Onglet d'archive « Inactifs » (PRO-19.1), toujours en dernier.
  const lignes = archives ? toutes : toutes.filter((l) => !l.inactif);
  const inactifs = toutes.filter((l) => l.inactif);
  return {
    contacts: lignes,
    inactifs,
    compteurs: { inactifs: inactifs.length, tous: lignes.length, aFaire: lignes.filter((l) => l.aFaire).length, clients: lignes.filter((l) => !l.pro).length, pros: lignes.filter((l) => l.pro).length }
  };
}

export async function GET(request) {
  const { entreprise, erreur } = await contexte(request);
  if (erreur) return erreur;
  const url = new URL(request.url);
  const db = await readDb();
  const docFichier = url.searchParams.get("document");
  if (docFichier) {
    const c = (db.contacts || []).find((x) => x.id === url.searchParams.get("id") && x.userId === entreprise.userId);
    const path = c?.vigilance?.[docFichier]?.fichier?.path;
    if (!path) return badRequest("Document introuvable.", 404);
    const { data, error } = await getSupabaseAdmin().storage.from("quote_attachments").createSignedUrl(path, 600);
    if (error) return badRequest("Document introuvable.", 404);
    return Response.redirect(data.signedUrl, 302);
  }
  const ctx = await contexteCarnet(entreprise, db);
  // Le carnet se remplit seul : clients des devis envoyés ou signés, et
  // clients des chantiers ajoutés à la main (retours du build 64).
  const desDevis = importerClientsDesDevis(db, entreprise.userId, ctx.quotes);
  const desChantiers = importerClientsDesChantiers(db, entreprise.userId, ctx.chantiers);
  if (desDevis || desChantiers) {
    await writeDb(db);
    // Les liens viennent d'être créés : le contexte les voit tout de suite.
    ctx.liens = (db.chantierContacts || []).filter((l) => l.userId === entreprise.userId);
  }
  const id = url.searchParams.get("id");
  if (id) {
    const c = (db.contacts || []).find((x) => x.id === id && x.userId === entreprise.userId);
    if (!c) return badRequest("Contact introuvable.", 404);
    return ok({ fiche: ficheCarnet(c, ctx, today()) });
  }
  const l = liste(db, ctx, entreprise.userId, { archives: url.searchParams.get("archives") === "1" });
  if (url.searchParams.get("compteurs") === "1") return ok({ compteurs: l.compteurs });
  return ok(l);
}

// Champs d'une fiche (création et modification).
const CHAMPS = ["type", "firstName", "lastName", "companyName", "siret", "contactPerson", "phone", "email", "address", "city", "postalCode", "floor", "accessCode", "complement", "accessInstructions", "notes", "metier", "genreClient", "preferences", "disponibilite", "activite"];
function appliquer(contact, body) {
  for (const k of CHAMPS) if (Object.prototype.hasOwnProperty.call(body, k)) contact[k] = texte(body[k], k === "notes" ? 2000 : 200);
  if (Array.isArray(body.roles)) contact.roles = body.roles.filter((r) => CONTACT_ROLES.includes(r));
  if (Array.isArray(body.personnes)) contact.personnes = body.personnes.slice(0, 10).map((p, i) => ({ id: p.id || `pe-${Date.now()}-${i}`, nom: texte(p.nom, 80), role: texte(p.role, 80), telephone: texte(p.telephone, 30), email: texte(p.email, 120) })).filter((p) => p.nom);
  if (body.facturation && typeof body.facturation === "object") contact.facturation = { identique: body.facturation.identique !== false, adresse: texte(body.facturation.adresse, 200), email: texte(body.facturation.email, 120), commande: texte(body.facturation.commande, 60) };
  if (body.syndic && typeof body.syndic === "object") contact.syndic = fixObjectText(Object.fromEntries(["gestionnaire", "conseil", "vote", "paiement", "acces", "documents"].map((k) => [k, texte(body.syndic[k], 200)])));
  if (body.fournisseur && typeof body.fournisseur === "object") contact.fournisseurInfo = fixObjectText(Object.fromEntries(["compte", "remises", "paiement", "franco", "commercial"].map((k) => [k, texte(body.fournisseur[k], 200)])));
  if (body.prescripteur && typeof body.prescripteur === "object") contact.prescripteurInfo = fixObjectText(Object.fromEntries(["remerciement", "preference"].map((k) => [k, texte(body.prescripteur[k], 200)])));
  if (Array.isArray(body.chantiersApportes)) contact.chantiersApportes = body.chantiersApportes.map(String).slice(0, 50);
}

const CARTE = {
  name: "lire_carte",
  description: "Lecture d'une carte de visite, d'un en-tête de devis ou de facture d'une entreprise.",
  input_schema: {
    type: "object",
    properties: {
      entreprise: { type: "string" }, contact: { type: "string", description: "Prénom et nom de la personne" }, fonction: { type: "string" },
      activite: { type: "string", description: "Métier ou activité écrite (ex. électricité générale)" },
      telephone: { type: "string" }, email: { type: "string" }, siret: { type: "string", description: "SIRET ou SIREN, chiffres seulement" }, ville: { type: "string" },
      type: { type: "string", enum: ["client", "sous_traitant", "fournisseur", "architecte", "prospect"], description: "Type le plus probable pour une entreprise du bâtiment" }
    },
    required: ["type"]
  }
};

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { entreprise, erreur } = await contexte(request, body);
  if (erreur) return erreur;
  const userId = entreprise.userId;
  const db = await readDb();
  db.contacts = db.contacts || [];
  const miens = db.contacts.filter((c) => c.userId === userId);

  if (body.action === "siren") {
    const fiche = await annuaireContact(body.siren);
    if (!fiche) return badRequest("Aucune entreprise trouvée pour ce SIREN dans l'annuaire.", 404);
    return ok({ fiche, doublon: doublon(miens, { siret: fiche.siret || fiche.siren })?.contact?.id || "" });
  }

  if (body.action === "carte") {
    const m = /^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,(.+)$/.exec(String(body.data || ""));
    if (!m) return badRequest("Ajoutez la photo de la carte de visite.");
    if (!process.env.ANTHROPIC_API_KEY) return badRequest("La lecture par Koji n'est pas disponible : saisissez le contact à la main.", 503);
    let lu;
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const r = await anthropic.messages.create({
        model: "claude-sonnet-5", max_tokens: 1024, thinking: { type: "disabled" },
        system: "Tu lis une carte de visite ou l'en-tête d'un document d'une entreprise. Recopie ce qui est écrit, sans rien inventer ; laisse vide ce qui n'est pas lisible.",
        tools: [CARTE], tool_choice: { type: "tool", name: CARTE.name },
        messages: [{ role: "user", content: [m[1] === "application/pdf" ? { type: "document", source: { type: "base64", media_type: m[1], data: m[2] } } : { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } }, { type: "text", text: "Contact à ajouter au carnet de l'entreprise." }] }]
      });
      lu = r.content.find((b) => b.type === "tool_use")?.input || {};
    } catch (e) {
      return badRequest(e?.status === 429 ? "Koji est très demandé, réessayez dans un instant." : "Koji n'a pas pu lire la carte : saisissez le contact à la main.", 502);
    }
    const annuaire = lu.siret ? await annuaireContact(lu.siret) : null;
    const [prenom, ...reste] = texte(lu.contact, 80).split(" ");
    const proposition = {
      type: lu.entreprise || annuaire ? "societe" : "particulier",
      companyName: texte(annuaire?.raisonSociale || lu.entreprise, 150),
      contactPerson: [texte(lu.contact, 80), texte(lu.fonction, 40)].filter(Boolean).join(" · "),
      firstName: lu.entreprise ? "" : prenom || "", lastName: lu.entreprise ? "" : reste.join(" "),
      phone: texte(lu.telephone, 30), email: texte(lu.email, 120), siret: texte(annuaire?.siret || lu.siret, 20),
      city: texte(annuaire?.city || lu.ville, 80), address: [annuaire?.addressLine1, annuaire?.postalCode, annuaire?.city].filter(Boolean).join(" "),
      metier: texte(lu.activite, 80), activite: annuaire?.activite || "", actif: annuaire ? annuaire.actif : null,
      roles: [CONTACT_ROLES.includes(lu.type) ? lu.type : "client"]
    };
    const d = doublon(miens, proposition);
    return ok({ proposition, annuaire: Boolean(annuaire), doublon: d ? { id: d.contact.id, nom: contactDisplayName(d.contact), par: d.par, createdAt: d.contact.createdAt, manque: ["phone", "email", "siret"].filter((k) => proposition[k] && !d.contact[k]) } : null });
  }

  if (body.action === "csv") {
    const rows = lireCsvContacts(body.texte);
    if (!rows.length) return badRequest("Aucun contact lu : vérifiez la première ligne (Nom, Prénom, Entreprise, Téléphone, E-mail, Type).");
    let crees = 0;
    let doublons = 0;
    const now = new Date().toISOString();
    for (const [i, r] of rows.entries()) {
      if (doublon(db.contacts.filter((c) => c.userId === userId), r)) { doublons += 1; continue; }
      const c = { id: `contact-${Date.now()}-${i}`, userId, archived: false, archivedAt: "", createdAt: now, updatedAt: now, source: "fichier" };
      appliquer(c, r);
      db.contacts.unshift(c);
      crees += 1;
    }
    await writeDb(db);
    return ok({ crees, doublons }, 201);
  }

  if (body.action === "demander") {
    const c = miens.find((x) => x.id === body.id);
    if (!c) return badRequest("Contact introuvable.", 404);
    const docs = (Array.isArray(body.docs) && body.docs.length ? body.docs : DOCS_VIGILANCE.filter((d) => !d.facultatif).map((d) => d.cle)).filter((d) => DOCS_VIGILANCE.some((x) => x.cle === d));
    c.vigilanceToken = c.vigilanceToken || randomBytes(18).toString("base64url");
    c.vigilance = c.vigilance || {};
    for (const d of docs) c.vigilance[d] = { ...(c.vigilance[d] || {}), demandeLe: today() };
    const lien = `${baseUrl(request)}/vigilance/${c.vigilanceToken}`;
    const webUser = await loadEntrepriseProfile(entreprise);
    const nomEntreprise = webUser.business?.raisonSociale || webUser.name || "Votre donneur d'ordre";
    let envoye = false;
    if (c.email) {
      const liste = docs.map((d) => `- ${DOCS_VIGILANCE.find((x) => x.cle === d).nom}`).join("\n");
      await sendClientMessageEmail({ to: c.email, subject: `${nomEntreprise} · documents à déposer`, message: `Bonjour,\n\nPour travailler ensemble, ${nomEntreprise} a besoin des documents suivants :\n${liste}\n\nDéposez-les ici, en PDF ou en photo : ${lien}\n\nMerci,\n${nomEntreprise}`, replyTo: webUser.email || undefined });
      envoye = true;
    }
    c.updatedAt = new Date().toISOString();
    await writeDb(db);
    return ok({ lien, envoye, docs });
  }

  if (body.action === "affecter") {
    const c = miens.find((x) => x.id === body.id);
    if (!c) return badRequest("Contact introuvable.", 404);
    if (!body.projectId) return badRequest("Choisissez un chantier.");
    const ctx = await contexteCarnet(entreprise, db);
    if (!ctx.chantiers.some((ch) => ch.projectId === body.projectId)) return badRequest("Chantier introuvable.", 404);
    // Document bloquant : pas d'affectation tant que la pièce manque.
    if ((c.roles || []).includes("sous_traitant")) {
      const cumul = chantiersDuPro(piecesDuPro(c, ctx.pieces), ctx.titres).cumulAnnee + (Number(body.montantHt) || 0);
      const v = vigilance(c, { cumulHt: cumul, aujourdhui: today() });
      if (v.bloquant) return badRequest(`${v.bloquant.nom} manquante : ce sous-traitant ne peut pas être affecté tant qu'elle manque.`, 409);
    }
    db.chantierContacts = db.chantierContacts || [];
    const role = (c.roles || []).includes("sous_traitant") ? "sous-traitant" : texte(body.role, 60);
    if (!db.chantierContacts.some((l) => l.userId === userId && l.contactId === c.id && l.projectId === body.projectId)) {
      db.chantierContacts.unshift({ id: `cc-${Date.now()}`, userId, contactId: c.id, projectId: body.projectId, roleOnSite: role, addedAt: new Date().toISOString() });
    }
    await writeDb(db);
    return ok({ ok: true });
  }

  if (body.action === "document") {
    const c = miens.find((x) => x.id === body.id);
    const def = DOCS_VIGILANCE.find((d) => d.cle === body.doc);
    if (!c || !def) return badRequest("Document introuvable.", 404);
    c.vigilance = c.vigilance || {};
    const avant = c.vigilance[def.cle] || {};
    c.vigilance[def.cle] = body.nonConcerne ? { nonConcerne: true, date: today() } : { ...avant, date: jourOk(body.date) || avant.date || "", validJusqu: jourOk(body.validJusqu) || "", aVerifier: false, valideLe: today() };
    c.updatedAt = new Date().toISOString();
    await writeDb(db);
    return ok({ ok: true });
  }

  // Création, ou « Compléter la fiche existante ».
  const existant = body.completer ? miens.find((x) => x.id === body.completer) : null;
  if (body.completer && !existant) return badRequest("Fiche existante introuvable.", 404);
  const now = new Date().toISOString();
  const c = existant || { id: `contact-${Date.now()}`, userId, archived: false, archivedAt: "", createdAt: now, roles: ["client"], source: texte(body.source, 20) || "saisie" };
  const saisie = { ...body };
  if (existant) for (const k of Object.keys(saisie)) if (existant[k] && CHAMPS.includes(k)) delete saisie[k];
  appliquer(c, saisie);
  if (!contactDisplayName(c)) return badRequest("Nom ou raison sociale obligatoire.");
  if (!existant && !body.forcer) {
    const d = doublon(miens, c);
    if (d) return badRequest(`Ce contact existe déjà : ${contactDisplayName(d.contact)} (${d.par}).`, 409);
  }
  c.updatedAt = now;
  if (!existant) db.contacts.unshift(c);
  addHistory(db, { userId, type: existant ? "contact.updated" : "contact.created", label: `Contact ${existant ? "complété" : "créé"}: ${contactDisplayName(c)}`, entityId: c.id, entityType: "contact" });
  await writeDb(db);
  return ok({ id: c.id }, existant ? 200 : 201);
}

export async function PATCH(request) {
  const body = await request.json().catch(() => ({}));
  const { entreprise, erreur } = await contexte(request, body);
  if (erreur) return erreur;
  const db = await readDb();
  const c = (db.contacts || []).find((x) => x.id === body.id && x.userId === entreprise.userId);
  if (!c) return badRequest("Contact introuvable.", 404);
  if (body.action === "noter") {
    const t = fixText(String(body.texte || "").trim().slice(0, 2000));
    if (!t) return badRequest("La note est vide.");
    c.journal = [{ id: `jn-${Date.now()}`, kind: body.kind === "appel" ? "appel" : "note", text: t, at: new Date().toISOString(), dictee: Boolean(body.dictee) }, ...(c.journal || [])].slice(0, 200);
  } else if (body.action === "prochaine") {
    const label = texte(body.label, 200);
    c.nextAction = label ? { label, date: jourOk(body.date) } : null;
  } else {
    appliquer(c, body);
    if (!contactDisplayName(c)) return badRequest("Nom ou raison sociale obligatoire.");
  }
  c.updatedAt = new Date().toISOString();
  await writeDb(db);
  return ok({ ok: true });
}
