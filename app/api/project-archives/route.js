import { ok } from "../../../lib/http";
import { getUserIdFromRequest, readDb, scopedItems } from "../../../lib/db";
import { fixObjectText } from "../../../lib/text";

function normalizeArchive(archive) {
  return fixObjectText(archive);
}

export async function GET(request) {
  const db = await readDb();
  const userId = getUserIdFromRequest(request);
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") || "";
  let archives = scopedItems(db.projectArchives, userId);
  if (projectId) archives = archives.filter((archive) => archive.projectId === projectId);
  return ok({ projectArchives: archives.map(normalizeArchive) });
}
