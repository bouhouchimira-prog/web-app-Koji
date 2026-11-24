import { badRequest, ok } from "../../../../lib/http";
import { readDb, writeDb } from "../../../../lib/db";
import { getVerifiedUserId } from "../../../../lib/server-auth";
import { METIERS_DEMARRAGE, tauxParFamille, tauxParMetier } from "../../../../lib/demarrage";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { buildWebUser } from "../../../../lib/user-profile";
import { tauxHoraireProfil } from "../../../../lib/bibliotheque-pro";
import familles from "../../../../data/ouvrage-families.json";

// Taux horaires par métier (démarrage guidé, étape 3 ; site et app Koji Pro).
// Enregistrés par famille d'ouvrage dans db.tauxParFamille[userId] : la
// bibliothèque de l'entreprise les applique aux ouvrages sans taux propre
// (lib/ouvrages.js::appliquerTauxMetiers), donc aux devis, au Devis guidé et
// au prix recommandé du Radar. Le taux des autres postes reste le taux
// journalier du profil (PATCH /api/auth/profile).
const TAUX_MAX = 500;

// Taux de référence des familles (affichés « Koji utilise X € en attendant »
// tant que l'entreprise n'a pas réglé le sien ; jamais enregistrés pour elle).
const DEFAUTS_FAMILLE = Object.fromEntries(familles.map((f) => [f.code, Number(f.hourlyRateDefault) || 0]));
const DEFAUTS_METIER = Object.fromEntries(METIERS_DEMARRAGE.filter((m) => m.familles.length).map((m) => [m.metier, DEFAUTS_FAMILLE[m.familles[0]] || 0]));

// Taux horaire du profil (tarif journalier / heures par jour) : celui que le
// devis applique à un ouvrage sans taux propre ni taux de métier. La
// bibliothèque l'affiche donc avant le taux de référence de la famille
// (retours du build 64 : 13,00 € dans la bibliothèque, 19,50 € dans le devis).
// 0 si le profil ne le donne pas.
async function tauxHoraireDuProfil(userId) {
  try {
    const { data: profile } = await getSupabaseAdmin().from("users").select("*").eq("id", userId).maybeSingle();
    const business = buildWebUser({ id: userId, email: profile?.email || "", profile }).business || {};
    return tauxHoraireProfil(business);
  } catch {
    return 0;
  }
}

export async function GET(request) {
  const userId = await getVerifiedUserId(request);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const [db, tauxProfil] = await Promise.all([readDb(), tauxHoraireDuProfil(userId)]);
  const parFamille = db.tauxParFamille?.[userId]?.taux || {};
  return ok({ taux: tauxParMetier(parFamille), parFamille, valides: db.tauxParFamille?.[userId]?.valides || {}, defautsFamille: DEFAUTS_FAMILLE, defautsMetier: DEFAUTS_METIER, tauxProfil });
}

export async function PUT(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest("Requête invalide.");
  }
  const userId = await getVerifiedUserId(request, body);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const saisis = body?.taux && typeof body.taux === "object" ? body.taux : {};
  for (const valeur of Object.values(saisis)) {
    const n = Number(valeur);
    if (valeur !== "" && valeur !== null && (!Number.isFinite(n) || n < 0 || n > TAUX_MAX)) {
      return badRequest(`Un taux doit être compris entre 0 et ${TAUX_MAX} € de l'heure.`);
    }
  }
  const parFamille = tauxParFamille(saisis);

  const db = await readDb();
  db.tauxParFamille = db.tauxParFamille || {};
  // Date de validation par métier (Mes prix, PRO-08.2) : gardée, et posée
  // pour les métiers que l'entrepreneur confirme (body.valider).
  const valides = { ...(db.tauxParFamille[userId]?.valides || {}) };
  const metiersSaisis = tauxParMetier(parFamille);
  for (const m of Object.keys(valides)) if (!metiersSaisis[m]) delete valides[m];
  for (const m of Array.isArray(body.valider) ? body.valider : []) if (metiersSaisis[m]) valides[m] = new Date().toISOString().slice(0, 10);
  if (Object.keys(parFamille).length) {
    db.tauxParFamille[userId] = { taux: parFamille, valides, updatedAt: new Date().toISOString() };
  } else {
    delete db.tauxParFamille[userId];
  }
  await writeDb(db);
  return ok({ taux: tauxParMetier(parFamille), parFamille, valides });
}
