"use client";

import Link from "next/link";
import { Shell } from "../../components/Shell";
import { useLocale } from "../../lib/i18n";
import { euro } from "../../lib/pricing";
import { useApi } from "../../lib/use-api";

export default function ChiffreAffairesPage() {
  const { L } = useLocale();
  const { data: quotes } = useApi("/api/quotes", "quotes");
  const { data: invoices } = useApi("/api/invoices", "invoices");
  const { data: expenses } = useApi("/api/expenses", "expenses");

  const billedRevenue = invoices.filter((i) => i.status !== "Annulee").reduce((s, i) => s + Number(i.amountTtc || 0), 0);
  // Devis envoyes au client, pas encore signes.
  const waitingRevenue = quotes.filter((q) => q.signatureStatus === "En attente").reduce((s, q) => s + Number(q.totalTtc || 0), 0);
  // Aucun mecanisme de refus cote client n'existe encore (le lien de
  // signature ne propose que "signer") — Annule est la seule approximation
  // disponible aujourd'hui (devis annules par l'entreprise elle-meme).
  const refusedRevenue = quotes.filter((q) => q.status === "Annule").reduce((s, q) => s + Number(q.totalTtc || 0), 0);
  const expensesByCategory = expenses.reduce((acc, expense) => {
    const category = expense.category || "Autres frais";
    acc[category] = (acc[category] || 0) + Number(expense.amount || 0);
    return acc;
  }, {});
  const totalExpenses = Object.values(expensesByCategory).reduce((s, v) => s + v, 0);
  const netEarned = billedRevenue - totalExpenses;

  return (
    <Shell>
      <header className="page-header">
        <div>
          <p className="eyebrow">FINANCES</p>
          <h1>{L.home.revenue}</h1>
        </div>
      </header>

      <section className="home-revenue-hero">
        <span>{L.home.billed}</span>
        <strong>{euro(billedRevenue)}</strong>
      </section>

      <section className="home-section-card home-revenue-detail">
        <p className="home-revenue-subhead">{L.home.revenueExpenses}</p>
        {Object.keys(expensesByCategory).length === 0 ? (
          <p className="home-revenue-empty">{L.common.noData}</p>
        ) : (
          Object.entries(expensesByCategory).map(([category, amount]) => (
            <div className="home-revenue-line" key={category}>
              <span>{category}</span>
              <strong>{euro(amount)}</strong>
            </div>
          ))
        )}
        <div className="home-revenue-line home-revenue-total-expenses">
          <span>{L.home.revenueTotalExpenses}</span>
          <strong>{euro(totalExpenses)}</strong>
        </div>

        <div className="home-revenue-line home-revenue-net">
          <span>{L.home.revenueNet}</span>
          <strong className={netEarned >= 0 ? "positive" : "negative"}>{euro(netEarned)}</strong>
        </div>
        <div className="home-revenue-line">
          <span>{L.home.waitingSig}</span>
          <strong>{euro(waitingRevenue)}</strong>
        </div>
        <div className="home-revenue-line">
          <span>{L.home.revenueRefused}</span>
          <strong>{euro(refusedRevenue)}</strong>
        </div>

        <Link href="/facturation" className="home-revenue-more-link">{L.home.viewBilling} →</Link>
      </section>
    </Shell>
  );
}
