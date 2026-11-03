import { badRequest, ok } from "../../../../lib/http";
import { getVerifiedUserId } from "../../../../lib/server-auth";
import { getSupabaseAdmin } from "../../../../lib/supabase";

// Enregistre un token FCM/APNs pour l'utilisateur connecte.
// Body: { deviceToken, platform: 'android'|'ios'|'web' }
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const userId = await getVerifiedUserId(request, body);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const deviceToken = String(body.deviceToken || "").trim();
  const platform = String(body.platform || "").trim();
  if (!deviceToken) return badRequest("deviceToken requis.");
  if (!["android", "ios", "web"].includes(platform)) return badRequest("platform invalide.");

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("device_tokens")
      .upsert(
        { user_id: userId, device_token: deviceToken, platform, updated_at: new Date().toISOString() },
        { onConflict: "user_id,device_token" }
      );
    if (error) return badRequest(`Enregistrement impossible: ${error.message}`, 500);
    return ok({ success: true });
  } catch (err) {
    return badRequest("Erreur serveur.", 500);
  }
}
