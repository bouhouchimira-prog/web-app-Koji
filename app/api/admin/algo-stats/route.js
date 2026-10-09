import { badRequest, ok } from "../../../../lib/http";
import { getAuth } from "../../../../lib/server-auth";
import { resolveAdminUserId } from "../../../../lib/admin-account";
import { readDb } from "../../../../lib/db";

// Vue admin "algorithme vs IA" (9 oct, demande d'Amira) — agrege
// db.assistantAlgoStats (voir lib/assistant-algo-stats.js, alimente par
// app/api/radar-assistant/route.js et app/api/koji-assistant/route.js) en
// pourcentages par etape, pour chaque assistant. Meme garde admin que
// app/api/admin/conversations/route.js.
const STEP_LABELS = {
  intro: "Intro — projet décrit ?",
  metier: "Détection du métier",
  "pieces-detection": "Détection des pièces",
  "cadrage-reponse": "Réponses au cadrage",
  "slots-reponse": "Réponses aux 11 questions fixes",
  navigate: "Ouvrir une page",
  ambiguous: "Mot-clé seul",
  confirmDelete: "Suppression",
  created: "Création",
  updated: "Modification",
  clarify: "Clarification demandée",
  failed: "Échec",
  unsupported: "Non pris en charge",
  devisPageAction: "Action sur le devis ouvert",
  autre: "Autre"
};

function aggregate(entries) {
  const byStep = new Map();
  for (const e of entries) {
    const key = e.step || "autre";
    if (!byStep.has(key)) byStep.set(key, { step: key, label: STEP_LABELS[key] || key, algorithme: 0, ia: 0, ia_resserree: 0 });
    const row = byStep.get(key);
    if (e.category === "algorithme") row.algorithme += 1;
    else if (e.category === "ia_resserree") row.ia_resserree += 1;
    else row.ia += 1;
  }
  return Array.from(byStep.values())
    .map((row) => {
      const total = row.algorithme + row.ia + row.ia_resserree;
      return { ...row, total, algorithmePercent: total ? Math.round((row.algorithme / total) * 100) : 0 };
    })
    .sort((a, b) => b.total - a.total);
}

export async function GET(request) {
  const auth = getAuth(request);
  if (!auth) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const adminUserId = await resolveAdminUserId();
  if (!adminUserId || auth.userId !== adminUserId) return badRequest("Accès réservé à l'administrateur.", 403);

  const url = new URL(request.url);
  const days = Math.max(1, Math.min(90, Number(url.searchParams.get("days")) || 30));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const db = await readDb();
  const all = (db.assistantAlgoStats || []).filter((e) => String(e.createdAt || "") >= since);

  return ok({
    periodDays: days,
    totalEntries: all.length,
    radar: aggregate(all.filter((e) => e.assistant === "radar")),
    koji: aggregate(all.filter((e) => e.assistant === "koji"))
  });
}
