import { NextResponse } from "next/server";
import { badRequest, ok } from "../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../lib/db";
import { loadEntrepriseProfile, resolveEntreprise } from "../../../lib/entreprise-auth";
import { getSupabaseAdmin } from "../../../lib/supabase";
import { sendClientMessageEmail } from "../../../lib/mailer";
import { fixText } from "../../../lib/text";
import { devisDuChantier } from "../../../lib/cloture-db";
import { vigilance } from "../../../lib/contacts-pro";
import { documentsStatus } from "../../../lib/reseau";
import { buildContratSousTraitancePdf, companyFromWebUser, contratSousTraitanceFilename } from "../../../lib/document-generator";
import { GARANTIES, PAIEMENT_DEFAUT, etatContrat, lignesContrat, manquesContrat, messageClient, relanceClient } from "../../../lib/sous-traitance";

// Contrat de sous-traitance (maquette PRO-14.1), côté entreprise principale.
// GET ?id= (fiche) · ?id=&pdf=1 · sans id : liste (?projectId=, ?contactId=).
// POST { action: "preparer", echangeId | contactId + projectId } ·
// PATCH { id, action: modifier | garantie | envoyer | presenter | relancer }.
// Stocké dans db.contratsSousTraitance ; aucune clause rédigée par Koji.

const t = (v, max) => fixText(String(v ?? "")).trim().slice(0, max);
const jourOk = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : "");
const SITE = () => process.env.NEXT_PUBLIC_SITE_URL || "https://getkoji.io";

async function contexte(request, body = null) {
  const entreprise = await resolveEntreprise(request, body);
  if (!entreprise) return { erreur: badRequest("Session expirée. Reconnectez-vous.", 401) };
  return { entreprise, userId: entreprise.userId, webUser: await loadEntrepriseProfile(entreprise) };
}

async function documentsAJour(db, c) {
  const contact = c.contactId ? (db.contacts || []).find((x) => x.id === c.contactId) : null;
  if (contact?.vigilance && Object.keys(contact.vigilance).length) return !vigilance(contact, { cumulHt: c.prixHt }).manquants.length;
  if (c.sousTraitantUserId) {
    const { data } = await getSupabaseAdmin().from("reseau_profils").select("kbis_date,urssaf_until,decennale_until").eq("user_id", c.sousTraitantUserId).maybeSingle();
    if (data) return documentsStatus({ kbisDate: data.kbis_date, urssafUntil: data.urssaf_until, decennaleUntil: data.decennale_until }).ok;
  }
  return false;
}

async function vue(db, c, webUser) {
  const complet = { ...c, entreprise: webUser.business?.raisonSociale || "Entreprise", documentsAJour: await documentsAJour(db, c) };
  return { ...complet, etat: etatContrat(c), lignes: lignesContrat(complet), manques: manquesContrat(complet), relance: relanceClient(c), message: messageClient(complet), garanties: GARANTIES };
}

export async function GET(request) {
  const cx = await contexte(request);
  if (cx.erreur) return cx.erreur;
  const db = await readDb();
  const params = new URL(request.url).searchParams;
  const miens = (db.contratsSousTraitance || []).filter((c) => c.userId === cx.userId);
  const id = params.get("id");
  if (!id) {
    const liste = miens.filter((c) => (!params.get("projectId") || c.projectId === params.get("projectId")) && (!params.get("contactId") || c.contactId === params.get("contactId")));
    return ok({ contrats: liste.map((c) => ({ id: c.id, sousTraitant: c.sousTraitant, lot: c.lot, chantier: c.chantier, prixHt: c.prixHt, etat: etatContrat(c) })) });
  }
  const c = miens.find((x) => x.id === id);
  if (!c) return badRequest("Contrat introuvable.", 404);
  const v = await vue(db, c, cx.webUser);
  if (params.get("pdf")) {
    const pdf = buildContratSousTraitancePdf({ contrat: c, company: companyFromWebUser(cx.webUser), lignes: v.lignes });
    return new NextResponse(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${contratSousTraitanceFilename(c)}"` } });
  }
  return ok({ contrat: v });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const cx = await contexte(request, body);
  if (cx.erreur) return cx.erreur;
  if (body.action !== "preparer") return badRequest("Action inconnue.");
  const db = await readDb();
  const userId = cx.userId;
  const admin = getSupabaseAdmin();
  let base = { contactId: t(body.contactId, 80), projectId: t(body.projectId, 80), lot: t(body.lot, 120), sousTraitant: "", sousTraitantUserId: "", echangeId: "", prixHt: 0, debut: "", fin: "" };
  if (body.echangeId) {
    const { data: e } = await admin.from("reseau_echanges").select("*").eq("id", t(body.echangeId, 80)).maybeSingle();
    if (!e || (e.user_a !== userId && e.user_b !== userId)) return badRequest("Échange introuvable.", 404);
    const { data: b } = e.besoin_id ? await admin.from("reseau_besoins").select("*").eq("id", e.besoin_id).maybeSingle() : { data: null };
    if (!b || b.user_id !== userId) return badRequest("Seul l'auteur du besoin prépare le contrat.", 403);
    const autre = e.user_a === userId ? { id: e.user_b, nom: e.name_b } : { id: e.user_a, nom: e.name_a };
    const contact = (db.contacts || []).find((c) => c.userId === userId && c.reseauUserId === autre.id);
    base = { ...base, echangeId: e.id, sousTraitant: autre.nom, sousTraitantUserId: autre.id, contactId: contact?.id || "", projectId: b.project_id || "", lot: b.lot_label || b.title, prixHt: Number(b.budget_ht) || 0, debut: b.start_date || "", fin: b.end_date || b.start_date || "" };
  } else {
    const contact = (db.contacts || []).find((c) => c.id === base.contactId && c.userId === userId);
    if (!contact) return badRequest("Sous-traitant introuvable dans vos contacts.", 404);
    base.sousTraitant = contact.companyName || [contact.firstName, contact.lastName].filter(Boolean).join(" ");
    base.sousTraitantUserId = contact.reseauUserId || "";
  }
  const existant = (db.contratsSousTraitance || []).find((c) => c.userId === userId && c.projectId === base.projectId && c.lot === base.lot && c.sousTraitant === base.sousTraitant && !c.refuseLe);
  if (existant) return ok({ id: existant.id });
  let chantier = "";
  let quoteId = "";
  if (base.projectId) {
    const { data: ch } = await admin.from("chantiers").select("*").eq("id", base.projectId).maybeSingle();
    if (ch && ch.user_id === userId) chantier = [ch.reference, ch.city].filter(Boolean).join(", ");
    const devis = ch && ch.user_id === userId ? await devisDuChantier(base.projectId) : null;
    quoteId = devis?.id || "";
  }
  const c = { id: `st-${Date.now()}`, userId, ...base, chantier, quoteId, paiement: PAIEMENT_DEFAUT, autoliquidation: true, garantie: "", creeLe: new Date().toISOString() };
  db.contratsSousTraitance = [c, ...(db.contratsSousTraitance || [])];
  addHistory(db, { userId, type: "sous-traitance.prepare", label: `Contrat de sous-traitance préparé : ${c.sousTraitant} · ${c.lot}`, entityId: c.projectId || c.id, entityType: c.projectId ? "project" : "contrat", meta: { projectId: c.projectId } });
  await writeDb(db);
  return ok({ id: c.id }, 201);
}

async function emailDe(userId) {
  if (!userId) return "";
  const { data } = await getSupabaseAdmin().from("users").select("email").eq("id", userId).maybeSingle();
  return data?.email || "";
}

export async function PATCH(request) {
  const body = await request.json().catch(() => ({}));
  const cx = await contexte(request, body);
  if (cx.erreur) return cx.erreur;
  const db = await readDb();
  const c = (db.contratsSousTraitance || []).find((x) => x.id === body.id && x.userId === cx.userId);
  if (!c) return badRequest("Contrat introuvable.", 404);
  const nom = cx.webUser.business?.raisonSociale || "Votre entreprise";
  const replyTo = cx.webUser.business?.emailPro || cx.webUser.email || undefined;
  const maintenant = new Date().toISOString();

  if (body.action === "modifier") {
    if (c.accepteLe) return badRequest("Le client a déjà accepté ces conditions : préparez un nouveau contrat pour les changer.");
    if (body.prixHt !== undefined) c.prixHt = Math.max(0, Math.round((Number(body.prixHt) || 0) * 100) / 100);
    if (body.debut !== undefined) c.debut = jourOk(body.debut);
    if (body.fin !== undefined) c.fin = jourOk(body.fin) || c.debut;
    if (body.paiement !== undefined) c.paiement = t(body.paiement, 120) || PAIEMENT_DEFAUT;
    if (body.lot !== undefined) c.lot = t(body.lot, 120) || c.lot;
    if (c.fin && c.debut && c.fin < c.debut) return badRequest("La date de fin est avant la date de début.");
  } else if (body.action === "garantie") {
    if (!GARANTIES[body.garantie]) return badRequest("Choisissez la garantie de paiement.");
    c.garantie = body.garantie;
  } else if (body.action === "envoyer") {
    const manques = manquesContrat(c);
    if (manques.length) return badRequest(`Complétez ${manques.join(", ")} avant d'envoyer.`);
    const contact = c.contactId ? (db.contacts || []).find((x) => x.id === c.contactId) : null;
    const to = contact?.email || (await emailDe(c.sousTraitantUserId));
    if (!to) return badRequest("Pas d'e-mail pour ce sous-traitant : ajoutez-le sur sa fiche contact.");
    const v = await vue(db, c, cx.webUser);
    const pdf = buildContratSousTraitancePdf({ contrat: c, company: companyFromWebUser(cx.webUser), lignes: v.lignes });
    const envoi = await sendClientMessageEmail({
      to, replyTo,
      subject: `${nom} · conditions de sous-traitance · ${c.lot}`,
      message: `Bonjour,\n\nVoici les conditions de sous-traitance pour le ${c.lot}${c.chantier ? ` (${c.chantier})` : ""} : ${v.lignes.map(([k, x]) => `${k} : ${x}`).join(" ; ")}.\n\nMerci de nous joindre vos attestations d'assurance décennale et de responsabilité civile.\n\n${nom}`,
      attachments: [{ filename: contratSousTraitanceFilename(c), content: pdf, contentType: "application/pdf" }]
    }).catch(() => null);
    if (envoi && envoi.ok === false) return badRequest("L'e-mail n'est pas parti. Réessayez.");
    c.envoyeLe = maintenant;
  } else if (body.action === "presenter" || body.action === "relancer") {
    const manques = manquesContrat(c);
    if (manques.length) return badRequest(`Complétez ${manques.join(", ")} avant de présenter le sous-traitant.`);
    const devis = c.projectId ? await devisDuChantier(c.projectId) : null;
    if (!devis?.clientEmail) return badRequest("Pas d'e-mail client sur le devis de ce chantier.");
    const v = await vue(db, c, cx.webUser);
    const envoi = await sendClientMessageEmail({
      to: devis.clientEmail, replyTo,
      subject: `${nom} · un sous-traitant pour votre chantier`,
      message: `Bonjour${devis.client ? ` ${devis.client}` : ""},\n\n${v.message}\n\nVotre accord est demandé par la loi pour les travaux sous-traités. Vous pouvez accepter le sous-traitant dans votre espace Koji : ${SITE()}/client/chantier/${devis.id}#sous-traitance`
    }).catch(() => null);
    if (envoi && envoi.ok === false) return badRequest("L'e-mail n'est pas parti. Réessayez.");
    c.quoteId = devis.id;
    if (body.action === "presenter") c.presenteLe = c.presenteLe || maintenant;
    else c.relanceLe = maintenant;
  } else {
    return badRequest("Action inconnue.");
  }
  c.majLe = maintenant;
  await writeDb(db);
  return ok({ contrat: await vue(db, c, cx.webUser) });
}
