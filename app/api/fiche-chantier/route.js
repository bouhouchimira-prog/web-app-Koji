import { NextRequest } from "next/server";
import { badRequest, ok } from "../../../lib/http";
import { avecLectureUnique } from "../../../lib/lecture-partagee";
import { GET as getProjects } from "../projects/route";
import { GET as getQuotes } from "../quotes/route";
import { GET as getTasks } from "../tasks/route";
import { GET as getInvoices } from "../invoices/route";
import { GET as getCalendarEvents } from "../calendar-events/route";
import { GET as getUrgentAlerts } from "../urgent-alerts/route";
import { GET as getProjectDocuments } from "../project-documents/route";
import { GET as getChantierPhotos } from "../chantier-photos/route";
import { GET as getReserves } from "../reserves/route";
import { GET as getClientPortalInfo } from "../client-portal-info/route";

// Fiche d'un chantier en une seule requête (KPRO-47, étape 2, 27 nov. 2026).
//
// L'app lançait dix requêtes pour ouvrir une fiche, et neuf relisaient le
// bloc de données entier (2,1 Mo) : en ligne, 1,5 à 2,7 secondes. Cette
// route appelle les mêmes dix routes, avec la même requête (même session,
// mêmes contrôles d'accès, même logique : rien n'est recopié), à
// l'intérieur d'avecLectureUnique : elles partagent une seule lecture du
// bloc. Une route qui écrit pendant la fiche coupe ce partage, comme partout.
//
// Réponse : ce que la fiche affiche, déjà filtré sur le chantier. Une partie
// en échec donne une liste vide (comme avant dans l'app) ; seul le chantier
// lui-même est obligatoire.
export const dynamic = "force-dynamic";

const PARTIES = [
  ["projects", getProjects, () => "/api/projects"],
  ["quotes", getQuotes, () => "/api/quotes"],
  ["tasks", getTasks, () => "/api/tasks"],
  ["invoices", getInvoices, () => "/api/invoices"],
  ["calendarEvents", getCalendarEvents, (q) => `/api/calendar-events?projectId=${q}`],
  ["alerts", getUrgentAlerts, () => "/api/urgent-alerts"],
  ["projectDocuments", getProjectDocuments, (q) => `/api/project-documents?projectId=${q}`],
  ["photos", getChantierPhotos, (q) => `/api/chantier-photos?projectId=${q}`],
  ["reserves", getReserves, (q) => `/api/reserves?projectId=${q}`],
  ["access", getClientPortalInfo, (q) => `/api/client-portal-info?projectId=${q}`]
];

async function appeler(handler, chemin, request) {
  try {
    // NextRequest : les sessions du site se lisent dans request.cookies.
    const reponse = await handler(new NextRequest(new URL(chemin, request.url), { headers: request.headers }));
    const corps = await reponse.json().catch(() => null);
    return { statut: reponse.status, corps };
  } catch {
    return { statut: 500, corps: null };
  }
}

const duChantier = (projectId) => (item) => String(item?.projectId ?? "") === projectId;

export async function GET(request) {
  const projectId = new URL(request.url).searchParams.get("projectId") || "";
  if (!projectId) return badRequest("projectId requis.");
  const q = encodeURIComponent(projectId);

  const resultats = await avecLectureUnique(() =>
    Promise.all(PARTIES.map(([cle, handler, chemin]) => appeler(handler, chemin(q), request).then((r) => [cle, r])))
  );
  const parties = Object.fromEntries(resultats);

  const projets = parties.projects;
  if (projets.statut < 200 || projets.statut >= 300) {
    return ok(projets.corps || { error: "Chantier introuvable." }, projets.statut);
  }
  const projet = (projets.corps?.projects || []).find((p) => String(p?.id ?? "") === projectId);
  if (!projet) return badRequest("Chantier introuvable.", 404);

  const liste = (cle) => {
    const r = parties[cle];
    if (r.statut < 200 || r.statut >= 300 || !Array.isArray(r.corps?.[cle])) return [];
    return r.corps[cle];
  };
  const filtre = duChantier(projectId);
  const acces = parties.access;

  return ok({
    project: projet,
    quotes: liste("quotes").filter(filtre),
    tasks: liste("tasks").filter(filtre),
    invoices: liste("invoices").filter(filtre),
    calendarEvents: liste("calendarEvents").filter(filtre),
    alerts: liste("alerts").filter(filtre),
    projectDocuments: liste("projectDocuments").filter(filtre),
    photos: liste("photos"),
    reserves: liste("reserves"),
    access: acces.statut >= 200 && acces.statut < 300 ? acces.corps?.access ?? null : null
  });
}
