import { badRequest, ok } from "../../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../../lib/db";
import { loadEntrepriseProfile, resolveEntreprise } from "../../../../lib/entreprise-auth";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { sendClientMessageEmail } from "../../../../lib/mailer";
import { fixText } from "../../../../lib/text";
import { ETATS_DEMANDE, MOTIFS_DECLIN, budgetCompatibilite, clientAffiche, etatDemande, offreKojiPage, sourceDemande, texteProjet } from "../../../../lib/kojipage";
import { demandesDe, messageDevisGuide, preparerBaseDevis, siteDe, urlsPhotos } from "../../../../lib/kojipage-serveur";

// Demandes reçues par la KojiPage (maquette PRO-13.1) : réservées à
// l'entreprise, sans jeton. Coordonnées complètes après la première
// réponse. GET (liste, ?id= fiche) · POST { action: repondre | appele |
// decliner | visite | preparer | devis, id }.

const texte = (v, max) => fixText(String(v ?? "")).trim().slice(0, max);

function ligne(d) {
  const etat = etatDemande(d);
  const client = clientAffiche(d);
  const budget = budgetCompatibilite(d.budget, d.base?.ttc);
  return {
    id: d.id,
    titre: d.titre || d.prestation || (d.projet?.piece ? `${d.projet.piece}${d.projet.surface ? `, ${d.projet.surface} m²` : ""}` : "Demande de devis"),
    client: client.nom,
    ville: d.city || "",
    createdAt: d.createdAt,
    source: d.source || "page",
    sourceTexte: sourceDemande(d.source),
    etat,
    etatTexte: ETATS_DEMANDE[etat],
    budget: budget ? (budget.compatible ? "budget compatible" : budget.texte) : "",
    declinMotif: d.declineeMotif ? MOTIFS_DECLIN[d.declineeMotif] || d.declineeMotif : "",
    quoteNumber: d.quoteNumber || ""
  };
}

async function devisEnvoyes(demandes) {
  const ids = demandes.map((d) => d.quoteId).filter(Boolean);
  if (!ids.length) return;
  const { data } = await getSupabaseAdmin().from("quotes").select("id,status,reference,web_extras").in("id", ids);
  const parId = new Map((data || []).map((q) => [q.id, q]));
  for (const d of demandes) {
    const q = parId.get(d.quoteId);
    if (!q) continue;
    d.quoteNumber = q.reference || "";
    d.devisEnvoye = ["Envoye", "Signe"].includes(q.status) || ["Envoye", "Signe"].includes(q.web_extras?.signatureStatus);
  }
}

async function contexte(request, body = null) {
  const entreprise = await resolveEntreprise(request, body);
  if (!entreprise) return { erreur: badRequest("Session expirée. Reconnectez-vous.", 401) };
  const webUser = await loadEntrepriseProfile(entreprise);
  return { entreprise, webUser, userId: entreprise.userId, offre: offreKojiPage(webUser) };
}

export async function GET(request) {
  const c = await contexte(request);
  if (c.erreur) return c.erreur;
  const db = await readDb();
  const demandes = demandesDe(db, c.userId);
  await devisEnvoyes(demandes).catch(() => null);
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return ok({ demandes: demandes.map(ligne), offre: c.offre });
  const d = demandes.find((x) => x.id === id);
  if (!d) return badRequest("Demande introuvable.", 404);
  const client = clientAffiche(d);
  const urls = await urlsPhotos(d.photos || []);
  const budget = budgetCompatibilite(d.budget, d.base?.ttc);
  return ok({
    demande: {
      ...ligne(d),
      client,
      message: d.message || "",
      projet: d.projet || null,
      projetTexte: d.projet ? texteProjet(d.projet) : "",
      photos: (d.photos || []).map((r) => urls[r]).filter(Boolean),
      base: d.base || null,
      budgetDetail: budget,
      budgetChoix: budget && !budget.compatible ? d.budgetChoix || "" : "",
      messages: d.messages || [],
      visite: d.visite || null,
      quoteId: d.quoteId || "",
      messageDevis: messageDevisGuide(d)
    },
    offre: c.offre
  });
}

function signature(webUser) {
  const b = webUser.business || {};
  return [b.raisonSociale, b.phone].filter(Boolean).join(" · ");
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const c = await contexte(request, body);
  if (c.erreur) return c.erreur;
  const { webUser, userId, offre } = c;
  const db = await readDb();
  const d = (db.companySiteLeads || []).find((x) => x.id === body.id && x.userId === userId);
  if (!d) return badRequest("Demande introuvable.", 404);
  const maintenant = new Date().toISOString();
  const nom = webUser.business?.raisonSociale || "L'entreprise";
  const replyTo = webUser.business?.emailPro || webUser.email || undefined;
  d.messages = d.messages || [];

  if (body.action === "repondre") {
    const t = texte(body.texte, 2000);
    if (!t) return badRequest("Écrivez votre réponse.");
    if (!d.email) return badRequest("Ce client a laissé seulement son téléphone : appelez-le, puis notez « Client appelé ».");
    const envoi = await sendClientMessageEmail({ to: d.email, subject: `${nom} · votre demande de devis`, message: `${t}\n\n${signature(webUser)}`, replyTo }).catch(() => null);
    if (envoi && envoi.ok === false) return badRequest("L'e-mail n'est pas parti. Réessayez.");
    d.messages.push({ texte: t, le: maintenant, entreprise: true });
    d.reponduLe = d.reponduLe || maintenant;
  } else if (body.action === "appele") {
    d.messages.push({ texte: "Client appelé.", le: maintenant, entreprise: true });
    d.reponduLe = d.reponduLe || maintenant;
  } else if (body.action === "decliner") {
    const motif = MOTIFS_DECLIN[body.motif] ? body.motif : "";
    if (!motif) return badRequest("Choisissez un motif.");
    const t = texte(body.texte, 1000);
    if (d.email) {
      await sendClientMessageEmail({
        to: d.email,
        subject: `${nom} · votre demande de devis`,
        message: `Bonjour,\n\nMerci pour votre demande. ${nom} ne peut pas la prendre en charge (${MOTIFS_DECLIN[motif]}).${t ? `\n\n${t}` : ""}\n\nVous pouvez décrire votre projet sur Koji pour trouver une autre entreprise : ${process.env.NEXT_PUBLIC_SITE_URL || "https://getkoji.io"}/particulier`,
        replyTo
      }).catch(() => null);
    }
    d.declineeLe = maintenant;
    d.declineeMotif = motif;
    d.reponduLe = d.reponduLe || maintenant;
  } else if (body.action === "visite") {
    const quand = String(body.date || "");
    const debut = new Date(quand);
    if (Number.isNaN(debut.getTime()) || debut.getTime() < Date.now()) return badRequest("Choisissez une date et une heure à venir.");
    const lisible = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(debut).replace(":", " h ");
    const t = texte(body.texte, 1000);
    if (d.email) {
      const envoi = await sendClientMessageEmail({ to: d.email, subject: `${nom} · proposition de visite`, message: `Bonjour,\n\nPour préparer votre devis, je vous propose une visite le ${lisible}.${t ? `\n\n${t}` : ""}\n\nRépondez à cet e-mail pour confirmer ou proposer un autre moment.\n\n${signature(webUser)}`, replyTo }).catch(() => null);
      if (envoi && envoi.ok === false) return badRequest("L'e-mail n'est pas parti. Réessayez.");
    }
    await getSupabaseAdmin().from("calendar_events").insert({
      user_id: userId, title: `Visite · ${d.name || "demande KojiPage"}`, event_type: "Visite technique", client_name: fixText(d.name || ""),
      address: fixText(d.city || ""), start_at: debut.toISOString(), end_at: new Date(debut.getTime() + 3600000).toISOString(),
      all_day: false, status: "Proposé", progress: 0, notes: (d.projet ? texteProjet(d.projet) : d.message || "").slice(0, 1000)
    }).then(() => null, () => null);
    d.visite = { le: debut.toISOString(), proposeeLe: maintenant };
    d.messages.push({ texte: `Visite proposée le ${lisible}.${t ? ` ${t}` : ""}`, le: maintenant, entreprise: true });
    d.reponduLe = d.reponduLe || maintenant;
  } else if (body.action === "preparer") {
    if (!offre.demandes) return badRequest("La base de devis préparée par Koji est incluse dans les offres Pro et Business.", 402);
    try {
      d.base = await preparerBaseDevis({ db, userId, business: webUser.business || {}, demande: d });
    } catch (e) {
      return badRequest(e.message || "Koji n'a pas pu préparer la base. Réessayez.", 502);
    }
  } else if (body.action === "devis") {
    d.quoteId = texte(body.quoteId, 80);
  } else {
    return badRequest("Action inconnue.");
  }
  addHistory(db, { userId, type: `kojipage.demande.${body.action}`, label: `Demande KojiPage : ${body.action}`, entityId: d.id, entityType: "lead" });
  await writeDb(db);
  return ok({ demande: ligne(d), base: d.base || null, client: clientAffiche(d), messages: d.messages });
}
