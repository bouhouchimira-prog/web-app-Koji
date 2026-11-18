// Sentry côté serveur (12 nov). Avant ce fichier, sentry.server.config.js et
// sentry.edge.config.js n'étaient chargés par personne : même avec un DSN,
// aucune erreur serveur ne serait partie. Next appelle register() une fois au
// démarrage du serveur, et onRequestError à chaque erreur de rendu ou de
// route. Sans SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN, Sentry reste désactivé
// (voir `enabled` dans les deux fichiers de config).
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config.js");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config.js");
  }
}

export const onRequestError = Sentry.captureRequestError;
