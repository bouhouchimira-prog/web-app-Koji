import { badRequest, ok } from "../../../lib/http";
import { readDb, writeDb } from "../../../lib/db";
import { loadEntrepriseProfile, resolveEntreprise } from "../../../lib/entreprise-auth";
import { getSupabaseAdmin } from "../../../lib/supabase";
import { fixText } from "../../../lib/text";
import { CANAUX, EVENEMENTS, LANGUES, REGIMES_TVA, conditionsDefaut, disponibilitesDe, etapesProfil, masquerSiren, mediateurDe, mentionsObligatoires, prochainNumero, qualificationsDe, regimeTva, sirenDe } from "../../../lib/compte-pro";
import { enregistrerPrefs, prefsCompte } from "../../../lib/compte-serveur";
import { contexteRadar } from "../../../lib/radar-server";

// Profil et compte (maquettes PRO-15 à 15.6) : tout ce que la page
// Paramètres affiche. GET → profil, étapes, réglages, résumé de chaque
// section ; PATCH { notifications?, langue?, profil? } → réglages du compte.
// Les champs de l'entreprise (TVA, médiateur, disponibilités…) passent par
// /api/auth/profile, comme le reste du profil.
const t = (v, max) => fixText(String(v ?? "")).trim().slice(0, max);

async function contexte(request, body = null) {
  const entreprise = await resolveEntreprise(request, body);
  if (!entreprise) return { erreur: badRequest("Session expirée. Reconnectez-vous.", 401) };
  return { entreprise, userId: entreprise.userId, webUser: await loadEntrepriseProfile(entreprise) };
}

export async function GET(request) {
  const cx = await contexte(request);
  if (cx.erreur) return cx.erreur;
  const { entreprise, userId, webUser } = cx;
  const db = await readDb();
  const b = webUser.business || {};
  const prefs = prefsCompte(db, userId);
  const taux = Object.values(db.tauxParFamille?.[userId]?.taux || {}).filter((x) => Number(x?.taux ?? x) > 0).length;
  const [auth, radar] = await Promise.all([
    getSupabaseAdmin().auth.admin.getUserById(userId).then((r) => r.data?.user || null, () => null),
    contexteRadar(db, entreprise).catch(() => null)
  ]);
  const fournisseurs = [...new Set((auth?.identities || []).map((i) => i.provider))];
  const mesFactures = (db.invoices || []).filter((i) => i.userId === userId && i.invoiceNumber && i.kind !== "avoir").map((i) => String(i.invoiceNumber)).sort();
  const perso = webUser.personal || {};
  const plan = webUser.isAdmin ? "business" : String(webUser.plan || "trial");
  return ok({
    profil: {
      prenom: perso.firstName || "", nom: perso.lastName || "", telephone: perso.phone || "", email: webUser.email || auth?.email || "",
      role: "Dirigeant · accès complet", motDePasse: fournisseurs.includes("email"), google: fournisseurs.includes("google"), apple: fournisseurs.includes("apple"),
      derniereConnexion: auth?.last_sign_in_at || ""
    },
    entreprise: { nom: b.raisonSociale || "", siren: masquerSiren(sirenDe(b)), forme: b.formeJuridique || "", tva: b.tva || "" },
    etapes: etapesProfil(b, { professions: webUser.professions || [], tauxRegles: taux }),
    plan,
    jetons: radar?.solde ? { solde: radar.solde.solde, reserves: radar.solde.reserves, debitesMois: radar.solde.debitesMois, inclus: radar.solde.inclus, achetes: radar.solde.achetes } : null,
    devis: {
      regime: regimeTva(b), regimes: REGIMES_TVA, tva: b.tva || "", conditions: conditionsDefaut(b), prochaineFacture: prochainNumero(mesFactures.at(-1) || ""),
      iban: Boolean(String(b.iban || "").trim()), mediateur: mediateurDe(b), mentions: mentionsObligatoires(b), cgv: b.cgv?.nom ? { nom: b.cgv.nom, le: b.cgv.le || "" } : null,
      tauxRegles: taux
    },
    disponibilites: disponibilitesDe(b),
    qualifications: qualificationsDe(b),
    notifications: prefs.notifications,
    evenements: EVENEMENTS,
    canaux: CANAUX,
    langue: prefs.langue,
    langues: LANGUES
  });
}

// Se déconnecter de tous les appareils (PRO-15.6) : toutes les sessions du
// compte, celle-ci comprise.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const cx = await contexte(request, body);
  if (cx.erreur) return cx.erreur;
  if (body.action !== "deconnecter-partout") return badRequest("Action inconnue.");
  const { getAccessToken } = await import("../../../lib/server-auth");
  const jeton = getAccessToken(request, body);
  const { error } = await getSupabaseAdmin().auth.admin.signOut(jeton, "global");
  if (error) return badRequest("Déconnexion impossible. Réessayez.", 500);
  return ok({ deconnecte: true });
}

export async function PATCH(request) {
  const body = await request.json().catch(() => ({}));
  const cx = await contexte(request, body);
  if (cx.erreur) return cx.erreur;
  const { entreprise, userId } = cx;
  const db = await readDb();
  let prefs = prefsCompte(db, userId);
  if (body.notifications || body.langue) {
    prefs = enregistrerPrefs(db, userId, { notifications: body.notifications, langue: body.langue });
    await writeDb(db);
  }
  if (body.profil) {
    // Prénom, nom et téléphone du dirigeant : dans le profil (business_info._personal).
    const { data: row } = await entreprise.supabase.from("users").select("business_info").eq("id", userId).maybeSingle();
    const info = row?.business_info || {};
    const personnel = { ...(info._personal || {}), firstName: t(body.profil.prenom, 60), lastName: t(body.profil.nom, 60), phone: t(body.profil.telephone, 30) };
    const nomComplet = [personnel.firstName, personnel.lastName].filter(Boolean).join(" ");
    const { error } = await entreprise.supabase.from("users").update({ business_info: { ...info, _personal: personnel, ...(nomComplet ? { _name: nomComplet } : {}) }, updated_at: new Date().toISOString() }).eq("id", userId);
    if (error) return badRequest(`Enregistrement impossible : ${error.message}`, 500);
  }
  return ok({ notifications: prefs.notifications, langue: prefs.langue });
}
