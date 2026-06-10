"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { euro, shortDate } from "../../../../lib/pricing";

function getStoredUser() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem("koji-user") || "null");
  } catch {
    return null;
  }
}

export default function ClientQuotePage({ params }) {
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = getStoredUser();
    const query = new URLSearchParams({ id: params.id, email: user?.email || "", userId: user?.id || "" });
    fetch(`/api/client/quotes?${query.toString()}`)
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
          <p className="eyebrow">Devis client</p>
          <h1>{quote?.reference || "Devis"}</h1>
        </div>
      </header>

      {loading ? <section className="client-card">Chargement...</section> : null}
      {!loading && !quote ? <section className="client-card">Devis introuvable pour ce profil.</section> : null}
      {quote ? (
        <>
          <section className="client-card quote-summary-card">
            <div>
              <p className="eyebrow">Chantier</p>
              <h2>{quote.project?.name || quote.projectName || "Chantier"}</h2>
              <p>{quote.clientName || quote.project?.client || "Client"} · {shortDate(quote.createdAt)}</p>
            </div>
            <strong>{euro(quote.totalTtc || quote.total || 0)}</strong>
          </section>

          <section className="client-card">
            <div className="client-section-title">
              <h2>Travaux</h2>
              <span>{items.length} ligne(s)</span>
            </div>
            <div className="client-list">
              {items.map((item, index) => (
                <article className="client-row" key={item.id || `${item.name}-${index}`}>
                  <div>
                    <strong>{item.name || item.title}</strong>
                    <span>{item.room || item.category || "General"}</span>
                  </div>
                  <span className="client-amount">{euro(item.total || item.totalHt || 0)}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="client-card muted-card">
            <span className="client-mini-icon" aria-hidden="true">D</span>
            <div>
              <h2>Signature</h2>
              <p>Le lien de signature est rattache a ce devis et active le suivi chantier apres validation.</p>
            </div>
            {quote.signatureUrl ? <a className="primary-button" href={quote.signatureUrl}>Signer le devis</a> : null}
          </section>
        </>
      ) : null}
    </main>
  );
}
