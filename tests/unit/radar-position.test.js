const assert = require("assert");
const { positionApprochee, villeDeZone, zoneDeTravail } = require("../../lib/radar-position");

describe("lib/radar-position", () => {
  it("ramène l'adresse au centre de sa maille de 0,02°", () => {
    // 12 rue Caulaincourt (Paris 18e)
    assert.deepStrictEqual(positionApprochee(48.88731, 2.33042), { lat: 48.89, lon: 2.33 });
    assert.deepStrictEqual(positionApprochee(48.8701, 2.3599), { lat: 48.87, lon: 2.35 });
    // deux adresses de la même maille tombent au même point
    assert.deepStrictEqual(positionApprochee(48.8802, 2.3401), positionApprochee(48.8998, 2.3599));
    // hémisphère sud et ouest : toujours le centre de la maille
    assert.deepStrictEqual(positionApprochee(-21.1151, 55.5364), { lat: -21.11, lon: 55.53 });
    assert.deepStrictEqual(positionApprochee(47.2184, -1.5536), { lat: 47.21, lon: -1.55 });
  });

  it("ne place rien sans coordonnées valides", () => {
    assert.strictEqual(positionApprochee(null, 2.3), null);
    assert.strictEqual(positionApprochee("", ""), null);
    assert.strictEqual(positionApprochee("abc", 2.3), null);
    assert.strictEqual(positionApprochee(120, 2.3), null);
  });

  it("légende la zone de travail avec la ville", () => {
    assert.strictEqual(villeDeZone("12 rue Caulaincourt, 75018 Paris"), "Paris");
    assert.strictEqual(villeDeZone("93400 Saint-Ouen-sur-Seine, France"), "Saint-Ouen-sur-Seine");
    assert.strictEqual(villeDeZone("Lyon"), "Lyon");
    assert.deepStrictEqual(
      zoneDeTravail({ zoneLat: 48.88, zoneLon: 2.33, zoneRadiusKm: 15, zoneAddress: "75018 Paris" }),
      { lat: 48.88, lon: 2.33, radiusKm: 15, ville: "Paris" }
    );
    assert.strictEqual(zoneDeTravail({}), null);
    assert.strictEqual(zoneDeTravail({ zoneLat: 48.88, zoneLon: 2.33 }).radiusKm, 20);
  });
});
