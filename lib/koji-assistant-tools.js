import { POST as createCalendarEvent } from "../app/api/calendar-events/route";
import { POST as createIntervention } from "../app/api/interventions/route";
import { POST as createExpense } from "../app/api/expenses/route";
import { POST as createInvoice } from "../app/api/invoices/route";
import { POST as createSupply } from "../app/api/supplies/route";
import { POST as createAlert } from "../app/api/urgent-alerts/route";
import { POST as createDevis } from "../app/api/devis-ia/route";
import { POST as createTask } from "../app/api/tasks/route";
import { POST as createWorker } from "../app/api/workers/route";
import { POST as createContact } from "../app/api/contacts/route";
import { POST as createProject, mapChantier } from "../app/api/projects/route";
import { POST as createSupplier } from "../app/api/suppliers/route";
import { POST as createOuvrage } from "../app/api/ouvrages/route";
import { mapQuote } from "./quote-mapping";
import { contactDisplayName } from "./contacts";
import { mergedOuvrages } from "./ouvrages";
import { scopedItems } from "./db";

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
    ownCandidates: fetchCalendarEvents
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
    ownCandidates: fetchInterventions
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
    ownCandidates: fetchExpenses
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
    ownCandidates: fetchInvoices
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
    ownCandidates: fetchSupplies
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
    ownCandidates: (ctx) => fetchQuotes(ctx, { signedOnly: false })
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
    ownCandidates: fetchTasks
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
    ownCandidates: fetchWorkers
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
    ownCandidates: fetchContacts
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
    ownCandidates: fetchProjects
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
    ownCandidates: fetchSuppliers
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
    ownCandidates: fetchOuvrages
  }
};
