"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiSend } from "../../lib/client-api";
import { useLocale } from "../../lib/i18n";
import { useApi } from "../../lib/use-api";

function money(value) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(Number(value || 0));
}

const STATUS_COLORS = {
  "Brouillon": { bg: "#f1f5f9", color: "#475569" },
  "Pret a envoyer": { bg: "#fef3c7", color: "#92400e" },
  "Envoye": { bg: "#dbeafe", color: "#1d4ed8" },
  "Signe": { bg: "#dcfce7", color: "#166534" },
  "Archive": { bg: "#f1f5f9", color: "#64748b" },
};

const ACCEPTANCE_REASON_LABEL = { verbal: "verbal", acompte: "acompte" };

function StatusBadge({ status, manualReason }) {
  const style = STATUS_COLORS[status] || { bg: "#f1f5f9", color: "#64748b" };
  const suffix = manualReason ? ` (${ACCEPTANCE_REASON_LABEL[manualReason] || "manuel"})` : "";
  return <span className="home-status-badge" style={{ background: style.bg, color: style.color }}>{status}{suffix}</span>;
}

function IconQuote() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

export default function DevisHistory() {
  const { L } = useLocale();
  const { data: quotes, setData: setQuotes } = useApi("/api/quotes", "quotes");
  const [search, setSearch] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return quotes
      .filter((quote) => {
        if (!needle) return true;
        return [quote.client, quote.quoteNumber, quote.project].filter(Boolean).join(" ").toLowerCase().includes(needle);
      })
      .sort((a, b) => String(b.createdAtIso || b.createdAt || "").localeCompare(String(a.createdAtIso || a.createdAt || "")));
  }, [quotes, search]);

  async function archiveQuote(id) {
    const { quote } = await apiSend("/api/quotes", { id, action: "archive" }, "PATCH");
    setQuotes(quotes.map((item) => (item.id === quote.id ? quote : item)));
  }

  async function deleteQuote(id) {
    await apiSend("/api/quotes", { id, action: "delete" }, "PATCH");
    setQuotes(quotes.filter((item) => item.id !== id));
    setConfirmDeleteId(null);
  }

  return (
    <Shell>
      <section className="mobile-tool">
        <header className="tool-topline">
          <button type="button" className="plain-back" onClick={() => (window.history.length > 1 ? window.history.back() : window.location.assign("/"))}>{"<"}</button>
          <h1>{L.devis.title}</h1>
          <Link href="/devis?new=1" className="round-dark" aria-label={L.devis.newQuote}>+</Link>
        </header>

        <div className="search-pill">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={L.common.search} />
        </div>

        <div className="home-list">
          {filtered.length === 0 ? (
            <div className="tool-empty">{L.devis.noQuotes}</div>
          ) : null}
          {filtered.map((quote) => (
            <article className="home-list-item home-quote-item" key={quote.id}>
              <Link href={`/devis?id=${quote.id}`} className="home-list-link home-quote-link">
                <div className="home-list-icon home-icon-quote"><IconQuote /></div>
                <div className="home-list-main">
                  <strong>{quote.client || "Client"}</strong>
                  <small>{[quote.quoteNumber, quote.project].filter(Boolean).join(" · ")}</small>
                </div>
                <div style={{ textAlign: "right" }}>
                  <StatusBadge status={quote.status || "Brouillon"} manualReason={quote.status === "Signe" && quote.signatureProvider === "manuel" ? quote.acceptanceReason : ""} />
                  <div style={{ fontSize: "0.78rem", color: "#7e715f", fontWeight: 700, marginTop: 3 }}>{money(quote.totalTtc)}</div>
                </div>
              </Link>
              <div className="home-task-actions">
                {confirmDeleteId === quote.id ? (
                  <span className="home-task-confirm">
                    <button className="home-task-btn home-task-btn-danger" onClick={() => deleteQuote(quote.id)}>{L.common.delete}</button>
                    <button className="home-task-btn" onClick={() => setConfirmDeleteId(null)}>{L.common.no}</button>
                  </span>
                ) : (
                  <>
                    <button type="button" className="home-task-btn" title={L.common.archive} onClick={() => archiveQuote(quote.id)}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" />
                      </svg>
                    </button>
                    <button type="button" className="home-task-btn home-task-btn-delete" title={L.common.delete} onClick={() => setConfirmDeleteId(quote.id)}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </Shell>
  );
}
