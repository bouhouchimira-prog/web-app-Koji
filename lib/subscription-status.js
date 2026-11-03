// Helper pour resoudre le plan d'un utilisateur en privilegiant la table
// `subscriptions` (source unifiee, voir docs/BILLING_DECISION.md et
// lib/subscription-store.js). Retombe sur le plan legacy (business_info
// _billingPlan / _grandfathered) si aucune subscription n'existe.
//
// Usage cote web : const plan = await resolveUserPlan(userId, legacyPlan);

import { getSubscriptionForUser } from "./subscription-store.js";

export async function resolveUserPlan(userId, fallbackPlan = "trial") {
  if (!userId) return fallbackPlan;
  try {
    const sub = await getSubscriptionForUser(userId);
    if (!sub) return fallbackPlan;
    // Un abonnement actif/essai l'emporte sur le plan legacy.
    if (sub.status === "active" || sub.status === "trial") {
      return sub.plan || fallbackPlan;
    }
    // Abonnement expire/annule : on garde le plan legacy (souvent "trial").
    return fallbackPlan;
  } catch {
    return fallbackPlan;
  }
}

// Indique si l'utilisateur a un abonnement actif (source unifiee).
export async function hasActiveSubscription(userId) {
  if (!userId) return false;
  try {
    const sub = await getSubscriptionForUser(userId);
    if (!sub) return false;
    if (sub.status === "active") return true;
    if (sub.status === "trial" && sub.trialEndsAt) {
      return new Date(sub.trialEndsAt).getTime() > Date.now();
    }
    return false;
  } catch {
    return false;
  }
}
