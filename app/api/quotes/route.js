import { badRequest, ok } from "../../../lib/http";
import { addHistory, makeToken, readDb, writeDb } from "../../../lib/db";
import { fixObjectText, fixText } from "../../../lib/text";
import { applyQuoteTotals } from "../../../lib/quote-calculations";
import { getAuth } from "../../../lib/server-auth";
import { mapQuote, quoteToRow } from "../../../lib/quote-mapping";

// Quotes live in the shared `quotes` table used by the koji-main Flutter app
// (same table it reads via QuoteRepository), so both apps see the same devis.
// `rooms`/`items` stay a JSON blob on the row (like koji-web always stored
// them) instead of being split into the app's `quote_rooms`/`quote_tasks`
// tables, to avoid rewriting DevisEditor.jsx's data shape. Fields the mobile
// schema has no column for live in `web_extras` JSONB; fields the mobile app
// already reads (client, dates, company) are mirrored into `metadata` JSONB
// so a web-created devis also renders correctly on mobile.

const QUOTE_HISTORY_LABEL = {
  ready: (q) => `Devis prêt à envoyer : ${q.quoteNumber}`,
  send: (q) => `Lien de signature cree: ${q.quoteNumber}`,
  archive: (q) => `Devis archive: ${q.quoteNumber}`,
  cancel: (q) => `Devis annule: ${q.quoteNumber}`,
  restore: (q) => `Devis restaure: ${q.quoteNumber}`
};

function buildSignatureLinks(request, quote, identifier = "") {
  const origin = new URL(request.url).origin;
  const signatureBase = process.env.PUBLIC_SIGNATURE_BASE_URL || origin;
  const signaturePath = process.env.PUBLIC_SIGNATURE_LOGIN_PATH || "/signature/login";
  const cleanSignatureBase = String(signatureBase).replace(/\/$/, "");
  const cleanSignaturePath = signaturePath.startsWith("/") ? signaturePath : `/${signaturePath}`;
  const localSignatureUrl = `${origin}/signature/${quote.signatureToken}`;
  const signatureUrl = new URL(`${cleanSignatureBase}${cleanSignaturePath}`);
  signatureUrl.searchParams.set("signatureToken", quote.signatureToken);
  if (identifier) signatureUrl.searchParams.set("identifier", identifier);
  return { signatureUrl: signatureUrl.toString(), localSignatureUrl };
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

async function nextQuoteNumberFor(auth, existingReference = "") {
  const year = new Date().getFullYear();
  const prefix = `${year}_`;
  const { data } = await auth.supabase
    .from("quotes")
    .select("reference")
    .eq("user_id", auth.userId)
    .like("reference", `${prefix}%`);
  let maxSeq = 1048;
  for (const row of data || []) {
    const match = (row.reference || "").match(new RegExp(`^${year}_(\\d+)$`));
    if (match) maxSeq = Math.max(maxSeq, parseInt(match[1], 10));
  }
  const existingMatch = existingReference.match(new RegExp(`^${year}_(\\d+)$`));
  if (existingMatch) maxSeq = Math.max(maxSeq, parseInt(existingMatch[1], 10) - 1);
  return `${prefix}${String(maxSeq + 1).padStart(4, "0")}`;
}

export async function GET(request) {
  const auth = getAuth(request);
  const year = new Date().getFullYear();
  if (!auth) return ok({ quotes: [], nextQuoteNumber: `${year}_1049` });

  const { data, error } = await auth.supabase
    .from("quotes")
    .select("*")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false });
  if (error) return badRequest(`Lecture des devis impossible: ${error.message}`, 500);

  const db = await readDb();
  const quotes = (data || []).map((row) => withClientPortalAccess(mapQuote(row), db));
  const nextQuoteNumber = await nextQuoteNumberFor(auth);

  return ok({ quotes, nextQuoteNumber });
}

export async function POST(request) {
  const body = await request.json();
  const auth = getAuth(request, body);
  if (!auth) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const now = new Date().toISOString();
  const quoteDate = body.quoteDate || body.createdAt || now.slice(0, 10);
  const quoteNumber = await nextQuoteNumberFor(auth);

  const draft = {
    id: "",
    userId: auth.userId,
    quoteNumber,
    versionNumber: body.versionNumber || "001",
    client: fixText(body.client || "Client"),
    clientReference: fixText(body.clientReference || ""),
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
  const computed = applyQuoteTotals(draft);
  const row = quoteToRow(computed, auth.userId);

  const { data: inserted, error } = await auth.supabase.from("quotes").insert(row).select().single();
  if (error) return badRequest(`Création du devis impossible: ${error.message}`, 500);

  const quote = mapQuote(inserted);

  if (quote.projectId) {
    await auth.supabase.from("chantiers").update({ status: "Devis genere" }).eq("id", quote.projectId);
  }

  const db = await readDb();
  syncDraftNotification(db, quote, auth.userId);
  addHistory(db, {
    userId: auth.userId,
    type: "quote.created",
    label: `Devis enregistre: ${quote.quoteNumber}`,
    entityId: quote.id,
    entityType: "quote",
    meta: { totalTtc: quote.totalTtc }
  });
  await writeDb(db);

  return ok({ quote }, 201);
}

export async function PATCH(request) {
  const body = await request.json();
  const auth = getAuth(request, body);
  if (!auth) return badRequest("Session expirée. Reconnectez-vous.", 401);
  if (!body.id) return badRequest("Identifiant du devis manquant.");

  const { data: existingRow, error: fetchError } = await auth.supabase
    .from("quotes")
    .select("*")
    .eq("id", body.id)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (fetchError) return badRequest(`Lecture du devis impossible: ${fetchError.message}`, 500);
  if (!existingRow) return ok({ error: "Devis introuvable." }, 404);

  const now = new Date().toISOString();
  const quote = mapQuote(existingRow);
  const action = body.action || "update";

  if (action === "ready") {
    quote.status = "Pret a envoyer";
    quote.readyAt = now;
  }

  let signatureAccess = null;
  const sideDb = await readDb();

  if (action === "send") {
    if (!quote.signatureToken) quote.signatureToken = makeToken("sig");
    if (quote.sentAt) {
      const currentVer = parseInt(quote.versionNumber || "001", 10);
      quote.versionNumber = String(currentVer + 1).padStart(3, "0");
    }
    signatureAccess = buildSignatureAccess(sideDb, quote, body, request, now);
    quote.signatureProvider = "koji-signature";
    quote.status = "Envoye";
    quote.signatureStatus = "En attente";
    quote.sentAt = now;
    if (quote.projectId) {
      await auth.supabase.from("chantiers").update({ status: "En attente signature" }).eq("id", quote.projectId);
    }
  }

  if (action === "archive") {
    quote.status = "Archive";
    quote.archivedAt = now;
  }

  if (action === "cancel") {
    quote.status = "Annule";
    quote.cancelledAt = now;
  }

  if (action === "restore") {
    quote.status = body.status || (quote.signatureStatus === "Signe" ? "Signe" : "Brouillon");
    quote.archivedAt = "";
    quote.restoredAt = now;
  }

  if (action === "delete") {
    const { error: delError } = await auth.supabase.from("quotes").delete().eq("id", body.id);
    if (delError) return badRequest(`Suppression impossible: ${delError.message}`, 500);
    removeDraftNotification(sideDb, quote.id, auth.userId);
    addHistory(sideDb, {
      userId: auth.userId,
      type: "quote.deleted",
      label: `Devis supprime: ${quote.quoteNumber}`,
      entityId: quote.id,
      entityType: "quote"
    });
    await writeDb(sideDb);
    return ok({ quote: { ...quote, deleted: true } });
  }

  if (action === "update") {
    const allowed = ["client", "clientReference", "clientEmail", "clientPhone", "project", "projectId", "projectReference", "chantierAddress", "startDate", "expectedDuration", "workDescription", "validityDays", "company", "quoteDate", "createdAt", "rooms", "items", "notes", "surcharges", "vatRate", "totalHt", "totalTtc", "status", "draftStep", "draftData", "isCreationDraft"];
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        if (key === "draftStep") quote[key] = Number(body[key] || 0);
        else if (key === "validityDays") quote[key] = Number(body[key] || 30);
        else if (key === "isCreationDraft") quote[key] = Boolean(body[key]);
        else quote[key] = fixObjectText(body[key]);
      }
    }
    // A manual save (Générer/Aperçu/Enregistrer/Envoyer, as opposed to the
    // silent autosave) on an already-created devis counts as a new revision.
    if (body.manualSave) {
      const currentVer = parseInt(quote.versionNumber || "001", 10);
      quote.versionNumber = String(currentVer + 1).padStart(3, "0");
    }
  }

  syncDraftNotification(sideDb, quote, auth.userId);
  if (QUOTE_HISTORY_LABEL[action]) {
    addHistory(sideDb, {
      userId: auth.userId,
      type: `quote.${action}`,
      label: QUOTE_HISTORY_LABEL[action](quote),
      entityId: quote.id,
      entityType: "quote",
      meta: action === "send" ? {
        signatureUrl: quote.signatureUrl,
        localSignatureUrl: quote.localSignatureUrl,
        identifier: signatureAccess?.identifier,
        sentByEmail: Boolean(signatureAccess?.email),
        sentBySms: Boolean(normalizePhone(signatureAccess?.phone || ""))
      } : undefined
    });
  }
  await writeDb(sideDb);

  const recalculated = applyQuoteTotals(quote);
  recalculated.updatedAt = now;
  const row = quoteToRow(recalculated, auth.userId);
  const { data: updatedRow, error: updateError } = await auth.supabase
    .from("quotes")
    .update(row)
    .eq("id", body.id)
    .select()
    .single();
  if (updateError) return badRequest(`Mise à jour du devis impossible: ${updateError.message}`, 500);

  return ok({ quote: mapQuote(updatedRow) });
}
