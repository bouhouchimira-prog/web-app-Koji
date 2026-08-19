"use client";

import { useEffect, useState } from "react";
import { ClientTopbar } from "../../../components/ClientTopbar";
import { euro, shortDate } from "../../../lib/pricing";
import { useLocale } from "../../../lib/i18n";

function getStoredUser() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("koji-user") || "null"); } catch { return null; }
}

export default function ClientDevisPage() {
  const { L } = useLocale();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = getStoredUser();
    if (!user?.email) { setLoading(false); return; }
    fetch("/api/client/quotes")
      .then((r) => r.json())
      .then((data) => setQuotes(data.quotes || []))
      .finally(() => setLoading(false));
  }, []);

  const signedQuotes = quotes.filter((q) => q.status === "Signe" || q.signatureStatus === "Signe");

  return (
    <main className="client-space">
      <ClientTopbar showBack backHref="/client" />

      <div className="ct-welcome">
        <strong>{L.nav.quotes}</strong>
        <small>{L.clientSpace.signedQuotesOnly}</small>
      </div>

      <section className="ct-section">
        {loading ? <div className="client-empty">{L.clientSpace.loading}</div> : null}
        {!loading && signedQuotes.length === 0 ? <div className="client-empty">{L.clientSpace.noSignedQuotes}</div> : null}
        <div className="client-list">
          {signedQuotes.map((quote) => (
            <a key={quote.id} className="client-row ct-devis-row" href={`/api/client/quotes/${quote.id}/pdf`}>
              <div>
                <strong>{quote.quoteNumber}</strong>
                <span>{quote.project?.title || quote.project || "Chantier"} · {shortDate(quote.signedAt || quote.createdAt)}</span>
              </div>
              <div className="ct-devis-row-right">
                <span className="client-amount">{euro(quote.totalTtc || 0)}</span>
                <span className="ct-devis-pdf-btn">{L.clientSpace.downloadPdf}</span>
              </div>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
