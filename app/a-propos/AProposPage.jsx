import { DM_Sans } from '../fonts';
import { EndCta, SiteFooter, SiteHeader } from '../entreprise/SiteParts';
import '../entreprise/landing.css';

// SITE-07 (maquette « KOJI Pro pages ») : À propos, getkoji.io/a-propos.
// Page courte : pourquoi Koji, ce que l'équipe croit, qui l'édite, comment
// la joindre. Même en-tête et pied que le site entreprises.
//
// Écarts avec la maquette, dont les textes sont « une base de travail à
// réécrire par ABL » :
// - « Koji (raison sociale à compléter) » → ABL Expert Renov, l'éditeur
//   des mentions légales ; l'équipe (nombre, prénoms, rôles) reste à
//   écrire par ABL, donc absente.
// - Carte « En chiffres » absente : la maquette la veut vide jusqu'au
//   lancement, sans aucun chiffre inventé.
// - « Prix recommandé, pour le particulier comme pour l'entreprise » : le
//   particulier ne voit pas de prix (décision du 10 nov.).
// - Contact : contact@getkoji.io (aide@ et pro@ n'existent pas encore).
const CONVICTIONS = [
  ['Simple avant tout.', "Un artisan n'a pas de temps à donner à un logiciel. Chaque écran a une action."],
  ['Un prix juste, dit avant.', "Le prix recommandé est calculé avant toute visite, avec les prix de l'entreprise."],
  ['Pas de faux avis, pas de classement payé.', 'Les entreprises sont vérifiées, les avis viennent de vrais chantiers, les propositions sont classées par date de réponse.'],
  ['Vos données sont les vôtres.', 'Hébergées en France, téléchargeables, supprimables.'],
];

export function AProposPage() {
  return (
    <div className={`lp ${DM_Sans.variable}`}>
      <SiteHeader page="metier" />

      <section className="lp-pgh">
        <div>
          <span className="lp-ey">À propos</span>
          <h1>Koji est fait par des gens du bâtiment</h1>
          <p>Une entreprise de rénovation à Paris, un outil construit pour son propre usage, puis ouvert aux autres artisans et aux particuliers qui les cherchent.</p>
        </div>
      </section>

      <section className="lp-ab2">
        <div className="lp-abx">
          <h2>Pourquoi Koji</h2>
          <p>
            Le devis se fait le soir, à partir d'un vieux fichier. Les photos restent dans un téléphone. La facture part en retard et la relance n'est jamais faite. Et de l'autre côté, un particulier compare trois devis qu'il ne comprend pas. Koji est né de ces journées-là : décrire le chantier, et que le reste suive.
          </p>
          <h2>Ce que nous croyons</h2>
          <ul className="lp-abl">
            {CONVICTIONS.map(([titre, texte]) => (
              <li key={titre}><b>{titre}</b> {texte}</li>
            ))}
          </ul>
          <h2>Qui</h2>
          <p>
            Koji est édité par <b>ABL Expert Renov</b>, entreprise de rénovation à Paris, et fondé par un entrepreneur du bâtiment. Les informations légales de l'éditeur sont dans les <a href="/legal" className="lp-ul">mentions légales</a>.
          </p>
        </div>
        <aside className="lp-abs">
          <div className="lp-card">
            <b>Contact</b>
            <p><a href="mailto:contact@getkoji.io" className="lp-ul">contact@getkoji.io</a></p>
            <a className="lp-sec" href="/entreprise/contact">Nous écrire</a>
          </div>
          <div className="lp-card">
            <b>Presse et partenaires</b>
            <p>Dossier de presse et logo (charte v2) sur demande.</p>
          </div>
        </aside>
      </section>

      <EndCta />
      <SiteFooter page="metier" />
    </div>
  );
}
