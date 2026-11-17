// Lignes d'un devis fait dans l'app Koji Pro (PRO-25). L'app range ses
// lignes dans quote_rooms / quote_tasks (pas dans quotes.items comme le
// site) ; ce module les convertit en lignes du générateur de documents,
// avec les mêmes règles que le PDF de l'app (lib/features/quote/services/
// devis_pdf_service.dart) : main-d'œuvre et fournitures en lignes
// séparées, fournitures masquées fondues dans la main-d'œuvre, variante,
// « en attente » et « à votre charge » hors total, commentaires jamais
// imprimés. Le site et l'app produisent ainsi le même document.

const nombre = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const arrondi = (n) => Math.round(n * 100) / 100;

export function lignesDepuisPieces(pieces = []) {
  const items = [];
  const triees = [...pieces].sort((a, b) => nombre(a.room_order) - nombre(b.room_order));
  for (const piece of triees) {
    const room = String(piece.name || "").trim() || "Travaux";
    for (const t of piece.quote_tasks || []) {
      const inputs = t.inputs && typeof t.inputs === "object" ? t.inputs : {};
      const taskId = String(t.task_id || "");
      if (taskId.startsWith("comment_") || inputs.isComment === true) continue;
      const titre = String(t.label || "Prestation").trim();
      const qte = Number(inputs.quantity) > 0 ? nombre(inputs.quantity) : 1;
      const qteFourniture = Number(inputs.fournituresQty) > 0 ? nombre(inputs.fournituresQty) : qte;
      const mo = nombre(t.unit_price_ht);
      const fourniture = nombre(t.total_price_ht);
      const masquees = inputs.hideFournitures === true;
      const unite = String(inputs.unite || "u");
      const type = String(inputs.lineType || "normal");
      const base = { room, unit: unite };
      const hors = type === "variante" ? { variante: true } : type === "attente" ? { horsTotal: true, prefixe: "En attente de votre décision" } : type === "charge" ? { horsTotal: true, prefixe: "Fourniture à votre charge", sansPrix: true } : {};

      if (taskId.startsWith("fourniture_")) {
        items.push({ ...base, ...hors, label: titre, quantity: qteFourniture, totalHt: arrondi(qteFourniture * fourniture) });
        continue;
      }
      const totalFournitures = qteFourniture * fourniture;
      const moVisible = masquees && qte > 0 ? mo + totalFournitures / qte : mo;
      if (moVisible > 0 || (!fourniture && type !== "normal")) {
        items.push({ ...base, ...hors, label: titre, quantity: qte, totalHt: arrondi(qte * moVisible) });
      }
      if (!masquees && fourniture > 0) {
        items.push({ ...base, ...hors, label: `${titre} · fournitures`, quantity: qteFourniture, totalHt: arrondi(totalFournitures) });
      }
    }
  }
  return items;
}

// Complète un devis lu en base : si ses lignes ne sont pas dans `items`,
// les lit dans quote_rooms / quote_tasks (client Supabase fourni).
export async function avecLignesApp(supabase, quote) {
  if (!quote?.id || (Array.isArray(quote.items) && quote.items.length)) return quote;
  try {
    const { data } = await supabase.from("quote_rooms").select("name, room_order, quote_tasks(*)").eq("quote_id", quote.id);
    const items = lignesDepuisPieces(data || []);
    return items.length ? { ...quote, items } : quote;
  } catch {
    return quote;
  }
}
