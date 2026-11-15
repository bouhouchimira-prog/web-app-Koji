"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../../../lib/client-api";
import { estFerie, joursOuvresEntre } from "../../../lib/calendrier-pro";
import { fixText } from "../../../lib/text";

// Planning d'un chantier à exporter (maquette PRO-11.1) : en-tête,
// frise par lot et par semaine, jalons, détail des lots en jours ouvrés,
// livraisons et points à régler (interne seulement).
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const court = (j) => { const [, m, d] = j.split("-").map(Number); return `${d} ${MOIS[m - 1]}`; };
const jour = (v) => String(v || "").slice(0, 10);
const plus = (j, n) => new Date(Date.parse(`${j}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const lundi = (j) => { const d = new Date(`${j}T12:00:00Z`); return plus(j, -((d.getUTCDay() + 6) % 7)); };
const semaineIso = (j) => { const d = new Date(`${j}T12:00:00Z`); const n = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - n); const a = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); return Math.ceil(((d - a) / 86400000 + 1) / 7); };

export function PlanningChantier({ project, tasks = [], workers = [], quote = null, audience = "interne", company = {} }) {
  const [bons, setBons] = useState([]);
  const [extra, setExtra] = useState(null);
  const nomDe = (id) => {
    const w = workers.find((x) => x.id === id);
    if (!w) return "";
    if (audience === "client") return w.type === "Sous-traitant" ? "Sous-traitant" : fixText(company.name || "Notre équipe");
    return fixText(w.name);
  };
  const lots = useMemo(() => {
    const g = new Map();
    for (const t of tasks.filter((x) => x.projectId === project.id)) {
      const d = jour(t.startDate || t.dueDate || t.endDate);
      if (!d) continue;
      const f = jour(t.endDate || t.dueDate || t.startDate) || d;
      const cle = t.room || t.label || "Lot";
      const l = g.get(cle) || { lot: cle, debut: d, fin: f, ids: new Set(), faites: 0, total: 0 };
      if (d < l.debut) l.debut = d;
      if (f > l.fin) l.fin = f;
      (t.workerIds || []).forEach((id) => l.ids.add(id));
      l.total += 1;
      if (t.done) l.faites += 1;
      g.set(cle, l);
    }
    return [...g.values()].sort((a, b) => a.debut.localeCompare(b.debut)).map((l, i) => ({
      ...l, numero: String(i + 1).padStart(2, "0"), jours: joursOuvresEntre(l.debut, l.fin),
      qui: [...new Set([...l.ids].map(nomDe).filter(Boolean))].join(", ") || "à attribuer",
      statut: l.faites === l.total ? "Terminé" : l.faites > 0 || l.debut <= new Date().toISOString().slice(0, 10) ? "En cours" : "Prévu"
    }));
  }, [tasks, project, workers, audience]); // eslint-disable-line react-hooks/exhaustive-deps
  const debut = lots[0]?.debut || "";
  const fin = lots.map((l) => l.fin).sort().at(-1) || "";

  useEffect(() => {
    if (audience === "client") return;
    apiGet("/api/fournitures/bons").then((d) => setBons((d.bons || []).filter((b) => b.projectId === project.id && b.livraisonLe))).catch(() => {});
  }, [project.id, audience]);
  useEffect(() => {
    if (audience !== "interne" || !debut) return;
    apiGet(`/api/calendrier?debut=${debut}&fin=${fin}`).then(setExtra).catch(() => {});
  }, [audience, debut, fin]);

  if (!lots.length) return <p className="empty">Aucun lot daté sur ce chantier.</p>;
  const semaines = [];
  for (let s = lundi(debut); s <= fin; s = plus(s, 7)) semaines.push(s);
  const faits = lots.filter((l) => l.statut === "Terminé").length;
  const feries = [];
  for (let d = debut; d <= fin; d = plus(d, 1)) if (estFerie(d) && new Date(`${d}T12:00:00Z`).getUTCDay() % 6 !== 0) feries.push(d);
  const colonne = (j) => Math.max(0, Math.floor((Date.parse(`${lundi(j)}T12:00:00Z`) - Date.parse(`${semaines[0]}T12:00:00Z`)) / (7 * 86400000)));
  const points = audience === "interne" && extra ? [
    ...(extra.documents || []).filter((d) => lots.some((l) => l.ids.has(d.workerId))).map((d) => `${fixText(d.worker)} · ${d.nom.toLowerCase()} : ${d.texte}`),
    ...(extra.conflits || []).filter((c) => c.taches.some((t) => t.projectId === project.id)).map((c) => `${court(c.jour)} : ${fixText(c.worker)} prévu aussi sur ${c.taches.filter((t) => t.projectId !== project.id).map((t) => fixText(t.chantier)).join(", ")}`)
  ] : [];

  return (
    <div className="pe-ch">
      <div className="pe-info">
        <div><span>Client</span><b>{fixText(project.client || "—")}</b></div>
        <div><span>Chantier</span><b>{fixText(project.address || project.title)}</b></div>
        <div><span>Devis</span><b>{quote ? `${quote.quoteNumber || ""}${quote.signedAt ? ` · signé le ${court(jour(quote.signedAt))}` : ""}` : "—"}</b></div>
        <div><span>Période</span><b>{court(debut)} → {court(fin)} {fin.slice(0, 4)}</b></div>
        <div><span>Avancement</span><b>{faits} / {lots.length} lots · {Math.round((faits / lots.length) * 100)} %</b></div>
      </div>
      <h3>Planning par lot · semaines {semaineIso(semaines[0])} à {semaineIso(semaines.at(-1))} · jours ouvrés</h3>
      <div className="pe-gantt" style={{ "--n": semaines.length }}>
        <div className="pe-gh"><span>Lot</span>{semaines.map((s) => <span key={s}>S{semaineIso(s)}<small>{court(s)}</small></span>)}</div>
        {lots.map((l) => (
          <div className="pe-gr" key={l.lot}>
            <span><b>{l.numero} {fixText(l.lot)}</b><small>{l.qui}</small></span>
            <i className={l.statut === "Terminé" ? "ok" : l.statut === "En cours" ? "ec" : ""} style={{ gridColumn: `${colonne(l.debut) + 2} / ${colonne(l.fin) + 3}` }} />
          </div>
        ))}
      </div>
      <p className="pe-jal">Jalons : début {court(debut)} · fin prévue {court(fin)}{quote?.signedAt ? ` · devis signé le ${court(jour(quote.signedAt))}` : ""}</p>
      <h3>Détail des lots</h3>
      <table className="pe-t">
        <thead><tr><th>Lot</th><th>Intitulé</th><th>Intervenant</th><th>Début</th><th>Fin</th><th className="r">Jours</th><th>Statut</th></tr></thead>
        <tbody>{lots.map((l) => <tr key={l.lot}><td>{l.numero}</td><td>{fixText(l.lot)}</td><td>{l.qui}</td><td>{court(l.debut)}</td><td>{court(l.fin)}</td><td className="r">{l.jours}</td><td>{l.statut}</td></tr>)}</tbody>
      </table>
      {feries.length ? <p className="pe-jal">Jours ouvrés seulement : {feries.map(court).join(", ")} (férié{feries.length > 1 ? "s" : ""}) non compté{feries.length > 1 ? "s" : ""}.</p> : null}
      {audience !== "client" && bons.length ? (
        <>
          <h3>Livraisons</h3>
          {bons.map((b) => <p className="pe-li" key={b.id}>{court(b.livraisonLe)} · {fixText(b.supplierName || "Fournisseur")} · {b.numero}{b.etat === "livre" ? " · livré" : ""}</p>)}
        </>
      ) : null}
      {points.length ? (
        <>
          <h3>Points à régler · interne</h3>
          {points.map((p) => <p className="pe-li" key={p}>{p}</p>)}
        </>
      ) : null}
      <p className="pe-foot">Planning prévisionnel. Les dates peuvent évoluer selon les aléas du chantier ; toute modification est notifiée au client. Édité avec Koji.</p>
    </div>
  );
}
