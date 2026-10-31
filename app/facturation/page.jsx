"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Shell } from "../../components/Shell";
import { apiSend, readStoredUser } from "../../lib/client-api";
import { useLocale } from "../../lib/i18n";
import { euro } from "../../lib/pricing";
import { fixText } from "../../lib/text";
import { useApi } from "../../lib/use-api";

// Factures, maquette PRO-06 (DA Koji Pro, 30 oct) : liste avec onglets, et
// création d'une facture depuis un devis signé (mêmes modes qu'avant :
// montant, pourcentage, acompte, solde).

const invoiceTypes = ["Acompte initial", "Facture intermédiaire", "Facture finale"];

const INVOICE_TABS = [
  { id: "toutes", label: "Toutes" },
  { id: "Retard", label: "En retard" },
  { id: "Emise", label: "À échéance" },
  { id: "Payee", label: "Payées" },
  { id: "Brouillon", label: "Brouillons" }
];

const STATUS_LABELS = { Brouillon: "Brouillon", Emise: "Envoyée", Payee: "Payée", Retard: "En retard", Annulee: "Annulée" };

function signedQuote(quote) {
  return quote.status === "Signe" || quote.signatureStatus === "Signe";
}

function activeInvoice(invoice) {
  return invoice.status !== "Annulee" && !invoice.deleted;
}

// "En retard" n'est pas stocké : une facture émise dont l'échéance est
// passée est considérée en retard à la volée.
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

function toAmount(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0;
}

function shortDay(value) {
  if (!value) return "";
  const text = String(value);
  const date = new Date(text.length === 10 ? `${text}T00:00:00` : text);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(date);
}

function plural(n, word) {
  return `${n} ${word}${n > 1 ? "s" : ""}`;
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

function InvoiceStatus({ bucket }) {
  if (bucket === "Payee") {
    return (
      <span className="signed">
        <span className="seal"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg></span>
        Payée
      </span>
    );
  }
  if (bucket === "Annulee") return <span className="tag tag-o dim">Annulée</span>;
  if (bucket === "Retard") return <span className="tag tag-b">En retard</span>;
  if (bucket === "Emise") return <span className="tag tag-e">À échéance</span>;
  return <span className="tag tag-o">Brouillon</span>;
}

function dueLabel(invoice) {
  if (invoice.bucket === "Payee") return invoice.paidAt ? `payée le ${shortDay(invoice.paidAt)}` : "payée";
  if (invoice.bucket === "Retard") return `échue le ${shortDay(invoice.dueDate)}`;
  if (invoice.bucket === "Emise") return invoice.dueDate ? shortDay(invoice.dueDate) : "—";
  return "—";
}

function FacturationContent() {
  const { L } = useLocale();
  const searchParams = useSearchParams();
  const quoteIdParam = searchParams.get("quoteId") || "";
  const modes = [
    { id: "fixed", label: L.facturation.modeFixed },
    { id: "percent", label: L.facturation.modePercent },
    { id: "deposit", label: L.facturation.modeDeposit },
    { id: "remaining", label: L.facturation.modeRemaining }
  ];
  const { data: projects } = useApi("/api/projects", "projects");
  const { data: quotes } = useApi("/api/quotes", "quotes");
  const { data: invoices, setData: setInvoices } = useApi("/api/invoices", "invoices");
  const [selectedQuoteId, setSelectedQuoteId] = useState("");
  const [message, setMessage] = useState("");
  const [showDashboard, setShowDashboard] = useState(!quoteIdParam);
  const [tab, setTab] = useState("toutes");
  const [query, setQuery] = useState("");
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

  const invoicesWithBucket = useMemo(
    () => invoices.filter(activeInvoice).map((invoice) => ({ ...invoice, bucket: invoiceBucket(invoice) })),
    [invoices]
  );

  const stats = useMemo(() => {
    const monthKey = monthKeyOf(new Date().toISOString());
    const sum = (list) => list.reduce((total, inv) => total + Number(inv.amountTtc || 0), 0);
    const paidThisMonth = invoicesWithBucket.filter((inv) => inv.status === "Payee" && monthKeyOf(inv.paidAt) === monthKey);
    const pending = invoicesWithBucket.filter((inv) => inv.bucket === "Emise");
    const late = invoicesWithBucket.filter((inv) => inv.bucket === "Retard");
    const drafts = invoicesWithBucket.filter((inv) => inv.status === "Brouillon");
    return {
      paidThisMonth: sum(paidThisMonth),
      paidThisMonthCount: paidThisMonth.length,
      pending: sum(pending),
      pendingCount: pending.length,
      late: sum(late),
      lateCount: late.length,
      draftCount: drafts.length
    };
  }, [invoicesWithBucket]);

  const tabCounts = useMemo(() => {
    const counts = { toutes: invoicesWithBucket.length, Retard: 0, Emise: 0, Payee: 0, Brouillon: 0 };
    invoicesWithBucket.forEach((inv) => { if (counts[inv.bucket] !== undefined) counts[inv.bucket] += 1; });
    return counts;
  }, [invoicesWithBucket]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...invoicesWithBucket]
      .filter((inv) => tab === "toutes" || inv.bucket === tab)
      .filter((inv) => !needle || [inv.invoiceNumber, inv.client, inv.projectTitle].some((v) => String(v || "").toLowerCase().includes(needle)))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  }, [invoicesWithBucket, tab, query]);

  function exportInvoicesCsv() {
    const header = "Numero;Client;Echeance;Montant TTC (EUR);Statut\n";
    const lines = rows
      .map((inv) => `${inv.invoiceNumber};"${(inv.client || "").replace(/"/g, "'")}";${inv.dueDate || ""};${Number(inv.amountTtc || 0).toFixed(2).replace(".", ",")};${STATUS_LABELS[inv.bucket] || inv.status}`)
      .join("\n");
    const blob = new Blob([header + lines], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "factures.csv";
    a.click();
    URL.revokeObjectURL(url);
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

  function primaryAction(invoice) {
    if (invoice.status === "Brouillon") return { label: L.facturation.issue, run: () => updateInvoice(invoice.id, "issue") };
    if (invoice.status !== "Payee") return { label: L.facturation.markPaid, run: () => updateInvoice(invoice.id, "pay") };
    return { label: "PDF", run: () => downloadInvoicePdf(invoice) };
  }

  function invoiceActions(invoice) {
    return (
      <>
        <button type="button" className="btn btn-sec" onClick={() => downloadInvoicePdf(invoice)}>{L.facturation.downloadPdf}</button>
        {invoice.status === "Brouillon" ? <button type="button" className="btn btn-sec" onClick={() => updateInvoice(invoice.id, "issue")}>{L.facturation.issue}</button> : null}
        {invoice.status !== "Payee" && invoice.status !== "Annulee" ? <button type="button" className="btn btn-sec" onClick={() => updateInvoice(invoice.id, "pay")}>{L.facturation.markPaid}</button> : null}
        {invoice.status !== "Annulee" ? <button type="button" className="btn btn-sec" onClick={() => updateInvoice(invoice.id, "cancel")}>{L.common.cancel}</button> : null}
      </>
    );
  }

  if (showDashboard) {
    const monthName = new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(new Date());
    const eyebrow = [
      monthName.charAt(0).toUpperCase() + monthName.slice(1),
      stats.lateCount ? `${plural(stats.lateCount, "facture")} en retard` : null,
      stats.pendingCount ? `${stats.pendingCount} à échéance` : null
    ].filter(Boolean).join(" · ");

    return (
      <Shell variant="pro">
        <div className="head">
          <div className="stack">
            <span className="eyebrow">{eyebrow}</span>
            <h1>Factures</h1>
          </div>
          <div className="acts">
            <button type="button" className="btn btn-sec" onClick={exportInvoicesCsv}>Exporter</button>
            <button type="button" className="btn btn-main" onClick={() => setShowDashboard(false)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              Nouvelle facture
            </button>
          </div>
        </div>

        {message ? <p className="notice" role="status">{message}</p> : null}

        <div className="kpis">
          <div>
            <div className="l">Encaissé ce mois</div>
            <div className="v">{euro(stats.paidThisMonth)}</div>
            <div className="s">{stats.paidThisMonthCount ? plural(stats.paidThisMonthCount, "facture") : "aucune facture payée"}</div>
          </div>
          <div>
            <div className="l">En attente</div>
            <div className="v">{euro(stats.pending)}</div>
            <div className="s">{stats.pendingCount ? `${plural(stats.pendingCount, "facture")}, à échéance` : "aucune facture"}</div>
          </div>
          <div>
            <div className="l">En retard</div>
            <div className="v">{euro(stats.late)}</div>
            <div className="s">{stats.lateCount ? `${plural(stats.lateCount, "facture")}, échéance dépassée` : "aucun retard"}</div>
          </div>
          <div>
            <div className="l">À émettre</div>
            <div className="v">{stats.draftCount}</div>
            <div className="s">{stats.draftCount > 1 ? "factures en brouillon" : "facture en brouillon"}</div>
          </div>
        </div>

        <div className="tbar">
          <div className="wtabs" role="tablist" aria-label="Filtrer les factures">
            {INVOICE_TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
                {t.label} <span>{tabCounts[t.id]}</span>
              </button>
            ))}
          </div>
          <label className="search search-wide">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4.5-4.5" /></svg>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Client, chantier, numéro" aria-label="Rechercher une facture" />
          </label>
        </div>

        {rows.length === 0 ? (
          <div className="tbl">
            <div className="empty">{query.trim() ? "Aucune facture ne correspond à cette recherche." : L.facturation.noInvoices}</div>
          </div>
        ) : (
          <>
            <div className="tbl has-cards">
              <table>
                <thead>
                  <tr>
                    <th>Numéro · client</th>
                    <th>Objet</th>
                    <th className="r">Montant TTC</th>
                    <th>Statut</th>
                    <th>Échéance</th>
                    <th aria-label="Action" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((invoice) => {
                    const action = primaryAction(invoice);
                    const expanded = expandedId === invoice.id;
                    return [
                      <tr key={invoice.id} tabIndex={0} aria-expanded={expanded} onClick={() => setExpandedId(expanded ? "" : invoice.id)} onKeyDown={(event) => { if (event.key === "Enter") setExpandedId(expanded ? "" : invoice.id); }}>
                        <td className="n">{invoice.invoiceNumber}<div className="sm">{fixText(invoice.client || "Client")}</div></td>
                        <td>{[fixText(invoice.type || ""), fixText(invoice.projectTitle || "")].filter(Boolean).join(" · ")}</td>
                        <td className="r">{euro(invoice.amountTtc)}</td>
                        <td><InvoiceStatus bucket={invoice.bucket} /></td>
                        <td className="sm2">{dueLabel(invoice)}</td>
                        <td className="r">
                          <button type="button" className="btn btn-sec" onClick={(event) => { event.stopPropagation(); action.run(); }}>{action.label}</button>
                        </td>
                      </tr>,
                      expanded ? (
                        <tr key={`${invoice.id}-actions`} className="tbl-detail">
                          <td colSpan={6}><div className="hact">{invoiceActions(invoice)}</div></td>
                        </tr>
                      ) : null
                    ];
                  })}
                </tbody>
              </table>
            </div>

            <div className="mlist">
              {rows.map((invoice) => (
                <div className="m-card dvc" key={invoice.id}>
                  <div className="top2">
                    <div>
                      <div className="nm">{invoice.invoiceNumber} · {fixText(invoice.client || "Client")}</div>
                      <div className="meta">{[fixText(invoice.type || ""), fixText(invoice.projectTitle || "")].filter(Boolean).join(" · ")}</div>
                    </div>
                    <InvoiceStatus bucket={invoice.bucket} />
                  </div>
                  <div className="dvc-f">
                    <b>{euro(invoice.amountTtc)}</b>
                    <span className="meta">{dueLabel(invoice)}</span>
                  </div>
                  <div className="hact">{invoiceActions(invoice)}</div>
                </div>
              ))}
            </div>
          </>
        )}

        <p className="foot-note">Une facture envoyée dont l'échéance est passée apparaît « En retard ». Cliquez sur une ligne pour ses autres actions.</p>
      </Shell>
    );
  }

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow">
            <button type="button" className="link" onClick={() => setShowDashboard(true)}>Factures</button>
            {" · "}Nouvelle facture
          </span>
          <h1>Nouvelle facture</h1>
          <span className="muted">Choisissez un devis signé, puis le montant à facturer.</span>
        </div>
      </div>

      {message ? <p className="notice" role="status">{message}</p> : null}

      <div className="fiche-grid">
        <div className="fiche-main">
          <section className="card">
            <div className="card-h">
              <h2>Devis à facturer<span className="kcnt">{eligibleQuotes.length}</span></h2>
            </div>
            {eligibleQuotes.length === 0 ? (
              <p className="empty">{L.facturation.noQuotes}</p>
            ) : (
              <div className="sq-list fq-list">
                {eligibleQuotes.map(({ quote, project }) => {
                  const quoteInvoices = invoices.filter((invoice) => invoice.quoteId === quote.id || invoice.projectId === project.id);
                  const itemSummary = billingSummary(quote, quoteInvoices);
                  const on = quote.id === selected?.quote.id;
                  return (
                    <button type="button" key={quote.id} className={`sq-pick fq-pick${on ? " on" : ""}`} aria-pressed={on} onClick={() => setSelectedQuoteId(quote.id)}>
                      <span className="fq-main">
                        <b>{fixText(project.title || quote.project)}</b>
                        <small>{[fixText(project.client || quote.client), quote.quoteNumber].filter(Boolean).join(" · ")}</small>
                      </span>
                      <span className="fq-side">
                        <b>{euro(itemSummary.remaining)}</b>
                        <small>{itemSummary.state}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {selected ? (
            <form className="card" onSubmit={createInvoice}>
              <div className="card-h">
                <h2>{L.facturation.newInvoice}</h2>
                <span className="muted">{fixText(selected.project.title)}</span>
              </div>
              <div className="fgrid">
                <label>{L.facturation.type}
                  <select value={form.type} onChange={(event) => setField("type", event.target.value)}>
                    {invoiceTypes.map((type) => <option key={type}>{type}</option>)}
                  </select>
                </label>
                <label>{L.facturation.echeance}
                  <input type="date" value={form.dueDate} onChange={(event) => setField("dueDate", event.target.value)} />
                </label>
                <div className="full">
                  <span className="flab">Montant</span>
                  <div className="kp-seg" role="group" aria-label="Mode de calcul du montant">
                    {modes.map((mode) => (
                      <button type="button" key={mode.id} className={form.amountMode === mode.id ? "on" : ""} aria-pressed={form.amountMode === mode.id} onClick={() => setField("amountMode", mode.id)}>
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>
                {form.amountMode === "fixed" ? (
                  <label>{L.facturation.montantTtc}
                    <input type="number" min="0" step="0.01" value={form.fixedAmount} onChange={(event) => setField("fixedAmount", event.target.value)} placeholder="Ex : 1200" />
                  </label>
                ) : null}
                {form.amountMode === "percent" ? (
                  <label>{L.facturation.percentDevis}
                    <input type="number" min="0" max="100" step="1" value={form.percent} onChange={(event) => setField("percent", event.target.value)} />
                  </label>
                ) : null}
                {form.amountMode === "deposit" ? (
                  <label>{L.facturation.deposit}
                    <input type="number" min="0" max="100" step="1" value={form.depositPercent} onChange={(event) => setField("depositPercent", event.target.value)} />
                  </label>
                ) : null}
                <label className="full">{L.facturation.note}
                  <input value={form.notes} onChange={(event) => setField("notes", event.target.value)} placeholder="Ex : acompte commande fournitures" />
                </label>
              </div>
              {overLimit ? <p className="err" role="alert">{L.facturation.overLimit}</p> : null}
              <div className="kv kv-strong fq-total">
                <span>Montant de la facture</span>
                <b>{euro(safePreview)} TTC</b>
              </div>
              <div className="ed-act">
                <button type="submit" className="btn btn-main" disabled={!canCreate}>{L.facturation.generateInvoice}</button>
              </div>
            </form>
          ) : null}
        </div>

        {selected ? (
          <div className="fiche-side">
            <section className="card">
              <div className="card-h">
                <h2>Devis {selected.quote.quoteNumber}</h2>
                <span className={summary.state === "Soldée" ? "tag tag-o dim" : summary.state === "Partielle" ? "tag tag-e" : "tag tag-o"}>{summary.state}</span>
              </div>
              <div className="kv"><span>Client</span><b>{fixText(selected.project.client || selected.quote.client || "—")}</b></div>
              <div className="kv"><span>{L.facturation.total}</span><b>{euro(summary.total)}</b></div>
              <div className="kv"><span>{L.facturation.billed}</span><b>{euro(summary.already)}</b></div>
              <div className="kv kv-strong"><span>{L.facturation.remaining}</span><b>{euro(summary.remaining)}</b></div>
            </section>

            <section className="card">
              <div className="card-h">
                <h2>{L.facturation.siteInvoices}{selectedInvoices.length ? <span className="kcnt">{selectedInvoices.length}</span> : null}</h2>
              </div>
              {selectedInvoices.length === 0 ? (
                <p className="empty">{L.facturation.noInvoices}</p>
              ) : selectedInvoices.map((invoice) => (
                <div className="fq-inv" key={invoice.id}>
                  <div className="row">
                    <div className="t">
                      <strong>{invoice.invoiceNumber}</strong>
                      <small>{[invoice.type, invoice.dueDate ? `échéance ${shortDay(invoice.dueDate)}` : ""].filter(Boolean).join(" · ")}</small>
                    </div>
                    <b>{euro(invoice.amountTtc)}</b>
                  </div>
                  <div className="fq-inv-act">
                    <InvoiceStatus bucket={activeInvoice(invoice) ? invoiceBucket(invoice) : "Annulee"} />
                    <span className="hact">{invoiceActions(invoice)}</span>
                  </div>
                </div>
              ))}
            </section>
          </div>
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
