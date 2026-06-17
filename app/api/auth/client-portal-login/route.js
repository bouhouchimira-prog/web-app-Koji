import { badRequest, ok } from "../../../../lib/http";
import { readDb } from "../../../../lib/db";

export async function POST(request) {
  const body = await request.json();
  const identifier = String(body.identifier || "").trim();
  const password = String(body.password || "").trim();

  if (!identifier || !password) return badRequest("Identifiant et mot de passe obligatoires.");

  const db = await readDb();
  const user = db.users.find((u) =>
    u.accountType === "particulier" &&
    (
      (u.portalIdentifier || "").toLowerCase() === identifier.toLowerCase() ||
      (u.email || "").toLowerCase() === identifier.toLowerCase()
    )
  );

  if (!user) return badRequest("Identifiant ou mot de passe incorrect.", 401);
  if (user.password !== password) return badRequest("Identifiant ou mot de passe incorrect.", 401);

  return ok({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      accountType: user.accountType,
      portalIdentifier: user.portalIdentifier,
      clientAccess: user.clientAccess || {}
    }
  });
}
