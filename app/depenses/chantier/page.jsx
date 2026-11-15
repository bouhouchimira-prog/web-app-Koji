"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shell } from "../../../components/Shell";
import { apiGet } from "../../../lib/client-api";
import { DepensesTabs, euro, euro0, jourCourt } from "../DepensesTabs";
import "../../fournitures/fournitures.css";
import "../depenses.css";

// Coût d'un chantier (maquette PRO-09.2) : devis, dépensé, marge prévue
// et estimée ; prévu et dépensé par lot (détail des pièces d'un lot) ;
// alerte sur un dépassement avec doublon probable et « Préparer un
// avenant » ; historique des dépenses et encaissements.
const signe = (n) => `${n >= 0 ? "+" : "−"} ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.abs(n))}`;
const FILTRES = { tout: "Tout", fournitures: "Fournitures", heures: "Heures", encaissements: "Encaissements" };

export default function CoutChantier() {
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState("");
  const [lot, setLot] = useState("");
  const [filtre, setFiltre] = useState("tout");

  useEffect(() => {
    const projet = new URLSearchParams(window.location.search).get("projet") || "";
    if (!projet) { setErreur("Chantier manquant."); return; }
    apiGet(`/api/depenses/chantiers?projet=${encodeURIComponent(projet)}`).then(setData).catch((e) => setErreur(e.message));
  }, []);

  const c = data?.cout;
  const ch = data?.chantier;
  const historique = (data?.historique || []).filter((h) => filtre === "tout" || h.type === filtre || (filtre === "fournitures" && h.type === "autres"));
  const doublon = data?.pieces.find((p) => data.doublons.includes(p.id));

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack"><span className="eyebrow"><Link className="link" href="/depenses/chantiers">Dépenses</Link> · coût du chantier</span><h1>{ch?.title || "Chantier"}</h1></div>
        <div className="hact">{ch ? <Link className="btn btn-sec" href={`/chantiers?project=${ch.projectId}`}>Ouvrir le chantier</Link> : null}</div>
      </div>
      <DepensesTabs current="chantiers" />
      {erreur ? <p className="err" role="alert">{erreur}</p> : null}
      {!data ? (erreur ? null : <p className="muted">Chargement…</p>) : (
        <>
          <div className="dp-kp">
            <div><span>{ch.quote?.signe ? "Devis signé" : "Devis"}</span><b>{euro0(c.devisHt)} HT</b><small>+ avenants signés : {euro0(c.avenantsHt)}</small></div>
            <div><span>Dépensé à ce jour</span><b>{euro0(c.depense)}</b><small>{c.avancement} % des travaux faits</small></div>
            <div><span>Marge prévue</span><b>{c.margePrevue ? `${c.margePrevue.pct} %` : "—"}</b><small>{c.margePrevue ? euro0(c.margePrevue.euros) : "coût horaire à renseigner"}</small></div>
            <div><span>Marge finale estimée</span><b>{c.margeFinale ? `${c.margeFinale.pct} %` : "—"}</b><small>{c.margeFinale ? `${euro0(c.margeFinale.euros)} · ${signe(c.margeFinale.delta)} €` : <Link className="link" href="/bibliotheque-ouvrages/mes-prix">Mes prix</Link>}</small></div>
          </div>
          {c.depasse ? (
            <div className="dp-al">
              <div>
                <strong>{c.depasse.lot} : {euro0(c.depasse.depense)} de fournitures pour {euro0(c.depasse.prevu)} prévus</strong>
                <small>{doublon ? `Deux pièces ${doublon.fournisseur} au même montant (${euro(doublon.ttc)}) : probablement un doublon. ` : ""}Si le dépassement vient d'un changement demandé par le client, faites-lui signer un avenant.</small>
              </div>
              {doublon ? <Link className="link" href={`/depenses?piece=${doublon.id}`}>Voir le doublon</Link> : null}
              {ch.quote?.signe ? <Link className="btn btn-main" href={`/chantiers?project=${ch.projectId}&avenant=1`}>Préparer un avenant</Link> : null}
            </div>
          ) : null}
          <div className="dp-g2">
            <section className="card">
              <div className="card-h"><h2>Prévu et dépensé, par lot</h2></div>
              <div className="dp-lt h"><span className="n" /><span>Prévu</span><span>Dépensé</span><span>Écart</span></div>
              {c.lots.map((l) => {
                const depasse = l.prevu > 0 && l.depense > l.prevu * 1.1;
                const ecart = l.etat === "fait" || l.depense > l.prevu ? signe(l.ecart) : l.etat === "a_venir" ? "à venir" : "en cours";
                const pieces = data.pieces.filter((p) => p.statut === "rangee" && p.lot === l.lot);
                return (
                  <div key={l.lot}>
                    <button type="button" className={`dp-lt${depasse ? " ko" : l.depense > l.prevu ? " e" : ""}`} aria-expanded={lot === l.lot} onClick={() => setLot(lot === l.lot ? "" : l.lot)}>
                      <span className="n">{l.lot} · fournitures</span><span>{euro0(l.prevu)}</span><span>{euro0(l.depense)}</span><span className="e">{ecart}</span>
                    </button>
                    {lot === l.lot ? (
                      <div className="dp-lot">
                        {pieces.length ? pieces.map((p) => <div key={p.id} className="dp-pc"><span className="d">{jourCourt(p.date)}</span><span className="f"><strong>{p.fournisseur}</strong><small>{[p.numero, p.categorie].filter(Boolean).join(" · ")}</small></span><b>{euro(p.ht)}</b></div>) : "Aucune pièce rangée sur ce lot."}
                        <div style={{ marginTop: 6 }}>{l.heures ? `${String(l.heures).replace(".", ",")} h de main-d'œuvre prévues au devis. ` : ""}{l.prevu > 0 && l.depense > l.prevu ? `Écart de ${Math.round(((l.depense - l.prevu) / l.prevu) * 100)} %${depasse ? " : au-delà de 10 %, pensez à l'avenant." : " : rien à faire en dessous de 10 %."}` : ""}</div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {c.autres > 0 ? <div className="dp-lt"><span className="n">Autres dépenses · sans lot</span><span>—</span><span>{euro0(c.autres)}</span><span className="e" /></div> : null}
              <div className="dp-lt"><span className="n">Heures de l'équipe</span><span>{c.mo.prevu !== null ? euro0(c.mo.prevu) : "—"}</span><span>{c.mo.suivi ? euro0(c.mo.depense) : "—"}</span><span className="e">{c.mo.suivi ? `${String(c.mo.heures).replace(".", ",")} h` : "non pointées"}</span></div>
              <p className="fx-note" style={{ marginTop: 10 }}>Prévu : fournitures du devis au prix d'achat{data.coutHoraire ? ` et ${String(c.mo.heuresPrevues).replace(".", ",")} h à ${euro0(data.coutHoraire)} de l'heure` : ""}. Une pièce sans lot compte dans « Autres dépenses ».</p>
            </section>
            <section className="card">
              <div className="card-h"><h2>Pièces et historique</h2><span className="sm2">{data.pieces.length} pièce{data.pieces.length > 1 ? "s" : ""}</span></div>
              <div className="kp-seg dp-hist" role="group" aria-label="Filtre">
                {Object.entries(FILTRES).map(([k, v]) => <button type="button" key={k} className={filtre === k ? "on" : ""} aria-pressed={filtre === k} onClick={() => setFiltre(k)}>{v}</button>)}
              </div>
              {historique.length === 0 ? <p className="fx-note">Rien pour l'instant.</p> : historique.slice(0, 40).map((h) => (
                <div key={`${h.type}-${h.id}`} className={`dp-pc${h.montant < 0 ? " moins" : ""}`}>
                  <span className="d">{jourCourt(h.date)}</span>
                  <span className="f"><strong>{h.titre}</strong><small>{h.detail}</small></span>
                  <b>{h.montant < 0 ? `− ${euro(-h.montant)}` : `+ ${euro(h.montant)}`}</b>
                </div>
              ))}
              <Link className="link" href="/depenses?piece=manuel" style={{ fontSize: 12, marginTop: 10, display: "inline-block" }}>Ajouter une pièce</Link>
            </section>
          </div>
        </>
      )}
    </Shell>
  );
}
