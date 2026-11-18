import { badRequest, ok } from "../../../../lib/http";
import { readDb } from "../../../../lib/db";
import { getVerifiedPortalUserId } from "../../../../lib/portal-session";
import { chargerDevis, devisDuClient } from "../../../../lib/projets-client-serveur";

// The client (particulier) portal has no Supabase session of its own — quotes
// belong to the company's Supabase user_id, so RLS would hide them from a
// normal per-user client. This reads via the service_role key and filters in
// JS, mirroring the same "does this quote belong to this client" checks the
// local-JSON version used before the Supabase migration.
//
// 18 nov. : la lecture et le tri sont dans lib/projets-client-serveur.js
// (partagés avec « Mes projets », CLI-01). Le mot de passe du portail de
// signature, son empreinte et son sel ne sont plus renvoyés au navigateur.
export async function GET(request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "";

  // This used to accept a plain ?email= with no proof of identity — anyone who
  // knew (or guessed) a client's email could read their quotes, including the
  // signature portal password embedded in them. Now it requires the signed
  // token issued at client-portal-login instead.
  const userId = getVerifiedPortalUserId(request);
  if (!userId) return ok({ quotes: [] });

  const db = await readDb();
  const user = db.users.find((entry) => entry.id === userId);
  if (!user) return ok({ quotes: [] });

  let clientQuotes;
  try {
    clientQuotes = devisDuClient(db, user, await chargerDevis());
  } catch (error) {
    return badRequest(error.message, 500);
  }

  if (id) {
    const quote = clientQuotes.find((entry) => entry.id === id);
    if (!quote) return badRequest("Devis introuvable pour ce profil client.", 404);
    return ok({ quote });
  }

  return ok({ quotes: clientQuotes });
}
