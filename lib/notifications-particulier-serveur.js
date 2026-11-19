import { getSupabaseAdmin } from "./supabase.js";
import { mapQuote } from "./quote-mapping.js";
import { estSigne } from "./projets-client.js";
import { notifierParticuliers, particuliersDuDevis } from "./notifications-particulier.js";

// Notifications du particulier (CLI-04), côté serveur : retrouve les comptes
// Koji Client du devis puis ajoute la notification dans db.notifications
// (écrite par l'appelant avec le reste de sa requête). Une erreur ici ne
// fait jamais échouer l'action de l'entreprise.

async function emailDuChantier(projectId) {
  if (!projectId) return "";
  const { data } = await getSupabaseAdmin().from("chantiers").select("client_email").eq("id", projectId).maybeSingle();
  return String(data?.client_email || "");
}

// Le devis d'un chantier (le signé d'abord), lu avec la clé de service.
export async function devisDuChantier(projectId, userId) {
  if (!projectId) return null;
  const { data } = await getSupabaseAdmin().from("quotes").select("*").eq("chantier_id", projectId);
  const devis = (data || []).map((row) => mapQuote(row)).filter((q) => !userId || q.userId === userId);
  return devis.find(estSigne) || devis[0] || null;
}

// [remplace] : notifications non lues à retirer avant d'ajouter la nouvelle
// (un devis renvoyé ne s'empile pas).
export async function notifierParticuliersDuDevis(db, quote, notif, { remplace = null, maintenant = new Date().toISOString() } = {}) {
  try {
    if (!quote?.id || !notif || quote.internalOnly) return 0;
    const ids = particuliersDuDevis(db.users || [], quote, await emailDuChantier(quote.projectId));
    if (!ids.length) return 0;
    if (remplace) {
      db.notifications = (db.notifications || []).filter((n) => !(ids.includes(n.userId) && !n.read && remplace(n)));
    }
    return notifierParticuliers(db, ids, notif, maintenant);
  } catch {
    return 0;
  }
}
