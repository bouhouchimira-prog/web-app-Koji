import { badRequest, ok } from "../../../../lib/http";
import { readDb, writeDb } from "../../../../lib/db";

export async function GET(request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return badRequest("Token d'activation manquant", 400);

  const db = await readDb();
  const user = db.users.find((candidate) => candidate.activationToken === token);
  if (!user) return badRequest("Lien d'activation invalide", 404);

  if (user.isActive) {
    return ok({ activated: true, alreadyActive: true, message: "Compte deja active." });
  }

  if (user.activationExpiresAt && new Date(user.activationExpiresAt).getTime() < Date.now()) {
    return badRequest("Lien d'activation expire", 410);
  }

  user.isActive = true;
  user.activationToken = null;
  user.activationExpiresAt = null;
  try { await writeDb(db); } catch { /* non-fatal on read-only filesystems */ }
  return ok({ activated: true, alreadyActive: false, message: "Compte active avec succes." });
}

