const assert = require("assert");
const { phaseDeLegende, horodatage, photosDuLot } = require("../../lib/photos-chantier");

describe("lib/photos-chantier (PRO-02.2)", () => {
  it("lit la phase dans la légende d'une photo de compagnon", () => {
    assert.strictEqual(phaseDeLegende("Avant pose"), "avant");
    assert.strictEqual(phaseDeLegende("après"), "apres");
    assert.strictEqual(phaseDeLegende("Apres nettoyage"), "apres");
    assert.strictEqual(phaseDeLegende("carrelage posé"), "pendant");
    assert.strictEqual(phaseDeLegende(""), "pendant");
  });

  it("horodate en heure de Paris", () => {
    assert.strictEqual(horodatage("2026-11-14T07:02:00Z"), "14/11 08:02"); // hiver : UTC+1
    assert.strictEqual(horodatage("2026-07-14T06:02:00Z"), "14/07 08:02"); // été : UTC+2
  });

  it("dit ce qui manque à chaque lot", () => {
    const photos = [
      { lot: "Plomberie", phase: "avant", takenAt: "2026-11-17T07:10:00Z" },
      { lot: "Plomberie", phase: "apres", takenAt: "2026-11-19T14:22:00Z" },
      { lot: "Électricité", phase: "avant", takenAt: "2026-11-28T07:30:00Z" }
    ];
    const plomberie = photosDuLot(photos, "Plomberie", { faites: 3, total: 3 });
    assert.strictEqual(plomberie.etat, "termine");
    assert.strictEqual(plomberie.apres.takenAt, "2026-11-19T14:22:00Z");
    assert.strictEqual(photosDuLot(photos, "Électricité", { faites: 1, total: 1 }).etat, "apres_manquante");
    assert.strictEqual(photosDuLot(photos, "Électricité", { faites: 0, total: 1 }).etat, "en_cours");
    assert.strictEqual(photosDuLot(photos, "Dépose", { faites: 0, total: 2 }).etat, "a_faire");
  });
});
