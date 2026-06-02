"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

  const postes = useMemo(() => ouvrages.filter((item) => item.type === "POSTE" || item.type === "SOUS-POSTE"), [ouvrages]);
  const defaultTaskId = postes[0]?.id || "";

  const [form, setForm] = useState({
    client: "",
    clientEmail: "",
    project: "",
    room: "Salon",
    taskId: "",
    quantity: 1,
    access: 1,
    support: 1,
    complexity: 1
  });
  const [librarySelection, setLibrarySelection] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const ouvrage = params.get("ouvrage");
    const fromSelection = params.get("selection") === "ouvrages";
    if (fromSelection) {
      try {
        const selected = JSON.parse(window.localStorage.getItem("koji-devis-ouvrages") || "[]");
        if (Array.isArray(selected) && selected.length > 0) {
          setLibrarySelection(selected);
          setForm((current) => ({ ...current, taskId: selected[0] }));
          return;
        }
      } catch {
        window.localStorage.removeItem("koji-devis-ouvrages");
      }
    }
    if (ouvrage) {
      setLibrarySelection([]);
      setForm((current) => ({ ...current, taskId: ouvrage }));
    }
  }, []);

  const selectedSources = useMemo(() => {
    return librarySelection.map((id) => postes.find((item) => item.id === id)).filter(Boolean);
  }, [librarySelection, postes]);

  const currentSource = useMemo(() => {
    return postes.find((item) => item.id === form.taskId) || postes[0];
  }, [postes, form.taskId]);

  const quoteSources = selectedSources.length > 0 ? selectedSources : currentSource ? [currentSource] : [];

  const quoteLines = useMemo(() => {
    return quoteSources.map((source) => {
      const task = {
        id: source.id,
        code: source.code,
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
      const lineEstimate = calculateTaskPrice({
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
      return {
        id: task.id,
        code: task.code,
        label: task.label,
        room: form.room,
        unit: task.unit,
        quantity: Number(form.quantity || 0),
        normativeTime: task.normativeTime,
        coefficients: {
          access: Number(form.access || 1),
          support: Number(form.support || 1),
          complexity: Number(form.complexity || 1)
        },
        laborCost: lineEstimate.laborCost,
        materialCost: lineEstimate.materialCost,
        totalHt: lineEstimate.totalHt,
        totalTtc: lineEstimate.totalTtc,
        correctedTimeHours: lineEstimate.correctedTimeHours
      };
    });
  }, [form, quoteSources, supplies]);

  const task = useMemo(() => {
    const source = currentSource;
    if (!source) return null;
    return {
      id: source.id,
      code: source.code,
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
  }, [currentSource]);

  const estimate = useMemo(() => {
    return quoteLines.reduce((total, line) => ({
      laborCost: total.laborCost + Number(line.laborCost || 0),
      materialCost: total.materialCost + Number(line.materialCost || 0),
      totalHt: total.totalHt + Number(line.totalHt || 0),
      totalTtc: total.totalTtc + Number(line.totalTtc || 0)
    }), { laborCost: 0, materialCost: 0, totalTtc: 0, totalHt: 0 });
  }, [quoteLines]);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveQuote(event) {
    event.preventDefault();
    if (quoteLines.length === 0) return;
    const selectedProject = projects.find((project) => project.title === form.project);

    const { quote } = await apiSend("/api/quotes", {
      client: form.client || selectedProject?.client || "",
      clientEmail: form.clientEmail,
      project: form.project || selectedProject?.title || "",
      projectId: selectedProject?.id || "",
      projectReference: selectedProject?.reference || "",
      rooms: [form.room],
      items: quoteLines,
      totalHt: estimate.totalHt,
      totalTtc: estimate.totalTtc
    });
    setQuotes([quote, ...quotes]);
    setMessage(`Devis ${quote.quoteNumber} enregistre.`);
  }

  async function updateQuote(id, action) {
    const { quote } = await apiSend("/api/quotes", { id, action }, "PATCH");
    setQuotes(quotes.map((item) => (item.id === quote.id ? quote : item)));
    if (action === "send") setMessage(`Lien de signature pret: ${quote.signatureUrl}`);
    else if (action === "archive") setMessage(`Devis ${quote.quoteNumber} archive.`);
    else setMessage(`Devis ${quote.quoteNumber} pret a envoyer.`);
  }

  function clearLibrarySelection() {
    setLibrarySelection([]);
    if (typeof window !== "undefined") window.localStorage.removeItem("koji-devis-ouvrages");
  }

  return (
    <Shell>
      <header className="page-header">
        <div>
          <p className="eyebrow">DEVIS</p>
          <h1>Generateur de devis</h1>
          <p className="muted">Banque de temps, coefficients terrain, fournitures et signature client.</p>
        </div>
        <Link className="button secondary" href="/signature">Suivre les signatures</Link>
      </header>

      <section className="grid cols-2">
        <form className="panel" onSubmit={saveQuote}>
          <h2>Creer un devis</h2>
          <div className="form-grid">
            <label className="field">Client<input value={form.client} onChange={(event) => setField("client", event.target.value)} placeholder="Nom client" /></label>
            <label className="field">E-mail client<input type="email" value={form.clientEmail} onChange={(event) => setField("clientEmail", event.target.value)} placeholder="client@email.fr" /></label>
            <label className="field">Chantier<select value={form.project} onChange={(event) => setField("project", event.target.value)}>
              <option value="">Choisir un chantier</option>
              {projects.map((project) => <option key={project.id}>{project.title}</option>)}
            </select></label>
            <label className="field">Piece<select value={form.room} onChange={(event) => setField("room", event.target.value)}>
              {["Salon", "Cuisine", "Chambre", "Salle de bain", "Bureau", "Exterieur"].map((room) => <option key={room}>{room}</option>)}
            </select></label>
            <label className="field full">Ouvrage<select value={form.taskId || defaultTaskId} onChange={(event) => {
              clearLibrarySelection();
              setField("taskId", event.target.value);
            }}>
              {postes.map((item) => <option value={item.id} key={item.id}>{item.code} - {item.label}</option>)}
            </select></label>
            <label className="field">Quantite ({task?.unit || "u"})<input type="number" value={form.quantity} onChange={(event) => setField("quantity", event.target.value)} /></label>
            <label className="field">Acces<input type="number" step="0.05" value={form.access} onChange={(event) => setField("access", event.target.value)} /></label>
            <label className="field">Support<input type="number" step="0.05" value={form.support} onChange={(event) => setField("support", event.target.value)} /></label>
            <label className="field">Complexite<input type="number" step="0.05" value={form.complexity} onChange={(event) => setField("complexity", event.target.value)} /></label>
          </div>
          {selectedSources.length > 0 ? (
            <div className="selected-ouvrages-list">
              <div>
                <strong>{selectedSources.length} ouvrage{selectedSources.length > 1 ? "s" : ""} selectionne{selectedSources.length > 1 ? "s" : ""}</strong>
                <button type="button" onClick={clearLibrarySelection}>Retirer la selection</button>
              </div>
              {selectedSources.map((item) => (
                <p key={item.id}><span>{item.code}</span>{item.label}</p>
              ))}
            </div>
          ) : null}
          <div className="quote-result">
            <div><span>Main d&apos;oeuvre</span><strong>{euro(estimate.laborCost)}</strong></div>
            <div><span>Fournitures</span><strong>{euro(estimate.materialCost)}</strong></div>
            <div><span>Total TTC</span><strong>{euro(estimate.totalTtc)}</strong></div>
          </div>
          {message ? <p className="profile-message" style={{ marginTop: 10 }}>{message}</p> : null}
          <button className="button blue" style={{ marginTop: 16 }} disabled={!task}>Enregistrer le devis</button>
        </form>

        <div className="panel">
          <h2>Banque de temps</h2>
          {task ? (
            <div className="work-card">
              <strong>{task.label}</strong>
              <p className="muted" style={{ marginTop: 8 }}>
                Code: {task.code} - Temps normatif: {task.normativeTime} h/{task.unit}
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
          <thead><tr><th>Reference</th><th>Client</th><th>Chantier</th><th>Date</th><th>Statut</th><th>Total TTC</th><th>Actions</th></tr></thead>
          <tbody>
            {quotes.length === 0 ? (
              <tr><td colSpan={7}><div className="empty-state">Aucun devis enregistre.</div></td></tr>
            ) : (
              quotes.map((quote) => (
                <tr key={quote.id}>
                  <td><strong>{quote.quoteNumber}</strong></td>
                  <td>{quote.client}</td>
                  <td>{quote.project}</td>
                  <td>{shortDate(quote.createdAt)}</td>
                  <td><span className="status">{quote.status}</span></td>
                  <td>{euro(quote.totalTtc)}</td>
                  <td>
                    <div className="row-actions">
                      {quote.status === "Brouillon" && <button className="button secondary compact" onClick={() => updateQuote(quote.id, "ready")}>Preparer</button>}
                      {quote.status !== "Signe" && quote.status !== "Archive" && <button className="button blue compact" onClick={() => updateQuote(quote.id, "send")}>Envoyer</button>}
                      {quote.signatureUrl && <Link className="button secondary compact" href={quote.signatureUrl}>Lien</Link>}
                      {quote.status !== "Archive" && <button className="button secondary compact" onClick={() => updateQuote(quote.id, "archive")}>Archiver</button>}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </Shell>
  );
}
