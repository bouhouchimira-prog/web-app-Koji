"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shell } from "../../components/Shell";
import { ProAccountNav } from "../../components/ProAccountNav";
import { apiGet } from "../../lib/client-api";
import "./progression.css";

// Ma progression (maquette PRO-21) : grade (source unique : Mon parcours,
// PRO-26), sceau Vérifié, défis de la semaine, ce que les talents débloquent.
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
        <div className="head"><div className="stack"><span className="eyebrow">Profil et compte</span><h1>Ma progression</h1></div><Link className="btn" href="/parcours">Mon parcours</Link></div>
        {erreur ? <p className="err" role="alert">{erreur}</p> : null}
        {!d ? <p className="muted">Chargement…</p> : (
          <>
            <div className="pg-g">
              <div className="card">
                <div className="card-h"><h2>Grade : {d.niveau.grade.label}</h2><b className="pg-pts">{nombre(d.niveau.xp)} points</b></div>
                <ol className="pg-niv">
                  {d.grades.map((n) => <li key={n.id} className={`${n.atteint ? "ok" : ""} ${n.actuel ? "on" : ""}`}><i>{n.atteint ? <Coche /> : null}</i>{n.label}</li>)}
                </ol>
                {d.niveau.prochainGrade ? <p className="pg-next"><span>Niveau {d.niveau.niveau} · {nombre(d.niveau.dansNiveau)} / {nombre(d.niveau.requis)}</span><b>{d.niveau.prochainGrade.label}</b> · au niveau {d.niveau.prochainGrade.niveau}</p> : <p className="pg-next"><b>Grade le plus haut atteint.</b></p>}
                <p className="sm2">Seuls des actes constatés par Koji comptent (devis signé, chantier livré avec PV, avis vérifié…). Les grades n'achètent aucune place sur le Radar.</p>
                <Link className="link" href="/parcours">Mon parcours : grade et hauts faits</Link>
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
                <div className="card-h"><h2>Ce que ça débloque</h2><span className="sm2">{d.talents.points} point{d.talents.points > 1 ? "s" : ""} de métier{d.talents.libres ? ` · ${d.talents.libres} à placer` : ""}</span></div>
                {d.talents.avantages.length ? d.talents.avantages.map((a) => <div key={a.id} className={`pg-u ${a.enService ? "ok" : ""}`}><b>{a.label}</b><span>{a.texte}</span></div>) : <p className="sm2">Un point de métier par niveau, à placer dans Talents.</p>}
                <Link className="link" href="/parcours/talents">Mes talents</Link>
              </div>
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}
