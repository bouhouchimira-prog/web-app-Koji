import { addHistory, readDb, writeDb } from "./db.js";
import { fixText } from "./text.js";
import { ensureChantierForQuote, generateTasksForSignedQuote } from "./quote-projects.js";
import { createPaiementEcheancesForQuote } from "./chantier-paiements.js";
import { recordEstimationAccuracy } from "./estimation-accuracy.js";
import { getSupabaseAdmin } from "./supabase.js";
import { mapQuote, quoteToRow } from "./quote-mapping.js";
import { ensureClientPortalAccess, normalizeEmail } from "./client-portal-access.js";
import { sendClientMessageEmail } from "./mailer.js";
import { nomFichierDevis } from "./devis-envoi.js";
import { pdfDevisServeur } from "./devis-pdf-serveur.js";
import { champsSignes, erreurSignature, preuveDeRequete } from "./signature-devis.js";
import { dateLongue } from "./chantier-client.js";

// Signature en ligne d'un devis par le particulier (PRO-03.5/03.6/03.7,
// maquettes CLI-02 et CLI-07) : un seul enregistrement pour les deux
// chemins — le lien de signature reçu par e-mail (session de signature
// vérifiée, app/api/signatures/[token]) et l'espace Koji Client (session du
// particulier, app/api/client/chantier/[quoteId]/signer). Les règles sont
// dans lib/signature-devis.js.

const emailValide = (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim()) ? String(v).trim() : "");

// Exemplaire du client par e-mail : le devis signé (PDF, avec l'information
// et le formulaire de rétractation pour un particulier).
async function envoyerExemplaire(row, quote) {
  const adresse = emailValide(quote.signerEmail || quote.clientEmail);
  if (!adresse) return { envoye: false };
  const pdf = await pdfDevisServeur(row).catch(() => null);
  const resultat = await sendClientMessageEmail({
    to: adresse,
    subject: `Votre devis signé ${quote.quoteNumber || ""}`.trim(),
    message: [
      `Bonjour ${quote.signerName || ""},`.replace(" ,", ","),
      "",
      `Voici votre exemplaire du devis ${quote.quoteNumber || ""}, signé en ligne le ${dateLongue(quote.signedAt, true)}.`,
      quote.retractationJusquau ? `Vous pouvez vous rétracter sans motif jusqu'au ${dateLongue(quote.retractationJusquau, true)} inclus : l'information et le formulaire sont à la fin du devis.` : "",
      "",
      fixText(quote.company?.name || "")
    ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n").trim(),
    replyTo: emailValide(quote.company?.email) || undefined,
    attachments: pdf ? [{ filename: nomFichierDevis(quote.quoteNumber, quote.signerName || quote.client), content: pdf, contentType: "application/pdf" }] : undefined
  }).catch(() => ({ ok: false }));
  return { envoye: Boolean(resultat?.ok) };
}

// Enregistre la signature. Renvoie { quote, clientAccess, exemplaire } ou
// { erreur, code }. `quote` est le devis déjà lu (mapQuote) ; l'appelant a
// vérifié le droit de signer (session) et que le devis n'est pas expiré.
export async function signerDevisEnLigne({ quote, body = {}, request, origine = "lien" }) {
  const erreur = erreurSignature(quote, body);
  if (erreur) return { erreur, code: 400 };

  const now = new Date().toISOString();
  const updated = {
    ...quote,
    ...champsSignes(quote, body, { now, preuve: preuveDeRequete(request.headers, now), origine, normalizeEmail, fixText })
  };

  const supabase = getSupabaseAdmin();
  const db = await readDb();
  updated.projectId = await ensureChantierForQuote(supabase, updated, now);
  generateTasksForSignedQuote(db, updated, now);
  createPaiementEcheancesForQuote(db, updated, now);
  recordEstimationAccuracy(db, updated, now);
  if (updated.projectId) {
    await supabase.from("chantiers").update({ status: "Signe" }).eq("id", updated.projectId);
  }

  db.notifications.unshift({
    id: `notif-quote-signed-${updated.id}-${Date.now()}`,
    userId: updated.userId || "",
    type: "quote.signed",
    title: "Devis signé",
    message: `Votre devis N° : ${updated.quoteNumber} a été signé par ${updated.signerName || updated.client || "votre client"}.`,
    quoteId: updated.id,
    projectId: updated.projectId || "",
    actionUrl: `/devis?id=${updated.id}`,
    actionLabel: "Voir le devis",
    meta: { signerName: updated.signerName || "", quoteNumber: updated.quoteNumber || "" },
    read: false,
    createdAt: now
  });

  addHistory(db, {
    userId: updated.userId || "",
    type: "quote.signed",
    label: `Devis signé : ${updated.quoteNumber}`,
    entityId: updated.id,
    entityType: "quote",
    meta: { signerName: updated.signerName, signerEmail: updated.signerEmail, origine }
  });

  const clientAccess = await ensureClientPortalAccess(db, updated, body, request, now);
  if (clientAccess) {
    updated.clientPortalUserId = clientAccess.userId;
    updated.clientPortalEmail = clientAccess.email;
    updated.clientPortalPhone = clientAccess.phone;
    updated.clientPortalLoginUrl = clientAccess.loginUrl;
    updated.clientPortalAccessSentAt = now;
    updated.clientPortalAccess = clientAccess;

    db.notifications.unshift({
      id: `notif-client-access-${updated.id}-${Date.now()}`,
      userId: updated.userId || "",
      type: "client.access.sent",
      title: "Accès espace particulier envoyé",
      message: `L'identifiant ${clientAccess.portalIdentifier || ""} a été envoyé au client pour suivre le chantier.`,
      quoteId: updated.id,
      projectId: updated.projectId || "",
      actionUrl: updated.projectId ? `/chantiers?project=${updated.projectId}` : "",
      actionLabel: "Voir le chantier",
      meta: {
        portalIdentifier: clientAccess.portalIdentifier || "",
        password: clientAccess.password || "",
        email: clientAccess.email || "",
        phone: clientAccess.phone || "",
        loginUrl: clientAccess.loginUrl || "",
        quoteNumber: updated.quoteNumber || ""
      },
      read: false,
      createdAt: now
    });

    addHistory(db, {
      userId: updated.userId || "",
      type: "client.access.sent",
      label: `Acces client envoye: ${updated.quoteNumber}`,
      entityId: updated.id,
      entityType: "quote",
      meta: { clientUserId: clientAccess.userId, email: clientAccess.email, phone: clientAccess.phone }
    });
  }

  await writeDb(db);

  const row = quoteToRow(updated, updated.userId);
  const { data: updatedRow, error } = await supabase.from("quotes").update(row).eq("id", updated.id).select().single();
  if (error) return { erreur: `Enregistrement de la signature impossible: ${error.message}`, code: 500 };

  const signe = mapQuote(updatedRow);
  const exemplaire = await envoyerExemplaire(updatedRow, signe);
  return { quote: signe, clientAccess, exemplaire };
}

// Ce que le navigateur peut savoir de l'accès Koji Client créé à la signature.
export function publicClientAccess(access) {
  if (!access) return null;
  return {
    sentByEmail: access.sentByEmail === true,
    sentBySms: access.sentBySms === true,
    existingAccount: access.existingAccount === true,
    loginUrl: access.loginUrl || "",
    portalUrl: access.portalUrl || ""
  };
}
