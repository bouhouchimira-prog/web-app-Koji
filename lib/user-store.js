// Adapter for the unified user store.
//
// Long-term goal (see docs/USERS_UNIFICATION.md): make the Supabase `users`
// table the single source of truth for ALL user data (entreprise + particulier),
// replacing the dual storage (table `users` + blob `koji_web_state.users` +
// `particulier_users_state`).
//
// This module is the bridge: it reads user data from Supabase first, with
// fallback to the legacy blob collections, so callers can migrate
// incrementally without breaking existing flows.

import { getSupabase, getSupabaseAdmin, hasSupabase, hasSupabaseAdmin } from "./supabase.js";
import { fixText } from "./text.js";

// Read a single user by id from Supabase (service role, bypasses RLS).
export async function getUserFromSupabase(userId) {
  if (!userId || !hasSupabaseAdmin()) return null;
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("users")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error || !data) return null;
    return normalizeSupabaseUser(data);
  } catch {
    return null;
  }
}

// Read a single user by email.
export async function getUserByEmailFromSupabase(email) {
  if (!email || !hasSupabaseAdmin()) return null;
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("users")
      .select("*")
      .eq("email", String(email).trim().toLowerCase())
      .maybeSingle();
    if (error || !data) return null;
    return normalizeSupabaseUser(data);
  } catch {
    return null;
  }
}

// Read all users (admin only).
export async function getAllUsersFromSupabase() {
  if (!hasSupabaseAdmin()) return [];
  try {
    const { data, error } = await getSupabaseAdmin().from("users").select("*");
    if (error || !Array.isArray(data)) return [];
    return data.map(normalizeSupabaseUser);
  } catch {
    return [];
  }
}

// Write (upsert) a user row.
export async function upsertUserToSupabase(user) {
  if (!user?.id || !hasSupabaseAdmin()) return false;
  try {
    const row = denormalizeToSupabase(user);
    const { error } = await getSupabaseAdmin().from("users").upsert(row, { onConflict: "id" });
    return !error;
  } catch {
    return false;
  }
}

function normalizeSupabaseUser(row) {
  return {
    id: row.id,
    email: fixText(row.email || ""),
    fullName: fixText(row.full_name || row.name || ""),
    companyName: fixText(row.company_name || ""),
    phone: fixText(row.phone || ""),
    address: fixText(row.address || ""),
    accountType: row.account_type || row.is_pro ? "entreprise" : "particulier",
    isPro: row.is_pro === true,
    isAdmin: row.is_admin === true,
    isProfileComplete: row.is_profile_complete === true,
    isBusinessInfoComplete: row.is_business_info_complete === true,
    logoUrl: row.logo_url || "",
    businessInfo: row.business_info || {},
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

function denormalizeToSupabase(user) {
  return {
    id: user.id,
    email: user.email,
    full_name: user.fullName,
    company_name: user.companyName,
    phone: user.phone,
    address: user.address,
    is_pro: user.isPro,
    is_admin: user.isAdmin,
    is_profile_complete: user.isProfileComplete,
    is_business_info_complete: user.isBusinessInfoComplete,
    logo_url: user.logoUrl,
    business_info: user.businessInfo,
    updated_at: new Date().toISOString()
  };
}
