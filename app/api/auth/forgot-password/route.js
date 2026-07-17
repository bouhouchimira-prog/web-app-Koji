import { badRequest, ok } from "../../../../lib/http";
import { getSupabase } from "../../../../lib/supabase";

// Password reset goes through Supabase Auth: it emails a recovery link that
// lands on /set-password with the session tokens in the URL hash.
export async function POST(request) {
  const body = await request.json();
  const email = String(body.email || "").trim().toLowerCase();
  const accountType = body.accountType === "particulier" ? "particulier" : "entreprise";

  if (!email) return badRequest("Adresse e-mail obligatoire");

  const supabase = getSupabase();
  const redirectTo = `${new URL(request.url).origin}/set-password?mode=reset&type=${accountType}`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  // Same neutral answer whether or not the account exists (and on rate limits),
  // to avoid leaking which emails are registered.
  if (error && !/rate limit/i.test(String(error.message))) {
    console.warn(`resetPasswordForEmail failed: ${error.message}`);
  }
  return ok({ message: "Si ce compte existe, un e-mail a été envoyé." });
}
