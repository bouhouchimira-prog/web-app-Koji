import { badRequest, ok } from "../../../../lib/http";
import { getVerifiedUserId } from "../../../../lib/server-auth";
import { isVerifiedUserAdmin } from "../../../../lib/admin-account";
import { getSupabaseAdmin } from "../../../../lib/supabase";

// Envoie une notification push a un utilisateur (admin only).
// Body: { userId, title, body, data? }
// Note: l'envoi reel via FCM/APNs necessite firebase-admin (non installe).
// Cette route enregistre la demande et renvoie les tokens cibles ; l'envoi
// reel sera branche quand firebase-admin sera ajoute aux dependances.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const verifiedUserId = await getVerifiedUserId(request, body);
  if (!verifiedUserId) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const isAdmin = await isVerifiedUserAdmin(verifiedUserId);
  if (!isAdmin) return badRequest("Accès réservé à l'administrateur.", 403);

  const userId = String(body.userId || "").trim();
  const title = String(body.title || "").trim();
  const message = String(body.body || "").trim();
  if (!userId || !title || !message) return badRequest("userId, title et body requis.");

  try {
    const supabase = getSupabaseAdmin();
    const { data: tokens, error } = await supabase
      .from("device_tokens")
      .select("device_token, platform")
      .eq("user_id", userId);
    if (error) return badRequest(`Lecture des tokens impossible: ${error.message}`, 500);

    // TODO: envoyer via firebase-admin (FCM) / APNs avec les tokens ci-dessous.
    // Pour l'instant, on renvoie les tokens cibles pour verification.
    return ok({
      success: true,
      targetedTokens: (tokens || []).map((t) => ({ platform: t.platform, token: t.device_token })),
      note: "Envoi reel a brancher avec firebase-admin (dependance a ajouter)."
    });
  } catch (err) {
    return badRequest("Erreur serveur.", 500);
  }
}
