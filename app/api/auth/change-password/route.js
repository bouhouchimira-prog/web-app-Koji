import { badRequest, ok } from "../../../../lib/http";
import { getAccessToken } from "../../../../lib/server-auth";
import { getSupabase, getSupabaseAdmin } from "../../../../lib/supabase";

// Changer son mot de passe une fois connecte (16 oct, demande d'Amira) — les
// comptes entreprise n'avaient que le parcours "mot de passe oublie" par
// email ; aucun moyen de le changer depuis le Profil. Le mot de passe actuel
// est redemande et verifie reellement (tentative de connexion), pas
// seulement accepte tel quel — meme principe que le correctif applique au
// meme moment sur app/api/client/profile/route.js (comptes particulier).
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const currentPassword = String(body.currentPassword || "");
  const newPassword = String(body.newPassword || "");

  if (newPassword.length < 8) return badRequest("Le nouveau mot de passe doit contenir au moins 8 caractères.");

  const token = getAccessToken(request, body);
  if (!token) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const supabase = getSupabase();
  const { data: tokenUser, error: tokenError } = await supabase.auth.getUser(token);
  if (tokenError || !tokenUser?.user?.id || !tokenUser.user.email) {
    return badRequest("Session expirée. Reconnectez-vous.", 401);
  }

  if (!currentPassword) return badRequest("Mot de passe actuel requis.");
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: tokenUser.user.email,
    password: currentPassword
  });
  if (verifyError) return badRequest("Mot de passe actuel incorrect.", 403);

  const admin = getSupabaseAdmin();
  const { error: updateError } = await admin.auth.admin.updateUserById(tokenUser.user.id, { password: newPassword });
  if (updateError) return badRequest(updateError.message || "Impossible de changer le mot de passe.", 400);

  return ok({ message: "Mot de passe modifié avec succès." });
}
