// Signaler / bloquer (App Store, règle 1.2) : les apps Koji et Koji Pro
// envoient un signalement de contenu (ou préviennent d'un blocage) par
// POST /api/support/report ; l'équipe le traite sous 24 heures depuis le
// back-office (page Signalements) : retirer le contenu, suspendre ou
// réactiver l'auteur, classer.
//
// Décisions du 20 novembre 2026 :
// - les signalements partent aux deux adresses ci-dessous ;
// - le back-office a les boutons « retirer » et « suspendre » ;
// - le blocage reste sur le téléphone (il survit aux mises à jour de l'app).
//
// Logique pure + accès aux tables passé en paramètre (testé dans
// tests/unit/moderation.test.js sans base réelle).

export const ADRESSES_MODERATION = ["entreprise@getkoji.io", "ablexpertrenov@gmail.com"];
export const TEXTE_RETIRE = "Message retiré par l'équipe Koji.";
export const SITE_BACK_OFFICE = "https://admin.getkoji.io";

const s = (v) => String(v ?? "").trim();
const TYPES = new Set(["message_devis", "conversation", "offre_radar"]);

// « contenu » (Signaler), « blocage » (Bloquer) ou « technique » (le bouton
// « Signaler un problème » du site et des apps, inchangé). Les apps déjà
// installées ne disent la nature qu'en tête du message.
export function natureSignalement(body = {}, message = "") {
  const n = s(body.nature);
  if (n === "contenu" || n === "blocage") return n;
  if (/^\[Signalement contenu\]/.test(message)) return "contenu";
  if (/^\[Blocage\]/.test(message)) return "blocage";
  return "technique";
}

// Ce qui est signalé : { type, id }. Les apps récentes l'envoient dans
// `cible` ; les plus anciennes l'écrivent dans le message
// (« Type : message_devis · id : … »).
export function cibleSignalement(body = {}, message = "") {
  const c = body.cible && typeof body.cible === "object" ? body.cible : null;
  let type = s(c?.type);
  let id = s(c?.id);
  if (!type || !id) {
    const m = /Type : (\S+) · id : (\S+)/.exec(message);
    if (m) [, type, id] = m;
  }
  if (!TYPES.has(type) || !id || id.length > 200 || !/^[\w:.@-]+$/.test(id)) return null;
  return { type, id };
}

// Le fil visé, d'après la cible :
//   devis   : messages d'un devis (table quote_messages)
//   radar   : fil Radar d'une demande et d'une entreprise (bloc koji_web_state)
//   offre   : une demande publiée sur le Radar
//   kojipage: demande reçue par la KojiPage d'une entreprise
//   reseau  : échange du Réseau pro (table reseau_messages)
export function filDeLaCible(cible) {
  if (!cible) return null;
  if (cible.type === "message_devis") return { kind: "devis", quoteId: cible.id };
  if (cible.type === "offre_radar") return { kind: "offre", offerId: cible.id };
  const [kind, a = "", b = ""] = cible.id.split(":");
  if (kind === "devis" && a) return { kind: "devis", quoteId: a };
  if (kind === "radar" && a) return { kind: "radar", offerId: a, entrepriseUserId: b };
  if (kind === "kojipage" && a) return { kind: "kojipage", leadId: a };
  if (kind === "reseau" && a) return { kind: "reseau", echangeId: a };
  return null;
}

// Un compte particulier du site suspendu ne se connecte plus et ne publie
// plus rien (demandes, messages, avis).
export const compteSuspendu = (user) => Boolean(user?.suspendu);
export function particulierSuspendu(db, userId) {
  if (!userId) return false;
  return compteSuspendu((db.users || []).find((u) => u.id === userId));
}
export const MESSAGE_SUSPENDU = "Ce compte est suspendu. Écrivez à contact@getkoji.io.";

// Compte Supabase (entreprise ou app Koji) suspendu : banned_until dans le futur.
export function banni(user, maintenant = Date.now()) {
  const t = Date.parse(user?.banned_until || "");
  return Number.isFinite(t) && t > maintenant;
}

const site = (db, id) => (db.users || []).find((u) => u.id === id && u.accountType === "particulier");
const auteurSite = (u, idSecours = "") => u
  ? { type: "particulier", compte: "site", id: u.id, nom: s(u.name), email: s(u.email), suspendu: compteSuspendu(u) }
  : { type: "particulier", compte: "", id: idSecours, nom: "", email: "", suspendu: false };

// Examine un signalement : le fil, l'auteur du contenu signalé et ses
// contenus dans ce fil. `acces` lit les tables Supabase (voir accesSupabase).
export async function examiner(report, { db, acces }) {
  const cible = report.cible || cibleSignalement({}, s(report.message));
  const fil = filDeLaCible(cible);
  const signaleur = s(report.userId);
  const vide = { cible, fil, auteur: null, contenus: [], peutRetirer: false, peutSuspendre: false };
  if (!fil) return vide;

  if (fil.kind === "offre") {
    const o = (db.chantierOffres || []).find((x) => x.id === fil.offerId);
    if (!o) return vide;
    const auteur = auteurSite(site(db, o.userId), s(o.userId));
    auteur.nom = auteur.nom || s(o.clientName);
    const retiree = o.status === "Retiree";
    return { ...vide, auteur, contenus: [{ id: o.id, texte: s(o.description), le: s(o.createdAt), retire: retiree }], peutRetirer: !retiree, peutSuspendre: Boolean(auteur.compte) };
  }

  if (fil.kind === "radar") {
    const o = (db.chantierOffres || []).find((x) => x.id === fil.offerId);
    if (!o) return vide;
    // Signalé par l'entreprise : l'auteur est le particulier ; signalé par
    // le particulier : l'entreprise du fil.
    const parEntreprise = report.sessionKind === "entreprise" || (!fil.entrepriseUserId && signaleur !== o.userId);
    const entrepriseUserId = fil.entrepriseUserId || (parEntreprise ? signaleur : "");
    const msgs = (db.chantierOffreMessages || []).filter((m) => m.offerId === o.id && m.entrepriseUserId === entrepriseUserId && m.senderType === (parEntreprise ? "particulier" : "entreprise"));
    const contenus = msgs.map((m) => ({ id: m.id, texte: s(m.message), le: s(m.createdAt), retire: Boolean(m.retireLe) }));
    const auteur = parEntreprise
      ? { ...auteurSite(site(db, o.userId), s(o.userId)), nom: s(site(db, o.userId)?.name) || s(o.clientName) }
      : await acces.entreprise(entrepriseUserId);
    return { ...vide, auteur, contenus, peutRetirer: contenus.some((c) => !c.retire), peutSuspendre: Boolean(auteur?.compte) };
  }

  if (fil.kind === "kojipage") {
    const d = (db.companySiteLeads || []).find((x) => x.id === fil.leadId);
    if (!d) return vide;
    const nom = s(d.name || d.nom || d.client?.name || d.contact?.nom);
    const email = s(d.email || d.client?.email || d.contact?.email);
    const retire = Boolean(d.retireLe);
    return { ...vide, auteur: { type: "visiteur", compte: "", id: "", nom, email, suspendu: false }, contenus: [{ id: d.id, texte: s(d.message), le: s(d.createdAt), retire }], peutRetirer: !retire };
  }

  if (fil.kind === "devis") {
    const q = await acces.devis(fil.quoteId);
    if (!q) return vide;
    const pro = await acces.entreprise(q.user_id);
    const emailPro = s(pro?.email).toLowerCase();
    const msgs = await acces.messagesDevis(q.id);
    // Signalé par l'entreprise du devis : l'auteur est le client.
    const parEntreprise = signaleur === q.user_id;
    const choisis = msgs.filter((m) => (s(m.author_email).toLowerCase() === emailPro) !== parEntreprise);
    const contenus = choisis.map((m) => ({ id: m.id, texte: s(m.text), le: s(m.created_at), retire: s(m.text) === TEXTE_RETIRE }));
    let auteur = pro;
    if (parEntreprise) {
      const email = s(choisis[0]?.author_email).toLowerCase();
      const compteSite = email ? (db.users || []).find((u) => u.accountType === "particulier" && s(u.email).toLowerCase() === email) : null;
      auteur = compteSite
        ? auteurSite(compteSite)
        : (email && await acces.compteParEmail(email)) || { type: "particulier", compte: "", id: "", nom: s(choisis[0]?.author_name), email, suspendu: false };
    }
    return { ...vide, auteur, contenus, peutRetirer: contenus.some((c) => !c.retire), peutSuspendre: Boolean(auteur?.compte) };
  }

  if (fil.kind === "reseau") {
    const e = await acces.echange(fil.echangeId);
    if (!e) return vide;
    const autre = e.user_a === signaleur ? e.user_b : e.user_a;
    const msgs = (await acces.messagesEchange(e.id)).filter((m) => m.from_user === autre);
    const contenus = msgs.map((m) => ({ id: m.id, texte: s(m.text), le: s(m.created_at), retire: s(m.text) === TEXTE_RETIRE }));
    const auteur = await acces.entreprise(autre);
    return { ...vide, auteur, contenus, peutRetirer: contenus.some((c) => !c.retire), peutSuspendre: Boolean(auteur?.compte) };
  }
  return vide;
}

const ACTIONS = new Set(["retirer", "suspendre", "reactiver", "classer", "rouvrir"]);
export const actionValide = (a) => ACTIONS.has(a);

// Applique une décision sur un signalement. Modifie `db` (l'appelant
// l'écrit ensuite) et les tables via `acces`. Renvoie { ok, erreur?, detail }.
export async function agir(report, action, { db, acces, par = "", maintenant = new Date().toISOString() }) {
  if (!actionValide(action)) return { ok: false, erreur: "Action inconnue." };
  const ex = await examiner(report, { db, acces });
  const trace = (detail) => {
    report.moderation = report.moderation || { historique: [] };
    report.moderation.historique = [...(report.moderation.historique || []), { action, le: maintenant, par, detail }];
    return { ok: true, detail };
  };

  if (action === "classer" || action === "rouvrir") {
    report.status = action === "classer" ? "traité" : "nouveau";
    if (action === "classer") report.traiteLe = maintenant; else delete report.traiteLe;
    return trace(action === "classer" ? "signalement classé" : "signalement rouvert");
  }

  if (action === "retirer") {
    if (!ex.peutRetirer) return { ok: false, erreur: "Rien à retirer pour ce signalement." };
    const { fil } = ex;
    if (fil.kind === "offre") {
      const o = (db.chantierOffres || []).find((x) => x.id === fil.offerId);
      o.status = "Retiree";
      o.retireeParModeration = maintenant;
      return trace("demande retirée du Radar");
    }
    if (fil.kind === "radar") {
      const ids = new Set(ex.contenus.filter((c) => !c.retire).map((c) => c.id));
      for (const m of db.chantierOffreMessages || []) {
        if (!ids.has(m.id)) continue;
        // L'aperçu du message dans la notification part aussi.
        const apercu = String(m.message || "").slice(0, 140);
        for (const n of db.notifications || []) {
          if (n.offerId === m.offerId && n.type === "radar.message" && n.message === apercu) n.message = TEXTE_RETIRE;
        }
        m.message = TEXTE_RETIRE;
        m.retireLe = maintenant;
        delete m.original;
      }
      return trace(`${ids.size} message${ids.size > 1 ? "s" : ""} retiré${ids.size > 1 ? "s" : ""}`);
    }
    if (fil.kind === "kojipage") {
      const d = (db.companySiteLeads || []).find((x) => x.id === fil.leadId);
      d.message = TEXTE_RETIRE;
      d.retireLe = maintenant;
      return trace("demande KojiPage retirée");
    }
    const ids = ex.contenus.filter((c) => !c.retire).map((c) => c.id);
    if (fil.kind === "devis") await acces.modifierMessagesDevis(ids, TEXTE_RETIRE);
    if (fil.kind === "reseau") await acces.modifierMessagesEchange(ids, TEXTE_RETIRE);
    return trace(`${ids.length} message${ids.length > 1 ? "s" : ""} retiré${ids.length > 1 ? "s" : ""}`);
  }

  // suspendre / reactiver l'auteur
  const a = ex.auteur;
  if (!a?.compte || !a.id) return { ok: false, erreur: "Aucun compte Koji connu pour l'auteur." };
  const suspendre = action === "suspendre";
  if (a.compte === "site") {
    const u = (db.users || []).find((x) => x.id === a.id);
    if (!u) return { ok: false, erreur: "Compte introuvable." };
    if (suspendre) u.suspendu = { le: maintenant, signalement: report.id }; else delete u.suspendu;
  } else {
    await acces.suspendre(a.id, suspendre);
  }
  return trace(`${suspendre ? "compte suspendu" : "compte réactivé"} : ${a.nom || a.email || a.id}`);
}

// Accès réel (clé de service, serveur uniquement).
export function accesSupabase(admin) {
  const nomEntreprise = (u) => {
    const b = u?.business_info && typeof u.business_info === "object" ? u.business_info : {};
    return s(b.raisonSociale || b.companyName || b.name || u?.full_name);
  };
  async function compteSupabase(row, type) {
    if (!row) return null;
    let suspendu = false;
    try {
      const { data } = await admin.auth.admin.getUserById(row.id);
      suspendu = banni(data?.user);
    } catch { /* lecture du statut impossible : on affiche « actif » */ }
    return { type, compte: "supabase", id: row.id, nom: type === "entreprise" ? nomEntreprise(row) : s(row.full_name), email: s(row.email), suspendu };
  }
  return {
    async devis(id) {
      const { data } = await admin.from("quotes").select("id,user_id").eq("id", id).maybeSingle();
      return data || null;
    },
    async messagesDevis(quoteId) {
      const { data } = await admin.from("quote_messages").select("id,text,author_email,author_name,created_at").eq("quote_id", quoteId).order("created_at");
      return data || [];
    },
    async modifierMessagesDevis(ids, texte) {
      if (!ids.length) return;
      const { error } = await admin.from("quote_messages").update({ text: texte }).in("id", ids);
      if (error) throw new Error(error.message);
    },
    async echange(id) {
      const { data } = await admin.from("reseau_echanges").select("id,user_a,user_b,name_a,name_b").eq("id", id).maybeSingle();
      return data || null;
    },
    async messagesEchange(id) {
      const { data } = await admin.from("reseau_messages").select("id,text,from_user,created_at").eq("echange_id", id).order("created_at");
      return data || [];
    },
    async modifierMessagesEchange(ids, texte) {
      if (!ids.length) return;
      const { error } = await admin.from("reseau_messages").update({ text: texte }).in("id", ids);
      if (error) throw new Error(error.message);
    },
    async entreprise(id) {
      if (!id) return null;
      const { data } = await admin.from("users").select("id,email,full_name,business_info,is_pro").eq("id", id).maybeSingle();
      return compteSupabase(data, data?.is_pro === false ? "particulier" : "entreprise");
    },
    async compteParEmail(email) {
      const { data } = await admin.from("users").select("id,email,full_name,business_info,is_pro").ilike("email", email.replace(/[%_\\]/g, (c) => `\\${c}`)).limit(1).maybeSingle();
      return compteSupabase(data, data?.is_pro ? "entreprise" : "particulier");
    },
    async suspendre(id, oui) {
      // ban_duration : « none » lève la suspension ; 100 ans sinon.
      const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: oui ? "876000h" : "none" });
      if (error) throw new Error(error.message);
    }
  };
}
