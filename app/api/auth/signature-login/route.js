import { badRequest, ok } from "../../../../lib/http";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { mapQuote } from "../../../../lib/quote-mapping";

// Same as the other public signature routes: the client isn't a Kôji session,
// so this looks the quote up across all users via the service_role key.
export async function POST(request) {
  const body = await request.json();
  const identifier = String(body.identifier || "").trim();
  const password = String(body.password || "").trim();

  if (!identifier || !password) return badRequest("Identifiant et mot de passe obligatoires.");

  const supabase = getSupabaseAdmin();
  const { data: row, error } = await supabase
    .from("quotes")
    .select("*")
    .ilike("web_extras->>signatureAccessIdentifier", identifier)
    .maybeSingle();
  if (error) return badRequest(`Lecture impossible: ${error.message}`, 500);
  if (!row) return badRequest("Identifiant ou mot de passe incorrect.", 401);

  const quote = mapQuote(row);
  if (quote.signatureAccessPassword !== password) return badRequest("Identifiant ou mot de passe incorrect.", 401);

  const expiresAt = quote.signatureClientAccess?.expiresAt;
  if (expiresAt && new Date(expiresAt) < new Date()) {
    return badRequest("Ce lien a expiré. Demandez un nouveau lien à votre artisan.", 410);
  }

  return ok({ signatureToken: quote.signatureToken, quoteNumber: quote.quoteNumber });
}
