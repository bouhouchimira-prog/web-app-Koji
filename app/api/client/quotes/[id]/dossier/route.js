import { NextResponse } from "next/server";
import { badRequest } from "../../../../../../lib/http";
import { readDb } from "../../../../../../lib/db";
import { getSupabaseAdmin } from "../../../../../../lib/supabase";
import { mapQuote } from "../../../../../../lib/quote-mapping";
import { getVerifiedPortalUserId } from "../../../../../../lib/portal-session";
import { fixObjectText } from "../../../../../../lib/text";
import { normalizeEmail, quoteBelongsToClient } from "../../../../../../lib/portal-acces";
import { assemblerDossier } from "../../../../../../lib/dossier-fin-serveur";

// Dossier de fin de chantier dans l'espace Koji Client (PRO-02.5) : le
// client le retrouve à tout moment une fois que l'entreprise le lui a remis.

export async function GET(request, context) {
  const { id } = await context.params;
  const userId = getVerifiedPortalUserId(request);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const db = await readDb();
  const user = db.users.find((entry) => entry.id === userId);
  if (!user) return badRequest("Profil client introuvable.", 404);

  const supabase = getSupabaseAdmin();
  const { data: row } = await supabase.from("quotes").select("*").eq("id", id).maybeSingle();
  if (!row) return badRequest("Devis introuvable.", 404);
  const quote = fixObjectText(mapQuote(row));
  const { data: chantier } = quote.projectId ? await supabase.from("chantiers").select("*").eq("id", quote.projectId).maybeSingle() : { data: null };
  if (!chantier || !quoteBelongsToClient(quote, { clientEmail: chantier.client_email || "" }, user, normalizeEmail(user.email))) {
    return badRequest("Devis introuvable pour ce profil client.", 404);
  }

  const cloture = (db.clotures || []).find((c) => c.projectId === chantier.id && c.userId === chantier.user_id && c.dossier?.remisLe);
  if (!cloture) return badRequest("Le dossier de fin de chantier n'est pas encore remis.", 404);

  const { pdf, filename } = await assemblerDossier(db, chantier.user_id, chantier);
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store"
    }
  });
}
