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
// DA Koji Pro (31 oct) : graphique CA/charges en barres groupees, couleurs
// validees (voir home-pro.css, .cp-*), montants au survol + vue tableau ;
// repartition des charges en barres horizontales au lieu du donut.
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
  const [hoverKey, setHoverKey] = useState("");
  const [showTable, setShowTable] = useState(false);

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
      { key: "fournitures", label: "Fournitures", value: selected.fournitures },
      { key: "sousTraitance", label: "Sous-traitance", value: selected.sousTraitance },
      { key: "salaires", label: "Salaires", value: selected.salaires },
      { key: "autres", label: "Autres charges", value: selected.autres }
    ];
    const total = Math.max(0.0001, rows.reduce((sum, r) => sum + r.value, 0));
    return { rows: rows.map((r) => ({ ...r, pct: Math.round((r.value / total) * 100) })) };
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

  const chartMax = Math.max(1, ...chartMonths.map((m) => Math.max(m.ca, m.charges)));
  const hovered = chartMonths.find((m) => m.key === hoverKey) || null;

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow">{`${monthLabel(selectedMonth)} · ${selected.ecritures.length} écriture${selected.ecritures.length > 1 ? "s" : ""}`}</span>
          <h1>Comptabilité</h1>
          <span className="muted">Votre activité en un coup d'œil : chiffre d'affaires, charges et résultat.</span>
        </div>
        <div className="acts">
          <label className="cp-month">
            <span className="sr-only">Mois affiché</span>
            <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
              {last12MonthKeys().map((key) => <option key={key} value={key}>{monthLabel(key)}</option>)}
            </select>
          </label>
          <button type="button" className="btn btn-sec" onClick={() => setChargeDialog(true)}>Ajouter une charge</button>
          <button type="button" className="btn btn-main" onClick={exportCsv}>Exporter pour l'expert-comptable</button>
        </div>
      </div>

      <div className="kpis">
        <div>
          <div className="l">Chiffre d'affaires</div>
          <div className="v">{euro(selected.ca)}</div>
          <div className="s">{caTrend === null ? "pas de comparaison avec le mois précédent" : `${caTrend >= 0 ? "+" : "−"} ${Math.abs(caTrend)} % sur le mois précédent`}</div>
        </div>
        <div>
          <div className="l">Charges</div>
          <div className="v">{euro(totalCharges)}</div>
          <div className="s">{chargesTrend === null ? "pas de comparaison avec le mois précédent" : `${chargesTrend >= 0 ? "+" : "−"} ${Math.abs(chargesTrend)} % sur le mois précédent`}</div>
        </div>
        <div>
          <div className="l">Résultat</div>
          <div className="v">{euro(resultat)}</div>
          <div className="s">{selected.ca > 0 ? `${marge} % de marge` : "pas de chiffre d'affaires ce mois-ci"}</div>
        </div>
        <div>
          <div className="l">TVA à déclarer</div>
          <div className="v">{euro(tvaEstimate)}</div>
          <div className="s">estimation, TVA 20 % supposée</div>
        </div>
      </div>

      <div className="fiche-grid">
        <div className="fiche-main">
          <section className="card cp-card">
            <div className="card-h">
              <h2>Chiffre d'affaires et charges</h2>
              <div className="cp-legend" aria-hidden="true">
                <span><i className="cp-sw ca" />Chiffre d'affaires</span>
                <span><i className="cp-sw ch" />Charges</span>
              </div>
            </div>
            <div className="cp-plot" onMouseLeave={() => setHoverKey("")}>
              <div className="cp-grid" aria-hidden="true">
                {[1, 0.5, 0].map((f) => (
                  <div key={f} className="cp-gl"><span>{euro(chartMax * f)}</span></div>
                ))}
              </div>
              <div className="cp-cols">
                {chartMonths.map((m) => {
                  const current = m.key === selectedMonth;
                  return (
                    <div
                      key={m.key}
                      className={`cp-col${current ? " on" : ""}${hoverKey === m.key ? " hov" : ""}`}
                      tabIndex={0}
                      aria-label={`${monthLabel(m.key)} : chiffre d'affaires ${euro(m.ca)}, charges ${euro(m.charges)}`}
                      onMouseEnter={() => setHoverKey(m.key)}
                      onFocus={() => setHoverKey(m.key)}
                      onBlur={() => setHoverKey("")}
                    >
                      <div className="cp-bars">
                        <i className="ca" style={{ height: `${(m.ca / chartMax) * 100}%` }} />
                        <i className="ch" style={{ height: `${(m.charges / chartMax) * 100}%` }} />
                      </div>
                      <small>{m.label}</small>
                      {hoverKey === m.key ? (
                        <div className="cp-tip" role="tooltip">
                          <strong>{monthLabel(m.key)}</strong>
                          <span><i className="cp-sw ca" />Chiffre d'affaires<b>{euro(m.ca)}</b></span>
                          <span><i className="cp-sw ch" />Charges<b>{euro(m.charges)}</b></span>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="cp-foot">
              <span className="sm2">{hovered ? `${monthLabel(hovered.key)} : ${euro(hovered.ca)} de chiffre d'affaires, ${euro(hovered.charges)} de charges` : "Survolez ou touchez un mois pour voir ses montants."}</span>
              <button type="button" className="link" aria-expanded={showTable} onClick={() => setShowTable((v) => !v)}>{showTable ? "Masquer le tableau" : "Voir en tableau"}</button>
            </div>
            {showTable ? (
              <div className="tbl fit cp-tbl">
                <table>
                  <thead>
                    <tr><th>Mois</th><th className="r">Chiffre d'affaires</th><th className="r">Charges</th><th className="r">Résultat</th></tr>
                  </thead>
                  <tbody>
                    {chartMonths.map((m) => (
                      <tr key={m.key}>
                        <td>{monthLabel(m.key)}</td>
                        <td className="r">{euro(m.ca)}</td>
                        <td className="r">{euro(m.charges)}</td>
                        <td className="r">{euro(m.ca - m.charges)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>

          <section className="card">
            <div className="card-h">
              <h2>Dernières écritures{selected.ecritures.length ? <span className="kcnt">{selected.ecritures.length}</span> : null}</h2>
            </div>
            {dernieresEcritures.length === 0 ? <p className="muted">Aucune écriture ce mois-ci.</p> : dernieresEcritures.map((e) => (
              <div className="row" key={e.id}>
                <div className="t">
                  <strong>{e.label}</strong>
                  <small>{e.date ? shortDate(e.date) : ""}</small>
                </div>
                <b>{e.amount >= 0 ? "+ " : "− "}{euro(Math.abs(e.amount))}</b>
              </div>
            ))}
            {selected.ecritures.length > dernieresEcritures.length ? <p className="foot-note cp-note">Les {selected.ecritures.length} écritures du mois sont dans l'export.</p> : null}
          </section>
        </div>

        <aside className="fiche-side">
          <section className="card">
            <div className="card-h">
              <h2>Répartition des charges</h2>
              <b className="cp-total">{euro(totalCharges)}</b>
            </div>
            {repartition.rows.map((r) => (
              <div className="fp-stock" key={r.key}>
                <div className="fp-stock-h">
                  <span>{r.label}</span>
                  <b>{euro(r.value)} · {totalCharges > 0 ? `${r.pct} %` : "—"}</b>
                </div>
                <div className="bar"><i style={{ width: `${totalCharges > 0 ? r.pct : 0}%` }} /></div>
              </div>
            ))}
            <button type="button" className="link cp-add" onClick={() => setChargeDialog(true)}>+ Ajouter une charge</button>
          </section>
          <p className="foot-note">
            Chiffre d'affaires : factures envoyées ou payées. Charges : commandes fournisseurs, achats divers et charges saisies. La TVA est une estimation à 20 %, pas une déclaration.
          </p>
        </aside>
      </div>

      {chargeDialog ? (
        <div className="pmodal-bg" onClick={() => setChargeDialog(false)}>
          <form className="pmodal" role="dialog" aria-modal="true" aria-label="Nouvelle charge" onSubmit={submitCharge} onClick={(event) => event.stopPropagation()}>
            <div className="card-h">
              <h2>Nouvelle charge</h2>
              <button type="button" className="link" onClick={() => setChargeDialog(false)}>Fermer</button>
            </div>
            <div className="fgrid">
              <label className="full">Libellé
                <input value={chargeForm.label} onChange={(event) => setChargeForm((current) => ({ ...current, label: event.target.value }))} placeholder="Ex : Assurance décennale" autoFocus required />
              </label>
              <label>Catégorie
                <select value={chargeForm.category} onChange={(event) => setChargeForm((current) => ({ ...current, category: event.target.value }))}>
                  {CHARGE_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </label>
              <label>Montant TTC
                <input type="number" step="0.01" value={chargeForm.amount} onChange={(event) => setChargeForm((current) => ({ ...current, amount: event.target.value }))} placeholder="0,00" required />
              </label>
              <label>Date
                <input type="date" value={chargeForm.date} onChange={(event) => setChargeForm((current) => ({ ...current, date: event.target.value }))} />
              </label>
              <label>Chantier (optionnel)
                <select value={chargeForm.projectId} onChange={(event) => setChargeForm((current) => ({ ...current, projectId: event.target.value }))}>
                  <option value="">Charge générale</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </label>
            </div>
            <div className="pm-act">
              <button type="button" className="btn btn-sec" onClick={() => setChargeDialog(false)}>Annuler</button>
              <button type="submit" className="btn btn-main">Créer la charge</button>
            </div>
          </form>
        </div>
      ) : null}
    </Shell>
  );
}
