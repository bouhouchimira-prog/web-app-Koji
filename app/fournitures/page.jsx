"use client";

import { useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiSend } from "../../lib/client-api";
import { euro, shortDate } from "../../lib/pricing";
import { useApi } from "../../lib/use-api";

// Nouvelle page d'accueil de l'outil Fournitures (12 oct, maquette fournie
// par Amira) — tableau de bord des commandes fournisseurs (KPI, tableau
// filtrable, stock bas, prochaines livraisons), plus les boutons
// "Fournisseurs"/"+ Nouvelle commande". Le catalogue d'articles existant
// (gestion categories/fournisseurs/import) est deplace tel quel, logique
// inchangee, vers app/fournitures/catalogue/page.jsx.

const STATUS_META = {
  a_commander: { label: "À commander", color: "#b45309", bg: "#fef3c7" },
  confirmee: { label: "Confirmée", color: "#15803d", bg: "#dcfce7" },
  expediee: { label: "Expédiée", color: "#1d4ed8", bg: "#dbeafe" },
  livree: { label: "Livrée", color: "#15803d", bg: "#dcfce7" },
  en_retard: { label: "En retard", color: "#b91c1c", bg: "#fee2e2" }
};

const FILTER_TABS = [
  { id: "toutes", label: "Toutes" },
  { id: "en_cours", label: "En cours" },
  { id: "livrees", label: "Livrées" },
  { id: "a_commander", label: "À commander" }
];

const initialOrder = {
  supplierId: "",
  projectId: "",
  itemsText: "",
  montantHt: "",
  deliveryDate: "",
  status: "a_commander",
  notes: ""
};

function isSameMonth(dateStr, ref) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

function daysFromNow(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateStr}T00:00:00`);
  return Math.round((target - today) / 86400000);
}

export default function FournituresDashboardPage() {
  const { data: commandes, setData: setCommandes, loading } = useApi("/api/commandes", "commandes");
  const { data: supplies } = useApi("/api/supplies", "supplies");
  const { data: suppliers } = useApi("/api/suppliers", "suppliers");
  const { data: projects } = useApi("/api/projects", "projects");

  const [filterTab, setFilterTab] = useState("toutes");
  const [expandedId, setExpandedId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(initialOrder);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const now = useMemo(() => new Date(), []);

  const kpis = useMemo(() => {
    const enCours = commandes.filter((c) => c.status !== "livree");
    const supplierSet = new Set(enCours.map((c) => c.supplierId).filter(Boolean));

    const aLivrer = commandes.filter((c) => {
      if (c.status === "livree") return false;
      const diff = daysFromNow(c.deliveryDate);
      return diff !== null && diff >= 0 && diff <= 7;
    });
    const demain = aLivrer.filter((c) => daysFromNow(c.deliveryDate) === 1).length;

    const stockBas = supplies.filter((s) => s.reorderThreshold > 0 && s.quantity <= s.reorderThreshold);

    const depensesMois = commandes
      .filter((c) => isSameMonth(c.createdAt, now))
      .reduce((sum, c) => sum + Number(c.montantHt || 0), 0);

    return {
      enCours: enCours.length,
      enCoursSuppliers: supplierSet.size,
      aLivrer: aLivrer.length,
      demain,
      stockBas,
      depensesMois
    };
  }, [commandes, supplies, now]);

  const filteredCommandes = useMemo(() => {
    if (filterTab === "en_cours") return commandes.filter((c) => c.status === "confirmee" || c.status === "expediee" || c.status === "en_retard");
    if (filterTab === "livrees") return commandes.filter((c) => c.status === "livree");
    if (filterTab === "a_commander") return commandes.filter((c) => c.status === "a_commander");
    return commandes;
  }, [commandes, filterTab]);

  const prochainesLivraisons = useMemo(() => {
    return commandes
      .filter((c) => c.status !== "livree" && c.deliveryDate)
      .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate))
      .slice(0, 5);
  }, [commandes]);

  function deliveryLabel(dateStr) {
    const diff = daysFromNow(dateStr);
    if (diff === 0) return "Aujourd'hui";
    if (diff === 1) return "Demain";
    return shortDate(dateStr);
  }

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitOrder(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const items = form.itemsText.split(",").map((s) => s.trim()).filter(Boolean).map((name) => ({ name }));
      const { commande } = await apiSend("/api/commandes", {
        supplierId: form.supplierId,
        projectId: form.projectId,
        items,
        montantHt: Number(form.montantHt || 0),
        deliveryDate: form.deliveryDate || null,
        status: form.status,
        notes: form.notes
      });
      setCommandes([commande, ...commandes]);
      setForm(initialOrder);
      setFormOpen(false);
    } catch (err) {
      setError(err.message || "Impossible de créer la commande.");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(commande, status) {
    try {
      const { commande: updated } = await apiSend("/api/commandes", { id: commande.id, status }, "PATCH");
      setCommandes(commandes.map((c) => (c.id === updated.id ? updated : c)));
    } catch (err) {
      setError(err.message || "Impossible de changer le statut.");
    }
  }

  return (
    <Shell>
      <section className="fournitures-dashboard">
        <div className="fournitures-dashboard-head">
          <div>
            <h1><span className="title-chip">Fournitures</span></h1>
            <p>Commandes, livraisons et stock rattachés à vos chantiers.</p>
          </div>
          <div className="fournitures-dashboard-head-actions">
            <a href="/fournitures/catalogue" className="button secondary">Fournisseurs</a>
            <button type="button" className="button blue" onClick={() => setFormOpen(true)}>+ Nouvelle commande</button>
          </div>
        </div>

        {error ? <p className="tool-message">{error}</p> : null}

        <div className="fournitures-kpi-row">
          <div className="fournitures-kpi-card">
            <div className="fournitures-kpi-card-head">
              <span className="fournitures-kpi-icon fournitures-kpi-icon-blue">📦</span>
              <span className="title-chip">Commandes en cours</span>
            </div>
            <strong>{kpis.enCours}</strong>
            <small>{kpis.enCoursSuppliers} fournisseur{kpis.enCoursSuppliers > 1 ? "s" : ""}</small>
          </div>
          <div className="fournitures-kpi-card">
            <div className="fournitures-kpi-card-head">
              <span className="fournitures-kpi-icon fournitures-kpi-icon-green">🚚</span>
              <span className="title-chip">À livrer cette semaine</span>
            </div>
            <strong>{kpis.aLivrer}</strong>
            <small className="positive">{kpis.demain ? `dont ${kpis.demain} demain` : "—"}</small>
          </div>
          <div className="fournitures-kpi-card">
            <div className="fournitures-kpi-card-head">
              <span className="fournitures-kpi-icon fournitures-kpi-icon-amber">⚠️</span>
              <span className="title-chip">Stock bas</span>
            </div>
            <strong>{kpis.stockBas.length}</strong>
            <small className="warning">{kpis.stockBas.length ? "articles à recommander" : "—"}</small>
          </div>
          <div className="fournitures-kpi-card">
            <div className="fournitures-kpi-card-head">
              <span className="fournitures-kpi-icon fournitures-kpi-icon-purple">📊</span>
              <span className="title-chip">Dépenses du mois</span>
            </div>
            <strong>{euro(kpis.depensesMois)}</strong>
            <small>HT</small>
          </div>
        </div>

        <div className="fournitures-dashboard-body">
          <div className="fournitures-main-card">
            <div className="fournitures-main-card-head">
              <strong className="title-chip">Commandes</strong>
              <div className="fournitures-filter-tabs">
                {FILTER_TABS.map((tab) => (
                  <button type="button" key={tab.id} className={filterTab === tab.id ? "active" : ""} onClick={() => setFilterTab(tab.id)}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {loading ? <p className="tool-muted">Chargement…</p> : null}
            {!loading && filteredCommandes.length === 0 ? (
              <div className="tool-empty">
                <strong>Aucune commande</strong>
                <span>Créez votre première commande fournisseur.</span>
              </div>
            ) : null}

            <div className="fournitures-table">
              {filteredCommandes.map((commande) => {
                const meta = STATUS_META[commande.status];
                const expanded = expandedId === commande.id;
                return (
                  <div key={commande.id} className="fournitures-table-row-wrap">
                    <button
                      type="button"
                      className="fournitures-table-row"
                      onClick={() => setExpandedId(expanded ? null : commande.id)}
                      aria-expanded={expanded}
                    >
                      <div className="fournitures-table-cell fournitures-table-supplier">
                        <strong>{commande.supplierName || "Fournisseur"}</strong>
                        <small>{commande.items.map((i) => i.name).join(", ") || "—"}</small>
                      </div>
                      <div className="fournitures-table-cell">{commande.projectTitle || "—"}</div>
                      <div className="fournitures-table-cell">{commande.deliveryDate ? shortDate(commande.deliveryDate) : "—"}</div>
                      <div className="fournitures-table-cell fournitures-table-amount">{euro(commande.montantHt)}</div>
                      <span className="status-pill" style={{ color: meta.color, background: meta.bg }}>{meta.label}</span>
                    </button>
                    {expanded ? (
                      <div className="fournitures-table-detail">
                        {commande.notes ? <p>{commande.notes}</p> : null}
                        <label>
                          <span>Statut</span>
                          <select value={commande.status} onChange={(event) => changeStatus(commande, event.target.value)}>
                            {Object.entries(STATUS_META).map(([id, m]) => <option key={id} value={id}>{m.label}</option>)}
                          </select>
                        </label>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="fournitures-sidebar">
            <div className="fournitures-sidebar-card">
              <strong className="title-chip">Stock bas</strong>
              {kpis.stockBas.length === 0 ? <p className="tool-muted">Rien à signaler.</p> : null}
              {kpis.stockBas.map((item) => (
                <div className="fournitures-stock-row" key={item.id}>
                  <div>
                    <span>{item.name}</span>
                    <strong className="warning">{item.quantity} restant{item.quantity > 1 ? "s" : ""}</strong>
                  </div>
                  <div className="fournitures-stock-bar">
                    <div style={{ width: `${Math.min(100, (item.quantity / Math.max(item.reorderThreshold, 1)) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="fournitures-sidebar-card">
              <strong className="title-chip">Prochaines livraisons</strong>
              {prochainesLivraisons.length === 0 ? <p className="tool-muted">Rien de prévu.</p> : null}
              {prochainesLivraisons.map((commande) => (
                <div className="fournitures-delivery-row" key={commande.id}>
                  <span className="fournitures-kpi-icon">📦</span>
                  <div>
                    <strong>{commande.items.map((i) => i.name).join(", ") || commande.supplierName}</strong>
                    <small>{commande.projectTitle || commande.supplierName}</small>
                  </div>
                  <span>{deliveryLabel(commande.deliveryDate)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {formOpen ? (
          <div className="modal-overlay" onClick={() => setFormOpen(false)}>
            <form className="mini-modal category-modal" onSubmit={submitOrder} onClick={(event) => event.stopPropagation()}>
              <h2>Nouvelle commande</h2>
              <label className="category-modal-field">
                <span>Fournisseur</span>
                <select value={form.supplierId} onChange={(event) => setField("supplierId", event.target.value)} required>
                  <option value="">Choisir…</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label className="category-modal-field">
                <span>Chantier</span>
                <select value={form.projectId} onChange={(event) => setField("projectId", event.target.value)}>
                  <option value="">Aucun</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </label>
              <label className="category-modal-field">
                <span>Articles (séparés par une virgule)</span>
                <input value={form.itemsText} onChange={(event) => setField("itemsText", event.target.value)} placeholder="Carrelage 60x60, colle, joints" />
              </label>
              <label className="category-modal-field">
                <span>Montant HT</span>
                <input type="number" step="0.01" value={form.montantHt} onChange={(event) => setField("montantHt", event.target.value)} placeholder="0.00" />
              </label>
              <label className="category-modal-field">
                <span>Date de livraison</span>
                <input type="date" value={form.deliveryDate} onChange={(event) => setField("deliveryDate", event.target.value)} />
              </label>
              <label className="category-modal-field">
                <span>Statut</span>
                <select value={form.status} onChange={(event) => setField("status", event.target.value)}>
                  {Object.entries(STATUS_META).map(([id, m]) => <option key={id} value={id}>{m.label}</option>)}
                </select>
              </label>
              <label className="category-modal-field">
                <span>Notes</span>
                <input value={form.notes} onChange={(event) => setField("notes", event.target.value)} />
              </label>
              <div className="category-modal-actions">
                <button type="button" onClick={() => setFormOpen(false)}>Annuler</button>
                <button type="submit" className="button blue" disabled={busy}>Créer</button>
              </div>
            </form>
          </div>
        ) : null}
      </section>
    </Shell>
  );
}
