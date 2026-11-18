// Koji Client · Aide (maquette CLI-06) : quatre thèmes, leurs questions et
// des réponses courtes, d'après le fonctionnement réel de Koji. La question
// tapée en tête filtre cette liste sur l'appareil (pas d'IA). Pas de
// « prix recommandé » : aucun prix n'est calculé par Koji pour le
// particulier (décision du 10 novembre).

export const THEMES_AIDE = [
  {
    cle: "devis",
    titre: "Mon devis",
    questions: [
      ["Comment comparer les propositions ?", "Dans Mes projets, ouvrez votre demande puis « Comparer » : une colonne par entreprise, avec son prix, la date de début, la visite, l'assurance décennale et les garanties. Les entreprises sont classées par date de réponse, pas par paiement."],
      ["Qui fixe le prix des travaux ?", "Chaque entreprise, avec ses propres tarifs. Koji ne calcule aucun prix pour vous. Une estimation envoyée avant la visite est confirmée par le devis après la visite."],
      ["Puis-je changer d'avis après avoir signé ?", "Si vous avez signé en ligne ou chez vous, vous avez 14 jours pour annuler (vous rétracter), sans donner de motif, depuis la page de signature du devis (« Me rétracter »). Un devis signé dans les locaux de l'entreprise n'ouvre pas ce délai."]
    ]
  },
  {
    cle: "chantier",
    titre: "Le chantier",
    questions: [
      ["Qui voit mes photos ?", "Les photos jointes à votre demande ne sont pas montrées aux entreprises d'office. Quand une entreprise les demande, vous les débloquez pour elle seule, dans Messages."],
      ["Comment signaler un problème ?", "Écrivez d'abord à l'entreprise. Pendant les travaux, signalez le souci depuis la page de votre chantier ; après la réception, il arrive chez l'entreprise comme une réserve à traiter."],
      ["Qu'est-ce qu'une réserve ?", "Un défaut constaté à la réception des travaux et noté sur le procès-verbal. L'entreprise doit le corriger ; la réserve est alors levée."]
    ]
  },
  {
    cle: "paiements",
    titre: "Paiements",
    questions: [
      ["Quand payer ?", "Aux étapes prévues par le devis signé : souvent un acompte, puis des situations au fil des travaux, et le solde à la fin. Si vous avez signé chez vous, aucun paiement ne peut vous être demandé avant 7 jours."],
      ["Qu'est-ce que la retenue de garantie ?", "Si le devis la prévoit, vous gardez au plus 5 % du prix pendant un an après la réception, le temps que les réserves soient levées. Elle est ensuite versée à l'entreprise."],
      ["Où sont mes factures ?", "L'entreprise vous les envoie par e-mail. Pour un double, demandez-le-lui."]
    ]
  },
  {
    cle: "compte",
    titre: "Mon compte",
    questions: [
      ["Changer de téléphone ou d'adresse", "Profil › Coordonnées pour le nom et le téléphone, Profil › Mon logement pour l'adresse. Pour changer d'adresse e-mail, écrivez à contact@getkoji.io."],
      ["Supprimer mes données", "Profil › Mes données : téléchargez vos données, puis demandez la suppression du compte. Elle est faite sous 30 jours ; les devis signés et les factures restent chez chaque entreprise pendant la durée légale."],
      ["Langue", "Koji Client est en français. Les compagnons qui écrivent dans une autre langue peuvent faire traduire leurs messages en français avant de vous les envoyer."],
      ["Revenir sans mot de passe", "Sur l'écran de connexion, « Retrouver mon projet » : saisissez votre adresse e-mail, vous recevez un code valable 10 minutes."]
    ]
  }
];

// Résumé d'un thème sous son titre (« Comment comparer… ? Qui fixe… ? »).
export function resumeTheme(theme) {
  const q = theme.questions.map(([x]) => x);
  if (q.every((x) => x.endsWith("?"))) return q.join(" ");
  return `${q.map((x, i) => (i ? x[0].toLowerCase() + x.slice(1) : x)).join(", ")}.`;
}

const sansAccents = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const MOTS_VIDES = new Set(["je", "j", "puis", "peux", "est", "ce", "que", "qu", "le", "la", "les", "un", "une", "de", "des", "du", "d", "l", "a", "au", "aux", "mon", "ma", "mes", "et", "ou", "en", "il", "on", "pour", "comment", "quoi", "qui", "quand", "apres", "avoir"]);

// Questions dont le texte contient tous les mots utiles de la recherche
// (sans accents ni mots vides ; préfixe accepté : « annul » → « annuler »).
export function chercherAide(recherche, themes = THEMES_AIDE) {
  const mots = sansAccents(recherche).split(/[^a-z0-9]+/).filter((m) => m.length > 1 && !MOTS_VIDES.has(m));
  if (!mots.length) return [];
  const resultats = [];
  for (const theme of themes) {
    for (const [question, reponse] of theme.questions) {
      const texte = sansAccents(`${question} ${reponse} ${theme.titre}`);
      const mots2 = texte.split(/[^a-z0-9]+/);
      if (mots.every((m) => mots2.some((x) => x.startsWith(m.length > 4 ? m.slice(0, Math.max(4, m.length - 2)) : m)))) resultats.push({ theme: theme.titre, question, reponse });
    }
  }
  return resultats;
}
