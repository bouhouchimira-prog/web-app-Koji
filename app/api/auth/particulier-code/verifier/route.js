import { ok, badRequest } from "../../../../../lib/http";
import { readDb, writeDb } from "../../../../../lib/db";
import { issuePortalToken } from "../../../../../lib/portal-session";
import { setSessionCookie } from "../../../../../lib/session-cookies";
import { requestLogger } from "../../../../../lib/logger";
import { adresseNormalisee, cleAdresse, nettoyerCodes, verifierCode, ERREUR_CODE, ERREUR_EPUISE } from "../../../../../lib/code-particulier";

// « Retrouver mon projet » (maquette CLI-05), étape 2 : POST { email, code }.
// Code juste : il est consommé et la même session que
// /api/auth/particulier-login est ouverte (cookie koji_portal_session),
// avec la même réponse { kind: "client", account } pour remplir koji-user.
// Code faux ou expiré : message générique ; au 5e essai, un nouveau code
// est nécessaire (le compteur n'est jamais affiché avant).
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function POST(request) {
  const log = requestLogger(request, "POST /api/auth/particulier-code/verifier");
  try {
    const body = await request.json().catch(() => ({}));
    const email = adresseNormalisee(body.email);
    const code = String(body.code || "").replace(/\s/g, "");
    if (!email || !code) return badRequest(ERREUR_CODE, 401);

    const db = await readDb();
    const maintenant = Date.now();
    db.particulierCodes = nettoyerCodes(db.particulierCodes, maintenant);
    const cle = cleAdresse(email, SECRET);
    const resultat = verifierCode(db.particulierCodes[cle], code, SECRET, maintenant);
    if (resultat.entree.empreinte || resultat.entree.envois.length) db.particulierCodes[cle] = resultat.entree;
    else delete db.particulierCodes[cle];

    const compte = resultat.ok
      ? (db.users || []).find((u) => u.id === resultat.userId && u.accountType === "particulier" && u.isActive !== false && adresseNormalisee(u.email) === email)
      : null;
    await writeDb(db);

    if (!compte) return badRequest(resultat.raison === "epuise" ? ERREUR_EPUISE : ERREUR_CODE, 401);

    const response = ok({
      kind: "client",
      account: {
        id: compte.id,
        email: compte.email,
        name: compte.name,
        accountType: compte.accountType,
        portalIdentifier: compte.portalIdentifier,
        clientAccess: compte.clientAccess || {}
      }
    });
    setSessionCookie(response, "portal", issuePortalToken(compte.id));
    return response;
  } catch (error) {
    log.fail(error);
    return badRequest("Erreur serveur.", 500);
  }
}
