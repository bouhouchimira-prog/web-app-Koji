import { POST as createCalendarEvent, PATCH as updateCalendarEvent } from "../app/api/calendar-events/route";
import { POST as createIntervention, PATCH as updateIntervention } from "../app/api/interventions/route";
import { POST as createExpense, PATCH as updateExpense } from "../app/api/expenses/route";
import { POST as createInvoice, PATCH as updateInvoice } from "../app/api/invoices/route";
import { POST as createSupply, PATCH as updateSupply } from "../app/api/supplies/route";
import { POST as createAlert } from "../app/api/urgent-alerts/route";
import { POST as createDevis } from "../app/api/devis-ia/route";
import { PATCH as updateQuote } from "../app/api/quotes/route";
import { POST as createTask, PATCH as updateTask } from "../app/api/tasks/route";
import { POST as createWorker, PATCH as updateWorker } from "../app/api/workers/route";
import { POST as createContact, PATCH as updateContact } from "../app/api/contacts/route";
import { POST as createProject, PATCH as updateProject, mapChantier } from "../app/api/projects/route";
import { POST as createSupplier, PATCH as updateSupplier } from "../app/api/suppliers/route";
import { POST as createOuvrage, PATCH as updateOuvrage } from "../app/api/ouvrages/route";
import { mapQuote } from "./quote-mapping";
import { contactDisplayName } from "./contacts";
import { mergedOuvrages } from "./ouvrages";
import { scopedItems } from "./db";
import { buildWebUser } from "./user-profile";

// Registre des 13 outils que l'assistant koji peut declencher (15 septembre).
// Chaque entree reutilise directement la fonction POST existante de sa route
// (import ci-dessus) — jamais de logique de creation dupliquee ici. Ajouter
// un futur outil = une entree de plus dans TOOLS, pas une reecriture de
// app/api/koji-assistant/route.js.

export const ALERT_TYPE_LABELS = { degat: "Dégât", fuite: "Fuite", urgence: "Urgence", incendie: "Incendie", autre: "Alerte" };

// Pages que l'assistant peut ouvrir directement ("ouvre le calendrier", "va
// sur les devis"...) — reprend exactement les memes routes que le menu de
// navigation principal (components/Shell.jsx, getNavItems), plus quelques
// pages accessibles autrement (profil, parametres, chiffre d'affaires,
// notifications) — aucune nouvelle route, juste un lien direct.
export const PAGES = {
  accueil: { label: "Tableau de bord", path: "/" },
  calendrier: { label: "Calendrier", path: "/calendrier" },
  chantiers: { label: "Chantiers", path: "/chantiers" },
  devis: { label: "Devis", path: "/devis" },
  facturation: { label: "Facturation", path: "/facturation" },
  fournitures: { label: "Fournitures", path: "/fournitures" },
  equipe: { label: "Équipe", path: "/equipe" },
  contacts: { label: "Contacts", path: "/contacts" },
  ouvrages: { label: "Bibliothèque d'ouvrages", path: "/bibliotheque-ouvrages" },
  archives: { label: "Archives", path: "/archives" },
  marketplace: { label: "Marketplace", path: "/marketplace" },
  chiffreAffaires: { label: "Chiffre d'affaires", path: "/chiffre-affaires" },
  notifications: { label: "Notifications", path: "/notifications" },
  profil: { label: "Profil", path: "/profil" },
  parametres: { label: "Paramètres", path: "/parametres" }
};

// Suggestions proposees quand le message est un mot-cle seul et ambigu (ex:
// "devis") — reutilise le mecanisme outcome:"clarify" + quickReplies deja en
// place, juste avec un texte adapte au sujet plutot que la liste generique
// "je n'ai pas ce service".
export const TOPIC_SUGGESTIONS = {
  rdv: ["Ajouter un RDV", "Modifier un RDV", "Supprimer un RDV"],
  visite: ["Ajouter un rapport de visite", "Modifier une visite"],
  depense: ["Ajouter une dépense", "Modifier une dépense"],
  facture: ["Créer une facture depuis un devis", "Modifier une facture"],
  fourniture: ["Ajouter une fourniture", "Modifier une fourniture"],
  alerte: ["Ajouter une alerte"],
  devis: ["Créer un devis", "Modifier un devis", "Créer une facture depuis un devis"],
  tache: ["Ajouter une tâche", "Modifier une tâche"],
  equipe: ["Ajouter un membre d'équipe", "Modifier un membre d'équipe"],
  contact: ["Ajouter un contact", "Modifier un contact"],
  chantier: ["Créer un chantier", "Modifier un chantier"],
  fournisseur: ["Ajouter un fournisseur", "Modifier un fournisseur"],
  ouvrage: ["Ajouter un ouvrage", "Modifier un ouvrage"]
};

export function euro(value) {
  return `${Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`;
}

export function formatDateTime(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return date.toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function autoOuvrageCode(label) {
  const slug = String(label || "ouvrage")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 24);
  return `${slug || "ouvrage"}-${Date.now().toString(36)}`;
}

// Chaque candidat porte { id, label, searchText, date?, summary } — searchText
// sert a la Phase 2 (resolution deterministe par sous-chaine, voir
// resolveByHint), summary alimente directement la carte de confirmation de
// suppression sans re-fetch.

async function fetchProjects(ctx) {
  const { data } = await ctx.auth.supabase
    .from("chantiers").select("*, chantier_budgets(*)")
    .order("created_at", { ascending: false }).limit(60);
  return (data || [])
    .map(mapChantier)
    .filter((p) => p.status !== "Archive")
    .map((p) => ({
      id: p.id,
      label: p.title,
      searchText: [p.title, p.address, p.client].filter(Boolean).join(" ").toLowerCase(),
      summary: { Chantier: p.title, Adresse: p.address || "—", Client: p.client || "—" }
    }));
}

async function fetchQuotes(ctx, { signedOnly = false } = {}) {
  const { data } = await ctx.auth.supabase
    .from("quotes").select("*").eq("user_id", ctx.auth.userId)
    .order("created_at", { ascending: false }).limit(60);
  let quotes = (data || []).map(mapQuote);
  if (signedOnly) quotes = quotes.filter((q) => q.status === "Signe" || q.signatureStatus === "Signe");
  return quotes.map((q) => ({
    id: q.id,
    label: `${q.client} — ${q.quoteNumber}`,
    searchText: [q.client, q.quoteNumber].filter(Boolean).join(" ").toLowerCase(),
    summary: { Client: q.client, Devis: q.quoteNumber, Montant: euro(q.totalTtc) }
  }));
}

async function fetchSuppliers(ctx) {
  const { data } = await ctx.auth.supabase.from("fournisseurs").select("id,name").order("name", { ascending: true });
  return (data || []).map((s) => ({
    id: s.id, label: s.name || "Fournisseur",
    searchText: String(s.name || "").toLowerCase(),
    summary: { Fournisseur: s.name || "—" }
  }));
}

async function fetchSupplies(ctx) {
  const { data } = await ctx.auth.supabase
    .from("fournitures").select("id,name,category").order("created_at", { ascending: false }).limit(60);
  return (data || []).map((s) => ({
    id: s.id, label: s.name || "Fourniture",
    searchText: [s.name, s.category].filter(Boolean).join(" ").toLowerCase(),
    summary: { Article: s.name || "—", Catégorie: s.category || "—" }
  }));
}

export function fetchWorkers(ctx) {
  return scopedItems(ctx.db.workers, ctx.auth.userId).map((w) => ({
    id: w.id, label: w.name,
    searchText: [w.name, w.profession, w.phone].filter(Boolean).join(" ").toLowerCase(),
    summary: { Nom: w.name, Métier: w.profession || "—", Téléphone: w.phone || "—" }
  }));
}

function fetchContacts(ctx) {
  return scopedItems(ctx.db.contacts, ctx.auth.userId).filter((c) => !c.archived).map((c) => {
    const name = contactDisplayName(c);
    return {
      id: c.id, label: name || "Contact",
      searchText: [name, c.phone, c.email].filter(Boolean).join(" ").toLowerCase(),
      summary: { Nom: name || "—", Téléphone: c.phone || "—", Email: c.email || "—" }
    };
  });
}

function fetchTasks(ctx) {
  return scopedItems(ctx.db.tasks, ctx.auth.userId).slice(0, 60).map((t) => ({
    id: t.id, label: t.label, date: t.dueDate,
    searchText: [t.label, t.project].filter(Boolean).join(" ").toLowerCase(),
    summary: { Tâche: t.label, Chantier: t.project || "—", Échéance: t.dueDate || "—" }
  }));
}

function fetchInterventions(ctx) {
  return scopedItems(ctx.db.interventions, ctx.auth.userId).slice(0, 60).map((i) => ({
    id: i.id, label: `${i.client} — ${i.site || ""}`.trim(), date: i.date,
    searchText: [i.client, i.site].filter(Boolean).join(" ").toLowerCase(),
    summary: { Client: i.client, Site: i.site || "—", Constat: (i.constat || "").slice(0, 140) || "—" }
  }));
}

function fetchExpenses(ctx) {
  return scopedItems(ctx.db.expenses, ctx.auth.userId).slice(0, 60).map((e) => ({
    id: e.id, label: `${e.label} — ${euro(e.amount)}`, date: e.createdDate,
    searchText: [e.label, e.category, e.projectTitle].filter(Boolean).join(" ").toLowerCase(),
    summary: { Chantier: e.projectTitle || "—", Montant: euro(e.amount), Libellé: e.label }
  }));
}

function fetchInvoices(ctx) {
  return scopedItems(ctx.db.invoices, ctx.auth.userId).slice(0, 60).map((i) => ({
    id: i.id, label: `${i.client} — ${i.invoiceNumber}`,
    searchText: [i.client, i.invoiceNumber, i.type].filter(Boolean).join(" ").toLowerCase(),
    summary: { Client: i.client, Facture: i.invoiceNumber, Montant: euro(i.amountTtc) }
  }));
}

async function fetchCalendarEvents(ctx) {
  const { data } = await ctx.auth.supabase
    .from("calendar_events").select("*").order("start_at", { ascending: false }).limit(60);
  return (data || []).map((row) => ({
    id: row.id,
    label: `${row.title || "RDV"} — ${row.client_name || ""}`.trim(),
    date: row.start_at,
    searchText: [row.title, row.client_name, row.address].filter(Boolean).join(" ").toLowerCase(),
    summary: { Client: row.client_name || "—", Date: formatDateTime(row.start_at), Lieu: row.address || "—" }
  }));
}

function fetchAlerts(ctx) {
  return scopedItems(ctx.db.urgentAlerts, ctx.auth.userId).filter((a) => a.status !== "resolved").map((a) => ({
    id: a.id, label: `${a.projectTitle || ""} — ${a.message || ""}`.slice(0, 60),
    searchText: [a.projectTitle, a.message, a.type].filter(Boolean).join(" ").toLowerCase(),
    summary: { Chantier: a.projectTitle || "—", Type: ALERT_TYPE_LABELS[a.type] || "Alerte", Message: (a.message || "").slice(0, 140) }
  }));
}

function fetchOuvrages(ctx) {
  return mergedOuvrages(ctx.db).map((o) => ({
    id: o.id, label: `${o.code} — ${o.label}`,
    searchText: [o.code, o.label, o.family].filter(Boolean).join(" ").toLowerCase(),
    summary: { Ouvrage: o.label, Code: o.code, Unité: o.unit }
  }));
}

// Phase 2 : resolution deterministe par sous-chaine (pas d'appel IA) — voir
// section "architecture" du plan. 1 correspondance -> utilisee directement ;
// 0 ou plusieurs -> a clarifier (les candidats deviennent les quickReplies).
export function resolveByHint(candidates, hint) {
  const needle = String(hint || "").trim().toLowerCase();
  if (!needle) {
    if (candidates.length === 1) return { match: candidates[0] };
    return { matches: candidates.slice(0, 6) };
  }
  const matches = candidates.filter((c) => c.searchText.includes(needle));
  if (matches.length === 1) return { match: matches[0] };
  if (matches.length > 1) return { matches: matches.slice(0, 6) };
  return { matches: candidates.slice(0, 6) };
}

// Construit un mapper de mise a jour generique : filtre "changes" sur la
// whitelist de champs autorises pour ce type (memes noms que les routes
// PATCH acceptent deja), coerce en nombre les champs numeriques. Reutilise
// par la quasi-totalite des outils — seul le devis a besoin d'un mapper
// dedie (voir mapDevisUpdateBody) pour l'ajout de ligne.
function simpleUpdateMapper(fields, numericFields = []) {
  return async (ctx, id, changes) => {
    const body = { id };
    for (const key of fields) {
      if (Object.prototype.hasOwnProperty.call(changes, key)) {
        body[key] = numericFields.includes(key) ? Number(changes[key]) || 0 : changes[key];
      }
    }
    return body;
  };
}

// Taux horaire par defaut de l'entreprise (app/profil/page.jsx) — meme
// formule que lib/koji-assistant-devis-flow.js, reutilisee ici pour chiffrer
// une ligne ajoutee a un devis existant quand l'ouvrage du catalogue n'a pas
// son propre taux. Jamais invente : soit le taux de l'ouvrage, soit celui
// deja configure par l'entreprise elle-meme.
async function defaultHourlyRate(ctx) {
  const { data: profile } = await ctx.auth.supabase.from("users").select("*").eq("id", ctx.auth.userId).maybeSingle();
  const webUser = buildWebUser({ id: ctx.auth.userId, email: profile?.email || "", profile });
  const business = webUser.business || {};
  const dailyRate = Number(business.dailyRate || 0);
  const hoursPerDay = Number(business.hoursPerDay || 0);
  return hoursPerDay > 0 ? dailyRate / hoursPerDay : 0;
}

// Correspondance catalogue pour une designation libre ("pose de carrelage",
// "robinet"...) — jamais de prix invente : ouvrage trouve dans la
// bibliotheque de prix (avec son taux, sinon le taux par defaut de
// l'entreprise), ou item "a chiffrer manuellement" a 0€ si rien ne
// correspond. Utilisee a la fois par mapDevisUpdateBody (devis existant
// nomme) et par l'action "devisPageAction" (devis actuellement ouvert dans
// le navigateur, voir app/api/koji-assistant/route.js).
export async function resolveOuvrageForLabel(ctx, label, { unit } = {}) {
  const catalog = mergedOuvrages(ctx.db);
  const needle = String(label || "").toLowerCase();
  const ouvrage = catalog.find((o) => (o.label || "").toLowerCase().includes(needle) || (o.category || "").toLowerCase().includes(needle));
  if (ouvrage) {
    const hourlyRate = Number(ouvrage.hourlyRate || 0) || await defaultHourlyRate(ctx);
    return {
      matched: true,
      id: ouvrage.id,
      label: ouvrage.label,
      unit: ouvrage.unit || unit || "u",
      normativeTime: Number(ouvrage.normativeTime || 0),
      hourlyRate
    };
  }
  return {
    matched: false,
    id: `koji-item-${Date.now()}`,
    label: `À chiffrer manuellement — ${label}`,
    unit: unit || "u",
    normativeTime: 0,
    hourlyRate: 0
  };
}

// Meme principe pour une fourniture ("carrelage 60x60") — recherche
// directe dans la table fournitures (pas de catalogue statique partage
// comme pour les ouvrages), renvoie null si rien ne correspond (jamais de
// fourniture inventee).
export async function resolveSupplyForLabel(ctx, label) {
  const needle = String(label || "").toLowerCase();
  const { data } = await ctx.auth.supabase
    .from("fournitures")
    .select("id,name,category,unite,prix_vente_ht,prix_achat_ht,fournisseur_id")
    .order("created_at", { ascending: false })
    .limit(200);
  const match = (data || []).find((row) => (row.name || "").toLowerCase().includes(needle) || (row.category || "").toLowerCase().includes(needle));
  if (!match) return null;
  const salePriceHt = Number(match.prix_vente_ht || 0);
  return {
    id: match.id,
    name: match.name || "Fourniture",
    category: match.category || "",
    unit: match.unite || "u",
    purchasePriceHt: Number(match.prix_achat_ht || 0),
    salePriceHt,
    priceHt: salePriceHt,
    supplierId: match.fournisseur_id || ""
  };
}

// Mise a jour d'un devis existant : statut/notes en champs simples, et
// surtout l'ajout d'une ligne ("ajoute une ligne carrelage 20m² au devis de
// Dupont") — relit le devis complet (la liste de candidats n'a qu'un
// resume), cherche une correspondance dans la bibliotheque de prix via
// resolveOuvrageForLabel ci-dessus, l'ajoute au tableau items existant. La
// route PATCH /api/quotes recalcule elle-meme les totaux.
async function mapDevisUpdateBody(ctx, id, changes) {
  const { data } = await ctx.auth.supabase.from("quotes").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const quote = mapQuote(data);
  const body = { id };
  if (changes.status) body.status = changes.status;
  if (changes.notes) {
    const note = { id: `koji-note-${Date.now()}`, room: (quote.rooms || [])[0] || "Général", type: "message", message: String(changes.notes) };
    body.notes = [...(quote.notes || []), note];
  }
  if (changes.lineLabel) {
    const room = changes.room || (quote.rooms || [])[0] || "Général";
    const quantity = Math.max(0, Number(changes.quantity) || 1);
    const resolved = await resolveOuvrageForLabel(ctx, changes.lineLabel, { unit: changes.unit });
    const item = resolved.matched
      ? { id: resolved.id, label: resolved.label, room, quantity, unit: resolved.unit, billingMode: "time", normativeTime: resolved.normativeTime, hourlyRate: resolved.hourlyRate, origin: "demande" }
      : { id: resolved.id, label: resolved.label, room, quantity, unit: resolved.unit, billingMode: "fixed", fixedAmountHt: 0, origin: "demande" };
    body.items = [...(quote.items || []), item];
    body.rooms = (quote.rooms || []).includes(room) ? quote.rooms : [...(quote.rooms || []), room];
  }
  return body;
}

export const TOOLS = {
  rdv: {
    label: "RDV",
    createPath: "/api/calendar-events",
    createHandler: createCalendarEvent,
    mapCreateBody: (f) => ({ title: f.title || "", eventType: f.eventType || "Chantier", clientName: f.clientName || "", address: f.address || "", startAt: f.startAt, endAt: f.endAt || f.startAt, notes: f.notes || "" }),
    requiredCheck: (f) => (f.startAt ? null : "date/heure manquante"),
    summary: (c) => ({ Client: c.clientName || "—", Date: formatDateTime(c.startAt), Lieu: c.address || "—" }),
    correctUrl: () => "/calendrier",
    deleteRoute: "/api/calendar-events",
    deleteMethod: "patch-action",
    ownCandidates: fetchCalendarEvents,
    updateHandler: updateCalendarEvent,
    updateRoute: "/api/calendar-events",
    mapUpdateBody: simpleUpdateMapper(["title", "eventType", "clientName", "address", "startAt", "endAt", "status", "notes"])
  },
  visite: {
    label: "Visite",
    createPath: "/api/interventions",
    createHandler: createIntervention,
    mapCreateBody: (f) => ({ client: f.client, site: f.site || "", date: f.date || "", constat: f.constat || "", analyse: f.analyse || "", preconisations: f.preconisations || "", projectId: f.projectId || "" }),
    requiredCheck: (f) => (String(f.client || "").trim() ? null : "client manquant"),
    summary: (c) => ({ Client: c.client, Site: c.site || "—", Constat: (c.constat || "").slice(0, 140) || "—" }),
    correctUrl: () => "/interventions",
    reference: { hintField: "chantierHint", resolvedField: "projectId", fetchCandidates: fetchProjects, required: false },
    deleteRoute: "/api/interventions",
    deleteMethod: "patch-action",
    ownCandidates: fetchInterventions,
    updateHandler: updateIntervention,
    updateRoute: "/api/interventions",
    mapUpdateBody: simpleUpdateMapper(["client", "site", "date", "constat", "analyse", "preconisations", "status"])
  },
  depense: {
    label: "Dépense",
    createPath: "/api/expenses",
    createHandler: createExpense,
    mapCreateBody: (f) => ({ projectId: f.projectId, amount: Number(f.amount || 0), label: f.label || "", category: f.category || "", notes: f.notes || "" }),
    requiredCheck: (f) => {
      if (!(Number(f.amount) > 0)) return "montant manquant";
      if (!f.projectId) return "chantier introuvable";
      return null;
    },
    summary: (c) => ({ Chantier: c.projectTitle || "—", Montant: euro(c.amount), Libellé: c.label }),
    correctUrl: () => "/chantiers",
    reference: { hintField: "chantierHint", resolvedField: "projectId", fetchCandidates: fetchProjects, required: true },
    deleteRoute: "/api/expenses",
    deleteMethod: "patch-action",
    ownCandidates: fetchExpenses,
    updateHandler: updateExpense,
    updateRoute: "/api/expenses",
    mapUpdateBody: simpleUpdateMapper(["label", "category", "amount", "notes"], ["amount"])
  },
  facture: {
    label: "Facture",
    createPath: "/api/invoices",
    createHandler: createInvoice,
    mapCreateBody: (f) => ({ transformQuote: true, quoteId: f.quoteId }),
    requiredCheck: (f) => (f.quoteId ? null : "devis introuvable"),
    summary: (c) => ({ Client: c.client, Devis: c.quoteNumber, Montant: euro(c.amountTtc) }),
    correctUrl: (c) => `/facturation?quoteId=${c.quoteId}`,
    reference: { hintField: "quoteHint", resolvedField: "quoteId", fetchCandidates: (ctx) => fetchQuotes(ctx, { signedOnly: true }), required: true },
    deleteRoute: "/api/invoices",
    deleteMethod: "patch-action",
    ownCandidates: fetchInvoices,
    updateHandler: updateInvoice,
    updateRoute: "/api/invoices",
    mapUpdateBody: simpleUpdateMapper(["type", "dueDate", "notes", "status"])
  },
  fourniture: {
    label: "Fourniture",
    createPath: "/api/supplies",
    createHandler: createSupply,
    mapCreateBody: (f) => ({ name: f.name, category: f.category || "", purchasePriceHt: Number(f.purchasePriceHt || 0), salePriceHt: Number(f.salePriceHt || 0), quantity: Number(f.quantity || 0), unit: f.unit || "", supplierId: f.supplierId || "" }),
    requiredCheck: (f) => (String(f.name || "").trim() ? null : "nom de l'article manquant"),
    summary: (c) => ({ Article: c.name, Prix: euro(c.salePriceHt), Fournisseur: c.supplierName || "—" }),
    correctUrl: () => "/fournitures",
    reference: { hintField: "supplierHint", resolvedField: "supplierId", fetchCandidates: fetchSuppliers, required: false },
    deleteRoute: "/api/supplies",
    deleteMethod: "patch-action",
    ownCandidates: fetchSupplies,
    updateHandler: updateSupply,
    updateRoute: "/api/supplies",
    mapUpdateBody: simpleUpdateMapper(["name", "category", "purchasePriceHt", "salePriceHt", "quantity", "unit"], ["purchasePriceHt", "salePriceHt", "quantity"])
  },
  alerte: {
    label: "Alerte",
    createPath: "/api/urgent-alerts",
    createHandler: createAlert,
    mapCreateBody: (f) => ({ message: f.message, type: f.type || "urgence", projectId: f.projectId || "", senderName: f.senderName || "Assistant koji" }),
    requiredCheck: (f) => (f.projectId ? null : "chantier introuvable"),
    summary: (c) => ({ Chantier: c.projectTitle || "—", Type: ALERT_TYPE_LABELS[c.type] || "Alerte", Message: (c.message || "").slice(0, 140) }),
    correctUrl: () => null,
    reference: { hintField: "chantierHint", resolvedField: "projectId", fetchCandidates: fetchProjects, required: true },
    deleteRoute: "/api/urgent-alerts",
    deleteMethod: "patch-resolve",
    ownCandidates: fetchAlerts
  },
  devis: {
    label: "Devis",
    createPath: "/api/devis-ia",
    createHandler: createDevis,
    mapCreateBody: (f) => ({ clientName: f.clientName, description: f.description, metier: f.metier || "", address: f.address || "", surface: f.surface || "", finition: f.finition || "", photos: Array.isArray(f.photos) ? f.photos : [] }),
    requiredCheck: (f) => (String(f.clientName || "").trim() && String(f.description || "").trim() ? null : "client ou description manquant"),
    summary: (c) => ({ Client: c.client, Chantier: c.project || "—", Montant: euro(c.totalTtc) }),
    correctUrl: (c) => `/devis?id=${c.id}`,
    deleteRoute: "/api/quotes",
    deleteMethod: "patch-action",
    ownCandidates: (ctx) => fetchQuotes(ctx, { signedOnly: false }),
    updateHandler: updateQuote,
    updateRoute: "/api/quotes",
    mapUpdateBody: mapDevisUpdateBody
  },
  tache: {
    label: "Tâche",
    createPath: "/api/tasks",
    createHandler: createTask,
    mapCreateBody: (f) => ({ label: f.label, projectId: f.projectId || "", project: f.project || "", dueDate: f.dueDate || "", startDate: f.startDate || "", assignedTo: f.assignedTo || "" }),
    requiredCheck: (f) => (String(f.label || "").trim() ? null : "libellé manquant"),
    summary: (c) => ({ Tâche: c.label, Chantier: c.project || "—", Échéance: c.dueDate || "—" }),
    correctUrl: () => "/chantiers",
    reference: { hintField: "chantierHint", resolvedField: "projectId", fetchCandidates: fetchProjects, required: false },
    deleteRoute: "/api/tasks",
    deleteMethod: "patch-action",
    ownCandidates: fetchTasks,
    updateHandler: updateTask,
    updateRoute: "/api/tasks",
    mapUpdateBody: simpleUpdateMapper(["label", "dueDate", "startDate", "status", "assignedTo"])
  },
  equipe: {
    label: "Équipe",
    createPath: "/api/workers",
    createHandler: createWorker,
    mapCreateBody: (f) => ({ name: f.name, profession: f.profession || "", phone: f.phone || "", email: f.email || "", hourlyRate: Number(f.hourlyRate || 0) }),
    requiredCheck: (f) => (String(f.name || "").trim() ? null : "nom manquant"),
    summary: (c) => ({ Nom: c.name, Métier: c.profession || "—", Taux: c.hourlyRate ? `${euro(c.hourlyRate)}/h` : "—" }),
    correctUrl: () => "/equipe",
    deleteRoute: "/api/workers",
    deleteMethod: "patch-action",
    ownCandidates: fetchWorkers,
    updateHandler: updateWorker,
    updateRoute: "/api/workers",
    mapUpdateBody: simpleUpdateMapper(["name", "profession", "phone", "email", "hourlyRate", "status"], ["hourlyRate"])
  },
  contact: {
    label: "Contact",
    createPath: "/api/contacts",
    createHandler: createContact,
    mapCreateBody: (f) => ({ type: f.type || "particulier", firstName: f.firstName || "", lastName: f.lastName || "", companyName: f.companyName || "", phone: f.phone || "", email: f.email || "", address: f.address || "" }),
    requiredCheck: (f) => (String(f.firstName || "").trim() || String(f.lastName || "").trim() || String(f.companyName || "").trim() ? null : "nom manquant"),
    summary: (c) => ({ Nom: contactDisplayName(c) || "—", Téléphone: c.phone || "—", Email: c.email || "—" }),
    correctUrl: () => "/contacts",
    deleteRoute: "/api/contacts",
    deleteMethod: "patch-action",
    ownCandidates: fetchContacts,
    updateHandler: updateContact,
    updateRoute: "/api/contacts",
    mapUpdateBody: simpleUpdateMapper(["phone", "email", "address", "notes"])
  },
  chantier: {
    label: "Chantier",
    createPath: "/api/projects",
    createHandler: createProject,
    mapCreateBody: (f) => ({ title: f.title, address: f.address || "", clientEmail: f.clientEmail || "" }),
    requiredCheck: (f) => (String(f.title || "").trim() ? null : "nom du chantier manquant"),
    summary: (c) => ({ Chantier: c.title, Adresse: c.address || "—", Client: c.client || "—" }),
    correctUrl: () => "/chantiers",
    deleteRoute: "/api/projects",
    deleteMethod: "patch-action",
    ownCandidates: fetchProjects,
    updateHandler: updateProject,
    updateRoute: "/api/projects",
    mapUpdateBody: simpleUpdateMapper(["title", "address", "clientEmail", "status"])
  },
  fournisseur: {
    label: "Fournisseur",
    createPath: "/api/suppliers",
    createHandler: createSupplier,
    mapCreateBody: (f) => ({ name: f.name }),
    requiredCheck: (f) => (String(f.name || "").trim() ? null : "nom manquant"),
    summary: (c) => ({ Fournisseur: c.name }),
    correctUrl: () => "/fournitures",
    deleteRoute: "/api/suppliers",
    deleteMethod: "patch-action",
    ownCandidates: fetchSuppliers,
    updateHandler: updateSupplier,
    updateRoute: "/api/suppliers",
    mapUpdateBody: simpleUpdateMapper(["name"])
  },
  ouvrage: {
    label: "Ouvrage",
    createPath: "/api/ouvrages",
    createHandler: createOuvrage,
    mapCreateBody: (f) => ({
      code: f.code || autoOuvrageCode(f.label),
      label: f.label,
      unit: f.unit || "u",
      normativeTime: Number(f.normativeTime || 0),
      hourlyRate: Number(f.hourlyRate || 0),
      family: f.family || "Autre"
    }),
    requiredCheck: (f) => (String(f.label || "").trim() ? null : "désignation manquante"),
    summary: (c) => ({ Ouvrage: c.label, Code: c.code, Unité: c.unit }),
    correctUrl: () => "/bibliotheque-ouvrages",
    deleteRoute: "/api/ouvrages",
    deleteMethod: "query-delete",
    ownCandidates: fetchOuvrages,
    updateHandler: updateOuvrage,
    updateRoute: "/api/ouvrages",
    mapUpdateBody: simpleUpdateMapper(["label", "unit", "normativeTime", "hourlyRate", "family"], ["normativeTime", "hourlyRate"])
  }
};
