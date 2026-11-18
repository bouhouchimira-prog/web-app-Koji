import { creneauLong, jourCourt, offreExpiree, paris, rdvConfirme, EXPIRATION_JOURS } from "./radar-jetons.js";
import { joursOuvresEntre } from "./planning-chantier.js";
import { moyenneTexte, statsAvis } from "./avis.js";
import { verifications } from "./kojipage.js";
import { resteDu } from "./encaissements.js";

// Koji Client · projets et propositions (maquette CLI-01). Règles pures,
// partagées par le site et l'app Koji : le serveur fabrique les libellés,
// les deux écrans les affichent tels quels.
//
// Décision du 10 novembre : aucun prix calculé par Koji n'est montré au
// particulier. La maquette affiche un « prix recommandé Koji » et un « écart
// au prix recommandé » : ils ne sont pas repris. Les prix affichés sont ceux
// des entreprises elles-mêmes (leur devis envoyé, sinon leur estimation
// jointe à la proposition).

const JOUR = 86400000;
const t = (iso) => new Date(iso || 0).getTime();
const jourIso = (iso) => String(iso || "").slice(0, 10);
const jourParis = (iso) => paris(iso).toISOString().slice(0, 10);
const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;

// Montant avec centimes, comme sur les devis (« 6 034,82 € »). L'espace fine
// de Node est remplacée par une espace insécable ordinaire : elle existe
// dans toutes les polices de l'app.
export function montant(valeur) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(Number(valeur) || 0)
    .replace(/ /g, " ");
}

// « d'ABL Expert Renov », « de Rénov Est ».
export function de(nom = "") {
  const n = String(nom).trim();
  return /^[aeiouyhàâäéèêëîïôöùûü]/i.test(n) ? `d'${n}` : `de ${n}`;
}

// Paris, Lyon et Marseille : l'arrondissement se lit dans le code postal.
export function villeCourte(ville = "", codePostal = "") {
  const cp = String(codePostal || "").replace(/\s/g, "");
  const rang = (n) => `${n}${n === 1 ? "er" : "e"}`;
  if (/^750\d\d$/.test(cp) && Number(cp.slice(3)) >= 1 && Number(cp.slice(3)) <= 20) return `Paris ${rang(Number(cp.slice(3)))}`;
  if (/^6900[1-9]$/.test(cp)) return `Lyon ${rang(Number(cp.slice(4)))}`;
  if (/^130(0[1-9]|1[0-6])$/.test(cp)) return `Marseille ${rang(Number(cp.slice(3)))}`;
  return String(ville || "").trim();
}

const majuscule = (texte) => (texte ? texte[0].toUpperCase() + texte.slice(1) : "");
const court = (texte, max = 48) => {
  const net = String(texte || "").replace(/\s+/g, " ").trim();
  if (net.length <= max) return net;
  const coupe = net.slice(0, max);
  return `${coupe.slice(0, coupe.lastIndexOf(" ") > 20 ? coupe.lastIndexOf(" ") : max).replace(/[,;:.\s]+$/, "")}…`;
};

function listePieces(noms) {
  const pieces = [...new Set(noms.map((n) => String(n || "").trim()).filter(Boolean))];
  if (!pieces.length) return "";
  if (pieces.length === 1) return pieces[0];
  if (pieces.length === 2) return `${pieces[0]} et ${pieces[1].toLowerCase()}`;
  return `${pieces[0]}, ${pieces[1].toLowerCase()} et ${pluriel(pieces.length - 2, "autre pièce", "autres pièces")}`;
}

// Titre d'une demande publiée : ses pièces, sinon le début de la
// description, puis la ville (« Salle de bain, Paris 10e »).
export function titreOffre(offre = {}) {
  const sujet = listePieces((offre.ouvrages || []).map((o) => o?.room)) || court(offre.description) || majuscule(String(offre.metier || "").trim()) || "Projet de travaux";
  const ville = villeCourte(offre.city, offre.postalCode);
  return ville ? `${majuscule(sujet)}, ${ville}` : majuscule(sujet);
}

// Titre d'un brouillon : ce que le particulier a déjà dit à l'assistant.
export function titreBrouillon(data = {}) {
  const pieces = Array.isArray(data.rooms) ? data.rooms.map((r) => (typeof r === "string" ? r : r?.name || r?.room || r?.nom || "")) : [];
  return majuscule(listePieces(pieces) || court(data.travauxDetail || data.intro) || String(data.metier || "").trim()) || "Nouveau projet";
}

// Un brouillon ne s'affiche que s'il contient déjà quelque chose : l'assistant
// en crée un dès le premier message, même abandonné aussitôt.
export function brouillonUtile(brouillon = {}) {
  const data = brouillon.data || {};
  return brouillon.status === "en_cours" && Boolean(data.metier || data.intro || data.travauxDetail || (Array.isArray(data.rooms) && data.rooms.length));
}

export function titreChantier(devis = {}) {
  const chantier = typeof devis.project === "string" ? devis.project : devis.project?.title;
  return String(chantier || devis.projectName || devis.title || "").trim() || "Chantier";
}

export const nomEntreprise = (devis = {}) => String(devis.company?.name || devis.companyName || "").trim() || "Votre entreprise";

// Un devis annulé ou refusé (rétractation comprise) n'est ni signé ni à signer.
const ecarte = (devis = {}) => ["Annule", "Annulee", "Refuse", "Expire"].includes(devis.status);
export const estSigne = (devis = {}) => !ecarte(devis) && (devis.status === "Signe" || devis.status === "accepte" || devis.signatureStatus === "Signe" || Boolean(devis.signedAt));
export const estASigner = (devis = {}) => devis.status === "Envoye" && !estSigne(devis);

// Où en est un chantier signé, avec les mots de la maquette (« chantier en
// cours · jour 6 sur 18 », en jours ouvrés).
export function avancementChantier(devis = {}, maintenant = new Date().toISOString()) {
  const aujourdhui = jourParis(maintenant);
  const reception = devis.finChantier?.receptionLe;
  if (reception) return { etat: "termine", texte: `chantier terminé · réceptionné le ${jourCourt(reception)}` };
  const taches = (devis.tasks || []).filter((x) => x.startDate || x.endDate || x.dueDate);
  if (taches.length) {
    const debut = taches.map((x) => jourIso(x.startDate || x.endDate || x.dueDate)).sort()[0];
    const fin = taches.map((x) => jourIso(x.endDate || x.dueDate || x.startDate)).sort().pop();
    const toutes = (devis.tasks || []).length > 0 && (devis.tasks || []).every((x) => x.done);
    if (toutes) return { etat: "termine", texte: "chantier terminé" };
    if (aujourdhui < debut) return { etat: "a_venir", texte: `début le ${jourCourt(`${debut}T12:00:00Z`)}` };
    const total = joursOuvresEntre(debut, fin);
    const rang = joursOuvresEntre(debut, aujourdhui);
    if (aujourdhui <= fin && total > 0 && rang > 0) return { etat: "en_cours", texte: `chantier en cours · jour ${rang} sur ${total}` };
    return { etat: "en_cours", texte: "chantier en cours" };
  }
  const debutDevis = jourIso(devis.startDate);
  if (/^\d{4}-\d{2}-\d{2}$/.test(debutDevis) && debutDevis > aujourdhui) return { etat: "a_venir", texte: `début prévu le ${jourCourt(`${debutDevis}T12:00:00Z`)}` };
  return { etat: "a_venir", texte: devis.signedAt ? `devis signé le ${jourCourt(devis.signedAt)}` : "devis signé" };
}

const ETIQUETTES = {
  en_cours: "En cours", a_venir: "À venir", termine: "Terminé", a_signer: "À signer",
  a_choisir: "À choisir", en_attente: "En attente", expiree: "Expirée", brouillon: "Brouillon"
};

function projet(base) {
  return {
    propositions: 0, principale: false, attenue: false,
    etiquette: ETIQUETTES[base.etat] || "",
    etiquettePleine: !["brouillon", "en_attente", "expiree", "termine"].includes(base.etat),
    ...base
  };
}

// Un devis signé : le chantier. Un devis envoyé, pas encore signé : à signer.
export function projetDevis(devis, maintenant) {
  const entreprise = nomEntreprise(devis);
  if (estASigner(devis)) {
    return projet({
      cle: `chantier:${devis.id}`, type: "chantier", id: devis.id, titre: titreChantier(devis),
      detail: `${entreprise} · devis à signer${Number(devis.totalTtc) > 0 ? ` · ${montant(devis.totalTtc)}` : ""}`,
      etat: "a_signer", action: "Voir et signer", principale: true, lien: `/client/chantier/${devis.id}`
    });
  }
  const etape = avancementChantier(devis, maintenant);
  return projet({
    cle: `chantier:${devis.id}`, type: "chantier", id: devis.id, titre: titreChantier(devis),
    detail: `${entreprise} · ${etape.texte}`, etat: etape.etat, action: "Voir le chantier",
    principale: etape.etat === "en_cours", attenue: etape.etat === "termine", lien: `/client/chantier/${devis.id}`
  });
}

// Positions encore ouvertes sur une demande : celles que le particulier peut comparer.
export function positionsOuvertes(offre, positions = []) {
  return positions
    .filter((p) => p.offerId === offre.id && p.status === "Active")
    .sort((a, b) => t(a.createdAt) - t(b.createdAt));
}

function visitesConfirmees(offre, positions, messages) {
  return positions.map((p) => rdvConfirme(messages, offre.id, p.entrepriseUserId)).filter((r) => r?.rdvDate).map((r) => r.rdvDate).sort();
}

export function projetOffre(offre, { positions = [], messages = [], maintenant = new Date().toISOString() } = {}) {
  const ouvertes = positionsOuvertes(offre, positions);
  const visites = visitesConfirmees(offre, ouvertes, messages);
  const base = { cle: `offre:${offre.id}`, type: "offre", id: offre.id, titre: titreOffre(offre), lien: `/client/projet/${offre.id}`, propositions: ouvertes.length };
  if (ouvertes.length) {
    const visite = visites.length === 1 ? ` · 1 visite le ${jourCourt(visites[0])}` : visites.length > 1 ? ` · ${visites.length} visites` : "";
    return projet({ ...base, detail: `${pluriel(ouvertes.length, "proposition reçue", "propositions reçues")}${visite}`, etat: "a_choisir", action: "Comparer" });
  }
  const publieLe = offre.publishedAt || offre.createdAt;
  if (offreExpiree(offre, maintenant)) {
    const fin = new Date(t(publieLe) + EXPIRATION_JOURS * JOUR).toISOString();
    return projet({ ...base, detail: `demande expirée le ${jourCourt(fin)} · aucune proposition`, etat: "expiree", action: "Voir ma demande", attenue: true });
  }
  return projet({ ...base, detail: `publiée le ${jourCourt(publieLe)} · en attente de propositions`, etat: "en_attente", action: "Voir ma demande" });
}

export function projetBrouillon(brouillon) {
  return projet({
    cle: `brouillon:${brouillon.id}`, type: "brouillon", id: brouillon.id, titre: titreBrouillon(brouillon.data),
    detail: `brouillon · commencé le ${jourCourt(brouillon.created_at || brouillon.updated_at)}`,
    etat: "brouillon", action: "Continuer", attenue: true,
    lien: `/client/radar/new?draftId=${encodeURIComponent(brouillon.id)}&reprendre=1`
  });
}

// La liste « Mes projets » : chantiers en cours et devis à signer d'abord,
// puis les demandes (les plus récentes en premier), puis les brouillons.
// Une demande qui a abouti à un devis signé n'apparaît plus : c'est le chantier.
export function listeProjets({ devis = [], offres = [], positions = [], messages = [], brouillons = [], maintenant = new Date().toISOString() } = {}) {
  const utiles = devis.filter((d) => estSigne(d) || estASigner(d));
  const idsOffres = new Set(offres.map((o) => o.id));
  const offresSignees = new Set(utiles.filter(estSigne).map((d) => d.chantierOffreId).filter(Boolean));
  const rang = { en_cours: 0, a_signer: 1, a_venir: 2, termine: 4 };
  const chantiers = utiles
    // Un devis à signer lié à une de mes demandes se signe depuis la comparaison.
    .filter((d) => estSigne(d) || !idsOffres.has(d.chantierOffreId))
    .map((d) => projetDevis(d, maintenant))
    .sort((a, b) => (rang[a.etat] ?? 3) - (rang[b.etat] ?? 3));
  const demandes = offres
    .filter((o) => !offresSignees.has(o.id))
    .sort((a, b) => t(b.publishedAt || b.createdAt) - t(a.publishedAt || a.createdAt))
    .map((o) => projetOffre(o, { positions, messages, maintenant }));
  const encours = brouillons.filter(brouillonUtile).sort((a, b) => t(b.updated_at) - t(a.updated_at)).map(projetBrouillon);
  const termines = chantiers.filter((c) => c.etat === "termine");
  return [...chantiers.filter((c) => c.etat !== "termine"), ...demandes, ...encours, ...termines];
}

const MOIS_LONGS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const dateLongue = (jour) => `${Number(jour.slice(8, 10))} ${MOIS_LONGS[Number(jour.slice(5, 7)) - 1]}`;

// « Ce qui vous attend » : ce qui est à payer, à signer, et les visites
// confirmées à venir. Rien d'inventé : chaque ligne vient d'une donnée.
export function ceQuiVousAttend({ devis = [], offres = [], positions = [], messages = [], factures = [], maintenant = new Date().toISOString() } = {}) {
  const lignes = [];
  const idsDevis = new Set(devis.map((d) => d.id));
  for (const f of factures) {
    if (!idsDevis.has(f.quoteId) || f.kind === "avoir" || ["Brouillon", "Annulee", "Payee"].includes(f.status)) continue;
    const du = resteDu(f);
    if (!(du > 0)) continue;
    const quoi = String(f.type || "Facture").trim();
    lignes.push({ ordre: `0${jourIso(f.dueDate) || "9999"}`, texte: `${quoi} à payer${f.dueDate ? ` avant le ${dateLongue(jourIso(f.dueDate))}` : ""} · ${montant(du)}.` });
  }
  for (const d of devis.filter(estASigner)) {
    lignes.push({ ordre: `1${d.sentAt || ""}`, texte: `Devis ${de(nomEntreprise(d))} à signer${Number(d.totalTtc) > 0 ? ` · ${montant(d.totalTtc)}` : ""}.` });
  }
  for (const offre of offres) {
    for (const p of positionsOuvertes(offre, positions)) {
      const rdv = rdvConfirme(messages, offre.id, p.entrepriseUserId);
      if (!rdv?.rdvDate || t(rdv.rdvDate) < t(maintenant)) continue;
      lignes.push({ ordre: `2${rdv.rdvDate}`, texte: `Visite confirmée ${creneauLong(rdv.rdvDate)} · ${titreOffre(offre)}.` });
    }
  }
  return lignes.sort((a, b) => a.ordre.localeCompare(b.ordre)).map((l) => l.texte);
}

// Durée telle que l'entreprise l'a écrite : un nombre devient « 18 jours ».
function dureeTexte(duree) {
  const brut = String(duree ?? "").trim();
  if (!brut) return "";
  return /^\d+([.,]\d+)?$/.test(brut) ? pluriel(Math.round(Number(brut.replace(",", "."))), "jour", "jours") : brut;
}

export const NOTE_COMPARAISON = "Koji met en relation ; chaque devis est établi et signé avec l'entreprise. Les entreprises sont classées par date de réponse, pas par paiement.";
export const SANS_PROPOSITION = "Aucune entreprise n'a encore répondu. Vous serez prévenu dès la première proposition.";

// Une colonne de la comparaison (maquette : prix, avis, début et durée,
// visite, décennale, garanties, une action).
export function proposition(offre, position, { messages = [], devis = [], avis = [], business = {}, maintenant = new Date().toISOString() } = {}) {
  const id = position.entrepriseUserId;
  const nom = String(position.entrepriseSnapshot?.raisonSociale || "").trim() || "Entreprise";
  // Le devis de cette entreprise pour cette demande, s'il a été envoyé.
  const lie = devis
    .filter((d) => d.chantierOffreId === offre.id && d.userId === id && (estSigne(d) || estASigner(d)))
    .sort((a, b) => t(b.sentAt || b.createdAt) - t(a.sentAt || a.createdAt))[0] || null;
  const estimation = Number(position.devisEstimatifTtc) || 0;
  const prix = lie && Number(lie.totalTtc) > 0 ? montant(lie.totalTtc) : estimation > 0 ? montant(estimation) : "à venir";
  const prixNote = lie && Number(lie.totalTtc) > 0 ? "" : estimation > 0 ? "estimation avant visite" : "";

  const stats = statsAvis(avis.filter((a) => a.userId === id));
  const avisTexte = stats.nombre ? `${moyenneTexte(stats.moyenne)} · ${stats.nombre} avis` : "pas encore d'avis";

  const debutJour = jourIso(lie?.startDate);
  const duree = dureeTexte(lie?.expectedDuration);
  const debut = /^\d{4}-\d{2}-\d{2}$/.test(debutJour)
    ? `début possible le ${jourCourt(`${debutJour}T12:00:00Z`)}${duree ? ` · ${duree}` : ""}`
    : duree ? `durée ${duree} · début à préciser` : "à préciser avec l'entreprise";

  const rdv = rdvConfirme(messages, offre.id, id);
  const fil = messages.filter((m) => m.offerId === offre.id && m.entrepriseUserId === id);
  const repondues = new Set(fil.filter((m) => m.kind === "rdv_response").map((m) => m.respondsToId));
  const creneaux = fil.filter((m) => m.kind === "rdv_proposal" && m.senderType === "entreprise" && !repondues.has(m.id) && t(m.rdvDate) > t(maintenant));
  const visite = rdv?.rdvDate
    ? (t(rdv.rdvDate) < t(maintenant) ? `visite faite le ${jourCourt(rdv.rdvDate)}` : `visite prévue ${creneauLong(rdv.rdvDate)}`)
    : creneaux.length ? `${pluriel(creneaux.length, "créneau proposé", "créneaux proposés")} pour la visite` : "visite à prévoir";

  const decennale = verifications(business, maintenant).items.find((i) => i.id === "decennale")?.ok ? "vérifiée par Koji" : "non renseignée";

  const fiche = `/client/radar/${offre.id}?entreprise=${encodeURIComponent(id)}`;
  const action = lie && estASigner(lie)
    ? { type: "signer", libelle: "Voir et signer", principale: true, lien: `/client/chantier/${lie.id}` }
    : lie && estSigne(lie)
      ? { type: "voir", libelle: "Voir le chantier", principale: true, lien: `/client/chantier/${lie.id}` }
      : rdv
        ? { type: "voir", libelle: "Voir la proposition", principale: false, lien: fiche }
        : { type: "rdv", libelle: "Prendre rendez-vous", principale: false, lien: fiche };

  const debutCourt = debut === "à préciser avec l'entreprise" ? "début à préciser" : debut;
  return {
    entrepriseId: id, nom, prix, prixNote, avis: avisTexte, debut, visite, decennale, garanties: "1, 2 et 10 ans",
    resume: [`${avisTexte} · ${debutCourt}`, visite],
    action, voir: `Voir la proposition ${de(nom)}`, reponduLe: position.createdAt || ""
  };
}

// La page « Comparer les propositions » d'une demande.
export function comparaison(offre, { positions = [], messages = [], devis = [], avis = [], profils = new Map(), maintenant = new Date().toISOString() } = {}) {
  const ouvertes = positionsOuvertes(offre, positions);
  const propositions = ouvertes.map((p) => proposition(offre, p, { messages, devis, avis, business: profils.get(p.entrepriseUserId) || {}, maintenant }));
  const p = projetOffre(offre, { positions, messages, maintenant });
  return {
    projet: { id: offre.id, titre: p.titre, etat: p.etat, publieLe: offre.publishedAt || offre.createdAt || "" },
    titre: propositions.length ? pluriel(propositions.length, "proposition", "propositions") : "Aucune proposition",
    propositions,
    vide: propositions.length ? "" : SANS_PROPOSITION,
    note: NOTE_COMPARAISON
  };
}
