import { badRequest, ok } from "../../../../lib/http";
import { getVerifiedUserId } from "../../../../lib/server-auth";
import { isVerifiedUserAdmin } from "../../../../lib/admin-account";
import { getSupabaseAdmin } from "../../../../lib/supabase";

// Envoie une notification push a un utilisateur (admin only).
// Body: { userId, title, body, data? }
//
// L'envoi reel utilise firebase-admin (FCM). Necessite la variable
// d'environnement FIREBASE_SERVICE_ACCOUNT (JSON du service account).
// Si elle est absente, la route renvoie les tokens cibles sans envoyer
// (mode dry-run pour le developpement).
let firebaseAdmin = null;
function getFirebaseAdmin() {
  if (firebaseAdmin) return firebaseAdmin;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const admin = require("firebase-admin");
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
    }
    firebaseAdmin = admin;
    return admin;
  } catch (err) {
    console.error("Firebase admin init error:", err);
    return null;
  }
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const verifiedUserId = await getVerifiedUserId(request, body);
  if (!verifiedUserId) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const isAdmin = await isVerifiedUserAdmin(verifiedUserId);
  if (!isAdmin) return badRequest("Accès réservé à l'administrateur.", 403);

  const userId = String(body.userId || "").trim();
  const title = String(body.title || "").trim();
  const message = String(body.body || "").trim();
  const data = body.data && typeof body.data === "object" ? body.data : {};
  if (!userId || !title || !message) return badRequest("userId, title et body requis.");

  try {
    const supabase = getSupabaseAdmin();
    const { data: tokens, error } = await supabase
      .from("device_tokens")
      .select("device_token, platform")
      .eq("user_id", userId);
    if (error) return badRequest(`Lecture des tokens impossible: ${error.message}`, 500);

    const targetTokens = (tokens || []).map((t) => t.device_token).filter(Boolean);
    if (targetTokens.length === 0) {
      return ok({ success: true, sent: 0, message: "Aucun token enregistré pour cet utilisateur." });
    }

    const admin = getFirebaseAdmin();
    if (!admin) {
      return ok({
        success: true,
        sent: 0,
        targetedTokens: targetTokens.length,
        note: "FIREBASE_SERVICE_ACCOUNT absent — mode dry-run, aucun envoi réel."
      });
    }

    const response = await admin.messaging().sendEachForMulticast({
      tokens: targetTokens,
      notification: { title, body: message },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
    });

    // Nettoyage des tokens invalides
    const invalid = [];
    response.responses.forEach((r, i) => {
      if (!r.success && r.error?.code === "messaging/registration-token-not-registered") {
        invalid.push(targetTokens[i]);
      }
    });
    if (invalid.length > 0) {
      await supabase.from("device_tokens").delete().in("device_token", invalid);
    }

    return ok({
      success: true,
      sent: response.successCount,
      failed: response.failureCount,
      invalidRemoved: invalid.length
    });
  } catch (err) {
    return badRequest("Erreur serveur.", 500);
  }
}
