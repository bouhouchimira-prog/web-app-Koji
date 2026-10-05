import { badRequest, ok } from "../../../../../lib/http";
import { addHistory, makeToken, readDb, writeDb } from "../../../../../lib/db";
import { readUsers, writeUsers } from "../../../../../lib/particulier-users";
import { getSupabaseForToken } from "../../../../../lib/supabase";
import { issuePortalToken } from "../../../../../lib/portal-session";
import { setSessionCookie } from "../../../../../lib/session-cookies";
import { makePortalIdentifier, normalizeEmail } from "../../../../../lib/client-portal-access";
import { fixText } from "../../../../../lib/text";

// Termine une connexion Google cote particulier (Koji) — pendant du meme
// mecanisme entreprise (app/api/auth/google/finish/route.js), mais les
// comptes particulier ne vivent pas dans Supabase Auth (voir
// app/api/auth/particulier-signup/route.js) : ils vivent dans db.users
// (accountType "particulier"), avec leur propre session par jeton signe
// (lib/portal-session.js), pas des cookies Supabase. Le navigateur a deja
// obtenu une session Supabase via le redirect Google (verifie ici aupres de
// Supabase, jamais fait confiance a ce que le client affirme) — on s'en sert
// UNIQUEMENT pour recuperer un email verifie, puis on retrouve ou on cree le
// compte particulier correspondant dans db.users, exactement comme
// particulier-signup le ferait pour une inscription classique.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const accessToken = String(body.accessToken || "");
  if (!accessToken) return badRequest("Session Google invalide.");

  const scoped = getSupabaseForToken(accessToken);
  const { data: authData, error: authError } = await scoped.auth.getUser();
  if (authError || !authData?.user?.email) return badRequest("Session Google invalide.", 401);

  const authUser = authData.user;
  const email = normalizeEmail(authUser.email);
  const googleName = fixText(authUser.user_metadata?.name || authUser.user_metadata?.full_name || "");
  const now = new Date().toISOString();

  // Compte deja existant (le cas courant, une reconnexion) : chemin rapide
  // dedie (lib/particulier-users.js, 4 oct, remonte par Amira — connexion
  // Google lente) qui saute entierement le gros bloc partage
  // koji_web_state (1,27 Mo mesures, inutile pour une simple mise a jour
  // de compte). Google verifie deja la propriete de l'adresse — inutile de
  // redemander l'activation par e-mail si le compte existant l'attendait
  // encore.
  const users = await readUsers();
  const existingUser = users.find((u) => u.accountType === "particulier" && normalizeEmail(u.email) === email);
  if (existingUser) {
    if (existingUser.isActive === false) existingUser.isActive = true;
    if (!existingUser.name && googleName) existingUser.name = googleName;
    existingUser.authProvider = "google";
    existingUser.updatedAt = now;
    await writeUsers(users);

    const response = ok({
      kind: "client",
      account: {
        id: existingUser.id,
        email: existingUser.email,
        name: existingUser.name,
        accountType: existingUser.accountType,
        portalIdentifier: existingUser.portalIdentifier,
        clientAccess: existingUser.clientAccess || {}
      }
    });
    setSessionCookie(response, "portal", issuePortalToken(existingUser.id));
    return response;
  }

  // Nouveau compte (rare, touche aussi db.history) : reste sur le parcours
  // classique readDb()/writeDb() — pas le goulot d'etranglement mesure.
  const db = await readDb();
  const clientUser = {
    id: makeToken("client"),
    email: authUser.email,
    name: googleName || email.split("@")[0] || "Particulier",
    portalIdentifier: makePortalIdentifier(),
    accountType: "particulier",
    authProvider: "google",
    isActive: true,
    createdAt: now,
    updatedAt: now,
    personal: {},
    clientAccess: { quoteIds: [], projectIds: [] }
  };
  db.users.push(clientUser);
  addHistory(db, {
    userId: "",
    type: "particulier.signup",
    label: `Nouveau compte Koji (particulier) via Google : ${clientUser.email}`,
    entityId: clientUser.id,
    entityType: "user",
    meta: { email: clientUser.email }
  });
  await writeDb(db);

  const response = ok({
    kind: "client",
    account: {
      id: clientUser.id,
      email: clientUser.email,
      name: clientUser.name,
      accountType: clientUser.accountType,
      portalIdentifier: clientUser.portalIdentifier,
      clientAccess: clientUser.clientAccess || {}
    }
  });
  setSessionCookie(response, "portal", issuePortalToken(clientUser.id));
  return response;
}
