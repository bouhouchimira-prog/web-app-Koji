// Réserves d'un chantier (maquette PRO-02.3) : prises en photo, attribuées
// (vous, un compagnon ou un sous-traitant) avec une date ; l'intervenant la
// lève et la photographie, vous validez la levée ou la refusez. La cliente
// peut en proposer une. Les réserves non levées à la réception vont au
// procès-verbal (PRO-02.4).
//
// statut : « a_faire » → « faite » (photo de levée à vérifier) → « levee »
// (validée) ; « proposee » (par la cliente, à attribuer). Refuser une levée
// la remet « a_faire ».

export const STATUTS_RESERVE = ["proposee", "a_faire", "faite", "levee"];

export const FILTRES_RESERVES = [
  { id: "toutes", label: "Toutes" },
  { id: "a_faire", label: "À faire" },
  { id: "faite", label: "À vérifier" },
  { id: "levee", label: "Levées" },
  { id: "proposee", label: "De la cliente" }
];

function jourMois(iso) {
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(d) : "";
}

function heureParis(iso) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(d);
}

function jourParis(iso) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short" }).format(d);
}

// Libellé et ton du statut : « Levée le 2 déc. à 15:10 », « Faite · photo à
// vérifier », « À faire » (ou « En retard » passé la date), « Proposée par
// la cliente ».
export function statutReserve(r, aujourdhui = new Date().toISOString().slice(0, 10)) {
  switch (r.statut) {
    case "levee":
      return { label: r.leveeLe ? `Levée le ${jourParis(r.leveeLe)} à ${heureParis(r.leveeLe)}` : "Levée", ton: "ok" };
    case "faite":
      return { label: "Faite · photo à vérifier", court: "À vérifier", ton: "e" };
    case "proposee":
      return { label: "Proposée par la cliente", court: "De la cliente", ton: "pr" };
    default:
      return r.pourLe && String(r.pourLe).slice(0, 10) < aujourdhui
        ? { label: "En retard", ton: "b" }
        : { label: "À faire", ton: "o" };
  }
}

export function compterReserves(reserves) {
  const c = { toutes: reserves.length, a_faire: 0, faite: 0, levee: 0, proposee: 0 };
  for (const r of reserves) if (c[r.statut] !== undefined) c[r.statut] += 1;
  // Pastille de l'onglet : ce qui demande une action (à faire, à vérifier,
  // proposé par la cliente).
  c.badge = c.a_faire + c.faite + c.proposee;
  return c;
}

export function prochainNumero(reserves) {
  return reserves.reduce((n, r) => Math.max(n, Number(String(r.numero || "").replace(/\D/g, "")) || 0), 0) + 1;
}

// « Mur WC · signalée par Moi · 1er déc. »
export function sousTitreReserve(r) {
  const jour = r.creeLe ? jourParis(r.creeLe).replace(/^1 /, "1er ") : "";
  return [r.lieu, `signalée par ${r.source === "client" ? r.signaleePar || "la cliente" : "vous"}`, jour].filter(Boolean).join(" · ");
}

export function pourLe(r) {
  return r.pourLe ? jourMois(r.pourLe) : "—";
}

// Réserves encore ouvertes (pour le procès-verbal de réception).
export function reservesNonLevees(reserves) {
  return reserves.filter((r) => r.statut !== "levee");
}
