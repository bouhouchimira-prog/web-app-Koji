import { ok } from "../../../lib/http";
import { readDb } from "../../../lib/db";
import { fixObjectText } from "../../../lib/text";

export async function GET(request) {
  const db = await readDb();
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") || "";
  const quoteId = url.searchParams.get("quoteId") || "";

  const matches = (item) => !projectId && !quoteId
    ? true
    : (projectId && item.projectId === projectId) || (quoteId && item.quoteId === quoteId);

  const messages = [
    ...(db.mailOutbox || []).filter(matches).map((mail) => ({ ...fixObjectText(mail), channel: "email" })),
    ...(db.smsOutbox || []).filter(matches).map((sms) => ({ ...fixObjectText(sms), channel: "sms" }))
  ].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  return ok({ messages });
}
