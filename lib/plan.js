export const TRIAL_QUOTE_LIMIT = 1;
export const TRIAL_EDIT_LIMIT = 10;

export const PLAN_LIMITS = {
  go: { quoteLimit: 4, label: "Koji GO" },
  premium: { quoteLimit: 30, label: "Koji Premium", displayUnlimited: true },
  business: { quoteLimit: Infinity, label: "Koji Business" },
  // Legacy values kept for accounts created before the named plans existed.
  active: { quoteLimit: Infinity, label: "Koji Business" },
  subscribed: { quoteLimit: Infinity, label: "Koji Business" }
};

export function isTrialUser(user) {
  if (!user || user.isAdmin) return false;
  return !user.plan || user.plan === "trial";
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function quotesCreatedThisMonth(db, userId) {
  const key = monthKey();
  return (db.quotes || []).filter((quote) => quote.userId === userId && String(quote.createdAt || "").slice(0, 7) === key).length;
}

// Paid plans: gate at creation time, counted per calendar month.
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
// but sending it is blocked until the user upgrades.
export function checkTrialSendLimit(user, quote) {
  if (!user || user.isAdmin || !isTrialUser(user)) return { allowed: true };
  if (!user.trialQuoteId || user.trialQuoteId === quote.id) return { allowed: true };
  return {
    allowed: false,
    reason: "Votre periode d'essai permet l'envoi d'un seul devis. Passez a une formule pour envoyer ce nouveau devis."
  };
}

// Trial: only the first (or claimed) quote may be generated/previewed as PDF.
// If trialQuoteId is set, only that quote is allowed. If not set yet, only the oldest quote is allowed.
export function checkTrialGenerateLimit(db, user, quote) {
  if (!user || user.isAdmin || !isTrialUser(user)) return { allowed: true };
  if (user.trialQuoteId) {
    if (user.trialQuoteId === quote.id) return { allowed: true };
    return {
      allowed: false,
      reason: "Votre periode d'essai inclut la generation d'un seul devis. Passez a une formule Koji pour debloquer ce devis."
    };
  }
  const userQuotes = (db.quotes || [])
    .filter((q) => q.userId === user.id)
    .sort((a, b) => new Date(a.createdAtIso || a.createdAt || 0) - new Date(b.createdAtIso || b.createdAt || 0));
  if (userQuotes.length <= 1 || !userQuotes[0] || userQuotes[0].id === quote.id) return { allowed: true };
  return {
    allowed: false,
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
