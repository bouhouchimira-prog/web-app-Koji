import { badRequest, ok } from "../../../../lib/http";
import { getAuth } from "../../../../lib/server-auth";
import { buildWebUser, splitBusinessInfo } from "../../../../lib/user-profile";

// Profile lives in the Supabase `users` table (same row the mobile app reads).
// See lib/user-profile.js for how web-only fields are stored in business_info.

async function fetchProfile(auth) {
  const { data, error } = await auth.supabase
    .from("users")
    .select("*")
    .eq("id", auth.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

export async function GET(request) {
  const auth = getAuth(request);
  if (!auth) return ok({ user: null });
  try {
    const profile = await fetchProfile(auth);
    return ok({ user: buildWebUser({ id: auth.userId, email: profile?.email || "", profile }) });
  } catch (error) {
    return badRequest(`Lecture du profil impossible: ${error.message}`, 500);
  }
}

export async function PATCH(request) {
  const body = await request.json();
  const auth = getAuth(request, body);
  if (!auth) return badRequest("Session expirée. Reconnectez-vous.", 401);

  let profile;
  try {
    profile = await fetchProfile(auth);
  } catch (error) {
    return badRequest(`Lecture du profil impossible: ${error.message}`, 500);
  }

  const { business, extras } = splitBusinessInfo(profile?.business_info);
  const updates = {};

  if (body.business) {
    Object.assign(business, body.business);
    updates.is_business_info_complete = true;
  }
  if (body.personal) {
    extras._personal = { ...(extras._personal || {}), ...body.personal };
    const fullName = [extras._personal.firstName, extras._personal.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (fullName) extras._name = fullName;
  }
  if (body.professions) {
    extras._professions = body.professions;
    updates.profession = body.professions[0] || null;
    updates.is_profile_complete = body.professions.length > 0;
  }
  if (body.accountType) {
    extras._accountType = body.accountType;
    updates.is_pro = body.accountType !== "particulier";
  }
  if (body.name) extras._name = body.name;
  if (body.logoUrl) updates.logo_url = body.logoUrl;

  updates.business_info = { ...business, ...extras };
  updates.updated_at = new Date().toISOString();

  const row = {
    id: auth.userId,
    email: profile?.email || body.email || "",
    ...updates
  };
  const { data, error } = await auth.supabase
    .from("users")
    .upsert(row)
    .select()
    .single();
  if (error) return badRequest(`Enregistrement du profil impossible: ${error.message}`, 500);

  return ok({ user: buildWebUser({ id: auth.userId, email: data.email, profile: data }) });
}
