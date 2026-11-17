import assert from "node:assert/strict";
import fs from "node:fs";
import { THEMES_AIDE } from "../../lib/aide-guides.js";

// Maquette PRO-22 : six thèmes ; le site et l'app montrent les mêmes guides.
describe("Aide (PRO-22)", () => {
  it("six thèmes, mêmes guides sur le site et dans l'app", () => {
    assert.deepEqual(THEMES_AIDE.map((t) => t.titre), ["Démarrer", "Devis et signature", "Chantier", "Factures", "Radar et jetons", "Équipe et sous-traitants"]);
    const dart = fs.readFileSync(new URL("../../mobile/lib/features/help/aide_pro.dart", import.meta.url), "utf8").replace(/\\'/g, "'");
    for (const t of THEMES_AIDE) for (const [titre, texte] of t.guides) {
      assert.ok(dart.includes(titre), `titre absent de l'app : ${titre}`);
      assert.ok(dart.includes(texte), `texte différent dans l'app : ${titre}`);
    }
  });
});
