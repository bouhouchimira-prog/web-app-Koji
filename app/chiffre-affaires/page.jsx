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
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow">Finances</span>
          <h1>{L.home.revenue}</h1>
        </div>
      </div>

      <div className="kpis">
        <div>
          <div className="l">{L.home.billed}</div>
          <div className="v">{euro(billedRevenue)}</div>
        </div>
        <div>
          <div className="l">{L.home.waitingSig}</div>
          <div className="v">{euro(waitingRevenue)}</div>
        </div>
        <div>
          <div className="l">{L.home.revenueNet}</div>
          <div className={`v${netEarned >= 0 ? "" : " negative"}`}>{euro(netEarned)}</div>
        </div>
        <div>
          <div className="l">{L.home.revenueRefused}</div>
          <div className="v">{euro(refusedRevenue)}</div>
        </div>
      </div>

      <div className="pf-g2">
        <section className="card">
          <div className="card-h"><h2>{L.home.revenueExpenses}</h2></div>
          {Object.keys(expensesByCategory).length === 0 ? (
            <p className="muted">{L.common.noData}</p>
          ) : (
            Object.entries(expensesByCategory).map(([category, amount]) => (
              <div className="kv" key={category}>
                <span>{category}</span>
                <b>{euro(amount)}</b>
              </div>
            ))
          )}
          <div className="kv">
            <span>{L.home.revenueTotalExpenses}</span>
            <b>{euro(totalExpenses)}</b>
          </div>
        </section>

        <section className="card">
          <div className="card-h"><h2>{L.home.billed}</h2></div>
          <div className="kv">
            <span>{L.home.billed}</span>
            <b>{euro(billedRevenue)}</b>
          </div>
          <div className="kv">
            <span>{L.home.revenueNet}</span>
            <b className={netEarned >= 0 ? "positive" : "negative"}>{euro(netEarned)}</b>
          </div>
          <div className="ed-act" style={{ marginTop: 12 }}>
            <Link href="/facturation" className="btn btn-sec">{L.home.viewBilling}</Link>
          </div>
        </section>
      </div>
    </Shell>
  );
}
