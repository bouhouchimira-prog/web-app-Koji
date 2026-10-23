import { ok, badRequest } from "../../../../lib/http";
import { readDb } from "../../../../lib/db";
import { getVerifiedUserId } from "../../../../lib/server-auth";
import { isRdvUnlockedForOffer, clientContactFields } from "../../../../lib/offer-privacy";
import { fixText } from "../../../../lib/text";

// Liste des chantiers Marketplace sur lesquels l'entreprise appelante est
// positionnee ET a un RDV confirme (23 oct, demande d'Amira : pouvoir
// envoyer un devis a un client deja engage via Radar des Chantiers sans
// ressaisir ses coordonnees a la main). Aucune route de ce type n'existait
// avant — app/api/marketplace/offres/[id]/route.js ne liste qu'UNE offre a
// la fois par id. Reutilise exactement la meme regle de confidentialite
// (isRdvUnlockedForOffer/clientContactFields, lib/offer-privacy.js) que
// partout ailleurs dans le Marketplace — jamais reimplementee.
//
// Volontairement : les chantiers SANS RDV confirme ne sont pas renvoyes du
// tout (pas juste masques) — un contact dont on n'a pas les coordonnees
// reelles n'est pas exploitable pour envoyer un devis.
export async function GET(request) {
  const userId = await getVerifiedUserId(request);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const db = await readDb();
  const myOfferIds = (db.chantierPositionnements || [])
    .filter((p) => p.entrepriseUserId === userId && p.status === "Active")
    .map((p) => p.offerId);

  const chantiers = myOfferIds
    .map((offerId) => {
      const offre = (db.chantierOffres || []).find((entry) => entry.id === offerId);
      if (!offre) return null;
      const rdvUnlocked = isRdvUnlockedForOffer(db, offerId, userId);
      if (!rdvUnlocked) return null;
      const { address, clientName, clientEmail, clientPhone } = clientContactFields(offre, true);
      return {
        offerId,
        clientName,
        clientEmail,
        clientPhone,
        address,
        description: fixText(offre.description || "").slice(0, 160)
      };
    })
    .filter(Boolean);

  return ok({ chantiers });
}
