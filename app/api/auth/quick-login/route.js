import { badRequest, ok } from "../../../../lib/http";
import { nowIso } from "../../../../lib/auth";
import { publicUser, readDb, writeDb } from "../../../../lib/db";

export async function POST(request) {
  const body = await request.json();
  const email = String(body.email || "").trim().toLowerCase();
  const accountType = body.accountType === "particulier" ? "particulier" : "entreprise";

  if (!email) return badRequest("E-mail obligatoire", 400);

  const db = await readDb();
  const userByType = db.users.find(
    (candidate) =>
      candidate.email.toLowerCase() === email &&
      (candidate.accountType || "entreprise") === accountType
  );
  const user = userByType || db.users.find((candidate) => candidate.email.toLowerCase() === email);

  if (!user) {
    return badRequest("Compte introuvable. Creez un compte d'abord.", 404);
  }

  if (!user.isActive) {
    user.isActive = true;
  }

  user.lastLoginAt = nowIso();
  await writeDb(db);

  return ok({ user: publicUser(user), token: `demo-token-${user.id}` });
}
