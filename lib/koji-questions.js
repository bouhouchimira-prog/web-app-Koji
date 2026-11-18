// Koji répond aux questions sur l'entreprise (maquettes PRO-18 à 18.2).
// Claude lit les données par des outils en lecture seule ; chaque chiffre
// est calculé ici, par Koji, depuis les données du compte, et vient avec sa
// source (lien vers la page). Koji prépare des actions (ouvrir une page,
// relancer, écrire au client) que l'utilisateur valide : rien ne part seul.
import Anthropic from "@anthropic-ai/sdk";
import { coutChantier } from "./depenses.js";
import { aRelancer, messageRelance, statutDevis } from "./devis-liste.js";
import { resteDu } from "./encaissements.js";

const MODELE = "claude-sonnet-5";
const j10 = (v) => String(v || "").slice(0, 10);
const plus = (j, n) => new Date(Date.parse(`${j}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const eur = (n) => `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.round((Number(n) || 0) * 100) / 100).replace(/ | /g, " ")} €`;
const date = (j) => (j ? j10(j).split("-").reverse().join("/") : "");
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export const MENTION_IA = "Réponse de Koji, assistant IA · vérifiez avant de décider";

// Une question (et non une demande de création, modification ou suppression).
export function estQuestion(message = "") {
  const m = norm(message).trim();
  if (!m) return false;
  if (/^(cree|creer|ajoute|ajouter|supprime|supprimer|efface|modifie|modifier|change|renomme|ouvre|ouvrir|planifie|enregistre|note)\b/.test(m)) return false;
  return m.endsWith("?") || /^(qui|que|quoi|quel|quelle|quels|quelles|combien|ou |est-ce|comment|pourquoi|quand|je peux|puis-je|peut-on|ai-je|y a-t-il|dois-je|resume|fais le point|point sur|ou en est)/.test(m);
}

// --- Données ------------------------------------------------------------

// Modules serveur chargés à la demande (imports Next sans extension).
export async function chargerDonnees(entreprise, db) {
  const { chargerChantiers, contexteEntreprise, piecesDe } = await import("./depenses-serveur");
  const { chargerCatalogue } = await import("./fournitures-serveur");
  const { clotureDe } = await import("./cloture-db");
  const userId = entreprise.userId;
  const [{ chantiers, quotes }, ctx, catalogue] = await Promise.all([
    chargerChantiers(entreprise, { archives: false }),
    contexteEntreprise(entreprise),
    chargerCatalogue(entreprise, db).catch(() => ({ articles: [] }))
  ]);
  return { userId, db, chantiers, quotes, coutHoraire: ctx.coutHoraire, entreprise: ctx.company.name, articles: catalogue.articles || [], pieces: piecesDe(db, userId), clotureDe, aujourdhui: new Date().toISOString().slice(0, 10) };
}

function coutDe(d, c) {
  const quote = c.quote;
  const avenants = quote ? (d.db.avenants || []).filter((a) => a.userId === d.userId && a.quoteId === quote.id) : [];
  return coutChantier({
    quote, avenants, articles: d.articles,
    pieces: d.pieces.filter((p) => p.projectId === c.projectId),
    pointages: (d.db.attendanceEntries || []).filter((e) => e.userId === d.userId && e.projectId === c.projectId),
    workers: (d.db.workers || []).filter((w) => w.userId === d.userId),
    taches: (d.db.tasks || []).filter((t) => t.userId === d.userId && t.projectId === c.projectId),
    coutHoraire: d.coutHoraire,
    cloture: Boolean(d.clotureDe?.(d.db, c.projectId, d.userId)?.pv?.signeLe)
  });
}

const facturesDe = (d) => (d.db.invoices || []).filter((f) => f.userId === d.userId && !f.archived && f.kind !== "avoir");

function trouverChantier(d, ref = "") {
  const r = norm(ref);
  return d.chantiers.find((c) => c.projectId === ref) || d.chantiers.find((c) => r && (norm(c.title).includes(r) || norm(c.quote?.client).includes(r) || r.includes(norm(c.title))));
}

// --- Outils (lecture seule) ----------------------------------------------

export const OUTILS = [
  { name: "marges_chantiers", description: "Coût réel et marge de chaque chantier en cours (marge prévue, marge estimée à la fin, dépensé, lot qui dépasse). Pour « quels chantiers perdent de l'argent », « marge du mois ».", input_schema: { type: "object", properties: {} } },
  { name: "a_encaisser", description: "Factures émises non soldées : client, reste dû, échéance, jours de retard, total. Pour « qui me doit de l'argent », « impayés ».", input_schema: { type: "object", properties: {} } },
  { name: "devis_en_attente", description: "Devis envoyés non signés, avec ceux à relancer et le message de relance prêt.", input_schema: { type: "object", properties: {} } },
  { name: "agenda", description: "Tâches du planning et rendez-vous entre deux dates (AAAA-MM-JJ).", input_schema: { type: "object", properties: { debut: { type: "string" }, fin: { type: "string" } }, required: ["debut", "fin"] } },
  { name: "chantier", description: "Tout sur un chantier : devis, factures et paiements, coût et marge, tâches à venir. Paramètre : nom du chantier, du client, ou identifiant.", input_schema: { type: "object", properties: { ref: { type: "string" } }, required: ["ref"] } },
  { name: "equipe_aujourdhui", description: "Qui est sur quel chantier aujourd'hui, heures de la semaine.", input_schema: { type: "object", properties: {} } },
  {
    name: "repondre",
    description: "Réponse finale à l'utilisateur. Toujours terminer par cet outil.",
    input_schema: {
      type: "object",
      properties: {
        constat: { type: "string", description: "Une ou deux phrases, en français, sans chiffre inventé." },
        points: { type: "array", items: { type: "object", properties: { titre: { type: "string" }, detail: { type: "string" } }, required: ["titre"] } },
        chiffres: { type: "array", items: { type: "object", properties: { label: { type: "string" }, valeur: { type: "string" } }, required: ["label", "valeur"] } },
        sources: { type: "array", items: { type: "object", properties: { label: { type: "string" }, href: { type: "string" } }, required: ["label", "href"] } },
        actions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["ouvrir", "message_client"] },
              label: { type: "string" },
              detail: { type: "string" },
              href: { type: "string" },
              quoteId: { type: "string" },
              texte: { type: "string" }
            },
            required: ["type", "label"]
          }
        },
        suggestions: { type: "array", items: { type: "string" }, description: "Trois questions de suite utiles, courtes." }
      },
      required: ["constat"]
    }
  }
];

export async function executerOutil(d, nom, input = {}) {
  const auj = d.aujourdhui;
  if (nom === "marges_chantiers") {
    return d.chantiers.filter((c) => c.quote).map((c) => {
      const k = coutDe(d, c);
      return {
        chantier: c.title, client: c.quote?.client || "", href: `/depenses/chantier?projet=${c.projectId}`,
        vendu_ht: eur(k.totalHt ?? c.quote?.totalHt), depense: eur(k.depense), marge_prevue: k.margePrevue ? `${k.margePrevue.pct} %` : "coût horaire non renseigné",
        marge_estimee_fin: k.margeFinale ? `${k.margeFinale.pct} % (${eur(k.margeFinale.euros)})` : "—", etat: k.phrase, avancement: `${k.avancement} %`,
        lot_qui_depasse: k.lots.filter((l) => l.prevu > 0 && l.depense > l.prevu * 1.1).map((l) => `${l.lot} : ${eur(l.depense)} pour ${eur(l.prevu)} prévus`).join(" ; ")
      };
    });
  }
  if (nom === "a_encaisser") {
    const liste = facturesDe(d).filter((f) => ["Emise", "Partielle"].includes(f.status) && resteDu(f) > 0).map((f) => ({
      facture: f.invoiceNumber, client: f.client, reste_du: eur(resteDu(f)), echeance: date(f.dueDate),
      retard_jours: f.dueDate && f.dueDate < auj ? Math.round((Date.parse(auj) - Date.parse(j10(f.dueDate))) / 86400000) : 0,
      href: `/facturation?relancer=${f.id}`
    }));
    return { total: eur(facturesDe(d).filter((f) => ["Emise", "Partielle"].includes(f.status)).reduce((s, f) => s + resteDu(f), 0)), factures: liste };
  }
  if (nom === "devis_en_attente") {
    return d.quotes.filter((q) => ["envoye", "relancer"].includes(statutDevis(q, auj).id)).slice(0, 30).map((q) => ({
      devis: q.quoteNumber, client: q.client, quoteId: q.id, montant_ttc: eur(q.totalTtc), envoye_le: date(q.sentAt), statut: statutDevis(q, auj)?.label || q.status,
      a_relancer: aRelancer(q, auj), message_relance: aRelancer(q, auj) ? messageRelance(q, { entreprise: d.entreprise }) : "", href: `/devis?id=${q.id}`
    }));
  }
  if (nom === "agenda") {
    const debut = j10(input.debut) || auj;
    const fin = j10(input.fin) || plus(debut, 6);
    const titres = new Map(d.chantiers.map((c) => [c.projectId, c.title]));
    const noms = new Map((d.db.workers || []).filter((w) => w.userId === d.userId).map((w) => [w.id, w.name]));
    return (d.db.tasks || []).filter((t) => t.userId === d.userId && !t.done && j10(t.startDate || t.dueDate) <= fin && j10(t.endDate || t.dueDate || t.startDate) >= debut).slice(0, 40).map((t) => ({
      tache: t.label, chantier: titres.get(t.projectId) || t.project || "", du: date(t.startDate || t.dueDate), au: date(t.endDate || t.dueDate), equipe: (t.workerIds || []).map((id) => noms.get(id)).filter(Boolean).join(", "), href: "/calendrier"
    }));
  }
  if (nom === "chantier") {
    const c = trouverChantier(d, input.ref);
    if (!c) return { introuvable: true, chantiers: d.chantiers.map((x) => x.title).slice(0, 20) };
    const k = c.quote ? coutDe(d, c) : null;
    const factures = facturesDe(d).filter((f) => f.projectId === c.projectId || (c.quote && f.quoteId === c.quote.id));
    return {
      chantier: c.title, adresse: c.address, statut: c.status, href: `/chantiers?project=${c.projectId}`,
      devis: c.quote ? { numero: c.quote.quoteNumber, client: c.quote.client, quoteId: c.quote.id, statut: statutDevis(c.quote, auj)?.label || c.quote.status, total_ttc: eur(c.quote.totalTtc), href: `/devis?id=${c.quote.id}` } : null,
      factures: factures.map((f) => ({ facture: f.invoiceNumber, type: f.type, montant: eur(f.amountTtc), reste_du: eur(resteDu(f)), statut: f.status, echeance: date(f.dueDate), href: `/facturation?relancer=${f.id}` })),
      cout: k ? { depense: eur(k.depense), marge_prevue: k.margePrevue ? `${k.margePrevue.pct} %` : "—", marge_estimee: k.margeFinale ? `${k.margeFinale.pct} %` : "—", etat: k.phrase, href: `/depenses/chantier?projet=${c.projectId}` } : null,
      taches_a_venir: (d.db.tasks || []).filter((t) => t.userId === d.userId && t.projectId === c.projectId && !t.done).slice(0, 12).map((t) => ({ tache: t.label, du: date(t.startDate || t.dueDate), au: date(t.endDate || t.dueDate) }))
    };
  }
  if (nom === "equipe_aujourdhui") {
    const { resumeEquipe } = await import("./equipe-serveur");
    const r = resumeEquipe(d.db, d.userId, { chantiers: new Map(d.chantiers.map((c) => [c.projectId, { title: c.title, adresse: c.address }])) });
    return { equipe: r.lignes.map((l) => ({ nom: l.nom, statut: l.texte, chantier: l.chantier })), heures_semaine: `${Math.round(r.grille.total / 6) / 10} h`, href: "/equipe" };
  }
  return { erreur: "outil inconnu" };
}

// --- Nettoyage de la réponse ---------------------------------------------

const texte = (v, n = 400) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
export function nettoyerReponse(r = {}, hrefsConnus = new Set()) {
  const lienOk = (h) => typeof h === "string" && h.startsWith("/") && !h.startsWith("//") && (hrefsConnus.size === 0 || hrefsConnus.has(h));
  return {
    constat: texte(r.constat, 600) || "Je n'ai pas trouvé de réponse dans vos données.",
    points: (r.points || []).slice(0, 6).map((p) => ({ titre: texte(p.titre, 160), detail: texte(p.detail, 300) })).filter((p) => p.titre),
    chiffres: (r.chiffres || []).slice(0, 6).map((c) => ({ label: texte(c.label, 80), valeur: texte(c.valeur, 60) })).filter((c) => c.label && c.valeur),
    sources: (r.sources || []).filter((s) => lienOk(s.href)).slice(0, 5).map((s) => ({ label: texte(s.label, 80), href: s.href })),
    actions: (r.actions || []).slice(0, 4).map((a) => ({ type: a.type === "message_client" ? "message_client" : "ouvrir", label: texte(a.label, 80), detail: texte(a.detail, 200), href: lienOk(a.href) ? a.href : "", quoteId: texte(a.quoteId, 80), texte: texte(a.texte, 1500) }))
      .filter((a) => a.label && ((a.type === "ouvrir" && a.href) || (a.type === "message_client" && a.quoteId && a.texte))),
    suggestions: (r.suggestions || []).slice(0, 3).map((s) => texte(s, 90)).filter(Boolean),
    mention: MENTION_IA
  };
}

function hrefsDe(v, out = new Set()) {
  if (Array.isArray(v)) v.forEach((x) => hrefsDe(x, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if (k === "href" && typeof x === "string") out.add(x); else hrefsDe(x, out); }
  return out;
}

// --- Boucle ----------------------------------------------------------------

export async function repondreQuestion({ entreprise, db, question, page = null, historique = [], client = null, donnees = null }) {
  const d = donnees || (await chargerDonnees(entreprise, db));
  const anthropic = client || new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const system = [
    `Tu es Koji, l'assistant IA de l'entreprise du bâtiment « ${d.entreprise} ». Nous sommes le ${date(d.aujourdhui)}.`,
    "Tu réponds en français, court et concret, à partir des outils : ils lisent les données du compte et calculent les chiffres. N'invente jamais un chiffre, un nom ou une date : recopie ceux des outils. Si l'information manque, dis-le.",
    "Termine toujours par l'outil « repondre » : un constat court, les points bloquants, quelques chiffres, les sources (les href exacts donnés par les outils), et au plus trois actions à valider : « ouvrir » une page (href d'un outil), ou « message_client » (quoteId d'un devis et texte prêt, que l'utilisateur relira). Tu ne fais rien toi-même : un document signé n'est jamais modifié, un envoi est toujours validé par l'utilisateur.",
    page?.label ? `L'utilisateur est sur la page : ${page.label}${page.ref ? ` (référence : ${page.ref})` : ""}. Réponds d'abord sur cet objet.` : ""
  ].filter(Boolean).join("\n");
  const messages = [
    ...historique.slice(-6).map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: texte(m.message, 1500) || "…" })),
    { role: "user", content: question }
  ];
  // L'historique doit commencer par l'utilisateur et alterner.
  while (messages.length && messages[0].role !== "user") messages.shift();
  const fusion = [];
  for (const m of messages) { if (fusion.length && fusion.at(-1).role === m.role) fusion.at(-1).content += `\n${m.content}`; else fusion.push({ ...m }); }

  const hrefs = new Set();
  for (let tour = 0; tour < 6; tour += 1) {
    const r = await anthropic.messages.create({ model: MODELE, max_tokens: 2048, thinking: { type: "disabled" }, system, tools: OUTILS, tool_choice: tour === 5 ? { type: "tool", name: "repondre" } : { type: "any" }, messages: fusion });
    const appels = r.content.filter((b) => b.type === "tool_use");
    const fin = appels.find((b) => b.name === "repondre");
    if (fin) return { reponse: nettoyerReponse(fin.input, hrefs), outils: appels.length };
    fusion.push({ role: "assistant", content: r.content });
    const resultats = [];
    for (const a of appels) {
      let sortie;
      try { sortie = await executerOutil(d, a.name, a.input); } catch (e) { sortie = { erreur: e.message }; }
      hrefsDe(sortie, hrefs);
      resultats.push({ type: "tool_result", tool_use_id: a.id, content: JSON.stringify(sortie).slice(0, 12000) });
    }
    if (!resultats.length) break;
    fusion.push({ role: "user", content: resultats });
  }
  return { reponse: nettoyerReponse({ constat: "Je n'ai pas pu terminer l'analyse. Reformulez la question ou précisez le chantier." }), outils: 0 };
}
