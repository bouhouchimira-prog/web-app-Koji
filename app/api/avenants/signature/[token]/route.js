import { badRequest, ok } from "../../../../../lib/http";
import { addHistory, makeToken, readDb, writeDb } from "../../../../../lib/db";
import { getSupabaseAdmin } from "../../../../../lib/supabase";
import { mapQuote } from "../../../../../lib/quote-mapping";
import { fixObjectText, fixText } from "../../../../../lib/text";
import { codeLot, detailLigne, finDecalee, numeroCourt, recapAvenant, totalLigne } from "../../../../../lib/avenant-koji";

// Signature en ligne d'un avenant par le client (maquette PRO-05), comme le
// devis : lien unique envoyé par l'entreprise. GET : ce que le client lit
// (lignes et leur justification, nouveau total du marché, impact planning).
// POST : signature (nom + validation). L'entreprise est prévenue.
async function charger(token) {
  const db = await readDb();
  const avenant = (db.avenants || []).find((a) => a.signatureToken && a.signatureToken === token);
  if (!avenant) return { db, avenant: null, quote: null };
  const { data: row } = await getSupabaseAdmin().from("quotes").select("*").eq("id", avenant.quoteId).maybeSingle();
  return { db, avenant, quote: row ? fixObjectText(mapQuote(row)) : null };
}

function vue(avenant, quote, db) {
  const lots = [...new Set((quote?.items || []).map((i) => i.room).filter(Boolean))];
  const autresSignes = (db.avenants || []).filter((a) => a.quoteId === avenant.quoteId && a.status === "Signe" && a.id !== avenant.id);
  const recap = recapAvenant({ devisHt: Number(quote?.totalHt) || 0, lignes: avenant.lignes || [], tauxTva: Number(avenant.vatRate ?? quote?.vatRate ?? 20), avenantsSignesHt: autresSignes.reduce((s, a) => s + Number(a.totalHtDelta || 0), 0) });
  const fin = String(quote?.endDate || quote?.finPrevue || "").slice(0, 10);
  return {
    numero: numeroCourt(avenant.numero),
    quoteNumber: avenant.quoteNumber,
    client: avenant.client,
    entreprise: fixText(quote?.company?.name || ""),
    chantier: fixText(quote?.project || avenant.chantierAddress || ""),
    message: avenant.message || "",
    status: avenant.status,
    signedAt: avenant.signedAt || "",
    signerName: avenant.signerName || "",
    impactJours: Number(avenant.impactJours) || 0,
    finPrevue: fin && avenant.impactJours ? finDecalee(fin, avenant.impactJours) : "",
    finAvant: fin,
    vatRate: Number(avenant.vatRate ?? 20),
    lignes: (avenant.lignes || []).map((l) => ({ type: l.type, label: l.label, lot: codeLot(l.room, lots), detail: detailLigne(l, lots), total: totalLigne(l) })),
    autresAvenants: autresSignes.length,
    ...recap
  };
}

export async function GET(_request, context) {
  const { token } = await context.params;
  const { db, avenant, quote } = await charger(token);
  if (!avenant || avenant.status === "Archive" || avenant.status === "Brouillon") return badRequest("Lien d'avenant invalide.", 404);
  return ok({ avenant: vue(avenant, quote, db) });
}

export async function POST(request, context) {
  const { token } = await context.params;
  const body = await request.json().catch(() => ({}));
  const { db, avenant, quote } = await charger(token);
  if (!avenant || avenant.status === "Archive" || avenant.status === "Brouillon") return badRequest("Lien d'avenant invalide.", 404);
  if (avenant.status === "Signe") return ok({ avenant: vue(avenant, quote, db) });
  if (avenant.status === "Refuse") return badRequest("Cet avenant a été refusé.", 409);
  const nom = fixText(String(body.signerName || "")).trim().slice(0, 120);
  if (!nom) return badRequest("Indiquez votre nom pour signer.");
  if (body.consent !== true) return badRequest("Cochez la case pour accepter l'avenant.");
  const now = new Date().toISOString();
  Object.assign(avenant, { status: "Signe", signedAt: now, signerName: nom, signatureProvider: "en-ligne", updatedAt: now });
  db.notifications.unshift({
    id: makeToken("notif"),
    userId: avenant.userId,
    type: "avenant.signe",
    title: `Avenant ${numeroCourt(avenant.numero)} signé par ${nom}`,
    message: `Devis ${avenant.quoteNumber} · nouveau total du marché à jour${avenant.impactJours ? ` · planning ${avenant.impactJours > 0 ? "+" : ""}${avenant.impactJours} jour${Math.abs(avenant.impactJours) > 1 ? "s" : ""} à reporter` : ""}.`,
    actionUrl: `/avenant?id=${avenant.id}`,
    actionLabel: "Voir l'avenant",
    read: false,
    createdAt: now
  });
  addHistory(db, { userId: avenant.userId, type: "avenant.signe", label: `Avenant signé en ligne : ${avenant.numero} (devis ${avenant.quoteNumber})`, entityId: avenant.id, entityType: "avenant" });
  await writeDb(db);
  return ok({ avenant: vue(avenant, quote, db) });
}
