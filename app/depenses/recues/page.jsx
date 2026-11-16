"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shell } from "../../../components/Shell";
import { apiGet, apiSend } from "../../../lib/client-api";
import { fichierPourEnvoi } from "../../../lib/fichier-client";
import { DepensesTabs, euro, jourCourt } from "../DepensesTabs";
import "../../fournitures/fournitures.css";
import "../depenses.css";

// Factures reçues (maquette PRO-09.3) : factures fournisseurs et de
// sous-traitants des 30 derniers jours, rattachées au chantier ou à
// vérifier ; autoliquidation reconnue. La réception par plateforme agréée
// n'est pas branchée : les factures arrivent par PDF ou photo.
export default function FacturesRecues() {
  const [data, setData] = useState(null);
  const [depot, setDepot] = useState("");
  const [erreur, setErreur] = useState("");

  useEffect(() => { apiGet("/api/depenses").then(setData).catch((e) => setErreur(e.message)); }, []);

  async function deposer(event) {
    const files = [...(event.target.files || [])].slice(0, 10);
    event.target.value = "";
    setErreur("");
    for (const [i, file] of files.entries()) {
      setDepot(`Koji lit ${file.name} (${i + 1}/${files.length})…`);
      try { setData(await apiSend("/api/depenses", { nom: file.name, data: await fichierPourEnvoi(file) })); } catch (e) { setErreur(e.message); }
    }
    setDepot("");
  }

  const etat = (p) => {
    if (p.statut === "rangee") return <span className="fx-etat ok">rattachée</span>;
    if (p.doublonDe) return <span className="fx-etat late">doublon ?</span>;
    return <span className="fx-etat wait">à vérifier</span>;
  };

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack"><span className="eyebrow">Dépenses</span><h1>Factures reçues</h1></div>
        <div className="hact"><label className="btn btn-sec">{depot ? "Lecture…" : "Déposer une facture"}<input type="file" accept="application/pdf,image/*" multiple hidden disabled={Boolean(depot)} onChange={deposer} /></label></div>
      </div>
      <DepensesTabs current="recues" counts={{ ranger: data?.aRanger.length, recues: data?.recues.length }} />
      <div className="dp-pa">
        <div><b>Réception par plateforme agréée : pas encore active</b><small>La réception des factures électroniques est obligatoire depuis le 1er septembre 2026 ; la plateforme partenaire de Koji n'est pas encore choisie. En attendant, déposez les factures en PDF ou en photo : Koji les lit et les rattache au chantier.</small></div>
      </div>
      {depot ? <p className="notice" role="status">{depot}</p> : null}
      {erreur ? <p className="err" role="alert">{erreur}</p> : null}
      {!data ? <p className="muted">Chargement…</p> : (
        <section className="card">
          <div className="card-h"><h2>Reçues ces 30 derniers jours</h2><span className="sm2">{data.recues.length} facture{data.recues.length > 1 ? "s" : ""}</span></div>
          {data.recues.length === 0 ? <div className="empty">Aucune facture fournisseur ces 30 derniers jours. Les tickets de caisse restent dans « À ranger ».</div> : (
            <table className="dp-vs">
              <thead><tr><th>Fournisseur</th><th>Chantier</th><th>État</th><th aria-label="Action" /></tr></thead>
              <tbody>
                {data.recues.map((p) => (
                  <tr key={p.id}>
                    <td><b>{p.fournisseur || "Fournisseur"}</b><small>{[p.numero, p.autoliquidation ? `${euro(p.ht)} HT · autoliquidation` : `${euro(p.ttc)} TTC`, jourCourt(p.date), p.source === "commande" ? `commande ${p.bonNumero || "Koji"}` : ""].filter(Boolean).join(" · ")}</small></td>
                    <td>{p.statut === "rangee" ? `${p.projectTitle || "—"}${p.lot ? ` · ${p.lot}` : ""}` : p.proposition?.title ? `${p.proposition.title} ?` : "à choisir"}</td>
                    <td>{etat(p)}</td>
                    <td className="num"><Link className="link" href={p.statut === "rangee" && p.projectId ? `/depenses/chantier?projet=${p.projectId}` : `/depenses?piece=${p.id}`}>{p.statut === "rangee" ? "Voir" : "Ranger"}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="fx-note" style={{ marginTop: 12 }}>Une facture de sous-traitant en autoliquidation est reconnue (TVA due par votre entreprise). Le contrôle d'écart avec le devis accepté du sous-traitant arrivera avec le Réseau pro.</p>
        </section>
      )}
    </Shell>
  );
}
