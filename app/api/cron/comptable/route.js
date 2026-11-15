import { timingSafeEqual } from "node:crypto";
import { ok } from "../../../../lib/http";
import { readDb, writeDb } from "../../../../lib/db";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { moisPrecedent } from "../../../../lib/depenses";
import { contexteEntreprise, envoyerAuComptable, rangerCommandes } from "../../../../lib/depenses-serveur";

// Tâche du 5 de chaque mois (Vercel Cron, vercel.json) : envoi au
// comptable des pièces du mois précédent pour les entreprises Business
// qui l'ont activé (maquettes PRO-09 et 09.4). Refusée sans CRON_SECRET.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function autorise(request) {
  const secret = process.env.CRON_SECRET || "";
  if (!secret) return false;
  const recu = Buffer.from(request.headers.get("authorization") || "");
  const attendu = Buffer.from(`Bearer ${secret}`);
  return recu.length === attendu.length && timingSafeEqual(recu, attendu);
}

export async function GET(request) {
  if (!autorise(request)) return new Response("Non autorisé", { status: 401 });
  const db = await readDb();
  const periode = moisPrecedent();
  const admin = getSupabaseAdmin();
  const faits = [];
  const erreurs = [];
  for (const [userId, r] of Object.entries(db.reglagesDepenses || {})) {
    if (!r?.envoiAuto || !r.comptableEmail) continue;
    if ((db.envoisComptable || []).some((e) => e.userId === userId && e.periode === periode)) continue;
    const entreprise = { userId, supabase: admin };
    try {
      if (!(await contexteEntreprise(entreprise)).business) continue;
      rangerCommandes(db, userId);
      faits.push((await envoyerAuComptable(entreprise, db, { periode, to: r.comptableEmail, auto: true })).id);
    } catch (e) {
      erreurs.push(userId);
      console.error("[cron comptable]", userId, e?.message);
    }
  }
  if (faits.length) await writeDb(db);
  return ok({ periode, envoyes: faits.length, erreurs: erreurs.length });
}
