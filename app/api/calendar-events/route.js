import { badRequest, ok } from "../../../lib/http";
import { getAuth, isUuid } from "../../../lib/server-auth";
import { fixText } from "../../../lib/text";

// Events live in the shared `calendar_events` table used by the koji-main
// Flutter app, so the planning is the same on web and mobile.

function mapEvent(row) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title || "Rendez-vous chantier",
    eventType: row.event_type || "Chantier",
    clientName: row.client_name || "",
    clientId: row.client_id || "",
    projectId: row.project_id || "",
    projectTitle: "",
    quoteId: "",
    address: row.address || "",
    startAt: row.start_at || "",
    endAt: row.end_at || row.start_at || "",
    allDay: Boolean(row.all_day),
    status: row.status || "En attente",
    progress: Number(row.progress || 0),
    notes: row.notes || "",
    workerIds: [],
    workers: [],
    tasks: [],
    createdAt: row.created_at || "",
    updatedAt: row.created_at || ""
  };
}

function eventColumns(body, userId) {
  const now = new Date().toISOString();
  const startAt = body.startAt || body.startDate || now;
  return {
    user_id: userId,
    title: fixText(body.title || "Rendez-vous chantier"),
    event_type: fixText(body.eventType || body.type || "Chantier"),
    client_name: fixText(body.clientName || ""),
    client_id: isUuid(body.clientId) ? body.clientId : null,
    project_id: isUuid(body.projectId) ? body.projectId : null,
    address: fixText(body.address || ""),
    start_at: startAt,
    end_at: body.endAt || body.endDate || startAt,
    all_day: Boolean(body.allDay),
    status: fixText(body.status || "En attente"),
    progress: Number(body.progress || 0),
    notes: fixText(body.notes || "")
  };
}

export async function GET(request) {
  const auth = getAuth(request);
  if (!auth) return ok({ calendarEvents: [] });

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") || "";
  const day = url.searchParams.get("day") || "";
  const month = url.searchParams.get("month") || "";

  let query = auth.supabase.from("calendar_events").select("*").order("start_at", { ascending: true });
  if (isUuid(projectId)) query = query.eq("project_id", projectId);
  const { data, error } = await query;
  if (error) return badRequest(`Lecture du planning impossible: ${error.message}`, 500);

  let events = (data || []).map(mapEvent);
  if (day) events = events.filter((event) => String(event.startAt || "").slice(0, 10) === day);
  if (month) events = events.filter((event) => String(event.startAt || "").slice(0, 7) === month);
  return ok({ calendarEvents: events });
}

export async function POST(request) {
  const body = await request.json();
  const auth = getAuth(request, body);
  if (!auth) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const { data, error } = await auth.supabase
    .from("calendar_events")
    .insert(eventColumns(body, auth.userId))
    .select()
    .single();
  if (error) return badRequest(`Création de l'évènement impossible: ${error.message}`, 500);
  return ok({ calendarEvent: mapEvent(data) }, 201);
}

export async function PATCH(request) {
  const body = await request.json();
  const auth = getAuth(request, body);
  if (!auth) return badRequest("Session expirée. Reconnectez-vous.", 401);
  if (!body.id) return badRequest("Identifiant de l'évènement manquant.");

  if (body.action === "delete") {
    const { data, error } = await auth.supabase
      .from("calendar_events")
      .delete()
      .eq("id", body.id)
      .select()
      .maybeSingle();
    if (error) return badRequest(`Suppression impossible: ${error.message}`, 500);
    if (!data) return ok({ error: "Evenement introuvable." }, 404);
    return ok({ calendarEvent: { ...mapEvent(data), deleted: true } });
  }

  const updates = {};
  const columnByKey = {
    title: (value) => ({ title: fixText(value) }),
    eventType: (value) => ({ event_type: fixText(value) }),
    clientName: (value) => ({ client_name: fixText(value) }),
    clientId: (value) => ({ client_id: isUuid(value) ? value : null }),
    projectId: (value) => ({ project_id: isUuid(value) ? value : null }),
    address: (value) => ({ address: fixText(value) }),
    startAt: (value) => ({ start_at: value }),
    endAt: (value) => ({ end_at: value }),
    allDay: (value) => ({ all_day: Boolean(value) }),
    status: (value) => ({ status: fixText(value) }),
    progress: (value) => ({ progress: Number(value || 0) }),
    notes: (value) => ({ notes: fixText(value) })
  };
  for (const [key, toColumn] of Object.entries(columnByKey)) {
    if (Object.prototype.hasOwnProperty.call(body, key)) Object.assign(updates, toColumn(body[key]));
  }
  if (body.action === "done") {
    updates.status = "Termine";
    updates.progress = 100;
  }
  if (Object.keys(updates).length === 0) return badRequest("Aucune modification fournie.");

  const { data, error } = await auth.supabase
    .from("calendar_events")
    .update(updates)
    .eq("id", body.id)
    .select()
    .maybeSingle();
  if (error) return badRequest(`Mise à jour impossible: ${error.message}`, 500);
  if (!data) return ok({ error: "Evenement introuvable." }, 404);
  return ok({ calendarEvent: mapEvent(data) });
}
