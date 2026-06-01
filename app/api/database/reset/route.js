import { ok } from "../../../../lib/http";
import { resetDb } from "../../../../lib/db";

export async function POST() {
  const db = await resetDb();
  return ok({ ok: true, db });
}
