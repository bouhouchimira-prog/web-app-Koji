import { badRequest, ok } from "../../../lib/http";
import { readDb, writeDb } from "../../../lib/db";
import { getAuth, getVerifiedUserId, isUuid } from "../../../lib/server-auth";
import { getSupabaseAdmin } from "../../../lib/supabase";
import { buildWebUser } from "../../../lib/user-profile";
import { computeQuoteItem } from "../../../lib/quote-calculations";
import { mapQuote } from "../../../lib/quote-mapping";
import { fixText } from "../../../lib/text";
import { sendClientMessageEmail } from "../../../lib/mailer";
import { accesReseau, cleanText, daysBetween, distanceBetween, documentsStatus, initials, publicProfil, vitrineReseau } from "../../../lib/reseau";

// Tables reseau_* (supabase_web_setup.sql, section « Réseau pro ») : une
// ligne par profil, besoin, échange et message. Lues et écrites uniquement
// ici avec la clé service_role ; aucun accès direct depuis le navigateur.

const METIER_MAX = 60;
const MAX_METIERS = 6;
const BESOIN_STATUSES = new Set(["ouvert", "pourvu", "ferme"]);
const LIST_LIMIT = 300;

// L'identité vient toujours de getVerifiedUserId, jamais du simple décodage
// du jeton : les tables sont lues avec la clé service_role, sans RLS.
async function authenticate(request, body = null) {
  const userId = await getVerifiedUserId(request, body);
  const auth = userId && isUuid(userId) ? getAuth(request, body) : null;
  if (!auth || auth.userId !== userId) return null;
  return auth;
}

async function loadMe(auth) {
  const { data: profile } = await auth.supabase.from("users").select("*").eq("id", auth.userId).maybeSingle();
  const user = buildWebUser({ id: auth.userId, email: profile?.email || "", profile });
  const business = user.business || {};
  return {
    user,
    companyName: fixText(business.raisonSociale || user.name || "Entreprise"),
    professions: Array.isArray(user.professions) ? user.professions : [],
    zone: { lat: business.zoneLat, lon: business.zoneLon },
    radiusKm: Number(business.zoneRadiusKm || 20),
    city: fixText(business.city || business.zoneAddress || "")
  };
}

function coordsOf(row) {
  return { lat: row.zone_lat, lon: row.zone_lon };
}

function toProfil(row) {
  return {
    id: row.id,
    companyName: row.company_name,
    visible: row.visible,
    metiers: row.metiers || [],
    zone: row.zone,
    availableFrom: row.available_from || "",
    availabilityNote: row.availability_note,
    kbisDate: row.kbis_date || "",
    urssafUntil: row.urssaf_until || "",
    decennaleUntil: row.decennale_until || "",
    coords: coordsOf(row)
  };
}

function besoinView(row, userId, viewerZone, responses, myEchangeId) {
  const mine = row.user_id === userId;
  return {
    id: row.id,
    mine,
    companyName: row.company_name,
    initials: initials(row.company_name),
    title: row.title,
    metier: row.metier,
    startDate: row.start_date || "",
    endDate: row.end_date || "",
    days: daysBetween(row.start_date, row.end_date),
    city: row.city,
    distanceKm: mine ? null : distanceBetween(viewerZone, coordsOf(row)),
    budgetHt: row.budget_ht === null ? null : Number(row.budget_ht),
    fournitures: row.fournitures,
    message: row.message,
    lotLabel: row.lot_label,
    projectTitle: mine || !row.hide_client ? row.project_title : "",
    status: row.status,
    responses,
    myEchangeId,
    createdAt: row.created_at
  };
}

function echangeView(row, userId, messages, besoin) {
  const iAmA = row.user_a === userId;
  const otherName = (iAmA ? row.name_b : row.name_a) || "Entreprise";
  return {
    id: row.id,
    besoinId: row.besoin_id,
    besoinTitle: besoin?.title || "",
    iOwnBesoin: Boolean(besoin && besoin.user_id === userId),
    other: { companyName: otherName, initials: initials(otherName) },
    status: row.status,
    messages: messages.map((message) => ({ id: message.id, mine: message.from_user === userId, text: message.text, at: message.created_at })),
    updatedAt: row.updated_at
  };
}

function fail(error) {
  return badRequest(`Réseau pro indisponible : ${error.message}`, 500);
}

// Les notifications restent dans le système existant (koji_web_state) ;
// seule la notification passe par ce gros document, jamais le message.
async function notify(userId, { title, message, echangeId }) {
  const db = await readDb();
  db.notifications.unshift({
    id: `notif-reseau-${echangeId}-${Date.now()}`,
    userId,
    type: "reseau.message",
    title,
    message,
    actionUrl: `/reseau-pro?tab=echanges&e=${echangeId}`,
    actionLabel: "Ouvrir l'échange",
    read: false,
    createdAt: new Date().toISOString()
  });
  await writeDb(db);
}

async function echangeWithMessages(supabase, row, userId) {
  const [{ data: messages, error }, { data: besoin }] = await Promise.all([
    supabase.from("reseau_messages").select("*").eq("echange_id", row.id).order("created_at"),
    row.besoin_id ? supabase.from("reseau_besoins").select("id,title,user_id").eq("id", row.besoin_id).maybeSingle() : Promise.resolve({ data: null })
  ]);
  if (error) throw error;
  return echangeView(row, userId, messages || [], besoin);
}

async function addMessage(supabase, echangeId, userId, text) {
  const now = new Date().toISOString();
  const { error } = await supabase.from("reseau_messages").insert({ id: `rm-${crypto.randomUUID()}`, echange_id: echangeId, from_user: userId, text, created_at: now });
  if (error) throw error;
  const { data: row, error: updateError } = await supabase.from("reseau_echanges").update({ updated_at: now }).eq("id", echangeId).select().single();
  if (updateError) throw updateError;
  return row;
}

// « Mes lots sans intervenant » : tâches de mes chantiers sans personne
// affectée, par lot, avec le montant du lot au devis signé et sa
// main-d'œuvre (budget indicatif d'un besoin publié depuis ce lot).
async function lotsSansIntervenant(userId, besoinRows) {
  const db = await readDb();
  const groupes = new Map();
  for (const task of (db.tasks || []).filter((x) => x.userId === userId && !x.done && x.projectId && !(Array.isArray(x.workerIds) && x.workerIds.length))) {
    const lot = fixText(task.room || task.label || "Lot");
    const cle = `${task.projectId}|${lot}`;
    const debut = task.startDate || task.dueDate || "";
    const fin = task.endDate || task.dueDate || task.startDate || "";
    const g = groupes.get(cle);
    if (!g) groupes.set(cle, { cle, projectId: task.projectId, lot, debut, fin });
    else {
      if (debut && (!g.debut || debut < g.debut)) g.debut = debut;
      if (fin && fin > g.fin) g.fin = fin;
    }
  }
  if (!groupes.size) return [];
  const ids = [...new Set([...groupes.values()].map((g) => g.projectId))];
  const admin = getSupabaseAdmin();
  const [{ data: chantiers }, { data: devis }] = await Promise.all([
    admin.from("chantiers").select("id,reference,city,user_id").in("id", ids),
    admin.from("quotes").select("*").in("chantier_id", ids)
  ]);
  const titres = new Map((chantiers || []).filter((c) => c.user_id === userId).map((c) => [c.id, [c.reference || "Chantier", c.city].filter(Boolean).join(", ")]));
  const signes = (devis || []).map(mapQuote).filter((q) => q.userId === userId && (q.status === "Signe" || q.signatureStatus === "Signe"));
  const publies = new Set(besoinRows.filter((b) => b.user_id === userId && b.status === "ouvert").map((b) => `${b.project_id}|${b.lot_label}`));
  const r2 = (n) => Math.round(n * 100) / 100;
  return [...groupes.values()].filter((g) => titres.has(g.projectId)).slice(0, 8).map((g) => {
    const q = signes.find((x) => x.projectId === g.projectId);
    const calc = (q?.items || []).filter((it) => fixText(it.room || "") === g.lot).map((it) => computeQuoteItem(it, q));
    return { ...g, projectTitle: titres.get(g.projectId), totalHt: r2(calc.reduce((n, c) => n + (Number(c.totalHt) || 0), 0)), moHt: r2(calc.reduce((n, c) => n + (Number(c.laborCostHt) || 0), 0)), publie: publies.has(`${g.projectId}|${g.lot}`) };
  });
}

export async function GET(request) {
  const auth = await authenticate(request);
  if (!auth) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const me = await loadMe(auth);
  const supabase = getSupabaseAdmin();
  if (!accesReseau(me.user)) {
    const { data } = await supabase.from("reseau_profils").select("visible,metiers,kbis_date,urssaf_until,decennale_until").eq("visible", true).limit(LIST_LIMIT);
    return ok({ locked: true, vitrine: vitrineReseau((data || []).map((x) => ({ visible: x.visible, metiers: x.metiers, kbisDate: x.kbis_date, urssafUntil: x.urssaf_until, decennaleUntil: x.decennale_until }))) });
  }

  const userId = auth.userId;
  const [profilsRes, besoinsRes, echangesRes] = await Promise.all([
    supabase.from("reseau_profils").select("*").or(`visible.eq.true,user_id.eq.${userId}`).limit(LIST_LIMIT),
    supabase.from("reseau_besoins").select("*").or(`status.eq.ouvert,user_id.eq.${userId}`).order("created_at", { ascending: false }).limit(LIST_LIMIT),
    supabase.from("reseau_echanges").select("*").or(`user_a.eq.${userId},user_b.eq.${userId}`).order("updated_at", { ascending: false }).limit(LIST_LIMIT)
  ]);
  const failed = [profilsRes, besoinsRes, echangesRes].find((result) => result.error);
  if (failed) return fail(failed.error);

  const besoinRows = besoinsRes.data || [];
  const echangeRows = echangesRes.data || [];
  const besoinIds = besoinRows.map((row) => row.id);
  const echangeIds = echangeRows.map((row) => row.id);
  const extraBesoinIds = [...new Set(echangeRows.map((row) => row.besoin_id).filter((id) => id && !besoinIds.includes(id)))];

  const [countsRes, messagesRes, extraRes] = await Promise.all([
    besoinIds.length ? supabase.from("reseau_echanges").select("besoin_id").in("besoin_id", besoinIds) : Promise.resolve({ data: [] }),
    echangeIds.length ? supabase.from("reseau_messages").select("*").in("echange_id", echangeIds).order("created_at") : Promise.resolve({ data: [] }),
    extraBesoinIds.length ? supabase.from("reseau_besoins").select("id,title,user_id").in("id", extraBesoinIds) : Promise.resolve({ data: [] })
  ]);
  const failedMore = [countsRes, messagesRes, extraRes].find((result) => result.error);
  if (failedMore) return fail(failedMore.error);

  const responses = new Map();
  (countsRes.data || []).forEach((row) => responses.set(row.besoin_id, (responses.get(row.besoin_id) || 0) + 1));
  const myEchangeByBesoin = new Map(echangeRows.filter((row) => row.besoin_id).map((row) => [row.besoin_id, row.id]));
  const besoinById = new Map([...besoinRows, ...(extraRes.data || [])].map((row) => [row.id, row]));
  const messagesByEchange = new Map();
  (messagesRes.data || []).forEach((message) => {
    if (!messagesByEchange.has(message.echange_id)) messagesByEchange.set(message.echange_id, []);
    messagesByEchange.get(message.echange_id).push(message);
  });

  const profilRows = profilsRes.data || [];
  const mineRow = profilRows.find((row) => row.user_id === userId) || null;
  const mineProfil = mineRow ? toProfil(mineRow) : null;

  // Un document déclaré expiré masque le profil (règle de la maquette) ; un
  // document jamais renseigné le laisse visible, marqué « à jour requis ».
  const pros = profilRows
    .filter((row) => row.user_id !== userId && row.visible)
    .map(toProfil)
    .filter((profil) => !documentsStatus(profil).expired)
    .map((profil) => publicProfil(profil, me.zone))
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || a.companyName.localeCompare(b.companyName));

  return ok({
    locked: false,
    me: {
      companyName: me.companyName,
      professions: me.professions,
      hasZone: distanceBetween(me.zone, me.zone) !== null,
      radiusKm: me.radiusKm,
      city: me.city,
      profil: mineProfil ? { ...mineProfil, coords: undefined } : null,
      documents: documentsStatus(mineProfil)
    },
    besoins: besoinRows.map((row) => besoinView(row, userId, me.zone, responses.get(row.id) || 0, myEchangeByBesoin.get(row.id) || "")),
    pros,
    lots: await lotsSansIntervenant(auth.userId, besoinRows).catch(() => []),
    echanges: echangeRows.map((row) => echangeView(row, userId, messagesByEchange.get(row.id) || [], besoinById.get(row.besoin_id)))
  });
}

export async function POST(request) {
  const body = await request.json();
  const auth = await authenticate(request, body);
  if (!auth) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const me = await loadMe(auth);
  if (!accesReseau(me.user)) return badRequest("Le Réseau pro est inclus dans les offres Pro et Business.", 402);

  const supabase = getSupabaseAdmin();
  const userId = auth.userId;
  const now = new Date().toISOString();
  const action = body.action;

  try {
    if (action === "profil") {
      const metiers = (Array.isArray(body.metiers) ? body.metiers : [])
        .map((metier) => cleanText(metier, METIER_MAX)).filter(Boolean).slice(0, MAX_METIERS);
      const { data: existing } = await supabase.from("reseau_profils").select("id").eq("user_id", userId).maybeSingle();
      const { error } = await supabase.from("reseau_profils").upsert({
        id: existing?.id || `rp-${crypto.randomUUID()}`,
        user_id: userId,
        company_name: me.companyName,
        visible: Boolean(body.visible),
        metiers,
        zone: cleanText(body.zone, 120) || me.city,
        available_from: cleanText(body.availableFrom, 10) || null,
        availability_note: cleanText(body.availabilityNote, 200),
        kbis_date: cleanText(body.kbisDate, 10) || null,
        urssaf_until: cleanText(body.urssafUntil, 10) || null,
        decennale_until: cleanText(body.decennaleUntil, 10) || null,
        zone_lat: me.zone.lat ?? null,
        zone_lon: me.zone.lon ?? null,
        updated_at: now
      }, { onConflict: "user_id" });
      if (error) throw error;
      return ok({ saved: true });
    }

    if (action === "besoin") {
      const title = cleanText(body.title, 200);
      const metier = cleanText(body.metier, METIER_MAX);
      if (!title || !metier) return badRequest("Décrivez le besoin et choisissez le métier.");
      const startDate = cleanText(body.startDate, 10);
      const endDate = cleanText(body.endDate, 10) || startDate;
      if (startDate && endDate < startDate) return badRequest("La date de fin est avant la date de début.");
      const budget = Number(body.budgetHt);
      const { data: row, error } = await supabase.from("reseau_besoins").insert({
        id: `rb-${crypto.randomUUID()}`,
        user_id: userId,
        company_name: me.companyName,
        title,
        metier,
        start_date: startDate || null,
        end_date: endDate || null,
        budget_ht: Number.isFinite(budget) && budget > 0 ? Math.round(budget * 100) / 100 : null,
        fournitures: body.fournitures === "sous-traitant" ? "sous-traitant" : "moi",
        city: cleanText(body.city, 120) || me.city,
        message: cleanText(body.message),
        hide_client: body.hideClient !== false,
        project_id: cleanText(body.projectId, 80),
        project_title: cleanText(body.projectTitle, 160),
        lot_label: cleanText(body.lotLabel, 120),
        zone_lat: me.zone.lat ?? null,
        zone_lon: me.zone.lon ?? null,
        created_at: now,
        updated_at: now
      }).select().single();
      if (error) throw error;
      return ok({ besoin: besoinView(row, userId, me.zone, 0, "") }, 201);
    }

    if (action === "besoin-statut") {
      if (!BESOIN_STATUSES.has(body.status)) return badRequest("Statut inconnu.");
      const { data: row, error } = await supabase.from("reseau_besoins").update({ status: body.status, updated_at: now })
        .eq("id", cleanText(body.id, 80)).eq("user_id", userId).select().maybeSingle();
      if (error) throw error;
      if (!row) return badRequest("Besoin introuvable.", 404);
      return ok({ besoin: besoinView(row, userId, me.zone, 0, "") });
    }

    if (action === "contacter") {
      const text = cleanText(body.text);
      if (!text) return badRequest("Écrivez un message.");
      let otherId = "";
      let otherName = "";
      let besoinId = "";
      if (body.besoinId) {
        const { data: besoin } = await supabase.from("reseau_besoins").select("id,user_id,company_name,status").eq("id", cleanText(body.besoinId, 80)).maybeSingle();
        if (!besoin || besoin.status !== "ouvert") return badRequest("Ce besoin n'est plus ouvert.", 404);
        if (besoin.user_id === userId) return badRequest("C'est votre propre besoin.");
        otherId = besoin.user_id;
        otherName = besoin.company_name;
        besoinId = besoin.id;
      } else {
        const { data: profil } = await supabase.from("reseau_profils").select("user_id,company_name,visible").eq("id", cleanText(body.profilId, 80)).maybeSingle();
        if (!profil || !profil.visible || profil.user_id === userId) return badRequest("Profil introuvable.", 404);
        otherId = profil.user_id;
        otherName = profil.company_name;
      }

      const findPair = () => supabase.from("reseau_echanges").select("*").eq("besoin_id", besoinId)
        .or(`and(user_a.eq.${userId},user_b.eq.${otherId}),and(user_a.eq.${otherId},user_b.eq.${userId})`).maybeSingle();
      let { data: echange, error: findError } = await findPair();
      if (findError) throw findError;
      if (!echange) {
        const { data: created, error: insertError } = await supabase.from("reseau_echanges").insert({
          id: `re-${crypto.randomUUID()}`, besoin_id: besoinId, user_a: userId, user_b: otherId,
          name_a: me.companyName, name_b: otherName, created_at: now, updated_at: now
        }).select().single();
        // 23505 : l'autre entreprise a ouvert le même échange au même instant.
        if (insertError && insertError.code !== "23505") throw insertError;
        echange = created || (await findPair()).data;
      }
      const updated = await addMessage(supabase, echange.id, userId, text);
      await notify(otherId, {
        title: besoinId ? "Nouvelle réponse à votre besoin" : "Nouveau message du Réseau pro",
        message: `${me.companyName} : ${text.slice(0, 140)}`,
        echangeId: echange.id
      });
      return ok({ echange: await echangeWithMessages(supabase, updated, userId) }, 201);
    }

    if (action === "message") {
      const text = cleanText(body.text);
      if (!text) return badRequest("Écrivez un message.");
      const { data: echange } = await supabase.from("reseau_echanges").select("*").eq("id", cleanText(body.echangeId, 80)).maybeSingle();
      if (!echange || (echange.user_a !== userId && echange.user_b !== userId)) return badRequest("Échange introuvable.", 404);
      const updated = await addMessage(supabase, echange.id, userId, text);
      await notify(echange.user_a === userId ? echange.user_b : echange.user_a, {
        title: "Nouveau message du Réseau pro",
        message: `${me.companyName} : ${text.slice(0, 140)}`,
        echangeId: echange.id
      });
      return ok({ echange: await echangeWithMessages(supabase, updated, userId) });
    }

    if (action === "signaler") {
      const motif = cleanText(body.motif, 500);
      if (!motif) return badRequest("Dites ce que vous signalez.");
      const { data: echange } = await supabase.from("reseau_echanges").select("*").eq("id", cleanText(body.echangeId, 80)).maybeSingle();
      if (!echange || (echange.user_a !== userId && echange.user_b !== userId)) return badRequest("Échange introuvable.", 404);
      const db = await readDb();
      db.reseauSignalements = [{ id: `rs-${Date.now()}`, echangeId: echange.id, parUserId: userId, contreUserId: echange.user_a === userId ? echange.user_b : echange.user_a, motif, le: now }, ...(db.reseauSignalements || [])];
      await writeDb(db);
      await sendClientMessageEmail({ to: "contact@getkoji.io", subject: `Réseau pro · signalement · ${me.companyName}`, message: `${me.companyName} signale l'échange ${echange.id} avec ${echange.user_a === userId ? echange.name_b : echange.name_a}.

Motif : ${motif}` }).catch(() => null);
      return ok({ signale: true });
    }

    if (action === "retenir") {
      const { data: echange } = await supabase.from("reseau_echanges").select("*").eq("id", cleanText(body.echangeId, 80)).maybeSingle();
      const { data: besoin } = echange?.besoin_id
        ? await supabase.from("reseau_besoins").select("*").eq("id", echange.besoin_id).maybeSingle()
        : { data: null };
      if (!echange || !besoin || besoin.user_id !== userId) return badRequest("Seul l'auteur du besoin peut retenir un pro.", 403);
      const [{ data: updatedEchange, error: echangeError }, { data: updatedBesoin, error: besoinError }] = await Promise.all([
        supabase.from("reseau_echanges").update({ status: "retenu", updated_at: now }).eq("id", echange.id).select().single(),
        supabase.from("reseau_besoins").update({ status: "pourvu", updated_at: now }).eq("id", besoin.id).select().single()
      ]);
      if (echangeError || besoinError) throw echangeError || besoinError;
      // Le pro retenu entre dans Contacts comme sous-traitant (vigilance,
      // affectation au chantier, contrat de sous-traitance).
      const autreId = echange.user_a === userId ? echange.user_b : echange.user_a;
      const autreNom = (echange.user_a === userId ? echange.name_b : echange.name_a) || "Sous-traitant";
      const db = await readDb();
      db.contacts = db.contacts || [];
      let contact = db.contacts.find((c) => c.userId === userId && (c.reseauUserId === autreId || String(c.companyName || "").toLowerCase() === autreNom.toLowerCase()));
      if (!contact) {
        contact = { id: `contact-${Date.now()}`, userId, archived: false, archivedAt: "", createdAt: now, updatedAt: now, roles: ["sous_traitant"], companyName: autreNom, metier: besoin.metier || "", source: "reseau" };
        db.contacts.unshift(contact);
      }
      contact.reseauUserId = autreId;
      if (!(contact.roles || []).includes("sous_traitant")) contact.roles = [...(contact.roles || []), "sous_traitant"];
      if (besoin.project_id) {
        db.chantierContacts = db.chantierContacts || [];
        if (!db.chantierContacts.some((l) => l.userId === userId && l.contactId === contact.id && l.projectId === besoin.project_id)) db.chantierContacts.unshift({ id: `cc-${Date.now()}`, userId, contactId: contact.id, projectId: besoin.project_id, roleOnSite: besoin.lot_label || besoin.metier || "sous-traitant", addedAt: now });
      }
      await writeDb(db);
      await notify(echange.user_a === userId ? echange.user_b : echange.user_a, {
        title: "Vous êtes retenu",
        message: `${me.companyName} vous retient pour : ${besoin.title}`,
        echangeId: echange.id
      });
      return ok({ echange: await echangeWithMessages(supabase, updatedEchange, userId), besoin: besoinView(updatedBesoin, userId, me.zone, 0, ""), contactId: contact.id });
    }
  } catch (error) {
    return fail(error);
  }

  return badRequest("Action inconnue.");
}
