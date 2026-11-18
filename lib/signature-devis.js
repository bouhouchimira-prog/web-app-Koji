import { MENTION_TAUX_REDUIT, estTauxReduit } from "./tva.js";
import { demarrageAvantFin, finRetractation, texteDemandeExpresse, texteRetractation } from "./signature-lieu.js";

// Signature d'un devis par le particulier (maquettes CLI-02 et CLI-07) :
// règles communes à la signature depuis l'espace Koji Client et depuis le
// lien reçu par e-mail. Règles pures, testées dans tests/unit ; le serveur
// les applique (lib/signature-en-ligne.js), les écrans affichent ce
// qu'elles renvoient. Reprend PRO-03.5 (mention TVA), PRO-03.6 (une seule
// version signable) et PRO-03.7 (rétractation, démarrage anticipé).

const jourDe = (v) => String(v || "").slice(0, 10);
export const jourParis = (iso = new Date().toISOString()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(iso));

export const TEXTE_ACCEPTATION = "J'ai lu le devis et je l'accepte ; ma signature vaut accord sur ce devis.";
// Pas d'équivalence juridique affirmée (« même valeur qu'une signature
// manuscrite ») : on décrit la preuve conservée.
export const TEXTE_PREUVE = "Horodatage, adresse de connexion, appareil et exemplaire PDF conservés par Koji comme preuve de signature. Aucune case n'est cochée à l'avance.";

export const estDejaSigne = (q = {}) => q.signatureStatus === "Signe" || q.status === "Signe" || q.status === "accepte";

// TVA à taux réduit : la mention doit être certifiée par le client.
export function mentionTvaAttendue(q = {}) {
  return !q.autoliquidation && (estTauxReduit(q.vatRate) || (q.items || []).some((item) => estTauxReduit(item.tauxTva)));
}

function tauxReduit(q = {}) {
  if (estTauxReduit(q.vatRate)) return Number(q.vatRate);
  const ligne = (q.items || []).find((item) => estTauxReduit(item.tauxTva));
  return ligne ? Number(ligne.tauxTva) : 10;
}

const tauxTexte = (t) => `${String(t).replace(".", ",")} %`;

// Ce que l'écran de signature montre, ou null si le devis ne se signe pas
// (déjà signé, rétracté, annulé).
export function regleSignature(q = {}, { aujourdhui = jourParis() } = {}) {
  if (estDejaSigne(q) || q.retracteLe || ["Annule", "Annulee", "Refuse", "Expire", "Archive"].includes(q.status)) return null;
  const particulier = q.clientType !== "societe";
  const fin = particulier ? finRetractation(aujourdhui, "en-ligne", q.clientType) : "";
  const debut = jourDe(q.startDate);
  const reduit = mentionTvaAttendue(q);
  const taux = tauxReduit(q);
  return {
    retractation: fin ? texteRetractation(fin) : "",
    finRetractation: fin,
    mentionTva: reduit
      ? {
        libelle: taux === 5.5
          ? `Logement de plus de 2 ans, à usage d'habitation, travaux d'amélioration énergétique (TVA ${tauxTexte(taux)})`
          : `Logement de plus de 2 ans, à usage d'habitation (TVA ${tauxTexte(taux)})`,
        texte: MENTION_TAUX_REDUIT
      }
      : null,
    demarrage: particulier && demarrageAvantFin(debut, fin) ? { libelle: texteDemandeExpresse(debut), date: debut } : null,
    acceptation: TEXTE_ACCEPTATION,
    preuve: TEXTE_PREUVE
  };
}

// Image de la signature tracée : un PNG en data URL, de taille raisonnable.
export function imageSignatureValide(image) {
  const texte = String(image || "");
  return /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(texte) && texte.length > 200 && texte.length <= 400000;
}

// Message d'erreur si la demande de signature est incomplète, sinon "".
export function erreurSignature(q = {}, body = {}) {
  if (!body.consent) return "Cochez « J'ai lu le devis et je l'accepte » avant de signer.";
  if (mentionTvaAttendue(q) && body.mentionTva !== true) return "Pour la TVA à taux réduit, merci de certifier la mention avant de signer.";
  if (!String(body.signerName || q.client || "").trim()) return "Indiquez votre nom.";
  if (!imageSignatureValide(body.signature)) return "Signez dans le cadre avant de valider.";
  return "";
}

// Preuve conservée avec la signature : adresse de connexion et appareil.
export function preuveDeRequete(headers, now) {
  const lire = (nom) => (typeof headers?.get === "function" ? headers.get(nom) : headers?.[nom]) || "";
  const ip = String(lire("x-forwarded-for")).split(",")[0].trim() || String(lire("x-real-ip")).trim();
  return { le: now, ip: ip.slice(0, 64), appareil: String(lire("user-agent")).slice(0, 240) };
}

// Champs enregistrés sur le devis au moment de la signature en ligne.
export function champsSignes(q = {}, body = {}, { now, preuve = null, origine = "lien", normalizeEmail = (v) => String(v || "").trim().toLowerCase(), fixText = (v) => String(v || "") } = {}) {
  const reduit = mentionTvaAttendue(q);
  const jour = jourParis(now);
  const email = normalizeEmail(body.signerEmail || q.clientEmail || "");
  const demande = body.demandeExpresse === true && Boolean(regleSignature(q, { aujourdhui: jour })?.demarrage);
  return {
    status: "Signe",
    signatureStatus: "Signe",
    signerName: fixText(String(body.signerName || q.client || "Client").trim()).slice(0, 120),
    signerEmail: email,
    clientEmail: email,
    clientPhone: fixText(body.signerPhone || q.clientPhone || ""),
    signaturePlace: fixText(body.signaturePlace || ""),
    signerMessage: fixText(body.signerMessage || ""),
    signedAt: now,
    signatureImage: String(body.signature || ""),
    ...(reduit ? { mentionTva: true, mentionTvaLe: now } : {}),
    // Signé en ligne (PRO-03.7) : 14 jours de rétractation pour un
    // particulier, démarrage pendant le délai sur sa demande expresse.
    signatureLieu: "en-ligne",
    retractationJusquau: finRetractation(jour, "en-ligne", q.clientType),
    consentements: { demandeExpresse: demande ? now : "", mentionTva: reduit ? now : "", exemplaireEmail: "" },
    demarrageDemande: demande ? jourDe(q.startDate) : "",
    preuveSignature: preuve ? { ...preuve, origine: origine === "espace" ? "espace Koji Client" : "lien de signature" } : null,
    updatedAt: now
  };
}
