import { badRequest, ok } from "../../../../lib/http";
import { readUsers, writeUsers } from "../../../../lib/particulier-users";

// Ne touche que les comptes (lib/particulier-users.js, 4 oct) — saute le
// gros bloc partage koji_web_state, inutile ici.
export async function GET(request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return badRequest("Token d'activation manquant", 400);

  const users = await readUsers();
  const user = users.find((candidate) => candidate.activationToken === token);
  if (!user) return badRequest("Lien d'activation invalide", 404);

  if (user.isActive) {
    return ok({ activated: true, alreadyActive: true, message: "Compte deja active.", accountType: user.accountType || "entreprise" });
  }

  if (user.activationExpiresAt && new Date(user.activationExpiresAt).getTime() < Date.now()) {
    return badRequest("Lien d'activation expire", 410);
  }

  user.isActive = true;
  user.activationToken = null;
  user.activationExpiresAt = null;
  try { await writeUsers(users); } catch { /* non-fatal on read-only filesystems */ }
  return ok({ activated: true, alreadyActive: false, message: "Compte active avec succes.", accountType: user.accountType || "entreprise" });
}

