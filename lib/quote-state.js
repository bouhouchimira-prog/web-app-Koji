export const rooms = [
  { id: "salon", label: "Salon" },
  { id: "cuisine", label: "Cuisine" },
  { id: "chambre", label: "Chambre" },
  { id: "salle_de_bain", label: "Salle de bain" },
  { id: "bureau", label: "Bureau" },
  { id: "exterieur", label: "Extérieur" }
];

export function getDraft() {
  if (typeof window === "undefined") return { rooms: [], tasks: [] };
  try {
    return JSON.parse(window.localStorage.getItem("koji-quote-draft") || "{\"rooms\":[],\"tasks\":[]}");
  } catch {
    return { rooms: [], tasks: [] };
  }
}

export function saveDraft(draft) {
  window.localStorage.setItem("koji-quote-draft", JSON.stringify(draft));
}
