// Sentry côté navigateur (12 nov) — remplace sentry.client.config.js, que
// Next 16 ne charge pas sans le wrapper withSentryConfig.
//
// Le SDK n'est téléchargé QUE si NEXT_PUBLIC_SENTRY_DSN est défini au build :
// la valeur est figée dans le bundle, donc sans DSN cette branche disparaît et
// les pages publiques ne paient rien. Avec un DSN, le chargement est
// asynchrone (ne bloque pas l'hydratation) : une erreur survenue dans les
// toutes premières millisecondes peut ne pas être captée.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

let sentry = null;

if (dsn) {
  import("@sentry/nextjs")
    .then((Sentry) => {
      Sentry.init({
        dsn,
        tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
        // Pas d'IP ni de cookies envoyés à Sentry (valeur par défaut, écrite
        // ici pour que personne ne l'active par mégarde).
        sendDefaultPii: false
      });
      sentry = Sentry;
    })
    .catch(() => {
      // Sentry indisponible (bloqueur, réseau) : l'app ne doit pas en souffrir.
    });
}

export function onRouterTransitionStart(url, navigationType) {
  sentry?.captureRouterTransitionStart(url, navigationType);
}
