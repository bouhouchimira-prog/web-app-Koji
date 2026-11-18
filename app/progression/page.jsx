"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shell } from "../../components/Shell";
import { ProAccountNav } from "../../components/ProAccountNav";
import { apiGet } from "../../lib/client-api";
import "./progression.css";

// Ma progression (maquette PRO-21) : niveau, points, sceau Vérifié, défis
// de la semaine, ce que chaque niveau débloque.
const nombre = (n) => new Intl.NumberFormat("fr-FR").format(n || 0).replace(/ | /g, " ");
const Coche = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>;

export default function ProgressionPage() {
  const [d, setD] = useState(null);
  const [erreur, setErreur] = useState("");
  useEffect(() => { apiGet("/api/progression").then(setD).catch((e) => setErreur(e.message)); }, []);
  return (
    <Shell variant="pro">
      <ProAccountNav current="progression" />
      <div className="pg">
        <div className="head"><div className="stack"><span className="eyebrow">Profil et compte</span><h1>Ma progression</h1></div><Link className="btn" href="/parcours">Premier mois</Link></div>
        {erreur ? <p className="err" role="alert">{erreur}</p> : null}
        {!d ? <p className="muted">Chargement…</p> : (
          <>
            <div className="pg-g">
              <div className="card">
                <div className="card-h"><h2>Niveau : {d.niveau.label}</h2><b className="pg-pts">{nombre(d.points)} points</b></div>
                <ol className="pg-niv">
                  {d.niveaux.map((n) => <li key={n.id} className={`${n.atteint ? "ok" : ""} ${n.actuel ? "on" : ""}`}><i>{n.atteint ? <Coche /> : null}</i>{n.label}</li>)}
                </ol>
                {d.prochain ? <p className="pg-next"><span>Prochain niveau</span><b>{d.prochain.label}</b> · {d.condition}</p> : <p className="pg-next"><b>Niveau le plus haut atteint.</b></p>}
                <p className="sm2">Les niveaux récompensent l'usage complet de Koji (devis, photos, clôtures, réponses). Ils n'achètent aucune place sur le Radar.</p>
                <p className="sm2">Points : devis envoyé {d.bareme.devisEnvoye}, devis signé {d.bareme.devisSigne}, photo après {d.bareme.photoApres}, chantier clôturé avec avis {d.bareme.clotureAvecAvis}, réponse en moins de 4 h {d.bareme.reponseRapide}.</p>
              </div>
              <div className="card">
                <div className="card-h"><h2>Sceau Vérifié</h2><span className={`tag ${d.sceau.affiche ? "" : "tag-o"}`}>{d.sceau.affiche ? "affiché" : "pas encore affiché"}</span></div>
                <ul className="pg-l">{d.sceau.criteres.map((c) => <li key={c.id} className={c.ok ? "ok" : ""}><i>{c.ok ? <Coche /> : null}</i>{c.label}</li>)}</ul>
                <p className="sm2">Affiché sur la KojiPage et dans les propositions ; retiré si un document expire. Le sceau dit ce que Koji a vérifié : ce n'est pas une certification de la qualité des travaux.</p>
                <Link className="link" href="/profil">Compléter mon profil</Link>
              </div>
            </div>
            <div className="pg-g">
              <div className="card">
                <div className="card-h"><h2>Défis de la semaine</h2><span className="sm2">se renouvellent lundi</span></div>
                {d.defis.map((x) => (
                  <Link key={x.id} href={x.href} className={`pg-d ${x.fait ? "ok" : ""}`}>
                    <i>{x.fait ? <Coche /> : null}</i><span>{x.label}</span><b>{x.etat}</b>
                  </Link>
                ))}
              </div>
              <div className="card">
                <div className="card-h"><h2>Ce que ça débloque</h2></div>
                {d.niveaux.filter((n) => n.debloque).map((n) => <div key={n.id} className={`pg-u ${n.atteint ? "ok" : ""}`}><b>{n.label}</b><span>{n.debloque}</span></div>)}
                <p className="sm2">Les avantages seront attribués automatiquement dans une prochaine version.</p>
              </div>
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}
