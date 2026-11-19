"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shell } from "../../../components/Shell";
import { apiGet, apiSend } from "../../../lib/client-api";
import { etatNoeud, jourCourt, PAS_EN_SERVICE, POINTS_MAX_BRANCHE } from "../../../lib/parcours-talents";
import "../parcours.css";

// Talents (maquette PRO-26.1) : deux branches, paliers à 1 / 3 / 6 / 10
// points, un point par niveau ; réorganisation une fois par mois, effet le
// 1er du mois suivant. Seule la Plaque de chantier est en service : les
// autres paliers sont affichés « pas encore en service » (aucun jeton
// n'est crédité par les talents).
const Coche = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>;
const Etoile = () => <svg className="st" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z" /></svg>;
const Cadenas = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z" /></svg>;
const pl = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;

function Branche({ b, points, libres, onPlacer, onRetirer, occupe, brouillon }) {
  const noeuds = b.noeuds.map((n) => ({ ...n, etat: etatNoeud(points, n.seuil, libres) }));
  const suivant = noeuds.find((n) => n.etat !== "got");
  const peutPlacer = libres > 0 && points < POINTS_MAX_BRANCHE;
  return (
    <div className="tl-br">
      <div className="tl-bh">
        <b>{b.titre}</b><small>{b.sousTitre}</small>
        <span className="tl-bp">
          {pl(points, "point placé", "points placés")}
          {peutPlacer && suivant?.etat === "lock" ? <button type="button" disabled={occupe} onClick={onPlacer}>Placer 1 point</button> : null}
          {brouillon && points > 0 ? <button type="button" onClick={onRetirer}>Retirer 1 point</button> : null}
        </span>
      </div>
      {noeuds.map((n, i) => (
        <div key={n.id} style={{ display: "contents" }}>
          {i ? <i className="tl-ln" /> : null}
          <div className={`tl-n ${n.etat}`}>
            <span className="tl-ni">{n.etat === "got" ? <Coche /> : n.etat === "avail" ? <Etoile /> : <Cadenas />}</span>
            <div><b>{n.titre}</b><small>{n.detail}</small>{n.enService ? null : <em>{PAS_EN_SERVICE}</em>}</div>
            <span className="tl-nc">{pl(n.seuil, "point", "points")}</span>
            {peutPlacer && n.id === suivant?.id && n.etat === "avail" ? (
              <button type="button" className="btn-main-sm" disabled={occupe} onClick={onPlacer}>{brouillon ? "Placer" : "Placer 1 point"}</button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TalentsPage() {
  const [d, setD] = useState(null);
  const [erreur, setErreur] = useState("");
  const [brouillon, setBrouillon] = useState(null); // { radar, vitrine } pendant la réorganisation
  const [occupe, setOccupe] = useState(false);
  useEffect(() => { apiGet("/api/parcours/grade").then(setD).catch((e) => setErreur(e.message)); }, []);

  async function envoyer(payload) {
    setOccupe(true);
    setErreur("");
    try {
      setD(await apiSend("/api/parcours/talents", payload));
      setBrouillon(null);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setOccupe(false);
    }
  }

  const t = d?.talents;
  const reparti = brouillon || (t ? { radar: t.radar, vitrine: t.vitrine } : null);
  const places = reparti ? reparti.radar + reparti.vitrine : 0;
  const libres = t ? (brouillon ? t.points - places : t.libres) : 0;

  return (
    <Shell variant="pro">
      <div className="tlp">
        <div className="head">
          <div className="stack"><span className="eyebrow"><Link href="/parcours">Mon parcours</Link></span><h1>{brouillon ? "Talents · réorganiser" : "Talents"}</h1></div>
          <div className="hact" />
        </div>
        {erreur ? <p className="err" role="alert">{erreur}</p> : null}
        {!d ? <p className="muted">Chargement…</p> : (
          <>
            <div className="tl-grade">
              <div className="tl-gl">
                <span className="eyebrow">Talents</span>
                <h2>{pl(t.points, "point de métier", "points de métier")}</h2>
                <small>{pl(places, "placé", "placés")} · {libres} à placer · un point par niveau</small>
              </div>
              <div className="tl-gs tl-gs2"><span className="on">Radar · {reparti.radar}</span><span className="on">Vitrine · {reparti.vitrine}</span></div>
              <div className="tl-gr">
                {brouillon ? (
                  <>
                    <b>Réorganisation en cours</b>
                    <small>{pl(t.points - places, "point à replacer", "points à replacer")} · effet le {jourCourt(t.reorg.effetSiValideeLe)}</small>
                    <button type="button" className="btn btn-main" disabled={occupe} onClick={() => envoyer({ action: "reorganiser", repartition: brouillon })}>Valider</button>
                    <button type="button" className="link" onClick={() => setBrouillon(null)}>Annuler</button>
                  </>
                ) : t.aVenir ? (
                  <>
                    <b>Réorganisation validée</b>
                    <small>effet le {jourCourt(t.aVenir.effetLe)} · Radar {t.aVenir.radar} · Vitrine {t.aVenir.vitrine}</small>
                  </>
                ) : (
                  <>
                    <b>Réorganiser</b>
                    <small>possible une fois par mois{t.reorg.prochaineLe ? ` · prochaine fois le ${jourCourt(t.reorg.prochaineLe)}` : ""}</small>
                    <button type="button" className="btn" disabled={!t.reorg.possible || !t.points} onClick={() => setBrouillon({ radar: 0, vitrine: 0 })}>Réorganiser mes talents</button>
                  </>
                )}
              </div>
            </div>

            <div className="nf-g">
              <div className="tl-tree">
                {t.branches.map((b) => (
                  <Branche
                    key={b.id}
                    b={b}
                    points={reparti[b.id]}
                    libres={libres}
                    occupe={occupe}
                    brouillon={Boolean(brouillon)}
                    onPlacer={() => (brouillon ? setBrouillon({ ...brouillon, [b.id]: brouillon[b.id] + 1 }) : envoyer({ action: "placer", branche: b.id }))}
                    onRetirer={() => setBrouillon({ ...brouillon, [b.id]: Math.max(0, brouillon[b.id] - 1) })}
                  />
                ))}
              </div>
              <div className="st-c">
                {brouillon ? (
                  <div className="card">
                    <div className="card-h"><h2>Avant de valider</h2></div>
                    <ul className="nf-ul">
                      <li>Vous perdez les avantages non replacés à partir du {jourCourt(t.reorg.effetSiValideeLe)}</li>
                      <li>Les jetons offerts déjà crédités restent sur votre solde.</li>
                      <li>Prochaine réorganisation possible le {jourCourt(t.reorg.suivanteSiValideeLe)}</li>
                    </ul>
                  </div>
                ) : (
                  <>
                    <div className="card">
                      <div className="card-h"><h2>Mes avantages ce mois</h2></div>
                      {t.avantages.length ? t.avantages.map((a) => <div key={a.id} className="kv"><span>{a.label}</span><b>{a.texte}</b></div>) : <p className="tl-vide">Aucun palier acquis pour l'instant.</p>}
                    </div>
                    <div className="card">
                      <div className="card-h"><h2>Règles</h2></div>
                      <ul className="nf-ul">
                        <li>Les points viennent des niveaux, jamais d'un achat.</li>
                        <li>Les avantages s'ajoutent à votre offre ; aucune fonction de Koji ne se débloque avec des points.</li>
                        <li>Réorganiser rend tous les points ; prise d'effet au cycle suivant, les jetons déjà crédités restent.</li>
                        <li>Ce qui touche l'affichage côté particulier est toujours étiqueté « mise en avant ».</li>
                        <li>Aujourd'hui, seule la Plaque de chantier est en service ; les autres paliers seront attribués quand leur fonction existera.</li>
                      </ul>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}
