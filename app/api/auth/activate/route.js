import { badRequest, ok } from "../../../../lib/http";
import { readUsers, writeUsers } from "../../../../lib/particulier-users";
import { getSupabaseAdmin } from "../../../../lib/supabase";

// Comptes particulier : lib/particulier-users.js (4 oct) — saute le gros
// bloc partage koji_web_state, inutile ici.
async function activateParticulier(token) {
  const users = await readUsers();
  const user = users.find((candidate) => candidate.activationToken === token);
  if (!user) return null;

  if (user.isActive) {
    return { activated: true, alreadyActive: true, message: "Compte deja active.", accountType: "particulier" };
  }
  if (user.activationExpiresAt && new Date(user.activationExpiresAt).getTime() < Date.now()) {
    throw Object.assign(new Error("Lien d'activation expire"), { status: 410 });
  }

  user.isActive = true;
  user.activationToken = null;
  user.activationExpiresAt = null;
  try { await writeUsers(users); } catch { /* non-fatal on read-only filesystems */ }
  return { activated: true, alreadyActive: false, message: "Compte active avec succes.", accountType: "particulier" };
}

// Comptes entreprise (16 oct) : table Supabase `users` partagee avec l'app
// mobile (voir app/api/auth/signup/route.js), colonnes email_verified/
// email_verify_token/email_verify_expires_at.
async function activateEntreprise(token) {
  const admin = getSupabaseAdmin();
  const { data: row } = await admin.from("users").select("id, email_verified, email_verify_expires_at").eq("email_verify_token", token).maybeSingle();
  if (!row) return null;

  if (row.email_verified) {
    return { activated: true, alreadyActive: true, message: "Compte deja active.", accountType: "entreprise" };
  }
  if (row.email_verify_expires_at && new Date(row.email_verify_expires_at).getTime() < Date.now()) {
    throw Object.assign(new Error("Lien d'activation expire"), { status: 410 });
  }

  await admin.from("users").update({ email_verified: true, email_verify_token: null, email_verify_expires_at: null }).eq("id", row.id);
  return { activated: true, alreadyActive: false, message: "Compte active avec succes.", accountType: "entreprise" };
}

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const token = params.get("token");
  const type = params.get("type") === "particulier" ? "particulier" : params.get("type") === "entreprise" ? "entreprise" : "";
  if (!token) return badRequest("Token d'activation manquant", 400);

  try {
    // Type connu : on ne regarde que le bon store. Sinon (ancien lien sans
    // &type=, ou avant ce changement), on essaie les deux plutot que de
    // casser les liens deja envoyes.
    let result = null;
    if (type !== "entreprise") result = await activateParticulier(token);
    if (!result && type !== "particulier") result = await activateEntreprise(token);
    if (!result) return badRequest("Lien d'activation invalide", 404);
    return ok(result);
  } catch (error) {
    return badRequest(error.message || "Activation impossible", error.status || 400);
  }
}

