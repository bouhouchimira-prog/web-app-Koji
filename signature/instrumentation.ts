// Fichier volontairement sans effet : il sert de barrière.
//
// Ce projet est compilé avec la racine du dépôt comme racine de travail
// (voir next.config.ts). Next cherche « instrumentation » dans ce dossier,
// puis dans ses parents. Sans ce fichier, il trouvait celui du site principal
// (../instrumentation.js, qui charge Sentry) et l'embarquait dans le site de
// signature, qui n'a rien demandé (18 novembre 2026). Ce fichier, plus
// proche, est trouvé en premier.
export function register() {}
