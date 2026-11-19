import { randomUUID } from "node:crypto";
import { montant, nomEntreprise, titreChantier, titreOffre } from "./projets-client.js";
import { acompteDevis, changementsVersion, lignePaiement, totauxDevis, NOTE_PAIEMENT } from "./chantier-client.js";
import { regleSignature } from "./signature-devis.js";
import { normalizeEmail, quoteBelongsToClient } from "./portal-acces.js";

// Koji Client · notifications du particulier (maquette CLI-04) : devis à
// signer, nouvelle version, visite confirmée, facture à payer, paiement reçu,
// réserve levée. Chaque notification porte ce que le détail montre (l'objet,
// l'écart de version, le rappel sous le bouton) et le lien de l'action réelle
// dans l'espace Koji Client. Aucun prix calculé par Koji : les montants sont
// ceux du devis ou de la facture de l'entreprise.

const lienChantier = (quoteId, onglet) => `/client/chantier/${encodeURIComponent(quoteId)}?onglet=${onglet}`;
const minuscule = (t) => String(t || "").replace(/^./, (c) => c.toLowerCase());

function numeroVersion(q = {}) {
  const versions = Array.isArray(q.versions) ? q.versions : [];
  const n = Number(versions[versions.length - 1]?.number) || Number.parseInt(q.versionNumber, 10) || 1;
  return n > 0 ? n : 1;
}

// Devis envoyé au particulier : « prêt à signer », ou nouvelle version d'un
// devis déjà envoyé (PRO-03.6).
export function notifDevisEnvoye(q = {}, { nouvelleVersion = false } = {}) {
  const entreprise = nomEntreprise(q);
  const version = numeroVersion(q);
  const total = montant(q.totalTtc);
  const numero = String(q.quoteNumber || "").trim();
  const tva = totauxDevis(q).find((t) => /^TVA/.test(t.libelle))?.libelle.split(" · ")[0] || "";
  const acompte = acompteDevis(q);
  const changements = nouvelleVersion ? changementsVersion(q) : null;
  const [ecartTitre, ecartDetail] = changements ? changements.texte.split(" : ") : ["", ""];
  const signable = Boolean(regleSignature(q));
  const retractation = signable && Boolean(regleSignature(q)?.retractation);
  return {
    type: nouvelleVersion ? "devis.nouvelle_version" : "devis.a_signer",
    title: nouvelleVersion ? `Nouvelle version du devis : version ${version}` : "Votre devis est prêt à signer",
    message: [entreprise, minuscule(titreChantier(q)), `${total} TTC`, version > 1 ? `version ${version}` : ""].filter(Boolean).join(" · "),
    texte: nouvelleVersion
      ? `${entreprise} a mis à jour le devis : version ${version}, ${total} TTC.${version > 1 ? ` Vous pouvez comparer avec la version ${version - 1} avant de signer.` : ""}`
      : `${entreprise} vous a envoyé le devis${numero ? ` ${numero}` : ""} : ${total} TTC.`,
    entrepriseName: entreprise,
    quoteId: q.id || "",
    projectId: q.projectId || "",
    // « Poser une question » : le fil de la demande Radar, s'il existe.
    ...(q.chantierOffreId && q.userId ? { offerId: q.chantierOffreId, entrepriseUserId: q.userId } : {}),
    objet: {
      titre: `Devis${numero ? ` ${numero}` : ""}${version > 1 ? ` · version ${version}` : ""}`,
      detail: [`${total} TTC`, tva, acompte ? `acompte ${acompte.pourcent} à la signature` : ""].filter(Boolean).join(" · ")
    },
    ecart: ecartTitre ? { titre: ecartTitre, detail: ecartDetail.replace(/ TTC,/, ",").replace(/ TTC$/, "").replace(/, /, " · "), lien: lienChantier(q.id, "devis") } : null,
    rappel: retractation ? "Signer en ligne : vous gardez 14 jours pour changer d'avis (formulaire dans Documents)." : "",
    actionUrl: lienChantier(q.id, "devis"),
    actionLabel: signable ? "Lire et signer" : "Voir le devis"
  };
}

// Facture émise par l'entreprise : un paiement à faire.
export function notifFactureEmise(facture = {}, q = {}, { factures = [], aujourdhui } = {}) {
  const ligne = lignePaiement(facture, factures, aujourdhui);
  if (!ligne || ligne.etat !== "a_payer") return null;
  const entreprise = nomEntreprise(q);
  return {
    type: "facture.emise",
    title: `Facture à payer : ${ligne.montant}`,
    message: [entreprise, ligne.titre, ligne.detail].filter(Boolean).join(" · "),
    texte: `${entreprise} vous a envoyé la facture ${String(facture.invoiceNumber || "").trim()}${q.quoteNumber ? ` du devis ${q.quoteNumber}` : ""}.`.replace("facture  du", "facture du"),
    entrepriseName: entreprise,
    quoteId: q.id || "",
    projectId: q.projectId || facture.projectId || "",
    invoiceId: facture.id || "",
    objet: { titre: ligne.titre, detail: [ligne.montant, ligne.detail].join(" · ") },
    ecart: null,
    rappel: NOTE_PAIEMENT,
    actionUrl: lienChantier(q.id, "paiements"),
    actionLabel: "Voir la facture"
  };
}

// Paiement enregistré par l'entreprise (tout ou partie d'une facture).
export function notifPaiementRecu(facture = {}, q = {}, paiement = {}) {
  const entreprise = nomEntreprise(q);
  const acompte = /acompte/i.test(String(facture.type || ""));
  const numero = String(facture.invoiceNumber || "").trim();
  return {
    type: "paiement.recu",
    title: acompte ? "Acompte reçu par l'entreprise" : "Paiement reçu par l'entreprise",
    message: [montant(paiement.amount), numero ? `facture ${numero}` : "", paiement.recuEnvoye ? "reçu envoyé par e-mail" : ""].filter(Boolean).join(" · "),
    texte: `${entreprise} a enregistré votre paiement de ${montant(paiement.amount)}${numero ? ` pour la facture ${numero}` : ""}.`,
    entrepriseName: entreprise,
    quoteId: q.id || "",
    projectId: q.projectId || facture.projectId || "",
    invoiceId: facture.id || "",
    objet: null,
    ecart: null,
    rappel: "",
    actionUrl: lienChantier(q.id, "paiements"),
    actionLabel: "Voir les paiements"
  };
}

const quandVisite = (iso) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }).format(new Date(iso)).replace(/ (\d{1,2}):00$/, " $1 h").replace(/ (\d{1,2}):(\d{2})$/, " $1 h $2");

// Visite confirmée : le particulier a accepté le créneau d'une entreprise.
export function notifVisiteConfirmee(offre = {}, { entrepriseUserId = "", entrepriseName = "", rdvDate = "" } = {}) {
  const valide = rdvDate && Number.isFinite(new Date(rdvDate).getTime());
  const projet = titreOffre(offre);
  return {
    type: "visite.confirmee",
    title: valide ? `Visite confirmée ${quandVisite(rdvDate)}` : "Visite confirmée",
    message: [entrepriseName, projet].filter(Boolean).join(" · "),
    texte: `${entrepriseName || "L'entreprise"} vient visiter votre chantier${valide ? ` ${quandVisite(rdvDate)}` : ""}. Ses coordonnées et les vôtres sont maintenant partagées pour ce rendez-vous.`,
    entrepriseName,
    offerId: offre.id || "",
    entrepriseUserId,
    objet: { titre: "Projet", detail: projet },
    ecart: null,
    rappel: "",
    actionUrl: `/client/messages?fil=${encodeURIComponent(`${offre.id || ""}:${entrepriseUserId}`)}`,
    actionLabel: "Ouvrir la conversation"
  };
}

// Réserve levée par l'entreprise (PRO-02.3).
export function notifReserveLevee(reserve = {}, q = {}) {
  const entreprise = nomEntreprise(q);
  return {
    type: "reserve.levee",
    title: "Réserve levée",
    message: [reserve.numero, reserve.titre, entreprise].filter(Boolean).join(" · "),
    texte: `${entreprise} a levé la réserve ${[reserve.numero, reserve.titre ? `« ${reserve.titre} »` : ""].filter(Boolean).join(" ")}.`,
    entrepriseName: entreprise,
    quoteId: q.id || "",
    projectId: reserve.projectId || q.projectId || "",
    objet: { titre: `Réserve ${reserve.numero || ""}`.trim(), detail: [reserve.titre, reserve.lieu].filter(Boolean).join(" · ") },
    ecart: null,
    rappel: "",
    actionUrl: lienChantier(q.id, "chantier"),
    actionLabel: "Voir le chantier"
  };
}

// Comptes Koji Client à qui le devis appartient (portail, accès donné,
// e-mail du devis ou du chantier) : même contrôle que leurs lectures.
export function particuliersDuDevis(users = [], quote = {}, chantierEmail = "") {
  return (users || [])
    .filter((u) => u?.id && u.accountType === "particulier" && quoteBelongsToClient(quote, { clientEmail: chantierEmail }, u, normalizeEmail(u.email)))
    .map((u) => u.id);
}

// Ajoute la notification pour chacun de ces comptes ; renvoie leur nombre.
export function notifierParticuliers(db, userIds = [], notif, maintenant = new Date().toISOString()) {
  if (!notif || !userIds.length) return 0;
  if (!Array.isArray(db.notifications)) db.notifications = [];
  for (const userId of userIds) {
    db.notifications.unshift({ id: `notif-cli-${randomUUID()}`, userId, accountType: "particulier", ...notif, read: false, createdAt: maintenant });
  }
  return userIds.length;
}
