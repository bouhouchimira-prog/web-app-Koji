"use client";

import { DM_Sans, Shippori } from "../../../fonts";
import { useSitePublic, Paire } from "../SitePublic";
import "../../../particulier/landing.css";
import "../site-public.css";

// Carte de visite reçue (maquette PRO-13.4, vue client) : la carte, puis
// Appeler, Enregistrer le contact (.vcf), Demander un devis ; les premières
// réalisations et le sceau. Chaque ouverture compte dans les statistiques
// de la carte.
const fmtNote = (n) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n || 0);
const initiales = (nom = "") => { const m = String(nom || "K").split(/\s+/).filter(Boolean); return (/^[A-Z]{2,}$/.test(m[0] || "") ? m[0].slice(0, 2) : m.slice(0, 2).map((x) => x[0]).join("")).toUpperCase(); };

export function CarteRecue({ slug }) {
  const { site, erreur } = useSitePublic(slug, "carte");
  if (erreur) return <div className={`lc kps ${DM_Sans.variable} ${Shippori.variable}`}><main className="kps-vide"><h1>Carte introuvable</h1><p>{erreur}</p></main></div>;
  if (!site) return <div className={`lc kps ${DM_Sans.variable} ${Shippori.variable}`}><main className="kps-vide"><p>Chargement…</p></main></div>;
  const c = site.carte || {};
  const nom = c.nom || site.title || site.name;
  const tel = c.telephone || site.phone;
  const r = site.realisations[0];
  return (
    <div className={`lc kps kpc ${DM_Sans.variable} ${Shippori.variable}`} style={{ "--bandeau": site.couleur }}>
      <main className="kpc-m">
        <small className="kps-mut">Carte de visite{c.personne ? ` partagée par ${c.personne}` : ""}</small>
        <div className="kpc-carte">
          <div className="kpc-top"><span className="kps-lg">{site.logoDataUrl ? <img src={site.logoDataUrl} alt="" /> : initiales(nom)}</span><small>{site.tagline}</small></div>
          <h1>{nom}</h1>
          {c.personne ? <p>{[c.personne, c.fonction].filter(Boolean).join(" · ")}</p> : null}
          {c.metiers?.length ? <small>{c.metiers.join(" · ")}</small> : null}
          {tel ? <p>Tél. {tel}</p> : null}
          {c.email || site.email ? <p>E-mail {c.email || site.email}</p> : null}
        </div>
        <div className="kpc-acts">
          {tel ? <a className="kps-btn sec" href={`tel:${tel.replace(/\s/g, "")}`}>Appeler</a> : null}
          <a className="kps-btn sec" href={`/api/site/${slug}/vcf`}>Enregistrer le contact</a>
          {site.sections.formulaire ? <a className="kps-btn" href={`/site/${slug}/demande?src=carte`}>Demander un devis</a> : null}
        </div>
        {r ? (
          <section className="kpc-sec"><div className="kpc-h"><b>Réalisations</b><a className="kps-lien" href={`/site/${slug}?src=carte`}>Voir la page</a></div><Paire r={r} /><b>{r.name}</b><small className="kps-mut">{r.lieu}</small></section>
        ) : <a className="kps-lien" href={`/site/${slug}?src=carte`}>Voir la page de {nom}</a>}
        {site.verifie || site.avisStats?.nombre ? <p className="kpc-sceau">{[site.verifie ? "Vérifié par Koji" : "", site.avisStats?.nombre ? `${fmtNote(site.avisStats.moyenne)} · ${site.avisStats.nombre} avis` : "", site.decennale ? "décennale vérifiée" : ""].filter(Boolean).join(" · ")}</p> : null}
      </main>
    </div>
  );
}
