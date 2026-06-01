import { ok } from "../../../lib/http";
import { readDb } from "../../../lib/db";

export async function GET() {
  const db = await readDb();
  return ok({ workers: db.workers });
}
