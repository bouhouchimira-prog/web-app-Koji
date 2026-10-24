// Ecrit les champs modifies par un garde-fou d'essai (trialQuoteId/
// trialSaveCount/trialStartedAt) dans business_info — les fonctions
// checkTrial* ci-dessous restent pures (aucun acces reseau), c'est
// l'appelant qui persiste via ce helper une fois le gate passe (30 sept :
// avant ca, gate.claim/gate.nextCount n'etaient jamais lus nulle part, donc
// jamais ecrits — la premiere verification "bonne" ne s'enregistrait pas et
// le garde-fou repartait de zero a chaque requete).
export async function persistTrialPatch(supabase, userId, patch) {
  if (!patch || Object.keys(patch).length === 0) return;
  const { data: profile } = await supabase.from("users").select("business_info").eq("id", userId).maybeSingle();
  const currentInfo = profile?.business_info || {};
  await supabase.from("users").update({ business_info: { ...currentInfo, ...patch } }).eq("id", userId);
}

export const TRIAL_QUOTE_LIMIT = 1;
export const TRIAL_EDIT_LIMIT = 10;

// 3 paliers (24 oct) : Pro et Business. Devis/chantiers restent illimites
// pour toute formule payante (seul le palier gratuit Start, pas encore
// reecrit ici, a un vrai plafond affiche sur la page publique — voir
// limitation Phase 1 dans le plan).
export const PLAN_LIMITS = {
  pro: { quoteLimit: Infinity, label: "Koji Pro" },
  business: { quoteLimit: Infinity, label: "Koji Business" },
  // Legacy values kept for accounts flagged before the 3-tier model.
  active: { quoteLimit: Infinity, label: "Koji Pro" },
  subscribed: { quoteLimit: Infinity, label: "Koji Pro" }
};

export function isTrialUser(user) {
  if (!user || user.isAdmin) return false;
  return !user.plan || user.plan === "trial";
}

// Koji Premium (23 septembre) : deuxieme abonnement, cumulatif avec Koji
// Pro, requis pour Calendrier/Chantiers/Contacts/Equipe/Facturation/
// Fournitures — gratuit pour les comptes admin (components/Shell.jsx et
// toute route qui doit verifier cet acces cote serveur reutilisent ce
// meme helper).
export function hasPremiumAccess(user) {
  return Boolean(user?.isAdmin || user?.premiumTools);
}

// Plafond de positions simultanees sur le Radar des Chantiers, par palier
// (24 oct, page publique /abonnement) — remplace l'ancienne constante fixe
// MAX_ACTIVE_POSITIONNEMENTS=5 de positionner/route.js, desormais
// dependante du plan de l'entreprise appelante. Start (gratuit) et tout
// compte sans palier reconnu (trial, legacy) retombent sur START_POSITION_LIMIT.
export const START_POSITION_LIMIT = 2;
export const POSITION_LIMITS = {
  business: 15,
  pro: 5,
  // Valeurs historiques (meme formule que Koji Pro avant ce redesign).
  active: 5,
  subscribed: 5
};

export function maxPositionsForPlan(plan) {
  return POSITION_LIMITS[plan] ?? START_POSITION_LIMIT;
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function quotesCreatedThisMonth(db, userId) {
  const key = monthKey();
  return (db.quotes || []).filter((quote) => quote.userId === userId && String(quote.createdAt || "").slice(0, 7) === key).length;
}

// Paid plans: gate at creation time, counted per calendar month. Sans effet
// aujourd'hui (PLAN_LIMITS ne definit que des formules illimitees), garde
// pour un futur palier payant limite — ne pas la brancher tant que ce cas
// n'existe pas.
export function checkQuoteCreationLimit(db, user) {
  if (!user || user.isAdmin || isTrialUser(user)) return { allowed: true };
  const planConfig = PLAN_LIMITS[user.plan];
  if (!planConfig || planConfig.quoteLimit === Infinity) return { allowed: true };
  const count = quotesCreatedThisMonth(db, user.id);
  if (count >= planConfig.quoteLimit) {
    return {
      allowed: false,
      reason: `Limite de ${planConfig.quoteLimit} devis par mois atteinte pour la formule ${planConfig.label}. Passez a une formule superieure pour creer un nouveau devis.`
    };
  }
  return { allowed: true };
}

// Trial: only one quote may ever be sent to a client. Drafting a second quote is fine,
// but sending it is blocked until the user upgrades. `claim` tells the caller to
// persist trialQuoteId (via persistTrialPatch) when this is the first send.
export function checkTrialSendLimit(user, quote) {
  if (!user || user.isAdmin || !isTrialUser(user)) return { allowed: true, claim: false };
  if (!user.trialQuoteId || user.trialQuoteId === quote.id) return { allowed: true, claim: !user.trialQuoteId };
  return {
    allowed: false,
    claim: false,
    reason: "Votre periode d'essai permet l'envoi d'un seul devis. Passez a une formule pour envoyer ce nouveau devis."
  };
}

// Trial: only the first (or claimed) quote may be generated/previewed as PDF.
// If trialQuoteId is set, only that quote is allowed. If not set yet, only the
// oldest quote is allowed. `userQuotes` must be the caller's REAL quotes for
// this user (Supabase `quotes` table — the koji_web_state `db.quotes` array
// used here before 30 sept was always empty post-migration, so this gate
// silently never triggered), each item needing at least {id, createdAtIso}.
export function checkTrialGenerateLimit(user, userQuotes, quote) {
  if (!user || user.isAdmin || !isTrialUser(user)) return { allowed: true, claim: false };
  if (user.trialQuoteId) {
    if (user.trialQuoteId === quote.id) return { allowed: true, claim: false };
    return {
      allowed: false,
      claim: false,
      reason: "Votre periode d'essai inclut la generation d'un seul devis. Passez a une formule Koji pour debloquer ce devis."
    };
  }
  const sorted = [...(userQuotes || [])].sort((a, b) => new Date(a.createdAtIso || a.createdAt || 0) - new Date(b.createdAtIso || b.createdAt || 0));
  if (sorted.length <= 1 || !sorted[0] || sorted[0].id === quote.id) return { allowed: true, claim: true };
  return {
    allowed: false,
    claim: false,
    reason: "Votre periode d'essai inclut la generation d'un seul devis. Passez a une formule Koji pour debloquer ce devis."
  };
}

// Trial: the one allowed quote can only be manually saved (Generer/Apercu/Confirmer/Envoyer) up to 10 times.
export function checkTrialEditLimit(user, quoteId) {
  if (!user || user.isAdmin || !isTrialUser(user)) return { allowed: true, nextCount: 0, claim: false };
  if (user.trialQuoteId && user.trialQuoteId !== quoteId) return { allowed: true, nextCount: 0, claim: false };
  const nextCount = (user.trialSaveCount || 0) + 1;
  if (nextCount > TRIAL_EDIT_LIMIT) {
    return {
      allowed: false,
      nextCount: user.trialSaveCount || 0,
      claim: !user.trialQuoteId,
      reason: `Limite de ${TRIAL_EDIT_LIMIT} modifications atteinte pour votre devis d'essai. Passez a une formule pour continuer a le modifier.`
    };
  }
  return { allowed: true, nextCount, claim: !user.trialQuoteId };
}
