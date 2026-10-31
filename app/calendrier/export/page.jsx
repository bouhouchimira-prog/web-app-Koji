"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shell } from "../../../components/Shell";

export default function ExportPage() {
  const router = useRouter();
  const [format, setFormat] = useState("pdf");

  return (
    <Shell>
      <div className="head">
        <button className="link" onClick={() => router.back()}>← Retour</button>
        <h1>Export calendrier</h1>
      </div>

      <div className="card">
        <div className="card-h"><h2>Format d'export</h2></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {["pdf", "csv", "ics"].map((fmt) => (
            <button key={fmt} className={`btn btn-sm ${format === fmt ? "btn-main" : "btn-sec"}`} onClick={() => setFormat(fmt)} style={{ fontSize: 13 }}>
              {fmt.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h2>Plage de dates</h2></div>
        <div className="fgrid">
          <label>
            <span>Du</span>
            <input type="date" defaultValue="2026-10-01" />
          </label>
          <label>
            <span>Au</span>
            <input type="date" defaultValue="2026-10-31" />
          </label>
        </div>
      </div>

      <div className="card">
        <button className="btn btn-main">⬇ Exporter</button>
      </div>
    </Shell>
  );
}
