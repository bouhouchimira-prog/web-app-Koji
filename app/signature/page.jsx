"use client";

import { Shell } from "../../components/Shell";
import { euro } from "../../lib/pricing";
import { useApi } from "../../lib/use-api";

export default function SignaturePage() {
  const { data: quotes } = useApi("/api/quotes", "quotes");
  const signable = quotes.filter((quote) => quote.status !== "Archive");

  return (
    <Shell>
      <header className="page-header">
        <div>
          <p className="eyebrow">SIGNATURE</p>
          <h1>Validation client</h1>
          <p className="muted">Préparez les devis à faire signer et suivez leur état.</p>
        </div>
        <button className="button secondary">Ma signature</button>
      </header>

      <section className="table-card">
        <table className="data-table">
          <thead><tr><th>Client</th><th>Devis</th><th>Chantier</th><th>Total TTC</th><th>Action</th></tr></thead>
          <tbody>
            {signable.map((quote) => (
              <tr key={quote.id}>
                <td><strong>{quote.client}</strong></td>
                <td>{quote.quoteNumber}</td>
                <td>{quote.project}</td>
                <td>{euro(quote.totalTtc)}</td>
                <td><button className="button secondary">Envoyer</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </Shell>
  );
}
