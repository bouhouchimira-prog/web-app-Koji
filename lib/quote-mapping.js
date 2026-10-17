// Shared row <-> app-shape mapping for the `quotes` table, used by both the
// CRUD route (app/api/quotes/route.js) and any other route that needs to
// read/write a quote directly (documents, signature) without duplicating the
// metadata/web_extras layout.

export function mapQuote(row) {
  const metadata = row.metadata || {};
  const extras = row.web_extras || {};
  const client = metadata.client || {};
  return {
    id: row.id,
    userId: row.user_id,
    quoteNumber: row.reference || metadata.quoteNumber || "",
    versionNumber: extras.versionNumber || "001",
    client: client.name || "",
    clientReference: extras.clientReference || "",
    clientEmail: client.email || "",
    clientPhone: client.phone || "",
    // Identite structuree + adresse structuree (22 septembre) — "client" et
    // "chantierAddress" ci-dessus restent les chaines uniques que tout le
    // reste de l'app lit deja (PDF, factures, assistant koji...), derivees
    // de ces champs par DevisEditor.jsx au moment de l'enregistrement.
    clientType: extras.clientType === "societe" ? "societe" : "particulier",
    clientFirstName: extras.clientFirstName || "",
    clientLastName: extras.clientLastName || "",
    clientCompanyName: extras.clientCompanyName || "",
    chantierAddressDetails: extras.chantierAddressDetails || null,
    project: extras.project || "",
    projectId: row.chantier_id || "",
    contactId: extras.contactId || "",
    projectReference: extras.projectReference || "",
    chantierAddress: metadata.siteAddress || "",
    startDate: metadata.travauxStart || "",
    expectedDuration: metadata.travauxDuration || "",
    workDescription: extras.workDescription || "",
    validityDays: Number(metadata.validity || 30),
    company: metadata.company || {},
    quoteDate: metadata.date || String(row.created_at || "").slice(0, 10),
    status: row.status || "Brouillon",
    signatureStatus: extras.signatureStatus || "Non envoye",
    rooms: Array.isArray(row.rooms) ? row.rooms : [],
    items: Array.isArray(row.items) ? row.items : [],
    notes: Array.isArray(extras.notes) ? extras.notes : [],
    surcharges: Array.isArray(extras.surcharges) ? extras.surcharges : [],
    vatRate: extras.vatRate != null ? Number(extras.vatRate) : Number(row.tva_rate || 20),
    draftStep: Number(extras.draftStep || 0),
    draftData: extras.draftData || null,
    isCreationDraft: Boolean(extras.isCreationDraft),
    totalHt: Number(row.total_ht || 0),
    totalTtc: Number(row.total_ttc || 0),
    createdAt: extras.createdAt || String(row.created_at || "").slice(0, 10),
    createdAtIso: row.created_at || "",
    updatedAt: row.updated_at || "",
    signatureToken: extras.signatureToken || "",
    signatureProvider: extras.signatureProvider || "",
    acceptanceReason: extras.acceptanceReason || "",
    acceptanceNote: extras.acceptanceNote || "",
    sentAt: extras.sentAt || "",
    readyAt: extras.readyAt || "",
    refusedAt: extras.refusedAt || "",
    refusalReason: extras.refusalReason || "",
    signedAt: extras.signedAt || "",
    signerName: extras.signerName || "",
    signerEmail: extras.signerEmail || "",
    signaturePlace: extras.signaturePlace || "",
    signerMessage: extras.signerMessage || "",
    archivedAt: extras.archivedAt || "",
    cancelledAt: extras.cancelledAt || "",
    restoredAt: extras.restoredAt || "",
    clientPortalUserId: extras.clientPortalUserId || "",
    clientPortalAccess: extras.clientPortalAccess || null,
    signatureUrl: extras.signatureUrl || "",
    localSignatureUrl: extras.localSignatureUrl || "",
    signatureClientAccess: extras.signatureClientAccess || null,
    signatureAccessIdentifier: extras.signatureAccessIdentifier || "",
    // Legacy plaintext, kept only so signature-login can migrate it once (see
    // that route) — new sends never write this field again, only the hash.
    signatureAccessPassword: extras.signatureAccessPassword || "",
    signatureAccessPasswordHash: extras.signatureAccessPasswordHash || "",
    signatureAccessPasswordSalt: extras.signatureAccessPasswordSalt || "",
    signatureAccessCreatedAt: extras.signatureAccessCreatedAt || "",
    // Set only on devis auto-generated from a Radar des Chantiers offer (see
    // app/api/estimer-devis/route.js) — lets the UI badge them as "provisoire
    // / IA" and trace them back to the offer they came from.
    chantierOffreId: extras.chantierOffreId || "",
    aiGenerated: Boolean(extras.aiGenerated),
    // Devis interne cree par l'expertise IA (app/api/expertise-koji/route.js)
    // avant meme la publication de l'offre — jamais montre au particulier ni
    // a une entreprise. Le devis qu'une entreprise voit est une COPIE
    // (app/api/estimer-devis/route.js), pas ce devis-ci.
    internalOnly: Boolean(extras.internalOnly),
    // Conseils (avec impact %) proposes par l'expertise IA sur ce devis
    // interne — permet de recalculer la fourchette publiee cote serveur a
    // partir des conseils selectionnes par le particulier, sans jamais
    // faire confiance a un chiffre envoye par le client.
    expertiseConseils: Array.isArray(extras.expertiseConseils) ? extras.expertiseConseils : null,
    expertiseDelaiJours: extras.expertiseDelaiJours != null ? Number(extras.expertiseDelaiJours) : null,
    // Etapes de paiement definies par l'entreprise dans son devis (module D,
    // paiement echelonne Radar des Chantiers) — [{ id, label, percent }],
    // somme des percent = 100. Absent = pas encore defini par l'entreprise.
    paymentMilestones: Array.isArray(extras.paymentMilestones) ? extras.paymentMilestones : null,
    // Distingue les deux chemins de creation de devis : "manuel" (par
    // defaut, cree/rempli ligne par ligne) ou "ia_complet" (devis 100%
    // genere par l'IA en un appel, app/api/devis-ia/route.js). N'affecte
    // aucun comportement du chemin manuel — sert juste a suivre les deux
    // chemins separement (lib/ia-devis-outcomes.js).
    mode: extras.mode === "ia_complet" ? "ia_complet" : "manuel",
    // Detail par lot valide par l'entreprise avant la generation du devis
    // 100% IA — [{ nom, laborLevel, joursEstimes }] — sert de trace pour le
    // coefficient de prix deterministe applique (voir app/api/devis-ia) et
    // pour enrichir la bibliotheque de prix plus tard.
    iaLotDetails: Array.isArray(extras.iaLotDetails) ? extras.iaLotDetails : null,
    // Set uniquement sur un devis genere depuis la visite guidee (voir
    // app/api/marketplace/offres/[id]/visite/route.js) — pointe vers
    // l'enregistrement complet et horodate de la visite dans
    // db.chantierVisites, pour tracabilite.
    visiteId: extras.visiteId || ""
  };
}

export function quoteToRow(quote, userId) {
  const totalHt = Number(quote.totalHt || 0);
  const totalTtc = Number(quote.totalTtc || 0);
  const vatRate = quote.vatRate != null
    ? Number(quote.vatRate)
    : (totalHt > 0 ? Math.round(((totalTtc - totalHt) / totalHt) * 100) : 20);
  return {
    user_id: userId,
    chantier_id: quote.projectId || null,
    status: quote.status || "Brouillon",
    reference: quote.quoteNumber,
    total_ht: totalHt,
    total_ttc: totalTtc,
    tva_rate: vatRate,
    rooms: quote.rooms || [],
    items: quote.items || [],
    metadata: {
      quoteNumber: quote.quoteNumber,
      date: quote.quoteDate,
      validity: quote.validityDays,
      siteAddress: quote.chantierAddress,
      travauxStart: quote.startDate,
      travauxDuration: quote.expectedDuration,
      company: quote.company || {},
      client: { name: quote.client, email: quote.clientEmail, phone: quote.clientPhone }
    },
    web_extras: {
      versionNumber: quote.versionNumber,
      clientReference: quote.clientReference || "",
      clientType: quote.clientType === "societe" ? "societe" : "particulier",
      clientFirstName: quote.clientFirstName || "",
      clientLastName: quote.clientLastName || "",
      clientCompanyName: quote.clientCompanyName || "",
      chantierAddressDetails: quote.chantierAddressDetails || null,
      notes: quote.notes || [],
      surcharges: quote.surcharges || [],
      vatRate: quote.vatRate,
      project: quote.project,
      projectReference: quote.projectReference,
      contactId: quote.contactId || "",
      workDescription: quote.workDescription,
      signatureStatus: quote.signatureStatus,
      draftStep: quote.draftStep,
      draftData: quote.draftData,
      isCreationDraft: quote.isCreationDraft,
      createdAt: quote.createdAt,
      createdAtIso: quote.createdAtIso,
      signatureToken: quote.signatureToken || "",
      signatureProvider: quote.signatureProvider || "",
      acceptanceReason: quote.acceptanceReason || "",
      acceptanceNote: quote.acceptanceNote || "",
      sentAt: quote.sentAt || "",
      readyAt: quote.readyAt || "",
      signedAt: quote.signedAt || "",
      signerName: quote.signerName || "",
      signerEmail: quote.signerEmail || "",
      signaturePlace: quote.signaturePlace || "",
      signerMessage: quote.signerMessage || "",
      archivedAt: quote.archivedAt || "",
      cancelledAt: quote.cancelledAt || "",
      refusedAt: quote.refusedAt || "",
      refusalReason: quote.refusalReason || "",
      restoredAt: quote.restoredAt || "",
      clientPortalUserId: quote.clientPortalUserId || "",
      clientPortalAccess: quote.clientPortalAccess || null,
      signatureUrl: quote.signatureUrl || "",
      localSignatureUrl: quote.localSignatureUrl || "",
      signatureClientAccess: quote.signatureClientAccess || null,
      signatureAccessIdentifier: quote.signatureAccessIdentifier || "",
      // Only ever set by signature-login's one-time legacy migration, never
      // by a fresh send — see buildSignatureAccess in app/api/quotes/route.js.
      signatureAccessPassword: quote.signatureAccessPassword || "",
      signatureAccessPasswordHash: quote.signatureAccessPasswordHash || "",
      signatureAccessPasswordSalt: quote.signatureAccessPasswordSalt || "",
      signatureAccessCreatedAt: quote.signatureAccessCreatedAt || "",
      chantierOffreId: quote.chantierOffreId || "",
      aiGenerated: Boolean(quote.aiGenerated),
      internalOnly: Boolean(quote.internalOnly),
      expertiseConseils: Array.isArray(quote.expertiseConseils) ? quote.expertiseConseils : null,
      expertiseDelaiJours: quote.expertiseDelaiJours != null ? Number(quote.expertiseDelaiJours) : null,
      paymentMilestones: Array.isArray(quote.paymentMilestones) ? quote.paymentMilestones : null,
      mode: quote.mode === "ia_complet" ? "ia_complet" : "manuel",
      iaLotDetails: Array.isArray(quote.iaLotDetails) ? quote.iaLotDetails : null,
      visiteId: quote.visiteId || ""
    },
    updated_at: new Date().toISOString()
  };
}

// Sequential per-company quote reference, e.g. "2026_1049" — shared by the
// CRUD route and any other route that creates a quote directly (AI-generated
// devis included).
export async function nextQuoteNumberFor(auth, existingReference = "") {
  const year = new Date().getFullYear();
  const prefix = `${year}_`;
  const { data } = await auth.supabase
    .from("quotes")
    .select("reference")
    .eq("user_id", auth.userId)
    .like("reference", `${prefix}%`);
  let maxSeq = 1048;
  for (const row of data || []) {
    const match = (row.reference || "").match(new RegExp(`^${year}_(\\d+)$`));
    if (match) maxSeq = Math.max(maxSeq, parseInt(match[1], 10));
  }
  const existingMatch = existingReference.match(new RegExp(`^${year}_(\\d+)$`));
  if (existingMatch) maxSeq = Math.max(maxSeq, parseInt(existingMatch[1], 10) - 1);
  return `${prefix}${String(maxSeq + 1).padStart(4, "0")}`;
}
