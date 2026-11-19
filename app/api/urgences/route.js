import { badRequest, ok } from "../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../lib/db";
import { resolveEntreprise, loadEntrepriseProfile } from "../../../lib/entreprise-auth";
import { isTrialUser } from "../../../lib/plan";
import { sirenDe } from "../../../lib/compte-pro";
import { arriveeVers, heureParis } from "../../../lib/intervention-rapide";
import {
  accepter, categorieAutorisee, categorieDe, demiHeureDe, dispoActive, finDispo, heureParDefaut, NOTE_PRO, nettoyerReglages, ORDRE_PRO,
  prixDe, RAYONS, refuser, retirer
} from "../../../lib/urgences";
import {
  avancerTout, enCoursPour, geocoder, instantaneArtisan, lancerPushs, notifierClient, prisesPour, propositionsPour, tableauPro, vueProposition
} from "../../../lib/urgences-serveur";

// Urgences côté artisan (maquette PRO-17) : disponibilité, zone, prix par
// urgence, urgences proposées (accepter / refuser), chiffres du jour.
// GET → tout ; GET ?alertes=1 → seulement les propositions et urgences en
// cours (rafraîchissement régulier de l'écran). POST JSON actions :
// reglages, disponible, accepter, refuser, retirer, partir.
// Chaque lecture fait aussi avancer les recherches en cours (vagues
// d'attribution) : pas de tâche planifiée.

function reglagesDe(db, userId, webUser) {
  const r = db.urgencesPro?.[userId] || {};
  const business = webUser?.business || {};
  const prixIntervention = db.comptePrefs?.[userId]?.prixIntervention || {};
  // Zone : celle choisie pour les urgences, sinon la zone de travail déjà
  // géocodée du profil.
  const zoneProfil = Number.isFinite(Number(business.zoneLat)) && business.zoneLat !== "" && business.zoneLat !== null && business.zoneLat !== undefined
    ? { adresse: String(business.zoneAddress || business.city || "").trim(), lat: Number(business.zoneLat), lon: Number(business.zoneLon), rayonKm: 8, duProfil: true }
    : null;
  return {
    ...r,
    zone: r.zone || zoneProfil,
    demiHeure: Number(r.demiHeure) > 0 ? r.demiHeure : Number(prixIntervention.demiHeure) || 0,
    prix: r.prix || {}
  };
}

function acces(webUser) {
  if (!webUser) return { ok: false, raison: "Profil introuvable." };
  if (isTrialUser(webUser)) return { ok: false, raison: "Les urgences font partie des offres Pro et Business.", abonnement: true };
  if (sirenDe(webUser.business || {}).length !== 9) return { ok: false, raison: "Ajoutez le SIREN de votre entreprise dans votre profil pour recevoir des urgences." };
  return { ok: true, raison: "" };
}

async function vueComplete(db, userId, webUser, maintenant) {
  const r = reglagesDe(db, userId, webUser);
  const metiers = webUser?.professions || [];
  const active = dispoActive(r, maintenant);
  const prixIntervention = db.comptePrefs?.[userId]?.prixIntervention || {};
  return {
    acces: acces(webUser),
    entreprise: webUser?.business?.raisonSociale || webUser?.name || "",
    reglages: {
      actif: active,
      jusqua: active ? heureParis(r.jusqua) : "",
      heureParDefaut: heureParDefaut(maintenant),
      zone: r.zone ? { adresse: r.zone.adresse || "", rayonKm: Number(r.zone.rayonKm) || 8, duProfil: Boolean(r.zone.duProfil) } : null,
      demiHeure: demiHeureDe(r),
      categories: ORDRE_PRO.map((id) => {
        const c = categorieDe(id);
        const autorisee = categorieAutorisee(id, metiers);
        return { id, label: c.pro, icone: c.icone, prix: prixDe(r, id) || null, choisie: prixDe(r, id) > 0, autorisee, raison: autorisee ? "" : "à déclarer dans votre profil (métier)", prixIntervention: Number(prixIntervention.deplacement) || null };
      })
    },
    rayons: RAYONS,
    note: NOTE_PRO,
    ...(await alertes(db, userId, r, maintenant)),
    ...tableauPro(db, userId, maintenant)
  };
}

async function alertes(db, userId, r, maintenant) {
  const propositions = await Promise.all(propositionsPour(db, userId, maintenant).map((u) => vueProposition(u, userId, r, maintenant)));
  return { propositions, enCours: enCoursPour(db, userId), prises: prisesPour(db, userId, maintenant), maintenant };
}

async function contexte(request, body) {
  const entreprise = await resolveEntreprise(request, body);
  if (!entreprise) return { erreur: badRequest("Connexion requise.", 401) };
  return { entreprise, db: await readDb() };
}

export async function GET(request) {
  const ctx = await contexte(request);
  if (ctx.erreur) return ctx.erreur;
  const { db, entreprise } = ctx;
  const userId = entreprise.userId;
  const maintenant = new Date().toISOString();
  const pushs = [];
  if (avancerTout(db, maintenant, pushs)) { await writeDb(db); await lancerPushs(pushs); }
  if (new URL(request.url).searchParams.get("alertes")) {
    return ok(await alertes(db, userId, reglagesDe(db, userId, null), maintenant));
  }
  const webUser = await loadEntrepriseProfile(entreprise);
  return ok(await vueComplete(db, userId, webUser, maintenant));
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return badRequest("Envoi invalide."); }
  const ctx = await contexte(request, body);
  if (ctx.erreur) return ctx.erreur;
  const { db, entreprise } = ctx;
  const userId = entreprise.userId;
  const maintenant = new Date().toISOString();
  const webUser = await loadEntrepriseProfile(entreprise);
  const action = String(body.action || "");
  const pushs = [];
  avancerTout(db, maintenant, pushs);
  db.urgencesPro = db.urgencesPro || {};
  db.urgences = db.urgences || [];
  const actuels = reglagesDe(db, userId, webUser);

  if (action === "reglages") {
    const propre = nettoyerReglages(body, webUser.professions || []);
    let zone = actuels.zone;
    const saisie = String(body.adresse ?? "").trim().slice(0, 200);
    if (saisie && saisie !== (actuels.zone?.adresse || "")) {
      const g = await geocoder(saisie);
      if (!g) return badRequest("Adresse introuvable. Indiquez une adresse ou une ville.");
      zone = { adresse: g.city && g.postcode ? `${g.city} (${g.postcode})` : g.label, lat: g.lat, lon: g.lon };
    }
    if (!zone) return badRequest("Indiquez l'adresse autour de laquelle vous recevez les urgences.");
    if (!propre.demiHeure) return badRequest("Indiquez le prix de la demi-heure suivante.");
    if (!Object.keys(propre.prix).length) return badRequest("Choisissez au moins une urgence et son prix.");
    db.urgencesPro[userId] = { ...(db.urgencesPro[userId] || {}), zone: { adresse: zone.adresse, lat: zone.lat, lon: zone.lon, rayonKm: propre.rayonKm }, prix: propre.prix, demiHeure: propre.demiHeure, modifieLe: maintenant };
  } else if (action === "disponible") {
    const r = db.urgencesPro[userId] || {};
    if (body.actif === false) {
      db.urgencesPro[userId] = { ...r, actif: false, jusqua: "" };
    } else {
      const a = acces(webUser);
      if (!a.ok) return badRequest(a.raison, 403);
      if (!db.urgencesPro[userId]?.prix || !Object.keys(db.urgencesPro[userId].prix).length || !db.urgencesPro[userId].zone) return badRequest("Réglez d'abord votre zone, vos urgences et vos prix.");
      const jusqua = finDispo(body.jusqua || heureParDefaut(maintenant), maintenant);
      if (!jusqua) return badRequest("Choisissez une heure de fin dans les 14 prochaines heures.");
      db.urgencesPro[userId] = { ...r, actif: true, jusqua, depuis: maintenant };
    }
  } else if (["accepter", "refuser", "retirer"].includes(action)) {
    const u = db.urgences.find((x) => x.id === String(body.id || ""));
    // Même réponse qu'une urgence inexistante si elle n'a jamais été
    // proposée à cet artisan.
    if (!u || !(u.propositions || []).some((p) => p.userId === userId)) return badRequest("Urgence introuvable.", 404);
    if (action === "refuser") {
      refuser(u, userId, maintenant);
    } else if (action === "accepter") {
      const prix = { deplacement: prixDe(actuels, u.categorie), demiHeure: demiHeureDe(actuels) };
      if (!prix.deplacement || !prix.demiHeure) return badRequest("Votre prix pour cette urgence manque.");
      const erreur = accepter(u, { userId, minutes: body.minutes, prix, maintenant });
      if (erreur) { await writeDb(db); return badRequest(erreur, 409); }
      u.artisan.profil = instantaneArtisan(webUser, db, userId);
      const c = categorieDe(u.categorie);
      notifierClient(db, u, { type: "urgence.acceptee", titre: "Un artisan a accepté", texte: `${u.artisan.profil.nom} peut arriver vers ${u.artisan.arriveeVers}. Confirmez pour qu'il parte.` }, pushs);
      addHistory(db, { userId, type: "urgence.acceptee", label: `Urgence acceptée : ${c?.label || ""} · ${u.quartier}`, entityId: u.id, entityType: "urgence" });
      await writeDb(db);
      // Le premier qui accepte l'obtient : on relit pour le cas où un autre
      // artisan aurait écrit au même instant.
      const relu = (await readDb()).urgences?.find((x) => x.id === u.id);
      if (relu?.artisan?.userId !== userId) return badRequest("Cette urgence a déjà été prise par un autre artisan.", 409);
      await lancerPushs(pushs);
      return ok(await vueComplete(await readDb(), userId, webUser, maintenant));
    } else {
      const erreur = retirer(u, userId, maintenant);
      if (erreur) return badRequest(erreur, 409);
      notifierClient(db, u, { type: "urgence.retiree", titre: "L'artisan s'est retiré", texte: "La recherche d'un autre artisan disponible reprend." }, pushs);
    }
  } else if (action === "partir") {
    // L'artisan part : l'intervention rapide passe « en route » (même
    // règle que /api/interventions/rapide, action en-route).
    const u = db.urgences.find((x) => x.id === String(body.id || "") && x.artisan?.userId === userId && x.statut === "confirmee");
    const i = u ? (db.interventions || []).find((x) => x.id === u.interventionId && x.userId === userId) : null;
    if (!i) return badRequest("Urgence introuvable.", 404);
    if (i.annuleeLe) return badRequest("Le client a annulé cette urgence.", 409);
    if (!i.enRouteLe) {
      const minutes = Math.max(1, Math.min(240, Math.round(Number(body.minutes) || u.artisan.minutes || 20)));
      Object.assign(i, { enRouteLe: maintenant, arriveeVers: arriveeVers(minutes, maintenant), status: "en_route", updatedAt: maintenant });
      notifierClient(db, u, { type: "urgence.en_route", titre: `${u.artisan.profil?.prenom || "L'artisan"} est en route`, texte: `Arrivée annoncée vers ${i.arriveeVers}.` }, pushs);
      addHistory(db, { userId, type: "intervention.en_route", label: `En route : ${i.client}, arrivée vers ${i.arriveeVers}`, entityId: i.id, entityType: "intervention" });
    }
    await writeDb(db);
    await lancerPushs(pushs);
    return ok({ interventionId: i.id });
  } else {
    return badRequest("Action inconnue.");
  }
  await writeDb(db);
  await lancerPushs(pushs);
  return ok(await vueComplete(db, userId, webUser, maintenant));
}

