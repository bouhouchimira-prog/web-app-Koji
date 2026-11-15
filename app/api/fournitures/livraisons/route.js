import Anthropic from "@anthropic-ai/sdk";
import { badRequest, ok } from "../../../../lib/http";
import { makeToken, readDb, writeDb } from "../../../../lib/db";
import { loadEntrepriseProfile, resolveEntreprise } from "../../../../lib/entreprise-auth";
import { parsePhoto } from "../../../../lib/ai-photo";
import { comparerLivraison, etatBon, plusJoursOuvres, texteReclamation, totauxBon } from "../../../../lib/fournitures-bons";
import { nombre, r2 } from "../../../../lib/fournitures-pro";
import { companyFromWebUser } from "../../../../lib/document-generator";
import { sendClientMessageEmail } from "../../../../lib/mailer";
import { fixText } from "../../../../lib/text";

// Réception d'une livraison (maquette PRO-07.5) : photo du bon de livraison
// → Koji lit les lignes et les compare au bon de commande ; l'utilisateur
// vérifie avant tout envoi ; réclamation préparée au fournisseur ; le
// chantier est prévenu.
const OUTIL = {
  name: "bon_de_livraison",
  description: "Lignes lues sur la photo d'un bon de livraison fournisseur.",
  input_schema: {
    type: "object",
    properties: {
      numero: { type: "string", description: "Numéro du bon de livraison (ex. BL-55102), vide si illisible." },
      date: { type: "string", description: "Date du bon au format AAAA-MM-JJ, vide si illisible." },
      lignes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            designation: { type: "string" },
            reference: { type: "string" },
            quantite_livree: { type: "number", description: "Quantité livrée (pas commandée), 0 si la ligne indique un reliquat ou une rupture." }
          },
          required: ["designation", "quantite_livree"]
        }
      }
    },
    required: ["lignes"]
  }
};

const texte = (v, max = 200) => fixText(String(v ?? "")).replace(/\s+/g, " ").trim().slice(0, max);

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const entreprise = await resolveEntreprise(request, body);
  if (!entreprise) return badRequest("Connexion requise.", 401);
  const db = await readDb();
  const bon = (db.bonsCommande || []).find((b) => b.id === body.bonId && b.userId === entreprise.userId);
  if (!bon) return badRequest("Bon introuvable.", 404);
  const photo = parsePhoto(body.photo);
  if (!photo) return badRequest("Ajoutez la photo du bon de livraison.");
  if (!process.env.ANTHROPIC_API_KEY) return badRequest("La lecture par Koji n'est pas disponible : pointez la livraison à la main.", 503);

  let lu;
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 2048,
      thinking: { type: "disabled" },
      system: "Tu lis la photo d'un bon de livraison de fournitures du bâtiment. Recopie chaque ligne livrée telle qu'écrite, avec la quantité livrée. N'invente aucune ligne.",
      tools: [OUTIL],
      tool_choice: { type: "tool", name: OUTIL.name },
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: photo.mediaType, data: photo.data } },
        { type: "text", text: `Lignes commandées (pour t'aider à lire, ne les recopie pas si elles n'apparaissent pas) : ${bon.lignes.map((l) => `${l.name}${l.ref ? ` (${l.ref})` : ""}`).join(" ; ")}` }
      ] }]
    });
    lu = response.content.find((b) => b.type === "tool_use")?.input || null;
  } catch (error) {
    return badRequest(error?.status === 429 ? "Koji est très demandé, réessayez dans un instant." : "Koji n'a pas pu lire ce bon : pointez la livraison à la main.", 502);
  }
  const lignesLues = (lu?.lignes || []).map((l) => ({ name: texte(l.designation, 160), ref: texte(l.reference, 60), quantite: r2(nombre(l.quantite_livree)) })).filter((l) => l.name);
  if (!lignesLues.length) return badRequest("Aucune ligne lue sur cette photo. Reprenez-la bien à plat, ou pointez à la main.", 422);
  // Le bon compare au reste à livrer de chaque ligne.
  const attendu = bon.lignes.map((l) => ({ id: l.id, name: l.name, ref: l.ref, unit: l.unit, quantite: r2(l.quantite - (l.livre || 0)) })).filter((l) => l.quantite > 0);
  const ecarts = comparerLivraison(attendu, lignesLues);
  return ok({ numeroBl: texte(lu.numero, 40), date: /^\d{4}-\d{2}-\d{2}$/.test(String(lu.date || "")) ? lu.date : new Date().toISOString().slice(0, 10), lignesLues, ecarts });
}

// Validation par l'utilisateur : quantités pointées, photos, réclamation.
export async function PATCH(request) {
  const body = await request.json().catch(() => ({}));
  const entreprise = await resolveEntreprise(request, body);
  if (!entreprise) return badRequest("Connexion requise.", 401);
  const db = await readDb();
  const bon = (db.bonsCommande || []).find((b) => b.id === body.bonId && b.userId === entreprise.userId);
  if (!bon) return badRequest("Bon introuvable.", 404);
  if (etatBon(bon) === "brouillon") return badRequest("Ce bon n'a pas été envoyé.");
  const ecarts = (Array.isArray(body.ecarts) ? body.ecarts : []).slice(0, 200).map((e) => ({
    ligneId: texte(e.ligneId, 60), name: texte(e.name, 160), ref: texte(e.ref, 60), unit: texte(e.unit, 12),
    commande: r2(nombre(e.commande)), livre: r2(Math.max(0, nombre(e.livre))), etat: ["conforme", "manquant", "partiel", "casse", "en_plus"].includes(e.etat) ? e.etat : "conforme", defaut: texte(e.defaut, 80)
  }));
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date || "")) ? body.date : new Date().toISOString().slice(0, 10);
  // Quantités reçues : un article cassé n'est pas compté comme livré.
  for (const e of ecarts) {
    const l = bon.lignes.find((x) => x.id === e.ligneId);
    if (!l) continue;
    const recu = e.etat === "casse" ? 0 : e.livre;
    l.livre = Math.min(l.quantite, r2((l.livre || 0) + recu));
  }
  const photoOk = (p) => typeof p === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(p) && p.length < 900_000;
  const livraison = {
    id: makeToken("liv"),
    date,
    numeroBl: texte(body.numeroBl, 40),
    par: texte(body.par, 60),
    photoBl: photoOk(body.photoBl) ? body.photoBl : "",
    photosDefaut: (Array.isArray(body.photosDefaut) ? body.photosDefaut : []).filter(photoOk).slice(0, 4),
    ecarts,
    reclamation: null,
    lignes: ecarts.filter((e) => e.ligneId).map((e) => ({ id: e.ligneId, livre: e.etat === "casse" ? 0 : e.livre }))
  };
  if (!Array.isArray(bon.livraisons)) bon.livraisons = [];
  bon.livraisons.unshift(livraison);
  bon.etat = etatBon(bon);

  let message = `Livraison enregistrée : ${{ envoye: "envoyé", partiel: "livré en partie", livre: "livré" }[bon.etat] || bon.etat}.`;
  const problemes = ecarts.filter((e) => ["manquant", "partiel", "casse"].includes(e.etat));
  if (problemes.length && body.reclamer) {
    const to = texte(body.to || bon.supplierEmail, 160);
    const corps = texte(body.texte, 3000) || texteReclamation({ numeroBl: livraison.numeroBl, date, ecarts, dateLimite: plusJoursOuvres(date, 2) });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return badRequest("Adresse e-mail du fournisseur manquante pour la réclamation.");
    const company = companyFromWebUser(await loadEntrepriseProfile(entreprise));
    const attachments = livraison.photosDefaut.map((p, i) => ({ filename: `defaut-${i + 1}.jpg`, content: Buffer.from(p.split(",")[1], "base64"), contentType: "image/jpeg" }));
    if (livraison.photoBl) attachments.push({ filename: `bon-livraison-${livraison.numeroBl || "photo"}.jpg`, content: Buffer.from(livraison.photoBl.split(",")[1], "base64"), contentType: "image/jpeg" });
    try {
      await sendClientMessageEmail({ to, subject: `Réclamation livraison ${livraison.numeroBl || ""} · bon ${bon.numeroKoji || bon.numero} · ${company.name}`.replace(/\s+/g, " "), message: `${corps}\n\n${company.name}`, replyTo: company.email || undefined, attachments });
    } catch (error) {
      return badRequest(`Livraison non enregistrée : réclamation impossible à envoyer (${error.message || "réessayez"}).`, 502);
    }
    livraison.reclamation = { texte: corps, to, envoyeeLe: new Date().toISOString() };
    message = `Livraison enregistrée, réclamation envoyée à ${bon.supplierName}.`;
  }
  // Le chantier est prévenu : pose décalée si un lot dépend de l'article.
  if (problemes.length) {
    if (!Array.isArray(db.notifications)) db.notifications = [];
    db.notifications.unshift({
      id: makeToken("notif"),
      userId: entreprise.userId,
      type: "livraison",
      title: `Livraison ${bon.supplierName} : ${problemes.length} écart${problemes.length > 1 ? "s" : ""}`,
      message: `${bon.projectTitle ? `${bon.projectTitle} · ` : ""}${problemes.map((e) => `${e.name} ${e.etat === "casse" ? "cassé" : e.etat === "manquant" ? "manquant" : "incomplet"}`).join(", ")}. Planning à vérifier si un lot en dépend.`,
      actionUrl: bon.projectId ? `/fournitures/chantier?projet=${bon.projectId}` : `/fournitures?tab=bons&bon=${bon.id}`,
      read: false,
      createdAt: new Date().toISOString()
    });
  }
  bon.majLe = new Date().toISOString();
  await writeDb(db);
  return ok({ bon: { ...bon, etat: etatBon(bon), totaux: totauxBon(bon.lignes) }, message });
}
