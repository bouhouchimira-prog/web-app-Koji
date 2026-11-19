import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { badRequest, ok } from "../../../../lib/http";
import { addHistory, writeDb } from "../../../../lib/db";
import { clientConnecte } from "../../../../lib/projets-client-serveur";
import { buildInvoicePdf, invoiceDocumentFilename } from "../../../../lib/document-generator";
import { avecProfil } from "../../../../lib/document-profil.js";
import { fixText } from "../../../../lib/text";
import {
  candidats, CATEGORIES, categorieDe, fourchette, nettoyerReponses, NUMERO_GAZ, positionQuartier, quartierDe, relancer, sansExif, textePrix, TEXTE_GAZ, titreUrgence
} from "../../../../lib/urgences";
import {
  avancerTout, creerIntervention, enregistrerPhoto, geocoder, lancerPushs, notifierArtisan, vueClient
} from "../../../../lib/urgences-serveur";

// Koji Client · commander une urgence (maquette PRO-17, écrans A à D).
// Tout part de la session du particulier. GET → catégories, adresse et
// téléphone du profil, urgences en cours ; GET ?prix=1&categorie&adresse →
// prix des artisans disponibles (fourchette) ; GET ?id= → une urgence ;
// GET ?id=&facture=1 → PDF de la facture. POST JSON actions : commander,
// confirmer, annuler, relancer.
const s = (v, n = 200) => fixText(String(v ?? "")).trim().slice(0, n);
const ACTIVES = ["recherche", "acceptee"];

function nomDu(user) {
  const p = user.personal || {};
  return [p.firstName, p.lastName].filter(Boolean).join(" ").trim() || user.name || "Client Koji";
}

const categoriesPubliques = () => CATEGORIES.map(({ id, label, icone, questions }) => ({ id, label, icone, questions: questions.map(({ id: q, label: l, options }) => ({ id: q, label: l, options })) }));

function enCours(db, user) {
  const interventions = db.interventions || [];
  return (db.urgences || []).filter((u) => u.clientId === user.id && (ACTIVES.includes(u.statut) || (u.statut === "confirmee" && !interventions.some((i) => i.id === u.interventionId && (i.termineeLe || i.annuleeLe)))));
}

export async function GET(request) {
  const client = await clientConnecte(request);
  if (client.erreur) return badRequest(client.erreur, client.code);
  const { db, user } = client;
  const q = new URL(request.url).searchParams;
  const maintenant = new Date().toISOString();
  const pushs = [];
  if (avancerTout(db, maintenant, pushs)) { await writeDb(db); await lancerPushs(pushs); }

  if (q.get("prix")) {
    const categorie = String(q.get("categorie") || "");
    if (!categorieDe(categorie)) return badRequest("Choisissez votre urgence.");
    const g = await geocoder(q.get("adresse"));
    if (!g) return badRequest("Adresse introuvable. Vérifiez le numéro, la rue et la ville.");
    const liste = candidats({ categorie, lat: g.lat, lon: g.lon, clientId: user.id }, db.urgencesPro || {}, maintenant);
    return ok({ adresse: g.label, quartier: quartierDe(g), disponibles: liste.length, prix: textePrix(fourchette(liste)) });
  }

  const id = q.get("id");
  if (id) {
    const u = (db.urgences || []).find((x) => x.id === id && x.clientId === user.id);
    if (!u) return badRequest("Urgence introuvable.", 404);
    if (q.get("facture")) {
      const i = (db.interventions || []).find((x) => x.id === u.interventionId);
      const f = i?.invoiceId ? (db.invoices || []).find((x) => x.id === i.invoiceId && x.userId === i.userId) : null;
      if (!f) return badRequest("Facture introuvable.", 404);
      await avecProfil(db, f.userId);
      return new NextResponse(buildInvoicePdf({ invoice: f, quote: null, project: null, db }), {
        headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${invoiceDocumentFilename(f)}"`, "Cache-Control": "private, no-store" }
      });
    }
    return ok({ urgence: await vueClient(db, u, maintenant) });
  }

  const p = user.personal || {};
  const miennes = (db.urgences || []).filter((u) => u.clientId === user.id).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const actives = new Set(enCours(db, user).map((u) => u.id));
  return ok({
    categories: categoriesPubliques(),
    gaz: { numero: NUMERO_GAZ, texte: TEXTE_GAZ },
    adresse: [p.address, [p.postalCode, p.city].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    telephone: p.phone || "",
    urgences: miennes.slice(0, 5).map((u) => ({ id: u.id, titre: titreUrgence(u), statut: u.statut, enCours: actives.has(u.id), creeeLe: u.createdAt }))
  });
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return badRequest("Envoi invalide."); }
  const client = await clientConnecte(request);
  if (client.erreur) return badRequest(client.erreur, client.code);
  const { db, user } = client;
  const maintenant = new Date().toISOString();
  const pushs = [];
  avancerTout(db, maintenant, pushs);
  db.urgences = db.urgences || [];
  const action = String(body.action || "");

  if (action === "commander") {
    const categorie = String(body.categorie || "");
    const c = categorieDe(categorie);
    if (!c) return badRequest("Choisissez votre urgence.");
    const reponses = nettoyerReponses(categorie, body.reponses);
    if (Object.keys(reponses).length < c.questions.length) return badRequest("Répondez aux deux questions.");
    const telephone = s(body.telephone || user.personal?.phone, 30);
    if (telephone.replace(/\D/g, "").length < 10) return badRequest("Indiquez un numéro de téléphone où l'artisan peut vous joindre.");
    if (enCours(db, user).length) return badRequest("Vous avez déjà une urgence en cours.", 409);
    const recentes = db.urgences.filter((u) => u.clientId === user.id && Date.parse(maintenant) - Date.parse(u.createdAt) < 86400000);
    if (recentes.length >= 5) return badRequest("Trop d'urgences aujourd'hui. Contactez contact@getkoji.io si besoin.", 429);
    const g = await geocoder(body.adresse);
    if (!g) return badRequest("Adresse introuvable. Vérifiez le numéro, la rue et la ville.");
    const u = {
      id: `urg-${randomUUID()}`, clientId: user.id, nomClient: s(nomDu(user), 120), email: user.email || "", telephone,
      categorie, reponses, adresse: g.label, complement: s(body.complement, 160), lat: g.lat, lon: g.lon,
      quartier: quartierDe(g) || "votre quartier", position: positionQuartier(g.lat, g.lon),
      photo: "", statut: "recherche", propositions: [], artisan: null, createdAt: maintenant, rechercheDepuis: maintenant
    };
    const liste = candidats(u, db.urgencesPro || {}, maintenant);
    if (!liste.length) return badRequest("Aucun artisan n'est disponible près de chez vous pour cette urgence en ce moment.", 409);
    u.prixAffiche = textePrix(fourchette(liste));
    const photo = String(body.photo || "");
    if (photo) {
      const m = /^data:image\/jpe?g;base64,([A-Za-z0-9+/=]+)$/.exec(photo);
      if (!m || photo.length > 4_000_000) return badRequest("Photo illisible : prenez-la en JPEG, 3 Mo au plus.");
      const propre = sansExif(Buffer.from(m[1], "base64"));
      if (!propre) return badRequest("Photo illisible : prenez-la en JPEG.");
      u.photo = await enregistrerPhoto(user.id, u.id, propre);
    }
    db.urgences.unshift(u);
    avancerTout(db, maintenant, pushs);
    addHistory(db, { userId: user.id, type: "urgence.commandee", label: `Urgence : ${c.label} · ${u.quartier}`, entityId: u.id, entityType: "urgence" });
    await writeDb(db);
    await lancerPushs(pushs);
    return ok({ urgence: await vueClient(db, u, maintenant) }, 201);
  }

  const u = db.urgences.find((x) => x.id === String(body.id || "") && x.clientId === user.id);
  if (!u) return badRequest("Urgence introuvable.", 404);
  const c = categorieDe(u.categorie);
  const i = u.interventionId ? (db.interventions || []).find((x) => x.id === u.interventionId) : null;

  if (action === "confirmer") {
    if (u.statut === "confirmee") return ok({ urgence: await vueClient(db, u, maintenant) });
    if (u.statut !== "acceptee") return badRequest(u.statut === "expiree" ? "Le délai pour confirmer est passé. Relancez la recherche." : "Rien à confirmer.", 409);
    u.statut = "confirmee";
    u.confirmeeLe = maintenant;
    creerIntervention(db, u, maintenant);
    notifierArtisan(db, u.artisan.userId, { type: "urgence.confirmee", titre: "Urgence confirmée : partez", texte: `${c?.label || "Urgence"} · ${u.adresse}`, lien: `/urgences?partir=${u.id}` }, pushs);
  } else if (action === "annuler") {
    const avantArrivee = !i?.arriveLe && !i?.termineeLe;
    if (!["recherche", "acceptee", "sans_artisan", "expiree", "confirmee"].includes(u.statut) || !avantArrivee || i?.annuleeLe) return badRequest("Cette urgence ne peut plus être annulée.", 409);
    const artisanId = ["acceptee", "confirmee"].includes(u.statut) ? u.artisan?.userId : "";
    const confirmee = u.statut === "confirmee";
    u.statut = "annulee";
    u.annuleeLe = maintenant;
    u.annuleePar = "client";
    if (i) Object.assign(i, { annuleeLe: maintenant, status: "annulee", updatedAt: maintenant });
    if (artisanId) notifierArtisan(db, artisanId, { type: "urgence.annulee", titre: "Urgence annulée par le client", texte: `${c?.label || "Urgence"} · ${u.quartier}${confirmee ? " : inutile de vous déplacer." : "."}`, lien: i ? `/interventions/rapide/${i.id}` : "/urgences" }, pushs);
  } else if (action === "relancer") {
    if (!["sans_artisan", "expiree"].includes(u.statut)) return badRequest("La recherche est déjà en cours.", 409);
    if (!candidats(u, db.urgencesPro || {}, maintenant).length) return badRequest("Aucun artisan n'est disponible près de chez vous pour cette urgence en ce moment.", 409);
    relancer(u, maintenant);
    avancerTout(db, maintenant, pushs);
  } else {
    return badRequest("Action inconnue.");
  }
  await writeDb(db);
  await lancerPushs(pushs);
  return ok({ urgence: await vueClient(db, u, maintenant) });
}
