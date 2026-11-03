// Adapter for the unified `subscriptions` table (Option B, see
// docs/BILLING_DECISION.md). Single source of truth for a user's plan/status,
// fed by Stripe webhooks and App Store / Play webhooks.
//
// Web and mobile both read from this table via getSubscriptionForUser().

import { getSupabase, getSupabaseAdmin, hasSupabase, hasSupabaseAdmin } from "./supabase.js";

export async function getSubscriptionForUser(userId) {
  if (!userId || !hasSupabaseAdmin()) return null;
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return normalize(data);
  } catch {
    return null;
  }
}

export async function upsertSubscription(sub) {
  if (!sub?.userId || !hasSupabaseAdmin()) return false;
  try {
    const row = denormalize(sub);
    const { error } = await getSupabaseAdmin()
      .from("subscriptions")
      .upsert(row, { onConflict: "user_id,source" });
    return !error;
  } catch {
    return false;
  }
}

export async function listActiveSubscriptions() {
  if (!hasSupabaseAdmin()) return [];
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("subscriptions")
      .select("*")
      .in("status", ["trial", "active"])
      .order("updated_at", { ascending: false });
    if (error || !Array.isArray(data)) return [];
    return data.map(normalize);
  } catch {
    return [];
  }
}

function normalize(row) {
  return {
    id: row.id,
    userId: row.user_id,
    plan: row.plan,
    status: row.status,
    source: row.source,
    interval: row.interval,
    externalId: row.external_id,
    trialEndsAt: row.trial_ends_at,
    currentPeriodEnd: row.current_period_end,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function denormalize(sub) {
  return {
    user_id: sub.userId,
    plan: sub.plan,
    status: sub.status,
    source: sub.source,
    interval: sub.interval || null,
    external_id: sub.externalId || null,
    trial_ends_at: sub.trialEndsAt || null,
    current_period_end: sub.currentPeriodEnd || null,
    updated_at: new Date().toISOString()
  };
}
