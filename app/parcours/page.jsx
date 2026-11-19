"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shell } from "../../components/Shell";
import { apiGet, apiSend } from "../../lib/client-api";
import { Shippori } from "../fonts";
import "./parcours.css";

// Mon parcours (maquette PRO-26, version 2) : grade, niveau, preuves,
// hauts faits, aperçu côté particulier, expérience du mois. Tout vient de
// GET /api/parcours/grade (lecture seule, calculée sur les données du
// compte). Le « Premier mois » (version 1) est sur /parcours/premier-mois.
const nombre = (n) => new Intl.NumberFormat("fr-FR").format(n || 0).replace(/ | /g, " ");
const note1 = (n) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n || 0);
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const jourCourt = (j) => { const [, m, d] = String(j || "").split("-").map(Number); return m && d ? `${d === 1 ? "1er" : d} ${MOIS[m - 1]}` : ""; };
const signe = (n) => (n < 0 ? `− ${nombre(-n)}` : `+ ${nombre(n)}`);
const pl = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
const Coche = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>;
const Etoile = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z" /></svg>;

function LigneHautFait({ h }) {
  let droite;
  if (h.obtenu) droite = <small className="tl-d">{h.obtenuLe ? `obtenu le ${jourCourt(h.obtenuLe)}` : "obtenu"}</small>;
  else if (!h.mesurable) droite = <small className="tl-d" title={h.raison}>pas encore mesurable</small>;
  else if (!h.atteignable) droite = <small className="tl-d" title={h.raison}>non accessible</small>;
  else droite = <><i className="tl-p"><b style={{ width: `${h.pourcent}%` }} /></i><small className="tl-d">{h.pourcent} %</small></>;
  return (
    <div className="tl-hf">
      <span className={`tl-hi ${h.obtenu ? "on" : ""}`}>{h.obtenu ? <Coche /> : null}</span>
      <div><b>{h.titre}</b><small>{h.detail}{!h.mesurable || !h.atteignable ? ` · ${h.raison}` : ""}</small></div>
      <span className="tl-cat">{h.categorie}</span>
      <span className="tl-tg">{h.public ? null : <span className="tag tag-e">privé</span>}</span>
      <div className="tl-r">{droite}</div>
    </div>
  );
}

function Apercu({ apercu, actif }) {
  return (
    <div className={`tl-prev ${Shippori.variable}`}>
      <div className="tl-pv-h">
        <span className="tl-pv-s"><Etoile /></span>
        <div><b>{apercu.grade || "Vos preuves"}</b><small>{apercu.preuves.length ? apercu.preuves.join(" · ") : "Pas encore de chantier livré avec PV ni d'avis vérifié."}</small></div>
      </div>
      {apercu.distinctions.length ? <div className="tl-pv-l">{apercu.distinctions.map((t) => <span key={t}>{t}</span>)}</div> : <div className="tl-pv-l" />}
      <small className="tl-pv-n">Trois distinctions choisies par vous, parmi les publiques. Jamais de niveau, de points ni de talents.{apercu.grade ? "" : " Le grade s'affiche à partir de Compagnon : avant, vos preuves passent avant le titre."}</small>
      {actif ? null : <p className="tl-pv-off">Pas encore affiché sur votre KojiPage : placez un point dans Vitrine (Plaque de chantier).</p>}
    </div>
  );
}

export default function MonParcoursPage() {
  const [d, setD] = useState(null);
  const [erreur, setErreur] = useState("");
  const [onglet, setOnglet] = useState("obtenus");
  const [choix, setChoix] = useState(null); // distinctions en cours de choix
  const [envoi, setEnvoi] = useState(false);
  const [erreurChoix, setErreurChoix] = useState("");
  useEffect(() => { apiGet("/api/parcours/grade").then(setD).catch((e) => setErreur(e.message)); }, []);

  async function enregistrer() {
    setEnvoi(true);
    setErreurChoix("");
    try {
      setD(await apiSend("/api/parcours/grade", { action: "distinctions", ids: choix }));
      setChoix(null);
    } catch (e) {
      setErreurChoix(e.message);
    } finally {
      setEnvoi(false);
    }
  }

  const n = d?.niveau;
  const liste = !d ? [] : onglet === "obtenus" ? d.hautsFaits.filter((h) => h.obtenu) : onglet === "avenir" ? d.hautsFaits.filter((h) => !h.obtenu && h.atteignable) : d.hautsFaits;
  const publicsObtenus = d ? d.hautsFaits.filter((h) => h.public && h.obtenu) : [];
  const actes = d ? d.bareme.filter((b) => b.xp > 0).map((b) => `${b.label.charAt(0).toLowerCase()}${b.label.slice(1)} (${signe(b.xp)})`) : [];

  return (
    <Shell variant="pro">
      <div className="tlp">
        <div className="head">
          <div className="stack"><span className="eyebrow">Mon parcours</span><h1>Mon parcours : grade, hauts faits, points de métier</h1></div>
          <div className="hact"><Link className="btn" href="/parcours/premier-mois">Premier mois</Link></div>
        </div>
        {erreur ? <p className="err" role="alert">{erreur}</p> : null}
        {!d ? <p className="muted">Chargement…</p> : (
          <>
            <div className="tl-grade">
              <div className="tl-gl">
                <span className="eyebrow">Grade</span>
                <h2>{n.grade.label}</h2>
                <small>niveau {n.niveau}{n.requis ? ` · ${nombre(n.dansNiveau)} / ${nombre(n.requis)} points d'expérience` : ` · ${nombre(n.xp)} points d'expérience`}</small>
                <i className="tl-xp"><b style={{ width: `${n.pourcent}%` }} /></i>
                <small>{n.prochainGrade ? `${n.prochainGrade.label} au niveau ${n.prochainGrade.niveau}` : "Grade le plus haut"}</small>
              </div>
              <div className="tl-gs">{d.grades.map((g) => <span key={g.id} className={g.atteint ? "on" : ""}>{g.label}</span>)}</div>
              <div className="tl-gr">
                {d.talents.libres ? (
                  <><b>{pl(d.talents.libres, "point de métier", "points de métier")}</b><small>à placer</small><Link className="btn btn-main" href="/parcours/talents">Placer dans Talents</Link></>
                ) : (
                  <><b>{pl(d.talents.points, "point de métier", "points de métier")}</b><small>tous placés</small><Link className="btn" href="/parcours/talents">Voir mes talents</Link></>
                )}
              </div>
            </div>

            <div className="tl-facts">
              <div><b>{d.preuves.chantiersLivres}</b><small>{d.preuves.chantiersLivres > 1 ? "chantiers livrés" : "chantier livré"} avec PV</small></div>
              <div><b>{d.preuves.avisVerifies}</b><small>{d.preuves.avisVerifies > 1 ? "avis vérifiés" : "avis vérifié"}{d.preuves.avisVerifies ? ` · ${note1(d.preuves.noteMoyenne)} / 5` : ""}</small></div>
              <div><b>{d.preuves.devisSignes}</b><small>{d.preuves.devisSignes > 1 ? "devis signés" : "devis signé"}</small></div>
              <div><b>{d.preuves.hautsFaitsPublics}</b><small>{d.preuves.hautsFaitsPublics > 1 ? "hauts faits publics" : "haut fait public"}</small></div>
            </div>

            <div className="nf-g">
              <div>
                <div className="wtabs tl-tabs" role="tablist">
                  <a role="tab" className={onglet === "obtenus" ? "on" : ""} onClick={() => setOnglet("obtenus")}>Obtenus <span>{d.compteurs.obtenus}</span></a>
                  <a role="tab" className={onglet === "avenir" ? "on" : ""} onClick={() => setOnglet("avenir")}>À venir <span>{d.compteurs.aVenir}</span></a>
                  <a role="tab" className={onglet === "tous" ? "on" : ""} onClick={() => setOnglet("tous")}>Tous</a>
                </div>
                <div className="card tl-list">
                  {liste.length ? liste.map((h) => <LigneHautFait key={h.id} h={h} />) : <p className="tl-vide">{onglet === "obtenus" ? "Aucun haut fait pour l'instant : le premier devis signé par un client donne « Premier coup de pelle »." : "Rien à afficher."}</p>}
                </div>
              </div>

              <div className="st-c">
                <div className="card">
                  <div className="card-h"><h2>Ce que voit le particulier</h2>{choix ? null : <a className="link" role="button" onClick={() => { setChoix(d.distinctions); setErreurChoix(""); }}>Choisir mes distinctions</a>}</div>
                  {choix ? (
                    <>
                      {publicsObtenus.length ? (
                        <div className="tl-ch">
                          {publicsObtenus.map((h) => {
                            const coche = choix.includes(h.id);
                            const off = !coche && choix.length >= 3;
                            return (
                              <label key={h.id} className={off ? "off" : ""}>
                                <input type="checkbox" checked={coche} disabled={off} onChange={() => setChoix(coche ? choix.filter((x) => x !== h.id) : [...choix, h.id])} />
                                {h.titre}
                              </label>
                            );
                          })}
                        </div>
                      ) : <p className="tl-vide">Aucun haut fait public obtenu pour l'instant.</p>}
                      {erreurChoix ? <p className="tl-err" role="alert">{erreurChoix}</p> : null}
                      <div className="tl-ch-a">
                        <button type="button" className="btn-main-sm" disabled={envoi} onClick={enregistrer}>{envoi ? "Enregistrement…" : `Enregistrer (${choix.length} sur 3)`}</button>
                        <button type="button" className="btn-sm2" onClick={() => setChoix(null)}>Annuler</button>
                      </div>
                    </>
                  ) : <Apercu apercu={d.apercu} actif={d.plaqueActive} />}
                </div>

                <div className="card">
                  <div className="card-h"><h2>Ce mois</h2></div>
                  {d.ceMois.length ? (
                    <>
                      {d.ceMois.map((l) => <div key={l.type} className="kv"><span>{l.label}</span><b>{l.nombre} · {signe(l.xp)}</b></div>)}
                      <div className="kv"><span>Total du mois</span><b><b>{signe(d.totalMois)}</b></b></div>
                    </>
                  ) : <p className="tl-vide">Aucun acte constaté par Koji ce mois-ci.</p>}
                </div>

                <div className="card">
                  <div className="card-h"><h2>Comment ça marche</h2></div>
                  <ul className="nf-ul">
                    <li>Seuls des actes constatés par Koji comptent : {actes.join(", ")}.</li>
                    <li>Ouvrir l'application ou cliquer ne rapporte rien.</li>
                    <li>Un avis vérifié à 2 / 5 ou moins retire des points ; un devis rétracté ou annulé retire ce qu'il avait rapporté.</li>
                    <li>Un point de métier par niveau, à placer dans Talents ; réorganisation une fois par mois.</li>
                    <li>Pas encore comptés, faute de constat par Koji : rendez-vous honorés et factures payées dans le délai.</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}
