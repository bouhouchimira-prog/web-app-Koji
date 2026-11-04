// @koji/shared — code partage entre les apps web (root), worker, signature.
//
// Pour l'instant, ce package est un squelette : il re-exporte les modules
// de lib/ du root via des copies. La migration complete (remplacer les
// copies par des imports @koji/shared dans chaque app) se fera par etapes
// pour ne pas casser les builds existants (voir docs/MONOREPO_PLAN.md).
//
// Modules partages (a terme) :
//   - supabase (client anon + service role + getSupabaseForToken)
//   - http (badRequest/ok)
//   - text (fixText/fixObjectText)
//   - server-auth (getAuth/getVerifiedUserId)
//   - session-cookies (cookies HttpOnly)
//   - password-hash (scrypt)
//   - worker-auth (hash/verify worker passwords)
//   - logger (logger structure)
//   - validators (required/maxLength/isEmail/validateFields)
export * from "./supabase.js";
export * from "./http.js";
export * from "./text.js";
export * from "./server-auth.js";
export * from "./session-cookies.js";
export * from "./password-hash.js";
export * from "./worker-auth.js";
export * from "./logger.js";
export * from "./validators.js";
