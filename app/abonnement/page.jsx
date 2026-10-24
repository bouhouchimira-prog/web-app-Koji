"use client";

import Link from "next/link";
import { useState } from "react";
import { apiSend, readStoredUser } from "../../lib/client-api";
import { PricingPlans } from "../../components/PricingPlans";
import "./abonnement.css";

// Page Tarifs publique (24 oct, maquette Amira — zip "Page Tarifs
// (publique)-html.zip") — remplace l'ancienne page de vente a 1 plan,
// dans le Shell connecte. Celle-ci est publique (pas de Shell, accessible
// sans compte), 3 paliers (Start gratuit / Pro / Business), vrai Stripe
// Checkout pour Pro/Business (Produits/Prix crees le 24 oct, voir
// scripts/stripe-setup-3-tiers.js). Contenu des offres partage avec
// app/parametres/abonnement/page.jsx via components/PricingPlans.jsx
// (demande d'Amira : ne plus avoir 2 pages deconnectees l'une de l'autre).
// Le systeme de "jetons" du Radar des Chantiers est purement informatif
// pour l'instant : aucun solde/debit reel derriere (Phase 2, pas construit).
export default function AbonnementPage() {
  const [pendingPlan, setPendingPlan] = useState("");
  const [error, setError] = useState("");

  async function handleChoosePlan(plan, interval) {
    if (plan === "start") {
      window.location.href = "/signup";
      return;
    }
    const user = readStoredUser();
    if (!user) {
      window.location.href = `/signup?plan=${plan}`;
      return;
    }
    setError("");
    setPendingPlan(plan);
    try {
      const response = await apiSend("/api/billing/checkout", { interval, plan });
      window.location.href = response.url;
    } catch (err) {
      setError(err.message || "Impossible de démarrer le paiement.");
      setPendingPlan("");
    }
  }

  return (
    <div className="tarifs-page">
      <header className="tarifs-header">
        <div className="tarifs-wrap tarifs-nav">
          <a href="#top" className="tarifs-logo"><span className="tarifs-logomark">K</span>Koji</a>
          <nav className="tarifs-navlinks" aria-label="Navigation">
            <a href="#plans">Offres</a>
            <a href="#jetons">Jetons</a>
            <a href="#comparatif">Comparatif</a>
            <a href="#equipe">Équipe</a>
            <a href="#faq">Questions</a>
          </nav>
          <Link href="/signup" className="tarifs-cta fill" style={{ minHeight: 42, padding: "0 18px", fontSize: 14 }}>Essayer gratuitement</Link>
        </div>
      </header>

      {error ? (
        <div className="tarifs-wrap" style={{ paddingTop: 16 }}>
          <p className="tarifs-error">{error}</p>
        </div>
      ) : null}

      <PricingPlans onChoosePlan={handleChoosePlan} pendingPlan={pendingPlan} showHero />

      <footer>
        <div className="tarifs-wrap tarifs-foot">
          <span>Koji · Prix HT · Offres réservées aux professionnels · Conditions générales de vente applicables</span>
          <span>kojibuild.com</span>
        </div>
      </footer>
    </div>
  );
}
