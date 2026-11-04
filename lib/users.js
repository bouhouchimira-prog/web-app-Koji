// Adapter de lecture utilisateur pour la migration vers la source unifiee
// (table Supabase `users`). Priorite a `lib/user-store.js` (Supabase), avec
// repli sur la collection legacy db.users (blob) pour ne rien casser tant que
// la migration n'est pas complete.
//
// Voir docs/USERS_UNIFICATION.md pour le plan complet.

import { getUserFromSupabase } from "./user-store.js";

export async function findUserById(db, userId) {
  if (!userId) return null;
  // 1. Tenter la source unifiee (table Supabase users).
  try {
    const unified = await getUserFromSupabase(userId);
    if (unified) return unified;
  } catch {
    // tomber sur le repli legacy
  }
  // 2. Repli : collection legacy dans le blob.
  return (db.users || []).find((u) => u.id === userId) || null;
}

export async function findUserByEmail(db, email) {
  if (!email) return null;
  const normalized = String(email).trim().toLowerCase();
  try {
    const { getUserByEmailFromSupabase } = await import("./user-store.js");
    const unified = await getUserByEmailFromSupabase(normalized);
    if (unified) return unified;
  } catch {
    // repli legacy
  }
  return (db.users || []).find((u) => String(u.email || "").trim().toLowerCase() === normalized) || null;
}
