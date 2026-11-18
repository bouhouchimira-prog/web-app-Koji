import { getSupabaseAdmin, hasSupabaseAdmin } from "./supabase.js";

// Profil de l'entreprise pour ses documents (PRO-25) : identité, décennale,
// dirigeant, lus dans la table Supabase « users » (les comptes entreprise
// n'existent pas dans la base JSON). Sans profil, le document garde
// l'instantané enregistré avec le devis.
export async function profilEntreprise(userId) {
  if (!userId || !hasSupabaseAdmin) return null;
  try {
    const { data } = await getSupabaseAdmin().from("users").select("full_name, business_info").eq("id", userId).maybeSingle();
    return data || null;
  } catch {
    return null;
  }
}

// Attache le profil au db lu par la route, en propriété non énumérable :
// il sert au générateur (companyFromDb) sans jamais être réécrit dans la
// base par un writeDb ultérieur.
export async function avecProfil(db, userId) {
  if (!db || !userId) return db;
  if (!Object.prototype.hasOwnProperty.call(db, "profilsEntreprise")) {
    Object.defineProperty(db, "profilsEntreprise", { value: {}, enumerable: false, writable: true });
  }
  if (!(userId in db.profilsEntreprise)) db.profilsEntreprise[userId] = await profilEntreprise(userId);
  return db;
}
