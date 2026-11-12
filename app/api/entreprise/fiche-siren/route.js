import { badRequest, ok } from "../../../../lib/http";
import { getVerifiedUserId } from "../../../../lib/server-auth";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { chercherEntreprise, normaliserSiren } from "../../../../lib/sirene";

// Fin d'inscription depuis l'app Koji Pro (maquette PRO-00) : l'app crée le
// compte directement dans Supabase Auth, puis appelle cette route avec sa
// session (Bearer) pour enregistrer ce que le site enregistre déjà à
// l'inscription web (app/api/auth/signup) : l'acceptation des conditions et,
// si un SIREN est donné, la fiche entreprise remplie depuis l'annuaire.
// Ne touche que business_info de l'appelant ; n'écrase pas une fiche déjà
// remplie (raison sociale, adresse…) par une valeur de l'annuaire.

// Démarrage guidé (PRO-01.1, étape 1) : la fiche de l'annuaire, sans rien
// enregistrer, pour que l'artisan la confirme (« C'est bien moi »).
export async function GET(request) {
  const userId = await getVerifiedUserId(request);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const siren = normaliserSiren(new URL(request.url).searchParams.get("siren") || "");
  if (!siren) return badRequest("Ce SIREN n'est pas valide : 9 chiffres, sans espace.");
  const fiche = await chercherEntreprise(siren);
  if (!fiche) return badRequest("Aucune entreprise trouvée pour ce SIREN dans l'annuaire.", 404);
  return ok({ fiche });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest("Requête invalide.");
  }
  const userId = await getVerifiedUserId(request, body);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const sirenSaisi = String(body?.siren || "").trim();
  const siren = sirenSaisi ? normaliserSiren(sirenSaisi) : null;
  if (sirenSaisi && !siren) return badRequest("Ce SIREN n'est pas valide : 9 chiffres, sans espace.");
  if (body?.acceptedTerms !== true && !siren) return ok({ fiche: null });

  const admin = getSupabaseAdmin();
  const { data: profil, error } = await admin.from("users").select("business_info").eq("id", userId).maybeSingle();
  if (error || !profil) return badRequest("Profil introuvable.", 404);

  const actuel = profil.business_info || {};
  const fiche = siren ? (await chercherEntreprise(siren)) || { siren } : {};
  const ajouts = Object.fromEntries(Object.entries(fiche).filter(([cle]) => !actuel[cle]));
  if (body?.acceptedTerms === true && !actuel._cguAcceptedAt) ajouts._cguAcceptedAt = new Date().toISOString();

  if (Object.keys(ajouts).length) {
    const { error: majError } = await admin.from("users").update({ business_info: { ...actuel, ...ajouts } }).eq("id", userId);
    if (majError) return badRequest("La fiche n'a pas pu être enregistrée.", 500);
  }
  return ok({ fiche: Object.keys(fiche).length ? fiche : null });
}
