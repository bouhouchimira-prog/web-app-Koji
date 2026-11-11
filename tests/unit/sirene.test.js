const assert = require("assert");
const { normaliserSiren, tvaDepuisSiren, ficheDepuisAnnuaire, chercherEntreprise } = require("../../lib/sirene");

// ABL Expert Renov : SIREN 992 204 651, TVA FR88 992204651 (mentions légales).
const ANNUAIRE_ABL = {
  siren: "992204651",
  nom_complet: "ABL EXPERT RENOV",
  nom_raison_sociale: "ABL EXPERT RENOV",
  nature_juridique: "5710",
  siege: {
    siret: "99220465100010",
    numero_voie: "60",
    type_voie: "RUE",
    libelle_voie: "DE L'AQUEDUC",
    complement_adresse: null,
    code_postal: "75010",
    libelle_commune: "PARIS"
  }
};

describe("lib/sirene", () => {
  it("normalise un SIREN, refuse une mauvaise clé, accepte un SIRET", () => {
    assert.strictEqual(normaliserSiren("992 204 651"), "992204651");
    assert.strictEqual(normaliserSiren("992.204.651"), "992204651");
    assert.strictEqual(normaliserSiren("992204652"), null);
    assert.strictEqual(normaliserSiren("12345"), null);
    assert.strictEqual(normaliserSiren("abc"), null);
    assert.strictEqual(normaliserSiren("99220465100010"), "992204651");
  });

  it("calcule le numéro de TVA intracommunautaire", () => {
    assert.strictEqual(tvaDepuisSiren("992204651"), "FR88992204651");
    assert.strictEqual(tvaDepuisSiren("pas un siren"), "");
  });

  it("remplit la fiche entreprise depuis l'annuaire", () => {
    assert.deepStrictEqual(ficheDepuisAnnuaire(ANNUAIRE_ABL, "992204651"), {
      raisonSociale: "ABL EXPERT RENOV",
      siren: "992204651",
      siret: "99220465100010",
      addressLine1: "60 Rue de l'Aqueduc",
      postalCode: "75010",
      city: "Paris",
      tva: "FR88992204651",
      formeJuridique: "SAS"
    });
    assert.strictEqual(ficheDepuisAnnuaire(ANNUAIRE_ABL, "123456782"), null);
    const saintDenis = { ...ANNUAIRE_ABL, siege: { ...ANNUAIRE_ABL.siege, type_voie: "AV", libelle_voie: "DU PRESIDENT WILSON", libelle_commune: "SAINT-DENIS" } };
    const fiche = ficheDepuisAnnuaire(saintDenis, "992204651");
    assert.strictEqual(fiche.addressLine1, "60 Av du President Wilson");
    assert.strictEqual(fiche.city, "Saint-Denis");
  });

  it("ne bloque jamais : annuaire en panne ou lent → null", async () => {
    const enPanne = async () => ({ ok: false });
    assert.strictEqual(await chercherEntreprise("992204651", { fetchImpl: enPanne }), null);
    const lent = (url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("abandon")));
    });
    assert.strictEqual(await chercherEntreprise("992204651", { fetchImpl: lent, timeoutMs: 20 }), null);
    const ok = async () => ({ ok: true, json: async () => ({ results: [ANNUAIRE_ABL] }) });
    assert.strictEqual((await chercherEntreprise("992 204 651", { fetchImpl: ok })).city, "Paris");
  });
});
