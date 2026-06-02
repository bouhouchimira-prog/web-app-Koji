import { ok, badRequest } from "../../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../../lib/db";
import { fixObjectText, fixText } from "../../../../lib/text";

async function findQuoteByToken(token) {
  const db = await readDb();
  const index = db.quotes.findIndex((quote) => quote.signatureToken === token);
  return { db, index, quote: index === -1 ? null : db.quotes[index] };
}

export async function GET(_request, context) {
  const { token } = await context.params;
  const { quote } = await findQuoteByToken(token);
  if (!quote) return badRequest("Lien de signature invalide.", 404);

  return ok({
    quote: {
      id: quote.id,
      quoteNumber: quote.quoteNumber,
      client: fixText(quote.client),
      clientEmail: quote.clientEmail,
      project: fixText(quote.project),
      rooms: fixObjectText(quote.rooms || []),
      items: fixObjectText(quote.items || []),
      totalHt: quote.totalHt,
      totalTtc: quote.totalTtc,
      status: quote.status,
      signatureStatus: quote.signatureStatus,
      sentAt: quote.sentAt,
      signedAt: quote.signedAt,
      signerName: quote.signerName
    }
  });
}

export async function POST(request, context) {
  const { token } = await context.params;
  const body = await request.json();
  const { db, index, quote } = await findQuoteByToken(token);
  if (!quote) return badRequest("Lien de signature invalide.", 404);
  if (quote.signatureStatus === "Signe") return ok({ quote: fixObjectText(quote) });
  if (!body.consent) return badRequest("La validation client est obligatoire.");

  const now = new Date().toISOString();
  const updated = {
    ...quote,
    status: "Signe",
    signatureStatus: "Signe",
    signerName: fixText(body.signerName || quote.client || "Client"),
    signerEmail: body.signerEmail || quote.clientEmail || "",
    signedAt: now,
    updatedAt: now
  };

  db.quotes[index] = updated;
  const projectIndex = updated.projectId ? db.projects.findIndex((project) => project.id === updated.projectId) : -1;
  if (projectIndex !== -1) {
    db.projects[projectIndex].status = "En cours";
    db.projects[projectIndex].progress = Math.max(Number(db.projects[projectIndex].progress || 0), 10);
    db.projects[projectIndex].acceptedAt = now;
    db.projects[projectIndex].startDate = db.projects[projectIndex].startDate || "";
    db.projects[projectIndex].endDate = db.projects[projectIndex].endDate || "";
    db.projects[projectIndex].updatedAt = now;
  }

  const firstWorker = db.workers.find((worker) => !updated.userId || !worker.userId || worker.userId === updated.userId);
  const existingTasks = db.tasks.filter((task) => task.quoteId === updated.id);
  if (existingTasks.length === 0) {
    const sourceItems = updated.items?.length ? fixObjectText(updated.items) : [{ label: `Suivi ${updated.quoteNumber}`, room: "Chantier", quantity: 1 }];
    sourceItems.forEach((item, itemIndex) => {
      const dueDate = new Date(Date.now() + (itemIndex + 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      db.tasks.unshift({
        id: `t-${Date.now()}-${itemIndex}`,
        userId: updated.userId || "",
        quoteId: updated.id,
        quoteItemId: `${item.roomId || item.room || "chantier"}-${item.taskId || item.code || itemIndex}`,
        code: item.code || "",
        unit: item.unit || "",
        quantity: Number(item.quantity || 0),
        projectId: updated.projectId || "",
        label: fixText(item.label || `Tache ${itemIndex + 1}`),
        project: fixText(updated.project || "Chantier"),
        room: fixText(item.room || "Chantier"),
        dueDate,
        startDate: "",
        endDate: "",
        durationHours: Number(item.correctedTimeHours || item.normativeTime || 1),
        assignedTo: firstWorker?.name || "Equipe",
        workerIds: firstWorker ? [firstWorker.id] : [],
        participantType: firstWorker?.type === "Sous-traitant" ? "Sous-traitants" : "Ouvriers",
        supplyNeeds: [],
        status: "A planifier",
        done: false,
        createdAt: now
      });
    });
    addHistory(db, {
      userId: updated.userId || "",
      type: "tasks.generated",
      label: `Taches chantier creees: ${updated.project}`,
      entityId: updated.projectId || updated.id,
      entityType: "task",
      meta: { quoteId: updated.id, count: sourceItems.length }
    });
  }

  addHistory(db, {
    userId: updated.userId || "",
    type: "quote.signed",
    label: `Devis signe: ${updated.quoteNumber}`,
    entityId: updated.id,
    entityType: "quote",
    meta: { signerName: updated.signerName, signerEmail: updated.signerEmail }
  });
  await writeDb(db);
  return ok({ quote: fixObjectText(updated) });
}
