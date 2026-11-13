import KojiWordmark from '../../components/KojiWordmark';
import { metierHref } from './metiers/metiers-data';

// Morceaux communs du site entreprises : SITE-01 (/entreprise) et SITE-03
// (/entreprise/tarifs) — même en-tête, même bloc d'offres, même pied de
// page, pour que les deux pages ne divergent jamais.

export const SIGNUP = '/signup?type=entreprise';
export const LOGIN = '/login?type=entreprise';
export const PARTICULIER = '/particulier';
export const TARIFS = '/entreprise/tarifs';
export const CONTACT = 'mailto:contact@getkoji.io';

export function Check() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12l5 5L20 6" />
    </svg>
  );
}

// Prix : ceux de Stripe (components/PricingPlans.jsx, page Tarifs du 24 oct.),
// pas la grille d'hypothèse de la maquette (0 / 29 / 59 €). `annual` =
// montant facturé une fois par an, `annualNote` = son équivalent mensuel.
export const PLANS = [
  {
    name: 'Start',
    subtitle: "Pour l'artisan qui démarre ou veut essayer",
    monthly: '0 €',
    monthlyNote: 'pour commencer',
    annual: '0 €',
    annualNote: 'pour commencer',
    table: '0 €',
    // « Chantiers et calendrier » dans la maquette : le calendrier est réservé
    // à Pro (PREMIUM_PATHS de components/Shell.jsx, tableau de /entreprise/tarifs).
    features: ["5 devis avec l'IA par mois", "Chantiers et suivi d'avancement", 'Votre page Koji', 'Radar des chantiers avec jetons'],
    cta: 'Créer mon compte gratuit',
    primary: true,
  },
  {
    name: 'Pro',
    badge: 'Conseillé',
    subtitle: "Pour l'artisan qui devise et facture chaque semaine",
    monthly: '29 € HT',
    monthlyNote: 'par mois',
    annual: '276 € HT',
    annualNote: 'par an, soit 23 € par mois',
    table: '29 € HT / mois',
    features: ['Tout Start', 'Factures, situations, avoirs', 'Facture électronique', 'Fournitures et bibliothèque', 'Réseau pro entre entreprises'],
    cta: 'Essayer Pro',
  },
  {
    name: 'Business',
    subtitle: "Pour l'entreprise avec une équipe",
    monthly: '69 € HT',
    monthlyNote: 'par mois',
    annual: '660 € HT',
    annualNote: 'par an, soit 55 € par mois',
    table: '69 € HT / mois',
    features: ['Tout Pro', 'Dépenses par chantier', 'Équipe, planning et heures', '5 comptes'],
    cta: 'Essayer Business',
  },
];

// En-tête collant. `page` : 'accueil' (ancres de la page), 'tarifs' ou
// 'metier'. « Questions » vise la FAQ de la page quand elle en a une.
export function SiteHeader({ page = 'accueil' }) {
  const home = page === 'accueil' ? '' : '/entreprise';
  const faq = page === 'metier' ? '/entreprise#lp-faq' : '#lp-faq';
  return (
    <header className="lp-h">
      <a href="/" className="lp-w" aria-label="Koji, accueil"><KojiWordmark height={16} /></a>
      <nav aria-label="Navigation principale">
        <a href={`${home}#lp-tour`}>Fonctionnalités</a>
        <a href={`${home}#lp-tour`}>Radar des chantiers</a>
        <a href={TARIFS} aria-current={page === 'tarifs' ? 'page' : undefined}>Tarifs</a>
        <a href={faq}>Questions</a>
      </nav>
      <a href={PARTICULIER} className="lp-cli">Vous avez un projet de travaux ?</a>
      <span className="lp-lg" aria-label="Langue : français">FR</span>
      <a href={LOGIN} className="lp-in">Se connecter</a>
      <a href={SIGNUP} className="lp-y">Créer mon compte</a>
    </header>
  );
}

// Choix Mensuel / Annuel en boutons radio + CSS (landing.css) : fonctionne
// sans JavaScript.
export function PlansBlock() {
  return (
    <div className="lp-bill">
      <input type="radio" name="lpb" id="lpb0" defaultChecked aria-label="Prix mensuel" />
      <input type="radio" name="lpb" id="lpb1" aria-label="Prix annuel" />
      <div className="lp-sw">
        <label htmlFor="lpb0">Mensuel</label>
        <label htmlFor="lpb1">Annuel · 2 mois offerts</label>
      </div>
      <div className="lp-pg">
        {PLANS.map((plan, idx) => (
          <div key={plan.name} className={`lp-pl${idx === 0 ? ' first' : ''}`}>
            <div className="lp-pn">
              <b>{plan.name}</b>
              {plan.badge ? <span className="lp-badge">{plan.badge}</span> : null}
            </div>
            <span className="lp-pw">{plan.subtitle}</span>
            <div className="pr m">{plan.monthly}<small>{plan.monthlyNote}</small></div>
            <div className="pr a">{plan.annual}<small>{plan.annualNote}</small></div>
            <ul>
              {plan.features.map((feature) => (
                <li key={feature}><Check />{feature}</li>
              ))}
            </ul>
            <a href={SIGNUP} className={plan.primary ? 'lp-y' : 'lp-sec'}>{plan.cta}</a>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PlansFine() {
  return (
    <p className="lp-fine c">
      Radar des chantiers : des jetons, débités seulement quand un client confirme un rendez-vous avec vous. Prix hors taxes. Changez d'offre ou arrêtez à tout moment.
    </p>
  );
}

export function EndCta() {
  return (
    <section className="lp-end">
      <div>
        <h2>Votre prochain devis peut partir ce soir.</h2>
        <p>Gratuit pour commencer · iPhone, Android et ordinateur</p>
      </div>
      <a href={SIGNUP} className="lp-y big">Créer mon compte gratuit</a>
    </section>
  );
}

// Pied de page. Métiers et Ressources : pages à créer (SITE-04, SITE-05).
export function SiteFooter({ page = 'accueil' }) {
  const home = page === 'accueil' ? '' : '/entreprise';
  return (
    <>
      <footer className="lp-f">
        <div className="lp-fb">
          <span className="lp-w"><KojiWordmark height={16} /></span>
          <p>Devis, chantiers et factures pour les artisans et entreprises du bâtiment.</p>
          <a href={PARTICULIER} className="lp-cli f">Particulier avec un projet de travaux ? Koji Client</a>
        </div>
        <div className="lp-fc">
          <b>Produit</b>
          <a href={`${home}#lp-tour`}>Devis guidé</a>
          <a href={`${home}#lp-tour`}>Radar des chantiers</a>
          <a href={`${home}#lp-tour`}>Factures</a>
          <a href={`${home}#lp-tour`}>Équipe</a>
          <a href={`${home}#lp-koji`}>Koji, l'assistant</a>
          <a href={TARIFS}>Tarifs</a>
        </div>
        <div className="lp-fc">
          <b>Métiers</b>
          {/* Lien seulement pour les métiers dont la page existe (SITE-04). */}
          {['Plombier', 'Électricien', 'Carreleur', 'Peintre', 'Maçon'].map((nom) => (
            <a key={nom} href={metierHref(nom)}>{nom}</a>
          ))}
          <a>Tous les métiers</a>
        </div>
        <div className="lp-fc">
          <b>Ressources</b>
          <a href="/aide">Aide</a>
          <a>Facture électronique 2026</a>
          <a>TVA dans le bâtiment</a>
          <a>Modèles de devis</a>
        </div>
        <div className="lp-fc">
          <b>Koji</b>
          <a href="/a-propos">À propos</a>
          <a href="/entreprise/contact">Contact</a>
          <a href="/legal">Mentions légales</a>
          <a href="/legal">Conditions d'utilisation</a>
          <a href="/legal">Confidentialité</a>
          <a href="/legal">Cookies</a>
        </div>
        <div className="lp-fl">
          <span>© 2026 Koji</span>
          <span>Fait à Paris</span>
        </div>
      </footer>

      {/* Téléphone : l'action reste sous le pouce */}
      <div className="lp-mbar">
        <a href={SIGNUP} className="lp-y">Créer mon compte gratuit</a>
      </div>
    </>
  );
}
