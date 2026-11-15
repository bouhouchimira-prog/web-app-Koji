const assert = require("assert");
const b = require("../../lib/bibliotheque-pro");

// Chiffres des maquettes PRO-08 à 08.3.
const car010 = { id: "car-010", code: "CAR-010", familyCode: "CAR", label: "Poser le carrelage au sol, collé, format ≤ 60 × 60", unit: "m²", normativeTime: 0.6, fixedTime: 1, sensitivities: { ACC: 0.3, EXI: 1, OCC: 0.3, SUP: 0.3, HSP: 0, STO: 0, HOR: 0 }, confidence: "A" };
const receveur = { code: "PLO-160", familyCode: "PLO", label: "Poser un receveur de douche extra-plat, raccordé à l'évacuation existante", unit: "u", normativeTime: 3.5, fixedTime: 0.5, coefficient: 1, discount: 0, confidence: "C" };

describe("bibliothèque : main-d'œuvre et situations (PRO-08, 08.1)", () => {
  it("MO par unité, temps fixe, aperçu d'une ligne", () => {
    assert.deepStrictEqual(b.moOuvrage(car010, 55), { parUnite: 33, fixe: 55, facteur: 1 });
    assert.strictEqual(b.moOuvrage({ ...car010, normativeTime: 0.85 }, 55).parUnite, 46.75);
    const mo = b.moOuvrage(receveur, 60);
    assert.strictEqual(mo.parUnite, 210);
    assert.strictEqual(mo.fixe, 30);
    const a = b.apercuLigne(receveur, { taux: 60, quantite: 1, fournitures: [{ conso: 1, vente: 238.5 }] });
    assert.deepStrictEqual(a, { mo: 240, fournitures: 238.5, total: 478.5, heures: 4 });
  });
  it("exemple en situation : facteurs sur le temps de base seulement", () => {
    const e = b.exempleSituation(receveur, 60, [{ multiplicateur: 1.1 }, { multiplicateur: 1.08 }]);
    assert.strictEqual(e.mo, 279.48);
    assert.strictEqual(b.multiplicateur(1.1, 0.3).toFixed(2), "1.03");
    assert.strictEqual(b.valeurExiguite(4.8), 1.1);
  });
  it("sensibilités et facteurs de la fiche", () => {
    assert.strictEqual(b.niveauSensibilite(0.5).label, "Moyenne");
    assert.strictEqual(b.niveauSensibilite(0.3).label, "Faible");
    assert.deepStrictEqual(b.facteursSensibles(car010).map((f) => f.nom), ["Accès", "Exiguïté", "Occupation", "Support"]);
  });
  it("code proposé, verbe d'action, contrôles", () => {
    assert.strictEqual(b.prochainCode("PLO", ["PLO-120", "PLO-150", "CAR-010"]), "PLO-160");
    assert.strictEqual(b.prochainCode("VMC", []), "VMC-010");
    assert.strictEqual(b.verbeAction("Poser un receveur"), true);
    assert.strictEqual(b.verbeAction("Receveur extra-plat"), false);
    const c = b.controlesOuvrage(receveur, [{ id: "x", code: "PLO-140", familyCode: "PLO", unit: "u", label: "Poser un receveur de douche standard" }]);
    assert.deepStrictEqual(c.map((x) => x.ok), [true, true, false, false]);
    assert.ok(c[3].texte.includes("PLO-140"));
  });
  it("recherche par synonyme et par code", () => {
    const l = [car010, { code: "VEN-010", label: "Poser une VMC simple flux", synonyms: ["ventilation"] }];
    assert.deepStrictEqual(b.rechercherOuvrages(l, "carreler").map((o) => o.code), ["CAR-010"]);
    assert.deepStrictEqual(b.rechercherOuvrages(l, "VMC").map((o) => o.code), ["VEN-010"]);
    assert.deepStrictEqual(b.rechercherOuvrages(l, "car-010").map((o) => o.code), ["CAR-010"]);
  });
});

describe("Mes prix et taux d'après factures (PRO-08.2, 08.3)", () => {
  it("calculateur de taux minimum", () => {
    assert.deepStrictEqual(b.tauxMinimumDetail({ charges: 18000, revenu: 36000, heuresParSemaine: 30, semaines: 44 }), { total: 54000, heures: 1320, taux: 41 });
    assert.strictEqual(b.etatTaux({ taux: 0, defaut: 55 }).texte, "Koji utilise 55 € en attendant");
  });
  it("taux implicite d'une ligne (exemple de la maquette)", () => {
    assert.deepStrictEqual(b.tauxLigne({ total: 1288, quantite: 14, fournituresParUnite: 34, temps: 1.02 }), { fournitures: 476, mo: 812, heures: 14.28, taux: 56.9 });
    assert.strictEqual(b.tauxLigne({ total: 100, quantite: 0, temps: 1 }), null);
  });
  it("médiane, écartées, fourchette, confiance, propositions", () => {
    const lignes = [54, 55, 56, 57, 58, 58, 58, 59, 60, 61, 62, 63, 57, 58, 59, 56, 60, 58, 57, 59, 150];
    const s = b.statsMetier(lignes);
    assert.strictEqual(s.taux, 58);
    assert.strictEqual(s.ecartees, 1);
    assert.strictEqual(s.confiance, "forte");
    assert.strictEqual(b.propositionMetier(s, 55).action, "appliquer");
    assert.strictEqual(b.propositionMetier(s, 60).action, "rien");
    assert.strictEqual(b.propositionMetier({ ...s, taux: 44 }, 50).action, "garder");
    assert.strictEqual(b.propositionMetier(s, 0).texte, "Aucun taux réglé : Koji propose 58 €.");
    assert.strictEqual(b.propositionMetier(b.statsMetier([45, 47, 50]), 0).action, "confirmer");
    assert.strictEqual(b.ecartPct(55, 66), 17);
  });
});

describe("taux d'après factures : rattachement et synthèse (PRO-08.3)", () => {
  const f = require("../../lib/bibliotheque-factures");
  const ouvrages = [
    { code: "CAR-020", familyCode: "CAR", label: "Poser la faïence murale, collée", unit: "m²", normativeTime: 1.02 },
    { code: "ELEC-010", familyCode: "ELEC", label: "Poser une prise", unit: "u", normativeTime: 0.5 },
    { code: "DIV-001", familyCode: "DIV", label: "Sans temps", unit: "u", normativeTime: 0 }
  ];
  const articles = [{ name: "Faïence 30 × 60", prixPublic: 30, perte: 0, ouvrages: [{ code: "CAR-020", conso: 1 }] }, { name: "Colle", prixPublic: 4, perte: 0, ouvrages: [{ code: "CAR-020", conso: 1 }] }];
  it("ligne de la maquette : 1 288 € − 476 € = 812 € ÷ 14,28 h = 56,9 €/h", () => {
    const [l] = f.calculerLignes([{ designation: "Pose de faïence murale fournie", code: "CAR-020", quantite: 14, total: 1288, fourni: true }], ouvrages, articles);
    assert.strictEqual(l.statut, "ok");
    assert.strictEqual(l.fournitures, 476);
    assert.strictEqual(l.mo, 812);
    assert.strictEqual(l.taux, 56.9);
    assert.strictEqual(l.metier, "Carreleur");
    assert.deepStrictEqual(l.fournituresNoms, ["Faïence 30 × 60", "Colle"]);
  });
  it("3 questions au plus, le reste écarté", () => {
    const lignes = f.calculerLignes([
      { designation: "Divers", quantite: 1, total: 100 },
      { designation: "Forfait salle de bain", code: "CAR-020", quantite: 0, total: 900 },
      { designation: "Truc", code: "DIV-001", quantite: 2, total: 50 },
      { designation: "Autre divers", quantite: 1, total: 80 }
    ], ouvrages, articles);
    assert.deepStrictEqual(lignes.map((l) => l.statut), ["a_verifier", "a_verifier", "a_verifier", "ecartee"]);
    assert.ok(lignes[1].question.includes("quelle quantité"));
  });
  it("synthèse par métier avec proposition", () => {
    const lignes = Array.from({ length: 12 }, (_, i) => ({ statut: "ok", metier: "Electricien", taux: 58 + (i % 5) }));
    const [s] = f.syntheseMetiers(lignes, { tauxParMetier: { Electricien: 60 } });
    assert.strictEqual(s.activite, "Électricité");
    assert.strictEqual(s.taux, 60);
    assert.strictEqual(s.proposition.action, "rien");
  });
});

describe("Mes prix : règle des fournitures et majorations fixes (PRO-08.2)", () => {
  const pro = require("../../lib/fournitures-pro");
  const qc = require("../../lib/quote-calculations");
  const gres = { modePrix: "public", prixPublic: 64.9, fournisseurs: [{ achat: 48, prefere: true }] };
  it("prix public par défaut, achat + %, achat", () => {
    assert.strictEqual(pro.prixVente(gres), 64.9);
    assert.strictEqual(pro.prixVente(gres, { modeDefaut: "coefficient", coefCompte: 1.15 }), 55.2);
    assert.strictEqual(pro.prixVente(gres, { modeDefaut: "achat" }), 48);
    assert.strictEqual(pro.libelleMode(gres, { modeDefaut: "achat" }), "Achat");
    assert.strictEqual(pro.prixVente({ ...gres, modePrix: "manuel", prixManuel: 60 }, { modeDefaut: "achat" }), 60);
  });
  it("intervention minimum et déplacement forfaitaire", () => {
    const s = [{ id: "a", label: "Aléas", percent: 5, mode: "client" }, { id: "d", label: "Déplacement", kind: "fixe", montant: 40, mode: "client" }, { id: "m", label: "Intervention minimum", kind: "minimum", montant: 150, mode: "client" }];
    const r = qc.computeSurchargeBreakdown(100, s);
    assert.deepStrictEqual(r.lines.map((l) => l.amount), [5, 40, 50]);
    assert.strictEqual(r.totalHt, 195);
    assert.strictEqual(qc.computeSurchargeBreakdown(400, s).lines[2].amount, 0);
    assert.strictEqual(qc.libelleMajoration(s[1]), "Déplacement");
    assert.strictEqual(qc.libelleMajoration(s[0]), "Aléas 5%");
  });
});
