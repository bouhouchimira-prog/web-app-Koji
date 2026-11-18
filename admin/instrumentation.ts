// Fichier volontairement sans effet : il sert de barrière.
//
// Sur Vercel, ce projet est compilé avec la racine du dépôt comme racine de
// travail (outputFileTracingRoot l'emporte sur turbopack.root). Next cherche
// alors « instrumentation » dans ce dossier, puis dans ses parents. Sans ce
// fichier, il trouvait celui du site principal (../instrumentation.js, qui
// charge Sentry) et la compilation du back-office échouait, car
// @sentry/nextjs n'est pas une de ses dépendances (18 novembre 2026).
// Ce fichier, plus proche, est trouvé en premier.
export function register() {}
