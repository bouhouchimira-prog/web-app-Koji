import { getSupabaseAdmin } from "./supabase";
import { makeToken } from "./db";

// Etat de l'offre en cours de collecte pendant la conversation du nouveau
// chat Radar des Chantiers (9 oct, refonte 100% IA avec tool use — voir
// app/api/radar-chat/route.js). Une ligne par brouillon, dans sa propre
// table (radar_offer_drafts, voir supabase_web_setup.sql) plutot que dans
// le gros blob partage koji_web_state : l'IA peut appeler son outil
// "enregistrer" plusieurs fois par message, ca ne doit jamais reecrire
// l'integralite de l'etat de toute l'application a chaque fois.
//
// Champs valides dans `data` — exactement ceux deja identifies dans la
// cartographie de l'ancien parcours (chat + 6 ecrans de formulaire),
// jamais de nouveau champ invente ici.
export const DRAFT_FIELDS = [
  "intro", "metier", "cadragePrecisions", "rooms",
  "adresse", "cotes", "configuration", "disposition", "etage", "ascenseur", "acces", "stationnement",
  "fournitures", "nettoyage", "etat", "complements",
  "photoPropositions", "equipements", "style", "etatGeneral", "travauxDetail", "travauxPrecisions",
  "photos"
];

export async function createDraft({ userId, conversationId }) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const row = {
    id: makeToken("radar-draft"),
    user_id: userId,
    conversation_id: conversationId,
    status: "en_cours",
    data: {},
    created_at: now,
    updated_at: now
  };
  const { error } = await supabase.from("radar_offer_drafts").insert(row);
  if (error) throw new Error(`Création du brouillon impossible : ${error.message}`);
  return row;
}

export async function getDraft(id) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("radar_offer_drafts").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Lecture du brouillon impossible : ${error.message}`);
  return data;
}

// Fusionne partiellement — jamais d'ecrasement des champs deja connus par
// un champ absent de cet appel (l'IA n'envoie que ce qu'elle vient
// d'apprendre, pas tout l'etat a chaque fois).
export async function updateDraftData(id, partialData) {
  const supabase = getSupabaseAdmin();
  const current = await getDraft(id);
  if (!current) throw new Error("Brouillon introuvable.");
  const filtered = Object.fromEntries(
    Object.entries(partialData || {}).filter(([key]) => DRAFT_FIELDS.includes(key))
  );
  const nextData = { ...current.data, ...filtered };
  const { data, error } = await supabase
    .from("radar_offer_drafts")
    .update({ data: nextData, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`Mise à jour du brouillon impossible : ${error.message}`);
  return data;
}

export async function finishDraft(id) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("radar_offer_drafts")
    .update({ status: "termine", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`Finalisation du brouillon impossible : ${error.message}`);
  return data;
}
