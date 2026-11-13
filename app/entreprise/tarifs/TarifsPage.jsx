import { DM_Sans } from '../../fonts';
import { Check, CONTACT, EndCta, PLANS, PlansBlock, PlansFine, SiteFooter, SiteHeader } from '../SiteParts';
import '../landing.css';

// SITE-03 (maquette « KOJI Pro pages ») : page Tarifs, getkoji.io/entreprise/
// tarifs. Mise en page de la maquette ; contenu de la tarification réelle.
// La maquette précise que ses prix, son tableau et son barème de jetons sont
// des hypothèses « à remplacer après le travail de tarification » : ce
// travail, c'est la page Tarifs du 24 oct. (components/PricingPlans.jsx,
// prix Stripe en ligne). Les lignes du tableau et les jetons en viennent,
// rangés dans les familles de la maquette.
//
// Rendue côté serveur, sans JavaScript.

const YES = 'yes';
const NO = 'no';

// [libellé, Start, Pro, Business] ; texte libre = limite affichée telle quelle.
const TABLE = [
  ['Devis', [
    ['Devis manuel, à vos couleurs', 'Illimité', 'Illimité', 'Illimité'],
    ["Devis guidé par Koji (à partir de la bibliothèque)", '5 par mois', 'Illimité', 'Illimité'],
    ['Signature électronique des devis', NO, YES, YES],
    ['Avenants sur devis signé', NO, YES, YES],
  ]],
  ['Chantiers', [
    ["Fiche chantier et suivi d'avancement", YES, YES, YES],
    ['Calendrier, planning et tâches', NO, YES, YES],
    ['Archives', NO, YES, YES],
  ]],
  ['Clients', [
    ['Contacts', 'Clients', 'Tous types', 'Tous types'],
    ['Votre page Koji (vitrine hébergée par Koji)', 'Essentielle', 'Complète', 'Complète'],
    ['Demandes de devis par votre page Koji, sans jeton', NO, YES, YES],
    ['Carte de visite Koji', NO, YES, YES],
    ['Radar des chantiers (demandes de particuliers)', 'jetons', 'jetons', 'jetons'],
  ]],
  ['Factures', [
    ['Factures, acomptes, situations, relances', NO, YES, YES],
    ['Comptabilité : CA, charges, résultat, TVA', NO, YES, YES],
    ["Export pour l'expert-comptable", NO, NO, YES],
    ['Tableau de bord multi-chantiers, rentabilité par lot', NO, NO, YES],
  ]],
  ['Prix et fournitures', [
    ["Bibliothèque d'ouvrages (380 ouvrages, temps × taux horaire)", 'Lecture', '+ vos ouvrages', '+ import, partagée'],
    ['Fournitures : commandes et livraisons', NO, YES, YES],
    ['Stock, alertes stock bas, dépenses par chantier', NO, NO, YES],
  ]],
  ['Radar des chantiers', [
    ['Jetons inclus chaque mois', '0', '3', '10'],
    ['Prix du jeton supplémentaire', '15 € HT', '10 € HT', '8 € HT'],
    ['Positions ouvertes en même temps', '2', '5', '15'],
    ["Zones d'intervention", '1', '1', 'Plusieurs'],
    ['Mode Urgences (dépannages)', NO, NO, YES],
  ]],
  ['Équipe', [
    ['Comptes terrain (planning, tâches, photos)', 'Illimités', 'Illimités', 'Illimités'],
    ['Comptes gestion (devis, factures, marges)', '1', '1, puis 9 €/mois', '5, puis 7 €/mois'],
    ['Support', 'Aide en ligne', 'Chat', 'Prioritaire'],
  ]],
  ["Koji, l'assistant", [
    ['Sur chaque page, réponses chiffrées sur vos chantiers, devis et factures', 'inclus', 'inclus', 'inclus'],
  ]],
];

// Barème réel (page Tarifs du 24 oct.) : nombre de jetons selon le budget
// estimé du chantier à l'annonce.
const TIERS = [
  ['Chantier de moins de 1 500 €', '1 jeton'],
  ['1 500 à 8 000 €', '3 jetons'],
  ['Plus de 8 000 €', '6 jetons'],
];

const PRIX_JETON = [
  ['Start', '0 inclus · 15 € HT le jeton'],
  ['Pro', '3 par mois · 10 € HT le jeton'],
  ['Business', '10 par mois · 8 € HT le jeton'],
];

const FAQ = [
  ["Puis-je changer d'offre ou arrêter ?", "À tout moment, depuis Paramètres › Abonnement. Un passage à l'offre inférieure prend effet à la fin du mois payé ; vos données restent."],
  ['Que se passe-t-il pour mes factures si je repasse en Start ?', "Elles restent consultables et téléchargeables. Vous ne pouvez plus en émettre de nouvelles jusqu'au retour à Pro."],
  ['Les prix sont-ils hors taxes ?', 'Oui, HT ; la TVA à 20 % s’ajoute. Vous recevez une facture Koji chaque mois ou chaque année.'],
  ['Y a-t-il un engagement ?', "Non. L'offre annuelle est payée d'avance avec deux mois offerts ; elle n'est pas remboursée en cours d'année."],
  ['Combien coûte un chantier trouvé sur le Radar ?', "Le nombre de jetons est affiché avant de vous positionner. Ils ne sont débités que si le client confirme un rendez-vous avec vous."],
  ["Mes ouvriers ont besoin d'un compte payant ?", "Non. Les comptes terrain sont gratuits et illimités dans toutes les offres. Seuls les comptes qui créent des devis ou des factures sont facturés."],
];

// `plan` : nom de l'offre, repris en tête de case sur téléphone (landing.css).
function Cell({ value, plan }) {
  if (value === YES) return <td className="c" data-p={plan}><Check /><span className="lp-sr">Inclus</span></td>;
  if (value === NO) return <td className="c" data-p={plan}><span className="no" aria-label="Non inclus">—</span></td>;
  return <td className="c t" data-p={plan}>{value}</td>;
}

export function TarifsPage() {
  return (
    <div className={`lp ${DM_Sans.variable}`}>
      <SiteHeader page="tarifs" />

      <section className="lp-pgh">
        <div>
          <span className="lp-ey">Tarifs</span>
          <h1>Des offres simples, sans engagement</h1>
          <p>Commencez gratuitement. Passez à Pro le jour où vous facturez avec Koji, à Business quand vous avez une équipe.</p>
        </div>
      </section>

      <section className="lp-plans" id="lp-tarifs">
        <PlansBlock />
        <PlansFine />
      </section>

      {/* Outil par outil : les cases vides disent « — », jamais une croix rouge. */}
      <section className="lp-tc" id="lp-outils">
        <div className="lp-sh">
          <h2>Outil par outil</h2>
          <p>Le menu est le même dans les trois offres : ce qui n'est pas inclus reste visible, grisé, et vous dit vers quelle offre aller.</p>
        </div>
        <div className="lp-ttw">
          <table className="lp-tt">
            <thead>
              <tr>
                <th scope="col"><span className="lp-sr">Outil</span></th>
                {PLANS.map((plan) => (
                  <th scope="col" key={plan.name}>{plan.name}<small>{plan.table}</small></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TABLE.map(([group, rows]) => (
                <FamilyRows key={group} group={group} rows={rows} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="lp-jet" id="lp-jetons">
        <div className="lp-sh">
          <h2>Les jetons du Radar</h2>
          <p>Un jeton n'est débité que lorsqu'un particulier confirme un rendez-vous avec vous. Positionné sans suite : les jetons reviennent.</p>
        </div>
        <div className="lp-jg">
          <div className="lp-card lp-jt">
            <b>Selon le budget estimé du chantier</b>
            {TIERS.map(([label, jetons]) => (
              <div className="r" key={label}><span>{label}</span><b>{jetons}</b></div>
            ))}
            <small className="lp-fine">Exemple : un rendez-vous sur un chantier de 4 000 € = 3 jetons. Le palier est fixé à l'annonce ; il ne change pas après la visite.</small>
          </div>
          <div className="lp-card lp-jt">
            <b>Jetons inclus et jetons achetés</b>
            {PRIX_JETON.map(([plan, detail]) => (
              <div className="r" key={plan}><span>{plan}</span><b>{detail}</b></div>
            ))}
            <small className="lp-fine">Packs de 5, 10 ou 25 au tarif de votre offre, valables 12 mois. Les jetons inclus s'utilisent dans le mois. Les demandes reçues par votre page Koji ne coûtent jamais de jeton.</small>
          </div>
        </div>
      </section>

      <section className="lp-faq" id="lp-faq">
        <div className="lp-sh">
          <h2>Questions sur les offres</h2>
          <p>Une autre question ? <a href={CONTACT} className="lp-ul">Écrivez-nous</a>.</p>
        </div>
        <div className="lp-fq">
          {FAQ.map(([question, answer], idx) => (
            <details key={question} open={idx === 0 ? true : undefined}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <EndCta />
      <SiteFooter page="tarifs" />
    </div>
  );
}

function FamilyRows({ group, rows }) {
  return (
    <>
      <tr className="g"><td colSpan={4}>{group}</td></tr>
      {rows.map(([label, start, pro, business]) => (
        <tr key={label}>
          <td>{label}</td>
          <Cell value={start} plan="Start" />
          <Cell value={pro} plan="Pro" />
          <Cell value={business} plan="Business" />
        </tr>
      ))}
    </>
  );
}
