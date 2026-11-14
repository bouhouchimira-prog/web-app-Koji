const assert = require("assert");
const { ecartsVersions, resumeEcarts, signe, messageVersion, noteMiseAJour, historiqueDevis } = require("../../lib/devis-versions");

// Versions du devis (maquette PRO-03.6) : mêmes exemples que l'app
// (mobile/test/devis_versions_test.dart).
const L = (id, label, room, quantity, totalHt) => ({ id, label, room, quantity, unit: "u", totalHt });
const communes = [
  L("01-1", "Déposer la baignoire", "Dépose et préparation", 1, 180), L("01-2", "Déposer le carrelage", "Dépose et préparation", 19.4, 543.2),
  L("01-3", "Évacuer les gravats", "Dépose et préparation", 1, 260), L("02-1", "Créer l'alimentation", "Plomberie", 1, 420),
  L("02-3", "Poser la colonne de douche", "Plomberie", 1, 540), L("03-1", "Poser le carrelage au sol", "Carrelage et faïence", 5.8, 551),
  L("03-2", "Poser la faïence", "Carrelage et faïence", 19.4, 1707.2), L("04-1", "Créer le circuit salle d'eau", "Électricité", 1, 380),
  L("04-0", "Poser une prise", "Électricité", 1, 0)
];
const v1 = { number: "001", sentAt: "2026-10-26T17:10:00Z", totalHt: 5486.2, totalTtc: 6034.82, lines: [...communes, L("02-2", "Receveur extra-plat 80 × 120", "Plomberie", 1, 508.8), L("04-2", "Poser un sèche-serviettes électrique 500 W, fourni", "Électricité", 1, 396)] };
const v2 = { number: "002", sentAt: "2026-10-28T18:50:00Z", totalHt: 5271.4, totalTtc: 5798.54, lines: [...communes, L("02-2", "Receveur extra-plat 90 × 120", "Plomberie", 1, 690)] };

describe("versions du devis (PRO-03.6)", () => {
  it("montre seulement les lignes concernées et les totaux avant / après", () => {
    const e = ecartsVersions(v1, v2, { tauxTva: 10 });
    assert.deepStrictEqual(e.lignes.map((l) => [l.kind, l.label, l.avant, l.apres, l.ecart, l.ecartTtc]), [
      ["del", "Poser un sèche-serviettes électrique 500 W, fourni", 396, null, -396, -435.6],
      ["mod", "Receveur extra-plat 90 × 120", 508.8, 690, 181.2, 199.32]
    ]);
    assert.strictEqual(e.lignes[1].labelAvant, "Receveur extra-plat 80 × 120");
    assert.strictEqual(e.identiques, 9);
    assert.deepStrictEqual(e.totalHt, { avant: 5486.2, apres: 5271.4, ecart: -214.8 });
    assert.deepStrictEqual(e.totalTtc, { avant: 6034.82, apres: 5798.54, ecart: -236.28 });
    assert.strictEqual(resumeEcarts(e), "2 lignes concernées · les 9 autres sont identiques");
    assert.strictEqual(resumeEcarts(ecartsVersions(v2, v2)), "Aucune ligne modifiée · les 10 lignes sont identiques");
    assert.strictEqual(signe(-396), "− 396,00");
    assert.strictEqual(signe(181.2), "+ 181,20");
    assert.strictEqual(signe(null), "—");
  });

  it("propose le message et la note de mise à jour", () => {
    const e = ecartsVersions(v1, v2, { tauxTva: 10 });
    assert.strictEqual(
      messageVersion({ client: "Mme Lefèvre", numero: 2, ecarts: e, totalTtc: 5798.54 }),
      "Bonjour Mme Lefèvre, voici la version 2 du devis : « Poser un sèche-serviettes électrique 500 W, fourni » retiré et « Receveur extra-plat 90 × 120 » modifié. Le total passe à 5 798,54 € TTC. La version 1 reste consultable mais ne peut plus être signée."
    );
    assert.strictEqual(
      noteMiseAJour({ numero: 2, numeroDevis: "2026-041", acompteTtc: 1739.56, finValidite: "2026-11-27" }),
      "Mis à jour avec la version 2 : acompte prévu (1 739,56 € TTC), liste des fournitures, validité (27 nov.). Numéro 2026-041 conservé."
    );
  });

  it("raconte l'historique dans l'ordre", () => {
    const q = { client: "Mme Lefèvre", versions: [v1, v2], viewedAt: "2026-10-26T19:02:00Z" };
    const messages = [{ entreprise: false, auteur: "Mme Lefèvre", le: "2026-10-27T08:15:00Z" }, { entreprise: true, le: "2026-10-27T09:00:00Z" }];
    assert.deepStrictEqual(historiqueDevis(q, { messages }).map((e) => `${e.label} · ${e.quand}`), [
      "Version 1 envoyée · 26 oct., 18 h 10",
      "Vue par le client · 26 oct., 20 h 02",
      "Message de Mme Lefèvre · 27 oct., 9 h 15",
      "Version 2 envoyée · 28 oct., 19 h 50"
    ]);
  });
});
