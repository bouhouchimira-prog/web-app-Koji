"use client";

import { Shell } from "../../components/Shell";
import { useRouter } from "next/navigation";

const PLANS = [
  {
    id: "go",
    name: "Koji GO",
    price: 19.99,
    period: "mois",
    color: "#2563eb",
    features: [
      "4 devis",
      "Nombre illimité de versions par devis",
      "Génération PDF & Word",
      "Signature électronique",
      "Espace client particulier"
    ]
  },
  {
    id: "premium",
    name: "Koji Premium",
    price: 49.99,
    period: "mois",
    color: "#f5c842",
    badge: "Populaire",
    features: [
      "Devis illimités",
      "Nombre illimité de versions par devis",
      "Accès Marketplace",
      "Bibliothèque d'ouvrages avancée",
      "Gestion d'équipe",
      "Notifications SMS"
    ]
  },
  {
    id: "business",
    name: "Koji Business",
    price: 99.99,
    period: "mois",
    color: "#1f8a4c",
    features: [
      "Accès illimité à Koji et à tous ses outils",
      "Devis et chantiers illimités",
      "Multi-utilisateurs",
      "Support prioritaire",
      "Intégration comptable",
      "Rapports personnalisés"
    ]
  }
];

function formatPrice(value) {
  return value.toFixed(2).replace(".", ",");
}

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
                <span className="plan-amount">{formatPrice(plan.price)} €</span>
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
              Souscrire — {formatPrice(plan.price)} €/mois
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
