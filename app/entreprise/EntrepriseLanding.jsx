import { DM_Sans } from '../fonts';
import { Check, CONTACT, EndCta, PlansBlock, PlansFine, SIGNUP, SiteFooter, SiteHeader } from './SiteParts';
import { metierHref } from './metiers/metiers-data';
import './landing.css';

// SITE-01 (maquette « KOJI Pro pages », v3) : page d'accueil publique pour les
// artisans et entreprises, sur getkoji.io/entreprise. Une seule action :
// créer son compte.
//
// Onglets de « Tout le métier » et choix Mensuel / Annuel : boutons radio et
// CSS seulement (landing.css), comme la maquette — la page fonctionne sans
// JavaScript et se rend côté serveur (référencement).
//
// Deux écarts voulus avec la maquette, dont la grille 0 / 29 / 59 € était une
// hypothèse : les prix sont ceux de Stripe et l'offre Start annonce
// « 5 devis avec l'IA par mois » (décision du 1er nov.), pas « illimités ».
// En-tête, offres et pied de page : ./SiteParts.jsx (partagés avec Tarifs).

function Star() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z" />
    </svg>
  );
}

const METIERS = ['Plombier', 'Électricien', 'Carreleur', 'Peintre', 'Plaquiste', 'Maçon', 'Menuisier', "Rénovation tous corps d'état"];

const DEVIS_LIGNES = [
  ['Lot 01', 'Déposer la baignoire et la faïence', '983,20 €'],
  ['Lot 02', 'Poser le receveur extra-plat 90 × 120', '690,00 €'],
  ['Lot 02', "Créer l'évacuation du receveur", '420,00 €'],
  ['Lot 03', 'Poser la faïence toute hauteur, 19,4 m²', '1 707,20 €'],
  ['Lot 04', "Créer le circuit de la salle d'eau", '380,00 €'],
];

// Carte du Radar (onglet Trouver) : prix recommandés épinglés dans la zone.
function RadarMap() {
  const pin = (x, y, w, label, taken) => (
    <g>
      <path d={`M${x + w / 2 - 6} ${y + 29} l6 7 l6 -7z`} fill={taken ? '#5B5F66' : '#171B1E'} />
      <rect
        rx="4"
        x={x}
        y={y}
        width={w}
        height="30"
        fill={taken ? '#FFFFFF' : '#171B1E'}
        stroke="#171B1E"
        strokeWidth="1.5"
        strokeDasharray={taken ? '4 3' : undefined}
      />
      <text x={x + 10} y={y + 20} fontSize="15" fontWeight="700" fill={taken ? '#171B1E' : '#FFFFFF'}>{label}</text>
    </g>
  );
  return (
    <svg className="lp-map" viewBox="0 0 560 360" role="img" aria-label="Carte du Radar des chantiers">
      <rect width="560" height="360" fill="#E4E3DC" />
      <rect x="20" y="20" width="90" height="60" fill="#D9D8D0" />
      <rect x="150" y="30" width="80" height="50" fill="#D9D8D0" />
      <rect x="300" y="15" width="120" height="55" fill="#D9D8D0" />
      <rect x="470" y="40" width="70" height="40" fill="#D9D8D0" />
      <rect x="30" y="150" width="70" height="60" fill="#D9D8D0" />
      <rect x="330" y="150" width="90" height="55" fill="#D9D8D0" />
      <rect x="470" y="150" width="70" height="70" fill="#D9D8D0" />
      <rect x="40" y="290" width="110" height="50" fill="#D9D8D0" />
      <rect x="330" y="300" width="120" height="45" fill="#D9D8D0" />
      <rect x="168" y="198" width="72.8" height="54" fill="#CFDCC4" />
      <path d="M0 115.2 L560 90" stroke="#FFFFFF" strokeWidth="12" fill="none" />
      <path d="M0 266.4 L560 288" stroke="#FFFFFF" strokeWidth="9" fill="none" />
      <path d="M123.2 0 L156.8 360" stroke="#FFFFFF" strokeWidth="10" fill="none" />
      <path d="M380.8 0 L336 360" stroke="#FFFFFF" strokeWidth="8" fill="none" />
      <path d="M0 187.2 L560 169.2" stroke="#FFFFFF" strokeWidth="5" fill="none" />
      <path d="M252 0 L263.2 360" stroke="#FFFFFF" strokeWidth="4" fill="none" />
      <circle cx="257.6" cy="180" r="151.2" fill="none" stroke="#171B1E" strokeWidth="1.5" strokeDasharray="5 5" />
      <circle cx="257.6" cy="180" r="9" fill="#171B1E" stroke="#FFFFFF" strokeWidth="3" />
      {pin(110, 70, 83, '6 000 €')}
      {pin(360, 105, 83, '3 400 €')}
      {pin(170, 235, 83, '1 500 €')}
      {pin(395, 240, 92, '12 800 €', true)}
    </svg>
  );
}

// Photo de chantier dessinée (onglet Conduire) ; `flip` = la vue « après ».
function ChantierPhoto({ stamp, label, flip = false }) {
  const mirror = flip ? { transform: 'scaleX(-1)' } : undefined;
  return (
    <div>
      <div className={`ph-i${flip ? '' : ' dk'}`} style={mirror}>
        <svg viewBox="0 0 260 180" preserveAspectRatio="xMidYMid slice" style={{ display: 'block', width: '100%', height: '100%' }} aria-hidden="true">
          <rect width="260" height="180" fill="#C9C6C0" />
          <rect y="133" width="260" height="47" fill="#8F8B85" />
          <rect x="26" y="69" width="99" height="64" fill="#E3E0DA" stroke="#77736D" />
          <path d="M143 30 l30 40 l-12 30" stroke="#77736D" fill="none" />
          <rect x="161" y="87" width="47" height="46" fill="#D8D4CD" stroke="#77736D" />
          <rect x="16" y="40" width="78" height="34" fill="#B5B1AA" />
        </svg>
        <span className="ph-st" style={mirror}>{stamp}</span>
        <span className="ph-k" style={mirror}>{label}</span>
      </div>
    </div>
  );
}

const TOUR = [
  {
    num: '01',
    title: 'Trouver',
    heading: 'Des chantiers près de chez vous, déjà décrits',
    description:
      'Sur le Radar, chaque demande arrive avec des photos, un projet structuré et un prix recommandé que le client a déjà accepté. Vous voyez votre marge avant de vous positionner.',
    items: [
      'Zone et métiers choisis par vous',
      'Prix recommandé affiché avant de vous positionner',
      'Jetons débités seulement si le client confirme le rendez-vous',
    ],
    visual: (
      <div className="lp-vis">
        <RadarMap />
      </div>
    ),
  },
  {
    num: '02',
    title: 'Chiffrer',
    heading: "Vos prix, pas ceux d'un catalogue",
    description:
      "Importez quelques factures : Koji calcule votre taux par métier et l'applique à chaque ligne. Il pose les questions qu'on oublie sur place, et vous validez chaque ligne.",
    items: [
      'Taux horaire tiré de vos factures',
      'Fournitures au prix public, avec votre remise',
      'TVA et mentions choisies selon le client et le logement',
    ],
    visual: (
      <div className="lp-card lp-rates">
        <div><span>Électricité</span><b>61 €/h</b><small>38 lignes lues</small></div>
        <div><span>Carrelage, faïence</span><b>58 €/h</b><small>31 lignes lues</small></div>
        <div><span>Plomberie</span><b>62 €/h</b><small>24 lignes lues</small></div>
        <p>D'après 12 factures, 2025 et 2026</p>
      </div>
    ),
  },
  {
    num: '03',
    title: 'Conduire',
    heading: 'Le chantier tenu, du premier coup de masse à la réception',
    description:
      'Planning, photos avant et après horodatées par votre équipe, réserves levées en photo, procès-verbal signé sur le téléphone. Votre client suit tout depuis son téléphone.',
    items: [
      'Journal de chantier en photos',
      'Avenant signé avant de faire le travail en plus',
      'Procès-verbal de réception signé sur place',
    ],
    visual: (
      <div className="lp-ph">
        <ChantierPhoto stamp="14/11 08:02 · Yanis K." label="Avant" />
        <ChantierPhoto stamp="14/11 16:41 · Yanis K." label="Après" flip />
        <div className="lp-ph-r">
          <b>Réserves</b>
          <span>2 levées sur 2 · procès-verbal signé le 20/11</span>
        </div>
      </div>
    ),
  },
  {
    num: '04',
    title: 'Encaisser',
    heading: 'Facturé le jour même, payé plus tôt',
    description:
      'Acompte à la signature, situations de travaux, facture de solde calculée à partir du devis. Koji prépare les relances, vous validez.',
    items: [
      'Acompte, situations, solde et avoirs',
      'Relances préparées au bon moment',
      'Factures électroniques et export pour le comptable',
    ],
    visual: (
      <div className="lp-card lp-inv">
        <div className="lp-inv-h">
          <b>Factures · novembre</b>
          <span>À encaisser : 14 074,00 €</span>
        </div>
        <div className="r"><em>F-2026-118</em><span>Salle de bain, Paris 10e</span><b>1 739,56 €</b><i className="ok">Payée</i></div>
        <div className="r"><em>F-2026-121</em><span>Cuisine, Montreuil</span><b>4 210,00 €</b><i className="late">Échue depuis 12 j · relance prête</i></div>
        <div className="r"><em>SIT-2026-07</em><span>Situation n° 2 · 85 %</span><b>9 864,00 €</b><i className="sent">Envoyée</i></div>
        <div className="r"><em>AV-2026-003</em><span>Avoir sur F-2026-109</span><b>−240,00 €</b><i className="sent">Envoyé</i></div>
        <p>Transmises au format électronique · copie au comptable chaque mois</p>
      </div>
    ),
  },
  {
    num: '05',
    title: 'Équipe',
    heading: "Toute l'équipe sur la même page",
    description:
      'Chacun voit son planning, pointe ses heures et envoie ses photos depuis son téléphone. Les messages sont traduits dans la langue de chaque compagnon.',
    items: [
      'Planning de la semaine par compagnon',
      'Heures et dépenses rattachées au chantier',
      'Messages traduits : portugais, arabe, turc, roumain, polonais',
    ],
    visual: (
      <div className="lp-card lp-eq">
        <div className="g h"><span /><b>Lun.</b><b>Mar.</b><b>Mer.</b><b>Jeu.</b><b>Ven.</b></div>
        {[
          ['Yanis K.', 'Paris 18e', 'Paris 18e', 'Montreuil', 'Montreuil', null],
          ['Sergiu P.', 'Paris 10e', 'Paris 10e', 'Paris 10e', 'Paris 18e', 'Paris 18e'],
          ['Adem T.', 'Montreuil', 'Montreuil', null, 'Paris 10e', 'Paris 10e'],
        ].map(([nom, ...jours]) => (
          <div className="g" key={nom}>
            <span>{nom}</span>
            {jours.map((lieu, i) => (
              <i key={i} className={lieu ? undefined : 'off'}>{lieu || '—'}</i>
            ))}
          </div>
        ))}
        <p>Heures pointées sur le téléphone · messages traduits en roumain et en turc</p>
      </div>
    ),
  },
];

const ALSO = [
  ['Votre page Koji', 'Une vitrine avec vos réalisations et vos avis vérifiés, prête en dix minutes.'],
  ['Le Réseau pro', 'Trouvez un sous-traitant ou un lot à prendre entre entreprises, sans commission.'],
  ["Bibliothèque d'ouvrages", "Vos ouvrages types, réutilisés d'un devis à l'autre."],
  ['Dépenses par chantier', 'Tickets et factures fournisseurs rangés, marge réelle à jour.'],
];

const COMPARE = [
  ['Le devis', "Le soir, à partir d'un ancien fichier", 'Sur place ou dans le camion, guidé par les questions de Koji'],
  ['Les prix', "Recopiés d'un devis précédent", 'Tirés de vos factures, métier par métier'],
  ['TVA et mentions', 'À vérifier à chaque fois', 'Choisies et ajoutées par Koji, certifiées par le client en signant'],
  ['La signature', 'Imprimer, faire signer, scanner', 'Signature en ligne, acompte demandé dans la foulée'],
  ['Les impayés', 'Un tableau à tenir à jour', 'Relances préparées, vous validez'],
  ['Les nouveaux chantiers', 'Le bouche-à-oreille', 'Le Radar des chantiers et votre page Koji'],
];

const RULES = [
  ['La bonne TVA', "10 % en rénovation, 5,5 % pour les travaux d'énergie, 20 % pour une société, autoliquidation en sous-traitance. Le client certifie la mention en signant."],
  ['Les mentions obligatoires', 'Assurance décennale, conditions de paiement, médiateur, numérotation sans trou : rien ne manque sur vos documents.'],
  ['Signature chez le client', 'Délai de rétractation, formulaire joint, acompte demandé au bon moment : Koji suit la règle selon le lieu de signature.'],
  ['Corriger sans tricher', 'Une facture se corrige par un avoir qui la référence, puis une nouvelle facture. Deux clics.'],
];

const STEPS = [
  ['Votre entreprise', 'Saisissez votre SIREN : nom, adresse et numéro de TVA se remplissent seuls.'],
  ['Vos prix', 'Envoyez trois à dix factures récentes. Koji en tire votre taux par métier.'],
  ['Vos clients et anciens devis', "Importez votre fichier Excel ou votre ancien logiciel. Ou envoyez-le nous, on s'en charge."],
  ['Votre premier devis', 'Décrivez le chantier, répondez aux questions, envoyez. Le client signe sur son téléphone.'],
];

const SAFE = [
  ['M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3', 'Données hébergées en France', 'Sauvegardes chaque jour, accès chiffré.'],
  ['M12 4v11M7 10l5 5 5-5M5 20h14', 'Vos données vous appartiennent', 'Devis, factures, photos et contacts téléchargeables à tout moment.'],
  ['M4 17c3-6 5-6 6-2s3 4 5-1 3-3 5 1M4 21h16', 'Signature avec preuve', 'Date, heure et identité du signataire conservées avec le document.'],
  ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4-6 8-6s7 2 8 6', 'Un humain répond', 'Par message ou par téléphone, du lundi au samedi.'],
];

const FAQ = [
  ['Combien coûte un chantier trouvé sur le Radar ?', 'Le nombre de jetons est affiché avant de vous positionner. Ils ne sont débités que si le client confirme le rendez-vous ; sinon ils reviennent sur votre solde.'],
  ["Je n'ai pas le temps de remplir mes prix.", "Envoyez trois à dix factures récentes : Koji en déduit votre taux par métier. Vous validez, c'est tout."],
  ['Mes clients doivent-ils installer quelque chose ?', 'Non. Ils reçoivent devis et factures par lien et signent en ligne. Ceux qui veulent suivre leur chantier peuvent ouvrir Koji Client.'],
  ['Je travaille surtout sur mon téléphone.', "Tout se fait sur le téléphone : visite, devis, photos, signature du client, factures. L'ordinateur est un confort, pas une obligation."],
  ['Et la facture électronique ?', 'Koji reçoit et transmet vos factures au format électronique par une plateforme agréée. Vous continuez à facturer comme avant.'],
  ["Mon comptable peut-il s'en servir ?", "Oui. Vos dépenses sont rangées par chantier et vos factures s'envoient au comptable en un fichier, chaque mois."],
  ["J'ai déjà un logiciel de devis.", "Importez vos clients, vos ouvrages et vos anciens devis depuis un fichier Excel. Si c'est plus simple, envoyez-le nous."],
  ['Je peux partir avec mes données ?', 'Oui. Devis, factures, chantiers, contacts et photos se téléchargent à tout moment depuis votre compte.'],
];

export function EntrepriseLanding() {
  return (
    <div className={`lp ${DM_Sans.variable}`}>
      <SiteHeader />

      {/* Ouverture : la promesse à gauche, le produit lui-même à droite */}
      <section className="lp-hero">
        <div className="lp-hl">
          <h1>
            Décrivez le chantier.
            <br />
            Koji le chiffre.
          </h1>
          <p>
            L'application des artisans et des entreprises du bâtiment : trouver des chantiers près de chez vous, envoyer un devis juste en dix minutes, suivre le chantier et encaisser.
          </p>
          <div className="lp-ctas">
            <a href={SIGNUP} className="lp-y big">Créer mon compte gratuit</a>
            <a className="lp-sec" href="#lp-tour">Voir comment ça marche</a>
          </div>
          <small>Offre Start gratuite, sans carte bancaire et sans engagement.</small>
          <ul className="lp-trust">
            <li>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5" /></svg>
              <span>Prêt pour la facture électronique</span>
            </li>
            <li>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v12H4zM4 10h16M8 14h3" /></svg>
              <span>Données hébergées en France</span>
            </li>
            <li>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h8v18H8zM11 18h2" /></svg>
              <span>Sur téléphone et ordinateur</span>
            </li>
          </ul>
          {/* Pages par métier (SITE-04) : lien dès que le contenu du métier est écrit. */}
          <div className="lp-met">
            <span>Fait pour</span>
            {METIERS.map((metier) => <a key={metier} href={metierHref(metier)}>{metier}</a>)}
          </div>
        </div>
        <div className="lp-hr">
          <div className="lp-doc">
            <div className="lp-dt">
              <b>Devis 2026-041</b>
              <span>Salle de bain, Paris 10e</span>
            </div>
            <div className="lp-chat">
              <div className="me">Salle de bain de 5,8 m², douche à l'italienne à la place de la baignoire, 4e sans ascenseur.</div>
              <div className="kj">
                <Star />
                <span>L'évacuation actuelle peut-elle servir ? Je compte une demi-journée de plus pour les gravats par l'escalier.</span>
              </div>
            </div>
            <div className="lp-ls">
              {DEVIS_LIGNES.map(([lot, label, prix]) => (
                <div className="l" key={label}><em>{lot}</em><span>{label}</span><b>{prix}</b></div>
              ))}
              <div className="l more"><em /><span>+ 6 lignes</span><b /></div>
            </div>
            <div className="lp-tot">
              <span>Total TTC · TVA 10 % choisie par Koji</span>
              <b>5 798,54 €</b>
            </div>
            <div className="lp-st">
              <i className="on"><Check />Envoyé</i>
              <i className="on"><Check />Vu</i>
              <i className="on"><Check />Signé</i>
            </div>
          </div>
        </div>
      </section>

      {/* Koji, l'assistant */}
      <section className="lp-koji" id="lp-koji">
        <div className="lp-kl">
          <span className="lp-ks"><Star /></span>
          <h2>Une question sur votre entreprise ? Demandez à Koji.</h2>
          <p>
            Koji connaît vos chantiers, vos devis, vos factures et votre équipe. Il répond avec les chiffres, montre d'où ils viennent et prépare la suite : une relance, un avenant, un message. Rien ne part sans vous.
          </p>
          <div className="lp-kq">
            <a>Qui me doit de l'argent ?</a>
            <a>Mon planning de la semaine</a>
            <a>Combien j'ai dépensé en fournitures ce mois-ci ?</a>
            <a>Relance le devis de M. Caron</a>
          </div>
        </div>
        <div className="lp-kr">
          <div className="q">Quels chantiers perdent de l'argent ce mois-ci ?</div>
          <div className="a">
            <small>Réponse de Koji, assistant IA · sources : devis 2026-033, 4 factures fournisseurs</small>
            <p>Appartement Caulaincourt passe de 28 % à 21 % de marge : fournitures du carrelage à 5 400 € pour 3 100 € prévus, sans avenant.</p>
            <span className="act">Préparer l'avenant de 2 300 € HT</span>
          </div>
          <div className="in">
            Posez votre question, à l'écrit ou à la voix…
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          </div>
        </div>
      </section>

      {/* Visite guidée à onglets */}
      <section className="lp-tour" id="lp-tour">
        <div className="lp-sh">
          <h2>Tout le métier, dans une seule application</h2>
          <p>Du premier contact à la dernière facture, sans changer d'outil.</p>
        </div>
        <div className="lp-tabs">
          {TOUR.map((tab, idx) => (
            <input key={tab.num} type="radio" name="lpt" id={`lpt${idx}`} defaultChecked={idx === 0} aria-label={tab.title} />
          ))}
          <div className="lp-tl">
            {TOUR.map((tab, idx) => (
              <label key={tab.num} htmlFor={`lpt${idx}`}>
                <span>{tab.num}</span>
                {tab.title}
              </label>
            ))}
          </div>
          <div className="lp-tps">
            {TOUR.map((tab, idx) => (
              <div key={tab.num} className={`lp-tp p${idx}`}>
                <div className="lp-tx">
                  <h3>{tab.heading}</h3>
                  <p>{tab.description}</p>
                  <ul>
                    {tab.items.map((item) => (
                      <li key={item}><Check />{item}</li>
                    ))}
                  </ul>
                </div>
                {tab.visual}
              </div>
            ))}
          </div>
        </div>
        <div className="lp-also">
          <b>Et aussi</b>
          {ALSO.map(([title, text]) => (
            <div key={title}>
              <span>{title}</span>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Avant / avec */}
      <section className="lp-cmp">
        <div className="lp-sh">
          <h2>Le soir, vous avez mieux à faire que des devis</h2>
          <p>Ce qui change quand on passe du tableur à Koji.</p>
        </div>
        <div className="lp-ct">
          <div className="hd">
            <span />
            <b>Avec un tableur et un traitement de texte</b>
            <b className="k">Avec Koji</b>
          </div>
          {COMPARE.map(([sujet, avant, avec]) => (
            <div className="r" key={sujet}>
              <span>{sujet}</span>
              <p>{avant}</p>
              <p className="k"><Check />{avec}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Les règles du bâtiment + facture électronique */}
      <section className="lp-rules">
        <div className="lp-sh">
          <h2>Les règles du bâtiment, Koji s'en occupe</h2>
          <p>Ce qui fait perdre du temps, ou de l'argent quand c'est oublié, est appliqué tout seul sur vos devis et factures.</p>
        </div>
        <div className="lp-rg">
          {RULES.map(([title, text]) => (
            <div key={title}>
              <b>{title}</b>
              <p>{text}</p>
            </div>
          ))}
        </div>
        <div className="lp-fe">
          <div className="lp-fe-t">
            <span className="lp-tag">Réforme 2026-2027</span>
            <b>Facture électronique : vous êtes prêt</b>
            <p>
              Depuis le 1er septembre 2026, toute entreprise doit pouvoir recevoir des factures électroniques. À partir du 1er septembre 2027, les TPE et PME devront aussi les émettre. Koji reçoit et transmet vos factures par une plateforme agréée, sans changer votre façon de travailler.
            </p>
          </div>
          <div className="lp-fe-d">
            <div><em>1er sept. 2026</em><span>Réception pour toutes les entreprises</span></div>
            <div><em>1er sept. 2027</em><span>Émission pour les TPE et PME</span></div>
          </div>
        </div>
      </section>

      {/* Démarrage */}
      <section className="lp-steps">
        <div className="lp-sh">
          <h2>Démarrer prend une soirée</h2>
          <p>Pas de formation, pas de rendez-vous commercial obligatoire.</p>
        </div>
        <ol>
          {STEPS.map(([title, text], idx) => (
            <li key={title}>
              <span>{idx + 1}</span>
              <b>{title}</b>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Qui est derrière : citation du fondateur et programme pionniers */}
      <section className="lp-orig">
        <div className="lp-q">
          <p className="qt">
            « Koji est né dans notre entreprise de rénovation, à Paris. Chaque écran a d'abord servi sur nos propres chantiers, de la visite au procès-verbal. Ce qui n'aidait pas a été retiré. »
          </p>
          <div className="sg">
            <span className="av">B</span>
            <div>
              <b>Bilal A.</b>
              <small>Fondateur de Koji, dirigeant d'une entreprise de rénovation</small>
            </div>
          </div>
        </div>
        <div className="lp-pio">
          <span className="lp-tag">Programme pionniers</span>
          <h3>Construisez Koji avec nous</h3>
          <ul>
            <li><Check />L'offre Pro au prix de lancement, gardé tant que vous restez</li>
            <li><Check />Une ligne directe avec l'équipe qui construit Koji</li>
            <li><Check />Vos demandes passent en priorité dans les nouveautés</li>
          </ul>
          <a href={SIGNUP} className="lp-sec">Rejoindre les pionniers</a>
        </div>
      </section>

      {/* Offres */}
      <section className="lp-plans" id="lp-tarifs">
        <div className="lp-sh">
          <h2>Des offres simples, sans engagement</h2>
          <p>Commencez gratuitement. Passez à Pro le jour où vous facturez avec Koji.</p>
        </div>
        <PlansBlock />
        <PlansFine />
      </section>

      {/* Confiance */}
      <section className="lp-safe">
        {SAFE.map(([icon, title, text]) => (
          <div key={title}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={icon} /></svg>
            <b>{title}</b>
            <p>{text}</p>
          </div>
        ))}
      </section>

      {/* Questions */}
      <section className="lp-faq" id="lp-faq">
        <div className="lp-sh">
          <h2>Questions fréquentes</h2>
          <p>
            Une autre question ? <a href={CONTACT} className="lp-ul">Écrivez-nous</a>, un humain répond.
          </p>
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
      <SiteFooter />
    </div>
  );
}
