"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "../../../components/Shell";
import { apiGet, apiSend, readStoredUser } from "../../../lib/client-api";
import "../../fournitures/fournitures.css";

// Back-office Koji · partenaires (maquette PRO-07.3) : fiche partenaire et
// import de mercuriale avec contrôles ; seules les lignes valides sont
// publiées. Réservé aux comptes admin (vérifié aussi côté serveur).
const MODELE = "Référence;Désignation;Conditionnement;Unité;Prix Koji HT;Prix public HT;Validité\nMD-GC6060A;Grès cérame 60 × 60 rectifié, anthracite;boîte 1,44 m²;m²;46,50;64,90;2026-12-31\n";
const VIDE = { nom: "", email: "", metiers: "", zone: "", adresse: "", livraison: "", franco: "", code: "" };
const jour = (iso) => (iso ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${iso}T12:00:00Z`)) : "—");

export default function AdminPartenaires() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(null);
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState("");
  const [fiche, setFiche] = useState(null);
  const [imp, setImp] = useState(null);
  const [message, setMessage] = useState("");

  const charger = () => apiGet("/api/admin/partenaires").then(setData).catch((e) => setErreur(e.message));
  useEffect(() => {
    if (!readStoredUser()?.isAdmin) { router.replace("/"); return; }
    setAllowed(true);
    charger();
  }, [router]);

  async function enregistrer() {
    try { await apiSend("/api/admin/partenaires", { action: "enregistrer", ...fiche }); setFiche(null); setMessage("Partenaire enregistré."); charger(); } catch (e) { setErreur(e.message); }
  }
  async function lire(p, event) {
    const f = event.target.files?.[0];
    event.target.value = "";
    if (!f) return;
    const csv = await f.text();
    try { setImp({ p, csv, fichier: f.name, apercu: await apiSend("/api/admin/partenaires", { action: "importer", id: p.id, csv, fichier: f.name, apercu: true }) }); } catch (e) { setErreur(e.message); }
  }
  async function publier() {
    try { const r = await apiSend("/api/admin/partenaires", { action: "importer", id: imp.p.id, csv: imp.csv, fichier: imp.fichier }); setImp(null); setMessage(`${r.publie} articles publiés.`); charger(); } catch (e) { setErreur(e.message); }
  }
  async function basculer(p) {
    try { await apiSend("/api/admin/partenaires", { action: "publier", id: p.id, publie: !p.publie }); charger(); } catch (e) { setErreur(e.message); }
  }
  function modele() {
    const url = URL.createObjectURL(new Blob([`﻿${MODELE}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "mercuriale_modele_koji_v1.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (allowed === null) return null;
  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack"><span className="eyebrow">Back-office Koji</span><h1>Partenaires</h1></div>
        <div className="hact"><button type="button" className="btn btn-sec" onClick={modele}>Modèle de mercuriale</button><button type="button" className="btn btn-main" onClick={() => setFiche(VIDE)}>Nouveau partenaire</button></div>
      </div>
      {message ? <p className="notice" role="status">{message}</p> : null}
      {erreur ? <p className="err" role="alert">{erreur}</p> : null}
      <div className="tbl">
        {!data ? <p className="muted" style={{ padding: 16 }}>Chargement…</p> : data.partenaires.length === 0 ? <div className="empty">Aucun partenaire. Créez la fiche, puis importez sa mercuriale.</div> : (
          <table>
            <thead><tr><th>Partenaire</th><th>Code</th><th className="r">Articles</th><th>Validité</th><th>Dernier import</th><th>Publié</th><th aria-label="Actions" /></tr></thead>
            <tbody>
              {data.partenaires.map((p) => (
                <tr key={p.id}>
                  <td className="n">{p.nom}<div className="sm">{[p.metiers, p.zone, p.email].filter(Boolean).join(" · ")}</div></td>
                  <td>{p.code}</td>
                  <td className="r">{p.articles}</td>
                  <td>{jour(p.validite)}</td>
                  <td className="sm2">{p.dernierImport ? `${p.dernierImport.fichier || "fichier"} · ${p.dernierImport.valides}/${p.dernierImport.lues}` : "—"}</td>
                  <td>{p.publie ? <span className="fx-etat ok">Publié</span> : <span className="fx-etat off">Non</span>}</td>
                  <td className="r" style={{ whiteSpace: "nowrap" }}>
                    <button type="button" className="link" onClick={() => setFiche(p)}>Modifier</button>{" · "}
                    <label className="link">Importer<input type="file" accept=".csv,text/csv" hidden onChange={(e) => lire(p, e)} /></label>{" · "}
                    <button type="button" className="link" disabled={!p.articles} onClick={() => basculer(p)}>{p.publie ? "Retirer" : "Publier"}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {data?.recommandations?.length ? (
        <section className="card">
          <div className="card-h"><h2>Fournisseurs recommandés par les entreprises</h2></div>
          {data.recommandations.map((r) => <div className="fx-row" key={r.id}><span className="t"><b>{r.nom}</b><small>{[r.ville, r.contact, r.message].filter(Boolean).join(" · ")}</small></span><span className="sm2">{jour(r.createdAt.slice(0, 10))}</span></div>)}
        </section>
      ) : null}

      {fiche ? (
        <>
          <div className="env-scrim" onClick={() => setFiche(null)} />
          <section className="env-panel" role="dialog" aria-modal="true" aria-label="Fiche partenaire">
            <div className="env-h"><h2>{fiche.id ? fiche.nom : "Nouveau partenaire"}</h2><button type="button" className="link" onClick={() => setFiche(null)}>Fermer</button></div>
            {[["nom", "Nom"], ["email", "E-mail des commandes"], ["metiers", "Métiers (carrelage, faïence…)"], ["zone", "Zone (Paris est…)"], ["adresse", "Adresse"], ["livraison", "Livraison (48 h, retrait comptoir…)"], ["franco", "Franco (300 € HT)"], ["code", "Code partenaire (MENDY-KJ)"]].map(([k, l]) => (
              <label className="ed" key={k}>{l}<input value={fiche[k] || ""} onChange={(e) => setFiche({ ...fiche, [k]: e.target.value })} /></label>
            ))}
            <p className="fx-note">Contrat partenaire, CGU et facturation de la commission : à valider avant toute publication.</p>
            <div className="env-act"><button type="button" className="btn btn-sec" onClick={() => setFiche(null)}>Annuler</button><button type="button" className="btn btn-main" disabled={!fiche.nom?.trim()} onClick={enregistrer}>Enregistrer</button></div>
          </section>
        </>
      ) : null}

      {imp ? (
        <>
          <div className="env-scrim" onClick={() => setImp(null)} />
          <section className="env-panel wide" role="dialog" aria-modal="true" aria-label="Import de mercuriale">
            <div className="env-h"><h2>Import de mercuriale · {imp.p.nom}</h2><button type="button" className="link" onClick={() => setImp(null)}>Fermer</button></div>
            <p className="fx-note">{imp.fichier} · modèle Koji v1 · {imp.apercu.lues} lignes</p>
            <div className="kpis">
              <div><div className="l">Lignes lues</div><div className="v">{imp.apercu.lues}</div></div>
              <div><div className="l">Valides</div><div className="v">{imp.apercu.valides}</div></div>
              <div><div className="l">Erreurs</div><div className="v">{imp.apercu.erreurs.length}</div></div>
              <div><div className="l">Validité</div><div className="v">{imp.apercu.validite ? jour(imp.apercu.validite) : "—"}</div></div>
            </div>
            {imp.apercu.erreurs.length ? (
              <div className="tbl"><table><thead><tr><th>Ligne</th><th>Article</th><th>Problème</th><th>À faire</th></tr></thead><tbody>
                {imp.apercu.erreurs.slice(0, 50).map((e) => <tr key={e.ligne}><td>{e.ligne}</td><td>{e.article || "—"}</td><td>{e.probleme}</td><td>{e.action}</td></tr>)}
              </tbody></table></div>
            ) : null}
            <p className="fx-note">Seules les lignes valides sont publiées ; corrigez le fichier et réimportez pour les autres.</p>
            <div className="env-act"><button type="button" className="btn btn-sec" onClick={() => setImp(null)}>Annuler</button><button type="button" className="btn btn-main" disabled={!imp.apercu.valides} onClick={publier}>Publier {imp.apercu.valides} articles</button></div>
          </section>
        </>
      ) : null}
    </Shell>
  );
}
