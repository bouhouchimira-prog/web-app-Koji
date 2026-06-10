import { badRequest, ok } from "../../../../lib/http";
import { readDb } from "../../../../lib/db";
import { fixObjectText, fixText } from "../../../../lib/text";

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value = "") {
  return String(value || "").replace(/\D/g, "");
}

function decorateQuote(quote, project, tasks) {
  return fixObjectText({
    ...quote,
    status: fixText(quote.status),
    project: project ? fixObjectText(project) : null,
    tasks: tasks.map((task) => fixObjectText(task)),
  });
}

function quoteBelongsToClient(quote, project, user, email) {
  const phone = normalizePhone(user?.phone || user?.personal?.phone);
  if (user?.id && quote.clientPortalUserId === user.id) return true;
  if (user?.clientAccess?.quoteIds?.includes(quote.id)) return true;
  if (user?.clientAccess?.projectIds?.includes(quote.projectId)) return true;
  if (email && (normalizeEmail(quote.clientEmail) === email || normalizeEmail(project?.clientEmail) === email)) return true;
  if (phone && (normalizePhone(quote.clientPhone) === phone || normalizePhone(project?.clientPhone) === phone)) return true;
  return false;
}

export async function GET(request) {
  const db = await readDb();
  const url = new URL(request.url);
  const emailParam = normalizeEmail(url.searchParams.get("email"));
  const userId = url.searchParams.get("userId") || "";
  const id = url.searchParams.get("id") || "";

  const user = db.users.find((entry) => entry.id === userId) || db.users.find((entry) => normalizeEmail(entry.email) === emailParam);
  const email = normalizeEmail(emailParam || user?.email);

  if (!email && !user?.id) return ok({ quotes: [] });

  const projectsById = new Map(db.projects.map((project) => [project.id, project]));
  const clientQuotes = db.quotes
    .filter((quote) => quoteBelongsToClient(quote, projectsById.get(quote.projectId), user, email))
    .map((quote) => decorateQuote(
      quote,
      projectsById.get(quote.projectId),
      db.tasks.filter((task) => task.quoteId === quote.id || task.projectId === quote.projectId),
    ));

  if (id) {
    const quote = clientQuotes.find((entry) => entry.id === id);
    if (!quote) return badRequest("Devis introuvable pour ce profil client.", 404);
    return ok({ quote });
  }

  return ok({ quotes: clientQuotes });
}
