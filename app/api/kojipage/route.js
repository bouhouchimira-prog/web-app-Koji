import Anthropic from "@anthropic-ai/sdk";
import QRCode from "qrcode";
import { badRequest, ok } from "../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../lib/db";
import { loadEntrepriseProfile, resolveEntreprise } from "../../../lib/entreprise-auth";
import { getSupabaseAdmin } from "../../../lib/supabase";
import { mapQuote } from "../../../lib/quote-mapping";
import { sendClientMessageEmail } from "../../../lib/mailer";
import { fixText } from "../../../lib/text";
import { statsAvis, reponseProposee } from "../../../lib/avis";
import { normalizeRealisations, normalizeSpecialties, slugify, uniqueSlugFor } from "../../../lib/company-sites";
import {
  COULEURS, SECTIONS, offreKojiPage, completude, modificationsNonPubliees, contenuPublie, controlePrix, ventesPrestation,
  normaliserPrestation, statsVisites, compteDemandes, delaiReponseMoyen, verifications, compteRealisations,
  photosRealisation, realisationPubliable, lieuArrondi, slugModifiable
} from "../../../lib/kojipage";
import { siteDe, urlPublique, enregistrerPhoto, refsDuSite, urlsPhotos, ventesSignees, statsDe, demandesDe } from "../../../lib/kojipage-serveur";

// KojiPage côté entreprise (maquettes PRO-13, 13.3, 13.4) : brouillon,
// publication en une fois, réalisations (depuis un chantier, accord du
// client), prestations et contrôle des prix, avis, réglages, carte de
// visite. GET → tout l'écran ; PATCH → brouillon ; POST { action } ou
// multipart (photo).

const texte = (v, max) => fixText(String(v ?? "")).trim().slice(0, max);
const MOIS30 = (iso) => String(iso || "").slice(0, 10) >= new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
const somme30 = (parJour = {}) => Object.entries(parJour).filter(([j]) => MOIS30(j)).reduce((n, [, v]) => n + (Number(v) || 0), 0);

async function contexte(request, body = null) {
  const entreprise = await resolveEntreprise(request, body);
  if (!entreprise) return { erreur: badRequest("Session expirée. Reconnectez-vous.", 401) };
  const webUser = await loadEntrepriseProfile(entreprise);
  return { entreprise, webUser, userId: entreprise.userId, offre: offreKojiPage(webUser) };
}

function nouveauSite(db, webUser, userId) {
  const b = webUser.business || {};
  return {
    id: `site-${Date.now()}`,
    userId,
    slug: uniqueSlugFor(db, b.raisonSociale || ""),
    published: false,
    title: b.raisonSociale || "",
    tagline: "",
    presentationText: "",
    contactPhotoDataUrl: "",
    contactName: [b.firstName || b.prenom, b.lastName].filter(Boolean).join(" "),
    companyDescription: "",
    zoneIntervention: b.zoneAddress ? `${b.zoneRadiusKm ? `${b.zoneRadiusKm} km autour de ` : ""}${b.zoneAddress}` : "",
    horaires: "",
    specialties: (webUser.professions || []).filter(Boolean),
    contactPhone: b.phone || "",
    contactEmail: b.emailPro || "",
    contactAddress: "",
    realisations: [],
    prestations: [],
    sections: {},
    couleur: "marine",
    createdAt: new Date().toISOString()
  };
}

function siteOuNouveau(db, webUser, userId) {
  let site = siteDe(db, userId);
  if (!site) {
    site = nouveauSite(db, webUser, userId);
    db.companySites = [site, ...(db.companySites || [])];
  }
  return site;
}

async function chantiersTermines(entreprise, db, userId) {
  const { data } = await entreprise.supabase.from("chantiers").select("*").eq("user_id", userId);
  const clotures = new Map((db.clotures || []).filter((c) => c.userId === userId).map((c) => [c.projectId, c]));
  const photos = (db.chantierPhotos || []).filter((p) => p.userId === userId);
  return (data || [])
    .filter((c) => clotures.get(c.id)?.pv?.signeLe || /termin|clotur|clôtur|livr|archiv/i.test(String(c.status || "")))
    .map((c) => ({
      projectId: c.id,
      titre: c.reference || "Chantier",
      lieu: lieuArrondi({ ville: c.city, codePostal: c.postal_code }),
      termineLe: clotures.get(c.id)?.pv?.signeLe || c.updated_at || "",
      avant: photos.filter((p) => p.projectId === c.id && p.phase === "avant").length,
      apres: photos.filter((p) => p.projectId === c.id && p.phase === "apres").length
    }))
    .sort((a, b) => String(b.termineLe).localeCompare(String(a.termineLe)))
    .slice(0, 20);
}

export async function GET(request) {
  const c = await contexte(request);
  if (c.erreur) return c.erreur;
  const { entreprise, webUser, userId, offre } = c;
  const db = await readDb();
  const site = siteDe(db, userId) || nouveauSite(db, webUser, userId);
  const [ventes, chantiers] = await Promise.all([ventesSignees(entreprise.supabase, userId).catch(() => []), chantiersTermines(entreprise, db, userId).catch(() => [])]);
  const prestations = (site.prestations || []).map((p) => ({ ...p, controle: controlePrix(p, ventesPrestation(p, ventes)) }));
  const avis = (db.avis || []).filter((a) => a.userId === userId).sort((a, b) => String(b.creeLe).localeCompare(String(a.creeLe)));
  const distribution = [5, 4, 3, 2, 1].map((n) => ({ note: n, nombre: avis.filter((a) => a.verifie && Number(a.note) === n).length }));
  const demandes = demandesDe(db, userId);
  const stats = statsDe(db, site);
  const urls = await urlsPhotos(refsDuSite(site));
  const { publie, ...brouillon } = site;
  return ok({
    site: brouillon,
    enLigne: Boolean(site.published),
    enLigneDepuis: site.enLigneDepuis || site.createdAt || "",
    publieLe: site.publieLe || "",
    nonPubliees: modificationsNonPubliees(site),
    url: urlPublique(site.slug),
    qr: await QRCode.toDataURL(`${urlPublique(site.slug)}/carte`, { margin: 1, width: 480 }).catch(() => ""),
    offre,
    completude: completude(site, offre),
    verifications: verifications(webUser.business || {}),
    prestations,
    realisations: compteRealisations(site.realisations || []),
    avis: avis.map((a) => ({ id: a.id, auteur: a.auteur, note: a.note, texte: a.texte || "", date: a.creeLe, verifie: Boolean(a.verifie), reponse: a.reponse?.texte || "", signale: Boolean(a.signale), proposee: reponseProposee({ client: a.auteur, note: a.note }) })),
    avisStats: statsAvis(avis),
    distribution,
    avisAuto: site.avisAuto !== false,
    avisEnAttente: (db.clotures || []).filter((x) => x.userId === userId && x.avis?.demandeLe && !avis.some((a) => a.projectId === x.projectId)).length,
    demandes: compteDemandes(demandes),
    delai: delaiReponseMoyen(demandes),
    visites: statsVisites(stats.visites),
    carte: { ouvertures: somme30(stats.carte), contacts: somme30(stats.vcf), demandes: demandes.filter((d) => d.source === "carte" && MOIS30(d.createdAt)).length },
    couleurs: COULEURS,
    sections: SECTIONS,
    slugModifiable: slugModifiable(site),
    chantiers,
    urls,
    dirigeant: [webUser.business?.firstName || webUser.business?.prenom, webUser.business?.lastName].filter(Boolean).join(" "),
    logo: webUser.business?.logoDataUrl || "",
    entreprise: { nom: webUser.business?.raisonSociale || "", telephone: webUser.business?.phone || "", email: webUser.business?.emailPro || webUser.email || "", adresse: [webUser.business?.addressLine1, webUser.business?.postalCode, webUser.business?.city].filter(Boolean).join(", ") }
  });
}

// Brouillon : rien ne part en ligne avant « Publier les modifications ».
export async function PATCH(request) {
  const body = await request.json().catch(() => ({}));
  const c = await contexte(request, body);
  if (c.erreur) return c.erreur;
  const { webUser, userId, offre } = c;
  const db = await readDb();
  const site = siteOuNouveau(db, webUser, userId);
  const champs = { title: 140, tagline: 140, presentationText: 600, contactName: 80, companyDescription: 1000, zoneIntervention: 140, horaires: 140, contactPhone: 40, contactEmail: 120, contactAddress: 200 };
  for (const [k, max] of Object.entries(champs)) if (body[k] !== undefined) site[k] = texte(body[k], max);
  if (body.contactPhotoDataUrl !== undefined) site.contactPhotoDataUrl = /^(kp:|data:)/.test(String(body.contactPhotoDataUrl)) || body.contactPhotoDataUrl === "" ? body.contactPhotoDataUrl : site.contactPhotoDataUrl;
  if (body.specialties !== undefined) site.specialties = normalizeSpecialties(body.specialties);
  if (body.prestations !== undefined) site.prestations = (Array.isArray(body.prestations) ? body.prestations : []).slice(0, 20).map(normaliserPrestation).filter((p) => p.nom);
  if (body.sections !== undefined) site.sections = Object.fromEntries(SECTIONS.map((s) => [s.id, body.sections?.[s.id] !== false]));
  if (body.indexable !== undefined) site.indexable = body.indexable !== false;
  if (body.couleur !== undefined) {
    if (!offre.couleur && body.couleur !== "marine") return badRequest("La couleur du bandeau est réservée à l'offre Business.", 402);
    site.couleur = COULEURS.some((x) => x.id === body.couleur) ? body.couleur : "marine";
  }
  if (body.carte !== undefined) {
    const k = body.carte || {};
    site.carte = {
      nom: texte(k.nom, 80), personne: texte(k.personne, 80), fonction: texte(k.fonction, 40), telephone: texte(k.telephone, 40), email: texte(k.email, 120),
      metiers: normalizeSpecialties(k.metiers).slice(0, 4), logo: k.logo !== false, photo: k.photo === true, adresse: k.adresse === true, qr: k.qr !== false
    };
  }
  if (body.realisations !== undefined) {
    const liste = normalizeRealisations(body.realisations);
    const photos = liste.reduce((n, r) => n + photosRealisation(r).toutes.length, 0);
    if (photos > offre.maxPhotos) return badRequest(`Votre offre permet ${offre.maxPhotos} photos sur la KojiPage. Passez à l'offre Pro pour des photos illimitées et les avant / après.`, 402);
    // Une réalisation qui attend l'accord du client ne se publie pas à la main.
    const avant = new Map((site.realisations || []).map((r) => [r.id, r]));
    site.realisations = liste.map((r) => (avant.get(r.id)?.statut === "accord_demande" && r.statut === "publiee" ? { ...r, statut: "accord_demande" } : r));
  }
  site.updatedAt = new Date().toISOString();
  await writeDb(db);
  return ok({ nonPubliees: modificationsNonPubliees(site), completude: completude(site, offre) });
}

async function devisClient(projectId) {
  const { data } = await getSupabaseAdmin().from("quotes").select("*").eq("chantier_id", projectId).order("created_at", { ascending: false });
  const devis = (data || []).map(mapQuote);
  return devis.find((q) => q.status === "Signe" || q.signatureStatus === "Signe") || devis[0] || null;
}

async function demanderAccord(db, site, r, webUser) {
  const devis = r.projectId ? await devisClient(r.projectId) : null;
  if (!devis?.clientEmail) return "Pas d'e-mail client sur le devis de ce chantier : ajoutez-le pour demander son accord.";
  const nom = webUser.business?.raisonSociale || "Votre entreprise";
  const lien = `${process.env.NEXT_PUBLIC_SITE_URL || "https://getkoji.io"}/client/chantier/${devis.id}#realisation`;
  const envoi = await sendClientMessageEmail({
    to: devis.clientEmail,
    subject: `${nom} souhaite montrer votre chantier`,
    message: `Bonjour${devis.client ? ` ${devis.client}` : ""},\n\n${nom} souhaite publier quelques photos avant / après de votre chantier « ${r.name} » sur sa page Koji, avec seulement la ville (${r.lieu || "sans adresse"}), jamais votre adresse ni votre nom.\n\nVous pouvez accepter ou refuser ici : ${lien}\n\nSans votre accord, rien n'est publié.`,
    replyTo: webUser.business?.emailPro || webUser.email || undefined
  }).catch(() => null);
  if (envoi && envoi.ok === false) return "L'e-mail n'est pas parti. Réessayez.";
  r.statut = "accord_demande";
  r.quoteId = devis.id;
  r.client = devis.client || "";
  r.accordDemandeLe = new Date().toISOString();
  return "";
}

export async function POST(request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("multipart/form-data")) {
    const c = await contexte(request);
    if (c.erreur) return c.erreur;
    const form = await request.formData();
    const fichier = form.get("photo");
    if (!fichier || typeof fichier === "string") return badRequest("Photo manquante.");
    if (!/^image\/(jpeg|png)$/.test(fichier.type)) return badRequest("Photo JPEG ou PNG seulement.");
    if (fichier.size > 4 * 1024 * 1024) return badRequest("Photo trop lourde (4 Mo au plus).");
    try {
      const ref = await enregistrerPhoto(c.userId, Buffer.from(await fichier.arrayBuffer()), fichier.type);
      const urls = await urlsPhotos([ref]);
      return ok({ ref, url: urls[ref] || "" });
    } catch (e) {
      return badRequest(e.message, 500);
    }
  }

  const body = await request.json().catch(() => ({}));
  const c = await contexte(request, body);
  if (c.erreur) return c.erreur;
  const { entreprise, webUser, userId, offre } = c;
  const db = await readDb();
  const site = siteOuNouveau(db, webUser, userId);
  const maintenant = new Date().toISOString();

  if (body.action === "publier") {
    if (!site.contactPhotoDataUrl) return badRequest("Ajoutez la photo de l'entrepreneur avant de publier : elle est obligatoire.");
    if (!site.title) return badRequest("Indiquez le nom commercial avant de publier.");
    site.publie = contenuPublie(site);
    site.published = true;
    site.publieLe = maintenant;
    site.enLigneDepuis = site.enLigneDepuis || maintenant;
    addHistory(db, { userId, type: "companySite.saved", label: `KojiPage publiée : ${site.slug}`, entityId: site.id, entityType: "companySite" });
    await writeDb(db);
    return ok({ publieLe: maintenant, nonPubliees: 0 });
  }

  if (body.action === "retirer") {
    site.published = false;
    await writeDb(db);
    return ok({ enLigne: false });
  }

  if (body.action === "adresse") {
    const slug = slugify(body.slug);
    if (!slug || slug.length < 3) return badRequest("Adresse trop courte (3 caractères au moins : lettres, chiffres, tirets).");
    if (slug === site.slug) return ok({ slug });
    const m = slugModifiable(site);
    if (!m.ok) return badRequest(`L'adresse se modifie une fois par an : prochaine modification possible le ${m.apres.split("-").reverse().join("/")}.`);
    if ((db.companySites || []).some((s) => s.id !== site.id && (s.slug === slug || (s.anciensSlugs || []).includes(slug)))) return badRequest("Cette adresse est déjà prise.");
    site.anciensSlugs = [...new Set([...(site.anciensSlugs || []), site.slug])];
    site.slug = slug;
    site.slugModifieLe = maintenant;
    await writeDb(db);
    return ok({ slug, url: urlPublique(slug) });
  }

  if (body.action === "realisation-chantier") {
    const projectId = texte(body.projectId, 80);
    const { data: chantier } = await entreprise.supabase.from("chantiers").select("*").eq("id", projectId).maybeSingle();
    if (!chantier || chantier.user_id !== userId) return badRequest("Chantier introuvable.", 404);
    const photos = (db.chantierPhotos || []).filter((p) => p.userId === userId && p.projectId === projectId).sort((a, b) => String(a.takenAt || "").localeCompare(String(b.takenAt || "")));
    const avant = photos.filter((p) => p.phase === "avant").map((p) => `cp:${p.path}`).slice(0, 6);
    const apres = photos.filter((p) => p.phase === "apres").map((p) => `cp:${p.path}`).slice(-6);
    const r = {
      id: `real-${projectId}`,
      name: texte(body.titre, 120) || chantier.reference || "Chantier",
      lieu: lieuArrondi({ ville: chantier.city, codePostal: chantier.postal_code }),
      duree: texte(body.duree, 40),
      texte: texte(body.texte, 300),
      avant, apres, photos: [],
      statut: "brouillon",
      projectId
    };
    site.realisations = normalizeRealisations([r, ...(site.realisations || []).filter((x) => x.id !== r.id)]);
    site.updatedAt = maintenant;
    await writeDb(db);
    return ok({ realisation: r, urls: await urlsPhotos([...avant, ...apres]) });
  }

  if (body.action === "publier-realisation" || body.action === "relancer-accord") {
    const r = (site.realisations || []).find((x) => x.id === body.id);
    if (!r) return badRequest("Réalisation introuvable.", 404);
    const erreur = realisationPubliable(r);
    if (erreur) return badRequest(erreur);
    // Un chantier Koji : l'accord du client est demandé dans Koji Client
    // (déjà donné avec son avis : publiée tout de suite).
    const accordAvis = r.projectId ? (db.avis || []).find((a) => a.projectId === r.projectId && a.accordPhotos) : null;
    if (r.projectId && !accordAvis && !r.accordLe) {
      const err = await demanderAccord(db, site, r, webUser);
      if (err) return badRequest(err);
      addHistory(db, { userId, type: "site.accord_demande", label: `Accord du client demandé : ${r.name}`, entityId: r.projectId, entityType: "project", meta: { projectId: r.projectId } });
    } else {
      r.statut = "publiee";
    }
    site.updatedAt = maintenant;
    await writeDb(db);
    return ok({ realisation: r });
  }

  if (body.action === "ordre") {
    const ids = Array.isArray(body.ids) ? body.ids : [];
    const parId = new Map((site.realisations || []).map((r) => [r.id, r]));
    site.realisations = [...ids.map((id) => parId.get(id)).filter(Boolean), ...(site.realisations || []).filter((r) => !ids.includes(r.id))];
    await writeDb(db);
    return ok({ ordre: site.realisations.map((r) => r.id) });
  }

  if (body.action === "avis-repondre" || body.action === "avis-signaler") {
    const a = (db.avis || []).find((x) => x.id === body.avisId && x.userId === userId);
    if (!a) return badRequest("Avis introuvable.", 404);
    if (body.action === "avis-repondre") {
      const t = texte(body.texte, 1500);
      if (!t) return badRequest("Écrivez votre réponse.");
      a.reponse = { texte: t, publieeLe: a.reponse?.publieeLe || maintenant, modifieeLe: a.reponse ? maintenant : "" };
    } else {
      const motif = texte(body.motif, 500);
      if (!motif) return badRequest("Dites pourquoi cet avis vous semble abusif.");
      a.signale = { le: maintenant, motif };
      await sendClientMessageEmail({ to: "contact@getkoji.io", subject: `Avis signalé · ${webUser.business?.raisonSociale || userId}`, message: `Avis ${a.id} (${a.note}/5, ${a.creeLe}) signalé par l'entreprise.\n\nMotif : ${motif}\n\nTexte de l'avis : ${a.texte || "(sans texte)"}` }).catch(() => null);
    }
    await writeDb(db);
    return ok({ ok: true });
  }

  if (body.action === "avis-auto") {
    site.avisAuto = body.actif !== false;
    await writeDb(db);
    return ok({ avisAuto: site.avisAuto });
  }

  if (body.action === "ameliorer") {
    const t = texte(body.texte, 1000);
    if (!t) return badRequest("Écrivez d'abord quelques mots sur votre entreprise.");
    if (!process.env.ANTHROPIC_API_KEY) return badRequest("Koji n'est pas configuré (clé API manquante).", 500);
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const r = await anthropic.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 400,
        thinking: { type: "disabled" },
        system: "Tu réécris la présentation d'une entreprise du bâtiment pour sa page publique. 2 ou 3 phrases, 400 caractères au plus, ton simple et concret, vouvoiement du lecteur, sans superlatif, sans promesse chiffrée, sans prix, sans rien inventer (garde seulement ce que le texte dit). Réponds par le texte seul.",
        messages: [{ role: "user", content: `Entreprise : ${webUser.business?.raisonSociale || ""}\nMétiers : ${(site.specialties || []).join(", ")}\nZone : ${site.zoneIntervention || ""}\nTexte actuel : ${t}` }]
      });
      const propose = texte(r.content.find((b) => b.type === "text")?.text, 600);
      return ok({ texte: propose || t });
    } catch {
      return badRequest("Koji n'a pas pu réécrire le texte. Réessayez.", 502);
    }
  }

  return badRequest("Action inconnue.");
}
