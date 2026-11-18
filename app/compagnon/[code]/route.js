import { NextResponse } from "next/server";
import { readDb, writeDb } from "../../../lib/db";
import { issueWorkerToken } from "../../../lib/worker-session";
import { setSessionCookie } from "../../../lib/session-cookies";
import { workerParCode } from "../../../lib/equipe-serveur";

// Lien reçu par SMS (PRO-16.3) : ouvre la vue compagnon sans mot de passe.
export async function GET(request, { params }) {
  const { code } = await params;
  const origine = new URL(request.url).origin;
  const db = await readDb();
  const worker = workerParCode(db, code);
  if (!worker) return NextResponse.redirect(`${origine}/worker?invitation=expiree`);
  worker.invitation.utiliseLe = new Date().toISOString();
  worker.lastLoginAt = worker.invitation.utiliseLe;
  await writeDb(db);
  const response = NextResponse.redirect(`${origine}/worker`);
  setSessionCookie(response, "worker", issueWorkerToken(worker.id));
  return response;
}
