import { ok, badRequest } from "../../../lib/http";
import { readDb, writeDb, makeToken } from "../../../lib/db";

export async function GET(request) {
  const db = await readDb();
  const url = new URL(request.url);
  const currentUserId = url.searchParams.get("userId") || "";

  const published = (db.projects || [])
    .filter((p) => p.marketplace?.published)
    .map((p) => ({
      id: p.id,
      title: p.title || p.reference || "Chantier",
      address: p.address || "",
      type: p.type || "",
      budgetHt: p.budgetHt || 0,
      totalTtc: p.totalTtc || 0,
      rooms: p.rooms || [],
      startDate: p.startDate || "",
      publishedAt: p.marketplace.publishedAt || "",
      description: p.marketplace.description || "",
      views: p.marketplace.views || 0,
      ownerId: p.userId || "",
      isOwn: p.userId === currentUserId,
      interestCount: (db.marketplaceInterests || []).filter((i) => i.projectId === p.id).length,
      alreadyInterested: currentUserId
        ? (db.marketplaceInterests || []).some((i) => i.projectId === p.id && i.fromUserId === currentUserId)
        : false
    }))
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  return ok({ projects: published });
}

export async function POST(request) {
  const body = await request.json();
  const db = await readDb();
  const { action, projectId, userId, description, message } = body;

  if (!projectId || !userId) return badRequest("Données manquantes.");

  if (action === "publish" || action === "unpublish") {
    const index = db.projects.findIndex((p) => p.id === projectId && p.userId === userId);
    if (index === -1) return badRequest("Chantier introuvable.");
    const now = new Date().toISOString();
    db.projects[index].marketplace = {
      ...(db.projects[index].marketplace || {}),
      published: action === "publish",
      publishedAt: action === "publish" ? now : "",
      description: description || db.projects[index].marketplace?.description || "",
      views: db.projects[index].marketplace?.views || 0
    };
    await writeDb(db);
    return ok({ project: db.projects[index] });
  }

  if (action === "interest") {
    const project = db.projects.find((p) => p.id === projectId);
    if (!project?.marketplace?.published) return badRequest("Chantier introuvable.");
    if (project.userId === userId) return badRequest("Vous ne pouvez pas vous intéresser à votre propre chantier.");

    db.marketplaceInterests = db.marketplaceInterests || [];
    const existing = db.marketplaceInterests.find((i) => i.projectId === projectId && i.fromUserId === userId);
    if (existing) return badRequest("Vous avez déjà manifesté votre intérêt pour ce chantier.");

    const fromUser = db.users.find((u) => u.id === userId);
    const now = new Date().toISOString();
    const interest = {
      id: makeToken("interest"),
      projectId,
      projectOwnerId: project.userId,
      fromUserId: userId,
      fromUserName: fromUser?.name || fromUser?.business?.name || "Artisan Koji",
      fromUserEmail: fromUser?.email || "",
      message: message || "",
      createdAt: now
    };
    db.marketplaceInterests.push(interest);

    db.notifications = db.notifications || [];
    db.notifications.unshift({
      id: `notif-marketplace-${interest.id}`,
      userId: project.userId || "",
      type: "marketplace.interest",
      title: "Nouvel intérêt pour votre chantier",
      message: `${interest.fromUserName} est intéressé par votre chantier "${project.title || project.reference}".`,
      projectId,
      read: false,
      createdAt: now
    });

    await writeDb(db);
    return ok({ interest });
  }

  return badRequest("Action inconnue.");
}
