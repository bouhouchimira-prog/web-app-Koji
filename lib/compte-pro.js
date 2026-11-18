// Profil et compte Koji Pro (maquettes PRO-15 à 15.6) : étapes du profil,
// réglages des devis et factures, mentions obligatoires, notifications,
// langues. Règles pures, partagées avec l'app (mobile/lib/features/compte),
// testées dans tests/unit/compte-pro.test.js.

const jour = (v) => String(v || "").slice(0, 10);
const chiffres = (v) => String(v || "").replace(/\D/g, "");

// SIREN affiché : « 992 ••• 651 ».
export function masquerSiren(siren = "") {
  const s = chiffres(siren).slice(0, 9);
  return s.length === 9 ? `${s.slice(0, 3)} ••• ${s.slice(6)}` : s;
}
export function sirenDe(business = {}) {
  return chiffres(business.siren || "").slice(0, 9) || chiffres(business.siret || "").slice(0, 9);
}

// Régime de TVA de l'entreprise.
export const REGIMES_TVA = {
  encaissements: { label: "Assujetti, TVA sur les encaissements", detail: "cas courant pour les travaux · numéro de TVA intracommunautaire demandé" },
  debits: { label: "Assujetti, TVA sur les débits", detail: "sur option auprès des impôts · mention ajoutée sur les factures" },
  franchise: { label: "Franchise en base", detail: "micro-entreprise sous le seuil · « TVA non applicable, art. 293 B du CGI » ajouté seul" }
};
export const MENTION_FRANCHISE = "TVA non applicable, art. 293 B du CGI.";
export const MENTION_DEBITS = "Option pour le paiement de la TVA d'après les débits.";
export function regimeTva(business = {}) {
  return REGIMES_TVA[business.regimeTva] ? business.regimeTva : "encaissements";
}
export function mentionRegime(regime) {
  return regime === "franchise" ? MENTION_FRANCHISE : regime === "debits" ? MENTION_DEBITS : "";
}

// Conditions par défaut des devis (modifiables sur chaque devis).
export function conditionsDefaut(business = {}) {
  const d = business.devisDefauts || {};
  const borne = (v, min, max, def) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= min && n <= max ? n : def; };
  return { validiteJours: borne(d.validiteJours, 1, 365, 30), acomptePct: borne(d.acomptePct, 0, 100, 30), paiementJours: borne(d.paiementJours, 0, 120, 30) };
}

export function mediateurDe(business = {}) {
  const m = business.mediateur || {};
  const nom = String(m.nom || "").trim();
  return nom ? { nom, site: String(m.site || "").trim() } : null;
}
export function mentionMediateur(business = {}) {
  const m = mediateurDe(business);
  return m ? `Médiateur de la consommation : ${m.nom}${m.site ? `, ${m.site}` : ""}.` : "";
}
export const MENTION_RETARD = "Retard de paiement (clients professionnels) : pénalités au taux de trois fois l'intérêt légal et indemnité forfaitaire de recouvrement de 40 €.";

function decennaleDe(business = {}) {
  const doc = business.documents?.decennale || {};
  const assureur = String(doc.insurer || business.decennaleInsurer || "").trim();
  const contrat = String(doc.policy || business.decennalePolicy || "").trim();
  const jusqua = jour(doc.expiryDate || business.decennaleUntil || "");
  return { assureur, contrat, jusqua, fichier: Boolean(doc.fileDataUrl), renseignee: Boolean(assureur || doc.fileDataUrl) };
}

// Mentions obligatoires : ce que Koji ajoute seul, et ce qui manque.
export function mentionsObligatoires(business = {}) {
  const dec = decennaleDe(business);
  const regime = regimeTva(business);
  const identite = Boolean(business.raisonSociale && sirenDe(business).length === 9 && business.addressLine1);
  const tva = regime === "franchise" || Boolean(String(business.tva || "").trim());
  const med = mediateurDe(business);
  return [
    { id: "identite", label: "Identité et SIREN", detail: "raison sociale, forme, siège, SIREN, TVA", ok: identite && tva, manque: !identite ? "raison sociale, adresse ou SIREN à compléter" : !tva ? "numéro de TVA intracommunautaire à renseigner" : "" },
    { id: "decennale", label: "Décennale", detail: "assureur, contrat, couverture", ok: dec.renseignee, manque: dec.renseignee ? "" : "assurance décennale à renseigner" },
    { id: "retard", label: "Retard de paiement", detail: "pénalités et indemnité de 40 € (professionnels)", ok: true, manque: "" },
    { id: "mediateur", label: "Médiateur de la consommation", detail: med ? med.nom : "à désigner · obligatoire pour les particuliers", ok: Boolean(med), manque: med ? "" : "médiateur à désigner" },
    { id: "franchise", label: "Régime de TVA", detail: regime === "franchise" ? "« TVA non applicable, art. 293 B du CGI »" : REGIMES_TVA[regime].label.toLowerCase(), ok: true, manque: "" }
  ];
}

// Les six étapes du profil ; chacune dit ce qu'elle débloque.
export function etapesProfil(business = {}, { professions = [], tauxRegles = 0 } = {}) {
  const dec = decennaleDe(business);
  const etapes = [
    { id: "identite", label: "Identité", sous: "depuis votre SIREN", fait: Boolean(business.raisonSociale && sirenDe(business).length === 9 && business.addressLine1), lien: "/profil" },
    { id: "metiers", label: "Métiers et zone", sous: "débloque le Radar", fait: professions.filter(Boolean).length > 0 && Boolean(business.zoneAddress), lien: "/profil" },
    { id: "prix", label: "Vos prix", sous: "débloque le Devis guidé", fait: Number(tauxRegles) > 0 || Number(business.dailyRate) > 0, lien: "/bibliotheque-ouvrages/mes-prix" },
    { id: "decennale", label: "Décennale", sous: "obligatoire sur vos devis", fait: dec.renseignee, lien: "/profil" },
    { id: "iban", label: "IBAN", sous: "imprimé sur vos factures", fait: Boolean(String(business.iban || "").replace(/\s/g, "")), lien: "/profil?tab=devis" },
    { id: "mediateur", label: "Médiateur", sous: "obligatoire pour les particuliers", fait: Boolean(mediateurDe(business)), lien: "/profil?tab=devis" }
  ];
  const faites = etapes.filter((e) => e.fait).length;
  const restantes = etapes.filter((e) => !e.fait);
  const noms = restantes.map((e) => (e.id === "iban" ? "l'IBAN" : e.id === "identite" ? "l'identité" : e.id === "prix" ? "vos prix" : e.id === "decennale" ? "la décennale" : e.id === "mediateur" ? "le médiateur" : "les métiers et la zone"));
  const reste = !restantes.length ? "Profil complet." : `Il reste ${noms.length > 1 ? `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}` : noms[0]}.`;
  return { etapes, faites, total: etapes.length, pct: Math.round((faites / etapes.length) * 100), reste, suivante: restantes[0] || null };
}

// Disponibilités : jours et heures des chantiers, créneaux de visite, fermeture.
export const JOURS = [["lun", "lun."], ["mar", "mar."], ["mer", "mer."], ["jeu", "jeu."], ["ven", "ven."], ["sam", "sam."], ["dim", "dim."]];
export function disponibilitesDe(business = {}) {
  const d = business.disponibilites || {};
  const jours = (v, def) => (Array.isArray(v) ? v.filter((x) => JOURS.some(([id]) => id === x)) : def);
  const heure = (v, def) => (/^\d{1,2}:\d{2}$/.test(String(v || "")) ? String(v).padStart(5, "0") : def);
  return {
    chantiers: { jours: jours(d.chantiers?.jours, ["lun", "mar", "mer", "jeu", "ven"]), de: heure(d.chantiers?.de, "08:00"), a: heure(d.chantiers?.a, "17:00") },
    visites: { jours: jours(d.visites?.jours, ["mar", "jeu"]), de: heure(d.visites?.de, "14:00"), a: heure(d.visites?.a, "18:00") },
    fermeture: { du: jour(d.fermeture?.du), au: jour(d.fermeture?.au) }
  };
}
const h = (hhmm) => { const [a, b] = hhmm.split(":").map(Number); return b ? `${a} h ${String(b).padStart(2, "0")}` : `${a} h`; };
export function libelleJours(ids = []) {
  const ordre = JOURS.map(([id]) => id);
  const tri = ordre.filter((id) => ids.includes(id));
  if (!tri.length) return "aucun jour";
  const suite = tri.every((id, i) => i === 0 || ordre.indexOf(id) === ordre.indexOf(tri[i - 1]) + 1);
  const nom = (id) => JOURS.find(([x]) => x === id)[1];
  return suite && tri.length > 2 ? `${nom(tri[0])} – ${nom(tri[tri.length - 1])}` : tri.map(nom).join(", ");
}
export function libelleDisponibilite(bloc = {}) {
  return `${libelleJours(bloc.jours)} · ${h(bloc.de)} – ${h(bloc.a)}`;
}
// Jour de visite proposé au client (Radar, KojiPage) : dans les jours de visite, hors fermeture.
export function jourDeVisite(business = {}, dateIso = "") {
  const d = disponibilitesDe(business);
  const j = jour(dateIso);
  if (!j) return false;
  if (d.fermeture.du && d.fermeture.au && j >= d.fermeture.du && j <= d.fermeture.au) return false;
  const id = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"][new Date(`${j}T12:00:00Z`).getUTCDay()];
  return d.visites.jours.includes(id);
}

// Qualifications et labels (RGE, Qualibat…).
export function qualificationsDe(business = {}) {
  return (Array.isArray(business.qualifications) ? business.qualifications : []).map((q, i) => ({
    id: String(q.id || `q-${i}`), type: q.type === "rge" ? "rge" : "autre", nom: String(q.nom || "").trim().slice(0, 80), numero: String(q.numero || "").trim().slice(0, 60), jusqua: jour(q.jusqua)
  })).filter((q) => q.nom);
}

// Documents qui expirent dans les 30 jours (décennale, qualifications).
export function documentsExpirant(business = {}, aujourdhui = new Date().toISOString(), jours = 30) {
  const auj = jour(aujourdhui);
  const limite = new Date(`${auj}T12:00:00Z`);
  limite.setUTCDate(limite.getUTCDate() + jours);
  const lim = limite.toISOString().slice(0, 10);
  const reste = (j) => Math.round((Date.parse(`${j}T12:00:00Z`) - Date.parse(`${auj}T12:00:00Z`)) / 86400000);
  const out = [];
  const dec = decennaleDe(business);
  if (dec.jusqua && dec.jusqua <= lim) out.push({ id: "decennale", nom: "Assurance décennale", jusqua: dec.jusqua, jours: reste(dec.jusqua) });
  for (const q of qualificationsDe(business)) if (q.jusqua && q.jusqua <= lim) out.push({ id: q.id, nom: q.nom, jusqua: q.jusqua, jours: reste(q.jusqua) });
  return out;
}

// --- Notifications (PRO-15.4) ---------------------------------------------
export const EVENEMENTS = [
  { id: "devis_signe", label: "Un devis est signé" },
  { id: "paiement", label: "Un paiement arrive" },
  { id: "chantier_zone", label: "Un nouveau chantier dans votre zone" },
  { id: "message_client", label: "Un message de client" },
  { id: "document_expire", label: "Un document va expirer" },
  { id: "resume_semaine", label: "Résumé de la semaine, le lundi" }
];
export const CANAUX = [{ id: "telephone", label: "Téléphone" }, { id: "email", label: "E-mail" }, { id: "sms", label: "SMS" }];

export function prefsDefaut() {
  const evenements = {};
  for (const e of EVENEMENTS) evenements[e.id] = { telephone: e.id !== "resume_semaine", email: true, sms: false };
  return { evenements, silence: true };
}
export function normaliserPrefs(p = {}) {
  const def = prefsDefaut();
  const evenements = {};
  for (const e of EVENEMENTS) {
    const x = p.evenements?.[e.id] || {};
    evenements[e.id] = { telephone: x.telephone ?? def.evenements[e.id].telephone, email: x.email ?? def.evenements[e.id].email, sms: false };
  }
  return { evenements, silence: p.silence !== false };
}

// Type de notification interne → événement réglable (les autres ne partent pas par e-mail).
const TYPES = {
  "quote.signed": "devis_signe", "avenant.signe": "devis_signe",
  "site.lead": "message_client", "reseau.message": "message_client", "quote.message": "message_client", "radar.message": "message_client", "sous-traitance.client": "message_client", "site.accord": "message_client",
  "radar.offre": "chantier_zone", "radar.rdv_confirme": "message_client",
  "paiement.recu": "paiement",
  "contact.vigilance": "document_expire", "document.expire": "document_expire",
  "resume.semaine": "resume_semaine"
};
export function evenementDe(type = "") {
  return TYPES[type] || "";
}

// Silence : après 20 h et avant 8 h (heure de Paris), et le dimanche.
export function enSilence(iso = new Date().toISOString()) {
  const d = new Date(iso);
  const f = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "short", hour: "2-digit", hour12: false }).formatToParts(d);
  const heure = Number(f.find((x) => x.type === "hour")?.value) % 24;
  const jourSem = f.find((x) => x.type === "weekday")?.value || "";
  return jourSem.startsWith("dim") || heure >= 20 || heure < 8;
}

// Que faire d'une notification pour l'e-mail : "envoyer", "differer" ou "".
export function decisionEmail(prefs, type, iso = new Date().toISOString()) {
  const evt = evenementDe(type);
  if (!evt) return "";
  const p = normaliserPrefs(prefs);
  if (!p.evenements[evt].email) return "";
  return p.silence && enSilence(iso) ? "differer" : "envoyer";
}

// --- Langues (PRO-15.1) ----------------------------------------------------
export const LANGUES = [
  { id: "fr", nom: "Français", fr: "par défaut", dictee: "fr-FR" },
  { id: "pt", nom: "Português", fr: "portugais", dictee: "pt-PT" },
  { id: "ar", nom: "العربية", fr: "arabe", dictee: "ar", rtl: true },
  { id: "tr", nom: "Türkçe", fr: "turc", dictee: "tr-TR" },
  { id: "ro", nom: "Română", fr: "roumain", dictee: "ro-RO" },
  { id: "pl", nom: "Polski", fr: "polonais", dictee: "pl-PL" },
  { id: "ta", nom: "தமிழ்", fr: "tamoul", dictee: "ta-IN" },
  { id: "zh", nom: "中文", fr: "chinois", dictee: "zh-CN" },
  { id: "en", nom: "English", fr: "anglais", dictee: "en-GB", autre: true },
  { id: "es", nom: "Español", fr: "espagnol", dictee: "es-ES", autre: true },
  { id: "it", nom: "Italiano", fr: "italien", dictee: "it-IT", autre: true },
  { id: "de", nom: "Deutsch", fr: "allemand", dictee: "de-DE", autre: true }
];
export function langueDe(id) {
  return LANGUES.find((l) => l.id === id) || LANGUES[0];
}
export function reglagesLangue(r = {}) {
  const langue = langueDe(r.langue).id;
  return {
    langue,
    entrant: r.entrant !== false,
    sortant: r.sortant !== false,
    apercu: r.apercu !== false,
    original: r.original === true,
    chiffres: r.chiffres === "indiens" ? "indiens" : "latins"
  };
}
// La traduction ne sert que si la langue n'est pas le français.
export function traductionActive(r = {}) {
  return reglagesLangue(r).langue !== "fr";
}
// Montants, dates et quantités ne sont jamais traduits : repérés pour être recopiés tels quels.
export function fragmentsFiges(texte = "") {
  return String(texte).match(/\d[\d\s  .,:/×x-]*\d(?:\s?(?:€|%|m²|m2|m|cm|mm|h|kg|j))?|\d(?:\s?(?:€|%|m²|m2|h))?/g) || [];
}
export function chiffresConserves(original = "", traduit = "") {
  const nb = (t) => (String(t).match(/\d+(?:[.,]\d+)?/g) || []).map((x) => x.replace(",", ".")).sort();
  return JSON.stringify(nb(original)) === JSON.stringify(nb(traduit));
}

// --- Éléments supprimés (PRO-15.6) ------------------------------------------
export const JOURS_CORBEILLE = 30;
export function joursRestants(supprimeLe, aujourdhui = new Date().toISOString()) {
  const d = Date.parse(supprimeLe);
  if (!Number.isFinite(d)) return JOURS_CORBEILLE;
  return Math.max(0, JOURS_CORBEILLE - Math.floor((Date.parse(aujourdhui) - d) / 86400000));
}

// Prochain numéro de facture affiché dans les réglages.
export function prochainNumero(dernier = "", annee = new Date().getFullYear()) {
  const m = /^(.*?)(\d{4})-(\d+)$/.exec(String(dernier));
  if (!m || Number(m[2]) !== annee) return `FAC-${annee}-0001`;
  return `${m[1]}${m[2]}-${String(Number(m[3]) + 1).padStart(m[3].length, "0")}`;
}
