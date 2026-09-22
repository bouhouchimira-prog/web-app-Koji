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

// Ouvrages library is shared across all users — no userId scoping on reads.
export function mergedOuvrages(db) {
  const deleted = new Set(db.deletedOuvrages || []);
  const custom = (db.ouvrages || []).map(normalizeOuvrage);
  const customById = new Map(custom.map((item) => [item.id, item]));
  const base = catalog
    .filter((item) => !deleted.has(item.id))
    .map((item) => customById.get(item.id) || normalizeOuvrage(item));
  const customOnly = custom.filter((item) => !catalog.some((baseItem) => baseItem.id === item.id));
  return [...base, ...customOnly];
}
