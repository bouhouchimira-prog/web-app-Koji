import { randomBytes } from "node:crypto";
import { after } from "next/server";
import { ok } from "../../../../lib/http";
import { readDb, writeDb } from "../../../../lib/db";
import { sendParticulierLoginCodeEmail } from "../../../../lib/mailer";
import { logger, requestLogger } from "../../../../lib/logger";
import { adresseNormalisee, cleAdresse, enregistrerDemande, genererCode, nettoyerCodes, peutEnvoyer, MESSAGE_ENVOI } from "../../../../lib/code-particulier";

// « Retrouver mon projet » (maquette CLI-05), étape 1 : demande d'un code
// par e-mail. POST { email } → toujours { envoye: true, message } : la
// réponse ne dit jamais si l'adresse existe, ni si la limite d'envoi est
// atteinte. Le code ne part que vers un compte particulier actif.
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const REPONSE = { envoye: true, message: MESSAGE_ENVOI };

export async function POST(request) {
  const log = requestLogger(request, "POST /api/auth/particulier-code");
  const body = await request.json().catch(() => ({}));
  const email = adresseNormalisee(body.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return ok(REPONSE);

  try {
    const db = await readDb();
    const maintenant = Date.now();
    db.particulierCodes = nettoyerCodes(db.particulierCodes, maintenant);
    const cle = cleAdresse(email, SECRET);
    const entree = db.particulierCodes[cle];
    if (!peutEnvoyer(entree, maintenant).ok) {
      await writeDb(db);
      return ok(REPONSE);
    }

    const compte = (db.users || []).find((u) => u.accountType === "particulier" && u.isActive !== false && adresseNormalisee(u.email) === email);
    const code = compte ? genererCode() : "";
    const sel = compte ? randomBytes(16).toString("hex") : "";
    db.particulierCodes[cle] = enregistrerDemande(entree, { userId: compte?.id || "", code, sel, secret: SECRET, maintenant });
    await writeDb(db);

    // Envoi après la réponse : une adresse connue ne répond pas plus
    // lentement qu'une adresse inconnue (pas d'énumération par le temps).
    if (compte) {
      after(async () => {
        const envoi = await sendParticulierLoginCodeEmail({ email: compte.email, name: compte.personal?.firstName || "", code });
        if (!envoi.ok) logger.warn("particulier-code : e-mail non envoyé", { error: envoi.error });
      });
    }
  } catch (error) {
    log.fail(error);
  }
  return ok(REPONSE);
}
