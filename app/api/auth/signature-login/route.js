import { badRequest, ok } from "../../../../lib/http";
import { readDb } from "../../../../lib/db";

export async function POST(request) {
  const body = await request.json();
  const identifier = String(body.identifier || "").trim();
  const password = String(body.password || "").trim();

  if (!identifier || !password) return badRequest("Identifiant et mot de passe obligatoires.");

  const db = await readDb();
  const quote = (db.quotes || []).find(
    (q) => q.signatureAccessIdentifier && q.signatureAccessIdentifier.toLowerCase() === identifier.toLowerCase()
  );

  if (!quote) return badRequest("Identifiant ou mot de passe incorrect.", 401);
  if (quote.signatureAccessPassword !== password) return badRequest("Identifiant ou mot de passe incorrect.", 401);

  const expiresAt = quote.signatureClientAccess?.expiresAt;
  if (expiresAt && new Date(expiresAt) < new Date()) {
    return badRequest("Ce lien a expiré. Demandez un nouveau lien à votre artisan.", 410);
  }

  return ok({ signatureToken: quote.signatureToken, quoteNumber: quote.quoteNumber });
}
