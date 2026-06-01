"use client";

import { useMemo, useState } from "react";
import { pricingProfile, products, smartTasks } from "../lib/data";
import { calculateTaskPrice, euro } from "../lib/pricing";

export function QuoteCalculator() {
  const [taskId, setTaskId] = useState(smartTasks[0]?.id || "");
  const [quantity, setQuantity] = useState(47);
  const [access, setAccess] = useState(1.05);
  const [support, setSupport] = useState(1.1);
  const [complexity, setComplexity] = useState(1.15);

  const task = smartTasks.find((item) => item.id === taskId) ?? smartTasks[0];
  if (!task) {
    return (
      <section className="panel">
        <h2>Calculateur devis</h2>
        <div className="empty-state">Aucun ouvrage disponible.</div>
      </section>
    );
  }
  const result = useMemo(
    () =>
      calculateTaskPrice({
        task,
        quantity,
        realityFactors: { access, support, complexity },
        pricingProfile,
        selectedProducts: products
      }),
    [access, complexity, quantity, support, task]
  );

  return (
    <section className="panel">
      <h2>Calculateur devis</h2>
      <div className="form-grid">
        <label className="field">
          Tache
          <select value={taskId} onChange={(event) => setTaskId(event.target.value)}>
            {smartTasks.map((item) => (
              <option value={item.id} key={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Quantite ({task.unit})
          <input min="1" type="number" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
        </label>
        <label className="field">
          Acces
          <input step="0.05" min="1" type="number" value={access} onChange={(event) => setAccess(Number(event.target.value))} />
        </label>
        <label className="field">
          Support
          <input step="0.05" min="1" type="number" value={support} onChange={(event) => setSupport(Number(event.target.value))} />
        </label>
        <label className="field">
          Complexite
          <input step="0.05" min="1" type="number" value={complexity} onChange={(event) => setComplexity(Number(event.target.value))} />
        </label>
      </div>

      <div className="grid cols-3" style={{ marginTop: 16 }}>
        <div className="card stat">
          <span className="muted">Heures corrigees</span>
          <strong>{result.correctedTimeHours.toFixed(1)} h</strong>
        </div>
        <div className="card stat">
          <span className="muted">Materiaux HT</span>
          <strong>{euro(result.materialCost)}</strong>
        </div>
        <div className="card stat">
          <span className="muted">Total TTC</span>
          <strong>{euro(result.totalTtc)}</strong>
        </div>
      </div>
    </section>
  );
}
