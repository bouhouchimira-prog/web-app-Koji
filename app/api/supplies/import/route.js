import { ok, badRequest } from "../../../../lib/http";
import { importSupplyFromUrl } from "../../../../lib/supply-import";
import { getAuth } from "../../../../lib/server-auth";

// Used to let anyone on the internet make this server fetch an arbitrary
// URL with no session at all (SSRF risk: internal/private addresses, cloud
// metadata endpoints, using this as an open fetch proxy) — now requires a
// signed-in session and only follows http(s) links.
export async function GET(request) {
  const auth = getAuth(request);
  if (!auth) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const url = new URL(request.url).searchParams.get("url");
  if (!url) return badRequest("Lien manquant.");
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return badRequest("Lien invalide.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return badRequest("Lien invalide.");
  }

  const data = await importSupplyFromUrl(url);
  return ok({ data });
}
