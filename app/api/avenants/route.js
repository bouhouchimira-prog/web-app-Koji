import { badRequest, ok } from "../../../lib/http";
import { ADMIN_SCOPE, addHistory, findScopedIndex, getUserScope, readDb, resolveUserId, scopedItems, writeDb } from "../../../lib/db";
import { fixObjectText, fixText } from "../../../lib/text";
import { getSupabaseAdmin } from "../../../lib/supabase";
import { mapQuote } from "../../../lib/quote-mapping";
import { nextAvenantNumero, normalizeLignes, computeAvenantTotals } from "../../../lib/avenant-mapping";
import { makeToken } from "../../../lib/db";
import { sendClientMessageEmail } from "../../../lib/mailer";
import { buildAvenantPdf, avenantDocumentFilename } from "../../../lib/document-generator";
import { numeroCourt } from "../../../lib/avenant-koji";

// Avenants (contract amendments) attach to an already-SIGNED devis and carry
// only the delta — see lib/avenant-mapping.js for the numbering/totals
// helpers. Like invoices, they live in the local/koji_web_state JSON store
// (not the Supabase `quotes` table) — not yet shared with the mobile app.

function normalizeAvenant(avenant) {
  return fixObjectText(avenant);
}

export async function GET(request) {
  const db = await readDb();
  const userId = await getUserScope(request, db);
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const quoteId = url.searchParams.get("quoteId");

  const items = scopedItems(db.avenants, userId);

  if (id) {
    const avenant = items.find((item) => item.id === id);
    if (!avenant) return badRequest("Avenant introuvable.", 404);
    return ok({ avenant: normalizeAvenant(avenant) });
  }

  const filtered = quoteId ? items.filter((item) => item.quoteId === quoteId) : items;
  filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  return ok({ avenants: filtered.map(normalizeAvenant) });
}

export async function POST(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = await resolveUserId(request, body, db);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);
  if (!body.quoteId) return badRequest("Devis parent manquant.");

  const supabase = getSupabaseAdmin();
  const { data: quoteRow } = await supabase.from("quotes").select("*").eq("id", body.quoteId).maybeSingle();
  if (!quoteRow) return badRequest("Devis introuvable.", 404);
  const quote = mapQuote(quoteRow);
  // Le lu passe par le client service-role (bypass RLS) — sans ce controle,
  // n'importe quelle entreprise authentifiee pouvait creer un avenant sur le
  // devis signe d'une AUTRE entreprise juste en connaissant/devinant son id.
  if (userId !== ADMIN_SCOPE && quote.userId !== userId) return badRequest("Devis introuvable.", 404);
  // Devis de l'app signés via koji-signature : statut « accepte ».
  const signe = quote.status === "Signe" || quote.signatureStatus === "Signe" || String(quoteRow.status || "").toLowerCase() === "accepte" || Boolean(quoteRow.signed_at);
  if (!signe) {
    return badRequest("Un avenant ne peut être créé que sur un devis déjà signé.");
  }

  const now = new Date().toISOString();
  const numero = nextAvenantNumero(db, quote.id);
  const lignes = normalizeLignes(body.lignes || []);
  const { totalHtDelta, totalTtcDelta } = computeAvenantTotals(lignes, quote.vatRate);

  const avenant = {
    id: `av-${Date.now()}`,
    userId: quote.userId || userId,
    quoteId: quote.id,
    quoteNumber: quote.quoteNumber,
    numero,
    status: "Brouillon",
    motif: fixText(body.motif || ""),
    // Categorisation du motif + mode de facturation (15 oct, maquette
    // fournie par Amira) — purement informatifs, n'influencent aucun calcul.
    motifCategory: ["demande_client", "imprevu_chantier", "modification_technique"].includes(body.motifCategory) ? body.motifCategory : "demande_client",
    facturationMode: body.facturationMode === "solde" ? "solde" : "separee",
    client: quote.client || "",
    chantier: quote.project || "",
    clientEmail: quote.clientEmail || "",
    chantierAddress: quote.chantierAddress || "",
    vatRate: quote.vatRate,
    lignes,
    totalHtDelta,
    totalTtcDelta,
    // PRO-05 : impact planning (jours ouvrés), message au client, notes de
    // chantier dont Koji est parti.
    impactJours: Math.max(-30, Math.min(30, Math.round(Number(body.impactJours) || 0))),
    message: fixText(String(body.message || "")).slice(0, 2000),
    notes: fixText(String(body.notes || "")).slice(0, 2000),
    projectId: quote.projectId || "",
    createdAt: now,
    updatedAt: now,
    sentAt: "",
    signedAt: "",
    signerName: "",
    signatureProvider: "",
    acceptanceReason: "",
    refusedAt: "",
    refusalReason: ""
  };

  db.avenants.unshift(avenant);
  addHistory(db, {
    userId: avenant.userId,
    type: "avenant.created",
    label: `Avenant créé : ${avenant.numero} (devis ${quote.quoteNumber})`,
    entityId: avenant.id,
    entityType: "avenant",
    meta: { quoteId: quote.id }
  });
  await writeDb(db);
  return ok({ avenant: normalizeAvenant(avenant) }, 201);
}

export async function PATCH(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = await resolveUserId(request, body, db);
  const index = findScopedIndex(db.avenants, body.id, userId);
  if (index === -1) return badRequest("Avenant introuvable.", 404);

  const now = new Date().toISOString();
  const avenant = db.avenants[index];
  const action = body.action || "update";

  if (action === "delete") {
    if (avenant.status !== "Brouillon") return badRequest("Seul un avenant en brouillon peut être supprimé.");
    db.avenants.splice(index, 1);
  } else if (action === "purge") {
    // Corbeille (16 oct) : suppression definitive d'un avenant deja
    // archive (contrairement a "delete" ci-dessus, reserve aux brouillons).
    if (avenant.status !== "Archive") return badRequest("Seul un avenant déjà dans la corbeille peut être supprimé définitivement.", 400);
    db.avenants.splice(index, 1);
  } else if (action === "update") {
    if (avenant.status !== "Brouillon") return badRequest("Seul un avenant en brouillon peut être modifié.");
    if (Object.prototype.hasOwnProperty.call(body, "motif")) avenant.motif = fixText(body.motif || "");
    if (Object.prototype.hasOwnProperty.call(body, "motifCategory") && ["demande_client", "imprevu_chantier", "modification_technique"].includes(body.motifCategory)) {
      avenant.motifCategory = body.motifCategory;
    }
    if (Object.prototype.hasOwnProperty.call(body, "impactJours")) avenant.impactJours = Math.max(-30, Math.min(30, Math.round(Number(body.impactJours) || 0)));
    if (Object.prototype.hasOwnProperty.call(body, "message")) avenant.message = fixText(String(body.message || "")).slice(0, 2000);
    if (Object.prototype.hasOwnProperty.call(body, "notes")) avenant.notes = fixText(String(body.notes || "")).slice(0, 2000);
    if (Object.prototype.hasOwnProperty.call(body, "facturationMode")) {
      avenant.facturationMode = body.facturationMode === "solde" ? "solde" : "separee";
    }
    if (Object.prototype.hasOwnProperty.call(body, "lignes")) {
      avenant.lignes = normalizeLignes(body.lignes || []);
      const totals = computeAvenantTotals(avenant.lignes, avenant.vatRate);
      avenant.totalHtDelta = totals.totalHtDelta;
      avenant.totalTtcDelta = totals.totalTtcDelta;
    }
  } else if (action === "send") {
    if (avenant.status !== "Brouillon") return badRequest("Cet avenant a déjà été envoyé.");
    if (!avenant.lignes.length) return badRequest("Ajoutez au moins une ligne avant d'envoyer cet avenant.");
    if (avenant.lignes.some((l) => l.aChiffrer && !(Number(l.unitPriceHt) > 0))) return badRequest("Une ligne est encore à chiffrer : donnez-lui un prix avant d'envoyer.");
    avenant.status = "Envoye";
    avenant.sentAt = now;
    // Signature en ligne par le client (PRO-05), comme le devis : lien
    // unique, e-mail avec le PDF s'il est demandé.
    avenant.signatureToken = avenant.signatureToken || makeToken("avsig");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    avenant.signatureUrl = `${appUrl}/signature/avenant/${avenant.signatureToken}`;
    if (body.email !== false && avenant.clientEmail) {
      try {
        const supabase = getSupabaseAdmin();
        const { data: quoteRow } = await supabase.from("quotes").select("*").eq("id", avenant.quoteId).maybeSingle();
        const quote = quoteRow ? fixObjectText(mapQuote(quoteRow)) : null;
        const pdf = buildAvenantPdf({ avenant: fixObjectText(avenant), quote, db });
        const r = await sendClientMessageEmail({
          to: avenant.clientEmail,
          subject: `Avenant ${numeroCourt(avenant.numero)} au devis ${avenant.quoteNumber}`,
          message: [avenant.message || `Bonjour${avenant.client ? ` ${avenant.client}` : ""}, voici l'avenant au devis ${avenant.quoteNumber}.`, "", `Pour le lire et le signer en ligne : ${avenant.signatureUrl}`].join("\n"),
          replyTo: quote?.company?.email || undefined,
          attachments: [{ filename: avenantDocumentFilename(avenant), content: Buffer.from(pdf), contentType: "application/pdf" }]
        });
        avenant.emailEnvoye = Boolean(r?.ok);
      } catch {
        avenant.emailEnvoye = false;
      }
    }
  } else if (action === "accept-manually") {
    if (avenant.status === "Signe") return badRequest("Cet avenant est déjà signé.");
    avenant.status = "Signe";
    avenant.signedAt = now;
    avenant.signerName = fixText(body.signerName || avenant.client || "Client");
    avenant.signatureProvider = "manuel";
    avenant.acceptanceReason = body.acceptanceReason === "acompte" ? "acompte" : "verbal";
  } else if (action === "refuse") {
    avenant.status = "Refuse";
    avenant.refusedAt = now;
    avenant.refusalReason = fixText(body.refusalReason || "");
  } else if (action === "archive") {
    avenant.status = "Archive";
    avenant.archivedAt = now;
  } else if (action === "restore") {
    // Corbeille (15 oct) — remet un avenant archive au statut qu'il avait
    // avant archivage ; Brouillon par defaut si ce statut n'est pas connu.
    avenant.status = avenant.signedAt ? "Signe" : avenant.sentAt ? "Envoye" : "Brouillon";
    avenant.archivedAt = "";
  }

  avenant.updatedAt = now;
  if (action !== "delete" && action !== "purge") db.avenants[index] = avenant;

  const isDeletion = action === "delete" || action === "purge";
  addHistory(db, {
    userId: avenant.userId || userId,
    type: isDeletion ? "avenant.deleted" : `avenant.${action}`,
    label: isDeletion ? `Avenant supprimé : ${avenant.numero}` : `Avenant mis à jour : ${avenant.numero}`,
    entityId: avenant.id,
    entityType: "avenant"
  });

  await writeDb(db);
  return ok({ avenant: normalizeAvenant({ ...avenant, deleted: isDeletion }) });
}
