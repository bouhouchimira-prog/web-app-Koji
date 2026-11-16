// KojiPage (maquettes PRO-13 à 13.5) : vitrine de l'entreprise hébergée
// par Koji. Règles pures, partagées par le site et l'app Koji Pro
// (mobile/lib/features/kojipage/kojipage_logic.dart), testées dans
// tests/unit/kojipage.test.js.

const jourIso = (d) => String(d || "").slice(0, 10);
const ajouterJours = (j, n) => {
  const d = new Date(`${jourIso(j)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const sansAccents = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Couleur du bandeau (Business) : palette fermée, toutes lisibles en texte
// blanc. Elle colore le bandeau de la KojiPage et le filet d'en-tête des
// devis, rien d'autre (décision ABL du 30 oct.).
export const COULEURS = [
  { id: "marine", nom: "Marine Koji", hex: "#0B1530" },
  { id: "graphite", nom: "Graphite", hex: "#1F2328" },
  { id: "ardoise", nom: "Bleu ardoise", hex: "#2D3E56" },
  { id: "petrole", nom: "Bleu pétrole", hex: "#1C4A5A" },
  { id: "sapin", nom: "Vert sapin", hex: "#1F4636" },
  { id: "noyer", nom: "Brun noyer", hex: "#4A3324" },
  { id: "terre", nom: "Terre cuite", hex: "#8A3A22" },
  { id: "bordeaux", nom: "Bordeaux", hex: "#5A1A28" }
];
export function couleurDe(id) {
  return (COULEURS.find((c) => c.id === id) || COULEURS[0]).hex;
}

// Contraste WCAG d'une couleur avec le blanc.
export function contrasteBlanc(hex) {
  const v = String(hex).replace("#", "");
  const c = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return Math.round((1.05 / (l + 0.05)) * 10) / 10;
}

// Sections affichables ; l'ordre est fixe (présentation, réalisations,
// prestations, avis, demande).
export const SECTIONS = [
  { id: "realisations", label: "Réalisations" },
  { id: "prestations", label: "Prestations et prix indicatifs" },
  { id: "avis", label: "Avis" },
  { id: "formulaire", label: "Formulaire de demande" },
  { id: "horaires", label: "Horaires et délai de réponse" }
];
export function sectionsDe(site = {}) {
  const s = site.sections || {};
  return Object.fromEntries(SECTIONS.map((x) => [x.id, s[x.id] !== false]));
}

// Ce que l'offre donne (page Tarifs) : Start = KojiPage essentielle (5 photos,
// sans avis ni demandes directes ni carte de visite) ; Pro = complète ;
// Business = complète + couleur du bandeau. L'ancienne option « Site web
// Koji » vaut une KojiPage complète.
export function offreKojiPage({ plan = "", isAdmin = false, addonWebsite = false } = {}) {
  const p = String(plan).toLowerCase();
  const business = isAdmin || p === "business";
  const complete = business || ["pro", "premium", "active", "subscribed"].includes(p) || addonWebsite;
  return {
    niveau: business ? "business" : complete ? "complete" : "essentielle",
    maxPhotos: complete ? 400 : 5,
    avantApres: complete,
    avis: complete,
    demandes: complete,
    carte: complete,
    couleur: business
  };
}

// Réalisations : statut publiée, accord du client demandé, brouillon. Une
// réalisation d'avant la refonte (sans statut) est publiée.
export const STATUTS_REALISATION = { publiee: "Publiée", accord_demande: "Accord client demandé", brouillon: "Brouillon" };
export function statutRealisation(r = {}) {
  if (r.statut && STATUTS_REALISATION[r.statut]) return r.statut;
  return "publiee";
}
export function photosRealisation(r = {}) {
  const avant = Array.isArray(r.avant) ? r.avant : [];
  const apres = Array.isArray(r.apres) ? r.apres : [];
  if (avant.length || apres.length) return { avant, apres, toutes: [...avant, ...apres] };
  const anciennes = Array.isArray(r.photos) ? r.photos : [];
  return { avant: anciennes.slice(0, 1), apres: anciennes.slice(1), toutes: anciennes };
}
export function realisationPubliable(r = {}) {
  const p = photosRealisation(r);
  if (!String(r.name || "").trim()) return "Donnez un titre à la réalisation.";
  if (!p.apres.length) return "Ajoutez au moins une photo après.";
  return "";
}
export function compteRealisations(realisations = []) {
  const c = { toutes: realisations.length, publiee: 0, accord_demande: 0, brouillon: 0 };
  for (const r of realisations) c[statutRealisation(r)] += 1;
  return c;
}

// Lieu affiché : ville ou arrondissement, jamais l'adresse.
export function lieuArrondi({ ville = "", codePostal = "" } = {}) {
  const cp = String(codePostal || "").trim();
  const v = String(ville || "").trim().replace(/\s+\d+(e|er|ème)?$/i, "");
  const arr = (debut, nom) => {
    if (!cp.startsWith(debut)) return "";
    const n = Number(cp.slice(3));
    return n >= 1 && n <= 20 ? `${nom} ${n}${n === 1 ? "er" : "e"}` : "";
  };
  return arr("750", "Paris") || arr("6900", "Lyon") || arr("130", "Marseille") || v;
}

// Prestations : nom, détail, délai, prix « à partir de » (TTC), au m² ou sur
// devis.
export const TYPES_PRIX = { a_partir: "à partir de", m2: "au m²", devis: "sur devis" };
export function normaliserPrestation(p = {}, i = 0) {
  const type = TYPES_PRIX[p.prixType] ? p.prixType : "a_partir";
  const prix = Math.max(0, Math.round(Number(p.prix) || 0));
  return {
    id: String(p.id || `pr-${Date.now()}-${i}`).slice(0, 60),
    nom: String(p.nom || "").trim().slice(0, 80),
    detail: String(p.detail || "").trim().slice(0, 140),
    delai: String(p.delai || "").trim().slice(0, 40),
    prixType: type,
    prix: type === "devis" ? 0 : prix
  };
}
const fmt = (n) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n)).replace(/ /g, " ");
export function libellePrix(p = {}) {
  if (p.prixType === "devis" || !p.prix) return "sur devis";
  if (p.prixType === "m2") return `à partir de ${fmt(p.prix)} € TTC / m²`;
  return `à partir de ${fmt(p.prix)} € TTC`;
}

const MOTS_VIDES = new Set(["renovation", "remplacement", "pose", "travaux", "piece", "creation", "installation", "mise", "complete", "complet", "dune", "avec", "pour", "sans", "des", "les", "une"]);
export function motsCles(nom = "") {
  return [...new Set(sansAccents(nom).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((m) => m.length >= 4 && !MOTS_VIDES.has(m)))];
}
function correspond(texte, mots) {
  if (!mots.length) return false;
  const t = sansAccents(texte);
  const trouves = mots.filter((m) => t.includes(m)).length;
  return trouves >= Math.min(2, mots.length);
}

// Ventes réelles d'une prestation : devis signés des 12 derniers mois dont
// le titre ou une ligne correspond. Prestation au m² : prix unitaires TTC
// des lignes au m² qui correspondent.
// devis : [{ titre, signeLe, ttc, lignes: [{ texte, unite, puTtc }] }]
export function ventesPrestation(prestation = {}, devis = [], aujourdhui = new Date().toISOString()) {
  const mots = motsCles(prestation.nom);
  const depuis = ajouterJours(aujourdhui, -365);
  const recents = devis.filter((d) => jourIso(d.signeLe) >= depuis);
  if (prestation.prixType === "m2") {
    const prix = [];
    for (const d of recents) {
      for (const l of d.lignes || []) {
        if (/m2|m²/i.test(String(l.unite || "")) && Number(l.puTtc) > 0 && correspond(`${l.texte} ${d.titre}`, mots)) prix.push(Number(l.puTtc));
      }
    }
    return prix;
  }
  return recents.filter((d) => Number(d.ttc) > 0 && (correspond(d.titre, mots) || (d.lignes || []).some((l) => correspond(l.texte, mots)))).map((d) => Number(d.ttc));
}

// Contrôle Koji : un prix « à partir de » doit correspondre à des ventes
// réelles. « À revoir » quand il est plus bas de plus de 10 % que la vente
// la moins chère.
export function controlePrix(prestation = {}, ventes = []) {
  const n = ventes.length;
  const min = n ? Math.min(...ventes) : 0;
  const max = n ? Math.max(...ventes) : 0;
  const base = { n, min, max };
  if (prestation.prixType === "devis" || !prestation.prix) return { ...base, etat: "prix_a_ajouter", label: "Prix à ajouter" };
  if (!n) return { ...base, etat: "sans_vente", label: "Pas encore de devis signé" };
  if (prestation.prix < min * 0.9) {
    const unite = prestation.prixType === "m2" ? " / m²" : "";
    return {
      ...base, etat: "a_revoir", label: "À revoir",
      message: `${prestation.nom} : ${fmt(prestation.prix)} €${unite} affiché, vos ${n} devis signé${n > 1 ? "s" : ""} commence${n > 1 ? "nt" : ""} à ${fmt(min)} €${unite}. Un prix « à partir de » doit correspondre à des prestations réellement vendues à ce prix.`
    };
  }
  return { ...base, etat: "coherent", label: "cohérent" };
}
export function fourchetteVentes(c = {}, prixType = "a_partir") {
  if (!c.n) return "";
  const unite = prixType === "m2" ? " / m²" : "";
  return c.min === c.max ? `${fmt(c.min)} €${unite}` : `${fmt(c.min)} à ${fmt(c.max)} €${unite}`;
}

// Jauge « page complète » et prochaine action.
export function completude(site = {}, { avantApres = true } = {}) {
  const real = (site.realisations || []).filter((r) => statutRealisation(r) === "publiee");
  const avecPaire = real.filter((r) => { const p = photosRealisation(r); return avantApres ? p.avant.length && p.apres.length : p.toutes.length; });
  const prestations = site.prestations || [];
  const prixOk = prestations.filter((p) => p.prixType !== "devis" && p.prix > 0).length;
  const items = [
    { id: "photo", label: "Photo de l'entrepreneur", fait: Boolean(site.contactPhotoDataUrl), action: "Ajouter votre photo" },
    { id: "presentation", label: "Présentation", fait: Boolean(String(site.presentationText || "").trim()), action: "Écrire la présentation" },
    { id: "realisations", label: avecPaire.length ? `${avecPaire.length} réalisation${avecPaire.length > 1 ? "s" : ""} avec photos${avantApres ? " avant et après" : ""}` : "Une réalisation avec photos", fait: avecPaire.length > 0, action: "Ajouter une réalisation" },
    { id: "zone", label: "Zone d'intervention", fait: Boolean(String(site.zoneIntervention || "").trim()), action: "Indiquer votre zone" },
    { id: "prix", label: prestations.length ? `Prix indicatifs : ${prixOk} prestation${prixOk > 1 ? "s" : ""} sur ${prestations.length}` : "Prix indicatifs", fait: prestations.length > 0 && prixOk === prestations.length, action: "Ajouter le prix" },
    { id: "horaires", label: "Horaires et délai de réponse affichés", fait: Boolean(String(site.horaires || "").trim()), action: "Renseigner" }
  ];
  const faits = items.filter((i) => i.fait).length;
  const manque = items.find((i) => !i.fait);
  let prochaine = "";
  if (manque?.id === "prix") {
    const p = prestations.find((x) => x.prixType === "devis" || !x.prix);
    prochaine = p ? `ajouter le prix de « ${p.nom} »` : "ajouter vos prestations et leur prix";
  } else if (manque) prochaine = manque.action.charAt(0).toLowerCase() + manque.action.slice(1);
  return { pct: Math.round((faits / items.length) * 100), items, prochaine };
}

// Contenu publié en une fois : ce qui diffère entre le brouillon et la
// version en ligne.
export const CHAMPS_PUBLIES = ["title", "tagline", "presentationText", "contactPhotoDataUrl", "contactName", "companyDescription", "zoneIntervention", "horaires", "specialties", "contactPhone", "contactEmail", "contactAddress", "realisations", "prestations", "sections", "couleur", "showContactForm"];
export function contenuPublie(site = {}) {
  return Object.fromEntries(CHAMPS_PUBLIES.map((k) => [k, site[k] ?? null]));
}
export function modificationsNonPubliees(site = {}) {
  if (!site.publie) return site.published ? 0 : null;
  const brouillon = contenuPublie(site);
  return CHAMPS_PUBLIES.filter((k) => JSON.stringify(brouillon[k] ?? null) !== JSON.stringify(site.publie[k] ?? null)).length;
}

// Visites : total des 30 derniers jours et évolution sur les 30 d'avant.
export function statsVisites(visites = {}, aujourdhui = new Date().toISOString()) {
  const j = jourIso(aujourdhui);
  const debut = ajouterJours(j, -29);
  const avant = ajouterJours(j, -59);
  let total = 0;
  let precedent = 0;
  for (const [jour, n] of Object.entries(visites || {})) {
    if (jour >= debut && jour <= j) total += Number(n) || 0;
    else if (jour >= avant && jour < debut) precedent += Number(n) || 0;
  }
  const evolution = precedent ? Math.round(((total - precedent) / precedent) * 100) : null;
  return { total, precedent, evolution };
}

// Demandes reçues par la KojiPage.
export const ETATS_DEMANDE = { a_repondre: "À répondre", repondue: "Répondue", devis_envoye: "Devis envoyé", declinee: "Déclinée" };
export function etatDemande(d = {}) {
  if (d.declineeLe) return "declinee";
  if (d.devisEnvoye) return "devis_envoye";
  if (d.reponduLe) return "repondue";
  return "a_repondre";
}
export const MOTIFS_DECLIN = { hors_metier: "hors métiers", hors_zone: "hors zone", indisponible: "pas disponible" };
export function sourceDemande(source) {
  if (source === "carte") return "via votre carte de visite";
  if (source === "assistant") return "décrite avec l'assistant Koji";
  return "via votre KojiPage";
}
export function delaiTexte(heures) {
  if (heures == null) return "";
  if (heures < 1) return "moins d'1 h";
  if (heures < 48) return `${Math.round(heures)} h`;
  return `${Math.round(heures / 24)} j`;
}
export function delaiReponseMoyen(demandes = [], aujourdhui = new Date().toISOString()) {
  const debut = ajouterJours(aujourdhui, -29);
  const d = demandes.filter((x) => x.reponduLe && jourIso(x.createdAt) >= debut);
  if (!d.length) return null;
  const h = d.reduce((s, x) => s + Math.max(0, Date.parse(x.reponduLe) - Date.parse(x.createdAt)) / 3600000, 0) / d.length;
  return Math.round(h * 10) / 10;
}
export function compteDemandes(demandes = [], aujourdhui = new Date().toISOString()) {
  const debut = ajouterJours(aujourdhui, -29);
  const recentes = demandes.filter((x) => jourIso(x.createdAt) >= debut);
  return { mois: recentes.length, nouvelles: demandes.filter((x) => etatDemande(x) === "a_repondre").length };
}

// Coordonnées complètes du client seulement après la première réponse.
export function clientAffiche(d = {}) {
  const nom = String(d.name || "").trim();
  if (d.reponduLe || d.declineeLe) return { nom, telephone: d.phone || "", email: d.email || "", masque: false };
  const mots = nom.split(/\s+/).filter(Boolean);
  const court = mots.length > 1 ? `${mots[0]} ${mots[mots.length - 1][0].toUpperCase()}.` : nom;
  return { nom: court, telephone: "", email: "", masque: true };
}

// Budget côté entreprise : « compatible » sans montant quand il couvre le
// prix à vos prix ; montant et écart sinon.
export function budgetCompatibilite(budget, ttc) {
  const b = Number(budget) || 0;
  const t = Number(ttc) || 0;
  if (!b || !t) return null;
  if (b >= t) return { compatible: true, texte: "budget compatible" };
  const ecart = Math.round((t - b) / 10) * 10;
  return { compatible: false, budget: b, ecart, texte: `budget ${fmt(b)} €, ${fmt(ecart)} € sous votre prix` };
}

// Projet décrit avec l'assistant (PRO-13.5, sans prix côté client) : texte
// lisible pour l'entreprise et pour Koji.
export const PIECES = ["Salle de bain", "Cuisine", "Séjour", "Chambre", "Plusieurs pièces", "Autre"];
export const TRAVAUX_PAR_PIECE = {
  "Salle de bain": ["Tout refaire", "Douche à la place de la baignoire", "Changer le carrelage", "Nouveau meuble vasque", "Changer les WC"],
  Cuisine: ["Tout refaire", "Poser une cuisine", "Changer le plan de travail", "Carrelage ou crédence", "Électricité et éclairage"],
  Séjour: ["Peinture murs et plafonds", "Sol", "Abattre ou créer une cloison", "Électricité", "Faux plafond"],
  Chambre: ["Peinture murs et plafonds", "Sol", "Placard ou dressing", "Électricité"],
  "Plusieurs pièces": ["Rénovation complète", "Peinture", "Sols", "Électricité", "Plomberie"],
  Autre: ["Réparation", "Petits travaux", "Autre"]
};
export const ACCES = ["Rez-de-chaussée ou maison", "Étage avec ascenseur", "Étage sans ascenseur"];
export const QUAND = ["Dès que possible", "Dans 1 à 3 mois", "Dans plus de 3 mois", "Je ne sais pas"];
export const BUDGETS = ["Moins de 5 000 €", "5 000 à 8 000 €", "8 000 à 12 000 €", "Plus de 12 000 €", "Je ne sais pas"];
export function budgetDepuisChoix(choix = "") {
  const t = String(choix);
  if (/moins de 5/i.test(t)) return 5000;
  if (/5 000 à 8/i.test(t)) return 8000;
  if (/8 000 à 12/i.test(t)) return 12000;
  const n = Number(t.replace(/[^\d]/g, ""));
  return n >= 100 ? n : 0;
}
export function texteProjet(p = {}) {
  return [
    p.piece ? `Pièce : ${p.piece}${p.surface ? ` · ${p.surface} m²` : ""}` : "",
    (p.travaux || []).length ? `Travaux : ${p.travaux.join(", ")}` : "",
    p.precisions ? `Précisions : ${p.precisions}` : "",
    p.acces ? `Accès : ${p.acces}` : "",
    p.quand ? `Quand : ${p.quand}` : ""
  ].filter(Boolean).join("\n");
}
export function etapesAssistant(p = {}) {
  const etapes = [Boolean(p.piece), Boolean(p.surface), (p.travaux || []).length > 0, Boolean(p.budgetChoix), Boolean(p.photosVues), Boolean(p.acces && p.quand)];
  return { faite: etapes.filter(Boolean).length, total: etapes.length };
}

// Vérifications lues dans le profil : SIRET, décennale, RC pro. L'identité
// du dirigeant n'est pas contrôlée par Koji. Le sceau suppose un SIRET
// renseigné et une décennale en cours de validité.
export function verifications(business = {}, aujourdhui = new Date().toISOString()) {
  const j = jourIso(aujourdhui);
  const docs = business.documents || {};
  const dec = docs.decennale || {};
  const decJusqua = jourIso(dec.expiryDate || business.decennaleUntil || "");
  const decOk = Boolean((dec.fileDataUrl || business.decennaleInsurer) && (!decJusqua || decJusqua >= j));
  const rc = docs.rcpro || docs.rc || {};
  const rcJusqua = jourIso(rc.expiryDate || "");
  const siretOk = /^\d{14}$/.test(String(business.siret || "").replace(/\s/g, ""));
  const dateFr = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "");
  const items = [
    { id: "siret", ok: siretOk, label: siretOk ? `SIRET renseigné${business.formeJuridique || business.city ? ` · ${[business.formeJuridique, business.city].filter(Boolean).join(", ")}` : ""}` : "SIRET à renseigner" },
    { id: "decennale", ok: decOk, label: decOk ? `Assurance décennale${decJusqua ? ` valable jusqu'au ${dateFr(decJusqua)}` : " renseignée"}` : decJusqua && decJusqua < j ? "Assurance décennale expirée" : "Assurance décennale à ajouter" },
    { id: "rcpro", ok: Boolean(rc.fileDataUrl && (!rcJusqua || rcJusqua >= j)), label: rc.fileDataUrl ? `RC professionnelle${rcJusqua ? ` valable jusqu'au ${dateFr(rcJusqua)}` : ""}` : "RC professionnelle à ajouter" },
    { id: "identite", ok: false, label: "Identité du dirigeant non contrôlée par Koji" }
  ];
  return { items, sceau: siretOk && decOk, decennaleJusqua: decJusqua };
}

// Fiche contact (.vcf) de la carte de visite.
export function vcard({ nom = "", personne = "", fonction = "", telephone = "", email = "", url = "", adresse = "" } = {}) {
  const esc = (s) => String(s || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, " ");
  return [
    "BEGIN:VCARD", "VERSION:3.0",
    `FN:${esc(personne || nom)}`,
    `ORG:${esc(nom)}`,
    fonction ? `TITLE:${esc(fonction)}` : "",
    telephone ? `TEL;TYPE=WORK,VOICE:${esc(telephone)}` : "",
    email ? `EMAIL;TYPE=WORK:${esc(email)}` : "",
    url ? `URL:${esc(url)}` : "",
    adresse ? `ADR;TYPE=WORK:;;${esc(adresse)};;;;` : "",
    "END:VCARD"
  ].filter(Boolean).join("\r\n");
}
export function texteCarte({ nom = "", personne = "", url = "" } = {}) {
  return `${personne ? `${personne}, ` : ""}${nom} : nos réalisations, nos avis et votre demande de devis sur ${url}`;
}

// Adresse de la page : modifiable une fois par an, l'ancienne redirige.
export function slugModifiable(site = {}, aujourdhui = new Date().toISOString()) {
  const dernier = jourIso(site.slugModifieLe || "");
  if (!dernier) return { ok: true, apres: "" };
  const apres = ajouterJours(dernier, 365);
  return { ok: jourIso(aujourdhui) >= apres, apres };
}
