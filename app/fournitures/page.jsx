"use client";

import { useEffect, useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { FournituresTabs } from "./FournituresTabs";
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
  a_commander: { label: "À commander", tag: "tag tag-o" },
  confirmee: { label: "Confirmée", tag: "tag tag-e" },
  expediee: { label: "Expédiée", tag: "tag tag-e" },
  livree: { label: "Livrée", tag: "tag tag-o dim" },
  en_retard: { label: "En retard", tag: "tag tag-b" }
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("newOrder") === "1") setFormOpen(true);
  }, []);

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

  const tabCounts = {
    commandes: commandes.length,
    categories: supplies.length,
    fournisseurs: new Set(suppliers.map((s) => (s.name || "").trim().toLowerCase())).size,
    divers: supplies.filter((s) => !s.supplierId).length
  };
  const filterCounts = {
    toutes: commandes.length,
    en_cours: commandes.filter((c) => c.status === "confirmee" || c.status === "expediee" || c.status === "en_retard").length,
    livrees: commandes.filter((c) => c.status === "livree").length,
    a_commander: commandes.filter((c) => c.status === "a_commander").length
  };
  const itemsText = (commande) => (commande.items || []).map((i) => i.name).join(", ");
  const statusSelect = (commande) => (
    <label className="fp-status">Statut
      <select value={commande.status} onChange={(event) => changeStatus(commande, event.target.value)} onClick={(event) => event.stopPropagation()}>
        {Object.entries(STATUS_META).map(([id, m]) => <option key={id} value={id}>{m.label}</option>)}
      </select>
    </label>
  );

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow">
            {[`${kpis.enCours} commande${kpis.enCours > 1 ? "s" : ""} en cours`, `${tabCounts.fournisseurs} fournisseur${tabCounts.fournisseurs > 1 ? "s" : ""}`, `${supplies.length} article${supplies.length > 1 ? "s" : ""} au catalogue`].join(" · ")}
          </span>
          <h1>Fournitures</h1>
        </div>
        <div className="acts">
          <button type="button" className="btn btn-main" onClick={() => setFormOpen(true)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            Nouvelle commande
          </button>
        </div>
      </div>

      {error ? <p className="notice" role="alert">{error}</p> : null}

      <div className="kpis">
        <div>
          <div className="l">Commandes en cours</div>
          <div className="v">{kpis.enCours}</div>
          <div className="s">{kpis.enCoursSuppliers} fournisseur{kpis.enCoursSuppliers > 1 ? "s" : ""}</div>
        </div>
        <div>
          <div className="l">À livrer cette semaine</div>
          <div className="v">{kpis.aLivrer}</div>
          <div className="s">{kpis.demain ? `dont ${kpis.demain} demain` : "rien demain"}</div>
        </div>
        <div>
          <div className="l">Stock bas</div>
          <div className="v">{kpis.stockBas.length}</div>
          <div className="s">{kpis.stockBas.length ? "articles à recommander" : "rien à recommander"}</div>
        </div>
        <div>
          <div className="l">Dépenses du mois</div>
          <div className="v">{euro(kpis.depensesMois)}</div>
          <div className="s">HT, commandes créées ce mois-ci</div>
        </div>
      </div>

      <div className="tbar">
        <FournituresTabs current="commandes" counts={tabCounts} />
      </div>

      <div className="fp-layout">
        <div className="fp-main">
          <div className="kp-seg" role="group" aria-label="Filtrer les commandes">
            {FILTER_TABS.map((tab) => (
              <button type="button" key={tab.id} className={filterTab === tab.id ? "on" : ""} aria-pressed={filterTab === tab.id} onClick={() => setFilterTab(tab.id)}>
                {tab.label}<b>{filterCounts[tab.id]}</b>
              </button>
            ))}
          </div>

          {loading || filteredCommandes.length === 0 ? (
            <div className="tbl">
              <p className="empty">{loading ? "Chargement…" : filterTab === "toutes" ? "Aucune commande. Créez votre première commande fournisseur." : "Aucune commande dans cette catégorie."}</p>
            </div>
          ) : (
            <>
              <div className="tbl fit has-cards">
                <table>
                  <thead>
                    <tr>
                      <th>Fournisseur · articles</th>
                      <th>Chantier</th>
                      <th>Livraison</th>
                      <th className="r">Montant HT</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCommandes.map((commande) => {
                      const meta = STATUS_META[commande.status] || STATUS_META.a_commander;
                      const expanded = expandedId === commande.id;
                      return [
                        <tr key={commande.id} tabIndex={0} aria-expanded={expanded} onClick={() => setExpandedId(expanded ? null : commande.id)} onKeyDown={(event) => { if (event.key === "Enter") setExpandedId(expanded ? null : commande.id); }}>
                          <td className="n">{commande.supplierName || "Fournisseur"}<div className="sm">{itemsText(commande) || "—"}</div></td>
                          <td>{commande.projectTitle || <span className="sm2">Sans chantier</span>}</td>
                          <td>{commande.deliveryDate ? deliveryLabel(commande.deliveryDate) : <span className="sm2">—</span>}</td>
                          <td className="r">{euro(commande.montantHt)}</td>
                          <td><span className={meta.tag}>{meta.label}</span></td>
                        </tr>,
                        expanded ? (
                          <tr key={`${commande.id}-detail`} className="tbl-detail">
                            <td colSpan={5}>
                              <div className="fp-detail">
                                {statusSelect(commande)}
                                {commande.notes ? <p>{commande.notes}</p> : <p className="sm2">Pas de note sur cette commande.</p>}
                              </div>
                            </td>
                          </tr>
                        ) : null
                      ];
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mlist">
                {filteredCommandes.map((commande) => {
                  const meta = STATUS_META[commande.status] || STATUS_META.a_commander;
                  return (
                    <div className="m-card" key={commande.id}>
                      <div className="top2">
                        <div>
                          <div className="nm">{commande.supplierName || "Fournisseur"}</div>
                          <div className="meta">{[itemsText(commande), commande.projectTitle].filter(Boolean).join(" · ") || "—"}</div>
                        </div>
                        <span className={meta.tag}>{meta.label}</span>
                      </div>
                      <div className="dvc-f">
                        <b>{euro(commande.montantHt)}</b>
                        <span className="meta">{commande.deliveryDate ? `livraison ${deliveryLabel(commande.deliveryDate).toLowerCase()}` : "pas de date de livraison"}</span>
                      </div>
                      {commande.notes ? <div className="line">{commande.notes}</div> : null}
                      {statusSelect(commande)}
                    </div>
                  );
                })}
              </div>
              <p className="foot-note">Cliquez sur une commande pour changer son statut ou lire sa note.</p>
            </>
          )}
        </div>

        <aside className="fp-side">
          <section className="card">
            <div className="card-h"><h2>Prochaines livraisons</h2></div>
            {prochainesLivraisons.length === 0 ? <p className="muted">Rien de prévu.</p> : prochainesLivraisons.map((commande) => (
              <div className="row" key={commande.id}>
                <div className="t">
                  <strong>{itemsText(commande) || commande.supplierName}</strong>
                  <small>{[commande.supplierName, commande.projectTitle].filter(Boolean).join(" · ")}</small>
                </div>
                <b>{deliveryLabel(commande.deliveryDate)}</b>
              </div>
            ))}
          </section>
          <section className="card">
            <div className="card-h"><h2>Stock bas</h2></div>
            {kpis.stockBas.length === 0 ? <p className="muted">Rien à signaler.</p> : kpis.stockBas.map((item) => (
              <div className="fp-stock" key={item.id}>
                <div className="fp-stock-h">
                  <span>{item.name}</span>
                  <b>{item.quantity} restant{item.quantity > 1 ? "s" : ""}</b>
                </div>
                <div className="bar"><i style={{ width: `${Math.min(100, (item.quantity / Math.max(item.reorderThreshold, 1)) * 100)}%` }} /></div>
              </div>
            ))}
          </section>
        </aside>
      </div>

      {formOpen ? (
        <div className="pmodal-bg" onClick={() => setFormOpen(false)}>
          <form className="pmodal" role="dialog" aria-modal="true" aria-label="Nouvelle commande" onSubmit={submitOrder} onClick={(event) => event.stopPropagation()}>
            <div className="card-h">
              <h2>Nouvelle commande</h2>
              <button type="button" className="link" onClick={() => setFormOpen(false)}>Fermer</button>
            </div>
            <div className="fgrid">
              <label>Fournisseur
                <select value={form.supplierId} onChange={(event) => setField("supplierId", event.target.value)} required>
                  <option value="">Choisir…</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label>Chantier
                <select value={form.projectId} onChange={(event) => setField("projectId", event.target.value)}>
                  <option value="">Aucun</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </label>
              <label className="full">Articles, séparés par une virgule
                <input value={form.itemsText} onChange={(event) => setField("itemsText", event.target.value)} placeholder="Carrelage 60x60, colle, joints" />
              </label>
              <label>Montant HT
                <input type="number" step="0.01" value={form.montantHt} onChange={(event) => setField("montantHt", event.target.value)} placeholder="0.00" />
              </label>
              <label>Date de livraison
                <input type="date" value={form.deliveryDate} onChange={(event) => setField("deliveryDate", event.target.value)} />
              </label>
              <label>Statut
                <select value={form.status} onChange={(event) => setField("status", event.target.value)}>
                  {Object.entries(STATUS_META).map(([id, m]) => <option key={id} value={id}>{m.label}</option>)}
                </select>
              </label>
              <label className="full">Notes
                <input value={form.notes} onChange={(event) => setField("notes", event.target.value)} />
              </label>
            </div>
            <div className="pm-act">
              <button type="button" className="btn btn-sec" onClick={() => setFormOpen(false)}>Annuler</button>
              <button type="submit" className="btn btn-main" disabled={busy}>{busy ? "Création…" : "Créer la commande"}</button>
            </div>
          </form>
        </div>
      ) : null}
    </Shell>
  );
}
