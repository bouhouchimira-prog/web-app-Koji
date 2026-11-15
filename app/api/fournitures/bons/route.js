import { badRequest, ok } from "../../../../lib/http";
import { makeToken, readDb, writeDb } from "../../../../lib/db";
import { loadEntrepriseProfile, resolveEntreprise } from "../../../../lib/entreprise-auth";
import { chiffresBons, etatBon, numeroBon, numeroBonPartenaire, resteALivrer, totauxBon } from "../../../../lib/fournitures-bons";
import { nombre, r2 } from "../../../../lib/fournitures-pro";
import { bonsDe, chargerCatalogue } from "../../../../lib/fournitures-serveur";
import { bonCommandeFilename, buildBonCommandePdf, companyFromWebUser } from "../../../../lib/document-generator";
import { sendInvoiceReminderEmail } from "../../../../lib/mailer";
import { fixText } from "../../../../lib/text";

// Bons de commande fournisseur (maquette PRO-07.6) : un bon numéroté par
// fournisseur, créé depuis les fournitures du chantier, envoyé (jamais en
// silence), pointé à la livraison et rapproché de la facture.
const texte = (v, max = 200) => fixText(String(v ?? "")).replace(/\s+/g, " ").trim().slice(0, max);
const MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function lireLignes(lignes = []) {
  return (Array.isArray(lignes) ? lignes : []).slice(0, 200).map((l, i) => ({
    id: texte(l.id, 60) || `l${Date.now().toString(36)}${i}`,
    articleId: texte(l.articleId, 60),
    name: texte(l.name, 160) || "Article",
    ref: texte(l.ref, 60),
    unit: texte(l.unit, 12) || "u",
    quantite: r2(Math.max(0, nombre(l.quantite))),
    quantiteBesoin: r2(Math.max(0, nombre(l.quantiteBesoin ?? l.quantite))),
    paquets: Math.max(0, Math.round(nombre(l.paquets))),
    uniteCond: texte(l.uniteCond, 20),
    contenance: nombre(l.contenance, 1) || 1,
    prixHt: r2(Math.max(0, nombre(l.prixHt))),
    venteHt: r2(Math.max(0, nombre(l.venteHt))),
    lot: texte(l.lot, 60),
    livre: r2(Math.max(0, nombre(l.livre)))
  })).filter((l) => l.quantite > 0);
}

async function chantierDe(entreprise, projectId) {
  if (!projectId) return null;
  const { data } = await entreprise.supabase.from("chantiers").select("id, reference, street, postal_code, city").eq("id", projectId).eq("user_id", entreprise.userId).maybeSingle();
  return data ? { id: data.id, titre: data.reference || "Chantier", adresse: [data.street, data.postal_code, data.city].filter(Boolean).join(", ") } : null;
}

function nouveauBon(db, userId, { supplier, partenaire = null, projectId = "", chantier = null, lignes, livraisonLe = "", livraisonHeure = "", livraisonAdresse = "", notes = "", origine = "" }) {
  const annee = new Date().getFullYear();
  const bon = {
    id: makeToken("bc"),
    userId,
    numero: numeroBon(bonsDe(db, userId), annee),
    supplierId: supplier?.id || "",
    supplierName: partenaire ? partenaire.nom : supplier?.name || "Fournisseur",
    supplierEmail: partenaire ? partenaire.email || "" : supplier?.email || "",
    supplierAddress: partenaire ? partenaire.adresse || "" : supplier?.address || "",
    partenaireId: partenaire?.id || "",
    codePartenaire: partenaire?.code || "",
    validitePrix: partenaire?.validite || "",
    projectId,
    projectTitle: chantier?.titre || "",
    lot: [...new Set(lignes.map((l) => l.lot).filter(Boolean))].join(", "),
    livraisonLe: String(livraisonLe || "").slice(0, 10),
    livraisonHeure: texte(livraisonHeure, 10),
    livraisonAdresse: texte(livraisonAdresse || chantier?.adresse || "", 200),
    lignes,
    notes: texte(notes, 500),
    origine,
    etat: "brouillon",
    livraisons: [],
    createdAt: new Date().toISOString()
  };
  if (!Array.isArray(db.bonsCommande)) db.bonsCommande = [];
  db.bonsCommande.unshift(bon);
  return bon;
}

const vue = (b) => ({ ...b, etat: etatBon(b), totaux: totauxBon(b.lignes) });

export async function GET(request) {
  const entreprise = await resolveEntreprise(request);
  if (!entreprise) return badRequest("Connexion requise.", 401);
  const db = await readDb();
  const bons = bonsDe(db, entreprise.userId).map(vue);
  // Commandes d'avant les bons numérotés (table commandes) : listées à part.
  const { data: anciennes } = await entreprise.supabase.from("commandes").select("id, montant_ht, statut, created_at, fournisseurs(name), chantiers(reference)").eq("user_id", entreprise.userId).order("created_at", { ascending: false }).limit(50);
  return ok({
    bons,
    chiffres: chiffresBons(bons, { mois: new Date().toISOString().slice(0, 7) }),
    anciennes: (anciennes || []).map((c) => ({ id: c.id, supplierName: c.fournisseurs?.name || "", projectTitle: c.chantiers?.reference || "", montantHt: nombre(c.montant_ht), statut: c.statut || "", createdAt: c.created_at || "" }))
  });
}

// Création : depuis les fournitures d'un chantier (un bon par fournisseur,
// stock déjà déduit) ou « Nouveau bon » à la main.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const entreprise = await resolveEntreprise(request, body);
  if (!entreprise) return badRequest("Connexion requise.", 401);
  const db = await readDb();
  let catalogue;
  try { catalogue = await chargerCatalogue(entreprise, db); } catch (e) { return badRequest(e.message, 500); }
  const fournisseurs = new Map(catalogue.fournisseurs.map((f) => [f.id, f]));
  const chantier = await chantierDe(entreprise, body.projectId);
  if (body.projectId && !chantier) return badRequest("Chantier introuvable.", 404);
  const lignes = lireLignes(body.lignes).map((l, i) => ({ ...l, supplierId: texte(body.lignes[i]?.supplierId, 60), partenaireId: texte(body.lignes[i]?.partenaireId, 60) }));
  if (!lignes.length) return badRequest("Aucune ligne à commander.");

  // Article venu d'un partenaire Koji et commandé chez lui : bon tracé
  // (numéro Koji, code partenaire), condition de la rémunération de Koji.
  const publies = new Map((db.partenaires || []).filter((p) => p.publie).map((p) => [p.id, p]));
  for (const l of lignes) {
    if (l.partenaireId || !l.articleId) continue;
    const a = catalogue.articles.find((x) => x.id === l.articleId);
    const pref = a?.fournisseurs.find((f) => f.prefere);
    if (a?.partenaire && publies.has(a.partenaire.id) && pref?.supplierId === l.supplierId) l.partenaireId = a.partenaire.id;
  }
  const groupes = new Map();
  for (const l of lignes) {
    const cle = l.partenaireId ? `p:${l.partenaireId}` : l.supplierId;
    if (!cle || (!l.partenaireId && !fournisseurs.has(l.supplierId))) return badRequest(`« ${l.name} » n'a pas de fournisseur : complétez l'article avant de commander.`);
    if (!groupes.has(cle)) groupes.set(cle, []);
    const { supplierId, partenaireId, ...ligne } = l;
    void supplierId; void partenaireId;
    groupes.get(cle).push(ligne);
  }
  const partenaires = publies;
  const crees = [];
  for (const [cle, ls] of groupes) {
    const partenaire = cle.startsWith("p:") ? partenaires.get(cle.slice(2)) : null;
    if (cle.startsWith("p:") && !partenaire) return badRequest("Partenaire introuvable.");
    crees.push(nouveauBon(db, entreprise.userId, {
      supplier: partenaire ? null : fournisseurs.get(cle),
      partenaire,
      projectId: chantier?.id || "",
      chantier,
      lignes: ls,
      livraisonLe: body.livraisonLe,
      livraisonHeure: body.livraisonHeure,
      livraisonAdresse: body.livraisonAdresse,
      notes: body.notes,
      origine: body.projectId ? "chantier" : "manuel"
    }));
  }

  // Stock pris pour ce chantier (PRO-07.4) : sorties « affectation ».
  if (Array.isArray(body.stock) && body.stock.length) {
    const date = new Date().toISOString().slice(0, 10);
    for (const s of body.stock) {
      const ligne = (db.stockPro || []).find((x) => x.id === s.id && x.userId === entreprise.userId);
      const q = r2(Math.min(nombre(s.quantite), nombre(ligne?.quantite)));
      if (!ligne || !(q > 0)) continue;
      ligne.quantite = r2(ligne.quantite - q);
      ligne.utiliseLe = date;
      if (!Array.isArray(db.stockMouvements)) db.stockMouvements = [];
      db.stockMouvements.unshift({ id: makeToken("mv"), userId: entreprise.userId, stockId: ligne.id, name: ligne.name, type: "sortie", motif: "chantier", projectId: chantier?.id || "", projectTitle: chantier?.titre || "", quantite: q, unit: ligne.unit, prixHt: ligne.prixHt, date });
    }
    db.stockPro = (db.stockPro || []).filter((x) => !(x.userId === entreprise.userId && !(x.quantite > 0)));
  }
  await writeDb(db);
  return ok({ bons: crees.map(vue) }, 201);
}

export async function PATCH(request) {
  const body = await request.json().catch(() => ({}));
  const entreprise = await resolveEntreprise(request, body);
  if (!entreprise) return badRequest("Connexion requise.", 401);
  const db = await readDb();
  const bon = (db.bonsCommande || []).find((b) => b.id === body.id && b.userId === entreprise.userId);
  if (!bon) return badRequest("Bon introuvable.", 404);
  const etat = etatBon(bon);
  const now = new Date().toISOString();

  if (body.action === "modifier") {
    if (etat !== "brouillon") return badRequest("Un bon envoyé ne se modifie plus : dupliquez-le.");
    if (body.lignes) { const l = lireLignes(body.lignes); if (!l.length) return badRequest("Le bon doit garder au moins une ligne."); bon.lignes = l; }
    if (body.livraisonLe != null) bon.livraisonLe = String(body.livraisonLe).slice(0, 10);
    if (body.livraisonHeure != null) bon.livraisonHeure = texte(body.livraisonHeure, 10);
    if (body.livraisonAdresse != null) bon.livraisonAdresse = texte(body.livraisonAdresse, 200);
    if (body.notes != null) bon.notes = texte(body.notes, 500);
    if (body.compteFournisseur != null) bon.compteFournisseur = texte(body.compteFournisseur, 40);
    if (body.contactChantier != null) bon.contactChantier = texte(body.contactChantier, 120);
  } else if (body.action === "envoyer") {
    if (etat !== "brouillon") return badRequest("Ce bon a déjà été envoyé.");
    // Un bon engage l'entreprise : l'écran affiche le montant, l'envoi doit
    // être confirmé.
    if (body.confirme !== true) return badRequest(`Confirmez la commande de ${totauxBon(bon.lignes).ht.toFixed(2).replace(".", ",")} € HT.`);
    const canal = body.canal === "manuel" ? "manuel" : "email";
    if (canal === "email") {
      const to = texte(body.to || bon.supplierEmail, 160);
      if (!MAIL.test(to)) return badRequest("Adresse e-mail du fournisseur invalide.");
      const webUser = await loadEntrepriseProfile(entreprise);
      const company = companyFromWebUser(webUser);
      if (bon.partenaireId) {
        const tous = db.bonsCommande || [];
        bon.numeroKoji = numeroBonPartenaire(tous, new Date().getFullYear());
      }
      bon.envoyeLe = now;
      const chantier = await chantierDe(entreprise, bon.projectId);
      const pdf = buildBonCommandePdf({ bon, company, chantier: chantier || {} });
      try {
        await sendInvoiceReminderEmail({
          to,
          subject: `Bon de commande ${bon.numeroKoji || bon.numero} · ${company.name}`,
          message: texte(body.message, 3000) || `Bonjour,\n\nVeuillez trouver ci-joint notre bon de commande ${bon.numeroKoji || bon.numero}${bon.livraisonLe ? `, livraison souhaitée le ${bon.livraisonLe.split("-").reverse().join("/")}` : ""}.\n\nMerci de rappeler ce numéro sur la facture.\n\n${company.name}`,
          replyTo: company.email || undefined,
          pdfBuffer: pdf,
          pdfFilename: bonCommandeFilename(bon)
        });
      } catch (error) {
        delete bon.envoyeLe;
        delete bon.numeroKoji;
        return badRequest(`Envoi impossible : ${error.message || "réessayez"}.`, 502);
      }
      bon.envoyeA = to;
    } else {
      bon.envoyeLe = now;
      bon.envoyeA = "";
    }
    bon.canal = canal;
    bon.etat = "envoye";
  } else if (body.action === "pointer") {
    if (etat === "brouillon" || etat === "annule") return badRequest("Pointez un bon envoyé.");
    const recus = new Map((Array.isArray(body.lignes) ? body.lignes : []).map((l) => [l.id, r2(Math.max(0, nombre(l.livre)))]));
    for (const l of bon.lignes) if (recus.has(l.id)) l.livre = Math.min(l.quantite, recus.get(l.id));
    if (!Array.isArray(bon.livraisons)) bon.livraisons = [];
    bon.livraisons.unshift({ date: String(body.date || now).slice(0, 16), par: texte(body.par, 60), lignes: [...recus.entries()].map(([id, livre]) => ({ id, livre })), blId: texte(body.blId, 60) });
    bon.etat = etatBon(bon);
  } else if (body.action === "facture") {
    if (etat === "brouillon") return badRequest("Rapprochez une facture d'un bon envoyé.");
    const montantHt = r2(nombre(body.montantHt));
    if (!(montantHt > 0)) return badRequest("Montant HT de la facture manquant.");
    bon.facture = { numero: texte(body.numero, 40), date: String(body.date || "").slice(0, 10), montantHt, ecartHt: r2(montantHt - totauxBon(bon.lignes).ht), statut: "a_verifier" };
  } else if (body.action === "dupliquer" || body.action === "reste") {
    const lignes = body.action === "reste" ? resteALivrer(bon) : bon.lignes.map((l) => ({ ...l, livre: 0 }));
    if (!lignes.length) return badRequest("Tout a été livré : rien à renvoyer.");
    const partenaire = bon.partenaireId ? (db.partenaires || []).find((p) => p.id === bon.partenaireId && p.publie) : null;
    const copie = nouveauBon(db, entreprise.userId, {
      supplier: { id: bon.supplierId, name: bon.supplierName, email: bon.supplierEmail, address: bon.supplierAddress },
      partenaire,
      projectId: bon.projectId,
      chantier: bon.projectId ? { id: bon.projectId, titre: bon.projectTitle, adresse: bon.livraisonAdresse } : null,
      lignes: lignes.map((l) => ({ ...l, id: `${l.id}-${Date.now().toString(36)}` })),
      livraisonAdresse: bon.livraisonAdresse,
      notes: body.action === "reste" ? `Reste du bon ${bon.numero}.` : "",
      origine: body.action === "reste" ? `reste:${bon.numero}` : `copie:${bon.numero}`
    });
    if (body.action === "reste") bon.resteRenvoye = copie.numero;
    await writeDb(db);
    return ok({ bon: vue(copie), origine: vue(bon) });
  } else if (body.action === "annuler") {
    if (etat === "livre") return badRequest("Un bon livré ne s'annule pas.");
    if (etat === "brouillon") db.bonsCommande = db.bonsCommande.filter((b) => b !== bon);
    else bon.etat = "annule";
    await writeDb(db);
    return ok({ supprime: etat === "brouillon", bon: etat === "brouillon" ? null : vue(bon) });
  } else {
    return badRequest("Action inconnue.");
  }
  bon.majLe = now;
  await writeDb(db);
  return ok({ bon: vue(bon) });
}
