// Extraction du JSON renvoye par Claude, sans prefill du tour assistant —
// certains modeles (dont claude-sonnet-5) refusent l'astuce classique
// `{ role: "assistant", content: "{" }` ("This model does not support
// assistant message prefill"), donc on ne peut plus compter sur un JSON
// garanti commencer directement par "{". Tolere malgre les instructions du
// system prompt le cas ou le modele entoure quand meme sa reponse de
// balises markdown ```json ... ```.
export function parseAiJson(text) {
  const trimmed = String(text || "").trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}
