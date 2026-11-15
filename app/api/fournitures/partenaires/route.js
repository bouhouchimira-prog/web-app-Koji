import { badRequest, ok } from "../../../../lib/http";
import { makeToken, readDb, writeDb } from "../../../../lib/db";
import { resolveEntreprise } from "../../../../lib/entreprise-auth";
import { contenanceDe, ecartMoyen, initiales } from "../../../../lib/fournitures-bons";
import { nombre, r2, perteFamille } from "../../../../lib/fournitures-pro";
import { bonsDe, chargerCatalogue, enregistrerArticle, lireSaisie } from "../../../../lib/fournitures-serveur";
import { sendContactRequestEmail } from "../../../../lib/mailer";
import { fixText } from "../../../../lib/text";

// Fournisseurs partenaires Koji (maquette PRO-07.3) : mercuriale à prix
// réservés aux utilisateurs Koji, publiée par le back-office. Transparence :
// Koji est rémunéré par le fournisseur (le montant n'est jamais affiché ici).
// Un partenaire ne remplace jamais le fournisseur préféré de l'entreprise.
const texte = (v, max = 200) => fixText(String(v ?? "")).replace(/\s+/g, " ").trim().slice(0, max);
const today = () => new Date().toISOString().slice(0, 10);

function resume(p, userId, db, catalogue = []) {
  const articles = p.articles || [];
  const miens = catalogue.filter((a) => a.partenaire?.id === p.id);
  const bons = bonsDe(db, userId).filter((b) => b.partenaireId === p.id && b.envoyeLe);
  return {
    id: p.id,
    nom: p.nom,
    initiales: initiales(p.nom),
    metiers: p.metiers || "",
    zone: p.zone || "",
    adresse: p.adresse || "",
    livraison: p.livraison || "",
    franco: p.franco || "",
    articles: articles.length,
    validite: p.validite || "",
    misAJour: p.misAJour || "",
    prixAJour: Boolean(p.validite) && p.validite >= today(),
    ecart: ecartMoyen(articles),
    dansCatalogue: miens.length,
    commandes: bons.length,
    commandesHt: r2(bons.reduce((s, b) => s + b.lignes.reduce((t, l) => t + l.quantite * l.prixHt, 0), 0))
  };
}

export async function GET(request) {
  const entreprise = await resolveEntreprise(request);
  if (!entreprise) return badRequest("Connexion requise.", 401);
  const db = await readDb();
  const publies = (db.partenaires || []).filter((p) => p.publie);
  const { articles: catalogue } = await chargerCatalogue(entreprise, db).catch(() => ({ articles: [] }));
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!id) return ok({ partenaires: publies.map((p) => resume(p, entreprise.userId, db, catalogue)).sort((a, b) => b.prixAJour - a.prixAJour || a.nom.localeCompare(b.nom, "fr")) });
  const p = publies.find((x) => x.id === id);
  if (!p) return badRequest("Partenaire introuvable.", 404);
  const refs = new Set(catalogue.filter((a) => a.partenaire?.id === p.id).map((a) => a.partenaire.ref));
  return ok({
    partenaire: { ...resume(p, entreprise.userId, db, catalogue), email: p.email || "" },
    articles: (p.articles || []).map((a) => ({ ...a, dansCatalogue: refs.has(a.ref) }))
  });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const entreprise = await resolveEntreprise(request, body);
  if (!entreprise) return badRequest("Connexion requise.", 401);
  const db = await readDb();

  if (body.action === "recommander") {
    const nom = texte(body.nom, 120);
    if (!nom) return badRequest("Nom du fournisseur obligatoire.");
    const reco = { id: makeToken("reco"), userId: entreprise.userId, nom, ville: texte(body.ville, 80), contact: texte(body.contact, 160), message: texte(body.message, 1000), createdAt: new Date().toISOString() };
    if (!Array.isArray(db.recommandationsFournisseurs)) db.recommandationsFournisseurs = [];
    db.recommandationsFournisseurs.unshift(reco);
    await writeDb(db);
    try {
      await sendContactRequestEmail({ objet: "Fournisseur recommandé pour les partenaires Koji", nom: reco.nom, entreprise: reco.ville, coordonnees: reco.contact, message: reco.message || "Recommandé depuis Fournitures › Partenaires Koji." });
    } catch { /* la recommandation est enregistrée, l'équipe la voit dans le back-office */ }
    return ok({ recommande: true });
  }

  if (body.action !== "ajouter") return badRequest("Action inconnue.");
  const p = (db.partenaires || []).find((x) => x.id === body.partenaireId && x.publie);
  if (!p) return badRequest("Partenaire introuvable.", 404);
  const art = (p.articles || []).find((a) => a.ref === body.ref);
  if (!art) return badRequest("Article introuvable dans la mercuriale.", 404);

  const { articles, fournisseurs, reglage } = await chargerCatalogue(entreprise, db);
  if (articles.some((a) => a.partenaire?.id === p.id && a.partenaire.ref === art.ref)) return badRequest("Cet article est déjà dans votre catalogue.");
  // Le partenaire devient un fournisseur de l'entreprise (une seule fois).
  let fournisseur = fournisseurs.find((f) => f.name.toLowerCase() === p.nom.toLowerCase());
  if (!fournisseur) {
    const { data, error } = await entreprise.supabase.from("fournisseurs").insert({ user_id: entreprise.userId, name: p.nom, email: p.email || "", address: p.adresse || "", phone: "", website: "", notes: "Partenaire Koji" }).select().single();
    if (error) return badRequest(`Ajout du fournisseur impossible : ${error.message}`, 500);
    fournisseur = { id: data.id, name: data.name };
    fournisseurs.push(fournisseur);
  }
  const contenance = nombre(art.contenance, 0) || contenanceDe(art.conditionnement) || 1;
  const uniteCond = String(art.conditionnement || "").replace(/[\d.,]+.*$/, "").trim() || "unité";
  const unite = art.unite === "m2" ? "m²" : art.unite || "u";
  // Prix Koji = prix d'achat ; vente au prix public par défaut.
  const saisie = lireSaisie({
    name: art.designation,
    ref: art.ref,
    famille: p.metiers?.split(",")[0] || "",
    unit: unite,
    uniteCond: unite === uniteCond ? "unité" : uniteCond,
    contenance: unite === uniteCond ? 1 : contenance,
    venteUnite: unite === uniteCond,
    perte: perteFamille(p.metiers || ""),
    prixPublic: art.prixPublic,
    publicSource: `prix public communiqué par ${p.nom}`,
    modePrix: "public",
    fournisseurs: [{ supplierId: fournisseur.id, ref: art.ref, achatCond: r2(art.prixKoji * (unite === uniteCond ? 1 : contenance)), prefere: !articles.length }],
    partenaire: { id: p.id, nom: p.nom, ref: art.ref }
  }, fournisseurs);
  if (!saisie.fournisseurs.some((f) => f.prefere)) saisie.fournisseurs[0].prefere = true;
  const article = await enregistrerArticle(entreprise, db, saisie, { fournisseurs, coef: reglage.coef });
  await writeDb(db);
  return ok({ article }, 201);
}
