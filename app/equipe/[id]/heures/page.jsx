"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shell } from "../../../../components/Shell";

export default function HeuresPage() {
  const router = useRouter();
  const [view, setView] = useState("calendar");

  const hours = [
    { date: "2026-10-28", member: "Jean Dupont", hours: 8, project: "Chantier Dupont" },
    { date: "2026-10-29", member: "Jean Dupont", hours: 8, project: "Chantier Dupont" },
    { date: "2026-10-30", member: "Marie Laurent", hours: 6, project: "Chantier Martin" },
    { date: "2026-10-31", member: "Jean Dupont", hours: 7, project: "Chantier Dupont" }
  ];

  const monthTotal = hours.reduce((s, h) => s + h.hours, 0);

  return (
    <Shell>
      <div className="head">
        <button className="link" onClick={() => router.back()}>← Retour</button>
        <h1>Heures et planning</h1>
      </div>

      <div className="kpis">
        <div>
          <div className="l">Heures ce mois</div>
          <div className="v">{monthTotal}h</div>
          <div className="s">Cumulées</div>
        </div>
        <div>
          <div className="l">Moyenne par jour</div>
          <div className="v">{(monthTotal / 20).toFixed(1)}h</div>
          <div className="s">Ouvrables</div>
        </div>
        <div>
          <div className="l">Jours travaillés</div>
          <div className="v">{new Set(hours.map(h => h.date)).size}</div>
          <div className="s">Actifs</div>
        </div>
        <div>
          <div className="l">Projection annuelle</div>
          <div className="v">{(monthTotal * 12).toLocaleString()}h</div>
          <div className="s">Estimée</div>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h2>Vue</h2>
          <div style={{ display: "flex", gap: 4 }}>
            <button className={`btn btn-sm ${view === "calendar" ? "btn-main" : "btn-sec"}`} onClick={() => setView("calendar")} style={{ fontSize: 12, padding: "0 10px", height: 32 }}>Calendrier</button>
            <button className={`btn btn-sm ${view === "table" ? "btn-main" : "btn-sec"}`} onClick={() => setView("table")} style={{ fontSize: 12, padding: "0 10px", height: 32 }}>Tableau</button>
          </div>
        </div>
      </div>

      {view === "table" && (
        <div className="card">
          <div className="card-h"><h2>Heures saisies</h2></div>
          <div className="tbl">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Membre</th>
                  <th>Chantier</th>
                  <th>Heures</th>
                </tr>
              </thead>
              <tbody>
                {hours.map((h, i) => (
                  <tr key={i}>
                    <td className="sm">{new Date(h.date).toLocaleDateString("fr-FR")}</td>
                    <td>{h.member}</td>
                    <td>{h.project}</td>
                    <td className="r">{h.hours}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === "calendar" && (
        <div className="card">
          <div className="card-h"><h2>Octobre 2026</h2></div>
          <div style={{ padding: "16px", background: "#F5F5F2", borderRadius: 4, textAlign: "center", color: "var(--grey)" }}>
            Vue calendrier · Cliquez sur un jour pour ajouter/modifier les heures
          </div>
        </div>
      )}

      <div className="card">
        <button className="btn btn-main">+ Ajouter des heures</button>
      </div>
    </Shell>
  );
}
