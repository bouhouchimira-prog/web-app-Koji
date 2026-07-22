import { addHistory, makeToken } from "./db";
import { computeQuoteItem, flattenQuoteItems, getQuoteSourceItems } from "./quote-calculations";
import { fixObjectText, fixText } from "./text";

// Chantiers now live in the shared Supabase `chantiers` table (see
// app/api/projects/route.js), so this only generates the local task list from
// a signed quote's items — it no longer creates/mutates a local "project"
// record, which would just be dead data the Chantiers page never reads.

function dueDateFrom(startDate, offsetDays) {
  if (!startDate) return "";
  const date = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function makeTaskKey(quote, item, index) {
  const raw = item.quoteItemId || item.id || item.taskId || item.code || `${quote.id}-${index}`;
  return String(raw).replace(/[^a-zA-Z0-9_-]/g, "-");
}

function isSupplyOnly(item = {}) {
  const type = String(item.type || item.kind || "").toLowerCase();
  return item.isSupply || type === "supply" || type === "fourniture" || type === "material";
}

export function generateTasksForSignedQuote(db, quote, now = new Date().toISOString()) {
  if (!quote.projectId) return { tasks: [] };

  const userId = quote.userId || "";
  const sourceItems = fixObjectText(getQuoteSourceItems(quote));
  const flatItems = flattenQuoteItems(sourceItems).filter((item) => !isSupplyOnly(item));
  const calculatedItems = flatItems.map((item) => computeQuoteItem(item, quote));
  const projectTitle = fixText(quote.projectReference || quote.project || quote.quoteNumber || "Chantier");

  const existingKeys = new Set((db.tasks || [])
    .filter((task) => task.quoteId === quote.id || task.projectId === quote.projectId)
    .map((task) => task.quoteItemId || task.sourceQuoteItemId || task.id));

  const createdTasks = [];
  calculatedItems.forEach((item, index) => {
    const key = makeTaskKey(quote, item, index);
    if (existingKeys.has(key)) return;
    const dueDate = dueDateFrom(quote.startDate, index);
    const task = {
      id: makeToken("task"),
      userId,
      projectId: quote.projectId,
      quoteId: quote.id,
      quoteItemId: key,
      parentQuoteItemId: item.parentQuoteItemId || "",
      code: item.code || "",
      unit: item.unit || "",
      quantity: Number(item.quantity || 0),
      label: fixText(item.label || item.designation || item.name || `Tache ${index + 1}`),
      title: fixText(item.label || item.designation || item.name || `Tache ${index + 1}`),
      project: projectTitle,
      room: fixText(item.room || "Chantier"),
      dueDate,
      startDate: "",
      endDate: "",
      durationHours: Number(item.correctedTimeHours || item.baseTimeHours || item.normativeTime || 0),
      assignedTo: "",
      workerIds: [],
      participantType: "Ouvriers",
      supplyNeeds: fixObjectText(item.materialLines || item.materialRequirements || item.supplies || []),
      status: "À faire",
      done: false,
      createdAt: now,
      updatedAt: now
    };
    db.tasks.unshift(task);
    createdTasks.push(task);
  });

  if (createdTasks.length > 0) {
    addHistory(db, {
      userId,
      type: "tasks.generated_from_quote",
      label: `Taches generees depuis le devis: ${quote.quoteNumber}`,
      entityId: quote.projectId,
      entityType: "task",
      meta: { quoteId: quote.id, count: createdTasks.length }
    });
  }

  return { tasks: createdTasks };
}
