import { ok, badRequest } from "../../../../lib/http";
import { readDb } from "../../../../lib/db";
import { fixObjectText, fixText } from "../../../../lib/text";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { mapQuote } from "../../../../lib/quote-mapping";
import { getVerifiedUserId } from "../../../../lib/server-auth";
import { getVerifiedSignatureToken, signatureAccessExpired } from "../../../../lib/signature-session";
import { publicClientAccess, signerDevisEnLigne } from "../../../../lib/signature-en-ligne";
import { entrepriseDuDevis } from "../../../../lib/chantier-client-serveur";
import { vueLienSignature } from "../../../../lib/chantier-client";

// The signing client has no Koji session (they're not one of the company's
// Supabase-authenticated users), so this can't use a per-user token — it
// looks up the quote across all users via the service_role key, same as the
// client-portal routes.
async function findQuoteByToken(token) {
  const supabase = getSupabaseAdmin();
  const { data: row, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("web_extras->>signatureToken", token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return row ? mapQuote(row) : null;
}

// « Vu » du suivi PRO-03.3 : première ouverture du lien par le client. Ignorée
// quand c'est l'entreprise elle-même qui ouvre son propre lien (bouton
// « Ouvrir le lien » de l'éditeur), sinon le suivi mentirait.
async function markViewed(request, quote) {
  if (quote.viewedAt || quote.signatureStatus === "Signe") return quote;
  const viewerId = await getVerifiedUserId(request);
  if (viewerId && viewerId === quote.userId) return quote;
  const supabase = getSupabaseAdmin();
  const { data: row } = await supabase.from("quotes").select("web_extras").eq("id", quote.id).maybeSingle();
  const viewedAt = new Date().toISOString();
  await supabase.from("quotes").update({ web_extras: { ...(row?.web_extras || {}), viewedAt } }).eq("id", quote.id);
  return { ...quote, viewedAt };
}

async function publicQuoteView(quote) {
  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    client: fixText(quote.client),
    clientEmail: quote.clientEmail,
    project: fixText(quote.project),
    rooms: fixObjectText(quote.rooms || []),
    items: fixObjectText(quote.items || []),
    totalHt: quote.totalHt,
    totalTtc: quote.totalTtc,
    status: quote.status,
    signatureStatus: quote.signatureStatus,
    sentAt: quote.sentAt,
    signedAt: quote.signedAt,
    signerName: quote.signerName,
    clientPhone: fixText(quote.clientPhone || ""),
    clientPortalUserId: quote.clientPortalUserId || "",
    clientPortalAccessSentAt: quote.clientPortalAccessSentAt || "",
    signaturePlace: fixText(quote.signaturePlace || ""),
    signerMessage: fixText(quote.signerMessage || ""),
    vatRate: quote.vatRate,
    autoliquidation: quote.autoliquidation === true,
    mentionTva: quote.mentionTva === true,
    versions: Array.isArray(quote.versions) ? quote.versions : [],
    clientType: quote.clientType,
    startDate: quote.startDate || "",
    retractationJusquau: quote.retractationJusquau || "",
    retracteLe: quote.retracteLe || "",
    demarrageDemande: quote.demarrageDemande || "",
    company: await entreprise(quote)
  };
}

function authorizeSignatureRequest(request, token) {
  if (!getVerifiedSignatureToken(request, token)) {
    return badRequest("Session de signature expirée. Reconnectez-vous avec vos identifiants.", 401);
  }
  return null;
}

export async function GET(request, context) {
  const { token } = await context.params;
  const denied = authorizeSignatureRequest(request, token);
  if (denied) return denied;
  const found = await findQuoteByToken(token);
  if (!found) return badRequest("Lien de signature invalide.", 404);
  if (signatureAccessExpired(found)) {
    // Lien expiré (maquette CLI-07, « lien non valide ») : la session de
    // signature est vérifiée, l'entreprise peut être nommée pour lui écrire.
    const contact = await entreprise(found);
    return ok({ error: "Ce lien a expiré. Demandez un nouveau lien à votre artisan.", entreprise: { nom: contact.name, email: contact.email } }, 410);
  }
  const quote = await markViewed(request, found);

  return ok({ quote: await publicQuoteView(quote), vue: await vueLien(quote, token) });
}

// Vue de la page publique (maquette CLI-07) : devis lisible en entier,
// identité et décennale de l'entreprise, règles de signature, « Et
// maintenant » une fois signé. Mêmes libellés que l'onglet Devis de Koji
// Client (lib/chantier-client.js).
async function vueLien(quote, token) {
  const db = await readDb();
  return vueLienSignature(quote, {
    entreprise: await entrepriseDuDevis(db, quote),
    pdf: `/api/signatures/${encodeURIComponent(token)}/pdf`
  });
}

// Coordonnées de l'entreprise pour le formulaire de rétractation : celles du
// devis, sinon celles de CE compte uniquement.
async function entreprise(quote) {
  const snap = quote.company || {};
  let owner = null;
  if (!snap.name || !snap.email || !(snap.address || snap.addressLine1)) {
    const db = await readDb().catch(() => null);
    owner = (db?.users || []).find((u) => u.id && u.id === quote.userId) || null;
  }
  const b = owner?.business || {};
  const adresse = snap.address || [snap.addressLine1, snap.addressLine2].filter(Boolean).join(" ") || [b.addressLine1, b.addressLine2].filter(Boolean).join(" ");
  return {
    name: fixText(snap.name || b.raisonSociale || owner?.name || ""),
    address: fixText(adresse || ""),
    email: fixText(snap.email || b.emailPro || owner?.email || "")
  };
}

export async function POST(request, context) {
  const { token } = await context.params;
  const denied = authorizeSignatureRequest(request, token);
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const quote = await findQuoteByToken(token);
  if (!quote) return badRequest("Lien de signature invalide.", 404);
  if (signatureAccessExpired(quote)) return badRequest("Ce lien a expiré. Demandez un nouveau lien à votre artisan.", 410);
  if (quote.signatureStatus === "Signe") {
    return ok({ quote: await publicQuoteView(quote), vue: await vueLien(quote, token), clientAccess: publicClientAccess(quote.clientPortalAccess) });
  }
  // Un seul enregistrement pour le lien et l'espace Koji Client
  // (lib/signature-en-ligne.js) : mêmes règles, mêmes preuves.
  const resultat = await signerDevisEnLigne({ quote, body, request, origine: "lien" });
  if (resultat.erreur) return badRequest(resultat.erreur, resultat.code);
  return ok({ quote: await publicQuoteView(resultat.quote), vue: await vueLien(resultat.quote, token), clientAccess: publicClientAccess(resultat.clientAccess), exemplaire: resultat.exemplaire });
}
