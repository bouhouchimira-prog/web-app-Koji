"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiSend } from "../../lib/client-api";
import { ORIGINES, SORTIES } from "../../lib/fournitures-chantier";
import { nombre } from "../../lib/fournitures-pro";
import { Coche, euro, jour, nb, qte } from "./commun";

// Onglet Stock (maquette PRO-07.4, Business) : reliquats de chantier et
// ajouts manuels ; valeur indicative au dernier prix d'achat ; sortie vers
// un chantier, perte, casse ou usage interne ; inventaire rapide.
export function ClotureReste({ projectId, onClose, onDone }) {
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState("");
  const [lignes, setLignes] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    apiGet(`/api/fournitures/stock?cloture=${encodeURIComponent(projectId)}`).then((d) => {
      setData(d);
      if (d.business) setLignes((d.restes || []).map((r) => ({ ...r, quantite: String(r.reste), lieu: d.lieux[0] })));
    }).catch((e) => setErreur(e.message));
  }, [projectId]);
  const cochees = lignes.filter((l) => l.coche && nombre(l.quantite) > 0);
  async function valider(rien) {
    setBusy(true);
    try {
      await apiSend("/api/fournitures/stock", { action: "cloture", rien, projectTitle: data.chantier.title, lignes: rien ? [] : cochees.map((l) => ({ articleId: l.articleId, name: l.name, unit: l.unit, quantite: nombre(l.quantite), lieu: l.lieu, prixHt: l.prixHt })) });
      onDone(rien ? "Rien mis en stock." : `${cochees.length} article${cochees.length > 1 ? "s" : ""} mis en stock.`);
    } catch (e) { setErreur(e.message); setBusy(false); }
  }
  return (
    <>
      <div className="env-scrim" onClick={busy ? undefined : onClose} />
      <section className="env-panel" role="dialog" aria-modal="true" aria-label="Clôturer le chantier · ce qui reste">
        <div className="env-h"><h2>Clôturer le chantier · ce qui reste</h2><button type="button" className="link" onClick={onClose}>Fermer</button></div>
        {erreur ? <p className="err" role="alert">{erreur}</p> : null}
        {!data ? <p className="muted">Calcul…</p> : !data.business ? <p className="notice">Le stock est inclus dans l'offre Business.</p> : (
          <>
            <p className="fx-note">Koji a calculé les restes probables : commandé − posé. Coche ce qui reste vraiment, corrige la quantité et le lieu. Rien n'entre en stock sans ta validation.</p>
            {lignes.length === 0 ? <p className="fx-note">Aucun reste calculé sur les bons livrés de ce chantier.</p> : lignes.map((l, i) => (
              <div className="fx-row" key={l.cle}>
                <button type="button" className={`ck${l.coche ? " on" : ""}`} aria-pressed={l.coche} onClick={() => setLignes(lignes.map((x, j) => (j === i ? { ...x, coche: !x.coche } : x)))}><Coche />{l.name}</button>
                <span className="t"><small>commandé {qte(l.commande, l.unit)} · posé {qte(l.pose, l.unit)}</small></span>
                <input type="number" min="0" step="0.01" value={l.quantite} onChange={(e) => setLignes(lignes.map((x, j) => (j === i ? { ...x, quantite: e.target.value } : x)))} aria-label={`Quantité restante de ${l.name}`} style={{ width: 80, height: 32, padding: "0 6px", border: "1px solid var(--btn)", borderRadius: 2, font: "inherit", textAlign: "right" }} />
                <select value={l.lieu} onChange={(e) => setLignes(lignes.map((x, j) => (j === i ? { ...x, lieu: e.target.value } : x)))} aria-label={`Lieu pour ${l.name}`}>{data.lieux.map((x) => <option key={x}>{x}</option>)}</select>
              </div>
            ))}
            <div className="env-act">
              <button type="button" className="btn btn-sec" disabled={busy} onClick={() => valider(true)}>Rien à garder</button>
              <button type="button" className="btn btn-main" disabled={busy || !cochees.length} onClick={() => valider(false)}>Mettre {cochees.length} article{cochees.length > 1 ? "s" : ""} en stock</button>
            </div>
          </>
        )}
      </section>
    </>
  );
}

function Ajout({ lieux, onClose, onDone }) {
  const [f, setF] = useState({ name: "", unit: "u", quantite: "", lieu: lieux[0], prixHt: "", origine: "manuel" });
  const [erreur, setErreur] = useState("");
  async function valider() {
    try { onDone(await apiSend("/api/fournitures/stock", { action: "ajouter", ...f, quantite: nombre(f.quantite), prixHt: nombre(f.prixHt) }), "Ajouté au stock."); } catch (e) { setErreur(e.message); }
  }
  return (
    <>
      <div className="env-scrim" onClick={onClose} />
      <section className="env-panel" role="dialog" aria-modal="true" aria-label="Ajouter au stock">
        <div className="env-h"><h2>Ajouter au stock</h2><button type="button" className="link" onClick={onClose}>Fermer</button></div>
        <label className="ed">Article<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <div className="fx-grid3">
          <label className="ed">Quantité<input type="number" min="0" step="0.01" value={f.quantite} onChange={(e) => setF({ ...f, quantite: e.target.value })} /></label>
          <label className="ed">Unité<input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></label>
          <label className="ed">Lieu<select value={f.lieu} onChange={(e) => setF({ ...f, lieu: e.target.value })}>{lieux.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="ed">Prix d'achat HT / unité<input type="number" min="0" step="0.01" value={f.prixHt} onChange={(e) => setF({ ...f, prixHt: e.target.value })} /></label>
          <label className="ed">Origine<select value={f.origine} onChange={(e) => setF({ ...f, origine: e.target.value })}><option value="manuel">{ORIGINES.manuel}</option><option value="arrondi">{ORIGINES.arrondi}</option></select></label>
        </div>
        {erreur ? <p className="err" role="alert">{erreur}</p> : null}
        <div className="env-act"><button type="button" className="btn btn-sec" onClick={onClose}>Annuler</button><button type="button" className="btn btn-main" disabled={!f.name.trim() || !(nombre(f.quantite) > 0)} onClick={valider}>Ajouter</button></div>
      </section>
    </>
  );
}

function Sortie({ ligne, onClose, onDone }) {
  const [quantite, setQuantite] = useState(String(ligne.quantite));
  const [motif, setMotif] = useState("interne");
  const [erreur, setErreur] = useState("");
  async function valider() {
    try { onDone(await apiSend("/api/fournitures/stock", { action: "sortie", id: ligne.id, quantite: nombre(quantite), motif }), `Sortie enregistrée : ${ligne.name}.`); } catch (e) { setErreur(e.message); }
  }
  return (
    <>
      <div className="env-scrim" onClick={onClose} />
      <section className="env-panel" role="dialog" aria-modal="true" aria-label="Sortie de stock">
        <div className="env-h"><h2>Sortie · {ligne.name}</h2><button type="button" className="link" onClick={onClose}>Fermer</button></div>
        <label className="ed">Quantité · sur {qte(ligne.quantite, ligne.unit)}<input type="number" min="0" max={ligne.quantite} step="0.01" value={quantite} onChange={(e) => setQuantite(e.target.value)} /></label>
        <div className="kp-seg" role="group" aria-label="Motif">
          {Object.entries(SORTIES).filter(([k]) => k !== "chantier").map(([k, v]) => <button key={k} type="button" className={motif === k ? "on" : ""} aria-pressed={motif === k} onClick={() => setMotif(k)}>{v}</button>)}
        </div>
        <p className="fx-note">Pour l'utiliser sur un chantier : Fournitures du chantier › Préparer les commandes, Koji propose le stock avant de commander.</p>
        {erreur ? <p className="err" role="alert">{erreur}</p> : null}
        <div className="env-act"><button type="button" className="btn btn-sec" onClick={onClose}>Annuler</button><button type="button" className="btn btn-main" onClick={valider}>Enregistrer la sortie</button></div>
      </section>
    </>
  );
}

function Inventaire({ lignes, lieux, onClose, onDone }) {
  const [q, setQ] = useState(() => Object.fromEntries(lignes.map((l) => [l.id, String(l.quantite)])));
  async function valider() {
    onDone(await apiSend("/api/fournitures/stock", { action: "inventaire", lignes: lignes.map((l) => ({ id: l.id, quantite: nombre(q[l.id]) })) }), "Inventaire enregistré.");
  }
  return (
    <>
      <div className="env-scrim" onClick={onClose} />
      <section className="env-panel" role="dialog" aria-modal="true" aria-label="Inventaire rapide">
        <div className="env-h"><h2>Inventaire rapide</h2><button type="button" className="link" onClick={onClose}>Fermer</button></div>
        <p className="fx-note">Recompte ce qui est vraiment là ; mets 0 pour ce qui a disparu. {lieux.length > 1 ? `Lieux : ${lieux.join(", ")}.` : ""}</p>
        {lignes.map((l) => (
          <div className="fx-row" key={l.id}><span className="t"><b>{l.name}</b><small>{l.lieu}</small></span>
            <span><input type="number" min="0" step="0.01" value={q[l.id]} onChange={(e) => setQ({ ...q, [l.id]: e.target.value })} aria-label={`Quantité comptée de ${l.name}`} style={{ width: 80, height: 32, padding: "0 6px", border: "1px solid var(--btn)", borderRadius: 2, font: "inherit", textAlign: "right" }} /> {l.unit}</span></div>
        ))}
        <div className="env-act"><button type="button" className="btn btn-sec" onClick={onClose}>Annuler</button><button type="button" className="btn btn-main" onClick={valider}>Valider l'inventaire</button></div>
      </section>
    </>
  );
}

export function StockOnglet() {
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState("");
  const [lieu, setLieu] = useState("");
  const [panneau, setPanneau] = useState(null);
  const [message, setMessage] = useState("");
  useEffect(() => { apiGet("/api/fournitures/stock").then(setData).catch((e) => setErreur(e.message)); }, []);
  const fini = (d, m) => { setData(d); setPanneau(null); setMessage(m); };

  if (erreur) return <p className="err" role="alert">{erreur}</p>;
  if (!data) return <p className="muted">Chargement…</p>;
  if (!data.business) {
    return (
      <div className="fx-lock">
        <span className="fx-badge">Business</span>
        <h2 style={{ margin: 0 }}>Stock léger</h2>
        <p className="fx-note">Reliquats de chantier et stock manuel : Koji propose ce qui reste à la clôture et le réutilise avant de commander. Inclus dans l'offre Business.</p>
        <Link className="btn btn-main" href="/abonnement">Voir l'offre Business</Link>
      </div>
    );
  }
  const c = data.chiffres;
  const lignes = data.lignes.filter((l) => !lieu || l.lieu === lieu);
  return (
    <>
      {message ? <p className="notice" role="status">{message}</p> : null}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
        <div className="kp-seg" role="group" aria-label="Lieu">
          <button type="button" className={!lieu ? "on" : ""} onClick={() => setLieu("")}>Tous lieux</button>
          {data.lieux.map((x) => <button key={x} type="button" className={lieu === x ? "on" : ""} onClick={() => setLieu(x)}>{x}</button>)}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-sec" disabled={!data.lignes.length} onClick={() => setPanneau({ type: "inventaire" })}>Inventaire rapide</button>
          <button type="button" className="btn btn-main" onClick={() => setPanneau({ type: "ajout" })}>Ajouter au stock</button>
        </div>
      </div>
      <div className="kpis">
        <div><div className="l">Articles en stock</div><div className="v">{c.articles}</div><div className="s">{c.lieux} lieu{c.lieux > 1 ? "x" : ""}</div></div>
        <div><div className="l">Valeur indicative</div><div className="v">{euro(c.valeur)}</div><div className="s">au dernier prix d'achat</div></div>
        <div><div className="l">Utilisé ce mois</div><div className="v">{c.utilises}</div><div className="s">{c.economise > 0 ? `économisé ${euro(c.economise)} d'achat` : "rien d'utilisé"}</div></div>
        <div><div className="l">Inventaire</div><div className="v">{jour(c.prochainInventaire)}</div><div className="s">prochain inventaire rapide</div></div>
      </div>
      <div className="tbl">
        {lignes.length === 0 ? <div className="empty">Stock vide. Il se remplit à la clôture d'un chantier (ce qui reste) ou à la main.</div> : (
          <table>
            <thead><tr><th>Article · origine</th><th className="r">Quantité</th><th>Lieu</th><th className="r">Valeur</th><th aria-label="Action" /></tr></thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.id}>
                  <td><div className="n2">{l.name}</div><div className="sm">{l.origine === "chantier" ? l.origineLabel || "fin de chantier" : l.origineLabel || "ajout manuel"} · {jour(l.entreeLe)}{l.moisSansUsage >= 7 ? <> · <span className="fx-warn">non utilisé depuis {l.moisSansUsage} mois</span></> : null}</div></td>
                  <td className="r">{l.entame ? `${nb(Math.ceil(l.quantite))} ${l.unit} entamé` : qte(l.quantite, l.unit)}</td>
                  <td>{l.lieu}</td>
                  <td className="r">{euro(l.quantite * l.prixHt)}</td>
                  <td className="r"><button type="button" className="btn btn-sec" onClick={() => setPanneau({ type: "sortie", ligne: l })}>Sortie</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="fx-note">Entrées : reliquat de fin de chantier, écart d'arrondi au conditionnement, ajout manuel. Sorties : affectation à un chantier, perte, casse ou usage interne. Rien d'autre à saisir.</p>
      {panneau?.type === "ajout" ? <Ajout lieux={data.lieux} onClose={() => setPanneau(null)} onDone={fini} /> : null}
      {panneau?.type === "sortie" ? <Sortie ligne={panneau.ligne} onClose={() => setPanneau(null)} onDone={fini} /> : null}
      {panneau?.type === "inventaire" ? <Inventaire lignes={data.lignes} lieux={data.lieux} onClose={() => setPanneau(null)} onDone={fini} /> : null}
    </>
  );
}
