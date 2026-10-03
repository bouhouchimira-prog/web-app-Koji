import { getVerifiedUserId } from "./server-auth";
import { getVerifiedPortalUserId } from "./portal-session";
import { getVerifiedWorkerId } from "./worker-session";
import { getSupabaseAdmin } from "./supabase";
import { splitBusinessInfo } from "./user-profile";

// Extrait de app/api/support/report/route.js (29 septembre) — reutilise ici
// pour les demandes de suppression de compte (RGPD art. 17), meme besoin
// exact : identifier laquelle des 3 sessions (entreprise/particulier/
// ouvrier) fait la demande, sans jamais faire confiance a un id fourni par
// le client.
export async function resolveAnySession(request, body) {
  const companyId = await getVerifiedUserId(request, body);
  if (companyId) return { kind: "entreprise", id: companyId };
  const portalId = getVerifiedPortalUserId(request, body);
  if (portalId) return { kind: "particulier", id: portalId };
  const workerId = getVerifiedWorkerId(request, body);
  if (workerId) return { kind: "ouvrier", id: workerId };
  return null;
}

async function companyDisplayName(companyId) {
  try {
    const { data } = await getSupabaseAdmin()
      .from("users")
      .select("business_info")
      .eq("id", companyId)
      .maybeSingle();
    const { business } = splitBusinessInfo(data?.business_info);
    return business.raisonSociale || "";
  } catch {
    return "";
  }
}

// So notification emails say *who* is asking (name, email, which company)
// instead of a bare account id that would need a manual lookup.
export async function resolveIdentity(session, db) {
  if (session.kind === "entreprise") {
    try {
      const { data } = await getSupabaseAdmin()
        .from("users")
        .select("email, business_info")
        .eq("id", session.id)
        .maybeSingle();
      const { business, extras } = splitBusinessInfo(data?.business_info);
      const personal = extras._personal || {};
      const personalName = [personal.firstName, personal.lastName].filter(Boolean).join(" ").trim();
      return {
        name: extras._name || personalName || business.raisonSociale || "",
        email: data?.email || "",
        company: business.raisonSociale || ""
      };
    } catch {
      return { name: "", email: "", company: "" };
    }
  }
  if (session.kind === "particulier") {
    const user = (db.users || []).find((u) => u.id === session.id);
    return { name: user?.name || "", email: user?.email || "", company: "" };
  }
  if (session.kind === "ouvrier") {
    const worker = (db.workers || []).find((w) => w.id === session.id);
    const company = worker?.userId ? await companyDisplayName(worker.userId) : "";
    return { name: worker?.name || "", email: worker?.email || "", company };
  }
  return { name: "", email: "", company: "" };
}
