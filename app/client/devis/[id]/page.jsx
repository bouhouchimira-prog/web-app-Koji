"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LangSwitcher } from "../../../../components/LangSwitcher";
import { euro, shortDate } from "../../../../lib/pricing";
import { useLocale } from "../../../../lib/i18n";

function getStoredUser() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("koji-user") || "null"); } catch { return null; }
}

export default function ClientQuotePage({ params }) {
  const { L } = useLocale();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = getStoredUser();
    const query = new URLSearchParams({ id: params.id });
    fetch(`/api/client/quotes?${query.toString()}`, { headers: { Authorization: `Bearer ${user?.portalToken || ""}` } })
      .then((response) => response.json())
      .then((data) => setQuote(data.quote || null))
      .finally(() => setLoading(false));
  }, [params.id]);

  const items = useMemo(() => quote?.items || quote?.selectedWorks || [], [quote]);

  return (
    <main className="client-space">
      <header className="client-topbar compact-topbar">
        <Link className="icon-button" href="/client"><span aria-hidden="true">&lt;</span></Link>
        <div>
          <p className="eyebrow">{L.clientSpace.clientQuote}</p>
          <h1>{quote?.reference || L.nav.devis}</h1>
        </div>
        <LangSwitcher />
      </header>

      {loading ? <section className="client-card">{L.clientSpace.loading}</section> : null}
      {!loading && !quote ? <section className="client-card">{L.clientSpace.quoteNotFound}</section> : null}
      {quote ? (
        <>
          <section className="client-card quote-summary-card">
            <div>
              <p className="eyebrow">{L.nav.chantiers}</p>
              <h2>{quote.project?.name || quote.projectName || "Chantier"}</h2>
              <p>{quote.clientName || quote.project?.client || "Client"} · {shortDate(quote.createdAt)}</p>
            </div>
            <strong>{euro(quote.totalTtc || quote.total || 0)}</strong>
          </section>

          <section className="client-card">
            <div className="client-section-title">
              <h2>{L.clientSpace.worksSection}</h2>
              <span>{items.length}</span>
            </div>
            <div className="client-list">
              {items.map((item, index) => (
                <article className="client-row" key={item.id || `${item.name}-${index}`}>
                  <div>
                    <strong>{item.name || item.title}</strong>
                    <span>{item.room || item.category || "—"}</span>
                  </div>
                  <span className="client-amount">{euro(item.total || item.totalHt || 0)}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="client-card muted-card">
            <span className="client-mini-icon" aria-hidden="true">D</span>
            <div>
              <h2>{L.clientSpace.signatureSection}</h2>
              <p>{L.clientSpace.signatureDesc}</p>
            </div>
            {quote.signatureUrl ? <a className="primary-button" href={quote.signatureUrl}>{L.clientSpace.signQuote}</a> : null}
          </section>
        </>
      ) : null}
    </main>
  );
}
