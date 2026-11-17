import { readDb } from "./db";
import { mapQuote } from "./quote-mapping";
import { fixObjectText } from "./text";
import { buildQuotePdf } from "./document-generator";
import { getSupabaseAdmin } from "./supabase.js";
import { avecProfil } from "./document-profil.js";
import { avecLignesApp } from "./devis-app-lignes.js";

// PDF d'un devis fabriqué par le serveur (PRO-25), au gabarit Pro : sert
// quand l'app Koji Pro n'envoie pas son propre PDF, pour que le client
// reçoive le même document que depuis le site. `row` est la ligne
// Supabase du devis (avec ses champs à jour, signature comprise).
export async function pdfDevisServeur(row, { signatureImage = "" } = {}) {
  const db = await readDb();
  await avecProfil(db, row.user_id);
  let quote = fixObjectText(mapQuote(row));
  if (signatureImage) quote = { ...quote, signatureImage };
  quote = await avecLignesApp(getSupabaseAdmin(), quote);
  return buildQuotePdf({ quote, project: null, db });
}
