"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shell } from "../../../components/Shell";
import { apiGet } from "../../../lib/client-api";
import { DepensesTabs, euro0 } from "../DepensesTabs";
import "../../fournitures/fournitures.css";
import "../depenses.css";

// Coût des chantiers (maquette PRO-09.1) : une carte par chantier,
// dépensé sur le devis, marge prévue, marge finale estimée, une phrase.
const ETATS = {
  regarder: { label: "À regarder", ton: "late" },
  prevu: { label: "Dans le prévu", ton: "ok" },
  tot: { label: "Trop tôt pour juger", ton: "" },
  cloture: { label: "Clôturé", ton: "" },
  sans_cout: { label: "Marge non calculée", ton: "wait" },
  sans_devis: { label: "Sans devis", ton: "" }
};

export default function CoutDesChantiers() {
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState("");
  useEffect(() => { apiGet("/api/depenses/chantiers").then(setData).catch((e) => setErreur(e.message)); }, []);

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack"><span className="eyebrow">Ce que chaque chantier vous coûte vraiment</span><h1>Dépenses</h1></div>
        <div className="hact"><Link className="btn btn-sec" href="/depenses">Photo d'un ticket</Link></div>
      </div>
      <DepensesTabs current="chantiers" />
      {erreur ? <p className="err" role="alert">{erreur}</p> : null}
      {!data ? <p className="muted">Chargement…</p> : (
        <>
          {!data.coutHoraire ? (
            <div className="dp-al" style={{ marginBottom: 16 }}><div><strong>Coût horaire à renseigner</strong><small>Sans le coût d'une heure de votre équipe, Koji n'affiche pas de marge plutôt qu'une marge fausse.</small></div><Link className="btn btn-sec" href="/bibliotheque-ouvrages/mes-prix">Mes prix</Link></div>
          ) : null}
          {data.chantiers.length === 0 ? <div className="empty">Aucun chantier avec un devis pour l'instant.</div> : (
            <div className="dp-cg">
              {data.chantiers.map((c) => {
                const e = ETATS[c.etat] || ETATS.prevu;
                return (
                  <Link key={c.projectId} href={`/depenses/chantier?projet=${c.projectId}`} className={`dp-cc${c.etat === "regarder" ? " ko" : ""}`}>
                    <div className="h"><div><strong>{c.title}</strong><small>{[c.client, c.etat === "cloture" ? "clôturé" : `${c.avancement} % fait`].filter(Boolean).join(" · ")}</small></div><span className={`fx-etat ${e.ton}`}>{e.label}</span></div>
                    <div className="dp-bar" aria-hidden="true"><i style={{ width: `${c.totalHt > 0 ? Math.min(100, Math.round((c.depense / c.totalHt) * 100)) : 0}%` }} /></div>
                    <div className="dp-n"><span>Dépensé <b>{euro0(c.depense)}</b></span><span>sur un devis de <b>{euro0(c.totalHt)} HT</b></span></div>
                    <div className="dp-m">
                      <div><span>Marge prévue</span><b>{c.margePrevue ? `${c.margePrevue.pct} %` : "—"}</b></div>
                      <div><span>{c.etat === "cloture" ? "Marge finale" : "Marge finale estimée"}</span><b>{c.margeFinale ? `${c.margeFinale.pct} %` : "—"}</b></div>
                    </div>
                    <div className="dp-w">{c.phrase}</div>
                  </Link>
                );
              })}
            </div>
          )}
          <p className="fx-note" style={{ marginTop: 16 }}>Dépensé = pièces rangées (fournitures, sous-traitance, location) + heures de l'équipe si vous les pointez. Marge finale estimée : si les lots restants coûtent ce qui était prévu ; heures non pointées comptées comme prévu.</p>
        </>
      )}
    </Shell>
  );
}
