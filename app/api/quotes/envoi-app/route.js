import { badRequest, ok } from "../../../../lib/http";
import { getAuth, getVerifiedUserId } from "../../../../lib/server-auth";
import { fixText } from "../../../../lib/text";
import { sendQuoteToClientEmail } from "../../../../lib/mailer";
import { nomFichierDevis } from "../../../../lib/devis-envoi";
import { checkTrialSendLimit, persistTrialPatch } from "../../../../lib/plan";
import { buildWebUser } from "../../../../lib/user-profile";

// Envoyer le devis depuis l'app Koji Pro (maquette PRO-03.2). Les devis de
// l'app rangent leurs lignes dans quote_rooms / quote_tasks (pas dans
// `items` comme le site) : l'app fabrique donc son PDF elle-même et le
// joint ici. Le lien de signature et les identifiants ne viennent jamais
// de l'app : ils sont relus sur le devis (access_code / access_password,
// metadata.signature_url), pour que le mailer de Koji n'envoie que des
// liens de Koji. Le devis passe « Envoyé », e-mail ou non.
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
    .select("id, user_id, status, reference, metadata, web_extras, access_code, access_password")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return badRequest("Devis introuvable.", 500);
  if (!row) return badRequest("Devis introuvable.", 404);

  const extras = row.web_extras || {};
  if (extras.signatureStatus === "Signe" && body.confirmReopenSigned !== true) {
    return badRequest("Ce devis est déjà signé. Le renvoyer effacerait la signature existante.", 409);
  }

  const { data: profil } = await auth.supabase.from("users").select("email, business_info").eq("id", userId).maybeSingle();
  const gate = checkTrialSendLimit(buildWebUser({ id: userId, email: profil?.email || "", profile: profil }), { id });
  if (!gate.allowed) return badRequest(gate.reason, 402);

  const metadata = row.metadata || {};
  const client = metadata.client || {};
  const adresse = emailValide(body.to || client.email);
  const telephone = fixText(String(body.telephone || client.phone || "")).trim();
  const kojiClient = body.kojiClient !== false;
  const numero = metadata.quoteNumber || row.reference || "";

  let emailSent = null;
  let emailError = "";
  if (body.envoyerEmail === true) {
    if (!adresse) return badRequest("E-mail du client manquant.");
    const pdf = Buffer.from(String(body.pdfBase64 || ""), "base64");
    if (pdf.length > PDF_MAX) return badRequest("PDF trop lourd.");
    const pdfValide = pdf.length > 4 && pdf.subarray(0, 4).toString("latin1") === "%PDF";
    const replyTo = emailValide(metadata.company?.email) || emailValide(profil?.email) || undefined;
    const resultat = await sendQuoteToClientEmail({
      to: adresse,
      subject: fixText(body.subject || `Devis ${numero}`),
      message: fixText(body.message || ""),
      quoteNumber: numero,
      pdfBuffer: pdfValide ? pdf : null,
      pdfFilename: nomFichierDevis(numero, client.name),
      signatureUrl: metadata.signature_url || "",
      identifier: row.access_code || "",
      password: row.access_password || "",
      includePdf: pdfValide,
      includeSignatureLink: kojiClient && Boolean(metadata.signature_url),
      includeCredentials: kojiClient && Boolean(row.access_code),
      replyTo
    }).catch((err) => ({ ok: false, error: err.message }));
    emailSent = Boolean(resultat?.ok);
    emailError = resultat?.ok ? "" : resultat?.error || "L'e-mail n'est pas parti.";
  }

  const now = new Date().toISOString();
  const versions = Number.parseInt(extras.versionNumber || "001", 10) || 1;
  const { error: majErreur } = await auth.supabase
    .from("quotes")
    .update({
      status: "Envoye",
      metadata: { ...metadata, client: { ...client, ...(adresse ? { email: adresse } : {}), ...(telephone ? { phone: telephone } : {}) } },
      web_extras: {
        ...extras,
        sentAt: now,
        viewedAt: "",
        signatureStatus: "En attente",
        signatureProvider: "koji-signature",
        envoi: { kojiClient, email: body.envoyerEmail === true, sms: body.sms === true },
        ...(extras.sentAt ? { versionNumber: String(versions + 1).padStart(3, "0") } : {})
      },
      updated_at: now
    })
    .eq("id", id)
    .eq("user_id", userId);
  if (majErreur) return badRequest("Le devis n'a pas pu être marqué envoyé.", 500);
  if (gate.claim) await persistTrialPatch(auth.supabase, userId, { _trialQuoteId: id });

  return ok({
    ok: true,
    sentAt: now,
    emailSent,
    emailError,
    // Pour le SMS ouvert sur le téléphone de l'artisan.
    signature: kojiClient
      ? { lien: metadata.signature_url || "", identifiant: row.access_code || "", motDePasse: row.access_password || "" }
      : null
  });
}
