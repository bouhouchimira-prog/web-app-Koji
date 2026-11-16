// Situation de travaux (maquette PRO-06) : avancement cumulé par lot, prérempli
// depuis le suivi des lots ; travaux réalisés cumulés − déjà facturé −
// retenue de garantie = montant de la situation. Mêmes règles dans l'app
// Koji Pro (montants recalculés par le site, jamais repris du téléphone).

const r2 = (n) => Math.round((Number(n) || 0) * 100 + Number.EPSILON * 100) / 100;

// Avancement d'un lot d'après ses tâches : part des tâches faites, arrondie
// à 5 %. Sans tâche : 0.
export function avancementLot(nomLot, taches = []) {
  const du = taches.filter((t) => String(t.room || t.lot || "") === nomLot);
  if (!du.length) return 0;
  const faites = du.filter((t) => t.done || t.status === "Terminee" || t.status === "Terminée").length;
  return Math.round(((faites / du.length) * 100) / 5) * 5;
}

// lots : [{ nom, ht, pct }] ; dejaFactureHt : factures précédentes du devis
// (acompte, situations), HT ; tauxRetenue en %, tauxTva en %.
export function calculerSituation({ lots = [], dejaFactureHt = 0, tauxRetenue = 0, tauxTva = 20 } = {}) {
  const lignes = lots.map((l) => {
    const pct = Math.max(0, Math.min(100, Number(l.pct) || 0));
    return { nom: l.nom, ht: r2(l.ht), pct, montant: r2((Number(l.ht) || 0) * pct / 100) };
  });
  const cumuleHt = r2(lignes.reduce((s, l) => s + l.montant, 0));
  const deja = r2(dejaFactureHt);
  const base = r2(Math.max(0, cumuleHt - deja));
  const retenueHt = r2(base * (Number(tauxRetenue) || 0) / 100);
  const ht = r2(base - retenueHt);
  const tva = r2(ht * (Number(tauxTva) || 0) / 100);
  return { lignes, cumuleHt, dejaFactureHt: deja, retenueHt, tauxRetenue: Number(tauxRetenue) || 0, ht, tva, ttc: r2(ht + tva), tauxTva: Number(tauxTva) || 0 };
}

// Échéance à 30 jours.
export function echeance(jour, jours = 30) {
  const d = new Date(`${String(jour).slice(0, 10)}T12:00:00Z`);
  return Number.isFinite(d.getTime()) ? new Date(d.getTime() + jours * 86400000).toISOString().slice(0, 10) : "";
}

// Message au client proposé : lots terminés, lots en cours.
export function messageSituation({ client = "", lignes = [], numero = 1, finPrevue = "" } = {}) {
  const finis = lignes.filter((l) => l.pct >= 100).map((l) => l.nom.toLowerCase());
  const enCours = lignes.filter((l) => l.pct > 0 && l.pct < 100).map((l) => `${l.nom.toLowerCase()} à ${l.pct} %`);
  const point = [finis.length ? `${finis.join(" et ")} ${finis.length > 1 ? "terminés" : "terminé"}` : "", enCours.join(", ")].filter(Boolean).join(", ");
  const fin = finPrevue ? ` Fin prévue le ${new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", day: "numeric", month: "long" }).format(new Date(`${finPrevue}T12:00:00Z`))}.` : "";
  return `Bonjour${client ? ` ${client}` : ""}, voici la situation n° ${numero}${point ? ` : ${point}` : ""}. Les photos sont dans votre espace Koji.${fin}`;
}

// Avoir (PRO-06.1) : ventilé au taux de la facture d'origine ; la facture
// corrigée reprend le même HT au nouveau taux.
export function avoirCorrige(ttc, tauxOrigine = 20, nouveauTaux = tauxOrigine) {
  const ht = r2((Number(ttc) || 0) / (1 + (Number(tauxOrigine) || 0) / 100));
  const tva = r2((Number(ttc) || 0) - ht);
  return { ht, tva, ttc: r2(ttc), nouveauTtc: r2(ht * (1 + (Number(nouveauTaux) || 0) / 100)) };
}
