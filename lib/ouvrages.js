import catalog from "../data/catalog-ouvrages.json";
import { fixText } from "./text";

export function normalizeOuvrage(item) {
  return {
    ...item,
    code: fixText(item.code || ""),
    label: fixText(item.label || ""),
    description: fixText(item.description || ""),
    noteInterne: fixText(item.noteInterne || ""),
    sourceInterne: fixText(item.sourceInterne || ""),
    profession: fixText(item.profession || item.family || ""),
    family: fixText(item.family || "Autre"),
    category: fixText(item.category || item.family || "General"),
    type: item.type || (item.parentCode ? "SOUS-POSTE" : "POSTE"),
    unit: fixText(item.unit || "u"),
    normativeTime: Number(item.normativeTime || 0),
    hourlyRate: Number(item.hourlyRate || 0),
    coefficient: Number(item.coefficient || 1),
    discount: Number(item.discount || 0),
    parentCode: item.parentCode || null,
    materialCategories: Array.isArray(item.materialCategories) ? item.materialCategories : []
  };
}

// Catalogue partage Koji (21 oct — avant cette date c'etait uniquement
// data/catalog-ouvrages.json) : vit maintenant dans db.kojiOuvrages (table
// koji_web_state), modifiable par les comptes admin sans deploiement de
// code (voir app/api/ouvrages/route.js). Le fichier JSON reste un repli
// pur si db.kojiOuvrages est vide — un environnement qui n'a pas encore
// tourne scripts/migrate-ouvrages-to-db.js continue de fonctionner a
// l'identique d'avant plutot que de se retrouver avec une bibliotheque
// vide.
function kojiBaseCatalog(db) {
  return Array.isArray(db?.kojiOuvrages) && db.kojiOuvrages.length ? db.kojiOuvrages : catalog;
}

// Bibliotheque de prix (21 oct, demande d'Amira) : chaque entreprise a
// desormais SA PROPRE bibliotheque — ses ajouts (db.ouvrages, filtres par
// userId) et ses masquages d'ouvrages Koji (db.deletedOuvrages, idem) ne
// sont plus visibles des autres comptes. Avant cette date, les deux
// collections etaient partagees globalement entre tous les comptes (bug
// d'isolation, corrige ici — voir app/api/ouvrages/route.js pour la partie
// ecriture). `userId` vide (assistants sans contexte entreprise, ex. Radar
// des Chantiers cote particulier) ne renvoie que le socle Koji commun, sans
// aucune surcouche personnelle.
export function mergedOuvrages(db, userId = "") {
  const base = kojiBaseCatalog(db);

  // Anciennes suppressions globales (avant la bascule per-entreprise) : de
  // simples chaines d'id, toujours honorees pour tout le monde — une
  // nouvelle suppression est desormais un objet {ouvrageId, userId}, propre
  // a son auteur.
  const hiddenIds = new Set(
    (db.deletedOuvrages || [])
      .filter((entry) => typeof entry === "string" || entry.userId === userId)
      .map((entry) => (typeof entry === "string" ? entry : entry.ouvrageId))
  );

  const myCustom = (db.ouvrages || [])
    .filter((item) => item.userId === userId)
    .map(normalizeOuvrage);
  const myCustomById = new Map(myCustom.map((item) => [item.id, item]));

  const visibleBase = base
    .filter((item) => !hiddenIds.has(item.id))
    .map((item) => myCustomById.get(item.id) || normalizeOuvrage(item));
  const customOnly = myCustom.filter((item) => !base.some((baseItem) => baseItem.id === item.id));

  return [...visibleBase, ...customOnly];
}
