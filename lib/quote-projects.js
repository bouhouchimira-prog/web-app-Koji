import { addHistory, makeToken } from "./db";
import { computeQuoteItem, flattenQuoteItems, getQuoteSourceItems } from "./quote-calculations";
import { fixObjectText, fixText } from "./text";

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

function projectStatusFromDate(startDate, now) {
  if (!startDate) return "En cours";
  const start = new Date(`${startDate}T00:00:00`);
  const today = new Date(now.slice(0, 10) + "T00:00:00");
  return start > today ? "À venir" : "En cours";
}

export function ensureProjectForSignedQuote(db, quote, now = new Date().toISOString()) {
  const updatedQuote = quote;
  const userId = updatedQuote.userId || "";
  const sourceItems = fixObjectText(getQuoteSourceItems(updatedQuote));
  const flatItems = flattenQuoteItems(sourceItems).filter((item) => !isSupplyOnly(item));
  const calculatedItems = flatItems.map((item) => computeQuoteItem(item, updatedQuote));
  const projectReference = fixText(updatedQuote.projectReference || updatedQuote.project || updatedQuote.quoteNumber || "Chantier");

  let project = null;
  let projectIndex = -1;
  if (updatedQuote.projectId) {
    projectIndex = db.projects.findIndex((candidate) => candidate.id === updatedQuote.projectId);
  }
  if (projectIndex === -1) {
    projectIndex = db.projects.findIndex((candidate) => candidate.quoteId === updatedQuote.id || candidate.signedQuoteId === updatedQuote.id);
  }

  if (projectIndex === -1) {
    project = {
      id: makeToken("project"),
      userId,
      reference: projectReference,
      title: projectReference,
      client: fixText(updatedQuote.client || "Client"),
      clientEmail: updatedQuote.clientEmail || updatedQuote.signerEmail || "",
      clientPhone: updatedQuote.clientPhone || "",
      address: fixText(updatedQuote.chantierAddress || ""),
      type: fixText(updatedQuote.propertyType || "Maison"),
      status: projectStatusFromDate(updatedQuote.startDate, now),
      progress: 10,
      quoteId: updatedQuote.id,
      signedQuoteId: updatedQuote.id,
      budgetHt: Number(updatedQuote.totalHt || 0),
      totalTtc: Number(updatedQuote.totalTtc || 0),
      rooms: fixObjectText(updatedQuote.rooms || []),
      quoteItems: sourceItems,
      startDate: updatedQuote.startDate || "",
      endDate: "",
      acceptedAt: updatedQuote.signedAt || now,
      createdAt: now,
      updatedAt: now
    };
    db.projects.unshift(project);
    addHistory(db, {
      userId,
      type: "project.created_from_quote",
      label: `Chantier cree depuis le devis: ${updatedQuote.quoteNumber}`,
      entityId: project.id,
      entityType: "project",
      meta: { quoteId: updatedQuote.id }
    });
  } else {
    project = db.projects[projectIndex];
    project.status = project.status === "Archive" ? project.status : projectStatusFromDate(updatedQuote.startDate || project.startDate, now);
    project.progress = Math.max(Number(project.progress || 0), 10);
    project.quoteId = project.quoteId || updatedQuote.id;
    project.signedQuoteId = updatedQuote.id;
    project.client = project.client || fixText(updatedQuote.client || "Client");
    project.clientEmail = project.clientEmail || updatedQuote.clientEmail || updatedQuote.signerEmail || "";
    project.clientPhone = project.clientPhone || updatedQuote.clientPhone || "";
    project.address = project.address || fixText(updatedQuote.chantierAddress || "");
    project.budgetHt = Number(updatedQuote.totalHt || project.budgetHt || 0);
    project.totalTtc = Number(updatedQuote.totalTtc || project.totalTtc || 0);
    project.rooms = project.rooms?.length ? project.rooms : fixObjectText(updatedQuote.rooms || []);
    project.quoteItems = sourceItems;
    project.acceptedAt = project.acceptedAt || updatedQuote.signedAt || now;
    project.updatedAt = now;
    db.projects[projectIndex] = project;
  }

  updatedQuote.projectId = project.id;
  updatedQuote.project = updatedQuote.project || project.title || project.reference;

  const existingKeys = new Set((db.tasks || [])
    .filter((task) => task.quoteId === updatedQuote.id || task.projectId === project.id)
    .map((task) => task.quoteItemId || task.sourceQuoteItemId || task.id));

  const createdTasks = [];
  calculatedItems.forEach((item, index) => {
    const key = makeTaskKey(updatedQuote, item, index);
    if (existingKeys.has(key)) return;
    const dueDate = dueDateFrom(project.startDate || updatedQuote.startDate, index);
    const task = {
      id: makeToken("task"),
      userId,
      projectId: project.id,
      quoteId: updatedQuote.id,
      quoteItemId: key,
      parentQuoteItemId: item.parentQuoteItemId || "",
      code: item.code || "",
      unit: item.unit || "",
      quantity: Number(item.quantity || 0),
      label: fixText(item.label || item.designation || item.name || `Tache ${index + 1}`),
      title: fixText(item.label || item.designation || item.name || `Tache ${index + 1}`),
      project: fixText(project.title || project.reference || "Chantier"),
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
      label: `Taches generees depuis le devis: ${updatedQuote.quoteNumber}`,
      entityId: project.id,
      entityType: "task",
      meta: { quoteId: updatedQuote.id, count: createdTasks.length }
    });
  }

  return { project, tasks: createdTasks, quote: updatedQuote };
}
