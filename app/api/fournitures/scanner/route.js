import Anthropic from "@anthropic-ai/sdk";
import { badRequest, ok } from "../../../../lib/http";
import { readDb } from "../../../../lib/db";
import { resolveEntreprise } from "../../../../lib/entreprise-auth";
import { parsePhoto } from "../../../../lib/ai-photo";
import { achatParUnite, codeInterne, nombre, perteFamille, r2 } from "../../../../lib/fournitures-pro";
import { chargerCatalogue } from "../../../../lib/fournitures-serveur";
import { fixText } from "../../../../lib/text";

// Saisie assistée d'un article (maquette PRO-07.2) : photo de l'étiquette,
// ligne de facture fournisseur ou lien produit → Koji propose les champs.
// Rien n'est enregistré ici : chaque champ reste à valider dans le formulaire.
const OUTIL = {
  name: "article_lu",
  description: "Champs de l'article de fourniture lus sur l'étiquette, la ligne de facture ou la page produit.",
  input_schema: {
    type: "object",
    properties: {
      designation: { type: "string", description: "Désignation claire en français, avec format et teinte (ex. « Grès cérame 60 × 60 rectifié, anthracite »)." },
      reference: { type: "string", description: "Référence fournisseur telle qu'écrite, vide si absente." },
      famille: { type: "string", description: "Famille courte (ex. « Carrelage · grès cérame », « Colles et mortiers », « Plomberie »)." },
      unite_client: { type: "string", enum: ["u", "m²", "ml", "kg", "l", "sac", "seau", "rouleau", "lot", "kit"], description: "Unité de vente au client." },
      conditionnement: { type: "string", description: "Type de conditionnement : boîte, sac, seau, rouleau, couronne, palette, unité." },
      contenance: { type: "number", description: "Quantité d'unité client par conditionnement (1,44 pour une boîte de 1,44 m² ; 1 si vendu à l'unité)." },
      prix_achat_conditionnement: { type: "number", description: "Prix d'achat HT d'un conditionnement lu sur la facture ; 0 si absent." },
      prix_public: { type: "number", description: "Prix public HT par unité client s'il est écrit ; 0 sinon. Ne jamais l'inventer." },
      fournisseur: { type: "string", description: "Nom du fournisseur s'il est visible." },
      rendement_quantite: { type: "number", description: "Quantité du conditionnement pour le rendement (25 pour un sac de 25 kg) ; 0 si non indiqué." },
      rendement_unite: { type: "string", description: "Unité de cette quantité (kg, l)." },
      rendement_couvre_m2: { type: "number", description: "Surface couverte par un conditionnement d'après l'emballage ; 0 si non indiqué." },
      remarque: { type: "string", description: "Ce qui est incertain, en une phrase courte." }
    },
    required: ["designation", "unite_client", "contenance"]
  }
};

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const entreprise = await resolveEntreprise(request, body);
  if (!entreprise) return badRequest("Connexion requise.", 401);
  const photo = body.photo ? parsePhoto(body.photo) : null;
  const texte = fixText(String(body.texte || "")).slice(0, 1500).trim();
  if (!photo && !texte) return badRequest("Ajoutez une photo de l'étiquette ou collez la ligne de facture.");
  if (!process.env.ANTHROPIC_API_KEY) return badRequest("La lecture par Koji n'est pas disponible pour le moment.", 503);

  const content = [];
  if (photo) content.push({ type: "image", source: { type: "base64", media_type: photo.mediaType, data: photo.data } });
  content.push({ type: "text", text: texte ? `Ligne de facture ou lien produit : « ${texte} »` : "Photo de l'étiquette ou de la facture du produit." });

  let lu;
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      thinking: { type: "disabled" },
      system: "Tu lis un article de fourniture du bâtiment pour remplir une fiche. Lis seulement ce qui est écrit ; n'invente ni prix ni référence. Les montants sont HT en euros.",
      tools: [OUTIL],
      tool_choice: { type: "tool", name: OUTIL.name },
      messages: [{ role: "user", content }]
    });
    lu = response.content.find((b) => b.type === "tool_use")?.input || null;
  } catch (error) {
    return badRequest(error?.status === 429 ? "Koji est très demandé, réessayez dans un instant." : "Koji n'a pas pu lire cet article. Remplissez les champs à la main.", 502);
  }
  if (!lu?.designation) return badRequest("Koji n'a pas trouvé d'article sur ce document.", 422);

  const db = await readDb();
  const { articles, fournisseurs } = await chargerCatalogue(entreprise, db).catch(() => ({ articles: [], fournisseurs: [] }));
  const nomF = String(lu.fournisseur || "").toLowerCase();
  const fournisseur = nomF ? fournisseurs.find((f) => f.name.toLowerCase().includes(nomF) || nomF.includes(f.name.toLowerCase())) || null : null;
  const contenance = nombre(lu.contenance, 1) || 1;
  const achatCond = r2(nombre(lu.prix_achat_conditionnement));
  const ref = fixText(String(lu.reference || "")).trim();

  // Prix public : d'abord le tarif importé du fournisseur (même référence).
  let prixPublic = r2(nombre(lu.prix_public));
  let publicSource = prixPublic > 0 ? "lu sur le document" : "";
  if (ref) {
    const tarifs = (db.tarifsFournisseurs || []).filter((t) => t.userId === entreprise.userId);
    for (const t of tarifs) {
      const l = (t.lignes || []).find((x) => String(x.ref).replace(/\s+/g, "").toLowerCase() === ref.replace(/\s+/g, "").toLowerCase());
      if (l && l.public > 0) { prixPublic = l.public; publicSource = `tarif fournisseur du ${t.date}`; break; }
    }
  }

  const famille = fixText(String(lu.famille || "")).trim();
  return ok({
    proposition: {
      name: fixText(lu.designation).trim(),
      ref,
      codeInterne: codeInterne(lu.designation, articles.map((a) => a.codeInterne).filter(Boolean)),
      famille,
      unit: lu.unite_client || "u",
      uniteCond: fixText(String(lu.conditionnement || "")).trim(),
      contenance,
      venteUnite: contenance === 1,
      perte: perteFamille(famille),
      fournisseurs: fournisseur ? [{ supplierId: fournisseur.id, ref, achatCond, achat: achatCond > 0 ? achatParUnite(achatCond, contenance) : 0, prefere: true }] : [],
      fournisseurLu: fournisseur ? "" : fixText(String(lu.fournisseur || "")).trim(),
      prixPublic,
      publicSource,
      rendement: nombre(lu.rendement_quantite) > 0 && nombre(lu.rendement_couvre_m2) > 0 ? { quantite: r2(nombre(lu.rendement_quantite)), unite: lu.rendement_unite || "kg", couvre: r2(nombre(lu.rendement_couvre_m2)), conditions: [] } : null
    },
    remarque: fixText(String(lu.remarque || "")).trim()
  });
}
