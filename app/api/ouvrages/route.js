import catalog from "../../../data/catalog-ouvrages.json";
import { ok } from "../../../lib/http";

export async function GET() {
  return ok({ ouvrages: catalog });
}
