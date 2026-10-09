// Mesure "algorithme vs IA" (9 oct, demande d'Amira) — jusqu'ici aucune
// trace ne distinguait les reponses tranchees par du code deterministe
// (mot-cle, clic exact, code F/T...) de celles qui ont necessite un appel
// IA, pour aucun des deux assistants (Radar des Chantiers et koji pro).
// Collection roulante, plafonnee (pas un historique complet) — sert
// uniquement a mesurer un taux global, pas a rejouer une conversation.
// Consultable sur /admin/algo-stats (voir app/api/admin/algo-stats/route.js).
const MAX_ENTRIES = 5000;

export function logAlgoStat(db, { assistant, step, category }) {
  if (!Array.isArray(db.assistantAlgoStats)) db.assistantAlgoStats = [];
  db.assistantAlgoStats.push({
    assistant, // "radar" | "koji"
    step, // court libelle de l'etape, ex: "metier", "cadrage", "slots"
    category, // "algorithme" | "ia"
    createdAt: new Date().toISOString()
  });
  if (db.assistantAlgoStats.length > MAX_ENTRIES) {
    db.assistantAlgoStats = db.assistantAlgoStats.slice(-MAX_ENTRIES);
  }
}
