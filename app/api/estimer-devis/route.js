import { badRequest, ok } from "../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../lib/db";
import { getAuth } from "../../../lib/server-auth";
import { buildWebUser } from "../../../lib/user-profile";
import { getSupabaseAdmin } from "../../../lib/supabase";
import { mapQuote, quoteToRow, nextQuoteNumberFor } from "../../../lib/quote-mapping";
import { applyQuoteTotals } from "../../../lib/quote-calculations";
import { fixText } from "../../../lib/text";

// Devis pre-rempli par koji (decisions du 4 septembre) — une entreprise
// consultant un chantier Radar des Chantiers reçoit une COPIE du devis
// interne genere par l'expertise IA (app/api/expertise-koji/route.js), a sa
// propre en-tete (son company, ses infos). Plus d'appel Claude ici : l'IA
// n'intervient qu'une fois, a l'expertise — cette route se contente de
// recopier lots/postes/prix deja calcules dans un nouveau devis, "Brouillon",
// que l'entreprise ajuste et envoie normalement depuis /devis. Jamais un PDF
// figé : un devis modifiable comme n'importe quel autre dans l'editeur.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const auth = getAuth(request, body);
  if (!auth) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const chantierOffreId = String(body.chantierOffreId || "");
  if (!chantierOffreId) return badRequest("Chantier non précisé.");

  const db = await readDb();
  const offre = (db.chantierOffres || []).find((entry) => entry.id === chantierOffreId);
  if (!offre) return badRequest("Chantier introuvable.", 404);
  if (!offre.expertiseId) return badRequest("Aucune expertise n'est liée à ce chantier.", 404);

  const supabaseAdmin = getSupabaseAdmin();
  const { data: expertiseRow, error: fetchError } = await supabaseAdmin
    .from("quotes")
    .select("*")
    .eq("id", offre.expertiseId)
    .maybeSingle();
  if (fetchError) return badRequest(`Lecture de l'expertise impossible: ${fetchError.message}`, 500);
  const expertise = expertiseRow ? mapQuote(expertiseRow) : null;
  if (!expertise) return badRequest("Expertise introuvable.", 404);

  const { data: profile } = await auth.supabase.from("users").select("*").eq("id", auth.userId).maybeSingle();
  const webUser = buildWebUser({ id: auth.userId, email: profile?.email || "", profile });

  const now = new Date().toISOString();
  const quoteNumber = await nextQuoteNumberFor(auth);

  const draft = {
    id: "",
    userId: auth.userId,
    quoteNumber,
    versionNumber: "001",
    client: fixText(offre.clientName || "Particulier"),
    clientEmail: offre.clientEmail || "",
    clientPhone: fixText(offre.clientPhone || ""),
    project: fixText(offre.description || "Chantier").slice(0, 80),
    projectId: "",
    chantierAddress: fixText(offre.address || ""),
    workDescription: fixText(offre.description || expertise.workDescription || ""),
    validityDays: 30,
    company: webUser.business || {},
    quoteDate: now.slice(0, 10),
    status: "Brouillon",
    signatureStatus: "Non envoye",
    rooms: expertise.rooms || [],
    items: expertise.items || [],
    notes: [],
    surcharges: [],
    vatRate: 0.2,
    draftStep: 0,
    draftData: null,
    isCreationDraft: false,
    totalHt: 0,
    totalTtc: 0,
    createdAt: now.slice(0, 10),
    createdAtIso: now,
    updatedAt: now,
    chantierOffreId: offre.id,
    aiGenerated: true
  };

  const computed = applyQuoteTotals(draft);
  const row = quoteToRow(computed, auth.userId);

  const { data: inserted, error } = await auth.supabase.from("quotes").insert(row).select().single();
  if (error) return badRequest(`Création du devis impossible: ${error.message}`, 500);

  const quote = mapQuote(inserted);

  addHistory(db, {
    userId: auth.userId,
    type: "quote.ai_generated",
    label: `Devis pré-rempli par koji pour le chantier : ${offre.description.slice(0, 60)}`,
    entityId: quote.id,
    entityType: "quote",
    meta: { chantierOffreId: offre.id, expertiseId: offre.expertiseId, totalTtc: quote.totalTtc }
  });
  await writeDb(db);

  return ok({ quote }, 201);
}
