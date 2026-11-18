"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shell } from "../../../components/Shell";
import { apiGet, apiSend } from "../../../lib/client-api";
import "./contrat.css";

// Contrat de sous-traitance (maquette PRO-14.1) : conditions préparées par
// Koji (modèle à faire valider), acceptation du sous-traitant par le client
// dans Koji Client, garantie de paiement à choisir.
const dateCourte = (iso) => (iso ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(iso)).replace(/\.$/, ".") : "");

export default function ContratSousTraitance() {
  const [c, setC] = useState(null);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState("");
  const [id, setId] = useState("");
  useEffect(() => {
    const x = new URLSearchParams(window.location.search).get("id") || "";
    setId(x);
    if (!x) { setErreur("Contrat introuvable."); return; }
    apiGet(`/api/sous-traitance?id=${encodeURIComponent(x)}`).then((d) => setC(d.contrat)).catch((e) => setErreur(e.message));
  }, []);

  async function agir(corps, ok) {
    setBusy(corps.action); setErreur(""); setMessage("");
    try { const d = await apiSend("/api/sous-traitance", { id, ...corps }, "PATCH"); setC(d.contrat); setEdit(null); if (ok) setMessage(ok); } catch (e) { setErreur(e.message); }
    setBusy("");
  }

  // Sans contrat (adresse ouverte sans identifiant, contrat supprimé) : dire où aller.
  if (!c) return <Shell variant="pro">{erreur ? <div className="stc"><div className="head"><div className="stack"><span className="eyebrow">Réseau pro</span><h1>Contrat de sous-traitance</h1></div></div><p className="err" role="alert">{erreur}</p><p className="muted">Un contrat se prépare depuis un échange du Réseau pro ou depuis la fiche d'un sous-traitant.</p><Link className="btn" href="/reseau-pro">Retour au Réseau pro</Link></div> : <p className="muted">Chargement…</p>}</Shell>;
  const etat = c.etat.cle;
  return (
    <Shell variant="pro">
      <div className="stc">
        <div className="head">
          <div className="stack">
            <small className="muted"><Link href="/reseau-pro">Réseau pro</Link>{c.chantier ? ` · ${c.chantier}` : ""}{c.lot ? ` · ${c.lot}` : ""}</small>
            <h1>Contrat de sous-traitance</h1>
          </div>
          <div className="acts">
            <a className="btn btn-sec" href={`/api/sous-traitance?id=${encodeURIComponent(id)}&pdf=1`} target="_blank" rel="noreferrer">Aperçu PDF</a>
            <button type="button" className="btn btn-main" disabled={Boolean(busy) || c.manques.length > 0} onClick={() => agir({ action: "envoyer" }, `Conditions envoyées à ${c.sousTraitant}.`)}>{busy === "envoyer" ? "Envoi…" : c.envoyeLe ? `Renvoyer à ${c.sousTraitant}` : `Envoyer à ${c.sousTraitant}`}</button>
          </div>
        </div>
        {erreur ? <p className="err" role="alert">{erreur}</p> : null}
        {message ? <p className="stc-ok" role="status">{message}</p> : null}
        {c.manques.length ? <p className="stc-alerte">À compléter avant l'envoi : {c.manques.join(", ")}.</p> : null}
        <div className="stc-grid">
          <section className="card">
            <div className="card-h"><h2>Préparé par Koji</h2><span className="tag tag-o">modèle à faire valider</span></div>
            {edit ? (
              <form className="fgrid" onSubmit={(e) => { e.preventDefault(); agir({ action: "modifier", ...edit }, "Conditions enregistrées."); }}>
                <label className="full">Travaux<input value={edit.lot} onChange={(e) => setEdit({ ...edit, lot: e.target.value })} /></label>
                <label>Prix HT<input type="number" min="0" step="any" value={edit.prixHt} onChange={(e) => setEdit({ ...edit, prixHt: e.target.value })} /></label>
                <label>Paiement<input value={edit.paiement} onChange={(e) => setEdit({ ...edit, paiement: e.target.value })} /></label>
                <label>Début<input type="date" value={edit.debut} onChange={(e) => setEdit({ ...edit, debut: e.target.value })} /></label>
                <label>Fin<input type="date" value={edit.fin} min={edit.debut || undefined} onChange={(e) => setEdit({ ...edit, fin: e.target.value })} /></label>
                <div className="full stc-acts"><button type="submit" className="btn btn-main" disabled={Boolean(busy)}>Enregistrer</button><button type="button" className="link" onClick={() => setEdit(null)}>Annuler</button></div>
              </form>
            ) : (
              <>
                {c.lignes.map(([k, v]) => <div className="kv" key={k}><span>{k}</span><b>{v}</b></div>)}
                {etat !== "accepte" ? <div className="stc-acts"><button type="button" className="link" onClick={() => setEdit({ lot: c.lot || "", prixHt: c.prixHt || "", paiement: c.paiement || "", debut: c.debut || "", fin: c.fin || "" })}>Modifier les conditions</button></div> : null}
                {!c.documentsAJour && c.contactId ? <p className="muted">Documents de vigilance à demander : <Link className="link" href={`/contacts?id=${c.contactId}`}>ouvrir la fiche du sous-traitant</Link></p> : null}
              </>
            )}
            <p className="muted">Koji reprend les conditions convenues ; il ne rédige pas de clauses. Faites valider le contrat par votre avocat avant signature.</p>
          </section>
          <div className="stc-col">
            <section className="card">
              <div className="card-h"><h2>Acceptation par le client</h2></div>
              <div className="row"><span className={`kcnt${c.presenteLe ? " ok" : ""}`}>{c.presenteLe ? "✓" : "1"}</span><div className="t"><strong>Sous-traitant présenté</strong><small>{c.presenteLe ? `Koji Client · ${dateCourte(c.presenteLe)}` : "pas encore présenté"}</small></div>
                {!c.presenteLe ? <button type="button" className="btn btn-sec" disabled={Boolean(busy) || c.manques.length > 0} onClick={() => agir({ action: "presenter" }, "Sous-traitant présenté au client.")}>{busy === "presenter" ? "Envoi…" : "Présenter au client"}</button> : null}
              </div>
              <div className="row"><span className={`kcnt${c.accepteLe ? " ok" : ""}`}>{c.accepteLe ? "✓" : "2"}</span><div className="t"><strong>Accord du client et des conditions de paiement</strong><small>{c.accepteLe ? `accepté le ${dateCourte(c.accepteLe)}` : c.refuseLe ? `refusé le ${dateCourte(c.refuseLe)}` : c.presenteLe ? `en attente${c.relance ? ` · relance le ${dateCourte(c.relance)}` : ""}` : "après la présentation"}</small></div>
                {c.presenteLe && !c.accepteLe && !c.refuseLe ? <button type="button" className="btn btn-sec" disabled={Boolean(busy)} onClick={() => agir({ action: "relancer" }, "Client relancé.")}>Relancer</button> : null}
              </div>
              <p className="muted">Le sous-traitant doit être accepté et ses conditions de paiement agréées par le client (loi du 31 décembre 1975, art. 3).</p>
            </section>
            <section className="card">
              <div className="card-h"><h2>Garantie de paiement</h2></div>
              <div className="stc-gar" role="radiogroup" aria-label="Garantie de paiement">
                {Object.entries(c.garanties).map(([cle, label]) => <button type="button" key={cle} role="radio" aria-checked={c.garantie === cle} className={c.garantie === cle ? "on" : ""} disabled={Boolean(busy)} onClick={() => agir({ action: "garantie", garantie: cle })}>{label}</button>)}
              </div>
              <p className="muted">{c.garantie ? "Choisie. À mettre en place avant le début des travaux du sous-traitant." : "À choisir avant le début des travaux du sous-traitant."}</p>
            </section>
          </div>
        </div>
      </div>
    </Shell>
  );
}
