import { ok, badRequest } from "../../../../lib/http";
import { addHistory, makeToken, readDb, writeDb } from "../../../../lib/db";
import { fixObjectText, fixText } from "../../../../lib/text";

async function findQuoteByToken(token) {
  const db = await readDb();
  const index = db.quotes.findIndex((quote) => quote.signatureToken === token);
  return { db, index, quote: index === -1 ? null : db.quotes[index] };
}

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value = "") {
  return String(value || "").replace(/\D/g, "");
}

function uniqueList(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function makeTemporaryPassword() {
  const left = Math.random().toString(36).slice(2, 6).toUpperCase();
  const right = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `Koji-${left}-${right}`;
}

function queueClientAccessMessages(db, { user, password, quote, loginUrl, portalUrl, deliveryTarget, now }) {
  const name = fixText(user.name || quote.client || "Client");
  const identifier = deliveryTarget.email || deliveryTarget.phone || user.email;
  const text = [
    `Bonjour ${name},`,
    `Votre devis ${quote.quoteNumber} est signe.`,
    "Votre acces Koji Particulier est pret pour suivre l'avancement des travaux.",
    `Identifiant: ${identifier}`,
    `Mot de passe: ${password}`,
    `Connexion: ${loginUrl}`,
    `Espace particulier: ${portalUrl}`
  ].join("\n");

  if (deliveryTarget.email) {
    db.mailOutbox.unshift({
      id: `mail-client-${Date.now()}`,
      to: deliveryTarget.email,
      type: "client-access",
      accountType: "particulier",
      subject: "Votre acces Koji Particulier",
      text,
      html: `<p>Bonjour ${name},</p><p>Votre devis <strong>${quote.quoteNumber}</strong> est signe.</p><p>Votre acces Koji Particulier est pret pour suivre l'avancement des travaux.</p><p><strong>Identifiant:</strong> ${identifier}<br/><strong>Mot de passe:</strong> ${password}</p><p><a href="${loginUrl}">Se connecter</a></p>`,
      quoteId: quote.id,
      projectId: quote.projectId || "",
      createdAt: now
    });
  }

  if (deliveryTarget.phone) {
    db.smsOutbox.unshift({
      id: `sms-client-${Date.now()}`,
      to: deliveryTarget.phone,
      type: "client-access",
      text: `Koji: votre devis ${quote.quoteNumber} est signe. Identifiant: ${identifier}. Mot de passe: ${password}. Connexion: ${loginUrl}`,
      quoteId: quote.id,
      projectId: quote.projectId || "",
      createdAt: now
    });
  }
}

function ensureClientPortalAccess(db, quote, body, request, now) {
  const signedEmail = normalizeEmail(body.signerEmail || quote.signerEmail || quote.clientEmail);
  const signedPhone = fixText(body.signerPhone || quote.clientPhone || "");
  const signedPhoneDigits = normalizePhone(signedPhone);
  if (!signedEmail && !signedPhoneDigits) return null;

  const syntheticEmail = signedEmail || `client-${signedPhoneDigits}@koji.local`;
  const userIndex = db.users.findIndex((candidate) => {
    const candidateType = candidate.accountType || "entreprise";
    const candidatePhone = normalizePhone(candidate.phone || candidate.personal?.phone);
    return candidateType === "particulier" && (
      normalizeEmail(candidate.email) === syntheticEmail ||
      (signedEmail && normalizeEmail(candidate.email) === signedEmail) ||
      (signedPhoneDigits && candidatePhone === signedPhoneDigits)
    );
  });

  const generatedPassword = makeTemporaryPassword();
  const existing = userIndex === -1 ? null : db.users[userIndex];
  const password = existing?.password || generatedPassword;
  const clientAccess = {
    ...(existing?.clientAccess || {}),
    quoteIds: uniqueList([...(existing?.clientAccess?.quoteIds || []), quote.id]),
    projectIds: uniqueList([...(existing?.clientAccess?.projectIds || []), quote.projectId || ""]),
    lastQuoteId: quote.id,
    lastProjectId: quote.projectId || "",
    updatedAt: now
  };

  const user = {
    ...(existing || {}),
    id: existing?.id || makeToken("client"),
    email: existing?.email || syntheticEmail,
    password,
    name: fixText(body.signerName || quote.signerName || quote.client || existing?.name || "Client Koji"),
    accountType: "particulier",
    isActive: true,
    activationToken: existing?.activationToken || "",
    activationExpiresAt: existing?.activationExpiresAt || "",
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    lastLoginAt: existing?.lastLoginAt || "",
    businessInfoComplete: existing?.businessInfoComplete || false,
    profileComplete: true,
    business: existing?.business || {},
    personal: {
      ...(existing?.personal || {}),
      phone: signedPhone || existing?.personal?.phone || "",
      sourceQuoteId: quote.id
    },
    professions: existing?.professions || [],
    clientAccess
  };

  if (userIndex === -1) db.users.push(user);
  else db.users[userIndex] = user;

  const origin = new URL(request.url).origin;
  const loginUrl = `${origin}/login?type=particulier`;
  const portalUrl = `${origin}/client`;
  const deliveryTarget = { email: signedEmail, phone: signedPhoneDigits ? signedPhone : "" };
  queueClientAccessMessages(db, { user, password, quote, loginUrl, portalUrl, deliveryTarget, now });

  return {
    userId: user.id,
    identifier: signedEmail || signedPhone,
    email: signedEmail,
    phone: signedPhone,
    loginUrl,
    portalUrl,
    sentByEmail: Boolean(signedEmail),
    sentBySms: Boolean(signedPhoneDigits)
  };
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
      signerName: quote.signerName,
      clientPhone: fixText(quote.clientPhone || ""),
      clientPortalUserId: quote.clientPortalUserId || "",
      clientPortalAccessSentAt: quote.clientPortalAccessSentAt || "",
      signaturePlace: fixText(quote.signaturePlace || "")
    }
  });
}

export async function POST(request, context) {
  const { token } = await context.params;
  const body = await request.json();
  const { db, index, quote } = await findQuoteByToken(token);
  if (!quote) return badRequest("Lien de signature invalide.", 404);
  if (quote.signatureStatus === "Signe") return ok({ quote: fixObjectText(quote), clientAccess: quote.clientPortalAccess || null });
  if (!body.consent) return badRequest("La validation client est obligatoire.");

  const now = new Date().toISOString();
  const updated = {
    ...quote,
    status: "Signe",
    signatureStatus: "Signe",
    signerName: fixText(body.signerName || quote.client || "Client"),
    signerEmail: normalizeEmail(body.signerEmail || quote.clientEmail || ""),
    clientEmail: normalizeEmail(body.signerEmail || quote.clientEmail || ""),
    clientPhone: fixText(body.signerPhone || quote.clientPhone || ""),
    signaturePlace: fixText(body.signaturePlace || ""),
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

  const clientAccess = ensureClientPortalAccess(db, updated, body, request, now);
  if (clientAccess) {
    updated.clientPortalUserId = clientAccess.userId;
    updated.clientPortalEmail = clientAccess.email;
    updated.clientPortalPhone = clientAccess.phone;
    updated.clientPortalLoginUrl = clientAccess.loginUrl;
    updated.clientPortalAccessSentAt = now;
    updated.clientPortalAccess = clientAccess;
    db.quotes[index] = updated;

    db.notifications.unshift({
      id: `notif-client-access-${updated.id}-${Date.now()}`,
      userId: updated.userId || "",
      type: "client.access.sent",
      title: "Acces Koji Particulier envoye",
      message: `Le client peut maintenant suivre le chantier lie au devis ${updated.quoteNumber}.`,
      quoteId: updated.id,
      projectId: updated.projectId || "",
      read: false,
      createdAt: now
    });

    addHistory(db, {
      userId: updated.userId || "",
      type: "client.access.sent",
      label: `Acces client envoye: ${updated.quoteNumber}`,
      entityId: updated.id,
      entityType: "quote",
      meta: { clientUserId: clientAccess.userId, email: clientAccess.email, phone: clientAccess.phone }
    });
  }

  await writeDb(db);
  return ok({ quote: fixObjectText(updated), clientAccess });
}
