"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Shell } from "../../../components/Shell";
import { RechargeJetons } from "../../../components/RechargeJetons";
import { apiGet } from "../../../lib/client-api";

// Mes positions (maquette PRO-04) : la prochaine visite confirmée en tête,
// puis une ligne par position avec son statut, sa dernière étape et ses
// jetons ; statuts terminés en gris.
const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;

function Statut({ p }) {
  if (p.etat === "rdv") return <span className="kj-st"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>RDV confirmé</span>;
  if (p.etat === "attente") return <span className="tag tag-e">En attente</span>;
  return <span className="tag tag-o dim">{p.libelle}</span>;
}

export default function MesPositionsPage() {
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState("");
  const [recharge, setRecharge] = useState(false);
  const [paye, setPaye] = useState(false);

  useEffect(() => {
    setPaye(new URLSearchParams(window.location.search).get("jetons") === "ok");
    apiGet("/api/marketplace/positions").then(setData).catch((e) => setErreur(e.message));
  }, []);

  const positions = data?.positions || [];
  const v = data?.visiteConfirmee;
  const ind = data?.indicateurs;

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow">{data ? `Radar des chantiers · ${pluriel(ind?.positionsMois || 0, "position", "positions")} ce mois-ci · ${pluriel(data.jetons?.solde || 0, "jeton disponible", "jetons disponibles")}` : "Radar des chantiers"}</span>
          <h1>Mes positions</h1>
        </div>
        <div className="hact">
          <button type="button" className="btn btn-sec" onClick={() => setRecharge(true)}>Recharger des jetons</button>
          <Link className="btn btn-sec" href="/marketplace">Voir le Radar</Link>
        </div>
      </div>

      {paye ? <p className="notice" role="status">Paiement reçu : vos jetons sont ajoutés dès que Stripe le confirme (quelques secondes).</p> : null}
      {erreur ? <p className="notice" role="alert">{erreur}</p> : null}

      {ind ? (
        <div className="rd-sum">
          <div><span>Solde</span><b>{pluriel(ind.solde, "jeton", "jetons")}</b></div>
          <div><span>Réservés</span><b>{ind.reserves}</b></div>
          <div><span>Débités ce mois</span><b>{ind.debitesMois}</b></div>
          <div><span>Taux de visite</span><b>{ind.tauxVisite} %</b></div>
        </div>
      ) : null}

      {v ? (
        <div className="rd-ok" style={{ marginBottom: 16 }}>
          <span className="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg></span>
          <div>
            <strong>Le client a confirmé la visite : {v.quand}</strong>
            <small>{[`${v.titre}, ${v.ville}`, v.jetons?.texte, "coordonnées complètes disponibles", "visite ajoutée au calendrier", "fil de messages ouvert"].filter(Boolean).join(" · ")}</small>
          </div>
          <Link className="btn btn-main" href={`/marketplace/${v.offerId}/visite`}>Préparer la visite</Link>
        </div>
      ) : null}

      {!data && !erreur ? <div className="tbl"><p className="empty">Chargement…</p></div> : null}
      {data && !positions.length ? (
        <div className="tbl"><p className="empty">Aucune position pour l'instant. Choisissez un chantier sur le Radar et positionnez-vous : les jetons ne sont débités que si le client confirme un rendez-vous.</p></div>
      ) : null}

      {positions.length ? (
        <div className="card" style={{ padding: 0 }}>
          <table className="tbl kj-tbl">
            <thead><tr><th>Chantier</th><th>Statut</th><th>Dernière étape</th><th>Jetons</th><th /></tr></thead>
            <tbody>
              {positions.map((p) => (
                <tr key={`${p.offerId}-${p.creeLe}`} className={p.termine ? "dim" : ""}>
                  <td><div className="n">{p.titre}</div><div className="sm2">{p.ville}</div></td>
                  <td><Statut p={p} /></td>
                  <td>{p.etape}</td>
                  <td>{p.jetons?.texte}</td>
                  <td className="r"><Link className="link" href={`/marketplace/${p.offerId}`}>{p.etat === "rdv" ? "Ouvrir le fil" : "Voir"}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="rd-legend">Règle des jetons : réservés au positionnement, débités à la confirmation d'un rendez-vous par le client, rendus sinon (7 jours sans réponse, demande retirée ou expirée, client qui choisit une autre entreprise).</div>

      {recharge ? <RechargeJetons jetons={data?.jetons} retour="/marketplace/positions" onClose={() => setRecharge(false)} /> : null}
    </Shell>
  );
}
