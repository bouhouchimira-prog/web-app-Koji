const assert = require("assert");
const { decisionTva, clientTva, tauxProposeLigne, questionTva, confirmationTva, ventilerTva, estTauxReduit } = require("../../lib/tva");

// TVA automatique (maquette PRO-03.5) : mêmes exemples que l'app
// (mobile/test/tva_test.dart).
describe("TVA automatique (PRO-03.5)", () => {
  it("choisit le taux sur les trois questions", () => {
    assert.strictEqual(decisionTva({ client: "particulier", local: "logement-ancien" }).taux, 10);
    assert.strictEqual(decisionTva({ client: "particulier", local: "logement-ancien", travaux: "energetique" }).taux, 5.5);
    assert.strictEqual(decisionTva({ client: "particulier", local: "logement-ancien", travaux: "construction" }).taux, 20);
    assert.strictEqual(decisionTva({ client: "particulier", local: "logement-neuf" }).taux, 20);
    assert.strictEqual(decisionTva({ client: "entreprise", local: "professionnel" }).taux, 20);
    // Une SCI ou un syndic pour un logement de plus de 2 ans : 10 %.
    assert.strictEqual(decisionTva({ client: "entreprise", local: "logement-ancien" }).taux, 10);
    const st = decisionTva({ client: "sous-traitance" });
    assert.deepStrictEqual([st.taux, st.autoliquidation, st.titre], [0, true, "Autoliquidation"]);
    assert.ok(st.mention.includes("art. 283, 2 nonies"));
    const inconnu = decisionTva({ client: "particulier" });
    assert.deepStrictEqual([inconnu.taux, inconnu.question], [null, "local"]);
  });

  it("explique ce que Koji a vérifié et la mention", () => {
    const d = decisionTva({ client: "particulier", local: "logement-ancien" });
    assert.deepStrictEqual(d.verifications, ["Client particulier", "Logement achevé depuis plus de 2 ans", "Pas d'agrandissement de plus de 10 %", "Pas de reconstruction à neuf"]);
    assert.ok(d.mention.startsWith("Je soussigné(e)"));
    assert.strictEqual(decisionTva({ client: "entreprise", local: "professionnel" }).mention, "");
    assert.strictEqual(estTauxReduit(5.5), true);
    assert.strictEqual(estTauxReduit(20), false);
  });

  it("déduit le client et pose la bonne question", () => {
    assert.strictEqual(clientTva({ clientType: "societe" }), "entreprise");
    assert.strictEqual(clientTva({ clientType: "particulier" }), "particulier");
    assert.strictEqual(clientTva({ clientType: "societe", tva: { client: "sous-traitance" } }), "sous-traitance");
    assert.deepStrictEqual(questionTva("local", "particulier"), {
      texte: "Le logement a-t-il plus de 2 ans ?",
      reponses: [{ label: "Oui", valeur: "logement-ancien" }, { label: "Non, il est neuf", valeur: "logement-neuf" }]
    });
    assert.strictEqual(questionTva("local", "entreprise").reponses[0].valeur, "professionnel");
    assert.strictEqual(questionTva("", "particulier"), null);
    assert.strictEqual(confirmationTva(decisionTva({ client: "particulier", local: "logement-ancien" }), { nom: "Claire" }), "TVA à 10 % appliquée. Claire signera la mention en acceptant le devis.");
    assert.strictEqual(confirmationTva(decisionTva({ client: "entreprise", local: "professionnel" }), { client: "entreprise" }), "C'est un local professionnel ou neuf : TVA à 20 %.");
  });

  it("propose 5,5 % sur une ligne de rénovation énergétique", () => {
    const d10 = decisionTva({ client: "particulier", local: "logement-ancien" });
    assert.strictEqual(tauxProposeLigne("Isoler les combles perdus, laine soufflée", d10), 5.5);
    assert.strictEqual(tauxProposeLigne("Poser une pompe à chaleur air-eau", d10), 5.5);
    assert.strictEqual(tauxProposeLigne("Poser le carrelage au sol", d10), null);
    assert.strictEqual(tauxProposeLigne("Isoler les combles", decisionTva({ client: "entreprise", local: "professionnel" })), null);
  });

  it("ventile la TVA par taux, sans changer un devis à un seul taux", () => {
    assert.deepStrictEqual(ventilerTva([{ ht: 2902.5 }], 0, 10), { parTaux: [{ taux: 10, base: 2902.5, tva: 290.25 }], tva: 290.25 });
    assert.deepStrictEqual(ventilerTva([{ ht: 1000 }, { ht: 500, taux: 5.5 }], 100, 10), {
      parTaux: [{ taux: 10, base: 1100, tva: 110 }, { taux: 5.5, base: 500, tva: 27.5 }],
      tva: 137.5
    });
    assert.deepStrictEqual(ventilerTva([{ ht: 9800 }], 0, 0), { parTaux: [{ taux: 0, base: 9800, tva: 0 }], tva: 0 });
  });
});
