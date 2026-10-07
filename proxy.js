import { NextResponse } from "next/server";
import { COOKIES, LAST_ACTIVE_COOKIE } from "./lib/session-cookies";

// Deconnexion automatique apres 15 minutes d'inactivite (6 oct, demande
// d'Amira) — les sessions elles-memes (koji_session 1h + koji_refresh 30j,
// koji_portal_session/koji_worker_session 30j) gardent leur duree de vie
// propre pour que "rester connecte" continue de fonctionner ; cette fenetre
// d'inactivite vient juste SE SUPERPOSER par-dessus, via un cookie dedie
// (koji_last_active, voir lib/session-cookies.js) prolonge a chaque requete
// tant qu'il y a de l'activite. Si elle expire, toutes les vraies sessions
// sont effacees ici, en un seul endroit plutot que dans chaque route.
const SESSION_COOKIES = [COOKIES.access, COOKIES.refresh, COOKIES.portal, COOKIES.worker];

export function proxy(request) {
  const hasSession = SESSION_COOKIES.some((c) => request.cookies.get(c.name)?.value);
  if (!hasSession) return NextResponse.next();

  const response = NextResponse.next();
  const lastActive = request.cookies.get(LAST_ACTIVE_COOKIE.name)?.value;

  if (!lastActive) {
    // Inactif depuis plus de 15 minutes : efface toutes les sessions —
    // la requete en cours peut encore passer avec l'ancien cookie (il n'est
    // retire que de la REPONSE, le navigateur l'appliquera a la prochaine
    // requete), mais la session est bien morte a partir de maintenant.
    // Chaque cookie doit etre efface avec le MEME path qu'a sa creation
    // (koji_refresh vit sous /api/auth, pas /) sinon le navigateur le garde.
    for (const c of SESSION_COOKIES) response.cookies.set(c.name, "", { ...c.options, maxAge: 0 });
    response.cookies.set(LAST_ACTIVE_COOKIE.name, "", { ...LAST_ACTIVE_COOKIE.options, maxAge: 0 });
    return response;
  }

  // Actif : prolonge la fenetre d'inactivite de 15 minutes de plus.
  response.cookies.set(LAST_ACTIVE_COOKIE.name, "1", LAST_ACTIVE_COOKIE.options);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
