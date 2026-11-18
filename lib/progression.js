// Ma progression (maquette PRO-21) : niveaux de l'Apprenti au Référent Koji,
// points gagnés par l'usage complet de Koji, défis de la semaine, sceau
// Vérifié. Tout est calculé depuis les données du compte (rien n'est saisi
// à la main). Les niveaux n'achètent aucune place sur le Radar.
// Barèmes et seuils : hypothèses à valider (liste Bilal).

export const POINTS = { devisEnvoye: 20, devisSigne: 30, photoApres: 5, clotureAvecAvis: 100, reponseRapide: 10 };

export const NIVEAUX = [
  { id: "apprenti", label: "Apprenti", points: 0, clotures: 0, debloque: "" },
  { id: "compagnon", label: "Compagnon", points: 500, clotures: 0, debloque: "" },
  { id: "confirme", label: "Artisan confirmé", points: 1500, clotures: 3, debloque: "badge sur la KojiPage, 2 jetons offerts" },
  { id: "maitre", label: "Maître artisan", points: 4000, clotures: 10, debloque: "mise en avant de vos réalisations" },
  { id: "referent", label: "Référent Koji", points: 8000, clotures: 25, debloque: "accès anticipé aux nouveautés, parrainage" }
];

const j10 = (v) => String(v || "").slice(0, 10);
const estEnvoye = (q) => Boolean(q.sentAt) || ["Envoye", "Signe"].includes(q.status) || q.signatureStatus === "Signe";
const estSigne = (q) => q.status === "Signe" || q.signatureStatus === "Signe";

export function lundiDe(jour) {
  const d = new Date(`${j10(jour)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

// Chantiers clôturés (PV signé) qui ont reçu un avis vérifié.
export function cloturesAvecAvis(clotures = [], avis = []) {
  return clotures.filter((c) => c.pv?.signeLe && avis.some((a) => a.projectId === c.projectId && a.verifie)).length;
}

// Réponse « rapide » : moins de 4 h après la demande.
const heures = (d) => (Date.parse(d.reponduLe) - Date.parse(d.createdAt)) / 3600000;

export function calculerPoints({ quotes = [], photos = [], clotures = [], avis = [], demandes = [] } = {}) {
  const detail = {
    devisEnvoyes: quotes.filter(estEnvoye).length,
    devisSignes: quotes.filter(estSigne).length,
    photosApres: photos.filter((p) => p.phase === "apres").length,
    cloturesAvecAvis: cloturesAvecAvis(clotures, avis),
    reponsesRapides: demandes.filter((d) => d.reponduLe && d.createdAt && heures(d) <= 4).length
  };
  const total = detail.devisEnvoyes * POINTS.devisEnvoye + detail.devisSignes * POINTS.devisSigne + detail.photosApres * POINTS.photoApres
    + detail.cloturesAvecAvis * POINTS.clotureAvecAvis + detail.reponsesRapides * POINTS.reponseRapide;
  return { total, detail };
}

export function niveauDe(points, clotures) {
  let n = NIVEAUX[0];
  for (const x of NIVEAUX) if (points >= x.points && clotures >= x.clotures) n = x;
  const i = NIVEAUX.indexOf(n);
  const prochain = NIVEAUX[i + 1] || null;
  let condition = "";
  if (prochain) {
    const manque = [];
    if (points < prochain.points) manque.push(`${new Intl.NumberFormat("fr-FR").format(prochain.points - points).replace(/ | /g, " ")} points`);
    if (clotures < prochain.clotures) manque.push(`${prochain.clotures} chantier${prochain.clotures > 1 ? "s" : ""} clôturé${prochain.clotures > 1 ? "s" : ""} avec avis`);
    condition = manque.join(" et ");
  }
  return { niveau: n, index: i, prochain, condition };
}

// Trois défis, renouvelés le lundi.
export function defisSemaine({ quotes = [], photos = [], demandes = [], aujourdhui = new Date().toISOString() } = {}) {
  const lundi = lundiDe(aujourdhui);
  const devis = quotes.filter((q) => estEnvoye(q) && j10(q.sentAt) >= lundi).length;
  const lots = new Set(photos.filter((p) => p.phase === "apres" && j10(p.takenAt) >= lundi).map((p) => `${p.projectId}|${p.lot || p.taskId || p.id}`)).size;
  const repondues = demandes.filter((d) => d.reponduLe && j10(d.reponduLe) >= lundi);
  const moyenne = repondues.length ? repondues.reduce((s, d) => s + heures(d), 0) / repondues.length : null;
  const hm = (h) => `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, "0")}`.replace(/ h 00$/, " h");
  return {
    lundi,
    defis: [
      { id: "devis", label: "Envoyer 2 devis avec Koji", etat: `${Math.min(devis, 2)} sur 2`, fait: devis >= 2, href: "/devis?new=1&mode=ia" },
      { id: "photos", label: "Ajouter les photos après de 3 lots", etat: `${Math.min(lots, 3)} sur 3`, fait: lots >= 3, href: "/chantiers" },
      { id: "reponse", label: "Répondre aux messages en moins de 4 h", etat: moyenne == null ? "aucune demande cette semaine" : `${hm(moyenne)} en moyenne`, fait: moyenne != null && moyenne <= 4, href: "/kojipage/demandes" }
    ]
  };
}

// Sceau Vérifié tel que la maquette le décrit ; dit exactement ce qui est
// contrôlé (et ce qui ne l'est pas).
export function sceauVerifie({ verifs = {}, avis = [] } = {}) {
  const items = verifs.items || [];
  const ok = (id) => Boolean(items.find((i) => i.id === id)?.ok);
  const avisVerifies = avis.filter((a) => a.verifie).length;
  const criteres = [
    { id: "siret", label: "SIRET renseigné", ok: ok("siret") },
    { id: "decennale", label: items.find((i) => i.id === "decennale")?.label || "Assurance décennale", ok: ok("decennale") },
    { id: "identite", label: "Identité du dirigeant (pas encore contrôlée par Koji)", ok: false },
    { id: "avis", label: `3 avis vérifiés (${avisVerifies} aujourd'hui)`, ok: avisVerifies >= 3 }
  ];
  return { criteres, affiche: Boolean(verifs.sceau), decennaleJusqua: verifs.decennaleJusqua || "" };
}
