"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Shell } from "../../components/Shell";
import { apiSend, readStoredUser } from "../../lib/client-api";
import { useLocale } from "../../lib/i18n";
import { euro, shortDate } from "../../lib/pricing";
import { fixText } from "../../lib/text";
import { useApi } from "../../lib/use-api";

const invoiceTypes = ["Acompte initial", "Facture intermédiaire", "Facture finale"];

function signedQuote(quote) {
  return quote.status === "Signe" || quote.signatureStatus === "Signe";
}

function activeInvoice(invoice) {
  return invoice.status !== "Annulee" && !invoice.deleted;
}

// Tableau de bord (15 oct, maquette fournie par Amira) — le statut "En
// retard" n'est pas stocke : une facture Emise dont l'echeance est passee
// est consideree en retard a la volee, meme principe que le statut derive
// des chantiers.
const INVOICE_STATUS_META = {
  Brouillon: { label: "Brouillon", color: "#64748b", bg: "#f1f5f9" },
  Emise: { label: "Envoyée", color: "#1d4ed8", bg: "#dbeafe" },
  Payee: { label: "Payée", color: "#15803d", bg: "#dcfce7" },
  Retard: { label: "En retard", color: "#b91c1c", bg: "#fee2e2" },
  Annulee: { label: "Annulée", color: "#64748b", bg: "#f1f5f9" }
};

const INVOICE_FILTER_TABS = [
  { id: "toutes", label: "Toutes" },
  { id: "attente", label: "En attente" },
  { id: "payees", label: "Payées" },
  { id: "retard", label: "En retard" }
];

function invoiceBucket(invoice) {
  if (invoice.status === "Emise") {
    const due = invoice.dueDate ? new Date(`${invoice.dueDate}T00:00:00`) : null;
    if (due && due < new Date(new Date().toDateString())) return "Retard";
  }
  return invoice.status;
}

function monthKeyOf(dateStr) {
  return String(dateStr || "").slice(0, 7);
}

function shiftMonth(key, offset) {
  const [y, m] = String(key || "").split("-").map(Number);
  const d = new Date(y, m - 1 + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shortMonthFr(key) {
  const [y, m] = String(key || "").split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "short" });
  return label.replace(".", "").replace(/^./, (c) => c.toUpperCase());
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

function FacturationContent() {
  const { L } = useLocale();
  const searchParams = useSearchParams();
  const quoteIdParam = searchParams.get("quoteId") || "";
  const modes = [
    { id: "fixed", label: L.facturation.modeFixed },
    { id: "percent", label: L.facturation.modePercent },
    { id: "deposit", label: L.facturation.modeDeposit },
    { id: "remaining", label: L.facturation.modeRemaining },
  ];
  const { data: projects } = useApi("/api/projects", "projects");
  const { data: quotes } = useApi("/api/quotes", "quotes");
  const { data: invoices, setData: setInvoices } = useApi("/api/invoices", "invoices");
  const [selectedQuoteId, setSelectedQuoteId] = useState("");
  const [message, setMessage] = useState("");
  const [showDashboard, setShowDashboard] = useState(!quoteIdParam);
  const [filterTab, setFilterTab] = useState("toutes");
  const [expandedId, setExpandedId] = useState("");
  const [form, setForm] = useState({
    type: "Acompte initial",
    amountMode: "deposit",
    fixedAmount: "",
    percent: 30,
    depositPercent: 30,
    dueDate: new Date().toISOString().slice(0, 10),
    notes: ""
  });

  const activeInvoices = useMemo(() => invoices.filter(activeInvoice), [invoices]);

  const invoicesWithBucket = useMemo(
    () => activeInvoices.map((invoice) => ({ ...invoice, bucket: invoiceBucket(invoice) })),
    [activeInvoices]
  );

  const dashboardStats = useMemo(() => {
    const now = new Date();
    const facturees = invoicesWithBucket.filter((inv) => inv.status !== "Brouillon");
    const thisMonth = facturees.filter((inv) => monthKeyOf(inv.issuedAt || inv.createdAt) === monthKeyOf(now.toISOString()));
    const lastMonthKey = shiftMonth(monthKeyOf(now.toISOString()), -1);
    const lastMonth = facturees.filter((inv) => monthKeyOf(inv.issuedAt || inv.createdAt) === lastMonthKey);
    const factureCeMois = thisMonth.reduce((sum, inv) => sum + Number(inv.amountTtc || 0), 0);
    const factureMoisDernier = lastMonth.reduce((sum, inv) => sum + Number(inv.amountTtc || 0), 0);
    const trend = factureMoisDernier > 0 ? Math.round(((factureCeMois - factureMoisDernier) / factureMoisDernier) * 100) : null;

    const payees = facturees.filter((inv) => inv.status === "Payee");
    const encaisse = payees.reduce((sum, inv) => sum + Number(inv.amountTtc || 0), 0);
    const totalFacture = facturees.reduce((sum, inv) => sum + Number(inv.amountTtc || 0), 0);
    const encaissePct = totalFacture > 0 ? Math.round((encaisse / totalFacture) * 100) : 0;

    const enAttente = facturees.filter((inv) => inv.bucket === "Emise");
    const enRetard = facturees.filter((inv) => inv.bucket === "Retard");

    return {
      factureCeMois,
      trend,
      encaisse,
      encaissePct,
      enAttenteTotal: enAttente.reduce((sum, inv) => sum + Number(inv.amountTtc || 0), 0),
      enAttenteCount: enAttente.length,
      enRetardTotal: enRetard.reduce((sum, inv) => sum + Number(inv.amountTtc || 0), 0),
      enRetardCount: enRetard.length,
      enRetardItems: enRetard
    };
  }, [invoicesWithBucket]);

  const chartMonths = useMemo(() => {
    const nowKey = monthKeyOf(new Date().toISOString());
    const keys = [5, 4, 3, 2, 1, 0].map((i) => shiftMonth(nowKey, -i));
    const facturees = invoicesWithBucket.filter((inv) => inv.status !== "Brouillon");
    const maxVal = Math.max(1, ...keys.map((key) => {
      const facture = facturees.filter((inv) => monthKeyOf(inv.issuedAt || inv.createdAt) === key).reduce((sum, inv) => sum + Number(inv.amountTtc || 0), 0);
      return facture;
    }));
    return keys.map((key) => {
      const facture = facturees.filter((inv) => monthKeyOf(inv.issuedAt || inv.createdAt) === key).reduce((sum, inv) => sum + Number(inv.amountTtc || 0), 0);
      const paye = facturees.filter((inv) => inv.status === "Payee" && monthKeyOf(inv.paidAt) === key).reduce((sum, inv) => sum + Number(inv.amountTtc || 0), 0);
      return { key, label: shortMonthFr(key), facture, paye, facturePct: Math.round((facture / maxVal) * 100), payePct: Math.round((paye / maxVal) * 100) };
    });
  }, [invoicesWithBucket]);

  const filteredInvoices = useMemo(() => {
    const sorted = [...invoicesWithBucket].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    if (filterTab === "toutes") return sorted;
    if (filterTab === "attente") return sorted.filter((inv) => inv.bucket === "Emise");
    if (filterTab === "payees") return sorted.filter((inv) => inv.bucket === "Payee");
    if (filterTab === "retard") return sorted.filter((inv) => inv.bucket === "Retard");
    return sorted;
  }, [invoicesWithBucket, filterTab]);

  function exportInvoicesCsv() {
    const header = "Numero;Client;Echeance;Montant TTC (EUR);Statut\n";
    const rows = filteredInvoices
      .map((inv) => `${inv.invoiceNumber};"${(inv.client || "").replace(/"/g, "'")}";${inv.dueDate || ""};${Number(inv.amountTtc || 0).toFixed(2).replace(".", ",")};${INVOICE_STATUS_META[inv.bucket]?.label || inv.status}`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "factures.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function daysLate(dueDate) {
    if (!dueDate) return 0;
    const diff = new Date(new Date().toDateString()) - new Date(`${dueDate}T00:00:00`);
    return Math.max(0, Math.round(diff / 86400000));
  }

  const eligibleQuotes = useMemo(() => {
    const transformedQuoteIds = new Set(invoices.filter((invoice) => invoice.sourceType === "quote-transform").map((invoice) => invoice.quoteId));
    return quotes
      .filter((quote) => signedQuote(quote) || transformedQuoteIds.has(quote.id))
      .map((quote) => {
        const linkedProject = projects.find((project) => project.id === quote.projectId);
        // A quote transformed into an invoice may have no chantier linked at
        // all — give it a stand-in "project" shape instead of dropping it,
        // since the rest of this page (title/client/status) expects one.
        const project = linkedProject || {
          id: quote.projectId || `quote-${quote.id}`,
          title: quote.project || quote.quoteNumber || "Devis",
          client: quote.client || "",
          clientEmail: quote.clientEmail || "",
          status: "Actif"
        };
        return { quote, project };
      })
      .filter(({ project }) => project.status !== "Archive");
  }, [projects, quotes, invoices]);

  useEffect(() => {
    if (quoteIdParam && eligibleQuotes.some(({ quote }) => quote.id === quoteIdParam)) {
      setSelectedQuoteId(quoteIdParam);
      return;
    }
    if (selectedQuoteId || eligibleQuotes.length === 0) return;
    setSelectedQuoteId(eligibleQuotes[0].quote.id);
  }, [eligibleQuotes, selectedQuoteId, quoteIdParam]);

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
    setMessage(`${L.facturation.title} ${invoice.invoiceNumber}`);
    setForm((current) => ({ ...current, type: "Facture intermédiaire", amountMode: "remaining", fixedAmount: "", notes: "" }));
  }

  function downloadInvoicePdf(invoice) {
    if (invoice.sourceType === "quote-transform" && invoice.quoteId) {
      window.open(`/api/quotes/${invoice.quoteId}/documents?type=facture&format=pdf`, "_blank");
      return;
    }
    const userId = readStoredUser()?.id || "";
    window.open(`/api/invoices/pdf?id=${encodeURIComponent(invoice.id)}&userId=${encodeURIComponent(userId)}`, "_blank");
  }

  async function updateInvoice(id, action) {
    const { invoice } = await apiSend("/api/invoices", { id, action }, "PATCH");
    if (action === "delete") {
      setInvoices(invoices.filter((item) => item.id !== id));
      setMessage(L.common.delete);
      return;
    }
    setInvoices(invoices.map((item) => (item.id === id ? invoice : item)));
    setMessage(action === "issue" ? L.facturation.issue : action === "pay" ? L.facturation.markPaid : L.common.cancel);
  }

  if (showDashboard) {
    return (
      <Shell>
        <section className="fournitures-dashboard">
          <header className="fournitures-dashboard-head">
            <div>
              <h1><span className="title-chip">Factures</span></h1>
              <p>Facturez vos chantiers et suivez les paiements en temps réel.</p>
            </div>
            <div className="fournitures-dashboard-head-actions">
              <button type="button" className="button secondary" onClick={exportInvoicesCsv}>Exporter</button>
              <button type="button" className="button blue" onClick={() => setShowDashboard(false)}>+ Nouvelle facture</button>
            </div>
          </header>

          <div className="fournitures-kpi-row">
            <div className="fournitures-kpi-card">
              <div className="fournitures-kpi-card-head">
                <span className="fournitures-kpi-icon fournitures-kpi-icon-blue">📄</span>
                <span className="title-chip">Facturé ce mois</span>
              </div>
              <strong>{euro(dashboardStats.factureCeMois)}</strong>
              <small className={dashboardStats.trend === null ? "" : dashboardStats.trend >= 0 ? "positive" : "warning"}>
                {dashboardStats.trend === null ? "pas de comparaison" : `${dashboardStats.trend >= 0 ? "+" : ""}${dashboardStats.trend} %`}
              </small>
            </div>
            <div className="fournitures-kpi-card">
              <div className="fournitures-kpi-card-head">
                <span className="fournitures-kpi-icon fournitures-kpi-icon-green">✅</span>
                <span className="title-chip">Encaissé</span>
              </div>
              <strong>{euro(dashboardStats.encaisse)}</strong>
              <small className="positive">{dashboardStats.encaissePct} % du facturé</small>
            </div>
            <div className="fournitures-kpi-card">
              <div className="fournitures-kpi-card-head">
                <span className="fournitures-kpi-icon fournitures-kpi-icon-amber">⏰</span>
                <span className="title-chip">En attente</span>
              </div>
              <strong>{euro(dashboardStats.enAttenteTotal)}</strong>
              <small>{dashboardStats.enAttenteCount} facture{dashboardStats.enAttenteCount > 1 ? "s" : ""}</small>
            </div>
            <div className="fournitures-kpi-card">
              <div className="fournitures-kpi-card-head">
                <span className="fournitures-kpi-icon fournitures-kpi-icon-purple">⚠️</span>
                <span className="title-chip">En retard</span>
              </div>
              <strong>{euro(dashboardStats.enRetardTotal)}</strong>
              <small className={dashboardStats.enRetardCount > 0 ? "warning" : ""}>{dashboardStats.enRetardCount} facture{dashboardStats.enRetardCount > 1 ? "s" : ""}</small>
            </div>
          </div>

          <div className="fournitures-dashboard-body">
            <div className="fournitures-main-card">
              <div className="fournitures-main-card-head">
                <strong className="title-chip">Dernières factures</strong>
                <div className="fournitures-filter-tabs">
                  {INVOICE_FILTER_TABS.map((tab) => (
                    <button type="button" key={tab.id} className={filterTab === tab.id ? "active" : ""} onClick={() => setFilterTab(tab.id)}>
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredInvoices.length === 0 ? (
                <div className="tool-empty">{L.facturation.noInvoices}</div>
              ) : (
                <div className="fournitures-table devis-table">
                  <div className="fournitures-table-head-row devis-table-row">
                    <div>N°</div>
                    <div>CLIENT</div>
                    <div>ÉCHÉANCE</div>
                    <div>MONTANT TTC</div>
                    <div>STATUT</div>
                  </div>
                  {filteredInvoices.map((invoice) => {
                    const meta = INVOICE_STATUS_META[invoice.bucket] || INVOICE_STATUS_META.Brouillon;
                    const expanded = expandedId === invoice.id;
                    return (
                      <div className="fournitures-table-row-wrap" key={invoice.id}>
                        <button
                          type="button"
                          className="fournitures-table-row facture-table-row"
                          onClick={() => setExpandedId(expanded ? "" : invoice.id)}
                        >
                          <div className="fournitures-table-cell"><strong>{invoice.invoiceNumber}</strong></div>
                          <div className="fournitures-table-cell">
                            <strong>{fixText(invoice.client || "Client")}</strong>
                            <small>{fixText(invoice.type || "")} — {fixText(invoice.projectTitle || "")}</small>
                          </div>
                          <div className="fournitures-table-cell">{invoice.dueDate ? shortDate(invoice.dueDate) : "—"}</div>
                          <div className="fournitures-table-cell fournitures-table-amount">{euro(invoice.amountTtc)}</div>
                          <div><span className="status-pill" style={{ color: meta.color, background: meta.bg }}>{meta.label}</span></div>
                        </button>
                        {expanded ? (
                          <div className="fournitures-table-detail">
                            <div className="facture-detail-actions">
                              <button type="button" className="mini-button" onClick={() => downloadInvoicePdf(invoice)}>{L.facturation.downloadPdf}</button>
                              {invoice.status === "Brouillon" ? <button type="button" className="mini-button" onClick={() => updateInvoice(invoice.id, "issue")}>{L.facturation.issue}</button> : null}
                              {invoice.status !== "Payee" && invoice.status !== "Annulee" ? <button type="button" className="mini-button primary" onClick={() => updateInvoice(invoice.id, "pay")}>{L.facturation.markPaid}</button> : null}
                              {invoice.status !== "Annulee" ? <button type="button" className="mini-danger" onClick={() => updateInvoice(invoice.id, "cancel")}>{L.common.cancel}</button> : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <div className="fournitures-sidebar-card">
                <div className="facture-chart-head">
                  <strong className="title-chip">Facturé et encaissé</strong>
                  <small className="muted">6 derniers mois</small>
                </div>
                <div className="compta-legend" style={{ marginBottom: 8 }}>
                  <span><i className="compta-legend-dot" style={{ background: "#0b1f44" }} /> Facturé</span>
                  <span><i className="compta-legend-dot" style={{ background: "#cbd5e1" }} /> Encaissé</span>
                </div>
                <div className="compta-chart" style={{ height: 150 }}>
                  {chartMonths.map((m) => (
                    <div className="compta-chart-col" key={m.key}>
                      <div className="compta-chart-bars">
                        <div className="compta-chart-bar compta-chart-bar-ca" style={{ height: `${m.facturePct}%` }} title={euro(m.facture)} />
                        <div className="compta-chart-bar facture-chart-bar-paye" style={{ height: `${m.payePct}%` }} title={euro(m.paye)} />
                      </div>
                      <small>{m.label}</small>
                    </div>
                  ))}
                </div>
              </div>

              <div className="fournitures-sidebar-card">
                <strong className="title-chip">Factures en retard</strong>
                {dashboardStats.enRetardItems.length === 0 ? (
                  <div className="tool-empty">Rien à signaler.</div>
                ) : (
                  dashboardStats.enRetardItems.map((invoice) => (
                    <div className="chantiers-alert-row chantiers-alert-late facture-relance-row" key={invoice.id}>
                      <div className="chantiers-alert-main">
                        <strong>{fixText(invoice.client || "Client")} · {invoice.invoiceNumber}</strong>
                        <small>{daysLate(invoice.dueDate)} jours de retard · {euro(invoice.amountTtc)}</small>
                      </div>
                      <button type="button" className="mini-button primary" onClick={() => setExpandedId(invoice.id)}>Relancer</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mobile-tool invoice-tool">
        <div className="tool-topline">
          <button className="plain-back" type="button" onClick={() => setShowDashboard(true)}>{"<"}</button>
          <h1>{L.facturation.title}</h1>
          <span />
        </div>

        <section className="invoice-section">
          <div className="invoice-section-head">
            <h2>{L.facturation.signedQuotes}</h2>
            <span>{eligibleQuotes.length}</span>
          </div>

          {eligibleQuotes.length === 0 ? (
            <div className="tool-empty">{L.facturation.noQuotes}</div>
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
                <div><span>{L.facturation.total}</span><strong>{euro(summary.total)}</strong></div>
                <div><span>{L.facturation.billed}</span><strong>{euro(summary.already)}</strong></div>
                <div><span>{L.facturation.remaining}</span><strong>{euro(summary.remaining)}</strong></div>
                <div><span>{L.facturation.status}</span><strong>{summary.state}</strong></div>
              </div>
            </section>

            <form className="invoice-section invoice-form" onSubmit={createInvoice}>
              <div className="invoice-section-head">
                <h2>{L.facturation.newInvoice}</h2>
                <span>{euro(safePreview)}</span>
              </div>

              <div className="invoice-form-grid">
                <label>
                  {L.facturation.type}
                  <select value={form.type} onChange={(event) => setField("type", event.target.value)}>
                    {invoiceTypes.map((type) => <option key={type}>{type}</option>)}
                  </select>
                </label>
                <label>
                  {L.facturation.echeance}
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
                    {L.facturation.montantTtc}
                    <input type="number" min="0" step="0.01" value={form.fixedAmount} onChange={(event) => setField("fixedAmount", event.target.value)} placeholder="Ex: 1200" />
                  </label>
                ) : null}
                {form.amountMode === "percent" ? (
                  <label>
                    {L.facturation.percentDevis}
                    <input type="number" min="0" max="100" step="1" value={form.percent} onChange={(event) => setField("percent", event.target.value)} />
                  </label>
                ) : null}
                {form.amountMode === "deposit" ? (
                  <label>
                    {L.facturation.deposit}
                    <input type="number" min="0" max="100" step="1" value={form.depositPercent} onChange={(event) => setField("depositPercent", event.target.value)} />
                  </label>
                ) : null}
                <label className="full">
                  {L.facturation.note}
                  <input value={form.notes} onChange={(event) => setField("notes", event.target.value)} placeholder="Ex: acompte commande fournitures" />
                </label>
              </div>

              {overLimit ? <p className="invoice-warning">{L.facturation.overLimit}</p> : null}
              {message ? <p className="tool-message">{message}</p> : null}
              <button className="mobile-primary compact" disabled={!canCreate}>{L.facturation.generateInvoice}</button>
            </form>

            <section className="invoice-section">
              <div className="invoice-section-head">
                <h2>{L.facturation.siteInvoices}</h2>
                <span>{selectedInvoices.length}</span>
              </div>
              {selectedInvoices.length === 0 ? (
                <div className="tool-empty">{L.facturation.noInvoices}</div>
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
                        <button type="button" onClick={() => downloadInvoicePdf(invoice)}>{L.facturation.downloadPdf}</button>
                        {invoice.status === "Brouillon" ? <button type="button" onClick={() => updateInvoice(invoice.id, "issue")}>{L.facturation.issue}</button> : null}
                        {invoice.status !== "Payee" && invoice.status !== "Annulee" ? <button type="button" onClick={() => updateInvoice(invoice.id, "pay")}>{L.facturation.markPaid}</button> : null}
                        {invoice.status !== "Annulee" ? <button type="button" onClick={() => updateInvoice(invoice.id, "cancel")}>{L.common.cancel}</button> : null}
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

export default function FacturationPage() {
  return (
    <Suspense fallback={null}>
      <FacturationContent />
    </Suspense>
  );
}
