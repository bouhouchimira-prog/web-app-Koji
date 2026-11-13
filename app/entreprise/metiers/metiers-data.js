// SITE-04 : une page par métier, getkoji.io/entreprise/metiers/<slug>.
// Structure fixe (maquette « KOJI Pro pages »), contenu par métier. La
// maquette ne fournit que Plombier et précise que le contenu de chaque
// métier est « à écrire avec un professionnel du métier » : un métier
// n'a sa page (et son lien) qu'une fois son contenu ajouté ici.
//
// Les mentions « (à vérifier) » et « (PRO-08.3) » de la maquette sont des
// notes internes : retirées du texte publié, gardées dans la liste des
// points à valider.

export const METIERS = [
  { slug: 'plombier', nom: 'Plombier' },
  { slug: 'electricien', nom: 'Électricien' },
  { slug: 'carreleur', nom: 'Carreleur' },
  { slug: 'peintre', nom: 'Peintre' },
  { slug: 'plaquiste', nom: 'Plaquiste' },
  { slug: 'macon', nom: 'Maçon' },
  { slug: 'menuisier', nom: 'Menuisier' },
  { slug: 'tous-corps-etat', nom: "Rénovation tous corps d'état" },
];

export const CONTENU = {
  plombier: {
    titre: 'Koji pour les plombiers',
    description:
      "Devis en dix minutes sur place, TVA juste, photos avant / après, factures et relances : tout ce qu'un plombier fait chaque semaine, sans ressaisie.",
    seo: {
      title: 'Logiciel de devis pour plombier — Koji',
      description:
        "Devis de plomberie guidés sur place, ouvrages prêts à vos prix, TVA proposée selon le logement, factures et relances. Gratuit pour commencer.",
    },
    familles: [
      ['Dépannage et petits travaux', "Fuite, robinet, chasse d'eau, chauffe-eau : devis en trois questions, facture le jour même."],
      ['Salle de bain', 'Dépose, évacuations, receveur, faïence : Koji découpe en lots et chiffre chaque ligne avec vos prix.'],
      ['Chauffage et eau chaude', 'Remplacement de chaudière, ballon, PAC : TVA 5,5 % ou 10 % choisie automatiquement selon le cas.'],
    ],
    exemple: {
      titre: 'Un chauffe-eau, en trois temps',
      sousTitre: 'Exemple réel de devis guidé.',
      etapes: [
        ['Décrivez', '« Chauffe-eau 200 L à remplacer, 3e étage, ancien à évacuer. »'],
        ['Koji chiffre', "Dépose, fourniture (votre prix ou le catalogue), pose, groupe de sécurité, évacuation de l'ancien. TVA 10 % : logement de plus de 2 ans."],
        ['Vous validez', 'Ligne par ligne, puis envoi. Signature en ligne, acompte demandé.'],
      ],
    },
    bibliotheque: 'La bibliothèque plomberie arrive remplie ; vos factures servent à déduire vos taux.',
    ouvrages: [
      ['Remplacement chauffe-eau électrique 200 L', 'u'],
      ["Création d'évacuation PVC Ø 40", 'ml'],
      ['Pose receveur extra-plat 90 × 120', 'u'],
      ['Recherche de fuite, première heure', 'h'],
    ],
    reglesTitre: 'Les règles de la plomberie, Koji s’en occupe',
    regles: [
      ['TVA 10 % ou 5,5 %', "logement de plus de deux ans, travaux d'amélioration énergétique : taux proposé, attestation jointe"],
      ['Attestation de conformité', 'mention rappelée sur les travaux concernés'],
      ['Garantie décennale', 'attestation jointe à chaque devis, échéance surveillée'],
      ['Facture électronique', 'prête pour le calendrier 2026-2027'],
    ],
  },
};

export function metierHref(slugOuNom) {
  const metier = METIERS.find((m) => m.slug === slugOuNom || m.nom === slugOuNom);
  return metier && CONTENU[metier.slug] ? `/entreprise/metiers/${metier.slug}` : undefined;
}
