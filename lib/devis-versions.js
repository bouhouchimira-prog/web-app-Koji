// Versions du devis (maquette PRO-03.6) : écarts entre deux versions
// (lignes concernées seulement, totaux avant / après), message proposé au
// client, note de ce qui se met à jour seul, historique. Une seule version
// signable à la fois ; après signature, plus de version (avenant, PRO-05).
// Mêmes règles dans l'app Koji Pro (mobile/lib/apps/entreprise/devis/
// devis_versions.dart, mêmes exemples dans les tests).
import { quandParis } from "./devis-suivi.js";

const arrondi = (n) => Math.round((Number(n) || 0) * 100) / 100;
const cle = (l) => l.id || `${l.room || ""}|${l.label || ""}`;

function euros(n) {
  const centimes = Math.round(Math.abs(Number(n) || 0) * 100);
  return `${String(Math.floor(centimes / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")},${String(centimes % 100).padStart(2, "0")} €`;
}

function court(jour) {
  const d = new Date(`${String(jour || "").slice(0, 10)}T12:00:00Z`);
  return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", day: "numeric", month: "short" }).format(d) : "";
}

// Écarts de la version `avant` à la version `apres` : retirées, modifiées,
// ajoutées ; les lignes identiques sont seulement comptées.
export function ecartsVersions(avant, apres, { tauxTva = 0 } = {}) {
  const lignesAvant = new Map((avant?.lines || []).map((l) => [cle(l), l]));
  const lignesApres = new Map((apres?.lines || []).map((l) => [cle(l), l]));
  const retirees = [];
  const modifiees = [];
  const ajoutees = [];
  let identiques = 0;
  lignesApres.forEach((l, k) => {
    const old = lignesAvant.get(k);
    if (!old) {
      ajoutees.push({ kind: "add", label: l.label, lot: l.room || "", avant: null, apres: arrondi(l.totalHt), ecart: arrondi(l.totalHt) });
    } else if (old.label !== l.label || Math.abs(Number(old.quantity) - Number(l.quantity)) > 0.005 || Math.abs(Number(old.totalHt) - Number(l.totalHt)) > 0.005) {
      modifiees.push({
        kind: "mod",
        label: l.label,
        labelAvant: old.label !== l.label ? old.label : "",
        lot: l.room || "",
        quantiteAvant: Number(old.quantity),
        quantite: Number(l.quantity),
        unite: l.unit || "",
        avant: arrondi(old.totalHt),
        apres: arrondi(l.totalHt),
        ecart: arrondi(l.totalHt - old.totalHt)
      });
    } else {
      identiques += 1;
    }
  });
  lignesAvant.forEach((l, k) => {
    if (!lignesApres.has(k)) retirees.push({ kind: "del", label: l.label, lot: l.room || "", avant: arrondi(l.totalHt), apres: null, ecart: arrondi(-l.totalHt) });
  });
  const lignes = [...retirees, ...modifiees, ...ajoutees];
  const taux = Number(tauxTva) || 0;
  return {
    lignes: lignes.map((l) => ({ ...l, ecartTtc: arrondi(l.ecart * (1 + taux / 100)) })),
    identiques,
    totalHt: { avant: arrondi(avant?.totalHt), apres: arrondi(apres?.totalHt), ecart: arrondi(Number(apres?.totalHt || 0) - Number(avant?.totalHt || 0)) },
    totalTtc: { avant: arrondi(avant?.totalTtc), apres: arrondi(apres?.totalTtc), ecart: arrondi(Number(apres?.totalTtc || 0) - Number(avant?.totalTtc || 0)) }
  };
}

// « 2 lignes concernées · les 9 autres sont identiques ».
export function resumeEcarts(e) {
  const n = e.lignes.length;
  if (!n) return e.identiques ? `Aucune ligne modifiée · les ${e.identiques} lignes sont identiques` : "Aucune ligne modifiée";
  const concernees = `${n} ligne${n > 1 ? "s" : ""} concernée${n > 1 ? "s" : ""}`;
  if (!e.identiques) return concernees;
  return `${concernees} · ${e.identiques > 1 ? `les ${e.identiques} autres sont identiques` : "l'autre est identique"}`;
}

const LIBELLE_KIND = { del: "Retiré", mod: "Modifié", add: "Ajouté" };
export const libelleEcart = (kind) => LIBELLE_KIND[kind] || "";

// « + 181,20 », « − 396,00 », « — » pour un montant absent.
export function signe(n) {
  if (n == null) return "—";
  const v = arrondi(n);
  if (!v) return "0,00";
  return `${v > 0 ? "+" : "−"} ${euros(v).replace(" €", "")}`;
}

// Message proposé au client avec la nouvelle version.
export function messageVersion({ client = "", numero = 2, ecarts, totalTtc = 0 } = {}) {
  const changes = (ecarts?.lignes || []).map((l) => `« ${l.label} » ${l.kind === "del" ? "retiré" : l.kind === "add" ? "ajouté" : "modifié"}`);
  const liste = changes.length > 3 ? `${changes.slice(0, 3).join(", ")} et ${changes.length - 3} autre${changes.length - 3 > 1 ? "s" : ""} changement${changes.length - 3 > 1 ? "s" : ""}` : changes.length > 1 ? `${changes.slice(0, -1).join(", ")} et ${changes.at(-1)}` : changes[0] || "";
  return [
    `Bonjour${client ? ` ${client}` : ""}, voici la version ${numero} du devis${liste ? ` : ${liste}` : ""}.`,
    `Le total passe à ${euros(totalTtc)} TTC.`,
    numero > 1 ? `La version ${numero - 1} reste consultable mais ne peut plus être signée.` : ""
  ].filter(Boolean).join(" ");
}

// Ce qui se met à jour seul avec la nouvelle version.
export function noteMiseAJour({ numero = 2, numeroDevis = "", acompteTtc = 0, finValidite = "" } = {}) {
  const parts = [acompteTtc > 0 ? `acompte prévu (${euros(acompteTtc)} TTC)` : "", "liste des fournitures", finValidite ? `validité (${court(finValidite)})` : "validité"].filter(Boolean);
  return `Mis à jour avec la version ${numero} : ${parts.join(", ")}.${numeroDevis ? ` Numéro ${numeroDevis} conservé.` : ""}`;
}

// Historique : versions envoyées, vue, relances, messages du client,
// signature, dans l'ordre.
export function historiqueDevis(q, { messages = [] } = {}) {
  const ev = [];
  (q.versions || []).forEach((v) => ev.push({ le: v.sentAt, label: `Version ${Number(v.number) || 1} envoyée` }));
  if (!(q.versions || []).length && q.sentAt) ev.push({ le: q.sentAt, label: `Version ${Number(q.versionNumber) || 1} envoyée` });
  if (q.viewedAt) ev.push({ le: q.viewedAt, label: "Vue par le client" });
  (q.relances || []).forEach((r) => ev.push({ le: r.le, label: "Relancé" }));
  messages.filter((m) => !m.entreprise).forEach((m) => ev.push({ le: m.le, label: `Message de ${m.auteur || q.client || "la cliente"}` }));
  if (q.signedAt) ev.push({ le: q.signedAt, label: "Signé" });
  return ev
    .filter((e) => e.le)
    .sort((a, b) => String(a.le).localeCompare(String(b.le)))
    .map((e) => ({ ...e, quand: quandParis(e.le) }));
}
