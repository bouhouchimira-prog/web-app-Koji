import { badRequest, ok } from "../../../../lib/http";
import { makeResetToken, resetExpires } from "../../../../lib/auth";
import { readDb, writeDb } from "../../../../lib/db";
import { queueResetPasswordEmail } from "../../../../lib/mailer";

export async function POST(request) {
  const body = await request.json();
  const email = String(body.email || "").trim().toLowerCase();
  const accountType = body.accountType === "particulier" ? "particulier" : "entreprise";

  if (!email) return badRequest("Adresse e-mail obligatoire");

  const db = await readDb();
  const userByType = db.users.find(
    (candidate) =>
      candidate.email.toLowerCase() === email &&
      (candidate.accountType || "entreprise") === accountType
  );
  const user = userByType || db.users.find((candidate) => candidate.email.toLowerCase() === email);

  if (!user) {
    return ok({ message: "Si ce compte existe, un e-mail a été envoyé." });
  }

  const token = makeResetToken();
  const resetUrl = `${new URL(request.url).origin}/set-password?mode=reset&type=${user.accountType || accountType}&token=${token}`;

  user.resetPasswordToken = token;
  user.resetPasswordExpiresAt = resetExpires(2);
  await writeDb(db);

  const queued = await queueResetPasswordEmail({
    email: user.email,
    name: user.name || user.email.split("@")[0] || "Utilisateur",
    resetUrl,
    accountType: user.accountType || accountType
  });

  return ok({
    message: "Si ce compte existe, un e-mail a été envoyé.",
    devResetUrl: resetUrl,
    mailQueued: queued.id
  });
}
