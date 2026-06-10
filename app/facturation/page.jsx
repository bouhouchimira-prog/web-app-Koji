"use client";

import { useEffect, useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiSend } from "../../lib/client-api";
import { euro, shortDate } from "../../lib/pricing";
import { fixText } from "../../lib/text";
import { useApi } from "../../lib/use-api";

const invoiceTypes = ["Acompte initial", "Facture intermédiaire", "Facture finale"];
const modes = [
  { id: "fixed", label: "Montant fixe" },
  { id: "percent", label: "Pourcentage" },
  { id: "deposit", label: "Acompte" },
  { id: "remaining", label: "Solde restant" }
];

function signedQuote(quote) {
  return quote.status === "Signe" || quote.signatureStatus === "Signe";
}

function activeInvoice(invoice) {
  return invoice.status !== "Annulee" && !invoice.deleted;
}

function toAmount(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0;
}

function billingSummary(quote, invoices) {
  const total = toAmount(quote?.totalTtc || quote?.totalHt || 0);
  const already = toAmount(invoices.filter(activeInvoice).reduce((sum, invoice) => sum + Number(invoice.amountTtc || 0), 0));
  const remaining = toAmount(Math.max(0, total - already));
  return {
    total,
    already,
    remaining,
    state: remaining <= 0.01 ? "Soldée" : already > 0 ? "Partielle" : "À facturer"
  };
}

export default function FacturationPage() {
  const { data: projects } = useApi("/api/projects", "projects");
  const { data: quotes } = useApi("/api/quotes", "quotes");
  const { data: invoices, setData: setInvoices } = useApi("/api/invoices", "invoices");
  const [selectedQuoteId, setSelectedQuoteId] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    type: "Acompte initial",
    amountMode: "deposit",
    fixedAmount: "",
    percent: 30,
    depositPercent: 30,
    dueDate: new Date().toISOString().slice(0, 10),
    notes: ""
  });

  const eligibleQuotes = useMemo(() => {
    return quotes
      .filter(signedQuote)
      .map((quote) => ({
        quote,
        project: projects.find((project) => project.id === quote.projectId)
      }))
      .filter(({ project }) => project && project.status !== "Archive");
  }, [projects, quotes]);

  useEffect(() => {
    if (selectedQuoteId || eligibleQuotes.length === 0) return;
    setSelectedQuoteId(eligibleQuotes[0].quote.id);
  }, [eligibleQuotes, selectedQuoteId]);

  const selected = eligibleQuotes.find(({ quote }) => quote.id === selectedQuoteId) || eligibleQuotes[0] || null;
  const selectedInvoices = invoices.filter((invoice) => invoice.quoteId === selected?.quote.id || invoice.projectId === selected?.project.id);
  const summary = billingSummary(selected?.quote, selectedInvoices);

  const previewAmount = useMemo(() => {
    if (!selected) return 0;
    if (form.amountMode === "remaining") return summary.remaining;
    if (form.amountMode === "percent") return summary.total * (Number(form.percent || 0) / 100);
    if (form.amountMode === "deposit") return summary.total * (Number(form.depositPercent || 0) / 100);
    return Number(form.fixedAmount || 0);
  }, [form, selected, summary.remaining, summary.total]);

  const safePreview = toAmount(Math.min(Math.max(0, previewAmount), summary.remaining));
  const overLimit = toAmount(previewAmount) > summary.remaining + 0.01;
  const canCreate = selected && safePreview > 0 && summary.remaining > 0.01 && !overLimit;

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function createInvoice(event) {
    event.preventDefault();
    if (!selected || !canCreate) return;
    const { invoice } = await apiSend("/api/invoices", {
      projectId: selected.project.id,
      quoteId: selected.quote.id,
      type: form.type,
      amountMode: form.amountMode,
      fixedAmount: form.fixedAmount,
      percent: form.percent,
      depositPercent: form.depositPercent,
      dueDate: form.dueDate,
      notes: form.notes
    });
    setInvoices([invoice, ...invoices]);
    setMessage(`Facture ${invoice.invoiceNumber} créée.`);
    setForm((current) => ({ ...current, type: "Facture intermédiaire", amountMode: "remaining", fixedAmount: "", notes: "" }));
  }

  async function updateInvoice(id, action) {
    const { invoice } = await apiSend("/api/invoices", { id, action }, "PATCH");
    if (action === "delete") {
      setInvoices(invoices.filter((item) => item.id !== id));
      setMessage("Facture supprimée.");
      return;
    }
    setInvoices(invoices.map((item) => (item.id === id ? invoice : item)));
    setMessage(action === "issue" ? "Facture émise." : action === "pay" ? "Facture marquée payée." : "Facture annulée.");
  }

  return (
    <Shell>
      <div className="mobile-tool invoice-tool">
        <div className="tool-topline">
          <button className="plain-back" type="button" onClick={() => history.back()}>{"<"}</button>
          <h1>Facturation</h1>
          <span />
        </div>

        <section className="invoice-section">
          <div className="invoice-section-head">
            <h2>Devis signés</h2>
            <span>{eligibleQuotes.length} chantier{eligibleQuotes.length > 1 ? "s" : ""}</span>
          </div>

          {eligibleQuotes.length === 0 ? (
            <div className="tool-empty">Aucun devis signé à facturer pour le moment.</div>
          ) : (
            <div className="invoice-source-list">
              {eligibleQuotes.map(({ quote, project }) => {
                const quoteInvoices = invoices.filter((invoice) => invoice.quoteId === quote.id || invoice.projectId === project.id);
                const itemSummary = billingSummary(quote, quoteInvoices);
                return (
                  <button
                    type="button"
                    className={`invoice-source-card ${quote.id === selected?.quote.id ? "active" : ""}`}
                    key={quote.id}
                    onClick={() => setSelectedQuoteId(quote.id)}
                  >
                    <span className="invoice-source-icon">#</span>
                    <div>
                      <strong>{fixText(project.title || quote.project)}</strong>
                      <small>{fixText(project.client || quote.client)} - {quote.quoteNumber}</small>
                    </div>
                    <div className="invoice-source-money">
                      <b>{euro(itemSummary.remaining)}</b>
                      <small>{itemSummary.state}</small>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {selected ? (
          <>
            <section className="invoice-section">
              <div className="invoice-section-head">
                <h2>{fixText(selected.project.title)}</h2>
                <span>{fixText(selected.project.client)}</span>
              </div>
              <div className="invoice-summary-grid">
                <div><span>Devis signé</span><strong>{euro(summary.total)}</strong></div>
                <div><span>Déjà facturé</span><strong>{euro(summary.already)}</strong></div>
                <div><span>Reste à facturer</span><strong>{euro(summary.remaining)}</strong></div>
                <div><span>État</span><strong>{summary.state}</strong></div>
              </div>
            </section>

            <form className="invoice-section invoice-form" onSubmit={createInvoice}>
              <div className="invoice-section-head">
                <h2>Nouvelle facture</h2>
                <span>{euro(safePreview)}</span>
              </div>

              <div className="invoice-form-grid">
                <label>
                  Type
                  <select value={form.type} onChange={(event) => setField("type", event.target.value)}>
                    {invoiceTypes.map((type) => <option key={type}>{type}</option>)}
                  </select>
                </label>
                <label>
                  Échéance
                  <input type="date" value={form.dueDate} onChange={(event) => setField("dueDate", event.target.value)} />
                </label>
              </div>

              <div className="invoice-mode-grid">
                {modes.map((mode) => (
                  <button
                    type="button"
                    className={form.amountMode === mode.id ? "active" : ""}
                    key={mode.id}
                    onClick={() => setField("amountMode", mode.id)}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              <div className="invoice-form-grid">
                {form.amountMode === "fixed" ? (
                  <label>
                    Montant TTC
                    <input type="number" min="0" step="0.01" value={form.fixedAmount} onChange={(event) => setField("fixedAmount", event.target.value)} placeholder="Ex: 1200" />
                  </label>
                ) : null}
                {form.amountMode === "percent" ? (
                  <label>
                    Pourcentage du devis
                    <input type="number" min="0" max="100" step="1" value={form.percent} onChange={(event) => setField("percent", event.target.value)} />
                  </label>
                ) : null}
                {form.amountMode === "deposit" ? (
                  <label>
                    Acompte
                    <input type="number" min="0" max="100" step="1" value={form.depositPercent} onChange={(event) => setField("depositPercent", event.target.value)} />
                  </label>
                ) : null}
                <label className="full">
                  Note
                  <input value={form.notes} onChange={(event) => setField("notes", event.target.value)} placeholder="Ex: acompte commande fournitures" />
                </label>
              </div>

              {overLimit ? <p className="invoice-warning">Ce montant dépasse le solde restant à facturer.</p> : null}
              {message ? <p className="tool-message">{message}</p> : null}
              <button className="mobile-primary compact" disabled={!canCreate}>Créer la facture</button>
            </form>

            <section className="invoice-section">
              <div className="invoice-section-head">
                <h2>Factures du chantier</h2>
                <span>{selectedInvoices.length}</span>
              </div>
              {selectedInvoices.length === 0 ? (
                <div className="tool-empty">Aucune facture créée pour ce chantier.</div>
              ) : (
                <div className="invoice-list">
                  {selectedInvoices.map((invoice) => (
                    <article className="invoice-row" key={invoice.id}>
                      <div>
                        <strong>{invoice.invoiceNumber}</strong>
                        <small>{invoice.type} - {shortDate(invoice.dueDate)}</small>
                      </div>
                      <span className={`invoice-badge ${invoice.status.toLowerCase()}`}>{invoice.status}</span>
                      <b>{euro(invoice.amountTtc)}</b>
                      <div className="invoice-actions">
                        {invoice.status === "Brouillon" ? <button type="button" onClick={() => updateInvoice(invoice.id, "issue")}>Emettre</button> : null}
                        {invoice.status !== "Payee" && invoice.status !== "Annulee" ? <button type="button" onClick={() => updateInvoice(invoice.id, "pay")}>Payée</button> : null}
                        {invoice.status !== "Annulee" ? <button type="button" onClick={() => updateInvoice(invoice.id, "cancel")}>Annuler</button> : null}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </Shell>
  );
}
