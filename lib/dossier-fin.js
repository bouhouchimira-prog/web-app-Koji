// Dossier de fin de chantier (maquette PRO-02.5) : Koji assemble le PV,
// les photos avant / après choisies, les factures, l'attestation décennale,
// les notices, des conseils d'entretien tirés des lignes du devis et les
// garanties datées ; il signale ce qui manque (schéma des réseaux…). Mêmes
// règles dans l'app Koji Pro (mobile/lib/apps/entreprise/chantiers/
// dossier_fin.dart).

import { dateCourte, jourDeParis } from "./cloture-chantier.js";

// Conseils d'entretien génériques, choisis d'après les mots des lignes du
// devis. Les garanties fabricant restent celles des notices : Koji n'en
// invente jamais.
export const CONSEILS = [
  { id: "robinetterie", motif: /mitigeur|robinet|thermostatique|colonne de douche/i, titre: "Robinetterie", texte: "Détartrer les aérateurs (embouts) tous les six mois au vinaigre blanc ; ne pas forcer sur les manettes." },
  { id: "joints", motif: /silicone|joint/i, titre: "Joints", texte: "Nettoyer sans produit abrasif ; refaire les joints silicone dès qu'ils noircissent ou se décollent." },
  { id: "carrelage", motif: /carrelage|fa[iï]ence|carreaux/i, titre: "Carrelage et faïence", texte: "Nettoyer avec un produit au pH neutre ; éviter l'acide et la javel pure sur les joints." },
  { id: "douche", motif: /douche|receveur|paroi|baignoire/i, titre: "Douche et baignoire", texte: "Essuyer la paroi après usage limite le calcaire ; nettoyer la bonde et le siphon chaque mois." },
  { id: "wc", motif: /\bwc\b|toilette|b[âa]ti[- ]support|cuvette/i, titre: "WC", texte: "Détartrer la cuvette régulièrement ; ne jeter ni lingettes ni cotons ; la trappe du bâti-support donne accès au mécanisme." },
  { id: "ventilation", motif: /vmc|extracteur|ventilation|a[ée]ration/i, titre: "Ventilation", texte: "Nettoyer les bouches d'extraction tous les trois mois ; ne jamais les obstruer." },
  { id: "chauffe-eau", motif: /chauffe[- ]eau|ballon|cumulus/i, titre: "Chauffe-eau", texte: "Manœuvrer le groupe de sécurité une fois par mois ; faire contrôler l'appareil selon sa notice." },
  { id: "chauffage", motif: /radiateur|s[èe]che[- ]serviette|chauffage|plancher chauffant/i, titre: "Chauffage", texte: "Purger les radiateurs à eau en début de saison ; dépoussiérer les appareils électriques." },
  { id: "electricite", motif: /[ée]lectri|prise|interrupteur|spot|luminaire|tableau|disjoncteur|circuit/i, titre: "Électricité", texte: "Appuyer chaque mois sur le bouton « test » des interrupteurs différentiels ; couper le circuit avant de changer une ampoule." },
  { id: "peinture", motif: /peinture|enduit|lessiv/i, titre: "Peintures", texte: "Attendre trois semaines avant de lessiver ; utiliser une éponge douce et de l'eau savonneuse." },
  { id: "sol", motif: /parquet|stratifi|vinyle|sol souple/i, titre: "Sols", texte: "Nettoyer à la serpillière bien essorée ; poser des patins sous les meubles." },
  { id: "menuiserie", motif: /menuiserie|fen[êe]tre|porte|volet/i, titre: "Menuiseries", texte: "Graisser les paumelles une fois par an ; dégager les rails et les trous d'évacuation d'eau." }
];

export function conseilsEntretien(items = []) {
  const libelles = items.map((l) => `${l.label || ""} ${l.description || ""}`);
  return CONSEILS
    .map((c) => ({ ...c, lignes: items.filter((_, i) => c.motif.test(libelles[i])).map((l) => l.label).filter(Boolean) }))
    .filter((c) => c.lignes.length)
    .map(({ motif, ...c }) => c);
}

const PHASES_DOSSIER = new Set(["avant", "apres"]);

// Photos choisies : par lot, la première « avant » et la dernière « après »
// (quatre lots au plus) ; la couverture est la dernière « après ».
export function photosChoisies(photos = [], maxLots = 4) {
  const parDate = [...photos].filter((p) => PHASES_DOSSIER.has(p.phase) && p.lot).sort((a, b) => String(a.takenAt || "").localeCompare(String(b.takenAt || "")));
  const lots = [];
  for (const p of parDate) if (!lots.includes(p.lot)) lots.push(p.lot);
  const paires = lots
    .map((lot) => ({
      lot,
      avant: parDate.find((p) => p.lot === lot && p.phase === "avant") || null,
      apres: parDate.filter((p) => p.lot === lot && p.phase === "apres").at(-1) || null
    }))
    .filter((p) => p.avant || p.apres)
    .slice(0, maxLots);
  const couverture = parDate.filter((p) => p.phase === "apres").at(-1) || null;
  return { paires, couverture, nombre: paires.reduce((n, p) => n + (p.avant ? 1 : 0) + (p.apres ? 1 : 0), 0) };
}

const COURT_FACTURE = { "Acompte initial": "acompte", "Facture intermédiaire": "situation", "Facture finale": "solde" };

export function decennaleAJour(decennale, aujourdhui) {
  return Boolean(decennale?.insurer && decennale?.until && String(decennale.until).slice(0, 10) >= aujourdhui);
}

// Les huit éléments du dossier (ordinateur, maquette PRO-02.5).
export function elementsDossier({ pv = null, photos = [], factures = [], factureSolde = null, decennale = null, pieces = [], conseils = [], aujourdhui = new Date().toISOString().slice(0, 10) }) {
  const choix = photosChoisies(photos);
  const notices = pieces.filter((p) => p.kind === "notice");
  const plans = pieces.filter((p) => p.kind === "plan");
  const types = [...new Set(factures.filter((f) => Number(f.amountTtc) > 0).map((f) => COURT_FACTURE[f.type] || "facture"))];
  const decOk = decennaleAJour(decennale, aujourdhui);
  return [
    pv?.signeLe
      ? { id: "pv", titre: "Procès-verbal de réception", detail: `${pv.numero} · signé le ${dateCourte(jourDeParis(pv.signeLe))}`, ok: true, action: { id: "voir_pv", label: "Voir" } }
      : { id: "pv", titre: "Procès-verbal de réception", detail: "à faire signer sur place, à la réception", ok: false, action: { id: "signer_pv", label: "Faire signer" } },
    choix.nombre
      ? { id: "photos", titre: "Photos avant / après", detail: `${choix.nombre} photo${choix.nombre > 1 ? "s" : ""} choisie${choix.nombre > 1 ? "s" : ""} sur ${photos.length} · horodatées`, ok: Boolean(choix.couverture), action: { id: "photos", label: "Voir" } }
      : { id: "photos", titre: "Photos avant / après", detail: "aucune photo avant / après prise dans l'app", ok: false, action: { id: "photos", label: "Voir" } },
    { id: "factures", titre: "Factures", detail: factureSolde ? [...types.filter((t) => t !== "solde"), `solde ${factureSolde.invoiceNumber || ""}`.trim()].join(", ") : types.length ? `${types.join(", ")} · solde à émettre` : "aucune facture", ok: Boolean(factureSolde), action: { id: "factures", label: "Voir" } },
    decennale?.insurer
      ? { id: "decennale", titre: "Attestation décennale", detail: `${decennale.insurer}${decennale.until ? ` · jusqu'au ${dateCourte(decennale.until, true)}` : ""} · reprise du profil${decOk ? "" : " · à mettre à jour"}`, ok: decOk, action: { id: "profil", label: decOk ? "Voir" : "Mettre à jour" } }
      : { id: "decennale", titre: "Attestation décennale", detail: "assureur et date de fin à renseigner dans votre profil", ok: false, action: { id: "profil", label: "Compléter" } },
    notices.length
      ? { id: "notices", titre: "Notices des équipements", detail: `${notices.map((n) => n.titre).join(", ")} · ${notices.length} fichier${notices.length > 1 ? "s" : ""}`, ok: true, action: { id: "notice", label: "Ajouter" } }
      : { id: "notices", titre: "Notices des équipements", detail: "PDF des fabricants (mitigeur, WC, appareils…) · à ajouter", ok: false, action: { id: "notice", label: "Ajouter" } },
    conseils.length
      ? { id: "conseils", titre: "Conseils d'entretien", detail: "rédigés par Koji d'après les lignes du devis", ok: true, action: { id: "conseils", label: "Voir" } }
      : { id: "conseils", titre: "Conseils d'entretien", detail: "aucune ligne du devis ne demande d'entretien particulier", ok: true, action: null },
    plans.length
      ? { id: "plan", titre: "Schéma des réseaux", detail: `${plans.map((p) => p.titre).join(", ")}`, ok: true, action: { id: "plan", label: "Ajouter" } }
      : { id: "plan", titre: "Schéma des réseaux", detail: "arrivées, évacuations, circuit · à ajouter", ok: false, action: { id: "plan", label: "Ajouter" } },
    { id: "garanties", titre: "Garanties et contact", detail: pv?.signeLe ? "dates calculées depuis la réception" : "datées à la signature du PV", ok: Boolean(pv?.signeLe), action: null }
  ];
}

export function resumeDossier(elements) {
  const prets = elements.filter((e) => e.ok).length;
  return `préparé par Koji · ${prets} sur ${elements.length} prêt${prets > 1 ? "s" : ""}`;
}
