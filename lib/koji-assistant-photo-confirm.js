// Confirmation d'un type detecte depuis une photo (15 septembre) — ex: une
// photo de ticket de caisse/facture recue envoyee sans texte. Contrairement
// a une instruction textuelle explicite ("cree une depense de 340€..."), une
// classification issue d'une image reste une supposition — on demande donc
// une confirmation explicite avant de creer quoi que ce soit, exception
// deliberee a la regle habituelle "creation immediate" de l'assistant.
// Reutilise entierement handleCreate (app/api/koji-assistant/route.js) pour
// la resolution de reference (ex: chantierHint) et la creation elle-meme —
// aucune logique dupliquee ici, juste un petit etat a 2 tours (confirmer,
// puis la reference manquante si besoin) transporte via conversation.state,
// meme mecanisme que lib/koji-assistant-devis-flow.js.

function describeDetectedFields(type, fields) {
  if (type === "depense" && fields.amount) {
    return `${fields.amount}€${fields.label ? ` chez ${fields.label}` : ""}`;
  }
  return "";
}

export function startConfirmTypeFlow(type, fields, tool, originalMessage) {
  const detail = describeDetectedFields(type, fields);
  return {
    outcome: "clarify",
    question: `J'ai détecté ${detail ? `une ${tool.label.toLowerCase()} (${detail})` : `un(e) ${tool.label.toLowerCase()}`} sur la photo — c'est correct ?`,
    quickReplies: ["Oui", "Non, autre chose"],
    state: { flow: "confirmType", step: "confirm", type, fields },
    originalMessage
  };
}

export async function advanceConfirmTypeFlow(ctx, state, answer, originalMessage, tool, handleCreateFn) {
  if (state.step === "confirm") {
    if (!/^oui/i.test(String(answer || "").trim())) {
      return { outcome: "unsupported", message: "D'accord — dites-moi plutôt ce que vous voulez faire.", quickReplies: [] };
    }
    return runStep(ctx, tool, state, state.fields, originalMessage, false, handleCreateFn);
  }

  if (state.step === "chantier") {
    const fields = { ...state.fields };
    if (tool.reference?.hintField) fields[tool.reference.hintField] = answer;
    return runStep(ctx, tool, state, fields, originalMessage, true, handleCreateFn);
  }

  return { outcome: "failed", message: "Une erreur est survenue." };
}

async function runStep(ctx, tool, state, fields, message, isSecondRound, handleCreateFn) {
  const result = await handleCreateFn({
    ctx,
    tool,
    type: state.type,
    parsed: { fields, needsClarification: false },
    isSecondRound,
    message,
    rawPhotos: []
  });
  // Encore une reference manquante (ex: chantier) apres avoir confirme le
  // type — un seul tour de plus est autorise, comme pour toutes les autres
  // resolutions de reference de l'assistant.
  if (result.outcome === "clarify" && !isSecondRound) {
    return { ...result, state: { ...state, step: "chantier", fields } };
  }
  return result;
}
