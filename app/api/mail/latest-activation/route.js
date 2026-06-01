import { badRequest, ok } from "../../../../lib/http";
import { readDb } from "../../../../lib/db";

export async function GET() {
  const db = await readDb();
  const latest = db.mailOutbox.find((item) => item.type === "activation");
  if (!latest) return badRequest("Aucun e-mail d'activation disponible", 404);
  return ok({ mail: latest });
}

