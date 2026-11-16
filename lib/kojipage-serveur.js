// KojiPage (PRO-13 à 13.5) côté serveur : site de l'entreprise dans
// db.companySites (brouillon + version publiée), photos dans le stockage
// privé (liens temporaires), visites, demandes (db.companySiteLeads), base
// de devis préparée par Koji avec la bibliothèque de l'entreprise.
import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "./supabase";
import { mapQuote } from "./quote-mapping";
import { computeQuoteItem } from "./quote-calculations";
import { mergedOuvragesAsync } from "./ouvrages";
import { indexBibliotheque, prixUnitaireOuvrage, tauxHoraireEntreprise, tvaParDefaut } from "./prix-recommande";
import { photosRealisation, texteProjet } from "./kojipage";
import { fixText } from "./text";

const BUCKET = "quote_attachments";
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function siteDe(db, userId) {
  return (db.companySites || []).find((s) => s.userId === userId) || null;
}

export function urlPublique(slug, base = process.env.NEXT_PUBLIC_SITE_URL || "https://getkoji.io") {
  return `${String(base).replace(/\/$/, "")}/site/${slug}`;
}

// Photos : « kp:chemin » (KojiPage) ou « cp:chemin » (photo de chantier,
// même stockage), ou data URL d'avant la refonte.
export async function enregistrerPhoto(userId, buffer, type = "image/jpeg") {
  const ext = type === "image/png" ? "png" : "jpg";
  const path = `kojipage/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await getSupabaseAdmin().storage.from(BUCKET).upload(path, buffer, { contentType: type, upsert: false });
  if (error) throw new Error("Photo non enregistrée. Réessayez.");
  return `kp:${path}`;
}

export function refsDuSite(site = {}) {
  const refs = [];
  for (const r of site.realisations || []) refs.push(...photosRealisation(r).toutes);
  for (const r of site.publie?.realisations || []) refs.push(...photosRealisation(r).toutes);
  if (site.contactPhotoDataUrl) refs.push(site.contactPhotoDataUrl);
  if (site.publie?.contactPhotoDataUrl) refs.push(site.publie.contactPhotoDataUrl);
  return [...new Set(refs.filter((r) => typeof r === "string"))];
}

// ref → URL affichable (liens valables un jour).
export async function urlsPhotos(refs = []) {
  const urls = {};
  const chemins = [];
  for (const ref of refs) {
    if (/^data:|^https?:/.test(ref)) urls[ref] = ref;
    else if (/^(kp|cp):/.test(ref)) chemins.push(ref);
  }
  if (chemins.length) {
    const { data } = await getSupabaseAdmin().storage.from(BUCKET).createSignedUrls(chemins.map((r) => r.slice(3)), 86400);
    (data || []).forEach((d, i) => { if (d?.signedUrl) urls[chemins[i]] = d.signedUrl; });
  }
  return urls;
}

// Devis signés de l'entreprise (12 mois), pour le contrôle des prix.
export async function ventesSignees(supabase, userId) {
  const { data } = await supabase.from("quotes").select("*").eq("user_id", userId);
  return (data || []).map(mapQuote).filter((q) => !q.internalOnly && (q.status === "Signe" || q.signatureStatus === "Signe")).map((q) => ({
    titre: fixText([q.project, q.projectReference, q.workDescription].filter(Boolean).join(" ")),
    signeLe: q.signedAt || q.updatedAt || q.createdAt || "",
    ttc: Number(q.totalTtc) || 0,
    lignes: (q.items || []).map((item) => {
      const c = computeQuoteItem(item, q);
      const qte = Number(c.quantity) || 1;
      return { texte: fixText(item.label || item.designation || ""), unite: item.unit || "", puTtc: r2((Number(c.totalTtc) || 0) / qte) };
    })
  }));
}

// Visites par jour (le propriétaire ne compte pas) ; ouvertures de la carte.
export function compterVisite(db, site, { source = "", jour = new Date().toISOString().slice(0, 10) } = {}) {
  db.kojiPageStats = db.kojiPageStats || {};
  const s = (db.kojiPageStats[site.id] = db.kojiPageStats[site.id] || { visites: {}, carte: {}, vcf: {} });
  s.visites[jour] = (s.visites[jour] || 0) + 1;
  if (source === "carte") s.carte[jour] = (s.carte[jour] || 0) + 1;
}
export function compterVcf(db, site, jour = new Date().toISOString().slice(0, 10)) {
  db.kojiPageStats = db.kojiPageStats || {};
  const s = (db.kojiPageStats[site.id] = db.kojiPageStats[site.id] || { visites: {}, carte: {}, vcf: {} });
  s.vcf = s.vcf || {};
  s.vcf[jour] = (s.vcf[jour] || 0) + 1;
}
export function statsDe(db, site) {
  return db.kojiPageStats?.[site?.id] || { visites: {}, carte: {}, vcf: {} };
}

export function demandesDe(db, userId) {
  return (db.companySiteLeads || []).filter((l) => l.userId === userId).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

// Base de devis préparée par Koji à partir de la demande : lots et lignes
// avec les codes de la bibliothèque, prix à vos prix (jamais du modèle),
// hypothèses, non compris, questions.
const OUTIL = {
  name: "base_devis",
  description: "Prépare la base d'un devis de rénovation à partir de la demande d'un particulier.",
  input_schema: {
    type: "object",
    properties: {
      lots: {
        type: "array",
        items: {
          type: "object",
          properties: {
            nom: { type: "string", description: "Nom du lot, comme dans un devis (Dépose, Plomberie, Carrelage…)." },
            lignes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  code: { type: "string", description: "Code de l'ouvrage de la liste fournie, s'il correspond." },
                  libelle: { type: "string" },
                  quantite: { type: "number" },
                  unite: { type: "string" }
                },
                required: ["libelle", "quantite"]
              }
            }
          },
          required: ["nom", "lignes"]
        }
      },
      hypotheses: { type: "array", items: { type: "string" }, description: "Hypothèses à confirmer avec le client (accès, réseaux, gamme)." },
      non_compris: { type: "array", items: { type: "string" }, description: "Ce qui n'est pas compris et à annoncer." },
      questions: { type: "array", items: { type: "string" }, description: "Questions à poser au client, 3 au plus." }
    },
    required: ["lots", "hypotheses", "non_compris", "questions"]
  }
};
const mots = (t) => new Set(String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((m) => m.length > 3));

export async function preparerBaseDevis({ db, userId, business = {}, demande = {} }) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Koji n'est pas configuré (clé API manquante).");
  const description = [demande.projet ? texteProjet(demande.projet) : "", demande.message ? `Message du client : « ${demande.message} »` : "", demande.prestation ? `Prestation demandée : ${demande.prestation}` : ""].filter(Boolean).join("\n");
  const bibliotheque = await mergedOuvragesAsync(db, userId).catch(() => []);
  const parCode = indexBibliotheque(bibliotheque);
  const cles = mots(description);
  const proches = bibliotheque
    .filter((o) => o?.code && o?.label)
    .map((o) => ({ o, score: [...mots(o.label)].filter((m) => cles.has(m)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 120)
    .map(({ o }) => `${o.code} · ${o.label} (${o.unit || "u"})`);
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2048,
    thinking: { type: "disabled" },
    system: "Tu es Koji, l'assistant d'une entreprise du bâtiment. À partir d'une demande de particulier, tu prépares la base d'un devis : lots et lignes avec les codes des ouvrages de la liste quand ils correspondent, quantités estimées d'après la surface. Ne donne jamais de prix. N'ajoute pas de travaux que la demande n'implique pas ; signale ce qui n'est pas compris (tableau électrique, amiante…) et les hypothèses à confirmer.",
    tools: [OUTIL],
    tool_choice: { type: "tool", name: OUTIL.name },
    messages: [{ role: "user", content: [description, "", "Ouvrages de la bibliothèque (code · intitulé (unité)) :", ...(proches.length ? proches : ["(aucun ouvrage proche)"])].join("\n") }]
  });
  const p = response.content.find((b) => b.type === "tool_use")?.input;
  if (!p || !Array.isArray(p.lots)) throw new Error("Koji n'a pas pu préparer la base de devis. Réessayez.");
  const taux = tauxHoraireEntreprise(business);
  const tva = tvaParDefaut(business);
  let ht = 0;
  let manquants = 0;
  const lots = p.lots.slice(0, 12).map((lot) => ({
    nom: fixText(String(lot.nom || "")).slice(0, 60),
    lignes: (lot.lignes || []).slice(0, 20).map((l) => {
      const o = l.code ? parCode.get(String(l.code).toUpperCase()) : null;
      const pu = o ? r2(prixUnitaireOuvrage(o, taux)) : 0;
      const quantite = Math.max(0, Number(l.quantite) || 0);
      if (pu > 0) ht += pu * quantite; else manquants += 1;
      return { code: o ? o.code : "", libelle: fixText(String(o?.label || l.libelle || "")).slice(0, 140), quantite, unite: String(o?.unit || l.unite || "u").slice(0, 10), puHt: pu };
    })
  }));
  const liste = (v, n) => (Array.isArray(v) ? v : []).map((x) => fixText(String(x)).slice(0, 160)).filter(Boolean).slice(0, n);
  return {
    lots,
    lignes: lots.reduce((n, l) => n + l.lignes.length, 0),
    ht: r2(ht),
    ttc: ht > 0 ? Math.round((ht * (1 + tva / 100)) / 10) * 10 : 0,
    manquants,
    tauxManquant: !(taux > 0),
    hypotheses: liste(p.hypotheses, 5),
    nonCompris: liste(p.non_compris, 5),
    questions: liste(p.questions, 3),
    prepareeLe: new Date().toISOString()
  };
}

// Texte d'ouverture du devis guidé à partir de la demande.
export function messageDevisGuide(demande = {}) {
  const base = demande.base;
  return [
    `Demande reçue par ma KojiPage${demande.name ? ` de ${demande.name.split(/\s+/)[0]}` : ""} :`,
    demande.projet ? texteProjet(demande.projet) : "",
    demande.message ? `« ${demande.message} »` : "",
    base?.lots?.length ? `Base préparée : ${base.lots.map((l) => `${l.nom} (${l.lignes.map((x) => `${x.libelle} ${x.quantite} ${x.unite}`).join(", ")})`).join(" ; ")}.` : "",
    base?.hypotheses?.length ? `Hypothèses : ${base.hypotheses.join(" ; ")}.` : "",
    "Prépare le devis à mes prix."
  ].filter(Boolean).join("\n");
}
