import assert from "node:assert/strict";
import { dateCourte, periode, etatContrat, relanceClient, lignesContrat, manquesContrat, messageClient } from "../../lib/sous-traitance.js";

// Maquette PRO-14.1 : Rénov Horizon Carrelage, lot carrelage, Caulaincourt.
const c = { entreprise: "ABL Expert Renov", sousTraitant: "Rénov Horizon Carrelage", documentsAJour: true, lot: "lot carrelage", chantier: "Appartement Caulaincourt, Paris", prixHt: 9800, debut: "2026-11-16", fin: "2026-11-27" };

describe("Sous-traitance (PRO-14.1)", () => {
  it("dates et période", () => {
    assert.equal(dateCourte("2026-11-16"), "16 nov.");
    assert.equal(periode("2026-11-16", "2026-11-27"), "du 16 au 27 nov.");
    assert.equal(periode("2026-11-28", "2026-12-03"), "du 28 nov. au 3 déc.");
    assert.equal(periode("2026-11-12", "2026-11-12"), "le 12 nov.");
    assert.equal(periode("", ""), "dates à convenir");
  });

  it("lignes du contrat comme la maquette", () => {
    const l = Object.fromEntries(lignesContrat(c));
    assert.equal(l["Prix"], "9 800,00 € HT · autoliquidation de la TVA");
    assert.equal(l["Délais"], "du 16 au 27 nov.");
    assert.equal(l["Sous-traitant"], "Rénov Horizon Carrelage · documents de vigilance à jour");
    assert.equal(l["Paiement"], "30 jours, après situation acceptée");
    assert.deepEqual(manquesContrat({ lot: "x" }), ["le prix", "les dates"]);
  });

  it("étapes et relance du client", () => {
    assert.equal(etatContrat({}).cle, "prepare");
    assert.equal(etatContrat({ envoyeLe: "x" }).cle, "envoye");
    assert.equal(etatContrat({ presenteLe: "2026-11-12" }).cle, "presente");
    assert.equal(relanceClient({ presenteLe: "2026-11-12T10:00:00Z" }), "2026-11-14");
    assert.equal(relanceClient({ presenteLe: "2026-11-12", accepteLe: "2026-11-13" }), "");
  });

  it("message au client", () => {
    assert.equal(messageClient(c), "ABL Expert Renov vous présente Rénov Horizon Carrelage pour le lot carrelage (9 800 € HT), du 16 au 27 nov.");
  });
});
