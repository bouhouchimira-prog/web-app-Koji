import { badRequest, ok } from "../../../../../lib/http";
import { getAuth, getVerifiedUserId } from "../../../../../lib/server-auth";
import { fixText } from "../../../../../lib/text";

// Messages du devis (maquette PRO-03.3, carte « Messages ») : le fil que le
// client remplit depuis la page de signature, et que l'app Koji Pro lit déjà
// (table quote_messages). L'entreprise y répond depuis le site.
const TEXTE_MAX = 3000;

async function devisDe(request, context) {
  const { id } = await context.params;
  const auth = getAuth(request);
  if (!auth) return { erreur: badRequest("Session expirée. Reconnectez-vous.", 401) };
  const userId = await getVerifiedUserId(request);
  if (!userId) return { erreur: badRequest("Session expirée. Reconnectez-vous.", 401) };
  const { data: row } = await auth.supabase
    .from("quotes")
    .select("id, metadata")
    .eq("id", String(id || ""))
    .eq("user_id", userId)
    .maybeSingle();
  if (!row) return { erreur: badRequest("Devis introuvable.", 404) };
  const { data: profil } = await auth.supabase.from("users").select("email").eq("id", userId).maybeSingle();
  return { auth, row, email: String(profil?.email || "").toLowerCase() };
}

function versMessage(m, emailEntreprise) {
  const auteur = String(m.author_email || "").toLowerCase();
  return {
    id: m.id,
    texte: m.text || "",
    auteur: m.author_name || "",
    le: m.created_at || "",
    entreprise: Boolean(emailEntreprise) && auteur === emailEntreprise,
    pieces: (m.quote_message_attachments || []).map((a) => a.original_name || "pièce jointe")
  };
}

export async function GET(request, context) {
  const d = await devisDe(request, context);
  if (d.erreur) return d.erreur;
  const { data, error } = await d.auth.supabase
    .from("quote_messages")
    .select("*, quote_message_attachments(*)")
    .eq("quote_id", d.row.id)
    .order("created_at", { ascending: true });
  if (error) return badRequest("Messages indisponibles.", 500);
  return ok({ messages: (data || []).map((m) => versMessage(m, d.email)) });
}

export async function POST(request, context) {
  const d = await devisDe(request, context);
  if (d.erreur) return d.erreur;
  const body = await request.json().catch(() => ({}));
  const texte = fixText(String(body.texte || "")).trim().slice(0, TEXTE_MAX);
  if (!texte) return badRequest("Message vide.");
  const entreprise = fixText(String(d.row.metadata?.company?.name || "")).trim() || "L'entreprise";
  const { data, error } = await d.auth.supabase
    .from("quote_messages")
    .insert({ quote_id: d.row.id, text: texte, author_name: entreprise, author_email: d.email })
    .select()
    .single();
  if (error) return badRequest("Le message n'est pas parti.", 500);
  return ok({ message: versMessage(data, d.email) });
}
