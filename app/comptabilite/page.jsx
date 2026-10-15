"use client";

import { useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiSend } from "../../lib/client-api";
import { euro, shortDate } from "../../lib/pricing";
import { useApi } from "../../lib/use-api";

// Page "Comptabilites" (15 oct, maquette fournie par Amira) — agregation de
// donnees DEJA reelles (factures, commandes fournisseurs, achats divers,
// depenses) plutot qu'un nouveau systeme comptable. Rien n'est invente :
// - Chiffre d'affaires = factures au statut Emise/Payee (une facture en
//   Brouillon n'est pas du CA realise).
// - Charges "Fournitures" = commandes + achats divers (deja suivis dans
//   l'outil Fournitures).
// - Charges "Sous-traitance"/"Salaires"/"Autres charges" = /api/expenses
//   (deja utilise pour les depenses de chantier), categorise par mot-cle ;
//   le formulaire "+ Ajouter une charge" de cette page permet d'en creer
//   sans etre rattache a un chantier (modif App API le 15 oct).
// - TVA a declarer = ESTIMATION (taux 20% suppose, affichee comme telle) :
//   aucun taux de TVA par facture n'est stocke aujourd'hui, donc ce nombre
//   ne doit pas etre pris comme une declaration officielle.

const emptyCharge = { label: "", category: "Autres charges", amount: "", date: new Date().toISOString().slice(0, 10), projectId: "" };

const CHARGE_CATEGORIES = ["Sous-traitance", "Salaires", "Autres charges"];

function monthKey(dateStr) {
  return String(dateStr || "").slice(0, 7);
}

function monthLabel(key) {
  const [y, m] = String(key || "").split("-").map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function shortMonthLabel(key) {
  const [y, m] = String(key || "").split("-").map(Number);
  if (!y || !m) return key;
  const label = new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "short" });
  return label.replace(".", "").replace(/^./, (c) => c.toUpperCase());
}

function shiftMonthKey(key, offset) {
  const [y, m] = String(key || "").split("-").map(Number);
  const d = new Date(y, m - 1 + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function last12MonthKeys() {
  const now = new Date();
  const base = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const out = [];
  for (let i = 0; i < 12; i++) out.push(shiftMonthKey(base, -i));
  return out;
}

function expenseBucket(category) {
  const c = String(category || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (c.includes("sous-traitance") || c.includes("sous traitance")) return "sousTraitance";
  if (c.includes("salaire") || c.includes("paie")) return "salaires";
  return "autres";
}

function emptyMonthBucket() {
  return { ca: 0, fournitures: 0, sousTraitance: 0, salaires: 0, autres: 0, ecritures: [] };
}

export default function ComptabilitePage() {
  const { data: invoices } = useApi("/api/invoices", "invoices");
  const { data: commandes } = useApi("/api/commandes", "commandes");
  const { data: supplies } = useApi("/api/supplies", "supplies");
  const { data: expenses, setData: setExpenses } = useApi("/api/expenses", "expenses");
  const { data: projects } = useApi("/api/projects", "projects");

  const [selectedMonth, setSelectedMonth] = useState(() => last12MonthKeys()[0]);
  const [chargeDialog, setChargeDialog] = useState(false);
  const [chargeForm, setChargeForm] = useState(emptyCharge);

  const monthlyStats = useMemo(() => {
    const map = {};
    const ensure = (key) => { if (!map[key]) map[key] = emptyMonthBucket(); return map[key]; };

    invoices.forEach((inv) => {
      if (!["Emise", "Payee"].includes(inv.status)) return;
      const date = inv.issuedAt || inv.createdAt;
      const key = monthKey(date);
      if (!key) return;
      const bucket = ensure(key);
      const amount = Number(inv.amountTtc || 0);
      bucket.ca += amount;
      bucket.ecritures.push({ id: `inv-${inv.id}`, label: `Facture ${inv.invoiceNumber || ""} — ${inv.client || "Client"}`, date, amount });
    });

    commandes.forEach((c) => {
      const key = monthKey(c.createdAt);
      if (!key) return;
      const bucket = ensure(key);
      const amount = Number(c.montantHt || 0);
      if (amount <= 0) return;
      bucket.fournitures += amount;
      bucket.ecritures.push({ id: `cmd-${c.id}`, label: `Commande ${c.supplierName || "Fournisseur"}`, date: c.createdAt, amount: -amount });
    });

    supplies.filter((s) => !s.supplierId).forEach((s) => {
      const amount = Number(s.amountTtc || 0);
      if (amount <= 0) return;
      const key = monthKey(s.createdAt);
      if (!key) return;
      const bucket = ensure(key);
      bucket.fournitures += amount;
      bucket.ecritures.push({ id: `sup-${s.id}`, label: `Achat ${s.storeName || "divers"} — ${s.name}`, date: s.createdAt, amount: -amount });
    });

    expenses.forEach((e) => {
      const key = monthKey(e.createdAt);
      if (!key) return;
      const bucket = ensure(key);
      const amount = Number(e.amount || 0);
      bucket[expenseBucket(e.category)] += amount;
      bucket.ecritures.push({ id: `exp-${e.id}`, label: e.label, date: e.createdAt, amount: -amount });
    });

    return map;
  }, [invoices, commandes, supplies, expenses]);

  const selected = monthlyStats[selectedMonth] || emptyMonthBucket();
  const totalCharges = selected.fournitures + selected.sousTraitance + selected.salaires + selected.autres;
  const resultat = selected.ca - totalCharges;
  const marge = selected.ca > 0 ? Math.round((resultat / selected.ca) * 100) : 0;
  // TVA 20% par defaut — estimation, voir note en tete de fichier.
  const tvaEstimate = Math.round((selected.ca - selected.ca / 1.2) - (totalCharges - totalCharges / 1.2));

  const prevKey = shiftMonthKey(selectedMonth, -1);
  const prev = monthlyStats[prevKey] || emptyMonthBucket();
  const prevTotalCharges = prev.fournitures + prev.sousTraitance + prev.salaires + prev.autres;
  const caTrend = prev.ca > 0 ? Math.round(((selected.ca - prev.ca) / prev.ca) * 100) : null;
  const chargesTrend = prevTotalCharges > 0 ? Math.round(((totalCharges - prevTotalCharges) / prevTotalCharges) * 100) : null;

  const chartMonths = useMemo(() => {
    const keys = [5, 4, 3, 2, 1, 0].map((i) => shiftMonthKey(selectedMonth, -i));
    const maxVal = Math.max(1, ...keys.map((key) => {
      const s = monthlyStats[key] || emptyMonthBucket();
      return Math.max(s.ca, s.fournitures + s.sousTraitance + s.salaires + s.autres);
    }));
    return keys.map((key) => {
      const s = monthlyStats[key] || emptyMonthBucket();
      const charges = s.fournitures + s.sousTraitance + s.salaires + s.autres;
      return { key, label: shortMonthLabel(key), ca: s.ca, charges, caPct: Math.round((s.ca / maxVal) * 100), chargesPct: Math.round((charges / maxVal) * 100) };
    });
  }, [monthlyStats, selectedMonth]);

  const repartition = useMemo(() => {
    const rows = [
      { key: "fournitures", label: "Fournitures", value: selected.fournitures, color: "#0b1f44" },
      { key: "sousTraitance", label: "Sous-traitance", value: selected.sousTraitance, color: "#1d4ed8" },
      { key: "salaires", label: "Salaires", value: selected.salaires, color: "#f0ad4e" },
      { key: "autres", label: "Autres charges", value: selected.autres, color: "#cbd5e1" }
    ];
    const total = Math.max(0.0001, rows.reduce((sum, r) => sum + r.value, 0));
    let offset = 0;
    const withPct = rows.map((r) => {
      const pct = Math.round((r.value / total) * 100);
      const row = { ...r, pct, offset };
      offset += pct;
      return row;
    });
    const gradient = withPct.map((r) => `${r.color} ${r.offset}% ${r.offset + r.pct}%`).join(", ");
    return { rows: withPct, gradient };
  }, [selected]);

  const dernieresEcritures = useMemo(() => {
    return [...selected.ecritures].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 8);
  }, [selected]);

  function exportCsv() {
    const header = "Date;Libelle;Montant TTC (EUR)\n";
    const rows = [...selected.ecritures]
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .map((e) => `${e.date ? e.date.slice(0, 10) : ""};"${(e.label || "").replace(/"/g, "'")}";${e.amount.toFixed(2).replace(".", ",")}`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comptabilite-${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function submitCharge(event) {
    event.preventDefault();
    const payload = {
      label: chargeForm.label.trim(),
      category: chargeForm.category,
      amount: Number(chargeForm.amount || 0),
      projectId: chargeForm.projectId || undefined,
      createdAt: new Date(chargeForm.date).toISOString()
    };
    const { expense } = await apiSend("/api/expenses", payload);
    setExpenses([expense, ...expenses]);
    setChargeDialog(false);
    setChargeForm(emptyCharge);
  }

  return (
    <Shell>
      <section className="fournitures-dashboard">
        <header className="fournitures-dashboard-head">
          <div>
            <h1><span className="title-chip">Comptabilité</span></h1>
            <p>Votre activité en un coup d'œil : chiffre d'affaires, charges et résultat.</p>
          </div>
          <div className="fournitures-dashboard-head-actions">
            <select className="button secondary compta-month-select" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
              {last12MonthKeys().map((key) => <option key={key} value={key}>{monthLabel(key)}</option>)}
            </select>
            <button type="button" className="button blue" onClick={exportCsv}>Exporter pour l'expert-comptable</button>
          </div>
        </header>

        <div className="fournitures-kpi-row">
          <div className="fournitures-kpi-card">
            <div className="fournitures-kpi-card-head">
              <span className="fournitures-kpi-icon fournitures-kpi-icon-green">🏢</span>
              <span className="title-chip">Chiffre d'affaires</span>
            </div>
            <strong>{euro(selected.ca)}</strong>
            <small className={caTrend === null ? "" : caTrend >= 0 ? "positive" : "warning"}>
              {caTrend === null ? "pas de comparaison" : `${caTrend >= 0 ? "+" : ""}${caTrend} %`}
            </small>
          </div>
          <div className="fournitures-kpi-card">
            <div className="fournitures-kpi-card-head">
              <span className="fournitures-kpi-icon fournitures-kpi-icon-amber">📁</span>
              <span className="title-chip">Charges</span>
            </div>
            <strong>{euro(totalCharges)}</strong>
            <small className={chargesTrend === null ? "" : chargesTrend > 0 ? "warning" : "positive"}>
              {chargesTrend === null ? "pas de comparaison" : `${chargesTrend >= 0 ? "+" : ""}${chargesTrend} %`}
            </small>
          </div>
          <div className="fournitures-kpi-card">
            <div className="fournitures-kpi-card-head">
              <span className="fournitures-kpi-icon fournitures-kpi-icon-blue">✅</span>
              <span className="title-chip">Résultat</span>
            </div>
            <strong>{euro(resultat)}</strong>
            <small>{selected.ca > 0 ? `${marge} % de marge` : "—"}</small>
          </div>
          <div className="fournitures-kpi-card">
            <div className="fournitures-kpi-card-head">
              <span className="fournitures-kpi-icon fournitures-kpi-icon-purple">🧾</span>
              <span className="title-chip">TVA à déclarer</span>
            </div>
            <strong>{euro(tvaEstimate)}</strong>
            <small className="warning">estimation (TVA 20 %)</small>
          </div>
        </div>

        <div className="fournitures-dashboard-body">
          <div className="fournitures-main-card">
            <div className="fournitures-main-card-head">
              <strong className="title-chip">Chiffre d'affaires et charges</strong>
              <div className="compta-legend">
                <span><i className="compta-legend-dot" style={{ background: "#0b1f44" }} /> Chiffre d'affaires</span>
                <span><i className="compta-legend-dot" style={{ background: "#f0ad4e" }} /> Charges</span>
              </div>
            </div>
            <div className="compta-chart">
              {chartMonths.map((m) => (
                <div className="compta-chart-col" key={m.key}>
                  <div className="compta-chart-bars">
                    <div className="compta-chart-bar compta-chart-bar-ca" style={{ height: `${m.caPct}%` }} title={euro(m.ca)} />
                    <div className="compta-chart-bar compta-chart-bar-charges" style={{ height: `${m.chargesPct}%` }} title={euro(m.charges)} />
                  </div>
                  <small>{m.label}</small>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="fournitures-sidebar-card">
              <strong className="title-chip">Répartition des charges</strong>
              <div className="compta-donut-wrap">
                <div className="compta-donut" style={{ background: totalCharges > 0 ? `conic-gradient(${repartition.gradient})` : "#f1efe9" }}>
                  <div className="compta-donut-center">
                    <strong>{euro(totalCharges)}</strong>
                    <small>ce mois</small>
                  </div>
                </div>
                <div className="compta-donut-legend">
                  {repartition.rows.map((r) => (
                    <div className="compta-donut-legend-row" key={r.key}>
                      <span><i className="compta-legend-dot" style={{ background: r.color }} /> {r.label}</span>
                      <b>{r.pct} %</b>
                    </div>
                  ))}
                </div>
              </div>
              <button type="button" className="mini-button" style={{ marginTop: 10 }} onClick={() => setChargeDialog(true)}>+ Ajouter une charge</button>
            </div>

            <div className="fournitures-sidebar-card">
              <strong className="title-chip">Dernières écritures</strong>
              {dernieresEcritures.length === 0 ? (
                <div className="tool-empty">Aucune écriture ce mois-ci.</div>
              ) : (
                dernieresEcritures.map((e) => (
                  <div className="compta-ecriture-row" key={e.id}>
                    <div>
                      <strong>{e.label}</strong>
                      <small>{e.date ? shortDate(e.date) : ""}</small>
                    </div>
                    <b className={e.amount >= 0 ? "compta-amount-positive" : "compta-amount-negative"}>
                      {e.amount >= 0 ? "+" : ""}{euro(e.amount)}
                    </b>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {chargeDialog ? (
        <div className="modal-overlay" onClick={() => setChargeDialog(false)}>
          <form className="mini-modal category-modal" onSubmit={submitCharge} onClick={(event) => event.stopPropagation()}>
            <h2>Nouvelle charge</h2>
            <label className="category-modal-field">
              <span>Libellé</span>
              <input value={chargeForm.label} onChange={(event) => setChargeForm((current) => ({ ...current, label: event.target.value }))} placeholder="Ex : Assurance décennale" autoFocus required />
            </label>
            <label className="category-modal-field">
              <span>Catégorie</span>
              <select value={chargeForm.category} onChange={(event) => setChargeForm((current) => ({ ...current, category: event.target.value }))}>
                {CHARGE_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </label>
            <label className="category-modal-field">
              <span>Montant (TTC)</span>
              <input type="number" step="0.01" value={chargeForm.amount} onChange={(event) => setChargeForm((current) => ({ ...current, amount: event.target.value }))} placeholder="0,00" required />
            </label>
            <label className="category-modal-field">
              <span>Date</span>
              <input type="date" value={chargeForm.date} onChange={(event) => setChargeForm((current) => ({ ...current, date: event.target.value }))} />
            </label>
            <label className="category-modal-field">
              <span>Chantier (optionnel)</span>
              <select value={chargeForm.projectId} onChange={(event) => setChargeForm((current) => ({ ...current, projectId: event.target.value }))}>
                <option value="">Charge générale</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </label>
            <div className="category-modal-actions">
              <button type="button" onClick={() => setChargeDialog(false)}>Annuler</button>
              <button type="submit" className="button blue">Créer</button>
            </div>
          </form>
        </div>
      ) : null}
    </Shell>
  );
}
