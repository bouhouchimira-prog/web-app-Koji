import Anthropic from "@anthropic-ai/sdk";
import { badRequest, ok } from "../../../lib/http";
import { readDb, writeDb } from "../../../lib/db";
import { resolveEntreprise, loadEntrepriseProfile } from "../../../lib/entreprise-auth";
import { mapQuote } from "../../../lib/quote-mapping";
import { etiquettes, nomCourt, parJour, resumeFil } from "../../../lib/messages-pro";
import { argentClient, correspondAuContact } from "../../../lib/contacts-pro";
import { livraisons } from "../../../lib/calendrier-pro";
import { bonsDe } from "../../../lib/fournitures-serveur";
import { importerClientsDesDevis } from "../../../lib/contacts-serveur";
import { fixText } from "../../../lib/text";
import { ETATS_DEMANDE, clientAffiche, etatDemande, texteProjet } from "../../../lib/kojipage";
import { getSupabaseAdmin } from "../../../lib/supabase";
import { accesReseau } from "../../../lib/reseau";

// Messages (maquette PRO-12) : une seule messagerie pour les fils des devis
// (le client écrit depuis sa page de signature ou Koji Client, table
// quote_messages) et du Radar (une conversation par demande). Non lus,
// contexte du chantier, réponses enregistrées, et Koji qui propose de
// reporter l'information au bon endroit : rien n'est modifié sans l'artisan.
// L'envoi passe par les routes de chaque fil (/api/quotes/[id]/messages,
// /api/marketplace/offres/[id]/messages).
const today = () => new Date().toISOString().slice(0, 10);
const jour = (v) => String(v || "").slice(0, 10);
const REPONSES_DEFAUT = ["Merci, c'est noté.", "Je vous rappelle dans la journée.", "Je passe demain à 8 h."];
const estSigne = (q) => q.status === "Signe" || q.signatureStatus === "Signe";

async function charger(entreprise, db) {
  const userId = entreprise.userId;
  const [{ data: rowsQ }, { data: rowsC }, webUser] = await Promise.all([
    entreprise.supabase.from("quotes").select("*").eq("user_id", userId),
    entreprise.supabase.from("chantiers").select("*").eq("user_id", userId),
    loadEntrepriseProfile(entreprise)
  ]);
  const quotes = (rowsQ || []).map(mapQuote).filter((q) => !q.internalOnly);
  const titres = new Map((rowsC || []).map((c) => [c.id, c.reference || "Chantier"]));
  const adresses = new Map((rowsC || []).map((c) => [c.id, [c.street, c.postal_code, c.city].filter(Boolean).join(", ")]));
  const email = String(webUser.email || "").toLowerCase();
  const ids = quotes.map((q) => q.id);
  const msgs = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await entreprise.supabase.from("quote_messages").select("id, quote_id, text, author_email, author_name, created_at").in("quote_id", ids.slice(i, i + 200));
    msgs.push(...(data || []));
  }
  const fils = [];
  for (const q of quotes) {
    const m = msgs.filter((x) => x.quote_id === q.id);
    if (!m.length) continue;
    fils.push({
      cle: `devis:${q.id}`, type: "client", pro: false, quoteId: q.id, projectId: q.projectId || "",
      titre: q.client || "Client", sousTitre: titres.get(q.projectId) || q.project || q.workDescription?.slice(0, 40) || "",
      messages: m.map((x) => ({ id: x.id, texte: x.text || "", le: x.created_at, entreprise: Boolean(email) && String(x.author_email || "").toLowerCase() === email, auteur: x.author_name || "" }))
    });
  }
  const radar = new Map();
  for (const m of (db.chantierOffreMessages || []).filter((x) => x.entrepriseUserId === userId)) {
    if (!radar.has(m.offerId)) radar.set(m.offerId, []);
    radar.get(m.offerId).push(m);
  }
  for (const [offerId, m] of radar) {
    const o = (db.chantierOffres || []).find((x) => x.id === offerId);
    if (!o) continue;
    fils.push({
      cle: `radar:${offerId}`, type: "radar", pro: false, offreId: offerId, projectId: "",
      titre: nomCourt(o.clientName), sousTitre: [o.metier, String(o.description || "").slice(0, 50)].filter(Boolean).join(" · "),
      messages: m.map((x) => ({ id: x.id, texte: x.message || "", le: x.createdAt, entreprise: x.senderType === "entreprise", kind: x.kind || "text" }))
    });
  }
  // Demandes reçues par la KojiPage (PRO-13.1) : la demande du client, puis
  // les réponses envoyées par e-mail.
  for (const d of (db.companySiteLeads || []).filter((x) => x.userId === userId)) {
    const premier = d.message || (d.projet ? texteProjet(d.projet).split(String.fromCharCode(10)).join(" · ") : "Demande de devis");
    fils.push({
      cle: `kojipage:${d.id}`, type: "kojipage", pro: false, leadId: d.id, projectId: "",
      titre: clientAffiche(d).nom || "Client", sousTitre: `KojiPage · ${d.prestation || d.projet?.piece || "demande de devis"}`,
      messages: [{ id: `${d.id}-0`, texte: premier, le: d.createdAt, entreprise: false }, ...(d.messages || []).map((m, i) => ({ id: `${d.id}-${i + 1}`, texte: m.texte, le: m.le, entreprise: true }))]
    });
  }
  // Échanges du Réseau pro (PRO-14) : les fils « Pros » de la messagerie.
  if (accesReseau(webUser)) {
    const admin = getSupabaseAdmin();
    const { data: echanges } = await admin.from("reseau_echanges").select("*").or(`user_a.eq.${userId},user_b.eq.${userId}`).order("updated_at", { ascending: false }).limit(100);
    const idsE = (echanges || []).map((e) => e.id);
    const [{ data: rm }, { data: besoins }] = idsE.length ? await Promise.all([
      admin.from("reseau_messages").select("*").in("echange_id", idsE).order("created_at"),
      admin.from("reseau_besoins").select("id,title,metier").in("id", [...new Set((echanges || []).map((e) => e.besoin_id).filter(Boolean))])
    ]) : [{ data: [] }, { data: [] }];
    const titreBesoin = new Map((besoins || []).map((b) => [b.id, [b.metier, b.title].filter(Boolean).join(" · ")]));
    for (const e of echanges || []) {
      const m = (rm || []).filter((x) => x.echange_id === e.id);
      if (!m.length) continue;
      fils.push({
        cle: `reseau:${e.id}`, type: "reseau", pro: true, echangeId: e.id, projectId: "",
        titre: (e.user_a === userId ? e.name_b : e.name_a) || "Entreprise", sousTitre: `Réseau pro · ${titreBesoin.get(e.besoin_id) || "contact direct"}`,
        retenu: e.status === "retenu",
        messages: m.map((x) => ({ id: x.id, texte: x.text, le: x.created_at, entreprise: x.from_user === userId }))
      });
    }
  }
  return { quotes, titres, adresses, fils, webUser };
}

function vueListe(db, userId, fils) {
  const lus = db.messagesLus?.[userId] || {};
  const resumes = fils.map((f) => resumeFil(f, { luLe: lus[f.cle] || "", aujourdhui: today() }));
  return {
    fils: resumes,
    compteurs: { nonLus: resumes.reduce((s, f) => s + f.nonLus, 0), filsNonLus: resumes.filter((f) => f.nonLus > 0).length, clients: resumes.filter((f) => !f.pro).length, pros: resumes.filter((f) => f.pro).length },
    reponses: db.reponsesEnregistrees?.[userId] || REPONSES_DEFAUT
  };
}

function contexteDevis(db, userId, fil, ctx) {
  const q = ctx.quotes.find((x) => x.id === fil.quoteId);
  if (!q) return null;
  const projectId = q.projectId || "";
  const taches = (db.tasks || []).filter((t) => t.userId === userId && t.projectId === projectId && !t.done && (t.startDate || t.dueDate));
  const prochaine = taches.sort((a, b) => String(a.startDate || a.dueDate).localeCompare(String(b.startDate || b.dueDate))).find((t) => jour(t.endDate || t.dueDate || t.startDate) >= today());
  const court = (j) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${j}T12:00:00Z`));
  const jourCourt = (j) => new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${j}T12:00:00Z`));
  const etape = prochaine ? `${prochaine.room || prochaine.label} · ${jour(prochaine.startDate) > today() ? `démarre le ${court(jour(prochaine.startDate))}` : "en cours"}` : "";
  const livs = livraisons(bonsDe(db, userId).filter((b) => b.projectId === projectId), { debut: today(), titres: ctx.titres, aujourdhui: today() });
  const liv = livs[0] ? { ...livs[0], quand: jourCourt(livs[0].date) } : null;
  const invoices = (db.invoices || []).filter((i) => i.userId === userId && i.quoteId === q.id);
  const argent = argentClient({ quotes: [q], invoices });
  const photos = (db.chantierPhotos || []).filter((p) => p.userId === userId && p.projectId === projectId).length;
  return {
    projectId, chantier: ctx.titres.get(projectId) || q.project || "", adresse: ctx.adresses.get(projectId) || "",
    etiquettes: etiquettes({ etape, livraison: liv, devisSigne: estSigne(q), acompteEchu: Boolean(argent.echue) }),
    details: [
      etape ? ["Étape", etape] : null,
      liv ? ["Livraison", `${liv.fournisseur} · ${liv.quand}${liv.raison ? ` · ${liv.raison}` : ""}`] : null,
      ["Devis", `${q.quoteNumber || ""} · ${estSigne(q) ? "signé" : "envoyé"}`],
      argent.echue ? ["Acompte", `${argent.echue.invoiceNumber} · à relancer`] : null
    ].filter(Boolean),
    documents: [
      { titre: `Devis ${q.quoteNumber || ""}`, lien: `/devis?id=${q.id}` },
      ...invoices.filter((i) => i.status !== "Brouillon").map((i) => ({ titre: `Facture ${i.invoiceNumber}`, lien: `/facturation` })),
      projectId ? { titre: "Planning du chantier", lien: `/calendrier/export?model=chantier&project=${projectId}` } : null,
      photos ? { titre: `Photos du chantier · ${photos}`, lien: `/chantiers?project=${projectId}` } : null
    ].filter(Boolean),
    dansCeFil: `${fil.titre} et vous. Les sous-traitants du chantier ont leur propre fil.`,
    bons: livs.map((l) => ({ id: l.id, fournisseur: l.fournisseur, date: l.date, heure: l.heure, raison: l.raison })),
    relancerInvoiceId: argent.echue?.id || ""
  };
}

const OUTIL = {
  name: "suite_message",
  description: "Ce que l'entreprise devrait reporter ailleurs après le dernier message du client.",
  input_schema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["livraison", "note", "rien"], description: "livraison : le client précise le lieu, l'heure ou la personne pour une livraison listée ; note : une information utile pour le chantier (accès, présence, préférence) ; rien sinon." },
      resume: { type: "string", description: "Une phrase courte, sans formule de politesse (ex. Livraison Cedeo ven. 13, réception par le gardien avant 12 h)" },
      bonId: { type: "string", description: "Identifiant du bon de commande concerné, pris dans la liste fournie" },
      livraisonHeure: { type: "string", description: "Heure ou créneau de livraison demandé (ex. avant 12 h)" },
      livraisonAdresse: { type: "string", description: "Lieu ou personne qui réceptionne (ex. gardien de l'immeuble)" },
      reponses: { type: "array", items: { type: "string" }, description: "Deux réponses courtes possibles, vouvoiement" }
    },
    required: ["action", "resume", "reponses"]
  }
};

async function suggestion(db, userId, fil, contexte) {
  db.suggestionsMessages = db.suggestionsMessages || {};
  const mes = (db.suggestionsMessages[userId] = db.suggestionsMessages[userId] || {});
  const dernier = [...fil.messages].sort((a, b) => String(a.le).localeCompare(String(b.le))).at(-1);
  if (!dernier || dernier.entreprise) return { s: mes[fil.cle]?.etat === "propose" ? mes[fil.cle] : null, change: false };
  if (mes[fil.cle]?.messageId === dernier.id) return { s: mes[fil.cle].etat === "propose" ? mes[fil.cle] : null, change: false };
  if (!process.env.ANTHROPIC_API_KEY) return { s: null, change: false };
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const r = await anthropic.messages.create({
      model: "claude-sonnet-5", max_tokens: 600, thinking: { type: "disabled" },
      system: "Tu aides un artisan du bâtiment à ne rien oublier de ce que son client lui écrit. Tu proposes au plus une mise à jour ; tu n'inventes rien qui ne soit pas dans les messages.",
      tools: [OUTIL], tool_choice: { type: "tool", name: OUTIL.name },
      messages: [{ role: "user", content: `Chantier : ${contexte?.chantier || "?"}\nLivraisons prévues : ${JSON.stringify(contexte?.bons || [])}\n\nDerniers messages :\n${fil.messages.slice(-6).map((m) => `${m.entreprise ? "Entreprise" : "Client"} : ${m.texte}`).join("\n")}` }]
    });
    const lu = r.content.find((b) => b.type === "tool_use")?.input || {};
    const bon = (contexte?.bons || []).find((b) => b.id === lu.bonId);
    mes[fil.cle] = {
      messageId: dernier.id, etat: lu.action === "rien" ? "rien" : "propose", action: lu.action === "livraison" && !bon ? "note" : lu.action,
      resume: fixText(String(lu.resume || "")).slice(0, 200), bonId: bon?.id || "", livraisonHeure: fixText(String(lu.livraisonHeure || "")).slice(0, 40), livraisonAdresse: fixText(String(lu.livraisonAdresse || "")).slice(0, 120),
      reponses: (Array.isArray(lu.reponses) ? lu.reponses : []).slice(0, 2).map((x) => fixText(String(x)).slice(0, 200)), le: new Date().toISOString()
    };
    return { s: mes[fil.cle].etat === "propose" ? mes[fil.cle] : { reponses: mes[fil.cle].reponses, etat: "rien" }, change: true };
  } catch {
    return { s: null, change: false };
  }
}

export async function GET(request) {
  const entreprise = await resolveEntreprise(request);
  if (!entreprise) return badRequest("Connexion requise.", 401);
  const userId = entreprise.userId;
  const db = await readDb();
  let ctx;
  try { ctx = await charger(entreprise, db); } catch (e) { return badRequest(`Messages indisponibles : ${e.message}`, 502); }
  const url = new URL(request.url);
  if (url.searchParams.get("compteurs") === "1") return ok({ compteurs: vueListe(db, userId, ctx.fils).compteurs });
  if (url.searchParams.get("nouveau") === "1") {
    return ok({ clients: ctx.quotes.filter((q) => (q.status === "Envoye" || estSigne(q)) && !ctx.fils.some((f) => f.quoteId === q.id)).map((q) => ({ quoteId: q.id, titre: q.client || "Client", sousTitre: ctx.titres.get(q.projectId) || q.project || q.quoteNumber || "" })) });
  }
  const cle = url.searchParams.get("fil");
  if (cle) {
    const fil = ctx.fils.find((f) => f.cle === cle);
    const q = !fil && cle.startsWith("devis:") ? ctx.quotes.find((x) => x.id === cle.slice(6)) : null;
    const f = fil || (q ? { cle, type: "client", pro: false, quoteId: q.id, projectId: q.projectId || "", titre: q.client || "Client", sousTitre: ctx.titres.get(q.projectId) || "", messages: [] } : null);
    if (!f) return badRequest("Fil introuvable.", 404);
    const contexte = f.type === "client" ? contexteDevis(db, userId, f, ctx) : f.type === "reseau" ? { chantier: "Réseau pro", etiquettes: [{ texte: "Réseau pro · sans jeton", alerte: false }, ...(f.retenu ? [{ texte: "Retenu", alerte: false }] : [])], details: [["Sujet", f.sousTitre.replace(/^Réseau pro · /, "")]], documents: [{ titre: "Ouvrir dans le Réseau pro", lien: `/reseau-pro?tab=echanges&e=${f.echangeId}` }], dansCeFil: `${f.titre} et vous, entre professionnels.` } : f.type === "kojipage" ? (() => {
      const d = (db.companySiteLeads || []).find((x) => x.id === f.leadId) || {};
      const etat = etatDemande(d);
      return { chantier: "Demande KojiPage", etiquettes: [{ texte: "Demande KojiPage · sans jeton", alerte: false }, { texte: ETATS_DEMANDE[etat], alerte: etat === "a_repondre" }], details: [["Demande", (d.projet ? texteProjet(d.projet) : d.message || "").slice(0, 200)], d.city ? ["Ville", d.city] : null].filter(Boolean), documents: [{ titre: "Fiche de la demande", lien: `/kojipage/demandes?id=${d.id}` }], dansCeFil: `${f.titre} et vous. Vos réponses partent par e-mail.` };
    })() : (() => {
      const o = (db.chantierOffres || []).find((x) => x.id === f.offreId);
      return { chantier: o?.metier || "Demande Radar", etiquettes: [{ texte: "Demande du Radar", alerte: false }], details: [["Demande", String(o?.description || "").slice(0, 160)]], documents: [{ titre: "Fiche de la demande", lien: `/marketplace/${f.offreId}` }], dansCeFil: `${f.titre} et vous.` };
    })();
    db.messagesLus = db.messagesLus || {};
    db.messagesLus[userId] = { ...(db.messagesLus[userId] || {}), [cle]: new Date().toISOString() };
    const { s } = f.type === "client" ? await suggestion(db, userId, f, contexte) : { s: null };
    await writeDb(db);
    return ok({ fil: { ...resumeFil(f, { luLe: new Date().toISOString(), aujourdhui: today() }), quoteId: f.quoteId || "", offreId: f.offreId || "", leadId: f.leadId || "", echangeId: f.echangeId || "" }, jours: parJour(f.messages, today()), contexte, suggestion: s, reponses: db.reponsesEnregistrees?.[userId] || REPONSES_DEFAUT });
  }
  return ok(vueListe(db, userId, ctx.fils));
}

export async function PATCH(request) {
  const body = await request.json().catch(() => ({}));
  const entreprise = await resolveEntreprise(request, body);
  if (!entreprise) return badRequest("Connexion requise.", 401);
  const userId = entreprise.userId;
  const db = await readDb();
  db.reponsesEnregistrees = db.reponsesEnregistrees || {};
  const reponses = db.reponsesEnregistrees[userId] || [...REPONSES_DEFAUT];
  if (body.action === "reponse") {
    const t = fixText(String(body.texte || "")).trim().slice(0, 300);
    if (!t) return badRequest("Réponse vide.");
    db.reponsesEnregistrees[userId] = [t, ...reponses.filter((x) => x !== t)].slice(0, 12);
  } else if (body.action === "retirer-reponse") {
    db.reponsesEnregistrees[userId] = reponses.filter((x) => x !== body.texte);
  } else if (body.action === "suggestion") {
    const s = db.suggestionsMessages?.[userId]?.[body.fil];
    if (!s || s.etat !== "propose") return badRequest("Plus rien à mettre à jour.", 404);
    if (body.decision === "appliquer") {
      if (s.action === "livraison" && s.bonId) {
        const bon = (db.bonsCommande || []).find((b) => b.id === s.bonId && b.userId === userId);
        if (bon) {
          if (s.livraisonHeure) bon.livraisonHeure = s.livraisonHeure;
          if (s.livraisonAdresse) bon.livraisonAdresse = [bon.livraisonAdresse, s.livraisonAdresse].filter(Boolean).join(" · ").slice(0, 200);
          bon.notes = [bon.notes, s.resume].filter(Boolean).join("\n").slice(0, 1000);
          bon.updatedAt = new Date().toISOString();
        }
      } else {
        // Note sur la fiche du client (Contacts), créée si besoin depuis le devis.
        const quoteId = String(body.fil || "").replace(/^devis:/, "");
        const { data } = await entreprise.supabase.from("quotes").select("*").eq("id", quoteId).eq("user_id", userId).maybeSingle();
        const q = data ? mapQuote(data) : null;
        if (q) {
          importerClientsDesDevis(db, userId, [q]);
          const c = (db.contacts || []).find((x) => x.userId === userId && !x.archived && (correspondAuContact(x, q) || (x.sourceQuoteIds || []).includes(q.id)));
          if (c) c.journal = [{ id: `jn-${Date.now()}`, kind: "note", text: `Koji · ${s.resume}`, at: new Date().toISOString() }, ...(c.journal || [])].slice(0, 200);
        }
      }
      s.etat = "applique";
    } else {
      s.etat = "ignore";
    }
  } else {
    return badRequest("Action inconnue.");
  }
  await writeDb(db);
  return ok({ ok: true, reponses: db.reponsesEnregistrees[userId] || reponses });
}

