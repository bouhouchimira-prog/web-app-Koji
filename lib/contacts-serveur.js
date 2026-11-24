// Contacts Koji Pro (PRO-10 à 10.3) côté serveur : carnet unique dans
// db.contacts, croisé avec les devis et chantiers (Supabase), factures,
// pièces de dépenses, bons de commande et visites (JSON).
import { mapQuote } from "./quote-mapping";
import { contactDisplayName } from "./contacts";
import { argentClient, chantiersDuPro, correspondAuContact, dernierEchange, historiqueContact, initiales, piecesDuPro, prixConstates, prochaineAction, typeContact, vigilance } from "./contacts-pro";
import { piecesDe } from "./depenses-serveur";
import { bonsDe } from "./fournitures-serveur";
import { totauxBon } from "./fournitures-bons";
import { fixText } from "./text";
import { contactInactif } from "./contacts-pro.js";
import { etatContrat } from "./sous-traitance";

const estSigne = (q) => q.status === "Signe" || q.signatureStatus === "Signe";

export async function contexteCarnet(entreprise, db) {
  const [{ data: rowsQ }, { data: rowsC }] = await Promise.all([
    entreprise.supabase.from("quotes").select("*").eq("user_id", entreprise.userId),
    entreprise.supabase.from("chantiers").select("*").eq("user_id", entreprise.userId)
  ]);
  const quotes = (rowsQ || []).map(mapQuote).filter((q) => !q.internalOnly && q.status !== "Archive");
  const chantiers = (rowsC || []).map((c) => ({ projectId: c.id, title: c.reference || "Chantier", address: [c.street, c.postal_code, c.city].filter(Boolean).join(", "), clientEmail: c.client_email || "" }));
  const userId = entreprise.userId;
  return {
    quotes,
    chantiers,
    titres: new Map(chantiers.map((c) => [c.projectId, c.title])),
    invoices: (db.invoices || []).filter((i) => i.userId === userId),
    pieces: piecesDe(db, userId),
    bons: bonsDe(db, userId),
    visites: (db.visites || []).filter((v) => v.userId === userId),
    liens: (db.chantierContacts || []).filter((l) => l.userId === userId),
    contrats: (db.contratsSousTraitance || []).filter((k) => k.userId === userId)
  };
}

// La fiche se remplit seule : un client d'un devis envoyé ou signé qui
// n'est pas encore dans le carnet y entre (même e-mail, téléphone ou lien).
export function importerClientsDesDevis(db, userId, quotes = []) {
  db.contacts = db.contacts || [];
  const miens = () => db.contacts.filter((c) => c.userId === userId);
  let ajoutes = 0;
  for (const q of quotes) {
    if (!(estSigne(q) || q.status === "Envoye")) continue;
    if (!q.client && !q.clientEmail) continue;
    if (miens().some((c) => correspondAuContact(c, q) || (c.sourceQuoteIds || []).includes(q.id))) continue;
    const societe = q.clientType === "societe" || Boolean(q.clientCompanyName);
    const now = new Date().toISOString();
    db.contacts.unshift({
      id: `contact-${Date.now()}-${ajoutes}`, userId, type: societe ? "societe" : "particulier",
      firstName: fixText(q.clientFirstName || ""), lastName: fixText(q.clientLastName || (societe ? "" : q.client || "")),
      companyName: fixText(q.clientCompanyName || (societe ? q.client || "" : "")),
      phone: fixText(q.clientPhone || ""), email: fixText(q.clientEmail || ""), address: fixText(q.chantierAddress || ""),
      roles: ["client"], source: "devis", sourceQuoteIds: [q.id], archived: false, archivedAt: "", createdAt: now, updatedAt: now
    });
    ajoutes += 1;
  }
  return ajoutes;
}

function documentsDuContact(c, ctx) {
  const quotes = ctx.quotes.filter((q) => correspondAuContact(c, q) || (c.sourceQuoteIds || []).includes(q.id));
  const quoteIds = new Set(quotes.map((q) => q.id));
  const invoices = ctx.invoices.filter((i) => i.contactId === c.id || quoteIds.has(i.quoteId) || correspondAuContact(c, { email: i.clientEmail }));
  const projets = new Set([...quotes.map((q) => q.projectId).filter(Boolean), ...ctx.liens.filter((l) => l.contactId === c.id).map((l) => l.projectId)]);
  const visites = ctx.visites.filter((v) => quoteIds.has(v.quoteId) || (v.contactId && v.contactId === c.id));
  return { quotes, invoices, projets: [...projets], visites };
}

function sousTitre(c, t, d, ctx, pro) {
  const chantier = d.projets.map((id) => ctx.titres.get(id)).filter(Boolean)[0] || "";
  if (t.cle === "client") return [t.genre === "particulier" ? "Client" : `Client · ${t.genre}`, chantier].filter(Boolean).join(" · ");
  if (t.cle === "sous_traitant") return ["Sous-traitant", pro?.chantiers[0]?.title || chantier, c.metier].filter(Boolean).join(" · ");
  if (t.cle === "fournisseur") {
    const bon = ctx.bons.filter((b) => String(b.supplierName || "").toLowerCase().includes(String(contactDisplayName(c)).toLowerCase().split(" ")[0]))[0];
    return ["Fournisseur", bon ? `commande ${bon.numero}` : c.metier].filter(Boolean).join(" · ");
  }
  if (t.cle === "architecte") return `Prescripteur · ${(c.chantiersApportes || []).length} chantier${(c.chantiersApportes || []).length > 1 ? "s" : ""} apporté${(c.chantiersApportes || []).length > 1 ? "s" : ""}`;
  return [t.label, c.metier || chantier].filter(Boolean).join(" · ");
}

// Une ligne du carnet (liste dense, deux lignes par contact).
export function ligneCarnet(c, ctx, aujourdhui) {
  const t = typeContact(c);
  const d = documentsDuContact(c, ctx);
  const piecesPro = t.pro ? piecesDuPro(c, ctx.pieces) : [];
  const pro = t.pro ? chantiersDuPro(piecesPro, ctx.titres) : null;
  const argent = t.cle === "client" ? argentClient({ quotes: d.quotes, invoices: d.invoices, aujourdhui }) : null;
  const vig = t.cle === "sous_traitant" ? vigilance(c, { cumulHt: pro?.cumulAnnee || 0, aujourdhui }) : null;
  const action = prochaineAction(c, { argent, vig, aujourdhui });
  const hist = historiqueContact({ contact: c, quotes: d.quotes, invoices: d.invoices, visites: d.visites });
  const nom = contactDisplayName(c) || "Sans nom";
  return { c, t, d, pro, piecesPro, argent, vig, action, hist, nom, ligne: {
    id: c.id, nom, initiales: initiales(nom), type: t.cle, typeLabel: t.label, genre: t.genre, pro: t.pro,
    sousTitre: sousTitre(c, t, d, ctx, pro), flag: action?.flag || "", aFaire: Boolean(action?.urgent), dernier: dernierEchange(hist, c),
    telephone: c.phone || "", email: c.email || "", archive: Boolean(c.archived),
    // Inactif (PRO-19.1) : archivé à la demande, ou sans échange depuis 24 mois.
    inactif: Boolean(c.archived) || contactInactif(c, hist, aujourdhui)
  } };
}

export function ficheCarnet(c, ctx, aujourdhui) {
  const x = ligneCarnet(c, ctx, aujourdhui);
  const projets = x.d.projets.map((id) => ({ projectId: id, title: ctx.titres.get(id) || "Chantier", address: ctx.chantiers.find((ch) => ch.projectId === id)?.address || "" }));
  const fournisseur = x.t.cle === "fournisseur" ? (() => {
    const cle = String(x.nom).toLowerCase().split(/\s+/)[0];
    const bons = ctx.bons.filter((b) => String(b.supplierName || "").toLowerCase().includes(cle) && b.etat !== "annule");
    const annee = new Date().getFullYear();
    const del = bons.filter((b) => String(b.envoyeLe || b.createdAt || "").startsWith(String(annee)));
    return { commandes: del.length, commandesHt: Math.round(del.reduce((s, b) => s + totauxBon(b.lignes || []).ht, 0) * 100) / 100, dernier: bons[0]?.numero || "" };
  })() : null;
  const apportes = x.t.cle === "architecte" ? (c.chantiersApportes || []).map((id) => {
    const q = ctx.quotes.filter((qq) => qq.projectId === id && estSigne(qq));
    return { projectId: id, title: ctx.titres.get(id) || "Chantier", signeHt: Math.round(q.reduce((s, qq) => s + (Number(qq.totalHt) || 0), 0) * 100) / 100 };
  }) : [];
  return {
    ...x.ligne,
    contact: c,
    action: x.action,
    argent: x.argent,
    vigilance: x.vig ? { ...x.vig, docs: x.vig.docs.map(({ doc, ...d }) => ({ ...d, recu: Boolean(doc?.fichier), lu: doc?.lu || null, aVerifier: Boolean(doc?.aVerifier) })) } : null,
    projets,
    devis: x.d.quotes.map((q) => ({ id: q.id, numero: q.quoteNumber || "", signe: estSigne(q), totalHt: q.totalHt, tva: q.vatRate, statut: q.status })),
    factures: x.d.invoices.map((i) => ({ id: i.id, numero: i.invoiceNumber, statut: i.status, ttc: i.amountTtc, dueDate: i.dueDate, type: i.type || "" })),
    visites: x.d.visites.length,
    photosVisite: x.d.visites.reduce((s, v) => s + (v.photos?.length || 0), 0),
    historique: x.hist.slice(0, 60),
    pro: x.pro ? { ...x.pro, prix: prixConstates(x.piecesPro) } : null,
    fournisseur,
    apportes,
    tousChantiers: ctx.chantiers.map((ch) => ({ projectId: ch.projectId, title: ch.title })),
    // Contrats de sous-traitance (PRO-14.1) : statut visible sur la fiche.
    contrats: (ctx.contrats || []).filter((k) => k.contactId === c.id).map((k) => ({ id: k.id, lot: k.lot, chantier: k.chantier, prixHt: k.prixHt, etat: etatContrat(k).label }))
  };
}
