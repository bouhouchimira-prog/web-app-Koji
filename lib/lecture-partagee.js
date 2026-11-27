// Lecture partagée du bloc de données (KPRO-47, 27 nov. 2026).
//
// La fiche d'un chantier lance neuf requêtes en même temps, et chacune
// relisait le bloc entier (2,1 Mo, 0,5 à 2,5 s). Les lectures qui arrivent
// pendant qu'une lecture est en cours, sur la même instance du serveur,
// attendent celle-ci au lieu d'en lancer une autre.
//
// Chaque appelant reçoit sa propre copie : les routes modifient l'objet lu
// avant d'écrire, une copie commune les mélangerait. La lecture est gardée
// sous forme de texte JSON, et chaque appelant en refait un objet : deux
// fois plus rapide que structuredClone sur 2 Mo (le bloc est déjà du JSON).
//
// Toute écriture (writeDb, ou writeUsers des comptes particuliers) appelle
// couperLecturePartagee() avant et après : une lecture commencée après une
// écriture ne reçoit jamais l'état d'avant cette écriture.

let lectureEnCours = null;

export function couperLecturePartagee() {
  lectureEnCours = null;
}

export async function lirePartage(lire) {
  if (!lectureEnCours) {
    // La lecture part tout de suite (pas au tour suivant de la boucle).
    const lecture = (async () => JSON.stringify(await lire()))().finally(() => {
      if (lectureEnCours === lecture) lectureEnCours = null;
    });
    lectureEnCours = lecture;
  }
  return JSON.parse(await lectureEnCours);
}

export async function ecrireEnCoupant(ecrire) {
  couperLecturePartagee();
  try {
    return await ecrire();
  } finally {
    couperLecturePartagee();
  }
}
