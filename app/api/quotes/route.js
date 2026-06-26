import { ok, paywallRequired } from "../../../lib/http";
import { addHistory, findScopedIndex, getUserScope, makeToken, readDb, resolveUserId, scopedItems, writeDb } from "../../../lib/db";
import { fixObjectText, fixText } from "../../../lib/text";
import { applyQuoteTotals } from "../../../lib/quote-calculations";
import { checkQuoteCreationLimit, checkTrialEditLimit, checkTrialSendLimit } from "../../../lib/plan";

function normalizeQuote(quote) {
  return {
    ...fixObjectText(quote),
    totalHt: Number(quote.totalHt || 0),
    totalTtc: Number(quote.totalTtc || 0),
    draftStep: Number(quote.draftStep || 0),
    isCreationDraft: Boolean(quote.isCreationDraft)
  };
}

function buildSignatureLinks(request, quote, identifier = "") {
  const origin = new URL(request.url).origin;
  // Default to self-hosted signature login (no external app required)
  const signatureBase = process.env.PUBLIC_SIGNATURE_BASE_URL || origin;
  const signaturePath = process.env.PUBLIC_SIGNATURE_LOGIN_PATH || "/signature/login";
  const cleanSignatureBase = String(signatureBase).replace(/\/$/, "");
  const cleanSignaturePath = signaturePath.startsWith("/") ? signaturePath : `/${signaturePath}`;
  const localSignatureUrl = `${origin}/signature/${quote.signatureToken}`;
  const signatureUrl = new URL(`${cleanSignatureBase}${cleanSignaturePath}`);
  signatureUrl.searchParams.set("signatureToken", quote.signatureToken);
  if (identifier) signatureUrl.searchParams.set("identifier", identifier);
  return {
    signatureUrl: signatureUrl.toString(),
    localSignatureUrl
  };
}

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value = "") {
  return String(value || "").replace(/\D/g, "");
}

function makeTemporaryPassword() {
  const left = Math.random().toString(36).slice(2, 6).toUpperCase();
  const right = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `Koji-${left}-${right}`;
}

function makeSignatureIdentifier() {
  const chars = "ABCDEFGHIJKLMNPQRSTUVWXYZ0123456789";
  return "Koji-" + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function buildSignatureAccess(db, quote, body, request, now) {
  const email = normalizeEmail(body.clientEmail || quote.clientEmail || "");
  const phone = fixText(body.clientPhone || quote.clientPhone || "");
  const phoneDigits = normalizePhone(phone);
  const identifier = quote.signatureAccessIdentifier || makeSignatureIdentifier();
  const password = makeTemporaryPassword();
  const links = buildSignatureLinks(request, quote, identifier);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const access = {
    id: makeToken("sign-access"),
    identifier,
    email,
    phone,
    password,
    loginUrl: links.signatureUrl,
    localSignatureUrl: links.localSignatureUrl,
    expiresAt,
    createdAt: now,
    status: "active"
  };

  quote.clientEmail = email || quote.clientEmail || "";
  quote.clientPhone = phone || quote.clientPhone || "";
  quote.signatureUrl = links.signatureUrl;
  quote.localSignatureUrl = links.localSignatureUrl;
  quote.signatureClientAccess = access;
  quote.signatureAccessIdentifier = identifier;
  quote.signatureAccessPassword = password;
  quote.signatureAccessCreatedAt = now;

  db.mailOutbox = db.mailOutbox || [];
  db.smsOutbox = db.smsOutbox || [];
  const clientName = fixText(quote.client || "Client");
  const messageLines = [
    `Bonjour ${clientName},`,
    `Votre devis ${quote.quoteNumber} est prêt à être consulté et signé sur Koji Signature.`,
    `Identifiant : ${identifier}`,
    `Mot de passe provisoire : ${password}`,
    `Lien de connexion : ${links.signatureUrl}`,
    "Après signature, vos accès Koji Particulier seront envoyés pour suivre le chantier."
  ];

  if (email) {
    db.mailOutbox.unshift({
      id: `mail-signature-${quote.id}-${Date.now()}`,
      to: email,
      type: "quote-signature-access",
      subject: `Votre devis ${quote.quoteNumber} à signer`,
      text: messageLines.join("\n"),
      html: `<p>Bonjour ${clientName},</p><p>Votre devis <strong>${quote.quoteNumber}</strong> est prêt à être consulté et signé sur Koji Signature.</p><p><strong>Identifiant :</strong> ${identifier}<br/><strong>Mot de passe provisoire :</strong> ${password}</p><p><a href="${links.signatureUrl}">Ouvrir Koji Signature</a></p><p>Après signature, vos accès Koji Particulier seront envoyés pour suivre le chantier.</p>`,
      quoteId: quote.id,
      projectId: quote.projectId || "",
      createdAt: now
    });
  }

  if (phoneDigits) {
    db.smsOutbox.unshift({
      id: `sms-signature-${quote.id}-${Date.now()}`,
      to: phone,
      type: "quote-signature-access",
      text: `Koji Signature: devis ${quote.quoteNumber}. Identifiant: ${identifier}. Mot de passe: ${password}. Connexion: ${links.signatureUrl}`,
      quoteId: quote.id,
      projectId: quote.projectId || "",
      createdAt: now
    });
  }

  return access;
}

function removeDraftNotification(db, quoteId, userId = "") {
  db.notifications = (db.notifications || []).filter((notification) => {
    if (notification.type !== "quote.draft" || notification.quoteId !== quoteId) return true;
    return userId && notification.userId && notification.userId !== userId;
  });
}

function syncDraftNotification(db, quote, userId = "") {
  const ownerId = quote.userId || userId || "";
  if (!quote.isCreationDraft || quote.status !== "Brouillon en cours") {
    removeDraftNotification(db, quote.id, ownerId);
    return;
  }

  const now = new Date().toISOString();
  const draftStep = Number(quote.draftStep || quote.draftData?.step || 1);
  const project = fixText(quote.project || quote.projectReference || "Brouillon");
  const existingIndex = (db.notifications || []).findIndex((notification) => (
    notification.type === "quote.draft" &&
    notification.quoteId === quote.id &&
    (notification.userId || "") === ownerId
  ));
  const existing = existingIndex === -1 ? null : db.notifications[existingIndex];
  const notification = {
    ...(existing || {}),
    id: existing?.id || `notif-draft-${quote.id}`,
    userId: ownerId,
    type: "quote.draft",
    title: "Devis en cours de création",
    message: "Un devis en cours de création a été détecté. Souhaitez-vous le reprendre ?",
    metaLabel: `${project} - étape ${draftStep}`,
    quoteId: quote.id,
    actionUrl: `/chantier/new?resumeDraft=${encodeURIComponent(quote.id)}`,
    actionLabel: "Continuer",
    secondaryAction: "delete-draft",
    read: existing?.read || false,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };

  if (existingIndex === -1) db.notifications.unshift(notification);
  else db.notifications[existingIndex] = notification;
}


function computeNextQuoteSeq(db) {
  const maxFromQuotes = db.quotes.reduce((max, q) => {
    const match = (q.quoteNumber || "").match(/_(\d+)$/);
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 1048);
  const current = Math.max(db.quoteSeqCounter || 0, maxFromQuotes);
  db.quoteSeqCounter = current + 1;
  return db.quoteSeqCounter;
}

// Backfills the client portal password/identifier on quotes that were sent before these
// fields were stored on clientPortalAccess, so existing chantiers don't need a resend.
function withClientPortalAccess(quote, db) {
  if (!quote.clientPortalUserId) return quote;
  const hasPassword = quote.clientPortalAccess?.password;
  const hasIdentifier = quote.clientPortalAccess?.portalIdentifier;
  if (hasPassword && hasIdentifier) return quote;
  const clientUser = db.users.find((item) => item.id === quote.clientPortalUserId);
  if (!clientUser) return quote;
  return {
    ...quote,
    clientPortalAccess: {
      ...(quote.clientPortalAccess || {}),
      portalIdentifier: quote.clientPortalAccess?.portalIdentifier || clientUser.portalIdentifier || "",
      password: quote.clientPortalAccess?.password || clientUser.password || ""
    }
  };
}

export async function GET(request) {
  const db = await readDb();
  const userId = getUserScope(request, db);
  const maxFromQuotes = db.quotes.reduce((max, q) => {
    const match = (q.quoteNumber || "").match(/_(\d+)$/);
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 1048);
  const nextSeq = Math.max(db.quoteSeqCounter || 0, maxFromQuotes) + 1;
  const nextQuoteNumber = `${new Date().getFullYear()}_${String(nextSeq).padStart(4, "0")}`;
  const quotes = scopedItems(db.quotes, userId).map((quote) => normalizeQuote(withClientPortalAccess(quote, db)));
  return ok({ quotes, nextQuoteNumber });
}

export async function POST(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = body.userId || "";
  const user = db.users.find((item) => item.id === userId);
  const creationGate = checkQuoteCreationLimit(db, user);
  if (!creationGate.allowed) return paywallRequired(creationGate.reason);
  const now = new Date().toISOString();
  const quoteDate = body.quoteDate || body.createdAt || now.slice(0, 10);
  const quoteYear = new Date().getFullYear();
  const quoteSeq = computeNextQuoteSeq(db);
  const quoteBase = {
    id: `q-${Date.now()}`,
    userId,
    quoteNumber: `${quoteYear}_${String(quoteSeq).padStart(4, "0")}`,
    versionNumber: body.versionNumber || "001",
    client: fixText(body.client || "Client"),
    clientEmail: body.clientEmail || "",
    clientPhone: fixText(body.clientPhone || ""),
    project: fixText(body.project || "Chantier"),
    projectId: body.projectId || "",
    projectReference: body.projectReference || "",
    chantierAddress: fixText(body.chantierAddress || ""),
    startDate: body.startDate || "",
    expectedDuration: fixText(body.expectedDuration || ""),
    workDescription: fixText(body.workDescription || ""),
    validityDays: Number(body.validityDays || 30),
    company: fixObjectText(body.company || {}),
    quoteDate,
    status: fixText(body.status || "Brouillon"),
    signatureStatus: "Non envoye",
    rooms: fixObjectText(body.rooms || []),
    items: fixObjectText(body.items || []),
    draftStep: Number(body.draftStep || 0),
    draftData: fixObjectText(body.draftData || null),
    isCreationDraft: Boolean(body.isCreationDraft),
    totalHt: Number(body.totalHt || 0),
    totalTtc: Number(body.totalTtc || 0),
    createdAt: quoteDate,
    createdAtIso: now,
    updatedAt: now
  };
  const quote = applyQuoteTotals(quoteBase);
  db.quotes.unshift(quote);
  syncDraftNotification(db, quote, userId);
  const projectIndex = quote.projectId ? db.projects.findIndex((project) => project.id === quote.projectId) : -1;
  if (projectIndex !== -1) {
    db.projects[projectIndex].quoteId = quote.id;
    db.projects[projectIndex].budgetHt = quote.totalHt;
    db.projects[projectIndex].status = "Devis genere";
    db.projects[projectIndex].updatedAt = now;
  }
  addHistory(db, {
    userId,
    type: "quote.created",
    label: `Devis enregistre: ${quote.quoteNumber}`,
    entityId: quote.id,
    entityType: "quote",
    meta: { totalTtc: quote.totalTtc }
  });
  await writeDb(db);
  return ok({ quote: normalizeQuote(quote) }, 201);
}

export async function PATCH(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = resolveUserId(body.userId || "", db);
  const index = findScopedIndex(db.quotes, body.id, userId);

  if (index === -1) {
    return ok({ error: "Devis introuvable." }, 404);
  }

  const now = new Date().toISOString();
  const quote = db.quotes[index];
  const action = body.action || "update";
  const user = db.users.find((item) => item.id === (body.userId || ""));

  if (action === "update" && body.manualSave) {
    const editGate = checkTrialEditLimit(user, quote.id);
    if (!editGate.allowed) return paywallRequired(editGate.reason);
    if (user) {
      if (editGate.claim) user.trialQuoteId = quote.id;
      user.trialSaveCount = editGate.nextCount;
    }
  }

  if (action === "send") {
    const sendGate = checkTrialSendLimit(user, quote);
    if (!sendGate.allowed) return paywallRequired(sendGate.reason);
    if (user && !user.trialQuoteId) user.trialQuoteId = quote.id;
  }

  if (action === "ready") {
    quote.status = "Pret a envoyer";
    quote.readyAt = now;
    addHistory(db, {
      userId: quote.userId || userId,
      type: "quote.ready",
      label: `Devis prêt à envoyer : ${quote.quoteNumber}`,
      entityId: quote.id,
      entityType: "quote"
    });
  }

  if (action === "send") {
    if (!quote.signatureToken) {
      quote.signatureToken = makeToken("sig");
    }
    // A new version is only minted when re-sending a quote that was already delivered before.
    if (quote.sentAt) {
      const currentVer = parseInt(quote.versionNumber || "001", 10);
      quote.versionNumber = String(currentVer + 1).padStart(3, "0");
    }
    const signatureAccess = buildSignatureAccess(db, quote, body, request, now);
    quote.signatureProvider = "koji-signature";
    quote.status = "Envoye";
    quote.signatureStatus = "En attente";
    quote.sentAt = now;
    const projectIndex = quote.projectId ? db.projects.findIndex((project) => project.id === quote.projectId) : -1;
    if (projectIndex !== -1) {
      db.projects[projectIndex].status = "En attente signature";
      db.projects[projectIndex].quoteId = quote.id;
      db.projects[projectIndex].updatedAt = now;
    }
    addHistory(db, {
      userId: quote.userId || userId,
      type: "quote.sent",
      label: `Lien de signature cree: ${quote.quoteNumber}`,
      entityId: quote.id,
      entityType: "quote",
      meta: {
        signatureUrl: quote.signatureUrl,
        localSignatureUrl: quote.localSignatureUrl,
        identifier: signatureAccess.identifier,
        sentByEmail: Boolean(signatureAccess.email),
        sentBySms: Boolean(normalizePhone(signatureAccess.phone))
      }
    });
  }

  if (action === "archive") {
    quote.status = "Archive";
    quote.archivedAt = now;
    addHistory(db, {
      userId: quote.userId || userId,
      type: "quote.archived",
      label: `Devis archive: ${quote.quoteNumber}`,
      entityId: quote.id,
      entityType: "quote"
    });
  }

  if (action === "cancel") {
    quote.status = "Annule";
    quote.cancelledAt = now;
    addHistory(db, {
      userId: quote.userId || userId,
      type: "quote.cancelled",
      label: `Devis annule: ${quote.quoteNumber}`,
      entityId: quote.id,
      entityType: "quote"
    });
  }

  if (action === "restore") {
    quote.status = body.status || (quote.signatureStatus === "Signe" ? "Signe" : "Brouillon");
    quote.archivedAt = "";
    quote.restoredAt = now;
    addHistory(db, {
      userId: quote.userId || userId,
      type: "quote.restored",
      label: `Devis restaure: ${quote.quoteNumber}`,
      entityId: quote.id,
      entityType: "quote"
    });
  }

  if (action === "delete") {
    removeDraftNotification(db, quote.id, quote.userId || userId);
    db.quotes.splice(index, 1);
    addHistory(db, {
      userId: quote.userId || userId,
      type: "quote.deleted",
      label: `Devis supprime: ${quote.quoteNumber}`,
      entityId: quote.id,
      entityType: "quote"
    });
    await writeDb(db);
    return ok({ quote: { ...quote, deleted: true } });
  }

  if (action === "update") {
    const allowed = ["client", "clientEmail", "clientPhone", "project", "projectId", "projectReference", "chantierAddress", "startDate", "expectedDuration", "workDescription", "validityDays", "company", "quoteDate", "createdAt", "rooms", "items", "notes", "surcharges", "vatRate", "totalHt", "totalTtc", "status", "draftStep", "draftData", "isCreationDraft"];
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        if (key === "draftStep") quote[key] = Number(body[key] || 0);
        else if (key === "validityDays") quote[key] = Number(body[key] || 30);
        else if (key === "isCreationDraft") quote[key] = Boolean(body[key]);
        else quote[key] = fixObjectText(body[key]);
      }
    }
    // Drafting/preview/autosave never bumps the version number. A new version only
    // exists once the quote is (re-)sent to the client - see the "send" action below.
  }

  syncDraftNotification(db, quote, quote.userId || userId);
  const recalculatedQuote = applyQuoteTotals(quote);
  recalculatedQuote.updatedAt = now;
  db.quotes[index] = recalculatedQuote;
  await writeDb(db);
  return ok({ quote: normalizeQuote(recalculatedQuote) });
}

