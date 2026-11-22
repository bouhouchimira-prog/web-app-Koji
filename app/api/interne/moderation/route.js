import { badRequest, ok } from "../../../../lib/http";
import { readDb, writeDb } from "../../../../lib/db";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { ENTETE_INTERNE, cleInterne, verifierInterne } from "../../../../lib/interne-signature";
import { accesSupabase, actionValide, agir, examiner } from "../../../../lib/moderation";

// Page Signalements du back-office (admin.getkoji.io) : examiner un
// signalement de contenu (auteur, contenus du fil) et appliquer une
// décision (retirer, suspendre, réactiver, classer, rouvrir). Appelé
// seulement par le back-office, requête signée (lib/interne-signature.js) ;
// le back-office vérifie lui-même que la personne est administratrice et
// inscrit chaque décision au journal des accès.
export async function POST(request) {
  const corps = await request.text();
  if (!verifierInterne(request.headers.get(ENTETE_INTERNE), corps, cleInterne())) {
    return badRequest("Non autorisé.", 401);
  }
  let body;
  try { body = JSON.parse(corps); } catch { return badRequest("Requête invalide."); }
  const action = String(body.action || "");
  const reportId = String(body.reportId || "");
  if (!reportId || (action !== "examiner" && !actionValide(action))) return badRequest("Requête invalide.");

  const db = await readDb();
  const report = (db.technicalReports || []).find((r) => r.id === reportId);
  if (!report) return badRequest("Signalement introuvable.", 404);
  const acces = accesSupabase(getSupabaseAdmin());

  if (action === "examiner") return ok({ report, examen: await examiner(report, { db, acces }) });

  let resultat;
  try {
    resultat = await agir(report, action, { db, acces, par: String(body.par || "").slice(0, 200) });
  } catch (err) {
    return badRequest(`Action impossible : ${err.message}`, 502);
  }
  if (!resultat.ok) return badRequest(resultat.erreur, 409);
  await writeDb(db);
  return ok({ report, detail: resultat.detail, examen: await examiner(report, { db, acces }) });
}
