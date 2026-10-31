"use client";

import { useRouter, useParams } from "next/navigation";
import { useState } from "react";
import { Shell } from "../../../../components/Shell";

export default function RelancesPage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params.id;
  const [relances, setRelances] = useState([
    { id: 1, level: 1, date: "2026-11-01", type: "Relance amicale", status: "Envoyée" },
    { id: 2, level: 2, date: "2026-11-10", type: "Mise en demeure", status: "Non envoyée" }
  ]);

  const levels = [
    { level: 1, label: "Relance amicale", delay: 15 },
    { level: 2, label: "Mise en demeure", delay: 25 },
    { level: 3, label: "Saisie du tribunal", delay: 45 }
  ];

  return (
    <Shell>
      <div className="head">
        <div className="stack">
          <button type="button" className="link" onClick={() => router.back()}>← Retour</button>
          <span className="eyebrow">Facturation</span>
          <h1>Relances et mise en demeure</h1>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h2>Procédure de relance</h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {levels.map((l) => (
            <div key={l.level} style={{ padding: "14px", background: "#F5F5F2", borderRadius: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <strong>{l.level}. {l.label}</strong>
                <small style={{ color: "var(--grey)" }}>Après {l.delay} jours</small>
              </div>
              <button type="button" className="btn btn-sec" style={{ fontSize: 12, height: 36 }}>
                {relances.find(r => r.level === l.level)?.status === "Envoyée" ? "✓ Envoyée" : "📬 Envoyer"}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h2>Historique des relances</h2>
        </div>

        {relances.length > 0 ? (
          <div className="tbl">
            <table>
              <thead>
                <tr>
                  <th>Niveau</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {relances.map((r) => (
                  <tr key={r.id}>
                    <td className="sm">N°{r.level}</td>
                    <td>{r.type}</td>
                    <td>{new Date(r.date).toLocaleDateString("fr-FR")}</td>
                    <td>
                      <span className={`tag ${r.status === "Envoyée" ? "tag-b" : "tag-o"}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">Aucune relance enregistrée.</p>
        )}
      </div>
    </Shell>
  );
}
