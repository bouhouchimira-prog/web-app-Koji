"use client";

import Link from "next/link";
import { useState } from "react";
import { apiSend, readStoredUser } from "../../lib/client-api";
import { PricingPlans } from "../../components/PricingPlans";
import "../home-pro.css";
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
    <div className="pro" style={{ backgroundColor: "var(--bg)", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{ borderBottom: "1px solid var(--line)", padding: "16px 0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24, padding: "0 48px" }}>
          <a href="#top" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "var(--ink)", fontWeight: 700, fontSize: 18, fontFamily: "var(--hd)" }}>
            <span style={{ fontSize: 22 }}>K</span>Koji
          </a>
          <nav style={{ display: "flex", gap: 24, fontSize: 14, fontWeight: 500 }} aria-label="Navigation">
            <a href="#plans" style={{ color: "var(--ink)", textDecoration: "none" }}>Offres</a>
            <a href="#jetons" style={{ color: "var(--ink)", textDecoration: "none" }}>Jetons</a>
            <a href="#comparatif" style={{ color: "var(--ink)", textDecoration: "none" }}>Comparatif</a>
            <a href="#equipe" style={{ color: "var(--ink)", textDecoration: "none" }}>Équipe</a>
            <a href="#faq" style={{ color: "var(--ink)", textDecoration: "none" }}>Questions</a>
          </nav>
          <Link href="/signup" className="btn btn-main">Essayer gratuitement</Link>
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: 1200, margin: "0 auto", width: "100%", padding: "48px" }}>
        {error ? (
          <p style={{ fontSize: 14, color: "#d32f2f", backgroundColor: "rgba(211, 47, 47, 0.08)", padding: "12px 16px", borderRadius: 2, marginBottom: 24 }}>{error}</p>
        ) : null}

        <PricingPlans onChoosePlan={handleChoosePlan} pendingPlan={pendingPlan} showHero />
      </main>

      <footer style={{ borderTop: "1px solid var(--line)", padding: "32px 48px", backgroundColor: "var(--card)", textAlign: "center", fontSize: 13, color: "var(--grey)" }}>
        <p>Koji · Prix HT · Offres réservées aux professionnels · Conditions générales de vente applicables</p>
        <p>kojibuild.com</p>
      </footer>
    </div>
  );
}
