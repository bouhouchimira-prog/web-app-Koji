import { badRequest, ok } from "../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../lib/db";
import { getAuth } from "../../../lib/server-auth";
import { buildWebUser } from "../../../lib/user-profile";
import { getSupabaseAdmin } from "../../../lib/supabase";
import { mapQuote, quoteToRow, nextQuoteNumberFor } from "../../../lib/quote-mapping";
import { applyQuoteTotals } from "../../../lib/quote-calculations";
import { buildMissingPriceNotes, clearUnverifiedAiPrices, PRICE_RANGE_SPREAD } from "../../../lib/ai-devis-shape";
import { fixText } from "../../../lib/text";

// Devis pre-rempli par koji (decisions du 4 septembre) — une entreprise
// consultant un chantier Radar des Chantiers reçoit une COPIE du devis
// interne genere par l'expertise IA (app/api/expertise-koji/route.js), a sa
// propre en-tete (son company, ses infos). Plus d'appel Claude ici : l'IA
// n'intervient qu'une fois, a l'expertise — cette route se contente de
// recopier lots/postes/prix deja calcules dans un nouveau devis, "Brouillon",
// que l'entreprise ajuste et envoie normalement depuis /devis. Jamais un PDF
// figé : un devis modifiable comme n'importe quel autre dans l'editeur.
//
// Depuis le 30 septembre (demande d'Amira), cette route n'est plus appelee
// directement depuis la fiche de l'offre : l'entreprise passe d'abord par
// un ecran de revue modifiable (app/marketplace/[id]/proposition-devis,
// alimente par GET .../devis-preview) qui fusionne/supprime/ajuste les
// lots et les prix AVANT de creer quoi que ce soit. body.rooms/body.items,
// quand fournis, sont donc la version definitive choisie par l'entreprise
// sur cet ecran — pas la peine de les re-deriver de l'expertise. Le repli
// sur l'expertise brute reste en place pour ne rien casser si cette route
// est appelee sans etre passee par l'ecran de revue.
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

  const overrideItems = Array.isArray(body.items) ? body.items : null;
  const overrideRooms = Array.isArray(body.rooms) ? body.rooms : null;
  const finalItems = overrideItems || clearUnverifiedAiPrices(expertise.items || []).items;
  const finalRooms = overrideRooms || expertise.rooms || [];
  // Recalculee depuis les items FINAUX (ceux edites sur l'ecran de revue,
  // le cas echeant) — jamais depuis missingPriceNotes de l'expertise brute,
  // qui ne refleterait plus les corrections apportees par l'entreprise.
  const missingPriceNotes = finalItems.filter((it) => it.needsPrice).map((it) => ({ room: it.room, label: it.label }));

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
    rooms: finalRooms,
    items: finalItems,
    notes: buildMissingPriceNotes(missingPriceNotes),
    surcharges: [],
    // Taux reduit travaux de renovation (30 sept, demande d'Amira) — un
    // devis issu d'une offre Radar des Chantiers part a 10% au lieu des 20%
    // par defaut ailleurs dans l'app ; reste un champ modifiable normalement
    // par l'entreprise si ce chantier precis n'y est pas eligible. Pourcentage
    // ENTIER (10, pas 0.1) — voir le correctif dans expertise-koji/route.js.
    vatRate: 10,
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

  // Fourchette TOUJOURS recalculee a partir du total REEL de ce devis (30
  // sept, remonte par Amira : un devis affichait 27 354,80€ alors que
  // l'offre montrait encore "17 248€ - 23 336€", une fourchette figee au
  // moment de la publication et jamais mise a jour depuis, meme quand
  // l'expertise interne a change entre-temps — ex: l'expertise a ete
  // corrigee apres publication). On ne fait plus jamais confiance a
  // offre.priceRangeMin/Max tels quels : ils sont reecrits ici avec le vrai
  // total de CE devis, qui vient justement de cette meme expertise — garantit
  // que la fourchette et le devis restent toujours coherents entre eux, et
  // que le garde-fou de app/api/quotes/route.js ne se declenche plus jamais
  // a tort sur un devis fraichement cree.
  const freshPriceRangeMin = Math.round(computed.totalTtc * (1 - PRICE_RANGE_SPREAD));
  const freshPriceRangeMax = Math.round(computed.totalTtc * (1 + PRICE_RANGE_SPREAD));
  computed.offrePriceRangeMin = freshPriceRangeMin;
  computed.offrePriceRangeMax = freshPriceRangeMax;
  offre.priceRangeMin = freshPriceRangeMin;
  offre.priceRangeMax = freshPriceRangeMax;

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
