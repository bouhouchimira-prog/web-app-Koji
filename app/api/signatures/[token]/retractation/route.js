import { ok, badRequest } from "../../../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../../../lib/db";
import { fixText } from "../../../../../lib/text";
import { getSupabaseAdmin } from "../../../../../lib/supabase";
import { mapQuote } from "../../../../../lib/quote-mapping";
import { sendClientMessageEmail } from "../../../../../lib/mailer";

// « Me rétracter » (maquette PRO-03.7) : le client particulier annule le
// devis signé, sans motif, jusqu'à la fin du délai (inclus). Devis annulé,
// chantier retiré du planning, l'entreprise est prévenue avec le rappel du
// remboursement sous 14 jours.
export async function POST(request, context) {
  const { token } = await context.params;
  if (!token) return badRequest("Lien de signature invalide.", 404);
  const supabase = getSupabaseAdmin();
  const { data: row, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("web_extras->>signatureToken", token)
    .maybeSingle();
  if (error) return badRequest("Rétractation impossible pour le moment.", 500);
  if (!row) return badRequest("Lien de signature invalide.", 404);
  const quote = mapQuote(row);

  const jour = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  if (quote.retracteLe) return ok({ quote: vuClient(quote) });
  if (quote.signatureStatus !== "Signe") return badRequest("Ce devis n'est pas signé.", 409);
  if (!quote.retractationJusquau) return badRequest("Ce devis n'ouvre pas de droit de rétractation.", 409);
  if (quote.retractationJusquau < jour) return badRequest("Le délai de rétractation est terminé.", 409);

  const now = new Date().toISOString();
  const web_extras = { ...(row.web_extras || {}), retracteLe: now, cancelledAt: now };
  const { data: updatedRow, error: updateError } = await supabase
    .from("quotes")
    .update({ status: "Annule", web_extras })
    .eq("id", quote.id)
    .select("*")
    .single();
  if (updateError || !updatedRow) return badRequest("Rétractation impossible pour le moment.", 500);
  const updated = mapQuote(updatedRow);

  if (updated.projectId) {
    await supabase.from("chantiers").update({ status: "Archive" }).eq("id", updated.projectId);
  }

  const db = await readDb();
  const client = fixText(updated.signerName || updated.client || "Le client");
  db.notifications.unshift({
    id: `notif-retractation-${updated.id}-${Date.now()}`,
    userId: updated.userId || "",
    type: "quote.retracted",
    title: "Rétractation reçue",
    message: `${client} s'est rétracté du devis ${updated.quoteNumber}. Devis annulé, chantier retiré du planning. Remboursement des sommes versées à faire sous 14 jours.`,
    quoteId: updated.id,
    projectId: updated.projectId || "",
    actionUrl: `/devis?quote=${updated.id}`,
    actionLabel: "Voir le devis",
    read: false,
    createdAt: now
  });
  addHistory(db, {
    userId: updated.userId || "",
    type: "quote.retracted",
    label: `Rétractation du client : ${updated.quoteNumber}`,
    entityId: updated.id,
    entityType: "quote"
  });
  await writeDb(db);

  // E-mail à l'entreprise : uniquement l'adresse de CE compte (jamais un
  // repli sur un autre utilisateur).
  const owner = (db.users || []).find((u) => u.id && u.id === updated.userId);
  const emailEntreprise = updated.company?.email || owner?.business?.emailPro || owner?.email || "";
  if (emailEntreprise) {
    const le = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long", year: "numeric" }).format(new Date(now));
    await sendClientMessageEmail({
      to: emailEntreprise,
      subject: `Rétractation reçue · devis ${updated.quoteNumber}`,
      message: [
        "Bonjour,",
        "",
        `${client} s'est rétracté le ${le} du devis ${updated.quoteNumber}, dans le délai légal.`,
        "Le devis est annulé et le chantier retiré du planning.",
        "Les sommes déjà versées sont à rembourser au plus tard 14 jours après cette date.",
        "",
        "Koji"
      ].join("\n"),
      replyTo: updated.clientEmail || undefined
    }).catch(() => null);
  }

  return ok({ quote: vuClient(updated) });
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
