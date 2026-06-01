"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiSend } from "../../lib/client-api";
import { pricingProfile } from "../../lib/data";
import { calculateTaskPrice, euro, shortDate } from "../../lib/pricing";
import { useApi } from "../../lib/use-api";
import catalog from "../../data/catalog-ouvrages.json";

export default function QuotesPage() {
  const { data: quotes, setData: setQuotes } = useApi("/api/quotes", "quotes");
  const { data: projects } = useApi("/api/projects", "projects");
  const { data: supplies } = useApi("/api/supplies", "supplies");
  const { data: ouvrages } = useApi("/api/ouvrages", "ouvrages", catalog);

  const postes = useMemo(() => ouvrages.filter((item) => item.type === "POSTE"), [ouvrages]);
  const defaultTaskId = postes[0]?.id || "";

  const [form, setForm] = useState({
    client: "",
    project: "",
    room: "Salon",
    taskId: "",
    quantity: 1,
    access: 1,
    support: 1,
    complexity: 1
  });

  const task = useMemo(() => {
    const source = postes.find((item) => item.id === form.taskId) || postes[0];
    if (!source) return null;
    return {
      id: source.id,
      label: source.label,
      unit: source.unit || "u",
      normativeTime: Number(source.normativeTime || 0),
      isFixedTime: source.unit === "u",
      materialRequirements: (source.materialCategories || []).map((category) => ({
        productCategory: category,
        yield: 1,
        defaultPricePerUnit: 0,
        isFixedQuantity: false
      }))
    };
  }, [postes, form.taskId]);

  const estimate = useMemo(() => {
    if (!task) {
      return {
        laborCost: 0,
        materialCost: 0,
        totalTtc: 0,
        totalHt: 0
      };
    }
    return calculateTaskPrice({
      task,
      quantity: Number(form.quantity || 0),
      realityFactors: {
        access: Number(form.access || 1),
        support: Number(form.support || 1),
        complexity: Number(form.complexity || 1)
      },
      pricingProfile,
      selectedProducts: supplies
    });
  }, [form, supplies, task]);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveQuote(event) {
    event.preventDefault();
    if (!task) return;
    const selectedProject = projects.find((project) => project.title === form.project);
    const { quote } = await apiSend("/api/quotes", {
      client: form.client || selectedProject?.client || "",
      project: form.project || selectedProject?.title || "",
      rooms: [form.room],
      totalHt: estimate.totalHt,
      totalTtc: estimate.totalTtc
    });
    setQuotes([quote, ...quotes]);
  }

  return (
    <Shell>
      <header className="page-header">
        <div>
          <p className="eyebrow">DEVIS</p>
          <h1>Generateur de devis</h1>
          <p className="muted">Methode Koji: banque de temps (h/u), coefficients terrain et calcul automatique.</p>
        </div>
      </header>

      <section className="grid cols-2">
        <form className="panel" onSubmit={saveQuote}>
          <h2>Creer un devis</h2>
          <div className="form-grid">
            <label className="field">Client<input value={form.client} onChange={(event) => setField("client", event.target.value)} placeholder="Nom client" /></label>
            <label className="field">Chantier<select value={form.project} onChange={(event) => setField("project", event.target.value)}>
              <option value="">Choisir un chantier</option>
              {projects.map((project) => <option key={project.id}>{project.title}</option>)}
            </select></label>
            <label className="field">Piece<select value={form.room} onChange={(event) => setField("room", event.target.value)}>
              {["Salon", "Cuisine", "Chambre", "Salle de bain", "Bureau", "Exterieur"].map((room) => <option key={room}>{room}</option>)}
            </select></label>
            <label className="field">Ouvrage<select value={form.taskId || defaultTaskId} onChange={(event) => setField("taskId", event.target.value)}>
              {postes.map((item) => <option value={item.id} key={item.id}>{item.code} - {item.label}</option>)}
            </select></label>
            <label className="field">Quantite ({task?.unit || "u"})<input type="number" value={form.quantity} onChange={(event) => setField("quantity", event.target.value)} /></label>
            <label className="field">Acces<input type="number" step="0.05" value={form.access} onChange={(event) => setField("access", event.target.value)} /></label>
            <label className="field">Support<input type="number" step="0.05" value={form.support} onChange={(event) => setField("support", event.target.value)} /></label>
            <label className="field">Complexite<input type="number" step="0.05" value={form.complexity} onChange={(event) => setField("complexity", event.target.value)} /></label>
          </div>
          <div className="quote-result">
            <div><span>Main d&apos;oeuvre</span><strong>{euro(estimate.laborCost)}</strong></div>
            <div><span>Fournitures</span><strong>{euro(estimate.materialCost)}</strong></div>
            <div><span>Total TTC</span><strong>{euro(estimate.totalTtc)}</strong></div>
          </div>
          <button className="button blue" style={{ marginTop: 16 }} disabled={!task}>Enregistrer le devis</button>
        </form>

        <div className="panel">
          <h2>Banque de temps</h2>
          {task ? (
            <div className="work-card">
              <strong>{task.label}</strong>
              <p className="muted" style={{ marginTop: 8 }}>
                Code: {postes.find((item) => item.id === task.id)?.code} - Temps normatif: {task.normativeTime} h/{task.unit}
              </p>
              <p className="muted">Formule: (quantite x temps normatif) x coeff acces x coeff support x coeff complexite.</p>
            </div>
          ) : (
            <div className="empty-state">La bibliotheque d&apos;ouvrages est vide.</div>
          )}
          <div style={{ marginTop: 14 }}>
            <Link className="button secondary" href="/bibliotheque-ouvrages">Ouvrir la bibliotheque d&apos;ouvrages</Link>
          </div>
        </div>
      </section>

      <section className="table-card" style={{ marginTop: 22 }}>
        <table className="data-table">
          <thead><tr><th>Reference</th><th>Client</th><th>Chantier</th><th>Date</th><th>Statut</th><th>Total TTC</th></tr></thead>
          <tbody>
            {quotes.length === 0 ? (
              <tr><td colSpan={6}><div className="empty-state">Aucun devis enregistre.</div></td></tr>
            ) : (
              quotes.map((quote) => (
                <tr key={quote.id}>
                  <td><strong>{quote.quoteNumber}</strong></td>
                  <td>{quote.client}</td>
                  <td>{quote.project}</td>
                  <td>{shortDate(quote.createdAt)}</td>
                  <td><span className="status">{quote.status}</span></td>
                  <td>{euro(quote.totalTtc)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </Shell>
  );
}
