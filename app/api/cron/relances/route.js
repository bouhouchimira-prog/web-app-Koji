import { timingSafeEqual } from "node:crypto";
import { ok } from "../../../../lib/http";
import { readDb, writeDb } from "../../../../lib/db";
import { passerRelancesServeur } from "../../../../lib/relances-serveur";

// Tâche quotidienne (Vercel Cron, vercel.json) : relances automatiques des
// factures échues (maquette PRO-06.2). Refusée sans CRON_SECRET.
export const dynamic = "force-dynamic";

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
  const fait = await passerRelancesServeur(db);
  if (fait.envoyees.length || fait.preparees.length) await writeDb(db);
  return ok({ envoyees: fait.envoyees.length, preparees: fait.preparees.length, erreurs: fait.erreurs.length });
}
