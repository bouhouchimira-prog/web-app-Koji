// Documents légaux (maquette PRO-20). Sections de L.legal.sections :
// 0 mentions, 1 CGU, 2 confidentialité, 3 CGV abonnement, 4 cookies.
export const DOCUMENTS = [
  { slug: "mentions-legales", titre: "Mentions légales", sections: [0], attendus: [["Médiation de la consommation", "Médiateur de Koji pour les particuliers · nom, site · à compléter"]] },
  { slug: "conditions-professionnels", titre: "Conditions d'utilisation · professionnels", sections: [1, 3], attendus: [] },
  {
    slug: "conditions-particuliers",
    titre: "Conditions · particuliers",
    sections: [],
    attendus: [
      ["Conditions d'utilisation pour les particuliers", "Texte à rédiger par l'avocat. En attendant, les conditions générales d'utilisation (page professionnels) s'appliquent aussi aux comptes particuliers."],
      ["Information précontractuelle", "Texte à rédiger par l'avocat"],
      ["Médiation de la consommation", "Médiateur de Koji pour les particuliers · nom, site · à compléter"]
    ]
  },
  { slug: "confidentialite", titre: "Confidentialité", sections: [2], attendus: [] },
  { slug: "cookies", titre: "Cookies", sections: [4], attendus: [], choix: true }
];
