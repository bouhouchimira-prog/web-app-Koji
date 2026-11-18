import { randomBytes, randomUUID } from "node:crypto";
import { badRequest, ok } from "../../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../../lib/db";
import { resolveEntreprise, loadEntrepriseProfile } from "../../../../lib/entreprise-auth";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { sendClientMessageEmail, sendInvoiceReminderEmail } from "../../../../lib/mailer";
import { buildInvoicePdf, invoiceDocumentFilename } from "../../../../lib/document-generator";
import { ajouterPaiement } from "../../../../lib/encaissements";
import { fixText } from "../../../../lib/text";
import { arriveeVers, etapeDe, lienItineraire, mentionDevis, MENTION_EN_PLUS, messagePrix, MOYENS_PAIEMENT, nettoyerLignes, nomContact, PIECES, prixValides, totalLignes } from "../../../../lib/intervention-rapide";
import { avecProfil } from "../../../../lib/document-profil.js";

// Intervention rapide (maquette PRO-17.1) : un client appelle directement.
// GET → prix d'intervention et interventions rapides ; GET ?id= → une
// intervention (photos en liens signés). POST JSON actions : prix, creer,
// en-route, arrive, devis, signer, terminer, envoyer-facture, annuler ;
// POST multipart → photo avant / après.
const BUCKET = "quote_attachments";
const s = (v, n = 200) => fixText(String(v ?? "")).trim().slice(0, n);
const lienClient = (request, token) => `${process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin}/intervention/${token}`;

async function contexte(request, body) {
  const entreprise = await resolveEntreprise(request, body);
  if (!entreprise) return { erreur: badRequest("Connexion requise.", 401) };
  const [db, webUser] = await Promise.all([readDb(), loadEntrepriseProfile(entreprise)]);
  const nom = webUser.business?.raisonSociale || webUser.name || "";
  return { db, userId: entreprise.userId, webUser, nom, prix: db.comptePrefs?.[entreprise.userId]?.prixIntervention || {} };
}

async function vue(request, db, i) {
  const photos = i.photos || [];
  const { data: liens } = photos.length ? await getSupabaseAdmin().storage.from(BUCKET).createSignedUrls(photos.map((p) => p.path), 3600) : { data: [] };
  const url = new Map((liens || []).map((l) => [l.path, l.signedUrl]));
  const facture = i.invoiceId ? (db.invoices || []).find((f) => f.id === i.invoiceId) : null;
  return {
    ...i,
    token: undefined,
    signatureImage: undefined,
    signe: Boolean(i.devis?.signeLe),
    etape: etapeDe(i),
    lienClient: lienClient(request, i.token),
    itineraire: lienItineraire(i.site),
    mention: mentionDevis(i.urgence),
    mentionEnPlus: MENTION_EN_PLUS,
    total: totalLignes(i.devis?.lignes || []),
    totalEnPlus: totalLignes(i.devis?.enPlus || []),
    photos: photos.map((p) => ({ id: p.id, phase: p.phase, takenAt: p.takenAt, url: url.get(p.path) || "" })),
    facture: facture ? { id: facture.id, numero: facture.invoiceNumber, montant: facture.amountTtc, statut: facture.status, envoyeeLe: facture.sentAt || "" } : null
  };
}

export async function GET(request) {
  const ctx = await contexte(request);
  if (ctx.erreur) return ctx.erreur;
  const { db, userId, prix, nom } = ctx;
  const id = new URL(request.url).searchParams.get("id");
  const miennes = (db.interventions || []).filter((i) => i.userId === userId && i.rapide);
  if (id) {
    const i = miennes.find((x) => x.id === id);
    if (!i) return badRequest("Intervention introuvable.", 404);
    return ok({ intervention: await vue(request, db, i), prix, entreprise: nom, moyens: MOYENS_PAIEMENT, pieces: PIECES });
  }
  return ok({
    prix,
    entreprise: nom,
    exemple: messagePrix({ entreprise: nom, prix }),
    interventions: miennes.slice(0, 50).map((i) => ({ id: i.id, reference: i.reference, client: i.client, site: i.site, probleme: i.probleme, etape: etapeDe(i), createdAt: i.createdAt, total: totalLignes(i.devis?.lignes || []) }))
  });
}

export async function POST(request) {
  const multipart = (request.headers.get("content-type") || "").includes("multipart/form-data");
  let body = {};
  let form = null;
  try { if (multipart) form = await request.formData(); else body = await request.json(); } catch { return badRequest("Envoi invalide."); }
  const ctx = await contexte(request, body);
  if (ctx.erreur) return ctx.erreur;
  const { db, userId, nom } = ctx;
  const maintenant = new Date().toISOString();
  db.interventions = db.interventions || [];
  const id = form ? String(form.get("id") || "") : String(body.id || "");
  const i = id ? db.interventions.find((x) => x.id === id && x.userId === userId && x.rapide) : null;
  const trace = (type, label) => addHistory(db, { userId, type, label, entityId: i?.id || "", entityType: "intervention" });

  if (form) {
    if (!i) return badRequest("Intervention introuvable.", 404);
    const fichier = form.get("file");
    const phase = form.get("phase") === "avant" ? "avant" : "apres";
    const types = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" };
    if (!fichier || typeof fichier === "string" || !types[fichier.type]) return badRequest("Photo manquante ou format non accepté.");
    if (fichier.size > 8 * 1024 * 1024) return badRequest("Photo trop lourde (8 Mo au plus).");
    const pid = randomUUID();
    const path = `interventions/${userId}/${i.id}/${pid}.${types[fichier.type]}`;
    const { error } = await getSupabaseAdmin().storage.from(BUCKET).upload(path, Buffer.from(await fichier.arrayBuffer()), { contentType: fichier.type, upsert: false });
    if (error) return badRequest("La photo n'a pas pu être enregistrée.", 500);
    i.photos = [...(i.photos || []), { id: pid, phase, path, takenAt: maintenant }];
    i.updatedAt = maintenant;
    await writeDb(db);
    return ok({ intervention: await vue(request, db, i) }, 201);
  }

  const action = String(body.action || "");

  if (action === "prix") {
    const deplacement = Math.round(Number(String(body.deplacement).replace(",", ".")) * 100) / 100;
    const demiHeure = Math.round(Number(String(body.demiHeure).replace(",", ".")) * 100) / 100;
    if (!(deplacement > 0 && demiHeure > 0 && deplacement < 2000 && demiHeure < 1000)) return badRequest("Indiquez vos deux prix TTC.");
    db.comptePrefs = db.comptePrefs || {};
    db.comptePrefs[userId] = { ...(db.comptePrefs[userId] || {}), prixIntervention: { deplacement, demiHeure } };
    await writeDb(db);
    return ok({ prix: db.comptePrefs[userId].prixIntervention, exemple: messagePrix({ entreprise: nom, prix: { deplacement, demiHeure } }) });
  }

  if (action === "creer") {
    const client = s(body.client, 120);
    if (!client) return badRequest("Le nom du client est nécessaire.");
    const prix = db.comptePrefs?.[userId]?.prixIntervention || {};
    if (body.envoyerPrix !== false && !prixValides(prix)) return badRequest("Indiquez d'abord vos prix d'intervention.");
    let contact = body.contactId ? (db.contacts || []).find((c) => c.id === body.contactId && c.userId === userId) : null;
    if (!contact) {
      contact = {
        id: `contact-${Date.now()}`, userId, type: "particulier", ...nomContact(client), companyName: "", siret: "", contactPerson: "",
        phone: s(body.telephone, 30), email: s(body.email, 120), address: s(body.adresse), city: "", postalCode: "", floor: "", accessCode: "", complement: "",
        accessInstructions: s(body.acces), notes: "", roles: ["client"], linkedUserId: "", archived: false, archivedAt: "", createdAt: maintenant, updatedAt: maintenant
      };
      db.contacts = [contact, ...(db.contacts || [])];
    }
    const nouvelle = {
      id: `int-${Date.now()}`, userId, rapide: true,
      reference: `INT-${new Date().getFullYear()}-${String(db.interventions.length + 1).padStart(4, "0")}`,
      client, contactId: contact.id, telephone: s(body.telephone, 30) || contact.phone || "", email: s(body.email, 120) || contact.email || "",
      site: s(body.adresse) || contact.address || "", acces: s(body.acces) || contact.accessInstructions || "", probleme: s(body.probleme, 500),
      urgence: body.urgence === "planifier" ? "planifier" : "maintenant",
      prix: prixValides(prix) ? { ...prix } : null, token: randomBytes(18).toString("base64url"),
      prixEnvoyeLe: "", accepteLe: "", enRouteLe: "", arriveeVers: "", arriveLe: "", termineeLe: "", annuleeLe: "",
      devis: { lignes: [], enPlus: [], pieces: "", signeLe: "", signataire: "" }, photos: [],
      status: "nouvelle", invoiceId: "", projectId: "", date: maintenant.slice(0, 10), createdAt: maintenant, updatedAt: maintenant
    };
    db.interventions.unshift(nouvelle);
    const message = nouvelle.prix ? messagePrix({ entreprise: nom, prix: nouvelle.prix, lien: lienClient(request, nouvelle.token) }) : "";
    let envoyeParEmail = false;
    if (message && nouvelle.email) {
      const r = await sendClientMessageEmail({ to: nouvelle.email, subject: `${nom || "Votre artisan"} · prix de l'intervention`, message: `Bonjour,\n\n${message}` }).catch(() => null);
      envoyeParEmail = Boolean(r?.ok);
    }
    if (message) nouvelle.prixEnvoyeLe = maintenant;
    addHistory(db, { userId, type: "intervention.rapide", label: `Intervention rapide : ${client}${nouvelle.probleme ? ` · ${nouvelle.probleme}` : ""}`, entityId: nouvelle.id, entityType: "intervention" });
    await writeDb(db);
    return ok({ intervention: await vue(request, db, nouvelle), message, envoyeParEmail }, 201);
  }

  if (!i) return badRequest("Intervention introuvable.", 404);
  if (i.annuleeLe && action !== "annuler") return badRequest("Intervention annulée.");

  if (action === "en-route") {
    i.enRouteLe = maintenant;
    i.arriveeVers = arriveeVers(Math.min(240, Number(body.minutes) || 20), maintenant);
    i.status = "en_route";
    trace("intervention.en_route", `En route : ${i.client}, arrivée vers ${i.arriveeVers}`);
  } else if (action === "arrive") {
    i.arriveLe = maintenant;
    i.status = "sur_place";
    trace("intervention.arrive", `Sur place : ${i.client}`);
  } else if (action === "devis") {
    if (i.devis?.signeLe) return badRequest("Le devis est déjà signé.");
    const pieces = PIECES[body.pieces] ? body.pieces : "";
    i.devis = { ...i.devis, lignes: nettoyerLignes(body.lignes), enPlus: nettoyerLignes(body.enPlus), pieces };
  } else if (action === "signer") {
    if (i.devis?.signeLe) return badRequest("Le devis est déjà signé.");
    if (body.lignes) i.devis = { ...i.devis, lignes: nettoyerLignes(body.lignes), enPlus: nettoyerLignes(body.enPlus), pieces: PIECES[body.pieces] ? body.pieces : i.devis?.pieces || "" };
    if (!i.devis?.lignes?.length) return badRequest("Ajoutez au moins une ligne au devis.");
    const image = String(body.signature || "");
    if (!/^data:image\/png;base64,/.test(image) || image.length > 300000) return badRequest("Signature du client manquante.");
    i.devis.signeLe = maintenant;
    i.devis.signataire = s(body.signataire, 120) || i.client;
    i.signatureImage = image;
    i.status = "devis_signe";
    trace("intervention.devis_signe", `Devis avant travaux signé : ${i.client}, ${totalLignes(i.devis.lignes)} € TTC`);
  } else if (action === "terminer") {
    if (!i.devis?.signeLe) return badRequest("Faites d'abord signer le devis avant travaux.");
    if (i.invoiceId) return badRequest("La facture existe déjà.");
    const moyen = MOYENS_PAIEMENT[body.moyen] ? body.moyen : "";
    const montant = totalLignes(i.devis.lignes);
    db.invoices = db.invoices || [];
    const facture = {
      id: `fac-${Date.now()}`, userId, invoiceNumber: `FAC-${new Date().getFullYear()}-${String(db.invoices.length + 1).padStart(4, "0")}`,
      projectId: "", quoteId: "", quoteNumber: "", interventionId: i.id, contactId: i.contactId || "", projectTitle: i.probleme || "Intervention", client: i.client, clientEmail: i.email || "",
      type: "Facture d'intervention", lignes: i.devis.lignes, amountMode: "fixed", percent: 0, amountTtc: montant, totalQuoteTtc: montant, alreadyInvoicedBefore: 0, remainingAfter: 0,
      status: "Emise", dueDate: maintenant.slice(0, 10), issuedAt: maintenant, paidAt: "", notes: `${i.reference} · ${i.site}`, createdAt: maintenant, updatedAt: maintenant
    };
    if (moyen) {
      ajouterPaiement(facture, { amount: montant, date: maintenant.slice(0, 10), moyen: moyen === "terminal" ? "carte" : moyen, reference: MOYENS_PAIEMENT[moyen] });
      facture.status = "Payee";
      facture.paidAt = maintenant;
    }
    db.invoices.unshift(facture);
    Object.assign(i, { invoiceId: facture.id, termineeLe: maintenant, status: moyen ? "payee" : "facturee", completedAt: maintenant, paiement: moyen ? { moyen, le: maintenant } : null });
    trace("invoice.created", `Facture d'intervention ${facture.invoiceNumber} : ${montant} € TTC${moyen ? `, payée (${MOYENS_PAIEMENT[moyen]})` : ""}`);
  } else if (action === "envoyer-facture") {
    const f = (db.invoices || []).find((x) => x.id === i.invoiceId && x.userId === userId);
    if (!f) return badRequest("Facture introuvable.");
    const to = s(body.to || i.email, 120);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return badRequest("Ajoutez l'e-mail du client pour lui envoyer la facture.");
    await avecProfil(db, userId);
    const r = await sendInvoiceReminderEmail({
      to, subject: `Facture ${f.invoiceNumber}`,
      message: `Bonjour,\n\nVoici la facture de l'intervention du ${new Date(i.createdAt).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })} (${i.probleme || "dépannage"}).${f.status === "Payee" ? " Elle est réglée, merci." : ""}\n\n${nom}`,
      pdfBuffer: buildInvoicePdf({ invoice: f, quote: null, project: null, db }), pdfFilename: invoiceDocumentFilename(f)
    });
    if (!r?.ok) return badRequest(`Envoi impossible : ${r?.error || "erreur"}`, 502);
    Object.assign(f, { clientEmail: to, sentAt: maintenant, sentTo: to });
    i.email = to;
    trace("invoice.sent", `Facture ${f.invoiceNumber} envoyée à ${to}`);
  } else if (action === "lier-devis") {
    const quoteId = s(body.quoteId, 80);
    if (!quoteId) return badRequest("Devis manquant.");
    i.devisSepareId = quoteId;
    trace("intervention.devis_separe", `Devis séparé préparé pour ${i.client}`);
  } else if (action === "annuler") {
    if (i.invoiceId) return badRequest("Une intervention facturée ne s'annule pas : faites un avoir.");
    i.annuleeLe = maintenant;
    i.status = "annulee";
    trace("intervention.annulee", `Intervention annulée : ${i.client}`);
  } else {
    return badRequest("Action inconnue.");
  }
  i.updatedAt = maintenant;
  await writeDb(db);
  return ok({ intervention: await vue(request, db, i) });
}
