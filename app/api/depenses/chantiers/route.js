import { badRequest, ok } from "../../../../lib/http";
import { readDb, writeDb } from "../../../../lib/db";
import { resolveEntreprise } from "../../../../lib/entreprise-auth";
import { clotureDe } from "../../../../lib/cloture-db";
import { coutChantier, historiqueChantier } from "../../../../lib/depenses";
import { chargerChantiers, contexteEntreprise, piecesDe, rangerCommandes } from "../../../../lib/depenses-serveur";
import { chargerCatalogue } from "../../../../lib/fournitures-serveur";

// Coût des chantiers (maquettes PRO-09.1 et 09.2) : dépensé (pièces
// rangées + heures pointées) face au prévu du devis, par lot ; marge
// prévue et marge finale estimée. GET → une carte par chantier ;
// GET ?projet= → le détail d'un chantier (lots, pièces, historique).
function donneesChantier(db, userId, c, articles, coutHoraire, pieces) {
  const quote = c.quote;
  const avenants = quote ? (db.avenants || []).filter((a) => a.userId === userId && a.quoteId === quote.id) : [];
  const taches = (db.tasks || []).filter((t) => t.userId === userId && t.projectId === c.projectId);
  const pointages = (db.attendanceEntries || []).filter((e) => e.userId === userId && e.projectId === c.projectId);
  const workers = (db.workers || []).filter((w) => w.userId === userId);
  const cloture = clotureDe(db, c.projectId, userId);
  const piecesChantier = pieces.filter((p) => p.projectId === c.projectId);
  const cout = coutChantier({ quote, avenants, articles, pieces: piecesChantier, pointages, workers, taches, coutHoraire, cloture: Boolean(cloture?.pv?.signeLe) });
  return { quote, avenants, pointages, workers, piecesChantier, cout };
}

export async function GET(request) {
  const entreprise = await resolveEntreprise(request);
  if (!entreprise) return badRequest("Connexion requise.", 401);
  const userId = entreprise.userId;
  const projet = new URL(request.url).searchParams.get("projet") || "";
  const db = await readDb();
  if (rangerCommandes(db, userId)) await writeDb(db);
  const [{ coutHoraire }, catalogue] = await Promise.all([contexteEntreprise(entreprise), chargerCatalogue(entreprise, db)]);
  let chantiers;
  try { ({ chantiers } = await chargerChantiers(entreprise, { projectId: projet })); } catch (e) { return badRequest(e.message, 502); }
  const articles = catalogue.articles || [];
  const pieces = piecesDe(db, userId);

  if (projet) {
    const c = chantiers[0];
    if (!c) return badRequest("Chantier introuvable.", 404);
    const d = donneesChantier(db, userId, c, articles, coutHoraire, pieces);
    const invoices = (db.invoices || []).filter((i) => i.userId === userId && !i.archived && i.kind !== "avoir" && (i.projectId === c.projectId || (d.quote && i.quoteId === d.quote.id)));
    const doublons = d.piecesChantier.filter((p) => p.doublonDe);
    return ok({
      chantier: { projectId: c.projectId, title: c.title, address: c.address, quote: d.quote ? { id: d.quote.id, numero: d.quote.quoteNumber || "", signe: d.quote.status === "Signe" || d.quote.signatureStatus === "Signe", client: d.quote.client || "" } : null },
      // Devis complet si signé : l'app ouvre l'avenant avec (PRO-05).
      devis: d.quote && (d.quote.status === "Signe" || d.quote.signatureStatus === "Signe") ? d.quote : null,
      cout: d.cout,
      coutHoraire,
      pieces: d.piecesChantier.sort((a, b) => String(b.date).localeCompare(String(a.date))).map((p) => ({ ...p, fichier: p.fichier ? { type: p.fichier.type } : null })),
      doublons: doublons.map((p) => p.id),
      historique: historiqueChantier({ pieces: d.piecesChantier, pointages: d.pointages, workers: d.workers, coutHoraire, invoices })
    });
  }

  const cartes = chantiers
    .filter((c) => c.quote || pieces.some((p) => p.projectId === c.projectId))
    .map((c) => {
      const d = donneesChantier(db, userId, c, articles, coutHoraire, pieces);
      return { projectId: c.projectId, title: c.title, client: c.quote?.client || "", ...d.cout, lots: undefined, nbLots: d.cout.lots.length };
    })
    .sort((a, b) => (a.etat === "regarder" ? 0 : 1) - (b.etat === "regarder" ? 0 : 1) || b.depense - a.depense);
  return ok({ chantiers: cartes, coutHoraire });
}
