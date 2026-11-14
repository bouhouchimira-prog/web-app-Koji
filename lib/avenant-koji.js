// Avenant préparé par Koji (maquette PRO-05) : depuis les notes de chantier
// (dictée), Koji propose des lignes — ajout (+), modification de quantité
// (~), suppression (−) — chacune avec sa justification visible par le
// client. Les prix ne viennent jamais de l'IA : ceux du devis signé pour
// une ligne modifiée ou retirée, ceux de la bibliothèque de l'entreprise
// pour un ajout ; sinon la ligne reste « à chiffrer ». Mêmes règles dans
// l'app Koji Pro (lignes affichées par le site).
import { estOuvre } from "./planning-chantier.js";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
const nombre = (n, max = 2) => (Number(n) || 0).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: max }).replace(/ | /g, " ");
const montant = (n) => `${(Math.round(Math.abs(Number(n) || 0) * 100) / 100).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, " ")} €`;

// « AV-1 » → « A1 » (numérotation de la maquette, rattachée au devis).
export function numeroCourt(numero) {
  const m = String(numero || "").match(/(\d+)\s*$/);
  return m ? `A${m[1]}` : String(numero || "");
}

// « Lot 03 » d'après l'ordre des lots du devis.
export function codeLot(lot, lots = []) {
  const i = lots.indexOf(lot);
  return i >= 0 ? `Lot ${String(i + 1).padStart(2, "0")}` : lot || "Travaux";
}

// Lignes proposées par Koji → lignes d'avenant chiffrées.
// propositions : [{ type, ref, libelle, lot, quantite, unite, code, justification }]
//   - modification : `quantite` = nouvelle quantité totale de la ligne `ref` ;
//   - suppression : `quantite` = quantité retirée (toute la ligne par défaut) ;
//   - ajout : `code` = ouvrage de la bibliothèque (facultatif).
// lignesDevis : [{ ref, label, lot, quantity, unit, unitPriceHt }]
// prixBibliotheque(code) → { label, unit, prixHt } | null
export function construireLignes(propositions = [], lignesDevis = [], prixBibliotheque = () => null) {
  const parRef = new Map(lignesDevis.map((l) => [String(l.ref), l]));
  const out = [];
  for (const [i, p] of (Array.isArray(propositions) ? propositions : []).entries()) {
    const type = ["ajout", "modification", "suppression"].includes(p?.type) ? p.type : "ajout";
    const justification = String(p?.justification || "").trim().slice(0, 240);
    const base = parRef.get(String(p?.ref || ""));
    if ((type === "modification" || type === "suppression") && !base) continue;
    if (type === "modification") {
      const apres = r3(p.quantite);
      const delta = r3(apres - base.quantity);
      if (!(apres > 0) || !delta) continue;
      out.push({ id: `kj-${i}`, type, room: base.lot, label: base.label, quantity: delta, unit: base.unit, unitPriceHt: r2(base.unitPriceHt), ligneDevisRef: base.ref, quantiteAvant: base.quantity, quantiteApres: apres, note: justification });
    } else if (type === "suppression") {
      const q = r3(p.quantite > 0 && p.quantite < base.quantity ? p.quantite : base.quantity);
      out.push({ id: `kj-${i}`, type, room: base.lot, label: base.label, quantity: q, unit: base.unit, unitPriceHt: r2(base.unitPriceHt), ligneDevisRef: base.ref, note: justification });
    } else {
      const biblio = p?.code ? prixBibliotheque(String(p.code)) : null;
      const quantity = r3(p?.quantite) > 0 ? r3(p.quantite) : 1;
      out.push({
        id: `kj-${i}`, type, room: String(p?.lot || "").trim() || "Travaux",
        label: String(p?.libelle || biblio?.label || "").trim().slice(0, 200),
        quantity, unit: String(p?.unite || biblio?.unit || "u").slice(0, 12),
        unitPriceHt: r2(biblio?.prixHt || 0), aChiffrer: !(biblio?.prixHt > 0), note: justification
      });
    }
  }
  return out.filter((l) => l.label);
}

// Total d'une ligne, signé : suppression toujours négative.
export function totalLigne(l) {
  const t = r2((Number(l.quantity) || 0) * (Number(l.unitPriceHt) || 0));
  return l.type === "suppression" ? -Math.abs(t) : t;
}

// « Lot 03 · 19,4 → 21,2 m² × 88,00 € · Retour de mur ajouté… »
export function detailLigne(l, lots = []) {
  const qte = l.type === "modification" && l.quantiteAvant != null
    ? `${nombre(l.quantiteAvant, 3)} → ${nombre(l.quantiteApres, 3)} ${l.unit}`
    : `${nombre(l.quantity, 3)} ${l.unit}`;
  const prix = l.aChiffrer && !(l.unitPriceHt > 0) ? "à chiffrer" : `${qte} × ${montant(l.unitPriceHt)}`;
  return [codeLot(l.room, lots), l.aChiffrer && !(l.unitPriceHt > 0) ? `${qte} · à chiffrer` : prix, l.note].filter(Boolean).join(" · ");
}

export function signeMontant(n) {
  const v = r2(n);
  return `${v < 0 ? "−" : "+"} ${montant(v)}`;
}

// Récapitulatif : devis initial, avenant, nouveau total du marché.
export function recapAvenant({ devisHt = 0, lignes = [], tauxTva = 20, avenantsSignesHt = 0 } = {}) {
  const avenantHt = r2(lignes.reduce((s, l) => s + totalLigne(l), 0));
  const totalHt = r2(devisHt + avenantsSignesHt + avenantHt);
  return { devisHt: r2(devisHt), avenantHt, totalHt, totalTtc: r2(totalHt * (1 + (Number(tauxTva) || 0) / 100)) };
}

// Fin prévue décalée de n jours ouvrés (impact planning).
export function finDecalee(fin, jours) {
  if (!fin || !jours) return fin || "";
  let d = new Date(`${String(fin).slice(0, 10)}T12:00:00Z`).getTime();
  let n = Math.abs(Math.round(jours));
  const pas = jours > 0 ? 86400000 : -86400000;
  while (n > 0) {
    d += pas;
    if (estOuvre(new Date(d).toISOString().slice(0, 10))) n -= 1;
  }
  return new Date(d).toISOString().slice(0, 10);
}

// Message au client proposé si Koji n'en a pas écrit.
export function messageAvenant({ client = "", lignes = [], impactJours = 0 } = {}) {
  const quoi = lignes.map((l) => `${l.type === "suppression" ? "retrait de" : l.type === "modification" ? "modification de" : "ajout de"} « ${l.label.charAt(0).toLowerCase()}${l.label.slice(1)} »`);
  return [
    `Bonjour${client ? ` ${client}` : ""}, voici l'avenant au devis${quoi.length ? ` : ${quoi.join(", ")}` : ""}.`,
    impactJours ? `${impactJours > 0 ? `${impactJours} jour${impactJours > 1 ? "s" : ""} de plus` : `${-impactJours} jour${impactJours < -1 ? "s" : ""} de moins`} sur le planning.` : ""
  ].filter(Boolean).join(" ");
}
