// Fournitures côté serveur (PRO-07) : l'article de base reste dans la table
// Supabase `fournitures` (nom, famille, unité, prix d'achat et de vente,
// fournisseur préféré : ce que lisent déjà le devis et l'app) ; ce que la
// maquette ajoute (prix public, mode de prix, conditionnement, pertes,
// plusieurs fournisseurs, rendement, ouvrages liés, synonymes…) vit dans
// db.articlesPro, une fiche par article, toujours filtrée sur l'entreprise
// vérifiée (jamais de vue « admin » qui mélangerait les catalogues).
import { fournisseurPrefere, marge, manquesArticle, modeEffectif, nombre, perteFamille, prixAchat, prixVente, r2, COEF_COMPTE_DEFAUT, achatParUnite } from "./fournitures-pro.js";
import { etatBon } from "./fournitures-bons.js";
import { besoinsChantier, dejaCommande, rangerParFournisseur } from "./fournitures-chantier.js";
import { mapQuote } from "./quote-mapping.js";

const SELECT = "*, fournisseurs(name)";

export function reglageFournitures(db, userId) {
  const r = (db.reglagesFournitures || []).find((x) => x.userId === userId) || {};
  return {
    coef: nombre(r.coef, COEF_COMPTE_DEFAUT) || COEF_COMPTE_DEFAUT,
    modeDefaut: ["public", "coefficient", "achat"].includes(r.modeDefaut) ? r.modeDefaut : "public",
    lieux: Array.isArray(r.lieux) && r.lieux.length ? r.lieux.slice(0, 3) : ["Dépôt"],
    inventaireLe: r.inventaireLe || ""
  };
}

export function changerReglage(db, userId, patch = {}) {
  if (!Array.isArray(db.reglagesFournitures)) db.reglagesFournitures = [];
  let r = db.reglagesFournitures.find((x) => x.userId === userId);
  if (!r) { r = { userId }; db.reglagesFournitures.push(r); }
  if (patch.coef != null) {
    const c = nombre(patch.coef);
    if (c >= 1 && c <= 5) r.coef = r2(c);
  }
  if (["public", "coefficient", "achat"].includes(patch.modeDefaut)) r.modeDefaut = patch.modeDefaut;
  if (Array.isArray(patch.lieux)) r.lieux = patch.lieux.map((l) => String(l).trim()).filter(Boolean).slice(0, 3);
  if (patch.inventaireLe != null) r.inventaireLe = String(patch.inventaireLe).slice(0, 10);
  r.majLe = new Date().toISOString();
  return reglageFournitures(db, userId);
}

// Article complet vu par l'entreprise.
export function fusionnerArticle(row, details = {}, fournisseursParId = new Map(), coef = COEF_COMPTE_DEFAUT, modeDefaut = "public") {
  const supplierId = row.fournisseur_id || "";
  const supplierName = row.fournisseurs?.name || fournisseursParId.get(supplierId)?.name || "";
  let fournisseurs = Array.isArray(details.fournisseurs) ? details.fournisseurs.map((f) => ({
    supplierId: f.supplierId || "",
    supplierName: fournisseursParId.get(f.supplierId)?.name || f.supplierName || "",
    ref: f.ref || "",
    achatCond: nombre(f.achatCond),
    achat: nombre(f.achat),
    prefere: Boolean(f.prefere)
  })) : [];
  if (!fournisseurs.length && (supplierId || nombre(row.prix_achat_ht) > 0)) {
    fournisseurs = [{ supplierId, supplierName, ref: details.ref || "", achatCond: 0, achat: nombre(row.prix_achat_ht), prefere: true }];
  }
  const base = {
    id: row.id,
    name: row.name || "Fourniture",
    famille: details.famille || row.category || "",
    unit: details.unit || row.unite || "u",
    achat: nombre(row.prix_achat_ht),
    imageUrl: row.image_url || "",
    sourceUrl: row.source_url || "",
    packaging: row.conditionnement || "",
    ref: details.ref || fournisseurs.find((f) => f.prefere)?.ref || "",
    codeInterne: details.codeInterne || "",
    // Article d'avant PRO-07 : son prix de vente saisi reste le prix manuel,
    // aucun prix ne change sans que l'entreprise le décide.
    prixPublic: nombre(details.prixPublic),
    publicSource: details.publicSource || "",
    modePrix: details.modePrix || (nombre(row.prix_vente_ht) > 0 ? "manuel" : "public"),
    coef: nombre(details.coef) || null,
    prixManuel: details.modePrix ? nombre(details.prixManuel) : nombre(row.prix_vente_ht),
    contenance: nombre(details.contenance, 1) || 1,
    uniteCond: details.uniteCond || "",
    venteUnite: Boolean(details.venteUnite),
    perte: details.perte != null ? nombre(details.perte) : perteFamille(details.famille || row.category || ""),
    fournisseurs,
    supplierId,
    supplierName,
    rendement: details.rendement || null,
    ouvrages: Array.isArray(details.ouvrages) ? details.ouvrages : [],
    synonymes: Array.isArray(details.synonymes) ? details.synonymes : [],
    ficheTechnique: details.ficheTechnique || "",
    photos: Array.isArray(details.photos) ? details.photos : [],
    delai: details.delai != null ? nombre(details.delai) : null,
    historique: Array.isArray(details.historique) ? details.historique.slice(-20) : [],
    partenaire: details.partenaire || null,
    createdAt: row.created_at || ""
  };
  const m = marge(base, { coefCompte: coef, modeDefaut });
  return {
    ...base,
    achat: prixAchat(base),
    vente: m.vente,
    marge: m,
    modeEffectif: modeEffectif(base, { modeDefaut }),
    manques: manquesArticle(base)
  };
}

export async function chargerCatalogue(entreprise, db) {
  const [{ data: rows, error }, { data: fours, error: errF }] = await Promise.all([
    entreprise.supabase.from("fournitures").select(SELECT).order("name", { ascending: true }),
    entreprise.supabase.from("fournisseurs").select("*").order("name", { ascending: true })
  ]);
  if (error) throw new Error(`Lecture des fournitures impossible : ${error.message}`);
  if (errF) throw new Error(`Lecture des fournisseurs impossible : ${errF.message}`);
  const reglage = reglageFournitures(db, entreprise.userId);
  const fournisseurs = (fours || []).map((f) => ({ id: f.id, name: f.name || "Fournisseur", email: f.email || "", phone: f.phone || "", address: f.address || "", website: f.website || "", notes: f.notes || "" }));
  const parId = new Map(fournisseurs.map((f) => [f.id, f]));
  const details = new Map((db.articlesPro || []).filter((d) => d.userId === entreprise.userId).map((d) => [d.id, d]));
  // Les achats « Divers » (ticket de magasin) ne sont pas des articles du catalogue.
  const articles = (rows || [])
    .filter((r) => !(r.magasin || nombre(r.montant_ttc) > 0))
    .map((r) => fusionnerArticle(r, details.get(r.id), parId, reglage.coef, reglage.modeDefaut));
  return { articles, fournisseurs, reglage };
}

const texte = (v, max = 200) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

// Données d'article reçues du formulaire, nettoyées.
export function lireSaisie(body = {}, fournisseursConnus = []) {
  const connus = new Set(fournisseursConnus.map((f) => f.id));
  const contenance = nombre(body.contenance, 1) || 1;
  const fournisseurs = (Array.isArray(body.fournisseurs) ? body.fournisseurs : [])
    .filter((f) => f && connus.has(f.supplierId))
    .slice(0, 6)
    .map((f) => {
      const achatCond = r2(nombre(f.achatCond));
      return { supplierId: f.supplierId, ref: texte(f.ref, 60), achatCond, achat: achatCond > 0 ? achatParUnite(achatCond, contenance) : r2(nombre(f.achat)), prefere: Boolean(f.prefere) };
    });
  if (fournisseurs.length && !fournisseurs.some((f) => f.prefere)) fournisseurs[0].prefere = true;
  let vu = false;
  fournisseurs.forEach((f) => { if (f.prefere) { if (vu) f.prefere = false; vu = true; } });
  const conditions = Array.isArray(body.rendement?.conditions) ? body.rendement.conditions.slice(0, 6).map((c) => ({ label: texte(c.label, 80), couvre: r2(nombre(c.couvre)) })).filter((c) => c.label && c.couvre > 0) : [];
  return {
    name: texte(body.name, 160),
    ref: texte(body.ref, 60),
    codeInterne: texte(body.codeInterne, 30).toUpperCase(),
    famille: texte(body.famille, 80),
    unit: texte(body.unit, 12) || "u",
    prixPublic: r2(nombre(body.prixPublic)),
    publicSource: texte(body.publicSource, 80),
    modePrix: ["public", "coefficient", "manuel"].includes(body.modePrix) ? body.modePrix : "public",
    coef: nombre(body.coef) >= 1 ? r2(nombre(body.coef)) : null,
    prixManuel: r2(nombre(body.prixManuel)),
    contenance,
    uniteCond: texte(body.uniteCond, 20),
    venteUnite: Boolean(body.venteUnite),
    perte: body.perte === "" || body.perte == null ? null : Math.max(0, Math.min(50, nombre(body.perte))),
    fournisseurs,
    rendement: body.rendement && nombre(body.rendement.quantite) > 0 && nombre(body.rendement.couvre) > 0
      ? { quantite: r2(nombre(body.rendement.quantite)), unite: texte(body.rendement.unite, 10) || "kg", couvre: r2(nombre(body.rendement.couvre)), detail: texte(body.rendement.detail, 120), conditions }
      : null,
    ouvrages: (Array.isArray(body.ouvrages) ? body.ouvrages : []).slice(0, 20).map((o) => ({ code: texte(o.code, 30).toUpperCase(), label: texte(o.label, 120), conso: r2(nombre(o.conso, 1)) || 1, unite: texte(o.unite, 12) })).filter((o) => o.code),
    synonymes: (Array.isArray(body.synonymes) ? body.synonymes : []).map((s) => texte(s, 60)).filter(Boolean).slice(0, 12),
    ficheTechnique: texte(body.ficheTechnique, 300),
    photos: (Array.isArray(body.photos) ? body.photos : []).filter((p) => /^https:\/\//.test(String(p)) || /^data:image\/(png|jpeg|webp);base64,/.test(String(p))).slice(0, 4).filter((p) => String(p).length < 1_500_000),
    delai: body.delai === "" || body.delai == null ? null : Math.max(0, Math.min(120, Math.round(nombre(body.delai)))),
    partenaire: body.partenaire && body.partenaire.id ? { id: texte(body.partenaire.id, 60), nom: texte(body.partenaire.nom, 80), ref: texte(body.partenaire.ref, 60) } : null
  };
}

// Écrit l'article : ligne Supabase (ce que le devis lit) + fiche détaillée.
export async function enregistrerArticle(entreprise, db, saisie, { id = "", fournisseurs = [], coef = COEF_COMPTE_DEFAUT, modeDefaut = reglageFournitures(db, entreprise.userId).modeDefaut } = {}) {
  if (!saisie.name) throw new Error("La désignation est obligatoire.");
  const pref = saisie.fournisseurs.find((f) => f.prefere) || null;
  const calc = { ...saisie, fournisseurs: saisie.fournisseurs };
  const achat = prixAchat(calc);
  const vente = prixVente(calc, { coefCompte: coef, modeDefaut });
  const ligne = {
    name: saisie.name,
    category: saisie.famille || "Autre",
    unite: saisie.unit,
    prix_achat_ht: achat,
    prix_vente_ht: vente,
    conditionnement: saisie.uniteCond ? `${saisie.uniteCond} ${String(saisie.contenance).replace(".", ",")} ${saisie.unit}`.trim() : null,
    fournisseur_id: pref?.supplierId || null,
    image_url: (saisie.photos.find((p) => /^https:\/\//.test(p))) || null
  };
  let row;
  if (id) {
    const { data, error } = await entreprise.supabase.from("fournitures").update(ligne).eq("id", id).select(SELECT).maybeSingle();
    if (error) throw new Error(`Mise à jour impossible : ${error.message}`);
    if (!data) throw new Error("Article introuvable.");
    row = data;
  } else {
    const { data, error } = await entreprise.supabase.from("fournitures").insert({ ...ligne, user_id: entreprise.userId, quantite: 0, seuil_alerte: 0 }).select(SELECT).single();
    if (error) throw new Error(`Ajout de l'article impossible : ${error.message}`);
    row = data;
  }
  if (!Array.isArray(db.articlesPro)) db.articlesPro = [];
  let fiche = db.articlesPro.find((d) => d.id === row.id && d.userId === entreprise.userId);
  const historique = fiche?.historique || [];
  const precedent = historique[historique.length - 1];
  if (achat > 0 && (!precedent || Math.abs(precedent.achat - achat) >= 0.005 || precedent.supplierId !== (pref?.supplierId || ""))) {
    historique.push({ date: new Date().toISOString().slice(0, 10), achat, supplierId: pref?.supplierId || "" });
  }
  const { name, ...reste } = saisie;
  void name;
  const nouvelle = { ...reste, id: row.id, userId: entreprise.userId, historique: historique.slice(-30), majLe: new Date().toISOString() };
  if (fiche) Object.assign(fiche, nouvelle);
  else { fiche = nouvelle; db.articlesPro.push(fiche); }
  const parId = new Map(fournisseurs.map((f) => [f.id, f]));
  return fusionnerArticle(row, fiche, parId, coef, modeDefaut);
}

export async function supprimerArticle(entreprise, db, id) {
  const { data, error } = await entreprise.supabase.from("fournitures").delete().eq("id", id).select("id").maybeSingle();
  if (error) throw new Error(`Suppression impossible : ${error.message}`);
  if (!data) throw new Error("Article introuvable.");
  db.articlesPro = (db.articlesPro || []).filter((d) => !(d.id === id && d.userId === entreprise.userId));
  return true;
}

// Bons de l'entreprise, état recalculé.
export function bonsDe(db, userId) {
  return (db.bonsCommande || []).filter((b) => b.userId === userId).map((b) => ({ ...b, etat: etatBon(b) }));
}

const estSigne = (q) => q.status === "Signe" || q.signatureStatus === "Signe" || Boolean(q.signedAt);

// Chantiers actifs avec leurs fournitures : besoins du devis (avenants
// signés inclus), déjà commandé, reste à commander, état.
export async function chargerChantiersFournitures(entreprise, db, articles, { projectId = "" } = {}) {
  let qChantiers = entreprise.supabase.from("chantiers").select("id, reference, street, postal_code, city, status, archived_at, user_id").eq("user_id", entreprise.userId);
  if (projectId) qChantiers = qChantiers.eq("id", projectId);
  const [{ data: chantiers, error: e1 }, { data: devis, error: e2 }] = await Promise.all([
    qChantiers,
    entreprise.supabase.from("quotes").select("*").eq("user_id", entreprise.userId).order("created_at", { ascending: false })
  ]);
  if (e1) throw new Error(`Lecture des chantiers impossible : ${e1.message}`);
  if (e2) throw new Error(`Lecture des devis impossible : ${e2.message}`);
  const quotes = (devis || []).map(mapQuote).filter((q) => !q.internalOnly && q.status !== "Archive");
  const bons = bonsDe(db, entreprise.userId);
  const out = [];
  for (const c of chantiers || []) {
    if (c.archived_at || /termin|clotur|archiv/i.test(String(c.status || ""))) { if (!projectId) continue; }
    const quote = quotes.find((q) => q.projectId === c.id) || quotes.find((q) => q.project && q.project === c.reference) || null;
    if (!quote) { if (projectId) out.push({ projectId: c.id, title: c.reference || "Chantier", address: [c.street, c.postal_code, c.city].filter(Boolean).join(", "), quote: null, besoins: [], ranges: rangerParFournisseur([]), bons: [] }); continue; }
    const avenants = (db.avenants || []).filter((a) => a.userId === entreprise.userId && a.quoteId === quote.id);
    const besoins = besoinsChantier({ quote, avenants, articles });
    if (!besoins.length && !projectId) continue;
    const commande = dejaCommande(bons, c.id);
    const avecReste = besoins.map((b) => {
      const deja = commande.get(b.articleId || b.cle) || 0;
      const reste = r2(Math.max(0, b.quantite - deja));
      return { ...b, dejaCommande: deja, reste, resteHt: r2(reste * b.prixHt) };
    });
    const ranges = rangerParFournisseur(avecReste);
    const bonsChantier = bons.filter((b) => b.projectId === c.id && b.etat !== "annule");
    const aCommanderHt = r2(avecReste.filter((b) => !b.manques.length).reduce((s, b) => s + b.resteHt, 0));
    const enCours = bonsChantier.filter((b) => b.etat === "envoye" || b.etat === "partiel");
    let statut = "aucun";
    if (ranges.aCompleter.length) statut = "a_completer";
    else if (aCommanderHt > 0) statut = "a_commander";
    else if (enCours.length) statut = "commande";
    else if (bonsChantier.length) statut = "livre";
    out.push({
      projectId: c.id,
      title: c.reference || "Chantier",
      address: [c.street, c.postal_code, c.city].filter(Boolean).join(", "),
      quote: { id: quote.id, numero: quote.quoteNumber || "", signe: estSigne(quote), signeLe: quote.signedAt || "", startDate: String(quote.startDate || "").slice(0, 10) },
      avenantsSignes: avenants.filter((a) => a.status === "Signe").map((a) => a.numero),
      besoins: avecReste,
      ranges,
      aCompleter: ranges.aCompleter.length,
      aCommanderHt,
      totalHt: ranges.totalHt,
      fournisseurs: ranges.fournisseurs.map((f) => f.supplierName).filter(Boolean),
      statut,
      prochaineLivraison: enCours.map((b) => b.livraisonLe).filter(Boolean).sort()[0] || "",
      bons: bonsChantier.map((b) => ({ id: b.id, numero: b.numero, supplierName: b.supplierName, etat: b.etat, livraisonLe: b.livraisonLe || "" }))
    });
  }
  return out;
}

export { fournisseurPrefere };
