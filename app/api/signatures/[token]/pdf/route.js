import { NextResponse } from "next/server";
import { badRequest } from "../../../../../lib/http";
import { getSupabaseAdmin } from "../../../../../lib/supabase";
import { getVerifiedSignatureToken } from "../../../../../lib/signature-session";
import { pdfDevisServeur } from "../../../../../lib/devis-pdf-serveur";
import { nomFichierDevis } from "../../../../../lib/devis-envoi";

// « Télécharger le PDF » de la page publique de signature (maquette CLI-07) :
// le devis tel qu'il est enregistré (signé ou non), seulement avec la
// session de signature ouverte par l'identifiant et le mot de passe.
export async function GET(request, context) {
  const { token } = await context.params;
  if (!token || !getVerifiedSignatureToken(request, token)) {
    return badRequest("Session de signature expirée. Reconnectez-vous avec vos identifiants.", 401);
  }
  const { data: row, error } = await getSupabaseAdmin()
    .from("quotes")
    .select("*")
    .eq("web_extras->>signatureToken", token)
    .maybeSingle();
  if (error) return badRequest("Lecture du devis impossible.", 500);
  if (!row) return badRequest("Lien de signature invalide.", 404);
  const pdf = await pdfDevisServeur(row);
  const metadata = row.metadata || {};
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nomFichierDevis(metadata.quoteNumber || row.reference, metadata.client?.name)}"`,
      "Cache-Control": "private, no-store"
    }
  });
}
