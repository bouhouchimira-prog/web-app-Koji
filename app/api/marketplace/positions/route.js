import { badRequest, ok } from "../../../../lib/http";
import { readDb } from "../../../../lib/db";
import { resolveEntreprise } from "../../../../lib/entreprise-auth";
import { contexteRadar } from "../../../../lib/radar-server";
import { creneauLong, indicateurs, PRIX_JETON_HT } from "../../../../lib/radar-jetons";
import { titreCourt, villeSeule } from "../../../../lib/radar-display";
import { maskedCityPostal } from "../../../../lib/offer-privacy";

// Mes positions (maquette PRO-04) : une ligne par position, son état, sa
// dernière étape et ses jetons ; en tête la prochaine visite confirmée.
export async function GET(request) {
  const entreprise = await resolveEntreprise(request);
  if (!entreprise) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const db = await readDb();
  const maintenant = new Date().toISOString();
  const ctx = await contexteRadar(db, entreprise, maintenant);
  const positions = ctx.positions
    .sort((a, b) => (a.termine === b.termine ? String(b.pos.createdAt).localeCompare(String(a.pos.createdAt)) : a.termine ? 1 : -1))
    .map((p) => ({
      offerId: p.pos.offerId,
      titre: titreCourt(p.offre?.description || ""),
      ville: villeSeule(maskedCityPostal(p.offre)),
      etat: p.etat,
      libelle: p.libelle,
      etape: p.etape,
      termine: p.termine,
      rdvDate: p.rdvDate || "",
      jetons: p.jetons,
      creeLe: p.pos.createdAt
    }));
  const prochaine = positions
    .filter((p) => p.etat === "rdv" && p.rdvDate && new Date(p.rdvDate).getTime() > Date.now())
    .sort((a, b) => a.rdvDate.localeCompare(b.rdvDate))[0] || null;
  return ok({
    positions,
    jetons: { ...ctx.solde, prixHt: PRIX_JETON_HT[ctx.palier] },
    indicateurs: indicateurs(ctx.positions, ctx.solde),
    visiteConfirmee: prochaine ? { ...prochaine, quand: creneauLong(prochaine.rdvDate) } : null
  });
}
