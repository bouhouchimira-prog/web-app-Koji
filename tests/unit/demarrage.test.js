const assert = require("assert");
const {
  demarrageSteps,
  essentialsDone,
  masquerSiren,
  tauxMinimum,
  tauxParFamille,
  tauxParMetier
} = require("../../lib/demarrage");
const { ibanValide, formaterIban } = require("../../lib/iban");
const { appliquerTauxMetiers, codeFamille, indexFamilles } = require("../../lib/taux-metiers");

const FAMILLES = indexFamilles([
  { code: "ELEC", name: "Électricité, courant faible" },
  { code: "PLO", name: "Plomberie, sanitaire, ECS" },
  { code: "PLA", name: "Plâtrerie, cloisons, plafonds, enduits" },
  { code: "ISO", name: "Isolation" },
  { code: "DEM", name: "Démolition, dépose" }
]);

describe("démarrage guidé (PRO-01.1)", () => {
  it("calcule le taux minimum en 4 questions, arrondi à l'euro supérieur", () => {
    // exemple de la maquette : 18 000 + 36 000 sur 30 h × 44 semaines → 41 €
    assert.strictEqual(tauxMinimum({ charges: 18000, revenu: 36000, heuresParSemaine: 30, semaines: 44 }), 41);
    assert.strictEqual(tauxMinimum({ charges: "", revenu: 36000, heuresParSemaine: 30, semaines: 44 }), 28);
    assert.strictEqual(tauxMinimum({ charges: 18000, revenu: 36000, heuresParSemaine: 0, semaines: 44 }), null);
    assert.strictEqual(tauxMinimum({ charges: 0, revenu: 0, heuresParSemaine: 30, semaines: 44 }), null);
  });

  it("range les taux par métier dans les familles de la bibliothèque, et inversement", () => {
    const parFamille = tauxParFamille({ Electricien: "60", Plaquiste: 50, Peintre: "", "Tout corps d'etat": 45 });
    assert.deepStrictEqual(parFamille, { ELEC: 60, PLA: 50, ISO: 50 });
    assert.deepStrictEqual(tauxParMetier(parFamille), { Electricien: 60, Plaquiste: 50 });
  });

  it("applique le taux du métier aux ouvrages sans taux propre", () => {
    const liste = [
      { code: "ELEC-PRI-01", family: "Électricité, courant faible", billingMode: "time", hourlyRate: 0 },
      { code: "PLO-WC-02", family: "Autre", billingMode: "time", hourlyRate: 0 },
      { code: "PLA-CLO-01", familyCode: "PLA", billingMode: "time", hourlyRate: 72 },
      { code: "ELEC-FOR-01", family: "Électricité, courant faible", billingMode: "fixed", hourlyRate: 0 },
      { code: "DEM-CLO-01", family: "Démolition, dépose", billingMode: "time", hourlyRate: 0 }
    ];
    const sortie = appliquerTauxMetiers(liste, { ELEC: 60, PLO: 55, PLA: 50 }, FAMILLES);
    assert.strictEqual(sortie[0].hourlyRate, 60); // par le nom de famille
    assert.strictEqual(sortie[1].hourlyRate, 55); // par le préfixe du code
    assert.strictEqual(sortie[2].hourlyRate, 72); // taux propre gardé
    assert.strictEqual(sortie[3].hourlyRate, 0); // forfait inchangé
    assert.strictEqual(sortie[4].hourlyRate, 0); // pas de taux métier : taux de l'entreprise
    assert.strictEqual(appliquerTauxMetiers(liste, null, FAMILLES), liste);
    assert.strictEqual(codeFamille({ code: "XYZ-01", family: "Autre" }, FAMILLES), "");
  });

  it("masque le SIREN dans le rappel", () => {
    assert.strictEqual(masquerSiren("992651123"), "992 ••• 123");
    assert.strictEqual(masquerSiren("992 651 123"), "992 ••• 123");
    assert.strictEqual(masquerSiren("12"), "");
  });

  it("lit les six étapes dans le profil", () => {
    const vide = demarrageSteps({ business: {}, professions: [] });
    assert.deepStrictEqual(vide.map((s) => s.done), [false, false, false, false, false, false]);
    assert.strictEqual(essentialsDone(vide), false);
    const pret = demarrageSteps(
      {
        professions: ["Electricien", "Peintre"],
        business: {
          raisonSociale: "ABL Expert Renov", siren: "992651123", formeJuridique: "SAS", city: "Paris",
          zoneAddress: "12 Rue des Vinaigriers 75010 Paris", zoneRadiusKm: 8, dailyRate: 420, hoursPerDay: 7
        }
      },
      { taux: { Electricien: 60 } }
    );
    assert.strictEqual(essentialsDone(pret), true);
    assert.strictEqual(pret[0].resume, "SIREN 992 ••• 123 · ABL Expert Renov, SAS, Paris");
    assert.strictEqual(pret[1].resume, "2 métiers · 8 km autour de votre adresse");
    assert.strictEqual(pret[2].resume, "60 €/h électricité · 60 €/h autres postes");
  });

  it("vérifie la clé de l'IBAN", () => {
    assert.strictEqual(ibanValide("FR76 3000 6000 0112 3456 7890 189"), true);
    assert.strictEqual(ibanValide("FR76 3000 6000 0112 3456 7890 188"), false);
    assert.strictEqual(ibanValide("DE89 3704 0044 0532 0130 00"), true);
    assert.strictEqual(ibanValide("FR76 3000"), false);
    assert.strictEqual(formaterIban("fr7630006000011234567890189"), "FR76 3000 6000 0112 3456 7890 189");
  });
});
