"use client";

import { useState } from "react";
import "./PricingPlans.css";

// Contenu partage des offres (24 oct, maquette Amira) — toggle Mensuel/
// Annuel + cartes Start/Pro/Business + jetons + comparatif + equipe + FAQ.
// Utilise a l'identique par la page publique (app/abonnement/page.jsx, pour
// les visiteurs non connectes) et par la page de gestion (app/parametres/
// abonnement/page.jsx, dans le Shell, pour une entreprise deja connectee —
// demande d'Amira le 24 oct : ne plus avoir a changer de page pour changer
// de formule). `currentPlan` (optionnel) remplace le bouton de la carte
// correspondante par un badge "Formule actuelle" plutot qu'un CTA.
function Check() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12l5 5L19 7" />
    </svg>
  );
}

const START_FEATURES = [
  "Chantiers et suivi d'avancement",
  "Devis manuel illimité, à vos couleurs",
  <>  <strong>5 devis avec l'IA</strong> par mois</>,
  "Bibliothèque Koji : 380 ouvrages chiffrés à votre taux horaire",
  "Contacts clients",
  "KojiPage essentielle : logo, métiers, zone, 5 photos",
  "1 compte gestion + comptes terrain illimités"
];

const PRO_FEATURES = [
  <><strong>Devis avec l'IA illimités</strong></>,
  "Factures, acomptes, situations et relances",
  "Avenants sur devis signé",
  "Signature électronique des devis",
  "Calendrier, planning et tâches",
  "Contacts complets : équipe, sous-traitants, fournisseurs, architectes",
  "Commandes et livraisons de fournitures",
  "Comptabilité : CA, charges, résultat, TVA à déclarer",
  "Vos propres ouvrages dans la bibliothèque",
  <><strong>KojiPage complète</strong> : photos illimitées, avant/après, avis clients, articles</>,
  <><strong>Demandes de devis reçues via votre KojiPage : sans jeton, exclusives</strong></>,
  "Carte de visite et archives"
];

const BUSINESS_FEATURES = [
  <><strong>5 comptes gestion</strong> inclus (devis, factures, marges)</>,
  "Export pour l'expert-comptable (FEC, factures, charges)",
  "Stock, alertes stock bas et dépenses par chantier",
  "Mode Urgences : dépannages près de chez vous",
  "Import en masse et bibliothèque partagée avec l'équipe",
  "Plusieurs zones d'intervention sur le Radar",
  "Tableau de bord multi-chantiers et rentabilité par lot",
  "Support prioritaire"
];

const STEPS = [
  { title: "Un particulier dépose un projet", text: "Photos, questions guidées, et Koji calcule une fourchette de budget. L'annonce arrive sur le Radar de votre zone." },
  { title: "Vous vous positionnez, gratuitement", text: "Ça n'utilise aucun jeton, seulement une « position ouverte » de votre plan. Trois pros maximum par annonce, premier arrivé, premier servi." },
  { title: "Le client confirme un RDV", text: "C'est à ce moment-là, et seulement là, que les jetons sont débités. Le contact se fait dans le chat Koji jusqu'au RDV." },
  { title: "Pas de suite ? Jeton rendu", text: "RDV annulé par le client, ou client injoignable 48 h après confirmation : le jeton revient automatiquement sur votre compte." }
];

const TIERS = [
  { label: "Petit chantier · budget estimé < 1 500 €", jetons: 1, text: "Chauffe-eau, robinetterie, une pièce à peindre, un placard à poser. Et toutes les urgences." },
  { label: "Chantier moyen · 1 500 à 8 000 €", jetons: 3, text: "Salle de bain, peinture d'un appartement, cuisine, tableau électrique." },
  { label: "Gros chantier · plus de 8 000 €", jetons: 6, text: "Rénovation complète, mise aux normes, extension, tout corps d'état." }
];

const COMPARISON = [
  { group: "Vendre" },
  { label: "Devis manuel", start: "lim:Illimité", pro: "lim:Illimité", biz: "lim:Illimité" },
  { label: "Devis avec l'IA (à partir de la bibliothèque Koji)", start: "lim:5 / mois", pro: "lim:Illimité", biz: "lim:Illimité" },
  { label: "Signature électronique", start: "no", pro: "yes", biz: "yes" },
  { label: "Avenants sur devis signé", start: "no", pro: "yes", biz: "yes" },
  { label: "Factures, acomptes, situations, relances", start: "no", pro: "yes", biz: "yes" },
  { group: "Chiffrer" },
  { label: "Bibliothèque Koji (380 ouvrages, temps × taux horaire)", start: "lim:Lecture", pro: "lim:+ vos ouvrages", biz: "lim:+ import, partagée" },
  { label: "Fournitures : commandes et livraisons", start: "no", pro: "yes", biz: "yes" },
  { label: "Stock, alertes stock bas, dépenses par chantier", start: "no", pro: "no", biz: "yes" },
  { group: "Piloter" },
  { label: "Chantiers et suivi d'avancement", start: "yes", pro: "yes", biz: "yes" },
  { label: "Calendrier, planning, tâches", start: "no", pro: "yes", biz: "yes" },
  { label: "Contacts", start: "lim:Clients", pro: "lim:Tous types", biz: "lim:Tous types" },
  { label: "Comptabilité : CA, charges, résultat, TVA", start: "no", pro: "yes", biz: "yes" },
  { label: "Export expert-comptable", start: "no", pro: "no", biz: "yes" },
  { label: "Tableau de bord multi-chantiers, rentabilité par lot", start: "no", pro: "no", biz: "yes" },
  { label: "Archives", start: "no", pro: "yes", biz: "yes" },
  { group: "Être trouvé" },
  { label: "KojiPage (page vitrine hébergée par Koji)", start: "lim:Essentielle", pro: "lim:Complète", biz: "lim:Complète" },
  { label: "Demandes de devis directes via la KojiPage, sans jeton", start: "no", pro: "yes", biz: "yes" },
  { label: "Carte de visite Koji", start: "no", pro: "yes", biz: "yes" },
  { label: "Radar des chantiers : jetons inclus par mois", start: "lim:0", pro: "lim:3", biz: "lim:10" },
  { label: "Prix du jeton supplémentaire", start: "lim:15 €", pro: "lim:10 €", biz: "lim:8 €" },
  { label: "Positions ouvertes en même temps", start: "lim:2", pro: "lim:5", biz: "lim:15" },
  { label: "Zones d'intervention", start: "lim:1", pro: "lim:1", biz: "lim:Plusieurs" },
  { label: "Mode Urgences (dépannages)", start: "no", pro: "no", biz: "yes" },
  { group: "Équipe" },
  { label: "Comptes terrain (planning, tâches, photos)", start: "lim:Illimités", pro: "lim:Illimités", biz: "lim:Illimités" },
  { label: "Comptes gestion (devis, factures, marges)", start: "lim:1", pro: "lim:1, puis 9 €/mois", biz: "lim:5, puis 7 €/mois" },
  { label: "Support", start: "lim:Aide en ligne", pro: "lim:Chat", biz: "lim:Prioritaire" }
];

const FAQ = [
  { q: "Je me positionne mais le client ne me répond jamais, je paie ?", a: "Non. Le jeton n'est débité qu'au RDV confirmé par le client. Et si le client annule ou disparaît 48 h après la confirmation, le jeton revient sur votre compte." },
  { q: "Pourquoi le jeton est plus cher en Start ?", a: "Start est fait pour découvrir Koji. Dès que vous prenez des chantiers régulièrement, Pro revient moins cher : 3 jetons inclus chaque mois et les suivants à 10 €." },
  { q: "Que se passe-t-il avec mes jetons non utilisés ?", a: "Les jetons inclus dans l'abonnement expirent en fin de mois. Les jetons achetés restent valables 12 mois." },
  { q: "Puis-je changer d'offre quand je veux ?", a: "Oui, à tout moment. Vos devis, factures, chantiers et votre KojiPage sont conservés. En repassant sur un plan inférieur, les modules en plus deviennent consultables mais non modifiables." },
  { q: "Mes ouvriers ont besoin d'un compte payant ?", a: "Non. Les comptes terrain sont gratuits et illimités sur tous les plans. Un compte supplémentaire n'est facturé que s'il peut créer des devis ou des factures." },
  { q: "Le palier d'un chantier peut-il changer après la visite ?", a: "Non. Le nombre de jetons est fixé sur le budget estimé à l'annonce. Si le devis final est plus haut ou plus bas, rien n'est recalculé." }
];

function cell(value) {
  if (value === "yes") return <span className="tarifs-yes"><Check /></span>;
  if (value === "no") return <span className="tarifs-no">—</span>;
  if (typeof value === "string" && value.startsWith("lim:")) return <span className="tarifs-lim">{value.slice(4)}</span>;
  return value;
}

export function PricingPlans({ currentPlan = "", onChoosePlan, pendingPlan = "", showHero = true }) {
  const [yearly, setYearly] = useState(false);

  const interval = yearly ? "year" : "month";
  const proPrice = yearly ? 23 : 29;
  const bizPrice = yearly ? 47 : 59;
  const proNote = yearly ? "soit 276 € HT par an, facturé en une fois" : "ou 23 € HT par mois en annuel";
  const bizNote = yearly ? "soit 564 € HT par an, facturé en une fois" : "ou 47 € HT par mois en annuel";
  const periodNote = yearly ? "Tarif annuel affiché : deux mois offerts." : "Tarif mensuel affiché.";

  function cardCta(plan, label, className) {
    if (currentPlan === plan) {
      return <span className="tarifs-cta tarifs-cta-current">Formule actuelle</span>;
    }
    return (
      <button type="button" className={className} onClick={() => onChoosePlan?.(plan, interval)} disabled={pendingPlan === plan}>
        {pendingPlan === plan ? "Redirection…" : label}
      </button>
    );
  }

  return (
    <>
      <section id="top" style={{ padding: showHero ? "72px 0 40px" : "0 0 32px" }}>
        <div className="tarifs-wrap" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 8, padding: showHero ? undefined : 0 }}>
          {showHero ? (
            <>
              <span className="tarifs-eyebrow">Tarifs</span>
              <h1 className="tarifs-h1" style={{ maxWidth: 820 }}>Un prix clair. Des jetons seulement quand un client vous reçoit.</h1>
              <p className="tarifs-lead" style={{ margin: "0 0 28px" }}>Devis, factures, chantiers et clients au même endroit. Le Radar des chantiers vous apporte des projets près de chez vous : vous ne payez un jeton que lorsqu'un rendez-vous est confirmé. Pas de RDV, pas de jeton.</p>
            </>
          ) : null}
          <div className="tarifs-toggle" role="group" aria-label="Période de facturation">
            <button type="button" className={!yearly ? "on" : ""} onClick={() => setYearly(false)}>Mensuel</button>
            <button type="button" className={yearly ? "on" : ""} onClick={() => setYearly(true)}>Annuel <span className="tarifs-pill" style={{ marginLeft: 8 }}>−20 %</span></button>
          </div>
          <p className="tarifs-sub" style={{ margin: "10px 0 0" }}>Prix hors taxes. Sans engagement en mensuel. {periodNote}</p>
        </div>
      </section>

      <section id="plans" style={{ padding: "16px 0 72px" }}>
        <div className="tarifs-wrap tarifs-cards">

          <article className="tarifs-card" aria-label="Offre Start">
            <div>
              <div className="tarifs-plan" style={{ color: "#5B6472" }}>Start</div>
              <p className="tarifs-who">Pour démarrer, tester Koji et faire ses premiers devis sans rien payer.</p>
            </div>
            <div>
              <div className="tarifs-price"><span className="tarifs-n">0 €</span><span className="tarifs-u">/ mois</span></div>
              <div className="tarifs-sub">Gratuit, sans carte bancaire</div>
            </div>
            {cardCta("start", "Créer mon compte", "tarifs-cta")}
            <div className="tarifs-feat">
              <div className="tarifs-sect">Inclus</div>
              {START_FEATURES.map((f, i) => (
                <div className="tarifs-check" key={i}><Check /><span>{f}</span></div>
              ))}
            </div>
            <div className="tarifs-radar">
              <div><div className="tarifs-k">Jetons inclus</div><div className="tarifs-v">0</div></div>
              <div><div className="tarifs-k">Prix du jeton</div><div className="tarifs-v">15 €</div></div>
              <div><div className="tarifs-k">Positions</div><div className="tarifs-v">2</div></div>
            </div>
          </article>

          <article className="tarifs-card hi" aria-label="Offre Pro, la plus choisie">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div className="tarifs-plan" style={{ color: "#F3EDA8" }}>Pro</div>
                <p className="tarifs-who tarifs-muted">Pour l'artisan qui vend, facture et veut des chantiers toute l'année.</p>
              </div>
              <span className="tarifs-pill">Le plus choisi</span>
            </div>
            <div>
              <div className="tarifs-price"><span className="tarifs-n">{proPrice} €</span><span className="tarifs-u" style={{ color: "#B8C0D4" }}>/ mois HT</span></div>
              <div className="tarifs-sub">{proNote}</div>
            </div>
            {cardCta("pro", "Passer en Pro", "tarifs-cta fill")}
            <div className="tarifs-feat">
              <div className="tarifs-sect" style={{ color: "#B8C0D4" }}>Tout Start, plus</div>
              {PRO_FEATURES.map((f, i) => (
                <div className="tarifs-check" key={i}><Check /><span>{f}</span></div>
              ))}
            </div>
            <div className="tarifs-radar">
              <div><div className="tarifs-k">Jetons inclus</div><div className="tarifs-v">3 / mois</div></div>
              <div><div className="tarifs-k">Prix du jeton</div><div className="tarifs-v">10 €</div></div>
              <div><div className="tarifs-k">Positions</div><div className="tarifs-v">5</div></div>
            </div>
          </article>

          <article className="tarifs-card" aria-label="Offre Business">
            <div>
              <div className="tarifs-plan" style={{ color: "#5B6472" }}>Business</div>
              <p className="tarifs-who">Pour l'entreprise tous corps d'état avec une équipe, un comptable et du volume.</p>
            </div>
            <div>
              <div className="tarifs-price"><span className="tarifs-n">{bizPrice} €</span><span className="tarifs-u">/ mois HT</span></div>
              <div className="tarifs-sub">{bizNote}</div>
            </div>
            {cardCta("business", "Passer en Business", "tarifs-cta")}
            <div className="tarifs-feat">
              <div className="tarifs-sect">Tout Pro, plus</div>
              {BUSINESS_FEATURES.map((f, i) => (
                <div className="tarifs-check" key={i}><Check /><span>{f}</span></div>
              ))}
            </div>
            <div className="tarifs-radar">
              <div><div className="tarifs-k">Jetons inclus</div><div className="tarifs-v">10 / mois</div></div>
              <div><div className="tarifs-k">Prix du jeton</div><div className="tarifs-v">8 €</div></div>
              <div><div className="tarifs-k">Positions</div><div className="tarifs-v">15</div></div>
            </div>
          </article>

        </div>
      </section>

      <section id="jetons" style={{ padding: "72px 0", background: "#FFFFFF", borderTop: "1px solid #E3E0D8", borderBottom: "1px solid #E3E0D8" }}>
        <div className="tarifs-wrap" style={{ display: "flex", flexDirection: "column", gap: 36 }}>
          <div style={{ maxWidth: 760 }}>
            <span className="tarifs-eyebrow">Le Radar des chantiers</span>
            <h2 className="tarifs-h2" style={{ marginTop: 10 }}>Comment marchent les jetons</h2>
            <p className="tarifs-lead" style={{ fontSize: 17 }}>Une seule monnaie dans Koji. Un jeton vaut 10 € HT sur le plan Pro. Le prix d'un chantier dépend de son budget, estimé par Koji dès l'annonce : vous savez ce que ça coûte avant de vous positionner.</p>
          </div>

          <div className="tarifs-steps">
            {STEPS.map((step, i) => (
              <div className="tarifs-step" key={step.title}>
                <div className="tarifs-num">{i + 1}</div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            ))}
          </div>

          <div className="tarifs-tiers">
            {TIERS.map((tier) => (
              <div className="tarifs-tier" key={tier.label}>
                <div className="tarifs-t">{tier.label}</div>
                <div className="tarifs-j">{tier.jetons}<span>jeton{tier.jetons > 1 ? "s" : ""}</span></div>
                <div className="tarifs-d">{tier.text}</div>
              </div>
            ))}
          </div>

          <div className="tarifs-two">
            <div className="tarifs-box">
              <h3>Jetons inclus et jetons achetés</h3>
              <p>Les jetons inclus dans votre abonnement sont à utiliser dans le mois. Les jetons achetés sont valables 12 mois, par packs de 5, 10 ou 25 au tarif de votre plan. Le palier est figé à l'annonce : si le devis final change après visite, on ne recalcule rien.</p>
            </div>
            <div className="tarifs-box">
              <h3>Ce que ça coûte vraiment</h3>
              <p>Un chantier moyen à 4 000 € vous revient en moyenne à 60 € de jetons en Pro, soit 1,5 %. Un gros chantier à 15 000 € : 120 € au plus, soit moins de 1 %. Et les demandes qui arrivent par votre KojiPage ne coûtent jamais de jeton.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="comparatif" style={{ padding: "72px 0" }}>
        <div className="tarifs-wrap" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div>
            <span className="tarifs-eyebrow">Dans le détail</span>
            <h2 className="tarifs-h2" style={{ marginTop: 10 }}>Ce que contient chaque offre</h2>
          </div>
          <div className="tarifs-tablebox">
            <table>
              <thead>
                <tr><th>Module</th><th className="c">Start</th><th className="c">Pro</th><th className="c">Business</th></tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  row.group ? (
                    <tr key={`g-${i}`}><td className="g" colSpan={4}>{row.group}</td></tr>
                  ) : (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td className="c">{cell(row.start)}</td>
                      <td className="c">{cell(row.pro)}</td>
                      <td className="c">{cell(row.biz)}</td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="equipe" style={{ padding: "0 0 72px" }}>
        <div className="tarifs-wrap tarifs-two">
          <div className="tarifs-box" style={{ background: "#0E1B3D", color: "#fff", borderColor: "#0E1B3D" }}>
            <span className="tarifs-eyebrow" style={{ color: "#B8C0D4" }}>Votre équipe</span>
            <h3 style={{ fontSize: 24, marginTop: 8 }}>Vos ouvriers sont gratuits. Vous payez les gens qui chiffrent.</h3>
            <p style={{ color: "#D7DCE9" }}>Ajoutez autant de comptes terrain que vous voulez : ils voient leur planning, leurs tâches, pointent et envoient des photos du chantier. Seuls les comptes qui créent des devis et des factures sont facturés.</p>
          </div>
          <div className="tarifs-box">
            <span className="tarifs-eyebrow">Accès au Radar</span>
            <h3 style={{ fontSize: 24, marginTop: 8 }}>Un profil complet, quel que soit le plan</h3>
            <p>Pour se positionner sur le Radar, le profil doit être à 100 % : Kbis, attestation URSSAF et assurance décennale à jour. C'est ce qui garantit aux particuliers des pros vérifiés, et aux pros des concurrents sérieux.</p>
          </div>
        </div>
      </section>

      <section id="faq" style={{ padding: "0 0 80px" }}>
        <div className="tarifs-wrap" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <h2 className="tarifs-h2">Questions fréquentes</h2>
          <div className="tarifs-faq">
            {FAQ.map((item) => (
              <div className="tarifs-q" key={item.q}>
                <h4>{item.q}</h4>
                <p>{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
