import { ok, badRequest } from "../../../../../lib/http";
import { fixText } from "../../../../../lib/text";
import { getSupabaseAdmin } from "../../../../../lib/supabase";
import { mapQuote } from "../../../../../lib/quote-mapping";
import { getVerifiedSignatureToken, signatureAccessExpired } from "../../../../../lib/signature-session";
import { retracterDevis } from "../../../../../lib/retractation-devis";

// « Me rétracter » (maquette PRO-03.7) depuis le lien de signature : session
// de signature vérifiée, puis le même enregistrement que l'espace Koji
// Client (lib/retractation-devis.js).
export async function POST(request, context) {
  const { token } = await context.params;
  if (!token) return badRequest("Lien de signature invalide.", 404);
  if (!getVerifiedSignatureToken(request, token)) {
    return badRequest("Session de signature expirée. Reconnectez-vous avec vos identifiants.", 401);
  }
  const supabase = getSupabaseAdmin();
  const { data: row, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("web_extras->>signatureToken", token)
    .maybeSingle();
  if (error) return badRequest("Rétractation impossible pour le moment.", 500);
  if (!row) return badRequest("Lien de signature invalide.", 404);
  if (signatureAccessExpired(mapQuote(row))) return badRequest("Ce lien a expiré. Demandez un nouveau lien à votre artisan.", 410);

  const resultat = await retracterDevis(row, { origine: "lien" });
  if (resultat.erreur) return badRequest(resultat.erreur, resultat.code);
  return ok({ quote: vuClient(resultat.quote) });
}

// Ce que la page de signature relit après la rétractation.
function vuClient(q) {
  return {
    id: q.id,
    quoteNumber: q.quoteNumber,
    client: fixText(q.client),
    status: q.status,
    signatureStatus: q.signatureStatus,
    signedAt: q.signedAt,
    signerName: q.signerName,
    clientType: q.clientType,
    retractationJusquau: q.retractationJusquau,
    retracteLe: q.retracteLe,
    demarrageDemande: q.demarrageDemande,
    items: q.items || [],
    rooms: q.rooms || [],
    totalHt: q.totalHt,
    totalTtc: q.totalTtc
  };
}
