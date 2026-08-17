import { badRequest, ok } from "../../../../lib/http";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { mapQuote } from "../../../../lib/quote-mapping";
import { hashPassword, verifyHashedPassword } from "../../../../lib/password-hash";
import { checkRateLimit, clearRateLimit, rateLimitMessage, recordFailedAttempt } from "../../../../lib/rate-limit";

const SCOPE = "signature-login";

// Same as the other public signature routes: the client isn't a Koji session,
// so this looks the quote up across all users via the service_role key.
export async function POST(request) {
  const body = await request.json();
  const identifier = String(body.identifier || "").trim();
  const password = String(body.password || "").trim();

  if (!identifier || !password) return badRequest("Identifiant et mot de passe obligatoires.");

  const limit = await checkRateLimit(SCOPE, identifier);
  if (!limit.allowed) return ok({ error: rateLimitMessage(limit.retryAfterSeconds) }, 429);

  const supabase = getSupabaseAdmin();
  const { data: row, error } = await supabase
    .from("quotes")
    .select("*")
    .ilike("web_extras->>signatureAccessIdentifier", identifier)
    .maybeSingle();
  if (error) return badRequest(`Lecture impossible: ${error.message}`, 500);
  if (!row) {
    await recordFailedAttempt(SCOPE, identifier);
    return badRequest("Identifiant ou mot de passe incorrect.", 401);
  }

  const quote = mapQuote(row);
  const hasHash = Boolean(quote.signatureAccessPasswordHash && quote.signatureAccessPasswordSalt);
  const validHash = hasHash && verifyHashedPassword(password, quote.signatureAccessPasswordSalt, quote.signatureAccessPasswordHash);
  // Legacy plaintext access (predating hashing): accept once, then migrate
  // this quote's row to a hash and drop the plaintext field.
  const validLegacyPlaintext = !hasHash && quote.signatureAccessPassword === password;
  if (!validHash && !validLegacyPlaintext) {
    await recordFailedAttempt(SCOPE, identifier);
    return badRequest("Identifiant ou mot de passe incorrect.", 401);
  }
  await clearRateLimit(SCOPE, identifier);

  if (validLegacyPlaintext) {
    const { salt, hash } = hashPassword(password);
    await supabase
      .from("quotes")
      .update({
        web_extras: {
          ...row.web_extras,
          signatureAccessPassword: "",
          signatureAccessPasswordHash: hash,
          signatureAccessPasswordSalt: salt
        }
      })
      .eq("id", row.id);
  }

  const expiresAt = quote.signatureClientAccess?.expiresAt;
  if (expiresAt && new Date(expiresAt) < new Date()) {
    return badRequest("Ce lien a expiré. Demandez un nouveau lien à votre artisan.", 410);
  }

  return ok({ signatureToken: quote.signatureToken, quoteNumber: quote.quoteNumber });
}
