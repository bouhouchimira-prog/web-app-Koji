import { addHistory, readDb, writeDb } from "./db.js";
import { fixText } from "./text.js";
import { getSupabaseAdmin } from "./supabase.js";
import { mapQuote } from "./quote-mapping.js";
import { sendClientMessageEmail } from "./mailer.js";

// « Me rétracter » (maquette PRO-03.7) : le particulier annule le devis
// signé, sans motif, jusqu'à la fin du délai (inclus). Devis annulé, chantier
// retiré du planning, l'entreprise est prévenue avec le rappel du
// remboursement sous 14 jours. Un seul enregistrement pour le lien de
// signature et l'espace Koji Client : l'appelant a déjà vérifié la session
// et l'appartenance du devis.
// Renvoie { quote } (le devis à jour) ou { erreur, code }.
export async function retracterDevis(row, { origine = "lien" } = {}) {
  const quote = mapQuote(row);
  const jour = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  if (quote.retracteLe) return { quote };
  if (quote.signatureStatus !== "Signe") return { erreur: "Ce devis n'est pas signé.", code: 409 };
  if (!quote.retractationJusquau) return { erreur: "Ce devis n'ouvre pas de droit de rétractation.", code: 409 };
  if (quote.retractationJusquau < jour) return { erreur: "Le délai de rétractation est terminé.", code: 409 };

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const web_extras = { ...(row.web_extras || {}), retracteLe: now, cancelledAt: now, retractationOrigine: origine === "espace" ? "espace Koji Client" : "lien de signature" };
  const { data: updatedRow, error: updateError } = await supabase
    .from("quotes")
    .update({ status: "Annule", web_extras })
    .eq("id", quote.id)
    .select("*")
    .single();
  if (updateError || !updatedRow) return { erreur: "Rétractation impossible pour le moment.", code: 500 };
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

  return { quote: updated };
}
