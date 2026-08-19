import { isAdminEmail } from "./auth";

// The shared `users` table has: id, email, is_pro, profession,
// is_profile_complete, is_business_info_complete, business_info JSONB, logo_url.
// Web-only profile data (personal info, professions list, account type, name)
// is kept inside business_info under _-prefixed keys so no schema change is
// needed; plain keys stay the business fields shown in the app.

export function splitBusinessInfo(businessInfo = {}) {
  const business = {};
  const extras = {};
  for (const [key, value] of Object.entries(businessInfo || {})) {
    if (key.startsWith("_")) extras[key] = value;
    else business[key] = value;
  }
  return { business, extras };
}

export function buildWebUser({ id, email, profile = null, accountTypeFallback = "entreprise" }) {
  const { business, extras } = splitBusinessInfo(profile?.business_info);
  const personal = extras._personal || {};
  const professions = Array.isArray(extras._professions)
    ? extras._professions
    : profile?.profession
      ? [profile.profession]
      : [];
  const personalName = [personal.firstName, personal.lastName].filter(Boolean).join(" ").trim();
  const resolvedEmail = profile?.email || email || "";
  // Real plan tracking (see lib/stripe.js): a paid plan set by the Stripe
  // webhook always wins; accounts created before Stripe billing existed were
  // flagged _grandfathered (scripts/grandfather-existing-users.js) so they
  // keep unlimited access instead of suddenly hitting trial limits; anyone
  // else (new signups with no subscription yet) is on the trial plan.
  const billingPlan = extras._billingPlan || "";
  const plan = billingPlan || (extras._grandfathered ? "business" : "trial");
  return {
    id,
    email: resolvedEmail,
    name: extras._name || personalName || resolvedEmail.split("@")[0] || "Utilisateur",
    accountType:
      extras._accountType || (profile && profile.is_pro === false ? "particulier" : accountTypeFallback),
    isActive: true,
    isAdmin: isAdminEmail(resolvedEmail),
    plan,
    billingInterval: extras._billingInterval || null,
    billingStatus: extras._billingStatus || null,
    hasBillingAccount: Boolean(extras._stripeCustomerId),
    profileComplete: Boolean(profile?.is_profile_complete),
    businessInfoComplete: Boolean(profile?.is_business_info_complete),
    personalInfoComplete: Boolean(
      personal.firstName || personal.lastName || personal.phone || personal.address
    ),
    business,
    personal,
    professions,
    logoUrl: profile?.logo_url || "",
    createdAt: profile?.created_at || "",
    updatedAt: profile?.updated_at || ""
  };
}
