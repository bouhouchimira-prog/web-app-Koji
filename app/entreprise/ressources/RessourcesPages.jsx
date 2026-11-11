import { DM_Sans } from '../../fonts';
import { EndCta, SiteFooter, SiteHeader } from '../SiteParts';
import { FICHES, THEMES, ficheHref } from './ressources-data';
import { NewsletterForm } from './NewsletterForm';
import '../landing.css';

// SITE-05 (maquette « KOJI Pro pages ») : liste des fiches Ressources et
// gabarit d'article. Le ton est celui de l'aide, pas de la vente. Rendu côté
// serveur ; le filtre par thème est en boutons radio + CSS (sans
// JavaScript) ; seul le formulaire d'inscription est un composant client.

function Star() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z" />
    </svg>
  );
}

// Règles du filtre : quand le thème n est coché, seules ses fiches restent.
const FILTRE_CSS = THEMES.map((_, i) => `
#lpr${i + 1}:checked ~ .lp-tags label[for=lpr${i + 1}]{background:#171B1E;color:#FFFFFF;border-color:#171B1E}
#lpr${i + 1}:checked ~ .lp-ag .lp-ac:not([data-t="${i + 1}"]){display:none}`).join('')
  + '\n#lpr0:checked ~ .lp-tags label[for=lpr0]{background:#171B1E;color:#FFFFFF;border-color:#171B1E}';

export function RessourcesListe() {
  return (
    <div className={`lp ${DM_Sans.variable}`}>
      <SiteHeader page="metier" />

      <section className="lp-pgh">
        <div>
          <span className="lp-ey">Ressources</span>
          <h1>Ressources</h1>
          <p>Des réponses courtes aux questions qu'un artisan se pose : règles, TVA, devis, factures. Écrites par Koji, relues par des professionnels.</p>
        </div>
      </section>

      <section className="lp-rs">
        <style>{FILTRE_CSS}</style>
        <input type="radio" name="lpr" id="lpr0" defaultChecked aria-label="Tous les thèmes" />
        {THEMES.map((theme, i) => (
          <input key={theme} type="radio" name="lpr" id={`lpr${i + 1}`} aria-label={theme} />
        ))}
        <div className="lp-tags">
          <label htmlFor="lpr0">Tous</label>
          {THEMES.map((theme, i) => (
            <label key={theme} htmlFor={`lpr${i + 1}`}>{theme}</label>
          ))}
        </div>
        <div className="lp-ag">
          {FICHES.map((fiche) => {
            const href = ficheHref(fiche);
            const Tag = href ? 'a' : 'div';
            return (
              <Tag key={fiche.slug} href={href} className={`lp-card lp-ac${href ? '' : ' soon'}`} data-t={THEMES.indexOf(fiche.theme) + 1}>
                <span className="lp-tag">{fiche.theme}</span>
                <b>{fiche.titre}</b>
                <p>{fiche.resume}</p>
                <small>{fiche.rubrique} · {fiche.duree}{href ? '' : ' · à paraître'}</small>
              </Tag>
            );
          })}
        </div>
      </section>

      <section className="lp-nl">
        <div>
          <h2>Une fiche par mois, pas plus</h2>
          <p>Les changements de règles qui concernent votre métier, résumés en dix lignes.</p>
        </div>
        <NewsletterForm />
      </section>

      <EndCta />
      <SiteFooter page="metier" />
    </div>
  );
}

export function RessourceArticle({ fiche }) {
  const { article } = fiche;
  return (
    <div className={`lp ${DM_Sans.variable}`}>
      <SiteHeader page="metier" />

      <article className="lp-art">
        <div className="lp-ah">
          <a className="lp-bc" href="/entreprise/ressources">Ressources › {fiche.rubrique}</a>
          <h1>{fiche.titre}</h1>
          <p className="lp-al">{article.chapo}</p>
          <small>
            Mis à jour le {article.misAJour} · {fiche.duree}
            {article.relu ? ` · relu par un expert-comptable le ${article.relu}` : ''}
          </small>
        </div>
        <div className="lp-ab">
          <nav className="lp-at" aria-label="Sommaire">
            <b>Sommaire</b>
            {article.sections.map((section) => (
              <a key={section.id} href={`#${section.id}`}>{section.titre}</a>
            ))}
            <a href="#koji">Ce que Koji fait</a>
            <a href="#sources">Sources</a>
          </nav>
          <div className="lp-ax">
            {article.sections.map((section) => (
              <div key={section.id}>
                <h2 id={section.id}>{section.titre}</h2>
                {section.html.map((paragraphe, i) => (
                  // Texte de la fiche (fichier du dépôt, pas une saisie) : gras autorisé.
                  <p key={i} dangerouslySetInnerHTML={{ __html: paragraphe }} />
                ))}
                {section.koji ? (
                  <div className="lp-callout" id="koji">
                    <Star />
                    <div>
                      <b>Ce que Koji fait</b>
                      <span>{section.koji}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
            <h2 id="sources">Sources</h2>
            <p className="lp-src">{article.sources}</p>
            <p className="lp-src">Information générale, pas un conseil juridique ou fiscal.</p>
          </div>
        </div>
      </article>

      <EndCta />
      <SiteFooter page="metier" />
    </div>
  );
}
