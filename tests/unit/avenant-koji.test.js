const assert = require("assert");
const { numeroCourt, construireLignes, totalLigne, detailLigne, signeMontant, recapAvenant, finDecalee, messageAvenant } = require("../../lib/avenant-koji");

// Avenant préparé par Koji (maquette PRO-05) : prix du devis ou de la
// bibliothèque, jamais de l'IA.
const LOTS = ["Dépose et préparation", "Plomberie", "Carrelage et faïence", "Électricité"];
const DEVIS = [
  { ref: "C2", label: "Poser la faïence murale toute hauteur", lot: "Carrelage et faïence", quantity: 19.4, unit: "m²", unitPriceHt: 88 },
  { ref: "E2", label: "Créer 1 prise supplémentaire", lot: "Électricité", quantity: 1, unit: "u", unitPriceHt: 65 }
];
const BIBLIO = { RAG: { label: "Ragréer le sol avant carrelage", unit: "m²", prixHt: 13.75 }, VAN: { label: "Remplacer la vanne d'arrêt encastrée", unit: "u", prixHt: 145 } };

describe("avenant préparé par Koji (PRO-05)", () => {
  const lignes = construireLignes([
    { type: "ajout", code: "RAG", lot: "Dépose et préparation", quantite: 5.8, justification: "Sol irrégulier constaté à la dépose" },
    { type: "ajout", code: "VAN", lot: "Plomberie", quantite: 1, justification: "Vanne grippée, découverte à la dépose" },
    { type: "modification", ref: "C2", quantite: 21.2, justification: "Retour de mur ajouté à la demande du client" },
    { type: "suppression", ref: "E2", justification: "Retirée à la demande du client" },
    { type: "ajout", libelle: "Déplacer le radiateur", lot: "Plomberie", quantite: 1, unite: "u" },
    { type: "modification", ref: "INCONNUE", quantite: 3 }
  ], DEVIS, (code) => BIBLIO[code] || null);

  it("chiffre avec le devis et la bibliothèque, jamais l'IA", () => {
    assert.strictEqual(lignes.length, 5);
    assert.deepStrictEqual(lignes.map(totalLigne), [79.75, 145, 158.4, -65, 0]);
    assert.strictEqual(lignes[4].aChiffrer, true);
    assert.strictEqual(detailLigne(lignes[0], LOTS), "Lot 01 · 5,8 m² × 13,75 € · Sol irrégulier constaté à la dépose");
    assert.strictEqual(detailLigne(lignes[2], LOTS), "Lot 03 · 19,4 → 21,2 m² × 88,00 € · Retour de mur ajouté à la demande du client");
    assert.strictEqual(detailLigne(lignes[4], LOTS), "Lot 02 · 1 u · à chiffrer");
    assert.strictEqual(signeMontant(-65), "− 65,00 €");
  });

  it("récapitule le marché et l'impact planning", () => {
    const r = recapAvenant({ devisHt: 5271.4, lignes: lignes.slice(0, 4), tauxTva: 10 });
    assert.deepStrictEqual(r, { devisHt: 5271.4, avenantHt: 318.15, totalHt: 5589.55, totalTtc: 6148.51 });
    assert.strictEqual(finDecalee("2026-11-27", 1), "2026-11-30");
    assert.strictEqual(numeroCourt("AV-2"), "A2");
    assert.strictEqual(messageAvenant({ client: "Mme Lefèvre", lignes: lignes.slice(3, 4), impactJours: 1 }),
      "Bonjour Mme Lefèvre, voici l'avenant au devis : retrait de « créer 1 prise supplémentaire ». 1 jour de plus sur le planning.");
  });
});
