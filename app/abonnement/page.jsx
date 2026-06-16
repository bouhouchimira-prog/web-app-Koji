"use client";

import { Shell } from "../../components/Shell";
import { useRouter } from "next/navigation";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 29,
    period: "mois",
    color: "#2563eb",
    features: [
      "Devis illimités",
      "Jusqu'à 5 chantiers actifs",
      "Génération PDF & Word",
      "Signature électronique",
      "Espace client particulier"
    ]
  },
  {
    id: "pro",
    name: "Pro",
    price: 59,
    period: "mois",
    color: "#f5c842",
    badge: "Populaire",
    features: [
      "Tout le plan Starter",
      "Chantiers illimités",
      "Accès Marketplace",
      "Bibliothèque d'ouvrages avancée",
      "Gestion d'équipe",
      "Notifications SMS"
    ]
  },
  {
    id: "enterprise",
    name: "Entreprise",
    price: 99,
    period: "mois",
    color: "#1f8a4c",
    features: [
      "Tout le plan Pro",
      "Multi-utilisateurs",
      "Compte admin dédié",
      "Support prioritaire",
      "Intégration comptable",
      "Rapports personnalisés"
    ]
  }
];

export default function AbonnementPage() {
  const router = useRouter();

  function handleSubscribe(plan) {
    alert(`L'abonnement ${plan.name} sera bientôt disponible. Nous vous contacterons dès l'ouverture du paiement en ligne.`);
  }

  return (
    <Shell>
      <header className="page-header" style={{ textAlign: "center" }}>
        <div>
          <p className="eyebrow">ABONNEMENT</p>
          <h1>Choisissez votre plan</h1>
          <p className="page-subtitle">Continuez à utiliser Koji après votre période d'essai gratuite.</p>
        </div>
      </header>

      <section className="plans-grid">
        {PLANS.map((plan) => (
          <article className={`plan-card${plan.badge ? " plan-card-featured" : ""}`} key={plan.id}>
            {plan.badge && <div className="plan-badge">{plan.badge}</div>}
            <div className="plan-header">
              <h2 style={{ color: plan.color }}>{plan.name}</h2>
              <div className="plan-price">
                <span className="plan-amount">{plan.price} €</span>
                <span className="plan-period">/ {plan.period}</span>
              </div>
            </div>
            <ul className="plan-features">
              {plan.features.map((f) => (
                <li key={f}>
                  <span className="plan-check" style={{ color: plan.color }}>✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="button"
              style={{ background: plan.color, color: "#fff", border: "none", width: "100%" }}
              onClick={() => handleSubscribe(plan)}
            >
              Souscrire — {plan.price} €/mois
            </button>
          </article>
        ))}
      </section>

      <div style={{ textAlign: "center", marginTop: 24 }}>
        <button type="button" className="button secondary" onClick={() => router.back()}>
          Retour
        </button>
      </div>
    </Shell>
  );
}
