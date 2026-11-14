import { badRequest, ok } from "../../../../lib/http";
import { getAuth, getVerifiedUserId } from "../../../../lib/server-auth";
import { fixText } from "../../../../lib/text";
import { sendClientMessageEmail } from "../../../../lib/mailer";
import { nomFichierDevis } from "../../../../lib/devis-envoi";
import { acompteAPartirDu, finRetractation } from "../../../../lib/signature-lieu";
import { estTauxReduit } from "../../../../lib/tva";

// Faire signer sur place depuis l'app Koji Pro (maquette PRO-03.7). Les
// devis de l'app gardent leurs lignes dans quote_rooms / quote_tasks : on
// ne passe donc jamais par PATCH /api/quotes (quoteToRow écraserait la
// metadata). Même enregistrement que koji-signature (status « accepte »,
// signed_at, signature_data) et, dans web_extras, ce que le site lit :
// lieu, cases cochées par le client et horodatées, fin du délai de
// rétractation, acompte bloqué, démarrage demandé. Exemplaire du client par
// e-mail (PDF fait par l'app) s'il l'a demandé.
const PDF_MAX = 8 * 1024 * 1024;
const emailValide = (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim()) ? String(v).trim() : "");

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const auth = getAuth(request, body);
  if (!auth) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const userId = await getVerifiedUserId(request, body);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const id = String(body.quoteId || "").trim();
  if (!id) return badRequest("Devis manquant.");
  const { data: row, error } = await auth.supabase
    .from("quotes")
    .select("id, user_id, status, signed_at, reference, metadata, web_extras, tva_rate")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return badRequest("Devis introuvable.", 500);
  if (!row) return badRequest("Devis introuvable.", 404);
  const extras = row.web_extras || {};
  if (row.signed_at || extras.signatureStatus === "Signe" || String(row.status || "").toLowerCase() === "accepte") {
    return badRequest("Ce devis est déjà signé.", 409);
  }

  const image = String(body.signature || "");
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(image) || image.length > 400000) return badRequest("La signature du client manque.");
  const lieu = body.lieu === "locaux" ? "locaux" : "domicile";
  const metadata = row.metadata || {};
  const recap = metadata.recap || {};
  const clientTva = String(recap.tva?.client || "");
  const clientType = extras.clientType === "societe" || ["entreprise", "sous-traitance"].includes(clientTva) ? "societe" : "particulier";
  const taux = extras.vatRate != null ? Number(extras.vatRate) : recap.tvaRate != null ? Number(recap.tvaRate) : Number(row.tva_rate ?? 20);
  const reduit = recap.autoliquidation !== true && extras.autoliquidation !== true && estTauxReduit(taux);
  const c = body.consentements && typeof body.consentements === "object" ? body.consentements : {};
  if (reduit && !c.mentionTva) return badRequest("Pour la TVA à taux réduit, le client doit certifier la mention avant de signer.");

  const now = new Date().toISOString();
  const horodate = (coche, le) => (coche ? (Number.isFinite(new Date(le).getTime()) && Math.abs(Date.now() - new Date(le).getTime()) < 3 * 3600000 ? new Date(le).toISOString() : now) : "");
  const jour = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(now));
  const consentements = {
    demandeExpresse: horodate(c.demandeExpresse, c.demandeExpresseLe),
    mentionTva: horodate(c.mentionTva, c.mentionTvaLe),
    exemplaireEmail: horodate(c.exemplaireEmail, c.exemplaireEmailLe)
  };
  const debut = String(body.debut || metadata.travauxStart || "").slice(0, 10);
  const signes = {
    signatureStatus: "Signe",
    signatureProvider: "sur-place",
    signatureLieu: lieu,
    signerName: fixText(String(body.signerName || metadata.client?.name || "Client")).slice(0, 120),
    signedAt: now,
    consentements,
    retractationJusquau: finRetractation(jour, lieu, clientType),
    acompteAPartirDu: acompteAPartirDu(jour, lieu, clientType),
    demarrageDemande: consentements.demandeExpresse && /^\d{4}-\d{2}-\d{2}$/.test(debut) ? debut : "",
    ...(reduit ? { mentionTva: true, mentionTvaLe: consentements.mentionTva } : {})
  };
  const { error: majErreur } = await auth.supabase
    .from("quotes")
    .update({ status: "accepte", signed_at: now, signature_data: image, web_extras: { ...extras, ...signes }, updated_at: now })
    .eq("id", id)
    .eq("user_id", userId);
  if (majErreur) return badRequest("La signature n'a pas pu être enregistrée.", 500);

  // Exemplaire du client : par e-mail s'il a coché la case (PDF de l'app,
  // avec l'information et le formulaire de rétractation).
  let exemplaire = null;
  const adresse = emailValide(metadata.client?.email);
  if (consentements.exemplaireEmail && adresse) {
    const pdf = Buffer.from(String(body.pdfBase64 || ""), "base64");
    const pdfValide = pdf.length > 4 && pdf.length <= PDF_MAX && pdf.subarray(0, 4).toString("latin1") === "%PDF";
    const numero = metadata.quoteNumber || row.reference || "";
    const le = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long", year: "numeric" }).format(new Date(now));
    const resultat = await sendClientMessageEmail({
      to: adresse,
      subject: `Votre devis signé ${numero}`.trim(),
      message: [
        `Bonjour ${signes.signerName},`,
        "",
        `Voici votre exemplaire du devis ${numero}, signé le ${le}.`,
        signes.retractationJusquau ? "Vous y trouverez l'information sur votre droit de rétractation et le formulaire à utiliser si vous souhaitez annuler." : "",
        "",
        fixText(metadata.company?.name || "")
      ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n").trim(),
      replyTo: emailValide(metadata.company?.email) || undefined,
      attachments: pdfValide ? [{ filename: nomFichierDevis(numero, metadata.client?.name), content: pdf, contentType: "application/pdf" }] : undefined
    }).catch((err) => ({ ok: false, error: err.message }));
    exemplaire = { email: Boolean(resultat?.ok), erreur: resultat?.ok ? "" : resultat?.error || "L'e-mail n'est pas parti." };
  }

  return ok({ ok: true, ...signes, exemplaire });
}
