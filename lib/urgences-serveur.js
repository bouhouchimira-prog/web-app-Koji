import { randomBytes, randomUUID } from "node:crypto";
import { addHistory, writeDb } from "./db.js";
import { getSupabaseAdmin, hasSupabaseAdmin } from "./supabase.js";
import { ecrireBloc, modifierUrgence, ouvrirUrgences } from "./urgences-stock.js";
import { addCompanyNotification } from "./worker-portal.js";
import { moyenneTexte, statsAvis } from "./avis.js";
import { sirenDe } from "./compte-pro.js";
import { euros, heureParis, nomContact } from "./intervention-rapide.js";
import {
  actionsClient, avancer, candidats, categorieDe, chiffresDuJour, clientCourt, detailsUrgence, etapesSuivi, etatClient,
  finProposition, initiales, kmTexte, messageClient, minutesTrajet, nombreProposes, nomCourt,
  prixArtisanTexte, PIECES_SUR_DEVIS, propositionActive, quandListe, statutListe, titreUrgence
} from "./urgences.js";
import { distanceKm } from "./geo.js";

// Urgences (maquette PRO-17), côté serveur : géocodage de l'adresse, profil
// de l'artisan, avancement des recherches, notifications, et passage à
// l'intervention rapide (PRO-17.1) quand le particulier confirme.
const BUCKET = "quote_attachments";
const ms = (iso) => Date.parse(iso || "") || 0;

// --- Géocodage (Base Adresse Nationale, comme le Radar) --------------------
export async function geocoder(adresse) {
  const q = String(adresse || "").trim();
  if (q.length < 3) return null;
  try {
    const r = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=1`, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const f = (await r.json())?.features?.[0];
    if (!f || Number(f.properties?.score) < 0.4) return null;
    const [lon, lat] = f.geometry?.coordinates || [];
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const { label = q, city = "", postcode = "" } = f.properties || {};
    return { lat, lon, label, city, postcode };
  } catch {
    return null;
  }
}

// --- Artisan -----------------------------------------------------------------
export function decennaleValide(business = {}, maintenant = new Date().toISOString()) {
  const doc = business.documents?.decennale || {};
  const assureur = String(doc.insurer || business.decennaleInsurer || "").trim();
  const jusqua = String(doc.expiryDate || business.decennaleUntil || "").slice(0, 10);
  return Boolean(assureur || doc.fileDataUrl) && (!jusqua || jusqua >= maintenant.slice(0, 10));
}

// Ce que le particulier voit de l'artisan (instantané pris à l'acceptation).
// Le téléphone n'est montré qu'après la confirmation.
export function instantaneArtisan(webUser, db, userId) {
  const business = webUser?.business || {};
  const personal = webUser?.personal || {};
  const entreprise = business.raisonSociale || webUser?.name || "Votre artisan";
  const stats = statsAvis((db.avis || []).filter((a) => a.userId === userId));
  const faites = (db.urgences || []).filter((u) => u.artisan?.userId === userId && u.statut === "confirmee" && (db.interventions || []).some((i) => i.id === u.interventionId && i.termineeLe)).length;
  const prenom = String(personal.firstName || "").trim();
  return {
    prenom,
    nom: nomCourt({ prenom, nom: personal.lastName, entreprise }),
    entreprise,
    metier: String(webUser?.professions?.[0] || "").replace("Tout corps d'etat", "tous corps d'état").toLowerCase(),
    initiales: initiales(prenom ? `${prenom} ${personal.lastName || ""}` : entreprise),
    avis: stats.nombre ? { moyenne: moyenneTexte(stats.moyenne), nombre: stats.nombre } : null,
    urgences: faites,
    // Même règle que le badge de la KojiPage : SIREN et décennale renseignés.
    verifie: sirenDe(business).length === 9 && decennaleValide(business),
    telephone: String(business.phone || business.telephone || personal.phone || "").trim()
  };
}

// --- Notifications -----------------------------------------------------------
// Push téléphone : seulement si le serveur a déjà la clé Firebase (même
// mécanisme que /api/push/send) ; sinon rien, la notification Koji suffit.
let firebase = null;
async function envoyerPush(userId, titre, texte, data = {}) {
  const brut = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!brut || !hasSupabaseAdmin || !userId) return;
  try {
    if (!firebase) {
      const admin = (await import("firebase-admin")).default;
      if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(brut)) });
      firebase = admin;
    }
    const { data: jetons } = await getSupabaseAdmin().from("device_tokens").select("device_token").eq("user_id", userId);
    const tokens = (jetons || []).map((t) => t.device_token).filter(Boolean);
    if (!tokens.length) return;
    await firebase.messaging().sendEachForMulticast({ tokens, notification: { title: titre, body: texte }, data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) });
  } catch {
    // Le push est un plus : son échec ne bloque jamais l'urgence.
  }
}

export function notifierArtisan(db, userId, { type, titre, texte, lien = "/urgences" }, pushs) {
  addCompanyNotification(db, { userId, type, title: titre, message: texte, actionUrl: lien, actionLabel: "Ouvrir les urgences" });
  pushs?.push(() => envoyerPush(userId, titre, texte, { type, lien }));
}

export function notifierClient(db, u, { type, titre, texte }, pushs) {
  db.notifications = db.notifications || [];
  db.notifications.unshift({
    id: `notif-urg-${randomUUID()}`, userId: u.clientId, accountType: "particulier", type, title: titre, message: texte,
    actionUrl: `/client/urgence/${u.id}`, actionLabel: "Voir l'urgence", read: false, createdAt: new Date().toISOString()
  });
  pushs?.push(() => envoyerPush(u.clientId, titre, texte, { type, lien: `/client/urgence/${u.id}` }));
}

export const lancerPushs = (pushs) => Promise.allSettled((pushs || []).map((f) => f()));

// --- Stockage -------------------------------------------------------------------
// Les urgences vivent dans leur table (lib/urgences-stock.js) ; le reste
// (notifications, interventions, réglages des artisans) reste dans le bloc.
export { modifierUrgence, ouvrirUrgences };
export const ecrire = (db, stock) => ecrireBloc(db, stock, writeDb);

// --- Avancement de toutes les recherches --------------------------------------
// Appelé à chaque lecture (pas de tâche planifiée) : nouvelles vagues,
// fins de recherche, délais de confirmation. Modifie les urgences en mémoire
// et renvoie les notifications à poser, une par urgence concernée :
// [{ id, appliquer(pushs) }]. Elles ne sont posées qu'une fois l'urgence
// enregistrée par cette requête (voir avancerRecherches), pour que deux
// lectures simultanées ne préviennent pas deux fois.
export function avancerTout(db, maintenant = new Date().toISOString()) {
  const reglages = db.urgencesPro || {};
  const effets = [];
  for (const u of db.urgences || []) {
    if (!["recherche", "acceptee"].includes(u.statut)) continue;
    const avant = u.statut;
    const artisanAvant = u.artisan?.userId || "";
    const nouvelles = avancer(u, u.statut === "recherche" ? candidats(u, reglages, maintenant) : [], maintenant);
    const c = categorieDe(u.categorie);
    const id = u.id;
    for (const p of nouvelles) {
      effets.push({ id, appliquer: (pushs) => notifierArtisan(db, p.userId, { type: "urgence.proposee", titre: `Nouvelle urgence : ${c?.label || "dépannage"}`, texte: `${u.quartier} · ${kmTexte(p.distanceKm)} · 60 secondes pour accepter` }, pushs) });
    }
    if (u.statut === avant) continue;
    if (u.statut === "sans_artisan") {
      effets.push({ id, appliquer: (pushs) => notifierClient(db, u, { type: "urgence.sans_artisan", titre: "Aucun artisan disponible", texte: `${c?.label || "Urgence"} : personne n'a pu accepter pour l'instant. Vous pouvez relancer la recherche.` }, pushs) });
    }
    if (u.statut === "expiree") {
      effets.push({ id, appliquer: (pushs) => notifierClient(db, u, { type: "urgence.expiree", titre: "Délai de confirmation passé", texte: "L'artisan a été libéré. Vous pouvez relancer la recherche." }, pushs) });
      if (artisanAvant) effets.push({ id, appliquer: (pushs) => notifierArtisan(db, artisanAvant, { type: "urgence.expiree", titre: "Urgence non confirmée", texte: `${c?.label || "Urgence"} · ${u.quartier} : le client n'a pas confirmé, vous êtes libre.` }, pushs) });
    }
  }
  return effets;
}

// Urgence confirmée ou annulée dans la table alors que le bloc n'a pas suivi
// (écriture du bloc perdue) : on remet l'intervention d'accord. Sans effet
// le reste du temps. Renvoie true si le bloc a changé.
const DELAI_REPARATION_MS = 20000;
export function reparer(db, maintenant = new Date().toISOString()) {
  let change = false;
  for (const u of db.urgences || []) {
    if (!u.interventionId) continue;
    const i = (db.interventions || []).find((x) => x.id === u.interventionId);
    if (u.statut === "confirmee" && !i && ms(maintenant) - ms(u.confirmeeLe) > DELAI_REPARATION_MS) {
      creerIntervention(db, u, u.confirmeeLe || maintenant);
      change = true;
    } else if (u.statut === "annulee" && i && !i.annuleeLe && !i.termineeLe && ms(maintenant) - ms(u.annuleeLe) > DELAI_REPARATION_MS) {
      Object.assign(i, { annuleeLe: u.annuleeLe || maintenant, status: "annulee", updatedAt: maintenant });
      change = true;
    }
  }
  return change;
}

// Fait avancer les recherches et enregistre chaque urgence qui a bougé. Les
// notifications des urgences enregistrées par cette requête sont posées dans
// le bloc (en mémoire) et leurs envois ajoutés à [pushs]. Renvoie true si le
// bloc est à écrire.
export async function avancerRecherches(db, stock, maintenant = new Date().toISOString(), pushs = []) {
  const repare = reparer(db, maintenant);
  const effets = avancerTout(db, maintenant);
  const conflits = await stock.enregistrer(db);
  const gardes = effets.filter((e) => !conflits.has(e.id));
  for (const e of gardes) e.appliquer(pushs);
  return repare || gardes.length > 0;
}

// --- Photo du particulier ------------------------------------------------------
export async function enregistrerPhoto(clientId, urgenceId, octets) {
  const path = `urgences/${clientId}/${urgenceId}.jpg`;
  const { error } = await getSupabaseAdmin().storage.from(BUCKET).upload(path, Buffer.from(octets), { contentType: "image/jpeg", upsert: true });
  return error ? "" : path;
}
export async function lienPhoto(path) {
  if (!path || !hasSupabaseAdmin) return null;
  try {
    const { data } = await getSupabaseAdmin().storage.from(BUCKET).createSignedUrl(path, 3600);
    return data?.signedUrl || null;
  } catch {
    return null;
  }
}

// --- Confirmation : l'intervention rapide (PRO-17.1) prend le relais ---------
// L'adresse exacte, le nom et le téléphone du particulier arrivent chez
// l'artisan à ce moment seulement (fiche contact + intervention).
// L'identifiant de l'intervention est écrit dans l'urgence au moment de la
// confirmation (même écriture que le passage à « confirmée ») : une urgence
// ne peut donc donner qu'une seule intervention, même rejouée.
export function creerIntervention(db, u, maintenant = new Date().toISOString()) {
  const artisanId = u.artisan.userId;
  const c = categorieDe(u.categorie);
  db.contacts = db.contacts || [];
  db.interventions = db.interventions || [];
  const id = u.interventionId || `int-${Date.now()}`;
  const existante = db.interventions.find((x) => x.id === id);
  if (existante) return existante;
  const contact = {
    id: `contact-${Date.now()}`, userId: artisanId, type: "particulier", ...nomContact(u.nomClient), companyName: "", siret: "", contactPerson: "",
    phone: u.telephone, email: u.email || "", address: u.adresse, city: "", postalCode: "", floor: "", accessCode: "", complement: "",
    accessInstructions: u.complement || "", notes: "Client venu par Urgences Koji.", roles: ["client"], linkedUserId: u.clientId, archived: false, archivedAt: "", createdAt: maintenant, updatedAt: maintenant
  };
  db.contacts.unshift(contact);
  const probleme = [titreUrgence(u), ...detailsUrgence(u).slice(1).map((d) => `${d.libelle.toLowerCase()} : ${d.valeur}`)].join(" · ");
  const i = {
    id, userId: artisanId, rapide: true, urgenceId: u.id,
    reference: `INT-${new Date(maintenant).getFullYear()}-${String(db.interventions.length + 1).padStart(4, "0")}`,
    client: u.nomClient, contactId: contact.id, telephone: u.telephone, email: u.email || "", site: u.adresse, acces: u.complement || "",
    probleme: probleme.slice(0, 500), urgence: "maintenant", prix: { ...u.artisan.prix }, token: randomBytes(18).toString("base64url"),
    // Le prix écrit a été vu et confirmé dans Koji Client : il vaut
    // information préalable sur le prix (maquette, « Confirmation du client »).
    prixEnvoyeLe: u.artisan.accepteLe, accepteLe: maintenant, enRouteLe: "", arriveeVers: u.artisan.arriveeVers, minutesAnnoncees: u.artisan.minutes,
    arriveLe: "", termineeLe: "", annuleeLe: "",
    devis: { lignes: [], enPlus: [], pieces: "", signeLe: "", signataire: "" }, photos: [],
    status: "nouvelle", invoiceId: "", projectId: "", date: maintenant.slice(0, 10), createdAt: maintenant, updatedAt: maintenant
  };
  db.interventions.unshift(i);
  u.interventionId = i.id;
  addHistory(db, { userId: artisanId, type: "intervention.rapide", label: `Urgence Koji confirmée : ${u.nomClient} · ${c?.label || ""}`, entityId: i.id, entityType: "intervention" });
  return i;
}

// --- Vue du particulier ----------------------------------------------------------
export async function vueClient(db, u, maintenant = new Date().toISOString()) {
  const i = u.interventionId ? (db.interventions || []).find((x) => x.id === u.interventionId) : null;
  const etat = etatClient(u, i);
  const f = i?.invoiceId ? (db.invoices || []).find((x) => x.id === i.invoiceId) : null;
  const a = u.artisan?.profil || null;
  const prenom = a?.prenom || "L'artisan";
  const confirmee = u.statut === "confirmee";
  const arrivee = u.artisan ? (i?.arriveeVers || u.artisan.arriveeVers) : "";
  const restantes = arrivee ? minutesAvant(arrivee, maintenant) : null;
  const sansAnnulee = etat !== "annulee";
  return {
    id: u.id,
    categorie: u.categorie,
    titre: titreUrgence(u),
    etat,
    message: messageClient(etat, prenom),
    creeeLe: u.createdAt,
    quartier: u.quartier,
    adresse: u.adresse,
    complement: u.complement || "",
    details: detailsUrgence(u),
    photo: await lienPhoto(u.photo),
    prix: u.prixAffiche || null,
    artisan: u.artisan && a && sansAnnulee && etat !== "sans_artisan" && etat !== "expiree" ? {
      nom: a.metier ? `${a.nom}, ${a.metier}` : a.nom,
      prenom,
      entreprise: a.entreprise,
      initiales: a.initiales,
      avis: a.avis,
      urgences: a.urgences,
      verifie: a.verifie,
      telephone: confirmee ? a.telephone : "",
      arrivee: `vers ${u.artisan.arriveeVers} · ${u.artisan.minutes} min`,
      arriveeVers: arrivee,
      prix: prixArtisanTexte(u.artisan.prix),
      pieces: PIECES_SUR_DEVIS,
      info: `Koji vous met en relation. L'intervention est réalisée et facturée par ${a.entreprise}.`
    } : null,
    suivi: confirmee && sansAnnulee ? {
      titre: etat === "confirmee" || etat === "en_route"
        ? (restantes && etat === "en_route" ? `${prenom} arrive dans ${restantes} min` : `${prenom} arrive vers ${arrivee}`)
        : etat === "sur_place" || etat === "devis_signe" ? `${prenom} est sur place` : "Intervention terminée",
      sousTitre: etat === "en_route" ? `arrivée annoncée vers ${arrivee} · il peut vous appeler au numéro que vous avez donné` : etat === "confirmee" ? "il vous prévient quand il part" : "",
      etapes: etapesSuivi(etat),
      note: etat === "terminee" ? "" : `Avant de commencer, ${prenom} vous fera signer un devis sur son téléphone.`
    } : null,
    devis: i?.devis?.signeLe ? { lignes: (i.devis.lignes || []).map((l) => ({ label: l.label, montant: l.ttc })), total: (i.devis.lignes || []).reduce((s, l) => s + (Number(l.ttc) || 0), 0), signeLe: i.devis.signeLe } : null,
    facture: f ? { numero: f.invoiceNumber, montant: f.amountTtc, payee: f.status === "Payee", pdf: `/api/client/urgences?id=${encodeURIComponent(u.id)}&facture=1` } : null,
    actions: actionsClient(etat, i),
    confirmerAvant: u.statut === "acceptee" ? new Date(ms(u.artisan.accepteLe) + 600000).toISOString() : ""
  };
}

// Minutes d'ici l'heure « 10:42 » annoncée (heure de Paris) ; 0 si passée.
function minutesAvant(hhmm, maintenant) {
  if (!/^\d{2}:\d{2}$/.test(hhmm || "")) return null;
  const [h, m] = hhmm.split(":").map(Number);
  const [nh, nm] = heureParis(maintenant).split(":").map(Number);
  const ecart = (h * 60 + m - (nh * 60 + nm) + 1440) % 1440;
  return ecart > 720 ? 0 : ecart;
}

// --- Vues de l'artisan --------------------------------------------------------------
export async function vueProposition(u, userId, reglages, maintenant = new Date().toISOString()) {
  const p = (u.propositions || []).find((x) => x.userId === userId);
  const c = categorieDe(u.categorie);
  const r = reglages || {};
  // Distance montrée depuis le centre de la maille du quartier, jamais
  // depuis l'adresse exacte.
  const km = u.position && r.zone ? distanceKm(Number(r.zone.lat), Number(r.zone.lon), u.position.lat, u.position.lon) : p.distanceKm;
  const deplacement = Number(r.prix?.[u.categorie]) || 0;
  return {
    id: u.id,
    categorie: u.categorie,
    icone: c?.icone || "",
    titre: titreUrgence(u),
    quartier: u.quartier,
    distance: kmTexte(km),
    minutes: minutesTrajet(km),
    details: [...detailsUrgence(u), { libelle: "Quand", valeur: "maintenant" }],
    photo: await lienPhoto(u.photo),
    prix: { montant: `${euros(deplacement)} TTC`, detail: `déplacement et 1re demi-heure, puis ${euros(r.demiHeure)} la demi-heure` },
    finLe: new Date(finProposition(p)).toISOString(),
    secondes: Math.max(0, Math.round((finProposition(p) - ms(maintenant)) / 1000)),
    proposeeA: nombreProposes(u),
    serrure: u.categorie === "serrure"
  };
}

export function propositionsPour(db, userId, maintenant = new Date().toISOString()) {
  return (db.urgences || []).filter((u) => u.statut === "recherche" && propositionActive((u.propositions || []).find((p) => p.userId === userId), maintenant));
}

// Urgences reçues par l'artisan et prises par un autre dans les 10
// dernières minutes : « le premier qui accepte l'obtient ».
export function prisesPour(db, userId, maintenant = new Date().toISOString()) {
  return (db.urgences || [])
    .filter((u) => u.artisan && u.artisan.userId !== userId && ms(maintenant) - ms(u.artisan.accepteLe) < 600000 && (u.propositions || []).some((p) => p.userId === userId && !p.refuseeLe))
    .map((u) => ({ id: u.id, titre: titreUrgence(u), quartier: u.quartier }));
}

// Urgences acceptées par l'artisan et pas encore finies.
export function enCoursPour(db, userId) {
  return (db.urgences || [])
    .filter((u) => u.artisan?.userId === userId && (u.statut === "acceptee" || (u.statut === "confirmee" && !(db.interventions || []).find((i) => i.id === u.interventionId && (i.termineeLe || i.annuleeLe)))))
    .map((u) => {
      const i = (db.interventions || []).find((x) => x.id === u.interventionId) || null;
      return {
        id: u.id, titre: titreUrgence(u), quartier: u.quartier, etat: u.statut, interventionId: u.interventionId || "",
        arriveeVers: i?.arriveeVers || u.artisan.arriveeVers, minutes: u.artisan.minutes, parti: Boolean(i?.enRouteLe),
        confirmerAvant: u.statut === "acceptee" ? new Date(ms(u.artisan.accepteLe) + 600000).toISOString() : "",
        serrure: u.categorie === "serrure"
      };
    });
}

export function tableauPro(db, userId, maintenant = new Date().toISOString()) {
  const miennes = (db.urgences || []).filter((u) => u.artisan?.userId === userId && (u.statut === "confirmee" || (u.statut === "annulee" && u.confirmeeLe)));
  const interventions = (db.interventions || []).filter((i) => i.userId === userId && i.urgenceId);
  const factures = (db.invoices || []).filter((f) => f.userId === userId && f.interventionId);
  const parId = new Map(interventions.map((i) => [i.id, i]));
  const liste = miennes
    .sort((a, b) => ms(b.confirmeeLe) - ms(a.confirmeeLe))
    .slice(0, 8)
    .map((u) => {
      const i = parId.get(u.interventionId) || null;
      const f = i?.invoiceId ? factures.find((x) => x.id === i.invoiceId) : null;
      const montant = f ? Number(f.amountTtc) : i?.devis?.signeLe ? (i.devis.lignes || []).reduce((s, l) => s + (Number(l.ttc) || 0), 0) : 0;
      return { id: u.id, interventionId: u.interventionId || "", quand: quandListe(u.confirmeeLe, maintenant), titre: titreUrgence(u), client: clientCourt(u.nomClient, u.quartier), montant, statut: statutListe(u, i, f) };
    });
  return { chiffres: chiffresDuJour(miennes, interventions, factures, maintenant), interventions: liste };
}

// L'intervention rapide née d'une urgence avance (route PRO-17.1) : le
// particulier est prévenu dans Koji Client. Renvoie le stock ouvert (ou
// null) : l'appelant écrit ensuite le bloc avec ecrire(db, stock).
export async function suiteUrgence(db, i, action, pushs) {
  if (!i?.urgenceId) return null;
  const stock = await ouvrirUrgences(db, { ids: [i.urgenceId] });
  let u = (db.urgences || []).find((x) => x.id === i.urgenceId);
  if (!u) return stock;
  const prenom = u.artisan?.profil?.prenom || "L'artisan";
  const textes = {
    "en-route": ["urgence.en_route", `${prenom} est en route`, `Arrivée annoncée vers ${i.arriveeVers}.`],
    arrive: ["urgence.sur_place", `${prenom} est arrivé`, "Il vous fera signer un devis avant de commencer."],
    terminer: ["urgence.facture", "Intervention terminée", "La facture est disponible dans votre espace."],
    annuler: ["urgence.annulee", "Urgence annulée par l'artisan", "Vous pouvez commander une nouvelle urgence."]
  }[action];
  if (!textes) return stock;
  if (action === "annuler") {
    const maintenant = new Date().toISOString();
    const r = await modifierUrgence(stock, db, u.id, (x) => {
      if (x.statut !== "annulee") Object.assign(x, { statut: "annulee", annuleeLe: maintenant, annuleePar: "artisan" });
      return "";
    });
    u = r.u || u;
  }
  notifierClient(db, u, { type: textes[0], titre: textes[1], texte: textes[2] }, pushs);
  return stock;
}
