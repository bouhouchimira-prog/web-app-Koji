// Expéditeur des e-mails de compte (14 nov 2026).
//
// Supabase envoie déjà ses e-mails (confirmation d'inscription dans les apps,
// mot de passe oublié des anciennes versions) depuis noreply@getkoji.io. Les
// e-mails de compte envoyés par le site (activation, mot de passe oublié)
// partent maintenant de la même boîte, avec ses propres identifiants
// (SMTP_NOREPLY_USER / SMTP_NOREPLY_PASS sur Vercel). Les autres e-mails
// (devis, factures, messages aux clients…) restent sur SMTP_USER (contact@),
// car on doit pouvoir y répondre.
//
// Sans ces variables : null, et tout part de SMTP_USER comme avant.
export function configNoreply(env = process.env) {
  const user = String(env.SMTP_NOREPLY_USER || "").trim();
  const pass = String(env.SMTP_NOREPLY_PASS || "");
  const host = String(env.SMTP_HOST || "").trim();
  if (!user || !pass || !host) return null;
  return {
    host,
    port: Number(env.SMTP_PORT || 587),
    user,
    pass,
    from: `Koji <${user}>`
  };
}
