"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shell } from "../../components/Shell";
import { apiGet } from "../../lib/client-api";
import "./parcours.css";

// Mon parcours · Premier mois (maquette PRO-26, version 1) : huit étapes
// constatées sur les vrais chantiers, jetons du Radar offerts à l'étape
// faite. Grade, hauts faits et talents : version 2.
const Coche = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>;
const jetons = (n) => `+ ${n} jeton${n > 1 ? "s" : ""}`;

export default function ParcoursPage() {
  const [d, setD] = useState(null);
  const [erreur, setErreur] = useState("");
  useEffect(() => { apiGet("/api/parcours").then(setD).catch((e) => setErreur(e.message)); }, []);
  const f = d?.fenetre;
  return (
    <Shell variant="pro">
      <div className="pm">
        <div className="head"><div className="stack"><span className="eyebrow">Mon parcours</span><h1>Premier mois : les huit étapes</h1></div></div>
        {erreur ? <p className="err" role="alert">{erreur}</p> : null}
        {!d ? <p className="muted">Chargement…</p> : (
          <>
            {d.nouveauxJetons ? <p className="pm-fin" role="status">{d.nouveauxJetons} jeton{d.nouveauxJetons > 1 ? "s" : ""} offert{d.nouveauxJetons > 1 ? "s" : ""} viennent d'être ajoutés à votre solde du Radar.</p> : null}
            {!f.ouverte && f.joursRestants === 0 && d.faites < d.total ? <p className="pm-fin">Le premier mois est terminé : les étapes restent utiles, mais n'offrent plus de jetons.</p> : null}
            <div className="pm-band">
              <div>
                <span className="eyebrow">Premier mois</span>
                <h2>{d.faites} étape{d.faites > 1 ? "s" : ""} sur {d.total}</h2>
                <small>{d.jetonsOfferts} jeton{d.jetonsOfferts > 1 ? "s" : ""} offert{d.jetonsOfferts > 1 ? "s" : ""} sur {d.jetonsTotal}{f.ouverte ? ` · il vous reste ${f.joursRestants} jour${f.joursRestants > 1 ? "s" : ""}` : ""}</small>
                <i className="pm-xp"><b style={{ width: `${Math.round((d.faites / d.total) * 100)}%` }} /></i>
                <small>Les étapes restantes se font sur vos vrais chantiers, pas sur des exemples.</small>
              </div>
              {d.prochaine ? (
                <div className="pm-next">
                  <b>Prochaine étape</b>
                  <small>{d.prochaine.titre}{d.prochaine.reste ? ` · ${d.prochaine.reste}` : ""}</small>
                  <Link className="btn" href={d.prochaine.web}>{d.prochaine.action}</Link>
                </div>
              ) : <div className="pm-next"><b>Les huit étapes sont faites.</b><small>Merci d'avoir pris Koji en main.</small></div>}
            </div>
            <div className="pm-g">
              <div className="card pm-list">
                {d.etapes.map((e) => (
                  <Link key={e.id} href={e.web} className="pm-e">
                    <span className={`pm-i ${e.faite ? "on" : ""}`}>{e.faite ? <Coche /> : e.numero}</span>
                    <div><b>{e.titre}</b><small>{e.faite ? e.detail : e.reste || e.detail}</small></div>
                    <span className="pm-d">{jetons(e.jetons)}{e.creditee ? <em>offert{e.jetons > 1 ? "s" : ""}</em> : null}</span>
                  </Link>
                ))}
              </div>
              <div className="pm-side">
                <div className="card">
                  <div className="card-h"><h2>Pourquoi ces huit étapes</h2></div>
                  <ul className="pm-ul">
                    <li>Chaque étape correspond à une fonction qui vous fait gagner du temps ou de l'argent ; les jetons sont offerts quand l'étape est faite, pas avant.</li>
                    <li>Après le premier mois, la liste disparaît de l'accueil.</li>
                    <li>Rien n'est obligatoire : Koji fonctionne sans.</li>
                  </ul>
                </div>
                <div className="card">
                  <div className="card-h"><h2>Les jetons offerts</h2></div>
                  <ul className="pm-ul">
                    <li>Ils s'ajoutent à votre solde du Radar, comme des jetons achetés, et ne s'éteignent pas à la fin du mois.</li>
                    <li>Seuls des actes constatés par Koji comptent : ouvrir l'application ou cliquer ne rapporte rien.</li>
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
