import { clotureOuNouvelle, devisDuChantier } from "./cloture-db.js";
import { sendClientMessageEmail } from "./mailer.js";

// Demande d'avis au client (PRO-02.6) : un e-mail avec le lien vers son
// espace Koji Client, où il note le chantier. Envoyée à l'émission de la
// facture de solde quand l'entreprise l'a programmée, ou à la demande.

const SITE = "https://getkoji.io";

export function avisDuChantier(db, projectId) {
  return (db.avis || []).find((a) => a.projectId === projectId) || null;
}

export async function demanderAvis(db, { projectId, userId }) {
  const devis = await devisDuChantier(projectId);
  if (!devis) return { ok: false, raison: "Pas de devis sur ce chantier." };
  if (avisDuChantier(db, projectId)) return { ok: false, raison: "Le client a déjà donné son avis." };
  if (!(devis.clientPortalUserId || devis.clientPortalAccess?.portalIdentifier)) return { ok: false, raison: "Créez d'abord l'accès Koji Client du client (carte Client de la fiche)." };
  if (!devis.clientEmail) return { ok: false, raison: "Pas d'e-mail client sur le devis." };

  const entreprise = devis.company?.name || "votre artisan";
  const message = [
    `Bonjour${devis.client ? ` ${devis.client}` : ""},`,
    "",
    `Vos travaux avec ${entreprise} sont terminés. Comment cela s'est-il passé ?`,
    "Votre avis aide d'autres particuliers à choisir et l'entreprise à s'améliorer : une note, quatre critères, quelques mots.",
    "",
    `Donner votre avis : ${SITE}/client/chantier/${devis.id}#avis`,
    "",
    "Tous les avis sont publiés, positifs comme négatifs ; l'entreprise peut répondre, pas les supprimer.",
    "",
    entreprise
  ].join("\n");
  const envoi = await sendClientMessageEmail({ to: devis.clientEmail, subject: `Votre avis sur vos travaux · ${entreprise}`, message, replyTo: devis.company?.email || undefined });
  if (!envoi.ok) return { ok: false, raison: `E-mail non envoyé : ${envoi.error}` };

  const cloture = clotureOuNouvelle(db, projectId, userId);
  cloture.avis = { ...(cloture.avis || {}), programme: true, demandeLe: new Date().toISOString(), demandeA: devis.clientEmail };
  return { ok: true, cloture };
}
