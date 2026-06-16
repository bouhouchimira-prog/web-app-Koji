import { ok, badRequest } from "../../../../lib/http";
import { importSupplyFromUrl } from "../../../../lib/supply-import";

export async function GET(request) {
  const url = new URL(request.url).searchParams.get("url");
  if (!url) return badRequest("Lien manquant.");
  const data = await importSupplyFromUrl(url);
  return ok({ data });
}
