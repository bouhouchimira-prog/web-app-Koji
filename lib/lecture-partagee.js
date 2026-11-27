// Lecture partagée du bloc de données (KPRO-47, 27 nov. 2026).
//
// La fiche d'un chantier lançait dix requêtes en même temps, et neuf
// relisaient le bloc entier (2,1 Mo, 0,5 à 2,5 s).
//
// Étape 1 : les lectures qui arrivent pendant qu'une lecture est en cours,
// sur la même instance du serveur, attendent celle-ci au lieu d'en lancer
// une autre. En ligne, l'hébergeur répartit les requêtes sur plusieurs
// instances : le gain est rare.
//
// Étape 2 : avecLectureUnique(fn) fait partager une seule lecture à tout ce
// que fn exécute, même hors du partage ci-dessus. La route
// /api/fiche-chantier s'en sert pour appeler les dix routes de la fiche en
// une seule requête.
//
// Chaque appelant reçoit sa propre copie : les routes modifient l'objet lu
// avant d'écrire, une copie commune les mélangerait. La lecture est gardée
// sous forme de texte JSON, et chaque appelant en refait un objet : deux
// fois plus rapide que structuredClone sur 2 Mo (le bloc est déjà du JSON).
//
// Toute écriture (writeDb, ou writeUsers des comptes particuliers) appelle
// couperLecturePartagee() avant et après : une lecture commencée après une
// écriture ne reçoit jamais l'état d'avant cette écriture.

import { AsyncLocalStorage } from "node:async_hooks";

let lectureEnCours = null;
const lectureUnique = new AsyncLocalStorage();

export function couperLecturePartagee() {
  lectureEnCours = null;
  const contexte = lectureUnique.getStore();
  if (contexte) contexte.lecture = null;
}

// La lecture part tout de suite (pas au tour suivant de la boucle) ; une
// lecture en échec n'est pas gardée.
function lancer(lire, oublier) {
  const lecture = (async () => JSON.stringify(await lire()))();
  lecture.then(() => {}, () => oublier(lecture));
  return lecture;
}

export async function lirePartage(lire) {
  const contexte = lectureUnique.getStore();
  if (contexte) {
    if (!contexte.lecture) {
      contexte.lecture = lancer(lire, (l) => { if (contexte.lecture === l) contexte.lecture = null; });
    }
    return JSON.parse(await contexte.lecture);
  }
  if (!lectureEnCours) {
    const lecture = lancer(lire, (l) => { if (lectureEnCours === l) lectureEnCours = null; });
    lectureEnCours = lecture;
    lecture.then(() => { if (lectureEnCours === lecture) lectureEnCours = null; }, () => {});
  }
  return JSON.parse(await lectureEnCours);
}

export function avecLectureUnique(fn) {
  return lectureUnique.run({ lecture: null }, fn);
}

export async function ecrireEnCoupant(ecrire) {
  couperLecturePartagee();
  try {
    return await ecrire();
  } finally {
    couperLecturePartagee();
  }
}
