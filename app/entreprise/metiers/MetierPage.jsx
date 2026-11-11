import { DM_Sans } from '../../fonts';
import { Check, EndCta, SiteFooter, SiteHeader } from '../SiteParts';
import { METIERS, metierHref } from './metiers-data';
import '../landing.css';

// SITE-04 : gabarit des pages Métiers (maquette « KOJI Pro pages »). Ordre
// fixe : promesse du métier, trois familles de travaux, un exemple de devis
// guidé en trois temps, des ouvrages de la bibliothèque (jamais de prix
// public : « à partir de vos prix »), les règles du métier, les autres
// métiers. Rendue côté serveur, sans JavaScript.
export function MetierPage({ slug, contenu }) {
  const nom = METIERS.find((m) => m.slug === slug)?.nom || '';
  return (
    <div className={`lp ${DM_Sans.variable}`}>
      <SiteHeader page="metier" />

      <section className="lp-pgh">
        <div>
          <span className="lp-ey">Métiers · {nom}</span>
          <h1>{contenu.titre}</h1>
          <p>{contenu.description}</p>
        </div>
      </section>

      <section className="lp-mt">
        <div className="lp-sh">
          <h2>Ce que vous chiffrez tous les jours</h2>
          <p>Koji connaît les ouvrages du métier ; vos prix restent les vôtres.</p>
        </div>
        <div className="lp-mg">
          {contenu.familles.map(([titre, texte]) => (
            <div className="lp-card lp-mc" key={titre}>
              <b>{titre}</b>
              <p>{texte}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-mx">
        <div className="lp-sh">
          <h2>{contenu.exemple.titre}</h2>
          <p>{contenu.exemple.sousTitre}</p>
        </div>
        <div className="lp-mg3">
          {contenu.exemple.etapes.map(([titre, texte], idx) => (
            <div key={titre}>
              <span className="lp-n">{idx + 1}</span>
              <b>{titre}</b>
              <p>{texte}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-mo">
        <div className="lp-sh">
          <h2>Des ouvrages prêts, à vos prix</h2>
          <p>{contenu.bibliotheque}</p>
        </div>
        <div className="lp-card lp-ot" role="table" aria-label="Exemples d'ouvrages de la bibliothèque">
          <div className="h" role="row">
            <span role="columnheader">Ouvrage</span>
            <span role="columnheader">Unité</span>
            <span role="columnheader">Prix</span>
          </div>
          {contenu.ouvrages.map(([label, unite]) => (
            <div className="r" role="row" key={label}>
              <span role="cell">{label}</span>
              <span role="cell">{unite}</span>
              <span role="cell">à partir de vos prix</span>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-mr">
        <div className="lp-sh">
          <h2>{contenu.reglesTitre}</h2>
          <p>Sans promettre la conformité : Koji aide, vous décidez.</p>
        </div>
        <div className="lp-rl">
          {contenu.regles.map(([titre, texte]) => (
            <div key={titre}>
              <Check />
              <b>{titre}</b>
              <span>{texte}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-mm">
        <div className="lp-sh">
          <h2>Les autres métiers</h2>
          <p>Chaque métier a sa page, ses ouvrages et ses règles.</p>
        </div>
        {/* Un métier sans contenu écrit n'a pas encore de page : libellé seul. */}
        <div className="lp-ml">
          {METIERS.map((m) => (
            <a key={m.slug} href={metierHref(m.slug)} aria-current={m.slug === slug ? 'page' : undefined}>{m.nom}</a>
          ))}
        </div>
      </section>

      <EndCta />
      <SiteFooter page="metier" />
    </div>
  );
}
