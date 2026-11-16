import { badRequest, ok } from "../../../../lib/http";
import { readDb } from "../../../../lib/db";
import { loadEntrepriseProfile, resolveEntreprise } from "../../../../lib/entreprise-auth";
import { proposerStock } from "../../../../lib/fournitures-chantier";
import { chargerCatalogue, chargerChantiersFournitures } from "../../../../lib/fournitures-serveur";

// Fournitures d'un chantier (maquette PRO-07.1) : besoins du devis et des
// avenants signés, rangés par fournisseur ; stock à utiliser avant de
// commander (PRO-07.4, Business).
export async function GET(request) {
  const entreprise = await resolveEntreprise(request);
  if (!entreprise) return badRequest("Connexion requise.", 401);
  const projectId = new URL(request.url).searchParams.get("projet") || "";
  if (!projectId) return badRequest("Chantier manquant.");
  const db = await readDb();
  try {
    const { articles } = await chargerCatalogue(entreprise, db);
    const [chantier] = await chargerChantiersFournitures(entreprise, db, articles, { projectId });
    if (!chantier) return badRequest("Chantier introuvable.", 404);
    const webUser = await loadEntrepriseProfile(entreprise);
    const business = Boolean(webUser.isAdmin) || webUser.plan === "business";
    const stock = business ? (db.stockPro || []).filter((s) => s.userId === entreprise.userId && s.quantite > 0) : [];
    const avecArticle = chantier.besoins.map((b) => {
      const a = articles.find((x) => x.id === b.articleId);
      return { ...b, famille: a?.famille || "", vente: a?.vente || 0, delai: a?.delai ?? null, partenaire: a?.partenaire || null };
    });
    const propositions = business ? proposerStock(avecArticle.filter((b) => !b.manques.length && b.reste > 0).map((b) => ({ ...b, quantite: b.reste })), stock) : [];
    return ok({
      chantier: { ...chantier, besoins: avecArticle },
      business,
      stock: propositions.filter((p) => p.enStock > 0).map((p) => ({ cle: p.cle, enStock: p.enStock, utiliser: p.utiliser, coche: p.coche, teinte: p.teinte, lieux: p.lieux, ids: stock.filter((s) => (p.articleId && s.articleId === p.articleId) || (!p.articleId && s.name === p.name)).map((s) => ({ id: s.id, quantite: s.quantite, lieu: s.lieu })) }))
    });
  } catch (error) {
    return badRequest(error.message, 500);
  }
}
