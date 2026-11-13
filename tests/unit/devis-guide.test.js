const assert = require("assert");
const { questionsOuiNon, texteQuestions, texteReponses, toutesRepondues, koji, ecartTotal, premierMessage } = require("../../lib/devis-guide");

// Devis guidé (maquette PRO-03.1, 13 nov) : mêmes exemples que l'app
// (mobile/test/devis_guide_test.dart).
const lots = [
  { nom: "Dépose et préparation", code: "Lot 01", lignes: [{ id: "l1", designation: "Déposer la baignoire et la robinetterie existantes", quantite: 1, unite: "ens" }] },
  { nom: "Plomberie", code: "Lot 02", lignes: [{ id: "l2", designation: "Poser le receveur extra-plat 90 × 120, fourni", quantite: 1, unite: "u" }] },
  { nom: "Carrelage et faïence", code: "Lot 03", lignes: [] }
];

describe("devis guidé (PRO-03.1)", () => {
  it("nettoie les questions oui / non : point d'interrogation, doublons, trois au plus", () => {
    assert.deepStrictEqual(
      questionsOuiNon(["  Le sol est-il à ragréer après dépose ", "Faut-il une VMC ou une bouche d'extraction ?", "le sol est-il à ragréer après dépose ?", "", "Faut-il protéger les sols ?", "Faut-il évacuer les gravats ?"]),
      ["Le sol est-il à ragréer après dépose ?", "Faut-il une VMC ou une bouche d'extraction ?", "Faut-il protéger les sols ?"]
    );
    assert.deepStrictEqual(questionsOuiNon(null), []);
  });

  it("relit les questions et les réponses d'un clic comme du texte", () => {
    const qs = ["Le sol est-il à ragréer après dépose ?", "Faut-il une VMC ou une bouche d'extraction ?"];
    assert.strictEqual(texteQuestions(qs), "Questions posées (oui / non) :\n- Le sol est-il à ragréer après dépose ?\n- Faut-il une VMC ou une bouche d'extraction ?");
    assert.strictEqual(toutesRepondues(qs, [true]), false);
    assert.strictEqual(toutesRepondues(qs, [true, false]), true);
    assert.strictEqual(texteReponses(qs, [true, false]), "Le sol est-il à ragréer après dépose ? Oui\nFaut-il une VMC ou une bouche d'extraction ? Non");
  });

  it("dit ce que Koji est en train de faire", () => {
    const ajout = koji({ subAction: "addOuvrage", room: "Dépose et préparation", quantity: 5.8, ouvrage: { label: "Ragréer le sol", unit: "m²" } }, lots);
    assert.deepStrictEqual(ajout, { phrase: "Koji ajoute « Ragréer le sol » au lot 01…", lab: "Koji ajoute · lot 01", texte: "Ragréer le sol, 5,8 m²" });
    const nouveauLot = koji({ subAction: "addOuvrage", room: "Ventilation", quantity: 1, ouvrage: { label: "À chiffrer manuellement — Poser une bouche d'extraction", unit: "u" } }, lots);
    assert.strictEqual(nouveauLot.phrase, "Koji ajoute « Poser une bouche d'extraction » au lot « Ventilation »…");
    assert.strictEqual(koji({ subAction: "removeOuvrage", id: "l2" }, lots).phrase, "Koji retire « Poser le receveur extra-plat 90 × 120, fourni »…");
    assert.strictEqual(koji({ subAction: "addLot", lotName: "Ventilation" }, lots).phrase, "Koji crée le lot « Ventilation »…");
    assert.strictEqual(koji({ subAction: "askQuestions" }, lots), null);
  });

  it("montre l'écart de total du bandeau", () => {
    assert.strictEqual(ecartTotal(5068.4, 5271.4), "+ 203,00");
    assert.strictEqual(ecartTotal(5271.4, 5271.4), "");
    assert.strictEqual(ecartTotal(551, 500.5), "− 50,50");
  });

  it("écrit le premier message sans IA", () => {
    assert.strictEqual(premierMessage({ lots: [] }), "Bonjour, décris-moi le chantier en quelques mots. Je prépare le devis pendant que tu parles.");
    assert.strictEqual(
      premierMessage({ lots, client: { nom: "Mme Lefèvre" } }),
      "J'ai repris le devis de Mme Lefèvre : dépose et préparation et plomberie, 2 lignes. Dis-moi ce qui change, ajoute un ouvrage ou pose une question."
    );
  });
});
