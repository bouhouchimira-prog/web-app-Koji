import assert from "node:assert/strict";
import { creerFiltreFlux, nettoyerTexteChat } from "../../lib/devis-chat-texte.js";
import { buildDevisChatPrompt } from "../../lib/devis-chat-prompt.js";

// Retours du build 64 : la balise interne et les astérisques du gras
// arrivaient à l'écran de l'artisan.
describe("Assistant devis : texte montré à l'entreprise", () => {
  it("retire la balise et son accusé de réception", () => {
    assert.equal(
      nettoyerTexteChat("[RESULTAT_ECRITURE] bien reçu — le lot Chambre est créé et les deux lignes sont enregistrées."),
      "Le lot Chambre est créé et les deux lignes sont enregistrées."
    );
    assert.equal(nettoyerTexteChat("Parfait.\n\n[RESULTAT_ECRITURE] Bien reçu : c'est enregistré."), "Parfait.\n\nC'est enregistré.");
    assert.equal(nettoyerTexteChat("Le message [RESULTAT_ECRITURE] est arrivé."), "Le message est arrivé.");
  });

  it("retire les astérisques du gras, garde le reste", () => {
    assert.equal(nettoyerTexteChat("Lot **Chambre** : **33,5 m²**, soit 2 * 3 couches."), "Lot Chambre : 33,5 m², soit 2 * 3 couches.");
    assert.equal(nettoyerTexteChat("- Peindre un mur\n- Peindre un plafond"), "- Peindre un mur\n- Peindre un plafond");
    assert.equal(nettoyerTexteChat(""), "");
  });

  // Le texte arrive coupé n'importe où : quel que soit le découpage, le
  // résultat est le même, et aucun début de balise n'est envoyé.
  it("filtre le flux quel que soit le découpage", () => {
    const texte = "Je vais ajouter **Plafond**. [RESULTAT_ECRITURE] ok, 2 * 3 [couches] *";
    const attendu = "Je vais ajouter Plafond.  ok, 2 * 3 [couches] *";
    for (const taille of [1, 2, 3, 5, 7, 11, 100]) {
      const filtre = creerFiltreFlux();
      let sortie = "";
      for (let i = 0; i < texte.length; i += taille) {
        const morceau = filtre.pousser(texte.slice(i, i + taille));
        assert.ok(!/\[RESULTAT|\*\*/.test(sortie + morceau), `découpage ${taille} : ${sortie + morceau}`);
        sortie += morceau;
      }
      sortie += filtre.finir();
      assert.equal(sortie, attendu, `découpage ${taille}`);
    }
  });

  it("les consignes couvrent les quatre retours du testeur", () => {
    const consignes = buildDevisChatPrompt({ quoteSnapshot: {}, isAdmin: false })[0].text;
    assert.match(consignes, /ACCORD DONNÉ D'AVANCE/);
    assert.match(consignes, /Jamais de markdown/);
    assert.match(consignes, /Ne raconte jamais tes recherches/);
    assert.match(consignes, /ne recopie jamais la balise/);
    assert.match(consignes, /Ne demande JAMAIS à l'entreprise d'aller vérifier elle-même/);
  });
});
