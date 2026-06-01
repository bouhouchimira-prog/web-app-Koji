"use client";

import { useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { useApi } from "../../lib/use-api";
import catalog from "../../data/catalog-ouvrages.json";

function formatHours(value) {
  return Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: 3 });
}

export default function OuvragesLibraryPage() {
  const { data: ouvrages } = useApi("/api/ouvrages", "ouvrages", catalog);
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("Toutes");

  const families = useMemo(() => {
    return ["Toutes", ...Array.from(new Set(ouvrages.map((item) => item.family))).sort()];
  }, [ouvrages]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return ouvrages.filter((item) => {
      if (family !== "Toutes" && item.family !== family) return false;
      if (!normalized) return true;
      return [item.code, item.label, item.family, item.category]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [ouvrages, query, family]);

  const grouped = useMemo(() => {
    const out = {};
    for (const item of filtered) {
      const key = `${item.family} - ${item.category}`;
      if (!out[key]) out[key] = [];
      out[key].push(item);
    }
    return out;
  }, [filtered]);

  return (
    <Shell>
      <header className="page-header">
        <div>
          <p className="eyebrow">BIBLIOTHEQUE D&apos;OUVRAGES</p>
          <h1>Banque de temps Koji</h1>
          <p className="muted">Catalogue source, codes ouvrage, sous-postes et temps h/u conserves depuis l&apos;application Koji.</p>
        </div>
      </header>

      <section className="grid cols-3">
        <div className="metric"><span>Ouvrages total</span><strong>{filtered.length}</strong></div>
        <div className="metric"><span>Postes</span><strong>{filtered.filter((item) => item.type === "POSTE").length}</strong></div>
        <div className="metric"><span>Sous-postes</span><strong>{filtered.filter((item) => item.type === "SOUS-POSTE").length}</strong></div>
      </section>

      <section className="panel" style={{ marginTop: 22 }}>
        <h2>Recherche</h2>
        <div className="form-grid">
          <label className="field full">
            Rechercher
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Code ou libelle (ex: CARMUR, peinture, plafond)"
            />
          </label>
          <label className="field">
            Famille
            <select value={family} onChange={(event) => setFamily(event.target.value)}>
              {families.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
        </div>
      </section>

      {Object.keys(grouped).length === 0 ? (
        <section className="panel" style={{ marginTop: 22 }}>
          <div className="empty-state">Aucun ouvrage trouve pour ce filtre.</div>
        </section>
      ) : (
        <section className="grid" style={{ marginTop: 22 }}>
          {Object.entries(grouped).map(([title, items]) => (
            <article className="panel" key={title}>
              <h2>{title}</h2>
              <div className="table-card" style={{ boxShadow: "none" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Ouvrage</th>
                      <th>Type</th>
                      <th>Temps h/u</th>
                      <th>Unite</th>
                      <th>Methode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td><strong>{item.code}</strong></td>
                        <td>
                          {item.label}
                          <br />
                          <span className="muted">{item.description}</span>
                        </td>
                        <td>{item.type}</td>
                        <td>{formatHours(item.normativeTime)}</td>
                        <td>{item.unit}</td>
                        <td>
                          <span className="status">{item.artiprixCode}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </section>
      )}
    </Shell>
  );
}
