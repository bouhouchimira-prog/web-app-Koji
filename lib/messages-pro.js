// Messages Koji Pro (maquette PRO-12) : une seule messagerie pour les fils
// des devis (client via sa page de signature ou Koji Client) et du Radar ;
// non lus, heure courte, étiquettes du chantier, filtres. Logique pure,
// testée dans tests/unit/messages-pro.test.js.
const jour = (v) => String(v || "").slice(0, 10);
const JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

// Heure et date à Paris.
export function paris(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const f = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const g = (t) => f.find((x) => x.type === t)?.value || "";
  return { jour: `${g("year")}-${g("month")}-${g("day")}`, h: Number(g("hour")) % 24, m: Number(g("minute")) };
}
export const heure = (iso) => { const p = paris(iso); return p ? `${p.h} h ${String(p.m).padStart(2, "0")}`.replace(/ h 00$/, " h") : ""; };

const ecart = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
// « 9 h 42 » aujourd'hui, « hier », jour de la semaine sur 7 jours, sinon date.
export function quandCourt(iso, aujourdhui) {
  const p = paris(iso);
  if (!p) return "";
  const n = ecart(p.jour, aujourdhui);
  if (n <= 0) return heure(iso);
  if (n === 1) return "hier";
  const d = new Date(`${p.jour}T12:00:00Z`);
  if (n < 7) return JOURS[d.getUTCDay()];
  return `${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`;
}
export function titreJour(j, aujourdhui) {
  const n = ecart(j, aujourdhui);
  if (n === 0) return "Aujourd'hui";
  if (n === 1) return "Hier";
  const d = new Date(`${j}T12:00:00Z`);
  return `${JOURS[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`.replace(/^./, (c) => c.toUpperCase());
}

// Nom public d'un particulier du Radar : prénom et initiale (« Laura M. »).
export function nomCourt(nom = "") {
  const mots = String(nom).trim().split(/\s+/).filter(Boolean);
  if (mots.length < 2) return mots[0] || "Particulier";
  return `${mots[0]} ${mots[mots.length - 1][0].toUpperCase()}.`;
}

// Un fil : messages triés, dernier message, non lus (entrants après la
// dernière lecture).
export function resumeFil(fil = {}, { luLe = "", aujourdhui } = {}) {
  const messages = [...(fil.messages || [])].sort((a, b) => String(a.le).localeCompare(String(b.le)));
  const dernier = messages[messages.length - 1] || null;
  const nonLus = messages.filter((m) => !m.entreprise && (!luLe || String(m.le) > luLe)).length;
  return {
    cle: fil.cle, type: fil.type, pro: Boolean(fil.pro), titre: fil.titre, sousTitre: fil.sousTitre || "",
    projectId: fil.projectId || "", dernier: dernier ? { texte: dernier.texte, le: dernier.le, quand: quandCourt(dernier.le, aujourdhui), entreprise: Boolean(dernier.entreprise) } : null,
    nonLus, initiales: initialesDe(fil.titre)
  };
}

export function initialesDe(nom = "") {
  const mots = String(nom || "?").replace(/^(mme|m\.|mr)\s+/i, "").split(/\s+/).filter(Boolean);
  return (mots.length > 1 ? mots.map((x) => x[0]).join("") : String(mots[0] || "?").slice(0, 2)).slice(0, 2).toUpperCase();
}

export function filtrerFils(fils = [], { filtre = "tous", q = "" } = {}) {
  const t = String(q).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  return fils
    .filter((f) => filtre === "tous" || (filtre === "nonlus" && f.nonLus > 0) || (filtre === "clients" && !f.pro) || (filtre === "pros" && f.pro))
    .filter((f) => !t || `${f.titre} ${f.sousTitre} ${f.dernier?.texte || ""}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(t))
    .sort((a, b) => String(b.dernier?.le || "").localeCompare(String(a.dernier?.le || "")));
}

// Messages groupés par jour pour l'affichage.
export function parJour(messages = [], aujourdhui) {
  const g = [];
  for (const m of [...messages].sort((a, b) => String(a.le).localeCompare(String(b.le)))) {
    const j = paris(m.le)?.jour || jour(m.le);
    if (!g.length || g[g.length - 1].jour !== j) g.push({ jour: j, titre: titreJour(j, aujourdhui), messages: [] });
    g[g.length - 1].messages.push({ ...m, heure: heure(m.le) });
  }
  return g;
}

// Étiquettes du chantier sous le nom ; l'alerte d'abord.
export function etiquettes({ etape = "", livraison = null, devisSigne = false, acompteEchu = false } = {}) {
  const l = [];
  if (livraison?.bloquant) l.push({ texte: `Livraison ${livraison.fournisseur} ${livraison.quand} · ${livraison.raison}`, alerte: true });
  if (acompteEchu) l.push({ texte: "Acompte à relancer", alerte: true });
  if (etape) l.push({ texte: etape, alerte: false });
  if (livraison && !livraison.bloquant) l.push({ texte: `Livraison ${livraison.fournisseur} ${livraison.quand}`, alerte: false });
  if (devisSigne) l.push({ texte: "Devis signé", alerte: false });
  return l;
}
