import { badRequest, ok } from "../../../lib/http";
import { makeToken, readDb, writeDb } from "../../../lib/db";
import { resolveEntreprise } from "../../../lib/entreprise-auth";
import { CATEGORIES, estSure, normaliserPiece, r2 } from "../../../lib/depenses";
import { chargerChantiers, contexteEntreprise, enregistrerFichier, lienFichier, lirePiece, piecesDe, rafraichirPropositions, rangerCommandes, supprimerFichier, TAILLE_MAX, TYPES_FICHIER } from "../../../lib/depenses-serveur";
import { fixText } from "../../../lib/text";

// Dépenses (maquettes PRO-09 et 09.3) : pièces à ranger (photo d'un
// ticket, facture PDF, commandes Koji rangées d'office), chantier proposé
// par Koji, doublons, factures reçues, réglage de l'envoi au comptable.
// Pièces dans db.expenses (les dépenses saisies avant restent valables),
// justificatifs dans le bucket privé quote_attachments/depenses/….
export const maxDuration = 60;
const texte = (v, max = 160) => fixText(String(v ?? "")).replace(/\s+/g, " ").trim().slice(0, max);
const jourOk = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(String(d || "")) ? d : "");
const montant = (v) => r2(Math.max(0, Number(String(v ?? "").replace(",", ".")) || 0));
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || ""));

function reglagesDe(db, userId) {
  return { comptableEmail: "", envoiAuto: false, ...(db.reglagesDepenses?.[userId] || {}) };
}

function vue(db, userId, chantiers) {
  const pieces = piecesDe(db, userId);
  const titres = new Map(chantiers.map((c) => [c.projectId, c.title]));
  const avecTitre = (p) => ({ ...p, projectTitle: p.fraisGeneraux ? "Frais généraux" : titres.get(p.projectId) || p.projectTitle || "", fichier: p.fichier ? { type: p.fichier.type } : null });
  const mois = new Date().toISOString().slice(0, 7);
  const rangeesMois = pieces.filter((p) => p.statut === "rangee" && String(p.date).slice(0, 7) === mois);
  const depuis = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  return {
    aRanger: pieces.filter((p) => p.statut === "a_ranger").sort((a, b) => String(b.date).localeCompare(String(a.date))).map(avecTitre),
    recues: pieces.filter((p) => p.type === "facture" && String(p.date) >= depuis).sort((a, b) => String(b.date).localeCompare(String(a.date))).map(avecTitre),
    rangeesMois: { nombre: rangeesMois.length, ht: r2(rangeesMois.reduce((s, p) => s + p.ht, 0)) },
    sures: pieces.filter(estSure).length,
    chantiers: chantiers.filter((c) => !c.archive).map((c) => ({ projectId: c.projectId, title: c.title, lots: [...new Set((c.quote?.items || []).map((i) => String(i.room || "Chantier").trim() || "Chantier"))] })),
    categories: CATEGORIES,
    reglages: reglagesDe(db, userId)
  };
}

async function contexte(request, body) {
  const entreprise = await resolveEntreprise(request, body);
  if (!entreprise) return { erreur: badRequest("Connexion requise.", 401) };
  return { entreprise };
}

export async function GET(request) {
  const { entreprise, erreur } = await contexte(request);
  if (erreur) return erreur;
  const url = new URL(request.url);
  const db = await readDb();
  const fichier = url.searchParams.get("fichier");
  if (fichier) {
    const p = (db.expenses || []).find((e) => e.id === fichier && e.userId === entreprise.userId);
    if (!p?.fichier?.path) return badRequest("Justificatif introuvable.", 404);
    return Response.redirect(await lienFichier(p.fichier.path, 600), 302);
  }
  if (rangerCommandes(db, entreprise.userId)) await writeDb(db);
  let chantiers = [];
  try { chantiers = (await chargerChantiers(entreprise)).chantiers; } catch (e) { return badRequest(e.message, 502); }
  const { business } = await contexteEntreprise(entreprise);
  return ok({ ...vue(db, entreprise.userId, chantiers), business });
}

// Dépôt d'une pièce : photo ou PDF lu par Koji (à ranger), ou saisie à la
// main (rangée tout de suite sur le chantier choisi).
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { entreprise, erreur } = await contexte(request, body);
  if (erreur) return erreur;
  const db = await readDb();
  db.expenses = db.expenses || [];
  const now = new Date().toISOString();
  const id = makeToken("exp");
  let chantiers = [];
  try { chantiers = (await chargerChantiers(entreprise)).chantiers; } catch (e) { return badRequest(e.message, 502); }

  if (body.manuel) {
    const m = body.manuel;
    const ht = montant(m.ht);
    if (!(ht > 0)) return badRequest("Montant HT manquant.");
    const ch = chantiers.find((c) => c.projectId === m.projectId);
    if (!m.fraisGeneraux && !ch) return badRequest("Choisissez un chantier ou « Frais généraux ».");
    const tva = montant(m.tva);
    db.expenses.unshift({
      id, userId: entreprise.userId, statut: "rangee", type: m.type === "facture" ? "facture" : "ticket", source: "manuel",
      fournisseur: texte(m.fournisseur, 80), date: jourOk(m.date) || now.slice(0, 10), numero: texte(m.numero, 40), lignes: [],
      ht, tva, ttc: r2(ht + tva), tauxTva: ht > 0 ? Math.round((tva / ht) * 1000) / 10 : 0, autoliquidation: Boolean(m.autoliquidation),
      categorie: CATEGORIES.includes(m.categorie) ? m.categorie : "Fournitures",
      projectId: m.fraisGeneraux ? "" : ch.projectId, projectTitle: m.fraisGeneraux ? "" : ch.title, fraisGeneraux: Boolean(m.fraisGeneraux), lot: texte(m.lot, 80),
      amount: ht, label: texte(m.fournisseur, 80), rangeeLe: now, createdAt: now
    });
    await writeDb(db);
    return ok({ ...vue(db, entreprise.userId, chantiers), pieceId: id }, 201);
  }

  const match = /^data:([a-z]+\/[a-z0-9.+-]+);base64,(.+)$/i.exec(String(body.data || ""));
  if (!match || !TYPES_FICHIER[match[1]]) return badRequest("Ajoutez la photo du ticket ou la facture en PDF (JPEG, PNG, WebP ou PDF).");
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > TAILLE_MAX) return badRequest("Fichier trop lourd (3 Mo au plus).");
  let lu;
  try { lu = await lirePiece({ mediaType: match[1], data: match[2], nom: texte(body.nom, 120) }); } catch (e) { return badRequest(e.message, e.status || 502); }
  let fichier;
  try { fichier = await enregistrerFichier(entreprise.userId, id, { buffer, mediaType: match[1] }); } catch (e) { return badRequest(e.message, 502); }
  db.expenses.unshift({
    id, userId: entreprise.userId, statut: "a_ranger", source: match[1] === "application/pdf" ? "pdf" : "photo", ...lu,
    fichier: { ...fichier, nom: texte(body.nom, 120) }, amount: lu.ht, label: lu.fournisseur, createdAt: now
  });
  await rafraichirPropositions(entreprise, db, { chantiers });
  await writeDb(db);
  return ok({ ...vue(db, entreprise.userId, chantiers), pieceId: id }, 201);
}

function ranger(brut, { projectId = "", fraisGeneraux = false, lot = "", categorie = "" }, chantiers) {
  const ch = chantiers.find((c) => c.projectId === projectId);
  if (!fraisGeneraux && !ch) return "Chantier introuvable.";
  brut.statut = "rangee";
  brut.projectId = fraisGeneraux ? "" : ch.projectId;
  brut.projectTitle = fraisGeneraux ? "" : ch.title;
  brut.fraisGeneraux = Boolean(fraisGeneraux);
  brut.lot = fraisGeneraux ? "" : texte(lot, 80);
  if (CATEGORIES.includes(categorie)) brut.categorie = categorie;
  brut.rangeeLe = new Date().toISOString();
  return "";
}

export async function PATCH(request) {
  const body = await request.json().catch(() => ({}));
  const { entreprise, erreur } = await contexte(request, body);
  if (erreur) return erreur;
  const db = await readDb();
  db.expenses = db.expenses || [];
  const userId = entreprise.userId;
  let chantiers = [];
  try { chantiers = (await chargerChantiers(entreprise)).chantiers; } catch (e) { return badRequest(e.message, 502); }
  const brut = body.id ? db.expenses.find((e) => e.id === body.id && e.userId === userId) : null;
  if (body.id && !brut) return badRequest("Pièce introuvable.", 404);

  if (body.action === "ranger") {
    const e = ranger(brut, body, chantiers);
    if (e) return badRequest(e, 404);
  } else if (body.action === "rangerSures") {
    for (const p of piecesDe(db, userId).filter(estSure)) {
      const b = db.expenses.find((x) => x.id === p.id);
      ranger(b, { projectId: p.proposition.projectId, fraisGeneraux: p.proposition.fraisGeneraux, lot: p.proposition.lot }, chantiers);
    }
  } else if (body.action === "modifier") {
    const p = normaliserPiece(brut);
    if (body.fournisseur !== undefined) brut.fournisseur = brut.label = texte(body.fournisseur, 80);
    if (body.date !== undefined && jourOk(body.date)) brut.date = body.date;
    if (body.numero !== undefined) brut.numero = texte(body.numero, 40);
    if (body.categorie !== undefined && CATEGORIES.includes(body.categorie)) brut.categorie = body.categorie;
    if (body.ht !== undefined || body.tva !== undefined) {
      const ht = body.ht !== undefined ? montant(body.ht) : p.ht;
      const tva = body.tva !== undefined ? montant(body.tva) : p.tva;
      Object.assign(brut, { ht, tva, ttc: r2(ht + tva), amount: ht, tauxTva: ht > 0 ? Math.round((tva / ht) * 1000) / 10 : 0, tvaEstimee: false });
    }
    if (p.statut === "rangee" && (body.projectId !== undefined || body.fraisGeneraux !== undefined || body.lot !== undefined)) {
      const e = ranger(brut, { projectId: body.projectId ?? p.projectId, fraisGeneraux: body.fraisGeneraux ?? p.fraisGeneraux, lot: body.lot ?? p.lot }, chantiers);
      if (e) return badRequest(e, 404);
    }
  } else if (body.action === "garder") {
    brut.doublonDe = "";
    brut.doublonVerifie = true;
  } else if (body.action === "supprimer") {
    // Une pièce rangée se garde (conservation des justificatifs) ; on ne
    // supprime qu'une pièce à ranger (doublon, erreur de photo).
    if (normaliserPiece(brut).statut !== "a_ranger") return badRequest("Une pièce rangée ne se supprime pas : modifiez-la.");
    await supprimerFichier(brut.fichier?.path);
    db.expenses = db.expenses.filter((e) => e !== brut);
  } else if (body.action === "reglages") {
    db.reglagesDepenses = db.reglagesDepenses || {};
    const r = reglagesDe(db, userId);
    if (body.comptableEmail !== undefined) {
      const email = texte(body.comptableEmail, 120);
      if (email && !emailOk(email)) return badRequest("Adresse du comptable invalide.");
      r.comptableEmail = email;
    }
    if (body.envoiAuto !== undefined) r.envoiAuto = Boolean(body.envoiAuto) && Boolean(r.comptableEmail);
    if (body.envoiAuto && !r.comptableEmail) return badRequest("Indiquez d'abord l'adresse du comptable.");
    db.reglagesDepenses[userId] = r;
  } else {
    return badRequest("Action inconnue.");
  }
  await rafraichirPropositions(entreprise, db, { chantiers });
  await writeDb(db);
  return ok(vue(db, userId, chantiers));
}
