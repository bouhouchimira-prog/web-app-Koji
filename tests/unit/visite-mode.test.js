const assert = require("assert");
const {
  listeAVerifier, prochaineQuestion, propositions, comprendreCote, surfaces, resumeSurfaces, quantitesCalculees,
  texteCote, datesPromises, veille, resumeClient, compteVisite, dureeVisite, demandeDevisGuide, questionsRestantes, enAttente
} = require("../../lib/visite-mode");

// Mode visite (maquette PRO-03.8) : mêmes exemples que l'app
// (mobile/test/visite_mode_test.dart).
const DEMANDE = "Douche à l'italienne à la place de la baignoire, faïence toute hauteur, WC suspendu, meuble vasque 80 cm. 4e sans ascenseur.";
const COTES = [
  { libelle: "Longueur", valeur: 2.4 },
  { libelle: "Largeur", valeur: 2.42 },
  { libelle: "Hauteur", valeur: 2.5 },
  { libelle: "Porte", largeur: 0.83, hauteur: 2.04 },
  { libelle: "Fenêtre", largeur: 0.6, hauteur: 0.8 },
  { libelle: "Mur vasque", valeur: 1.12 }
];

describe("mode visite (PRO-03.8)", () => {
  it("prépare la liste à vérifier d'après la demande", () => {
    const points = listeAVerifier(DEMANDE);
    assert.deepStrictEqual(points.map((p) => p.libelle), [
      "Évacuations : diamètre et pente",
      "Arrivées d'eau et robinet d'arrêt",
      "Support des murs, faïence à déposer",
      "Différentiel 30 mA au tableau",
      "Accès, stockage et évacuation des gravats",
      "Ventilation existante"
    ]);
    assert.deepStrictEqual(listeAVerifier("Peindre le salon").map((p) => p.id), ["support", "acces"]);
    assert.strictEqual(prochaineQuestion(points).question, "Évacuations : quel diamètre ?");
    const ventilation = points.find((p) => p.id === "ventilation");
    assert.deepStrictEqual(ventilation.choix, ["Oui", "Non, fenêtre seulement", "Je ne sais pas"]);
  });

  it("comprend les cotes dictées", () => {
    assert.deepStrictEqual(comprendreCote("Mur du fond deux mètres quarante"), { libelle: "Mur du fond", valeur: 2.4 });
    assert.deepStrictEqual(comprendreCote("Porte quatre-vingt-trois par deux cent quatre"), { libelle: "Porte", largeur: 0.83, hauteur: 2.04 });
    assert.deepStrictEqual(comprendreCote("Fenêtre 60 x 80"), { libelle: "Fenêtre", largeur: 0.6, hauteur: 0.8 });
    assert.deepStrictEqual(comprendreCote("hauteur deux cinquante"), { libelle: "Hauteur", valeur: 2.5 });
    assert.deepStrictEqual(comprendreCote("Mur de la vasque un mètre douze"), { libelle: "Mur de la vasque", valeur: 1.12 });
    assert.deepStrictEqual(comprendreCote("longueur 2,40"), { libelle: "Longueur", valeur: 2.4 });
    assert.deepStrictEqual(comprendreCote("Largeur 2 m 42"), { libelle: "Largeur", valeur: 2.42 });
    assert.deepStrictEqual(comprendreCote("Allège 110"), { libelle: "Allège", valeur: 1.1 });
    assert.deepStrictEqual(comprendreCote("deux mètres cinq"), { libelle: "", valeur: 2.05 });
    assert.deepStrictEqual(comprendreCote("Placard quatre-vingt-dix centimètres"), { libelle: "Placard", valeur: 0.9 });
    assert.strictEqual(comprendreCote("pas de nombre ici"), null);
  });

  it("calcule sol, murs et quantités depuis les cotes, avec la formule", () => {
    const s = surfaces(COTES);
    assert.strictEqual(s.sol, 5.81);
    assert.strictEqual(s.murs, 21.93);
    assert.strictEqual(s.bande, 8.81);
    assert.strictEqual(resumeSurfaces(COTES), "sol 5,81 m² · murs 21,93 m²");
    assert.strictEqual(texteCote(COTES[3]), "0,83 × 2,04 m");
    assert.deepStrictEqual(quantitesCalculees({ cotes: COTES }, DEMANDE).map((q) => [q.libelle, q.formule, q.valeur, q.unite]), [
      ["Sol à carreler", "2,40 × 2,42", 5.81, "m²"],
      ["Faïence toute hauteur", "périmètre 9,64 × 2,50 − porte − fenêtre", 21.93, "m²"],
      ["Bande d'angle d'étanchéité", "périmètre − porte", 8.81, "ml"],
      ["Dépose faïence existante", "même surface", 21.93, "m²"]
    ]);
  });

  it("propose ce qu'une vérification change, et le résumé sans prix", () => {
    const points = listeAVerifier(DEMANDE).map((p) => ({ ...p, reponse: { evacuations: "Ø 40", ventilation: "Non, fenêtre seulement" }[p.id] || "" }));
    const props = propositions(points, "Salle de bain");
    assert.strictEqual(props.length, 1);
    assert.strictEqual(props[0].texte, "Pas de VMC : Koji propose un extracteur d'air dans la salle de bain, en option sur le devis. Une photo de la fenêtre suffit.");
    const visite = { client: "Mme Lefèvre", pieces: [{ nom: "Salle de bain", points, cotes: COTES, photos: [{ id: "a" }, { id: "b", envoye: true }], notes: [{ texte: "Cliente veut garder le radiateur." }] }], propositions: { extracteur: "acceptee" } };
    assert.strictEqual(resumeClient(visite, "2026-10-26"), "Bonjour Mme Lefèvre,\n\nMerci pour la visite. Points vus : évacuation Ø 40, pas de VMC (extracteur proposé en option). Vous recevrez le devis d'ici lundi.");
    assert.strictEqual(compteVisite(visite).texte, "2 photos, 6 cotes, 2 vérifications, 1 note");
    assert.strictEqual(questionsRestantes(visite), 4);
    assert.strictEqual(enAttente(visite), 1 + 6 + 1 + 2);
    const demande = demandeDevisGuide({ ...visite, demande: DEMANDE, adresse: "12 rue Exemple, Paris 10e" });
    assert.ok(demande.includes("Quantités : Sol à carreler 5,81 m² ; Faïence toute hauteur 21,93 m²"));
    assert.ok(demande.includes("À ajouter : Fourniture et pose d'un extracteur d'air (en option)."));
    assert.ok(!/€/.test(demande));
  });

  it("propose la date promise du devis et le rappel la veille", () => {
    assert.deepStrictEqual(datesPromises("2026-10-24"), [{ jour: "2026-10-26", label: "Lundi 26 oct." }, { jour: "2026-10-28", label: "Mercredi 28" }]);
    assert.deepStrictEqual(datesPromises("2026-10-29").map((d) => d.label), ["Vendredi 30 oct.", "Mardi 3 nov."]);
    assert.strictEqual(veille("2026-10-26"), "2026-10-25");
    assert.strictEqual(dureeVisite("2026-10-24T08:05:00Z", "2026-10-24T08:43:00Z"), "38 min");
  });
});
