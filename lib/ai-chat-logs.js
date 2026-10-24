import { getSupabaseAdmin } from "./supabase";
import { makeToken } from "./db";

// Journal des conversations avec les assistants IA (25 oct, demande
// d'Amira : toutes les discussions client<->IA et entreprise<->IA doivent
// etre consultables dans koji-admin). Table dediee (ai_conversations, voir
// la migration SQL fournie a part) plutot que le blob partage
// koji_web_state — meme principe que radar_offer_drafts
// (lib/radar-offer-draft.js), une ligne par conversation, mise a jour a
// chaque tour.
//
// `turns` est toujours la conversation LISIBLE ({role,text}), jamais le
// JSON brut des appels d'outils Anthropic — c'est ce qu'un humain (admin)
// doit pouvoir relire, pas la plomberie interne.
export async function upsertConversation({
  kind,
  conversationId,
  particulierUserId = null,
  entrepriseUserId = null,
  draftId = null,
  quoteId = null,
  turns
}) {
  if (!conversationId || !Array.isArray(turns) || turns.length === 0) return;
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data: existing, error: readError } = await supabase
    .from("ai_conversations")
    .select("id")
    .eq("conversation_id", conversationId)
    .maybeSingle();
  if (readError) throw new Error(`Lecture du journal de conversation impossible : ${readError.message}`);

  if (existing) {
    const { error } = await supabase
      .from("ai_conversations")
      .update({ turns, draft_id: draftId, quote_id: quoteId, updated_at: now })
      .eq("id", existing.id);
    if (error) throw new Error(`Mise à jour du journal de conversation impossible : ${error.message}`);
    return;
  }

  const { error } = await supabase.from("ai_conversations").insert({
    id: makeToken("ai-conv"),
    kind,
    conversation_id: conversationId,
    particulier_user_id: particulierUserId,
    entreprise_user_id: entrepriseUserId,
    draft_id: draftId,
    quote_id: quoteId,
    turns,
    started_at: now,
    updated_at: now
  });
  if (error) throw new Error(`Création du journal de conversation impossible : ${error.message}`);
}

// Ne doit JAMAIS casser l'assistant pour l'entreprise/le client — une
// conversation reste utilisable meme si le journal (feature admin
// secondaire) echoue a s'ecrire (ex: table pas encore creee le temps
// qu'Amira execute la migration SQL).
export async function logConversationSafely(params) {
  try {
    await upsertConversation(params);
  } catch (error) {
    console.error("[ai-chat-logs] echec de journalisation (ignore) :", error.message);
  }
}
