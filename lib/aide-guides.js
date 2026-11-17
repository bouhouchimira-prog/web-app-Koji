// Guides de l'aide (maquette PRO-22), par thème. Ils décrivent ce que Koji
// fait aujourd'hui, avec le chemin dans le menu. L'app Koji Pro en porte la
// même copie (mobile/lib/features/help/help_screen.dart).
export const THEMES_AIDE = [
  {
    id: "demarrer", titre: "Démarrer", sous: "compte, prix, premier devis",
    guides: [
      ["Compléter votre profil", "Paramètres › Mon entreprise : six étapes (identité, métiers et zone, vos prix, décennale, IBAN, médiateur). Chaque étape dit ce qu'elle débloque, par exemple la décennale sur vos devis et votre KojiPage."],
      ["Régler vos prix", "Bibliothèque › Mes prix : votre taux horaire et vos ouvrages. Koji calcule chaque ligne de devis avec vos propres prix, jamais avec des prix inventés."],
      ["Faire un premier devis avec Koji", "Accueil › Démarrer un devis guidé : Koji pose les questions oubliées, vous validez chaque ligne avant l'envoi."]
    ]
  },
  {
    id: "devis", titre: "Devis et signature", sous: "versions, rétractation, acompte",
    guides: [
      ["Faire signer un devis", "Depuis le devis : envoi par e-mail, le client signe en ligne ; ou signature sur place, sur votre téléphone."],
      ["Pourquoi je ne peux pas envoyer l'acompte ?", "Un devis signé au domicile du client ouvre 14 jours de rétractation et interdit tout paiement avant 7 jours : Koji bloque la facture d'acompte jusqu'à cette date et l'affiche."],
      ["Modifier un devis signé", "Un devis signé ne se modifie pas : faites une nouvelle version ou un avenant (menu Avenant), que le client signe à son tour."],
      ["Relancer un devis", "Devis › Envoyés : un devis sans réponse depuis 7 jours passe « À relancer », avec un message prêt à envoyer."]
    ]
  },
  {
    id: "chantier", titre: "Chantier", sous: "photos, réserves, réception",
    guides: [
      ["Photos avant, pendant, après", "Fiche du chantier › Photos : la date, l'heure et l'auteur sont ajoutés. Le client ne les voit jamais sans votre accord."],
      ["Réserves et réception", "Fiche du chantier › Réserves : attribuez chaque réserve, faites-la lever avec une photo. La clôture produit le procès-verbal de réception, avec les réserves non levées."],
      ["Suivre le coût du chantier", "Dépenses › Coût des chantiers : dépensé face au prévu du devis, lot par lot, et la marge estimée à la fin."]
    ]
  },
  {
    id: "factures", titre: "Factures", sous: "situations, avoir, relances",
    guides: [
      ["Acompte, situation, solde", "Factures › Nouvelle facture, depuis un devis signé : Koji calcule l'acompte, la situation de travaux ou le solde restant dû."],
      ["Comment faire un avoir ?", "Une facture émise ne se supprime pas. Ouvrez-la et créez un avoir qui la référence, puis une nouvelle facture si besoin."],
      ["Relancer un impayé", "Factures › En retard › Relancer : relance aimable puis ferme, par e-mail. La mise en demeure part en recommandé ; Koji la note."]
    ]
  },
  {
    id: "radar", titre: "Radar et jetons", sous: "se positionner, rendez-vous",
    guides: [
      ["Se positionner sur un chantier", "Radar : Koji calcule votre prix avec votre bibliothèque. Des jetons sont réservés quand vous vous positionnez, débités si le client confirme le rendez-vous, rendus sinon."],
      ["Acheter des jetons", "Paramètres › Abonnement et jetons › Recharger, sur le site. L'app ne vend rien."]
    ]
  },
  {
    id: "equipe", titre: "Équipe et sous-traitants", sous: "invitations, documents",
    guides: [
      ["Inviter un compagnon", "Équipe › Ajouter un compagnon : il reçoit un lien par SMS, sans mot de passe, et voit sa journée, jamais vos prix."],
      ["Valider les heures", "Équipe › Heures : touchez une case pour corriger, puis « Valider la semaine » et « Envoyer au comptable »."],
      ["Documents des sous-traitants", "Contacts › fiche du sous-traitant : Kbis, URSSAF, décennale. Koji prévient avant chaque expiration ; le contrat de sous-traitance se prépare depuis Réseau pro."]
    ]
  }
];
