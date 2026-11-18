import { resolveEntreprise } from "../../../../lib/entreprise-auth";

// GET /api/entreprise/notifications — load notifications (placeholder for Phase 1)
export async function GET(request) {
  const entreprise = await resolveEntreprise(request);
  if (!entreprise) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // TODO: Query notifications table when it exists
    // For Phase 1, return empty list
    return Response.json({
      notifications: [],
      unreadCount: 0,
    });
  } catch (err) {
    console.error("Error loading notifications:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/entreprise/notifications/:id — mark notification as read
export async function PATCH(request) {
  const entreprise = await resolveEntreprise(request);
  if (!entreprise) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const notificationId = searchParams.get("id");

    // TODO: Update notification read status when table exists
    return Response.json({ ok: true });
  } catch (err) {
    console.error("Error updating notification:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
