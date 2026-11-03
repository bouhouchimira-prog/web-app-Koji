# @koji/shared

Code partagé entre les apps web (root), worker, signature, admin.

## État actuel (squelette)

Ce package contient des **copies** des modules de `lib/` du root. Il n'est pas
encore utilisé par les apps (qui importent toujours depuis `lib/` ou
`../lib/`). La migration vers `@koji/shared` se fera par étapes pour ne pas
casser les builds.

## Modules partagés

- `supabase.js` — client anon + service role + getSupabaseForToken
- `http.js` — badRequest/ok
- `text.js` — fixText/fixObjectText
- `server-auth.js` — getAuth/getVerifiedUserId
- `session-cookies.js` — cookies HttpOnly
- `password-hash.js` — scrypt
- `worker-auth.js` — hash/verify worker passwords
- `logger.js` — logger structuré
- `validators.js` — required/maxLength/isEmail/validateFields

## Migration (voir docs/MONOREPO_PLAN.md)

1. Workspaces : ✅ ajouté dans package.json racine
2. Package partagé : ✅ squelette créé
3. Remplacer les copies dans worker/signature/admin par imports `@koji/shared`
4. Aligner les versions de Next.js (15 vs 16)
5. Turbo : ✅ turbo.json créé
6. CI unifié : à faire
