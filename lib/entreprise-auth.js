import { getAccessToken, getVerifiedUserId } from "./server-auth";
import { getSupabaseForToken } from "./supabase";
import { buildWebUser } from "./user-profile";
import { isTrialUser } from "./plan";

// Shared by every Radar des Chantiers route that needs to know "is this an
// entreprise, and what's their business profile" — messages, positionnement,
// marketplace listing (zone/metier filtering), devis IA, etc.
//
// getVerifiedUserId checks the token's signature against Supabase Auth
// itself (unlike getAuth's plain decode) — the right check to gate access
// on, since a forged token must not be able to read another company's data.
// The RLS-scoped client is only needed afterward, to read this now-verified
// caller's own business_info.
export async function resolveEntreprise(request, body = null) {
  const userId = await getVerifiedUserId(request, body);
  if (!userId) return null;
  const token = getAccessToken(request, body);
  return { userId, supabase: getSupabaseForToken(token) };
}

export async function loadEntrepriseProfile(entreprise) {
  const { data: profile } = await entreprise.supabase
    .from("users")
    .select("*")
    .eq("id", entreprise.userId)
    .maybeSingle();
  return buildWebUser({ id: entreprise.userId, email: profile?.email || "", profile });
}

export async function loadEntrepriseSnapshot(entreprise) {
  const webUser = await loadEntrepriseProfile(entreprise);
  return {
    raisonSociale: webUser.business?.raisonSociale || webUser.name || "Une entreprise",
    address: webUser.business?.address || "",
    phone: webUser.business?.phone || "",
    website: webUser.business?.website || "",
    isPro: Boolean(webUser.isAdmin) || !isTrialUser(webUser),
    // Palier reel (24 oct, plafond de positions par plan) — reutilise le
    // meme aller-retour profil que ci-dessus, pas une 2e requete.
    plan: webUser.plan || ""
  };
}
