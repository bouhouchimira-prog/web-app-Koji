import { badRequest, ok } from "../../../../lib/http";
import { readDb, writeDb } from "../../../../lib/db";
import { resolveEntreprise } from "../../../../lib/entreprise-auth";
import { appliquerTarif, chiffresFournitures, lireTarifCsv, nombre, r2 } from "../../../../lib/fournitures-pro";
import { bonsDe, changerReglage, chargerCatalogue, chargerChantiersFournitures, enregistrerArticle, lireSaisie, supprimerArticle } from "../../../../lib/fournitures-serveur";

// Catalogue fournitures de l'entreprise (maquette PRO-07 et PRO-07.2).
export async function GET(request) {
  const entreprise = await resolveEntreprise(request);
  if (!entreprise) return badRequest("Connexion requise.", 401);
  const db = await readDb();
  try {
    const { articles, fournisseurs, reglage } = await chargerCatalogue(entreprise, db);
    const bons = bonsDe(db, entreprise.userId);
    const chantiers = await chargerChantiersFournitures(entreprise, db, articles).catch(() => []);
    const chiffres = chiffresFournitures({ articles, bons, besoins: chantiers.filter((c) => c.statut === "a_commander").map((c) => ({ aCommanderHt: c.aCommanderHt })) });
    const commandesParChantier = chantiers.map(({ besoins, ranges, ...c }) => c);
    return ok({ articles, fournisseurs, reglage, chiffres, commandesParChantier });
  } catch (error) {
    return badRequest(error.message, 500);
  }
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const entreprise = await resolveEntreprise(request, body);
  if (!entreprise) return badRequest("Connexion requise.", 401);
  const db = await readDb();
  try {
    const { fournisseurs, reglage } = await chargerCatalogue(entreprise, db);
    const saisie = lireSaisie(body, fournisseurs);
    const article = await enregistrerArticle(entreprise, db, saisie, { fournisseurs, coef: reglage.coef });
    await writeDb(db);
    return ok({ article }, 201);
  } catch (error) {
    return badRequest(error.message, 400);
  }
}

export async function PATCH(request) {
  const body = await request.json().catch(() => ({}));
  const entreprise = await resolveEntreprise(request, body);
  if (!entreprise) return badRequest("Connexion requise.", 401);
  const db = await readDb();
  try {
    if (body.action === "reglage") {
      const reglage = changerReglage(db, entreprise.userId, { coef: body.coef, lieux: body.lieux });
      await writeDb(db);
      return ok({ reglage });
    }
    const { articles, fournisseurs, reglage } = await chargerCatalogue(entreprise, db);

    // « Importer un tarif » : prix d'achat et prix public mis à jour par
    // référence ; les devis déjà faits ne changent pas.
    if (body.action === "tarif") {
      const { lignes, erreurs } = lireTarifCsv(String(body.csv || "").slice(0, 2_000_000));
      if (!lignes.length) return badRequest(erreurs[0] || "Aucune ligne lisible dans ce tarif.");
      const majs = appliquerTarif(articles, lignes, { supplierId: body.supplierId || "" });
      if (body.apercu) return ok({ lues: lignes.length, trouvees: majs.length, erreurs: erreurs.slice(0, 5), majs: majs.slice(0, 50) });
      const date = new Date().toISOString().slice(0, 10);
      // Le tarif est gardé (un par fournisseur) : la saisie assistée y
      // cherche le prix public d'une référence.
      if (!Array.isArray(db.tarifsFournisseurs)) db.tarifsFournisseurs = [];
      db.tarifsFournisseurs = db.tarifsFournisseurs.filter((t) => !(t.userId === entreprise.userId && t.supplierId === (body.supplierId || "")));
      db.tarifsFournisseurs.push({ userId: entreprise.userId, supplierId: body.supplierId || "", date, lignes: lignes.slice(0, 5000) });
      const maj = [];
      for (const m of majs) {
        const a = articles.find((x) => x.id === m.id);
        const fours = a.fournisseurs.map((f) => (body.supplierId ? f.supplierId === body.supplierId : f.prefere) && m.achat > 0 ? { ...f, achatCond: r2(m.achat * (a.contenance || 1)), achat: m.achat } : f);
        const saisie = lireSaisie({ ...a, fournisseurs: fours, prixPublic: m.public > 0 ? m.public : a.prixPublic, publicSource: m.public > 0 ? `tarif fournisseur du ${date}` : a.publicSource }, fournisseurs);
        maj.push(await enregistrerArticle(entreprise, db, saisie, { id: a.id, fournisseurs, coef: reglage.coef }));
      }
      await writeDb(db);
      return ok({ lues: lignes.length, misAJour: maj.length, articles: maj });
    }

    if (!body.id || !articles.some((a) => a.id === body.id)) return badRequest("Article introuvable.", 404);
    if (body.action === "delete") {
      await supprimerArticle(entreprise, db, body.id);
      await writeDb(db);
      return ok({ deleted: true });
    }
    const actuel = articles.find((a) => a.id === body.id);
    const saisie = lireSaisie({ ...actuel, ...body, coef: body.coef ?? actuel.coef }, fournisseurs);
    if (nombre(saisie.prixManuel) < 0) return badRequest("Prix invalide.");
    const article = await enregistrerArticle(entreprise, db, saisie, { id: body.id, fournisseurs, coef: reglage.coef });
    await writeDb(db);
    return ok({ article });
  } catch (error) {
    return badRequest(error.message, 400);
  }
}
