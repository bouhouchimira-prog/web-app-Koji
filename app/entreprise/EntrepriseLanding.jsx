"use client";

import Link from "next/link";
import { DM_Sans } from "next/font/google";
import { useState } from "react";
import "./landing.css";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--f" });

const SIGNUP = "/login?type=entreprise";
const CONTACT = "mailto:contact@kojibuild.com";

function Check() {
  return (
    <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
  );
}

function RadarMap() {
  return (
    <svg viewBox="0 0 630 410">
      <rect width="630" height="410" fill="#E6E6DF" />
      <g fill="#D6D6CF" stroke="#171B1E" strokeWidth="2">
        <rect x="22" y="22" width="102" height="66" /><rect x="168" y="34" width="90" height="56" />
        <rect x="336" y="16" width="134" height="62" /><rect x="526" y="22" width="80" height="50" />
        <rect x="34" y="168" width="78" height="66" /><rect x="368" y="168" width="66" height="60" />
        <rect x="526" y="164" width="80" height="78" /><rect x="186" y="320" width="122" height="56" />
        <rect x="370" y="330" width="134" height="52" />
      </g>
      <rect x="188" y="222" width="82" height="62" fill="#CFDCC4" stroke="#171B1E" strokeWidth="2" />
      <g stroke="#FFFFFF" strokeWidth="10" fill="none">
        <path d="M136 0v410M300 0l-6 410M-10 130h650M-10 240h650M-10 310h650M-10 205h650" />
      </g>
      <circle cx="314" cy="206" r="134" fill="none" stroke="#171B1E" strokeWidth="1.5" strokeDasharray="5 5" />
      <circle cx="314" cy="206" r="8" fill="#171B1E" />
      <g fontWeight="700" fontSize="19" textAnchor="middle">
        <rect x="268" y="118" width="96" height="36" fill="#171B1E" /><text x="316" y="143" fill="#FFFFFF">6 000 €</text>
        <rect x="482" y="168" width="96" height="36" fill="#171B1E" /><text x="530" y="193" fill="#FFFFFF">3 400 €</text>
        <rect x="236" y="282" width="96" height="36" fill="#171B1E" /><text x="284" y="307" fill="#FFFFFF">1 500 €</text>
        <rect x="490" y="300" width="104" height="36" fill="#FFFFFF" stroke="#171B1E" strokeWidth="1.5" strokeDasharray="4 3" /><text x="542" y="325" fill="#171B1E">12 800 €</text>
      </g>
    </svg>
  );
}

const TABS = [
  {
    label: "Trouver",
    title: "Des chantiers près de chez vous, déjà décrits",
    text: "Sur le Radar, chaque demande arrive avec des photos, un projet structuré et un prix recommandé que le client a déjà accepté. Vous voyez votre marge avant de vous positionner.",
    checks: ["Zone et métiers choisis par vous", "Prix recommandé affiché avant de vous positionner", "Jetons débités seulement si le client confirme le rendez-vous"],
    preview: null
  },
  {
    label: "Chiffrer",
    title: "Un devis guidé, prix tirés de vos factures",
    text: "Ajoutez ouvrages, sous-ouvrages et fournitures. Les prix viennent de votre historique, métier par métier.",
    checks: ["Sur place ou dans le camion, guidé par les questions de Koji", "TVA et mentions choisies et ajoutées par Koji"],
    preview: "Aperçu de l'éditeur de devis"
  },
  {
    label: "Conduire",
    title: "Vos chantiers et votre planning, au même endroit",
    text: "Suivez chaque chantier, son avancement et son calendrier.",
    checks: ["Chantiers et calendrier", "Relances préparées, vous validez"],
    preview: "Aperçu du calendrier"
  },
  {
    label: "Encaisser",
    title: "Facturer et encaisser sans relancer à la main",
    text: "Factures, situations, avoirs et acomptes, avec signature en ligne.",
    checks: ["Signature en ligne, acompte demandé dans la foulée", "Facture électronique prête"],
    preview: "Aperçu des factures"
  },
  {
    label: "Équipe",
    title: "Votre équipe, son planning et ses heures",
    text: "Répartissez les chantiers entre vos ouvriers et suivez les heures.",
    checks: ["Équipe, planning et heures", "5 comptes (offre Business)"],
    preview: "Aperçu de l'équipe"
  }
];

const FEATURE_MENU = [
  { label: "Devis avec IA", tab: 1 },
  { label: "Chantiers autour de vous", tab: 0 },
  { label: "Factures", tab: 3 },
  { label: "Équipe", tab: 4 },
  { label: "Fournitures", tab: 1 }
];

const COMPARISON = [
  ["Le devis", "Le soir, à partir d'un ancien fichier", "Sur place ou dans le camion, guidé par les questions de Koji"],
  ["Les prix", "Recopiés d'un devis précédent", "Tirés de vos factures, métier par métier"],
  ["TVA et mentions", "À vérifier à chaque fois", "Choisies et ajoutées par Koji, certifiées par le client en signant"],
  ["La signature", "Imprimer, faire signer, scanner", "Signature en ligne, acompte demandé dans la foulée"],
  ["Les impayés", "Un tableau à tenir à jour", "Relances préparées, vous validez"],
  ["Les nouveaux chantiers", "Le bouche-à-oreille", "Le Radar des chantiers et votre page Koji"]
];

const RULES = [
  ["La bonne TVA", "10 % en rénovation, 5,5 % pour les travaux d'énergie, 20 % pour une société, autoliquidation en sous-traitance. Le client certifie la mention en signant."],
  ["Les mentions obligatoires", "Assurance décennale, conditions de paiement, médiateur, numérotation sans trou : rien ne manque sur vos documents."],
  ["Signature chez le client", "Délai de rétractation, formulaire joint, acompte demandé au bon moment : Koji suit la règle selon le lieu de signature."],
  ["Corriger sans tricher", "Une facture se corrige par un avoir qui la référence, puis une nouvelle facture. Deux clics."]
];

const STEPS = [
  ["Votre entreprise", "Saisissez votre SIREN : nom, adresse et numéro de TVA se remplissent seuls."],
  ["Vos prix", "Envoyez trois à dix factures récentes. Koji en tire votre taux par métier."],
  ["Vos clients et anciens devis", "Importez votre fichier Excel ou votre ancien logiciel. Ou envoyez-le nous, on s'en charge."],
  ["Votre premier devis", "Décrivez le chantier, répondez aux questions, envoyez. Le client signe sur son téléphone."]
];

// Same figures as components/PricingPlans.jsx, which matches the live Stripe prices.
const PLANS = [
  {
    name: "Start",
    sub: "Pour l'artisan qui démarre ou veut essayer",
    features: ["5 devis avec l'IA par mois", "Chantiers et calendrier", "Votre page Koji", "Radar des chantiers avec jetons"],
    cta: "Créer mon compte gratuit",
    primary: true
  },
  {
    name: "Pro",
    badge: "Conseillé",
    sub: "Pour l'artisan qui devise et facture chaque semaine",
    price: { month: 29, year: 23 },
    features: ["Tout Start", "Factures, situations, avoirs", "Facture électronique", "Fournitures et bibliothèque", "Réseau pro entre entreprises"],
    cta: "Essayer Pro"
  },
  {
    name: "Business",
    sub: "Pour l'entreprise avec une équipe",
    price: { month: 69, year: 55 },
    features: ["Tout Pro", "Dépenses par chantier", "Équipe, planning et heures", "5 comptes"],
    cta: "Essayer Business"
  }
];

const TRUST = [
  { title: "Données hébergées en France", text: "Sauvegardes chaque jour, accès chiffré.", icon: <><rect x="5" y="11" width="14" height="10" rx="1" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></> },
  { title: "Vos données vous appartiennent", text: "Devis, factures, photos et contacts téléchargeables à tout moment.", icon: <path d="M12 4v12M6 11l6 6 6-6M4 20h16" /> },
  { title: "Signature avec preuve", text: "Date, heure et identité du signataire conservées avec le document.", icon: <path d="M3 15c2-6 4-6 6 0s4 6 6 0 3-4 6-2" /> },
  { title: "Un humain répond", text: "Par message ou par téléphone, du lundi au samedi.", icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></> }
];

const FAQ = [
  ["Combien coûte un chantier trouvé sur le Radar ?", "Le nombre de jetons est affiché avant de vous positionner. Ils ne sont débités que si le client confirme le rendez-vous ; sinon ils reviennent sur votre solde."],
  ["Je n'ai pas le temps de remplir mes prix.", "Envoyez simplement trois à dix factures récentes. Koji en tire votre taux par métier."],
  ["Mes clients doivent-ils installer quelque chose ?", "Non. Le client reçoit un lien par SMS ou email et signe directement sur son téléphone. Aucune installation, aucune application à télécharger."],
  ["Je travaille surtout sur mon téléphone.", "Koji fonctionne parfaitement sur mobile : chiffrer un devis, ajouter une photo, valider une facture. L'interface s'adapte à l'écran."],
  ["Et la facture électronique ?", "Koji génère les factures au format Factur-X, l'e-facture certifiée par l'État. Elles sont prêtes à envoyer à vos clients et à votre comptabilité."],
  ["Mon comptable peut-il s'en servir ?", "Oui. Vous pouvez lui donner accès en lecture seule à vos factures. Il y récupère aussi tous les fichiers au format Excel ou PDF pour sa déclaration."],
  ["J'ai déjà un logiciel de devis.", "On migre vos données. Envoyez-nous votre fichier ou votre accès : on importe vos clients, vos prix et vos anciens devis. Gratuit pour les 50 premiers devis."],
  ["Je peux partir avec mes données ?", "Oui. Devis, factures, photos et contacts sont téléchargeables à tout moment."]
];

export function EntrepriseLanding() {
  const [tab, setTab] = useState(0);
  const [yearly, setYearly] = useState(false);
  const active = TABS[tab];

  return (
    <div className={`kl ${dmSans.variable}`}>
      <header className="nav">
        <div className="wrap">
          <Link className="brand" href="/entreprise">KOJI</Link>
          <ul>
            <li><a href="#decouvrir">Découvrir</a></li>
            <li className="dd">
              <button type="button" className="dd-b">Fonctionnalités <span aria-hidden="true">▾</span></button>
              <div className="dd-m">
                {FEATURE_MENU.map((item) => (
                  <a key={item.label} href="#fonctions" onClick={(e) => { setTab(item.tab); e.currentTarget.blur(); }}>{item.label}</a>
                ))}
              </div>
            </li>
            <li><a href="/profile/entreprise">Métiers</a></li>
            <li><a href="#comparer">Comparer</a></li>
            <li><a href="#tarifs">Tarifs</a></li>
          </ul>
          <span className="lang">FR</span>
          <Link className="login" href={SIGNUP}>Se connecter</Link>
          <Link className="btn btn-y" href={SIGNUP}>Créer mon compte</Link>
        </div>
      </header>

      <section id="decouvrir" className="assist">
        <div className="wrap">
          <div>
            <div className="spark" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" /></svg>
            </div>
            <h1>Une question sur votre entreprise ? Demandez à Koji.</h1>
            <p className="lead">Koji connaît vos chantiers, vos devis, vos factures et votre équipe. Il répond avec les chiffres, montre d'où ils viennent et prépare la suite : une relance, un avenant, un message. Rien ne part sans vous.</p>
            <div className="qchips">
              <span>Qui me doit de l'argent ?</span>
              <span>Mon planning de la semaine</span>
              <span>Combien j'ai dépensé en fournitures ce mois-ci ?</span>
              <span>Relance le devis de M. Caron</span>
            </div>
          </div>
          <div className="chat" aria-label="Exemple de conversation avec Koji">
            <div className="bub-u">Quels chantiers perdent de l'argent ce mois-ci ?</div>
            <div className="ans">
              <small>Réponse de Koji, assistant IA · sources : devis 2026-033, 4 factures fournisseurs</small>
              <p>Appartement Caulaincourt passe de 28 % à 21 % de marge : fournitures du carrelage à 5 400 € pour 3 100 € prévus, sans avenant.</p>
              <span className="ob">Préparer l'avenant de 2 300 € HT</span>
            </div>
            <div className="ask">
              <span>Posez votre question, à l'écrit ou à la voix…</span>
              <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
            </div>
          </div>
        </div>
      </section>

      <section id="fonctions" className="sec-white">
        <div className="wrap">
          <div className="sec-head">
            <h2>Tout le métier, dans une seule application</h2>
            <p>Du premier contact à la dernière facture, sans changer d'outil.</p>
          </div>

          <div className="tabs" role="tablist">
            {TABS.map((t, i) => (
              <button
                key={t.label}
                type="button"
                role="tab"
                aria-selected={i === tab}
                className={i === tab ? "on" : undefined}
                onClick={() => setTab(i)}
              >
                <small>{String(i + 1).padStart(2, "0")}</small> {t.label}
              </button>
            ))}
          </div>

          <div className="tabpanel" role="tabpanel">
            <div>
              <h3>{active.title}</h3>
              <p>{active.text}</p>
              <ul className="checks">
                {active.checks.map((c) => <li key={c}><Check />{c}</li>)}
              </ul>
            </div>
            {active.preview
              ? <div className="mapbox ph">{active.preview}</div>
              : <div className="mapbox" aria-hidden="true"><RadarMap /></div>}
          </div>

          <div className="andaussi">
            <div><h4>Et aussi</h4></div>
            <div><h4>Votre page Koji</h4><p>Une vitrine avec vos réalisations et vos avis vérifiés, prête en dix minutes.</p></div>
            <div><h4>Le Réseau pro</h4><p>Trouvez un sous-traitant ou un lot à prendre entre entreprises, sans commission.</p></div>
            <div><h4>Bibliothèque d'ouvrages</h4><p>Vos ouvrages types, réutilisés d'un devis à l'autre.</p></div>
            <div><h4>Dépenses par chantier</h4><p>Tickets et factures fournisseurs rangés, marge réelle à jour.</p></div>
          </div>
        </div>
      </section>

      <section id="comparer" className="sec-white" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sec-head">
            <h2>Le soir, vous avez mieux à faire que des devis</h2>
            <p>Ce qui change quand on passe du tableur à Koji.</p>
          </div>
          <div className="cmp">
            <div className="cmp-row hd"><span></span><span>Avec un tableur et un traitement de texte</span><span>Avec Koji</span></div>
            {COMPARISON.map(([k, old, next]) => (
              <div className="cmp-row" key={k}>
                <span className="k">{k}</span>
                <span className="old">{old}</span>
                <span className="new"><Check />{next}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="regles">
        <div className="wrap">
          <div className="sec-head">
            <h2>Les règles du bâtiment, Koji s'en occupe</h2>
            <p>Ce qui fait perdre du temps, ou de l'argent quand c'est oublié, est appliqué tout seul sur vos devis et factures.</p>
          </div>
          <div className="rules">
            {RULES.map(([title, text]) => <div key={title}><h3>{title}</h3><p>{text}</p></div>)}
          </div>
          <div className="reform">
            <div>
              <span className="tagb">RÉFORME 2026-2027</span>
              <h3>Facture électronique : vous êtes prêt</h3>
              <p>Depuis le 1er septembre 2026, toute entreprise doit pouvoir recevoir des factures électroniques. À partir du 1er septembre 2027, les TPE et PME devront aussi les émettre. Koji reçoit et transmet vos factures par une plateforme agréée, sans changer votre façon de travailler.</p>
            </div>
            <div className="dates">
              <div><b>1er sept. 2026</b><span>Réception pour toutes les entreprises</span></div>
              <div><b>1er sept. 2027</b><span>Émission pour les TPE et PME</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="sec-white">
        <div className="wrap">
          <div className="sec-head" style={{ marginBottom: 24 }}>
            <h2>Démarrer prend une soirée</h2>
            <p>Pas de formation, pas de rendez-vous commercial obligatoire.</p>
          </div>
          <div className="steps">
            {STEPS.map(([title, text], i) => (
              <div className="step" key={title}><div className="n">{i + 1}</div><h3>{title}</h3><p>{text}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap temo">
          <div>
            <p className="quote">« Koji est né dans notre entreprise de rénovation, à Paris. Chaque écran a d'abord servi sur nos propres chantiers, de la visite au procès-verbal. Ce qui n'aidait pas a été retiré. »</p>
            <div className="quote-by">
              <div className="av">K</div>
              <div><b>Le fondateur de Koji</b><small>Dirigeant d'une entreprise de rénovation</small></div>
            </div>
          </div>
          <aside className="pion">
            <span className="tagw">PROGRAMME PIONNIERS</span>
            <h3>Construisez Koji avec nous</h3>
            <ul>
              <li><Check />L'offre Pro au prix de lancement, gardé tant que vous restez</li>
              <li><Check />Une ligne directe avec l'équipe qui construit Koji</li>
              <li><Check />Vos demandes passent en priorité dans les nouveautés</li>
            </ul>
            <Link className="btn btn-o" href={SIGNUP}>Rejoindre les pionniers</Link>
          </aside>
        </div>
      </section>

      <section id="tarifs" className="sec-white">
        <div className="wrap">
          <div className="sec-head">
            <h2>Des offres simples, sans engagement</h2>
            <p>Commencez gratuitement. Passez à Pro le jour où vous facturez avec Koji.</p>
          </div>
          <div className="toggle">
            <button type="button" aria-pressed={!yearly} className={yearly ? undefined : "on"} onClick={() => setYearly(false)}>Mensuel</button>
            <button type="button" aria-pressed={yearly} className={yearly ? "on" : undefined} onClick={() => setYearly(true)}>Annuel · 2 mois offerts</button>
          </div>
          <div className="plans">
            {PLANS.map((plan, i) => (
              <div className={i === 0 ? "plan first" : "plan"} key={plan.name}>
                <div className="plan-h"><h3>{plan.name}</h3>{plan.badge && <span className="badge">{plan.badge}</span>}</div>
                <p className="sub">{plan.sub}</p>
                <div className="price">{plan.price ? `${yearly ? plan.price.year : plan.price.month} € HT` : "0 €"}</div>
                <div className="per">{plan.price ? (yearly ? "par mois, facturé à l'année" : "par mois") : "pour commencer"}</div>
                <ul>{plan.features.map((f) => <li key={f}><Check />{f}</li>)}</ul>
                <Link className={plan.primary ? "btn btn-y" : "btn btn-o"} href={SIGNUP}>{plan.cta}</Link>
              </div>
            ))}
          </div>
          <p className="note">Radar des chantiers : des jetons, débités seulement quand un client confirme un rendez-vous avec vous. Prix hors taxes. Changez d'offre ou arrêtez à tout moment.</p>
        </div>
      </section>

      <section style={{ paddingTop: 56, paddingBottom: 56 }}>
        <div className="wrap trust">
          {TRUST.map((t) => (
            <div key={t.title}>
              <svg className="i" viewBox="0 0 24 24" aria-hidden="true">{t.icon}</svg>
              <h3>{t.title}</h3><p>{t.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="faq" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sec-head">
            <h2>Questions fréquentes</h2>
            <p>Une autre question ? <a href={CONTACT}>Écrivez-nous</a>, un humain répond.</p>
          </div>
          <div className="faq">
            {FAQ.map(([q, a], i) => (
              <details key={q} open={i === 0}><summary>{q}</summary><p>{a}</p></details>
            ))}
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="wrap">
          <div>
            <h2>Votre prochain devis peut partir ce soir.</h2>
            <p>Gratuit pour commencer · iPhone, Android et ordinateur</p>
          </div>
          <Link className="btn btn-y" href={SIGNUP}>Créer mon compte gratuit</Link>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <div className="fgrid">
            <div>
              <span className="brand">KOJI</span>
              <p>Devis, chantiers et factures pour les artisans et entreprises du bâtiment.</p>
              <Link className="part" href="/">Particulier avec un projet de travaux ? Koji Client</Link>
            </div>
            <div><h4>Produit</h4><ul><li>Devis guidé</li><li>Radar des chantiers</li><li>Factures</li><li>Équipe</li><li>Koji, l'assistant</li><li><a href="#tarifs">Tarifs</a></li></ul></div>
            <div><h4>Métiers</h4><ul><li>Plombier</li><li>Électricien</li><li>Carreleur</li><li>Peintre</li><li>Maçon</li><li>Tous les métiers</li></ul></div>
            <div><h4>Ressources</h4><ul><li><Link href="/aide">Aide</Link></li><li>Facture électronique 2026</li><li>TVA dans le bâtiment</li><li>Modèles de devis</li></ul></div>
            <div><h4>Koji</h4><ul><li>À propos</li><li><a href={CONTACT}>Contact</a></li><li><Link href="/legal">Mentions légales</Link></li><li><Link href="/legal">Conditions d'utilisation</Link></li><li><Link href="/legal">Confidentialité</Link></li><li>Cookies</li></ul></div>
          </div>
          <div className="fbot"><span>© 2026 Koji</span><span>Fait à Paris</span></div>
        </div>
      </footer>
    </div>
  );
}
