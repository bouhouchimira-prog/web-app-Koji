import { getUserIdFromRequest, readDb, scopedItems } from "../../../lib/db";
import { ok } from "../../../lib/http";

export async function GET(request) {
  const db = await readDb();
  const userId = getUserIdFromRequest(request);
  return ok({ history: scopedItems(db.history, userId) });
}
