"use client";

import { Shell } from "../../components/Shell";
import { useRouter } from "next/navigation";
import { useLocale } from "../../lib/i18n";

function getPlans(L) {
  return [
    {
      id: "go",
      name: "Koji GO",
      price: 19.99,
      color: "#2563eb",
      features: [
        "4 " + (L.devis?.title || "devis"),
        "Nombre illimité de versions par devis",
        "Génération PDF & Word",
        "Signature électronique",
        "Espace client particulier",
      ],
    },
    {
      id: "premium",
      name: "Koji Premium",
      price: 49.99,
      color: "#f5c842",
      badge: L.abonnement.popular,
      features: [
        "Devis illimités",
        "Nombre illimité de versions par devis",
        "Accès Marketplace",
        "Bibliothèque d'ouvrages avancée",
        "Gestion d'équipe",
        "Notifications SMS",
      ],
    },
    {
      id: "business",
      name: "Koji Business",
      price: 99.99,
      color: "#1f8a4c",
      features: [
        "Accès illimité à Koji et à tous ses outils",
        "Devis et chantiers illimités",
        "Multi-utilisateurs",
        "Support prioritaire",
        "Intégration comptable",
        "Rapports personnalisés",
      ],
    },
  ];
}

function formatPrice(value) {
  return value.toFixed(2).replace(".", ",");
}

export default function AbonnementPage() {
  const { L } = useLocale();
  const router = useRouter();
  const plans = getPlans(L);

  function handleSubscribe(plan) {
    alert(`${plan.name} — ${L.abonnement.contact}`);
  }

  return (
    <Shell>
      <header className="page-header" style={{ textAlign: "center" }}>
        <div>
          <p className="eyebrow">ABONNEMENT</p>
          <h1>{L.abonnement.title}</h1>
          <p className="page-subtitle">{L.abonnement.subtitle}</p>
        </div>
      </header>

      <section className="plans-grid">
        {plans.map((plan) => (
          <article className={`plan-card${plan.badge ? " plan-card-featured" : ""}`} key={plan.id}>
            {plan.badge && <div className="plan-badge">{plan.badge}</div>}
            <div className="plan-header">
              <h2 style={{ color: plan.color }}>{plan.name}</h2>
              <div className="plan-price">
                <span className="plan-amount">{formatPrice(plan.price)} €</span>
                <span className="plan-period">{L.abonnement.perMonth}</span>
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
              {L.abonnement.choose} — {formatPrice(plan.price)} €/{L.abonnement.perMonth.replace("/ ", "")}
            </button>
          </article>
        ))}
      </section>

      <div style={{ textAlign: "center", marginTop: 24 }}>
        <button type="button" className="button secondary" onClick={() => router.back()}>
          {L.common.back}
        </button>
      </div>
    </Shell>
  );
}
