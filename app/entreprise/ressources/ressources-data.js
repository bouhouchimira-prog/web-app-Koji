// SITE-05 : fiches Ressources, getkoji.io/entreprise/ressources.
// Les six fiches proposées par la maquette ; seule « Facture électronique
// 2026 » a son texte. La maquette fixe deux règles : chaque fiche est relue
// par un expert-comptable ou un avocat avant publication (date de relecture
// affichée), et la rubrique ne se lance pas avec moins de quatre fiches.
// Tant que ce n'est pas le cas, RESSOURCES_LANCEES reste à false : pages non
// indexées, absentes du plan du site et sans lien depuis le site.

export const RESSOURCES_LANCEES = false;

export const THEMES = ['Facture électronique', 'TVA', 'Devis', 'Factures', 'Sous-traitance', 'Droit'];

export const FICHES = [
  {
    slug: 'facture-electronique-2026',
    theme: 'Facture électronique',
    titre: 'Facture électronique 2026 : ce qui change pour les artisans',
    resume: "Réception obligatoire au 1er septembre 2026, émission au 1er septembre 2027 pour les PME et micro. Ce qu'il faut préparer.",
    rubrique: 'Réglementation',
    duree: '6 min',
    article: {
      chapo: "Réception obligatoire au 1er septembre 2026 pour toutes les entreprises ; émission au 1er septembre 2027 pour les PME et microentreprises. Voici ce qu'il faut préparer, et ce que Koji fait pour vous.",
      misAJour: '3 novembre 2026',
      // Date de relecture par un expert, affichée quand elle existe.
      relu: null,
      sections: [
        {
          id: 'calendrier',
          titre: 'Le calendrier',
          html: [
            "Depuis le 1er septembre 2026, toute entreprise assujettie à la TVA doit pouvoir <b>recevoir</b> des factures électroniques par une plateforme agréée. L'obligation d'<b>émettre</b> suit : grandes entreprises et ETI dès 2026, PME et microentreprises au 1er septembre 2027.",
          ],
          koji: "Koji n'est pas plateforme agréée : il se connecte à une plateforme partenaire (choix en cours) qui reçoit et transmet vos factures. Vous ne changez pas d'outil.",
        },
        {
          id: 'recevoir',
          titre: 'Recevoir des factures',
          html: ['Vos fournisseurs vous enverront leurs factures par leur plateforme ; elles arrivent dans Dépenses › Factures reçues, rattachées au chantier.'],
        },
        {
          id: 'emettre',
          titre: 'Émettre des factures',
          html: ["À partir de 2027, chaque facture part par la plateforme avec les mentions nouvelles (SIREN du client, adresse de livraison, nature de l'opération). Koji les prépare déjà."],
        },
      ],
      sources: 'Code général des impôts, art. 289 bis · impots.gouv.fr, calendrier de la facturation électronique · CAPEB, note du 26 janvier 2026.',
    },
  },
  {
    slug: 'tva-batiment',
    theme: 'TVA',
    titre: 'TVA dans le bâtiment : 5,5 %, 10 % ou 20 % ?',
    resume: "Les trois taux, les conditions, l'attestation du client, les erreurs fréquentes.",
    rubrique: 'Fiscalité',
    duree: '8 min',
  },
  {
    slug: 'mentions-devis',
    theme: 'Devis',
    titre: 'Modèle de devis bâtiment : les mentions obligatoires',
    resume: "Ce qu'un devis doit contenir, ligne par ligne, et ce qui vous protège en cas de litige.",
    rubrique: 'Devis',
    duree: '5 min',
  },
  {
    slug: 'facturer-par-etapes',
    theme: 'Factures',
    titre: 'Acompte, situation, solde : facturer un chantier en trois temps',
    resume: "Pourquoi facturer par étapes, et comment Koji lie chaque facture à l'avancement.",
    rubrique: 'Factures',
    duree: '4 min',
  },
  {
    slug: 'sous-traitance-documents',
    theme: 'Sous-traitance',
    titre: 'Sous-traiter sans risque : les documents à demander',
    resume: 'URSSAF, Kbis, décennale, RC pro : la vigilance à jour, et ce que Koji vérifie pour vous.',
    rubrique: 'Équipe',
    duree: '5 min',
  },
  {
    slug: 'retractation-client',
    theme: 'Droit',
    titre: 'Rétractation du client : 14 jours, et après ?',
    resume: "Devis signé à distance, formulaire, démarrage anticipé : ce qu'il faut écrire et quand.",
    rubrique: 'Droit',
    duree: '4 min',
  },
];

export function ficheHref(fiche) {
  return fiche.article ? `/entreprise/ressources/${fiche.slug}` : undefined;
}
