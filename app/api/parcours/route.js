import { badRequest, ok } from "../../../lib/http";
import { readDb, writeDb } from "../../../lib/db";
import { resolveEntreprise, loadEntrepriseProfile } from "../../../lib/entreprise-auth";
import { chargerChantiers } from "../../../lib/depenses-serveur";
import { fetchUserOuvrages } from "../../../lib/koji-ouvrages";
import { etapesFaites, idCredit, parcours } from "../../../lib/premier-mois";

// Mon parcours · Premier mois (maquette PRO-26, version 1) : les huit
// étapes constatées sur les données du compte ; une étape faite pendant le
// mois crédite ses jetons du Radar une seule fois (db.jetonsAchats, achat à
// 0 € marqué « offert »), avec une notification.
export async function GET(request) {
  const entreprise = await resolveEntreprise(request);
  if (!entreprise) return badRequest("Connexion requise.", 401);
  const userId = entreprise.userId;
  const [db, webUser, ouvragesKoji] = await Promise.all([readDb(), loadEntrepriseProfile(entreprise), fetchUserOuvrages(userId)]);
  let quotes = [];
  try { ({ quotes } = await chargerChantiers(entreprise, { archives: true })); } catch { /* devis indisponibles */ }
  const mes = (liste) => (liste || []).filter((x) => x.userId === userId);
  // Ouvrages de l'entreprise : ceux du site (prix par temps × taux) et ceux
  // de l'app (table koji_ouvrages, propres au compte).
  const ouvragesWeb = mes(db.ouvrages);
  const faits = etapesFaites({
    business: webUser.business || {},
    ouvrages: ouvragesWeb.length + ouvragesKoji.length,
    quotes,
    workers: mes(db.workers),
    photos: mes(db.chantierPhotos),
    invoices: mes(db.invoices),
    clotures: mes(db.clotures)
  });
  const credits = (db.jetonsAchats || []).filter((a) => a.userId === userId && a.offert === "premier-mois");
  const p = parcours({ faits, credits, inscritLe: webUser.createdAt });

  if (p.aCrediter.length) {
    // Relecture juste avant l'écriture ; un crédit déjà posé n'est jamais doublé.
    const frais = await readDb();
    frais.jetonsAchats = frais.jetonsAchats || [];
    frais.notifications = frais.notifications || [];
    const maintenant = new Date().toISOString();
    const nouveaux = p.aCrediter.filter((e) => !frais.jetonsAchats.some((a) => a.id === idCredit(userId, e.id)));
    for (const e of nouveaux) {
      frais.jetonsAchats.push({ id: idCredit(userId, e.id), userId, quantite: e.jetons, montantTtc: 0, offert: "premier-mois", etape: e.id, le: maintenant });
    }
    if (nouveaux.length) {
      const n = nouveaux.reduce((s, e) => s + e.jetons, 0);
      frais.notifications.unshift({
        id: `notif-premier-mois-${userId}-${nouveaux.map((e) => e.id).join("-")}`,
        userId,
        type: "radar.jetons",
        title: `${n} jeton${n > 1 ? "s" : ""} offert${n > 1 ? "s" : ""} · Premier mois`,
        message: `Étape${nouveaux.length > 1 ? "s" : ""} faite${nouveaux.length > 1 ? "s" : ""} : ${nouveaux.map((e) => e.titre.toLowerCase()).join(", ")}. Les jetons sont disponibles sur le Radar.`,
        actionUrl: "/parcours",
        actionLabel: "Voir mon parcours",
        read: false,
        createdAt: maintenant
      });
      await writeDb(frais);
    }
  }

  const { aCrediter, ...etat } = p;
  return ok({ ...etat, nouveauxJetons: aCrediter.reduce((s, e) => s + e.jetons, 0) });
}
