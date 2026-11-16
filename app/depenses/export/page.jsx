"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shell } from "../../../components/Shell";
import { apiGet, apiSend } from "../../../lib/client-api";
import { DepensesTabs, euro } from "../DepensesTabs";
import "../../fournitures/fournitures.css";
import "../depenses.css";

// Export pour le comptable (maquette PRO-09.4, Business) : journaux du
// mois ou du trimestre, TVA indicative, contrôles avant envoi,
// téléchargement, envoi par e-mail (et le 5 de chaque mois si activé).
const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
function periodes(aujourdhui = new Date()) {
  const a = aujourdhui.getFullYear();
  const m = aujourdhui.getMonth();
  const prec = m === 0 ? { a: a - 1, m: 11 } : { a, m: m - 1 };
  const cle = (x) => `${x.a}-${String(x.m + 1).padStart(2, "0")}`;
  return [
    { id: cle(prec), label: MOIS[prec.m] },
    { id: cle({ a, m }), label: MOIS[m] },
    { id: `${a}-T${Math.floor(m / 3) + 1}`, label: "Trimestre" }
  ];
}
const Ok = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>;
const Warn = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8v5M12 17h.01" /><circle cx="12" cy="12" r="9" /></svg>;
const quand = (iso) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export default function ExportComptable() {
  const choix = periodes();
  const [periode, setPeriode] = useState(choix[0].id);
  const [data, setData] = useState(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    setData(null);
    apiGet(`/api/depenses/export?periode=${periode}`).then((d) => { setData(d); setEmail(d.reglages?.comptableEmail || ""); }).catch((e) => setErreur(e.message));
  }, [periode]);

  async function envoyer() {
    setBusy(true); setErreur(""); setMessage("");
    try {
      const r = await apiSend("/api/depenses/export", { periode, to: email });
      setMessage(`Envoyé à ${r.envoi.to} : ${r.envoi.pieces} fichier${r.envoi.pieces > 1 ? "s" : ""}${r.envoi.nonJointes ? `, ${r.envoi.nonJointes} justificatif(s) trop lourd(s) listé(s) dans le message` : ""}.`);
      setData(await apiGet(`/api/depenses/export?periode=${periode}`));
    } catch (e) { setErreur(e.message); }
    setBusy(false);
  }
  async function auto() {
    try {
      await apiSend("/api/depenses", { action: "reglages", comptableEmail: email, envoiAuto: !data.reglages.envoiAuto }, "PATCH");
      setData(await apiGet(`/api/depenses/export?periode=${periode}`));
    } catch (e) { setErreur(e.message); }
  }

  const s = data?.synthese;
  const t = s?.totaux;
  const lien = (journal) => `/api/depenses/export?periode=${periode}&format=csv&journal=${journal}`;
  const libelleCourt = choix.find((c) => c.id === periode)?.label || "";

  return (
    <Shell variant="pro">
      <div className="head"><div className="stack"><span className="eyebrow">Dépenses · Business</span><h1>Dépenses</h1></div></div>
      <DepensesTabs current="export" />
      {message ? <p className="notice" role="status">{message}</p> : null}
      {erreur ? <p className="err" role="alert">{erreur}</p> : null}
      {!data ? <p className="muted">Chargement…</p> : !data.business ? (
        <section className="card"><div className="card-h"><h2>Export pour le comptable</h2></div><p className="fx-note" style={{ margin: 0 }}>Journaux des ventes, des achats et des encaissements, relevé par chantier et justificatifs envoyés à votre comptable chaque mois : c'est dans l'offre Business.</p><div className="dp-foot"><Link className="btn btn-main" href="/parametres/abonnement">Voir les offres</Link></div></section>
      ) : (
        <>
          <section className="card">
            <div className="card-h"><h2>{s.libelle}</h2>
              <div className="kp-seg" role="group" aria-label="Période">{choix.map((c) => <button type="button" key={c.id} className={periode === c.id ? "on" : ""} aria-pressed={periode === c.id} onClick={() => setPeriode(c.id)}>{c.label}</button>)}</div>
            </div>
            <table className="dp-st">
              <thead><tr><th>Journal</th><th>Pièces</th><th className="num">Montant</th><th className="num">TVA</th><th aria-label="Télécharger" /></tr></thead>
              <tbody>
                <tr><td><b>Ventes</b></td><td>{t.ventes.factures} facture{t.ventes.factures > 1 ? "s" : ""} · {t.ventes.avoirs} avoir{t.ventes.avoirs > 1 ? "s" : ""}</td><td className="num">{euro(t.ventes.ht)} HT</td><td className="num">{euro(t.ventes.tva)}</td><td><a className="link" href={lien("ventes")}>CSV</a></td></tr>
                <tr><td><b>Achats</b></td><td>{t.achats.factures} facture{t.achats.factures > 1 ? "s" : ""} fournisseurs · {t.achats.tickets} ticket{t.achats.tickets > 1 ? "s" : ""}</td><td className="num">{euro(t.achats.ht)} HT</td><td className="num">{euro(t.achats.tva)}</td><td><a className="link" href={lien("achats")}>CSV</a></td></tr>
                <tr><td><b>Encaissements</b></td><td>{t.encaissements.nombre} paiement{t.encaissements.nombre > 1 ? "s" : ""}</td><td className="num">{euro(t.encaissements.ttc)} TTC</td><td className="num">—</td><td><a className="link" href={lien("encaissements")}>CSV</a></td></tr>
              </tbody>
            </table>
            <div className="dp-tva">
              <div><span>TVA collectée</span><b>{euro(s.tva.collectee)}</b>{t.ventes.estimees ? <small>{t.ventes.estimees} facture(s) au taux de 20 % supposé</small> : null}</div>
              <div><span>TVA déductible</span><b>{euro(s.tva.deductible)}</b>{t.achats.autoliquidees ? <small>+ {t.achats.autoliquidees} facture(s) autoliquidée(s), {euro(t.achats.autoliquideesHt)} HT</small> : null}</div>
              <div><span>Solde à déclarer</span><b>{euro(s.tva.solde)}</b><small>indicatif, à confirmer par votre comptable</small></div>
            </div>
            <div className="dp-chk">
              <b>Avant d'envoyer</b>
              {s.controles.map((c) => (
                <div key={c.texte} className={`dp-ck ${c.ok ? "ok" : "warn"}`}>{c.ok ? <Ok /> : <Warn />}<span>{c.texte}{!c.ok && c.lien === "a_ranger" ? <> · <Link className="link" href="/depenses">ranger</Link></> : null}</span></div>
              ))}
            </div>
          </section>
          <div className="dp-g22">
            <section className="card">
              <div className="card-h"><h2>Envoyer au comptable</h2></div>
              <div className="dp-f" style={{ marginBottom: 8 }}><label htmlFor="dp-cpt">Destinataire</label><input id="dp-cpt" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cabinet@exemple.fr" /></div>
              <div className="kv"><span>Contenu</span><b>Journaux ventes, achats et encaissements (CSV), relevé par chantier (PDF), justificatifs</b></div>
              <button type="button" className={`dp-tg${data.reglages.envoiAuto ? " on" : ""}`} aria-pressed={Boolean(data.reglages.envoiAuto)} disabled={!email} onClick={auto}>
                <span>Envoi automatique<small>le 5 de chaque mois, pièces du mois précédent</small></span><i><b /></i>
              </button>
              <div className="dp-foot">
                <a className="btn btn-sec" href={`/api/depenses/export?periode=${periode}&format=pdf`}>Télécharger le relevé</a>
                <button type="button" className="btn btn-main" disabled={busy || !email} onClick={envoyer}>{busy ? "Envoi…" : `Envoyer ${libelleCourt === "Trimestre" ? "le trimestre" : libelleCourt.toLowerCase()}`}</button>
              </div>
              {data.envois.length ? <div className="fx-note" style={{ marginTop: 8 }}>{data.envois.slice(0, 3).map((e) => <div key={e.id}>{e.auto ? "Envoi automatique" : "Envoyé"} le {quand(e.le)} à {e.to} · {e.periode}</div>)}</div> : null}
            </section>
            <section className="card">
              <div className="card-h"><h2>Ce que Koji ne fait pas</h2></div>
              <p className="fx-note" style={{ margin: 0 }}>Koji range et transmet vos pièces. Il ne tient pas votre comptabilité et ne produit pas de liasse ni de FEC : c'est le travail de votre comptable, avec son logiciel. Les montants de TVA sont indicatifs. Rien n'est supprimé dans Koji après l'envoi.</p>
            </section>
          </div>
        </>
      )}
    </Shell>
  );
}
