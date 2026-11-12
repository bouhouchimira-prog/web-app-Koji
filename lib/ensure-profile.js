// Ligne de profil `users` d'un compte Supabase Auth (12 nov 2026).
//
// Normalement créée par le trigger handle_new_user à l'inscription. En
// production ce trigger n'existe plus : admin/SOLVE_EMAIL_ISSUES.sql a
// réutilisé son nom (on_auth_user_created) pour une autre fonction, donc
// chaque inscription par e-mail (site ou app) donnait un compte sans profil.
// Conséquences vues le 12 nov : « Mot de passe oublié » sans e-mail, lien
// d'activation du site invalide, compte absent de koji-admin.
// supabase/migrations/0010_profil_a_l_inscription.sql remet le trigger ; ces
// fonctions réparent aussi les comptes au passage, trigger ou pas.
//
// Le client admin (clé service_role) est passé par l'appelant : ce fichier
// n'importe rien, il reste testable sans Supabase.

function lireIsPro(meta, isProFallback) {
  const valeur = meta?.is_pro;
  if (typeof valeur === "boolean") return valeur;
  if (valeur === "true") return true;
  if (valeur === "false") return false;
  return isProFallback;
}

/** Ligne à insérer pour un compte Auth qui n'a pas encore de profil. */
export function profileRowFor(authUser, { isProFallback = true } = {}) {
  const meta = authUser?.user_metadata || {};
  const fullName = String(meta.full_name || meta.name || "").trim();
  return {
    id: authUser.id,
    email: String(authUser.email || "").trim().toLowerCase(),
    is_pro: lireIsPro(meta, isProFallback),
    ...(fullName ? { full_name: fullName } : {}),
    // Valeur par défaut de la colonne. Seule l'inscription du site la passe
    // à false le temps de son propre e-mail d'activation ; une adresse non
    // confirmée est de toute façon refusée par Supabase à la connexion.
    email_verified: true,
    created_at: authUser.created_at || new Date().toISOString()
  };
}

/**
 * Renvoie la ligne `users` du compte, en la créant si elle manque. Ne modifie
 * jamais une ligne existante.
 */
export async function ensureProfileRow(admin, authUser, options = {}) {
  const lire = () => admin.from("users").select("*").eq("id", authUser.id).maybeSingle();
  const { data: existante, error: erreurLecture } = await lire();
  if (erreurLecture) throw new Error(erreurLecture.message);
  if (existante) return existante;

  const { error } = await admin
    .from("users")
    .upsert(profileRowFor(authUser, options), { onConflict: "id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);

  const { data: creee, error: erreurRelecture } = await lire();
  if (erreurRelecture) throw new Error(erreurRelecture.message);
  return creee;
}

/**
 * Compte Supabase Auth d'une adresse, ou null. L'API admin ne filtre pas par
 * e-mail : on parcourt les pages (quelques dizaines de comptes aujourd'hui).
 */
export async function findAuthUserByEmail(admin, email, { perPage = 1000, maxPages = 20 } = {}) {
  const cible = String(email || "").trim().toLowerCase();
  if (!cible) return null;
  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const users = data?.users || [];
    const trouve = users.find((u) => String(u.email || "").toLowerCase() === cible);
    if (trouve) return trouve;
    if (users.length < perPage) return null;
  }
  return null;
}
