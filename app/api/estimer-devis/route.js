import { badRequest, ok } from "../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../lib/db";
import { getAuth } from "../../../lib/server-auth";
import { buildWebUser } from "../../../lib/user-profile";
import { getSupabaseAdmin } from "../../../lib/supabase";
import { mapQuote, quoteToRow, nextQuoteNumberFor } from "../../../lib/quote-mapping";
import { applyQuoteTotals } from "../../../lib/quote-calculations";
import { buildMissingPriceNotes, PRICE_RANGE_SPREAD } from "../../../lib/ai-devis-shape";
import { fixText } from "../../../lib/text";

// Un poste de l'expertise interne marque priceSource "ia" (voir
// lib/ai-devis-shape.js) a ete chiffre par l'IA faute de correspondance
// dans la bibliotheque de prix — fiable pour donner au particulier une
// fourchette indicative (voir expertise-koji), mais jamais a faire passer
// pour un prix sur, tel quel, sur le devis REEL de l'entreprise (30 sept,
// demande d'Amira). On le remet a 0€ ici, avec une note demandant a
// l'entreprise de le completer elle-meme — la professionnelle la mieux
// placee pour donner un vrai prix, jamais une estimation IA non verifiee.
function clearUnverifiedAiPrices(items) {
  const missingPriceNotes = [];
  const cleaned = (items || []).map((item) => {
    if (item.priceSource !== "ia") return item;
    missingPriceNotes.push({ room: item.room || "Général", label: item.label || "Prestation" });
    return { ...item, billingMode: "fixed", fixedAmountHt: 0, priceSource: "manquant", needsPrice: true };
  });
  return { items: cleaned, missingPriceNotes };
}

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
  const { items: cleanedItems, missingPriceNotes } = clearUnverifiedAiPrices(expertise.items || []);

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
    items: cleanedItems,
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
