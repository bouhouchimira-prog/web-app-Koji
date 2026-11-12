const assert = require("assert");
const { conseilsEntretien, photosChoisies, elementsDossier, resumeDossier, decennaleAJour } = require("../../lib/dossier-fin");

// Dossier de fin de chantier de la maquette PRO-02.5.
const PHOTOS = [
  { lot: "Dépose", phase: "avant", takenAt: "2026-11-14T08:00:00Z" },
  { lot: "Dépose", phase: "apres", takenAt: "2026-11-14T16:00:00Z" },
  { lot: "Plomberie", phase: "avant", takenAt: "2026-11-17T08:00:00Z" },
  { lot: "Plomberie", phase: "pendant", takenAt: "2026-11-18T08:00:00Z" },
  { lot: "Plomberie", phase: "apres", takenAt: "2026-11-19T16:00:00Z" },
  { lot: "Carrelage", phase: "avant", takenAt: "2026-11-20T08:00:00Z" },
  { lot: "Carrelage", phase: "apres", takenAt: "2026-11-26T16:00:00Z" },
  { lot: "Carrelage", phase: "apres", takenAt: "2026-11-27T15:05:00Z", id: "couv" },
  { lot: "", phase: "pendant", takenAt: "2026-11-21T10:00:00Z" },
  { phase: "reserve", takenAt: "2026-12-01T10:00:00Z" }
];
const ITEMS = [
  { label: "Poser le mitigeur thermostatique" },
  { label: "Poser le WC suspendu sur bâti-support" },
  { label: "Poser la faïence murale" },
  { label: "Joint silicone périphérique" },
  { label: "Évacuer les gravats" }
];

describe("lib/dossier-fin (PRO-02.5)", () => {
  it("choisit les photos avant / après par lot", () => {
    const c = photosChoisies(PHOTOS);
    assert.deepStrictEqual(c.paires.map((p) => p.lot), ["Dépose", "Plomberie", "Carrelage"]);
    assert.strictEqual(c.nombre, 6);
    assert.strictEqual(c.couverture.id, "couv");
    assert.strictEqual(c.paires[2].apres.id, "couv");
  });

  it("tire les conseils d'entretien des lignes du devis", () => {
    const c = conseilsEntretien(ITEMS);
    assert.deepStrictEqual(c.map((x) => x.id), ["robinetterie", "joints", "carrelage", "wc"]);
    assert.deepStrictEqual(c[1].lignes, ["Joint silicone périphérique"]);
    assert.deepStrictEqual(conseilsEntretien([{ label: "Évacuer les gravats" }]), []);
  });

  it("liste les huit éléments et ce qui manque", () => {
    const e = elementsDossier({
      pv: { numero: "PV-2026-007", signeLe: "2026-12-04T16:20:00Z" },
      photos: PHOTOS,
      factures: [{ type: "Acompte initial", amountTtc: 1739.56 }, { type: "Facture intermédiaire", amountTtc: 2515 }, { type: "Facture finale", amountTtc: 1580.09 }],
      factureSolde: { invoiceNumber: "KJ-2026-134" },
      decennale: { insurer: "MAAF Pro", until: "2027-03-31" },
      pieces: [{ kind: "notice", titre: "Mitigeur" }, { kind: "notice", titre: "WC suspendu" }],
      conseils: conseilsEntretien(ITEMS),
      aujourdhui: "2026-12-08"
    });
    assert.deepStrictEqual(e.map((x) => `${x.id}:${x.ok}`), ["pv:true", "photos:true", "factures:true", "decennale:true", "notices:true", "conseils:true", "plan:false", "garanties:true"]);
    assert.strictEqual(e[0].detail, "PV-2026-007 · signé le 4 déc.");
    assert.strictEqual(e[1].detail, "6 photos choisies sur 10 · horodatées");
    assert.strictEqual(e[2].detail, "acompte, situation, solde KJ-2026-134");
    assert.strictEqual(e[3].detail, "MAAF Pro · jusqu'au 31 mars 2027 · reprise du profil");
    assert.strictEqual(e[4].detail, "Mitigeur, WC suspendu · 2 fichiers");
    assert.strictEqual(e[6].detail, "arrivées, évacuations, circuit · à ajouter");
    assert.strictEqual(resumeDossier(e), "préparé par Koji · 7 sur 8 prêts");

    const vide = elementsDossier({ aujourdhui: "2026-12-08" });
    assert.deepStrictEqual(vide.filter((x) => !x.ok).map((x) => x.id), ["pv", "photos", "factures", "decennale", "notices", "plan", "garanties"]);
    assert.strictEqual(decennaleAJour({ insurer: "MAAF", until: "2026-12-01" }, "2026-12-08"), false);
  });
});
