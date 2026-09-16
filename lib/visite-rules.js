// Petit moteur de regles (pattern -> ligne/option suggeree), a partir des
// remarques libres saisies pendant la visite. Volontairement minimal (2-3
// regles pour prouver le concept, pas d'exhaustivite) — demande explicite
// d'Amira le 12 septembre. Aucune IA ici : du pattern-matching simple sur
// du texte, deterministe et facile a completer plus tard.
export const VISITE_RULES = [
  {
    id: "infiltration",
    pattern: /infiltration|humidit[ée]/i,
    suggestion: {
      label: "Traitement anti-humidité",
      unit: "u",
      quantity: 1
    }
  },
  {
    id: "fissure",
    pattern: /fissure/i,
    suggestion: {
      label: "Reprise de fissures avant finition",
      unit: "u",
      quantity: 1
    }
  },
  {
    id: "amiante",
    pattern: /amiante/i,
    suggestion: {
      label: "Diagnostic amiante avant travaux",
      unit: "u",
      quantity: 1
    }
  }
];

// Applique les regles a une remarque de piece, retourne les suggestions
// matchees avec l'id de la piece attachee (pour les proposer a l'entreprise
// avant la generation finale du devis).
export function matchVisiteRules(remarque, pieceId, pieceNom) {
  const text = String(remarque || "");
  if (!text.trim()) return [];
  return VISITE_RULES
    .filter((rule) => rule.pattern.test(text))
    .map((rule) => ({
      id: `${rule.id}-${pieceId}`,
      ruleId: rule.id,
      pieceId,
      pieceNom,
      label: rule.suggestion.label,
      unit: rule.suggestion.unit,
      quantity: rule.suggestion.quantity
    }));
}
