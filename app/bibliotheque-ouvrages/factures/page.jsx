"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shell } from "../../../components/Shell";
import { apiGet, apiSend } from "../../../lib/client-api";
import { BibliothequeTabs } from "../BibliothequeTabs";
import { fichierPourEnvoi } from "../../../lib/fichier-client";
import "../../fournitures/fournitures.css";

// Taux d'après mes factures (maquette PRO-08.3) : factures déposées, lues
// par Koji, taux déduit par métier avec fourchette et confiance, méthode
// expliquée sur une ligne, questions sur les lignes non comprises.
// Jamais appliqué sans validation.
const euro = (n, max = 2) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: max }).format(Number(n) || 0);
const nb = (n) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(Number(n) || 0);
const mois = (iso) => (iso ? new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(`${String(iso).slice(0, 10)}T12:00:00Z`)) : "");
const TON = { forte: "ok", moyenne: "wait", faible: "late" };

function Question({ q, ouvrages, onRepondre }) {
  const [code, setCode] = useState("");
  const [quantite, setQuantite] = useState(q.quantite ? String(q.quantite) : "");
  return (
    <div className="fx-row" style={{ flexWrap: "wrap" }}>
      <span className="t" style={{ flex: "1 1 260px" }}><b>{q.question}</b><small>{euro(q.total)} · {q.motif}</small></span>
      <input list="fac-codes" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Code de l'ouvrage" aria-label="Code de l'ouvrage" style={{ width: 130, height: 32, padding: "0 6px", border: "1px solid var(--btn)", borderRadius: 2, font: "inherit" }} />
      <input type="number" min="0" step="0.1" value={quantite} onChange={(e) => setQuantite(e.target.value)} placeholder="Quantité" aria-label="Quantité" style={{ width: 90, height: 32, padding: "0 6px", border: "1px solid var(--btn)", borderRadius: 2, font: "inherit" }} />
      <button type="button" className="btn btn-sec" disabled={!ouvrages.some((o) => o.code === code) || !(Number(quantite) > 0)} onClick={() => onRepondre({ ligneId: q.id, code, quantite: Number(quantite) })}>Valider</button>
      <button type="button" className="link" onClick={() => onRepondre({ ligneId: q.id, ecarter: true })}>Écarter</button>
    </div>
  );
}

export default function TauxFactures() {
  const [data, setData] = useState(null);
  const [ouvrages, setOuvrages] = useState([]);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [depot, setDepot] = useState("");
  const [verifier, setVerifier] = useState(false);

  useEffect(() => {
    apiGet("/api/bibliotheque/factures").then(setData).catch((e) => setErreur(e.message));
    apiGet("/api/ouvrages").then((d) => setOuvrages(d.ouvrages || [])).catch(() => {});
  }, []);

  async function deposer(event) {
    const files = [...(event.target.files || [])].slice(0, 10);
    event.target.value = "";
    setErreur("");
    for (const [i, file] of files.entries()) {
      setDepot(`Lecture de ${file.name} (${i + 1}/${files.length})…`);
      try {
        const corps = /\.csv$/i.test(file.name) || file.type === "text/csv" ? { nom: file.name, texte: await file.text() } : { nom: file.name, data: await fichierPourEnvoi(file) };
        const r = await apiSend("/api/bibliotheque/factures", corps);
        setData(r);
        setMessage(`${file.name} : ${r.lues} lignes lues, ${r.comprises} comprises.`);
      } catch (e) { setErreur(`${file.name} : ${e.message}`); }
    }
    setDepot("");
  }

  async function patch(corps, ok) {
    try { setData(await apiSend("/api/bibliotheque/factures", corps, "PATCH")); if (ok) setMessage(ok); } catch (e) { setErreur(e.message); }
  }

  const propositions = (data?.metiers || []).filter((m) => m.proposition?.action === "appliquer");
  const ex = data?.exemple;

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow"><Link className="link" href="/bibliotheque-ouvrages">Bibliothèque</Link> · <Link className="link" href="/bibliotheque-ouvrages/mes-prix">Mes prix</Link></span>
          <h1>Vos taux d'après vos factures</h1>
        </div>
        <div className="hact">
          <label className="btn btn-sec">{depot ? "Lecture…" : "Ajouter des factures"}<input type="file" multiple accept=".pdf,.csv,image/*,application/pdf,text/csv" hidden disabled={Boolean(depot)} onChange={deposer} /></label>
          <button type="button" className="btn btn-main" disabled={!propositions.length} onClick={() => patch({ action: "appliquer", metiers: propositions.map((m) => ({ metier: m.metier, taux: m.proposition.taux })) }, `${propositions.length} taux appliqué${propositions.length > 1 ? "s" : ""}.`)}>{propositions.length === 1 ? "Appliquer la proposition" : `Appliquer les ${propositions.length || ""} propositions`.replace("  ", " ")}</button>
        </div>
      </div>
      <BibliothequeTabs current="prix" />
      {depot ? <p className="notice" role="status">{depot}</p> : null}
      {message ? <p className="notice" role="status">{message}</p> : null}
      {erreur ? <p className="err" role="alert">{erreur}</p> : null}
      {!data ? <p className="muted">Chargement…</p> : (
        <div className="fp-layout">
          <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
            <section className="card">
              <div className="card-h"><h2>Taux déduit par métier</h2><span className="sm2">{data.fichiers.length} facture{data.fichiers.length > 1 ? "s" : ""} · {data.lignes.comprises} lignes comprises{data.periode ? ` · ${data.periode}` : ""}</span></div>
              {data.metiers.length === 0 ? (
                <div className="empty">Déposez 3 à 10 factures de travaux récentes (PDF, photo, export CSV) : Koji rattache chaque ligne à un ouvrage de votre bibliothèque et en déduit votre taux par métier.</div>
              ) : (
                <div className="tbl fac-tbl">
                  <table>
                    <thead><tr><th>Métier</th><th className="r">Lignes</th><th className="r">Taux déduit</th><th>Confiance</th><th className="r">Réglé</th><th aria-label="Action" /></tr></thead>
                    <tbody>
                      {data.metiers.map((m) => (
                        <tr key={m.metier}>
                          <td><div className="n2">{m.activite}</div><div className="sm fac-m"><b>{m.taux} € de l'heure</b> · {m.bas} à {m.haut} € · confiance {m.confiance} · {m.lignes} lignes{m.regle ? ` · réglé ${m.regle} €` : ""}</div><div className="sm">{m.proposition?.texte}</div></td>
                          <td className="r">{m.lignes}</td>
                          <td className="r"><b>{m.taux} €</b><div className="sm">{m.bas} à {m.haut} €</div></td>
                          <td><span className={`fx-etat ${TON[m.confiance]}`}>{m.confiance}</span></td>
                          <td className="r">{m.regle ? `${m.regle} €` : "—"}</td>
                          <td className="r">
                            {m.proposition?.action === "appliquer" || m.proposition?.action === "confirmer" ? (
                              <button type="button" className={m.proposition.action === "appliquer" ? "btn btn-main" : "btn btn-sec"} onClick={() => patch({ action: "appliquer", metiers: [{ metier: m.metier, taux: m.taux }] }, `${m.activite} : ${m.taux} € HT/h appliqué.`)}>{m.proposition.libelle}</button>
                            ) : <span className="sm2">{m.proposition?.libelle}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            {ex ? (
              <section className="card">
                <div className="card-h"><h2>Comment Koji calcule</h2><span className="sm2">exemple sur une ligne</span></div>
                <div className="kv"><span><b style={{ color: "var(--ink)" }}>{ex.designation}</b><br />{nb(ex.quantite)} {ex.unite} × {euro(ex.total / ex.quantite)}</span><b>{euro(ex.total)}</b></div>
                <div className="kv"><span>− fournitures, prix public<br />{ex.fournituresNoms?.length ? `${ex.fournituresNoms.join(", ").toLowerCase()} · ${euro(ex.fournitures / ex.quantite)}/${ex.unite} × ${nb(ex.quantite)} ${ex.unite}` : "pose seule"}</span><b>− {euro(ex.fournitures)}</b></div>
                <div className="kv"><span>= main-d'œuvre<br />ce que vous avez vendu en travail</span><b>{euro(ex.mo)}</b></div>
                <div className="kv"><span>÷ temps de la bibliothèque<br />{nb(ex.temps)} h/{ex.unite} × {nb(ex.quantite)} {ex.unite} = {nb(ex.heures)} h</span><b>{nb(ex.taux)} €/h</b></div>
                <p className="fx-note">Taux d'un métier = valeur du milieu de toutes ses lignes ; les lignes très éloignées sont écartées. Si vous achetiez les fournitures moins cher que le prix public, le taux déduit est un peu surestimé : d'où la fourchette.</p>
              </section>
            ) : null}
          </div>
          <aside className="ob-detail">
            <div className="ob-sec">
              <div className="lab">Factures lues</div>
              {data.fichiers.length === 0 ? <p className="fx-note">Aucune facture pour l'instant.</p> : data.fichiers.map((f) => (
                <div className="kv" key={f.id}>
                  <span>{f.garde ? <a className="link" href={`/api/bibliotheque/factures?fichier=${f.id}`} target="_blank" rel="noreferrer">{f.nom}</a> : f.nom}<br /><small>{mois(f.date)} · {f.lignes} ligne{f.lignes > 1 ? "s" : ""}</small></span>
                  <b>{f.statut} <button type="button" className="link" onClick={() => patch({ action: "supprimer", fichierId: f.id }, `${f.nom} retiré de l'analyse.`)}>retirer</button></b>
                </div>
              ))}
              {data.lignes.aVerifier ? (
                <>
                  <div className="kv"><span>{data.lignes.aVerifier} ligne{data.lignes.aVerifier > 1 ? "s" : ""} à vérifier<br /><small>forfaits sans quantité, lignes « divers » · Koji vous pose {Math.min(3, data.lignes.aVerifier)} question{data.lignes.aVerifier > 1 ? "s" : ""}</small></span><button type="button" className="link" onClick={() => setVerifier((v) => !v)}>Vérifier</button></div>
                  {verifier ? data.questions.map((q) => <Question key={q.id} q={q} ouvrages={ouvrages} onRepondre={(r) => patch({ action: "repondre", ...r }, r.ecarter ? "Ligne écartée." : "Ligne comprise.")} />) : null}
                  <datalist id="fac-codes">{ouvrages.slice(0, 600).map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}</datalist>
                </>
              ) : null}
              {data.lignes.ecartees ? <p className="fx-note">{data.lignes.ecartees} ligne{data.lignes.ecartees > 1 ? "s" : ""} écartée{data.lignes.ecartees > 1 ? "s" : ""} (non comprises).</p> : null}
            </div>
            <div className="ob-sec">
              <div className="lab">Vos données</div>
              <p className="fx-note">Noms, adresses et coordonnées de vos clients ne sont pas gardés : Koji garde seulement les lignes, quantités et prix.</p>
              <button type="button" className={`ck${data.garder ? " on" : ""}`} aria-pressed={data.garder} onClick={() => patch({ action: "reglages", garder: !data.garder }, data.garder ? "Les factures gardées sont supprimées." : "Les prochaines factures seront gardées.")}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>Garder les factures dans mes documents</button>
              <span className="fx-note">sinon supprimées après l'analyse</span>
              <button type="button" className={`ck${data.partage ? " on" : ""}`} aria-pressed={data.partage} onClick={() => patch({ action: "reglages", partage: !data.partage }, data.partage ? "Accord retiré." : "Accord enregistré.")}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>Aider Koji à fixer des prix justes</button>
              <span className="fx-note">vos prix, anonymes et mélangés à ceux d'au moins 10 entreprises, améliorent les prix de référence ; en échange, votre position dans votre zone. Désactivé par défaut, retirable à tout moment.</span>
            </div>
          </aside>
        </div>
      )}
    </Shell>
  );
}
