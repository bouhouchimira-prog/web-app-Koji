import { badRequest, ok } from "../../../../lib/http";
import { makeToken, readDb, writeDb } from "../../../../lib/db";
import { loadEntrepriseProfile, resolveEntreprise } from "../../../../lib/entreprise-auth";
import { LIEUX_MAX, moisSansUsage, restesProbables, valeurStock } from "../../../../lib/fournitures-chantier";
import { nombre, r2 } from "../../../../lib/fournitures-pro";
import { bonsDe, changerReglage, chargerCatalogue, chargerChantiersFournitures, reglageFournitures } from "../../../../lib/fournitures-serveur";
import { fixText } from "../../../../lib/text";

// Stock léger (maquette PRO-07.4, Business) : reliquats de chantier et ajouts
// manuels. Trois entrées (fin de chantier, écart d'arrondi, ajout manuel),
// deux sorties (affectation à un chantier, sortie manuelle). Rien n'entre ni
// ne sort sans validation de l'entrepreneur.
const texte = (v, max = 160) => fixText(String(v ?? "")).replace(/\s+/g, " ").trim().slice(0, max);
const today = () => new Date().toISOString().slice(0, 10);

async function contexte(request, body) {
  const entreprise = await resolveEntreprise(request, body);
  if (!entreprise) return { erreur: badRequest("Connexion requise.", 401) };
  const webUser = await loadEntrepriseProfile(entreprise);
  const business = Boolean(webUser.isAdmin) || webUser.plan === "business";
  return { entreprise, business };
}

function vueStock(db, userId) {
  const lignes = (db.stockPro || []).filter((s) => s.userId === userId && s.quantite > 0);
  const reglage = reglageFournitures(db, userId);
  const mois = today().slice(0, 7);
  const sorties = (db.stockMouvements || []).filter((m) => m.userId === userId && m.type === "sortie" && m.motif === "chantier" && String(m.date).slice(0, 7) === mois);
  const prochain = (() => {
    const base = reglage.inventaireLe || today();
    const d = new Date(`${base}T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + 3);
    return reglage.inventaireLe ? d.toISOString().slice(0, 10) : today();
  })();
  return {
    lignes: lignes.map((l) => ({ ...l, moisSansUsage: moisSansUsage(l, today()) })).sort((a, b) => String(b.entreeLe).localeCompare(String(a.entreeLe))),
    lieux: reglage.lieux,
    chiffres: {
      articles: lignes.length,
      lieux: new Set(lignes.map((l) => l.lieu)).size,
      valeur: valeurStock(lignes),
      utilises: sorties.length,
      economise: r2(sorties.reduce((s, m) => s + nombre(m.quantite) * nombre(m.prixHt), 0)),
      inventaireLe: reglage.inventaireLe,
      prochainInventaire: prochain
    }
  };
}

export async function GET(request) {
  const ctx = await contexte(request);
  if (ctx.erreur) return ctx.erreur;
  if (!ctx.business) return ok({ business: false });
  const db = await readDb();
  const projet = new URL(request.url).searchParams.get("cloture") || "";
  if (!projet) return ok({ business: true, ...vueStock(db, ctx.entreprise.userId) });

  // Clôture : Koji calcule commandé − posé, par article livré sur ce chantier.
  const { articles } = await chargerCatalogue(ctx.entreprise, db);
  const [chantier] = await chargerChantiersFournitures(ctx.entreprise, db, articles, { projectId: projet });
  if (!chantier) return badRequest("Chantier introuvable.", 404);
  const commandes = new Map();
  for (const bon of bonsDe(db, ctx.entreprise.userId).filter((b) => b.projectId === projet && b.etat !== "annule" && b.etat !== "brouillon")) {
    for (const l of bon.lignes) {
      const cle = l.articleId || `nom:${l.name}`;
      const ex = commandes.get(cle) || { cle, articleId: l.articleId, name: l.name, unit: l.unit, prixHt: l.prixHt, commande: 0 };
      ex.commande = r2(ex.commande + nombre(l.livre > 0 ? l.livre : l.quantite));
      commandes.set(cle, ex);
    }
  }
  const posees = new Map(chantier.besoins.map((b) => [b.articleId || b.cle, b.quantite]));
  const restes = restesProbables({ commandes: [...commandes.values()].map((c) => ({ ...c, posee: posees.get(c.cle) ?? 0 })), posees: new Map() });
  return ok({ business: true, chantier: { projectId: chantier.projectId, title: chantier.title }, restes, lieux: reglageFournitures(db, ctx.entreprise.userId).lieux });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const ctx = await contexte(request, body);
  if (ctx.erreur) return ctx.erreur;
  if (!ctx.business) return badRequest("Le stock est inclus dans l'offre Business.", 402);
  const userId = ctx.entreprise.userId;
  const db = await readDb();
  if (!Array.isArray(db.stockPro)) db.stockPro = [];
  if (!Array.isArray(db.stockMouvements)) db.stockMouvements = [];
  const lieux = reglageFournitures(db, userId).lieux;
  const lieuValide = (l) => (lieux.includes(l) ? l : lieux[0]);
  const mouvement = (m) => db.stockMouvements.unshift({ id: makeToken("mv"), userId, date: today(), ...m });

  const entrer = (e, origine, origineLabel) => {
    const q = r2(nombre(e.quantite));
    if (!(q > 0) || !texte(e.name)) return null;
    const ligne = {
      id: makeToken("st"),
      userId,
      articleId: texte(e.articleId, 60),
      name: texte(e.name),
      unit: texte(e.unit, 12) || "u",
      quantite: q,
      lieu: lieuValide(texte(e.lieu, 40)),
      prixHt: r2(Math.max(0, nombre(e.prixHt))),
      origine,
      origineLabel: texte(origineLabel, 120),
      entame: Boolean(e.entame),
      entreeLe: today()
    };
    db.stockPro.push(ligne);
    mouvement({ stockId: ligne.id, name: ligne.name, type: "entree", motif: origine, quantite: q, unit: ligne.unit, prixHt: ligne.prixHt });
    return ligne;
  };

  if (body.action === "ajouter") {
    let prixHt = body.prixHt;
    if (body.articleId && !(nombre(prixHt) > 0)) {
      const { articles } = await chargerCatalogue(ctx.entreprise, db);
      prixHt = articles.find((a) => a.id === body.articleId)?.achat || 0;
    }
    const l = entrer({ ...body, prixHt }, body.origine === "arrondi" ? "arrondi" : "manuel", body.origine === "arrondi" ? `écart d'arrondi${body.projectTitle ? ` · ${texte(body.projectTitle, 80)}` : ""}` : "ajout manuel");
    if (!l) return badRequest("Article et quantité obligatoires.");
  } else if (body.action === "cloture") {
    const titre = texte(body.projectTitle, 100);
    const entrees = (Array.isArray(body.lignes) ? body.lignes : []).slice(0, 100).map((e) => entrer(e, "chantier", titre)).filter(Boolean);
    if (!entrees.length && body.rien !== true) return badRequest("Rien à mettre en stock.");
  } else if (body.action === "sortie") {
    const ligne = db.stockPro.find((s) => s.id === body.id && s.userId === userId);
    if (!ligne) return badRequest("Article de stock introuvable.", 404);
    const q = r2(Math.min(nombre(body.quantite, ligne.quantite), ligne.quantite));
    if (!(q > 0)) return badRequest("Quantité invalide.");
    const motif = ["chantier", "perte", "casse", "interne"].includes(body.motif) ? body.motif : "interne";
    ligne.quantite = r2(ligne.quantite - q);
    ligne.utiliseLe = today();
    mouvement({ stockId: ligne.id, name: ligne.name, type: "sortie", motif, projectId: texte(body.projectId, 60), projectTitle: texte(body.projectTitle, 100), quantite: q, unit: ligne.unit, prixHt: ligne.prixHt });
  } else if (body.action === "inventaire") {
    for (const i of Array.isArray(body.lignes) ? body.lignes : []) {
      const ligne = db.stockPro.find((s) => s.id === i.id && s.userId === userId);
      if (!ligne) continue;
      const q = r2(Math.max(0, nombre(i.quantite)));
      if (Math.abs(q - ligne.quantite) >= 0.005) mouvement({ stockId: ligne.id, name: ligne.name, type: q > ligne.quantite ? "entree" : "sortie", motif: "inventaire", quantite: r2(Math.abs(q - ligne.quantite)), unit: ligne.unit, prixHt: ligne.prixHt });
      ligne.quantite = q;
      if (i.lieu) ligne.lieu = lieuValide(texte(i.lieu, 40));
    }
    changerReglage(db, userId, { inventaireLe: today() });
  } else if (body.action === "lieux") {
    const l = (Array.isArray(body.lieux) ? body.lieux : []).map((x) => texte(x, 40)).filter(Boolean).slice(0, LIEUX_MAX);
    if (!l.length) return badRequest("Au moins un lieu.");
    changerReglage(db, userId, { lieux: l });
  } else {
    return badRequest("Action inconnue.");
  }
  db.stockPro = db.stockPro.filter((s) => !(s.userId === userId && !(s.quantite > 0)));
  await writeDb(db);
  return ok({ business: true, ...vueStock(db, userId) });
}
