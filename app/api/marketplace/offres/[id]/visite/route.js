import { badRequest, ok } from "../../../../../../lib/http";
import { addHistory, makeToken, readDb, writeDb } from "../../../../../../lib/db";
import { getAuth, getVerifiedUserId } from "../../../../../../lib/server-auth";
import { isRdvUnlockedForOffer, maskedCityPostal } from "../../../../../../lib/offer-privacy";
import { buildWebUser } from "../../../../../../lib/user-profile";
import { mergedOuvrages } from "../../../../../../lib/ouvrages";
import { mapQuote, quoteToRow, nextQuoteNumberFor } from "../../../../../../lib/quote-mapping";
import { applyQuoteTotals } from "../../../../../../lib/quote-calculations";
import { buildItemsFromVisite } from "../../../../../../lib/visite-devis-shape";
import { matchVisiteRules } from "../../../../../../lib/visite-rules";
import { fixText } from "../../../../../../lib/text";

// Visite guidee (12 septembre) — remplace le bouton "Creer mon devis"
// instantane (app/api/estimer-devis) a l'etape ou l'entreprise positionnee
// visite le chantier : elle repond a un arbre de questions fixe par piece
// (lib/visite-tree.js), et cette route transforme les reponses en devis via
// une formule deterministe (lib/visite-devis-shape.js), jamais un chiffrage
// invente par l'IA. Rien d'autre du flux Radar des Chantiers ne change
// (matching, positionnement, messagerie/RDV restent intacts).
export async function POST(request, context) {
  const body = await request.json().catch(() => ({}));
  const auth = getAuth(request, body);
  if (!auth) return badRequest("Session expirée. Reconnectez-vous.", 401);
  // auth.userId is only decoded, not signature-verified — the positionnement
  // and worker checks below read the local JSON store directly with it, so
  // it needs a verified id (the auth.supabase calls further down stay safe
  // either way, since Supabase itself rejects an invalid-signature token).
  const verifiedUserId = await getVerifiedUserId(request, body);
  if (!verifiedUserId) return badRequest("Session expirée. Reconnectez-vous.", 401);
  auth.userId = verifiedUserId;

  const { id: offerId } = await context.params;
  const pieces = Array.isArray(body.pieces) ? body.pieces : [];
  if (pieces.length === 0) return badRequest("Ajoutez au moins une pièce visitée.");

  const db = await readDb();

  const offre = (db.chantierOffres || []).find((entry) => entry.id === offerId);
  if (!offre) return badRequest("Chantier introuvable.", 404);

  // Le reste du flux (positionnement) ne change pas : on verifie juste que
  // cette entreprise est bien positionnee "Active" sur cette offre avant de
  // lui laisser generer un devis depuis une visite.
  const positionnement = (db.chantierPositionnements || []).find(
    (entry) => entry.offerId === offerId && entry.entrepriseUserId === auth.userId && entry.status === "Active"
  );
  if (!positionnement) return badRequest("Vous devez d'abord vous positionner sur ce chantier.", 403);

  // Jamais faire confiance a un taux horaire envoye par le client : on
  // relit le taux reel du travailleur choisi depuis db.workers, scope a
  // cette entreprise (meme principe que partout ailleurs dans l'app —
  // aucun montant financier ne vient d'une valeur simplement transmise).
  const workerId = String(body.workerId || "");
  const worker = (db.workers || []).find((entry) => entry.id === workerId && entry.userId === auth.userId);
  if (!worker) return badRequest("Sélectionnez la personne qui a réalisé la visite.");

  const catalog = mergedOuvrages(db, auth.userId);

  const acceptedSuggestionIds = new Set(Array.isArray(body.acceptedSuggestionIds) ? body.acceptedSuggestionIds : []);
  const allSuggestions = pieces.flatMap((piece) =>
    matchVisiteRules(piece.remarques && piece.remarques.value, piece.id, fixText(piece.nom || ""))
  );
  const acceptedSuggestions = allSuggestions.filter((s) => acceptedSuggestionIds.has(s.id));

  const { rooms, items, notes } = buildItemsFromVisite({
    pieces,
    worker: { hourlyRate: worker.hourlyRate },
    catalog,
    acceptedSuggestions
  });

  const now = new Date().toISOString();
  const visite = {
    id: makeToken("visite"),
    offerId,
    entrepriseUserId: auth.userId,
    workerId: worker.id,
    workerName: fixText(worker.name || ""),
    pieces,
    acceptedSuggestionIds: Array.from(acceptedSuggestionIds),
    createdAt: now
  };
  db.chantierVisites.push(visite);

  const { data: profile } = await auth.supabase.from("users").select("*").eq("id", auth.userId).maybeSingle();
  const webUser = buildWebUser({ id: auth.userId, email: profile?.email || "", profile });

  const quoteNumber = await nextQuoteNumberFor(auth);

  // Meme regle de confidentialite que la fiche de l'offre (lib/offer-privacy.js)
  // : une entreprise positionnee ne voit les coordonnees reelles du particulier
  // qu'apres confirmation du RDV — sinon nom/email/telephone/adresse exacte
  // restent masques, meme dans le devis genere depuis la visite.
  const rdvUnlocked = isRdvUnlockedForOffer(db, offerId, auth.userId);

  const draft = {
    id: "",
    userId: auth.userId,
    quoteNumber,
    versionNumber: "001",
    client: rdvUnlocked ? fixText(offre.clientName || "Particulier") : "Particulier",
    clientEmail: rdvUnlocked ? (offre.clientEmail || "") : "",
    clientPhone: rdvUnlocked ? fixText(offre.clientPhone || "") : "",
    project: fixText(offre.description || "Chantier").slice(0, 80),
    projectId: "",
    chantierAddress: rdvUnlocked ? fixText(offre.address || "") : maskedCityPostal(offre),
    workDescription: fixText(offre.description || ""),
    validityDays: 30,
    company: webUser.business || {},
    quoteDate: now.slice(0, 10),
    status: "Brouillon",
    signatureStatus: "Non envoye",
    rooms,
    items,
    notes,
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
    visiteId: visite.id
  };

  const computed = applyQuoteTotals(draft);
  const row = quoteToRow(computed, auth.userId);

  const { data: inserted, error } = await auth.supabase.from("quotes").insert(row).select().single();
  if (error) return badRequest(`Création du devis impossible: ${error.message}`, 500);

  const quote = mapQuote(inserted);

  addHistory(db, {
    userId: auth.userId,
    type: "quote.visite_generated",
    label: `Devis généré depuis la visite guidée pour ${offre.description.slice(0, 60)}`,
    entityId: quote.id,
    entityType: "quote",
    meta: { chantierOffreId: offre.id, visiteId: visite.id, totalTtc: quote.totalTtc }
  });
  await writeDb(db);

  return ok({ quote }, 201);
}
