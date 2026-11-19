// Ma progression (maquette PRO-21) : défis de la semaine et sceau Vérifié.
// Le niveau et les points viennent de « Mon parcours » (PRO-26,
// lib/parcours-grade.js), seule source des grades de Koji Pro depuis le
// 19 nov. : les anciens niveaux de PRO-21 (Apprenti → Référent Koji, dont
// « Maître artisan », qualité réglementée) et leur barème sont retirés.
// Seuils des défis : hypothèses à valider (liste Bilal).

const j10 = (v) => String(v || "").slice(0, 10);
const estEnvoye = (q) => Boolean(q.sentAt) || ["Envoye", "Signe"].includes(q.status) || q.signatureStatus === "Signe";

export function lundiDe(jour) {
  const d = new Date(`${j10(jour)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

// Réponse « rapide » : moins de 4 h après la demande.
const heures = (d) => (Date.parse(d.reponduLe) - Date.parse(d.createdAt)) / 3600000;

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
