"use client";
import { useRouter } from "next/navigation";
import { Shell } from "../../../../components/Shell";
import { useState } from "react";

export default function ModeVisitePage() {
  const router = useRouter();
  const [isEnabled, setIsEnabled] = useState(false);

  return (
    <Shell>
      <div className="head">
        <button className="link" onClick={() => router.back()}>← Retour</button>
        <h1>Mode visite</h1>
      </div>
      <div className="card">
        <div className="card-h"><h2>Présentation au client</h2></div>
        <p style={{ marginBottom: 16, color: "var(--grey)" }}>Affichage simplifié du devis sur le chantier (sans prix détaillés).</p>
        <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <input type="checkbox" checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} style={{ width: 18, height: 18 }} />
          <span>Activer le mode visite</span>
        </label>
      </div>
      {isEnabled && (
        <div className="card">
          <div className="card-h"><h2>Aperçu</h2></div>
          <div style={{ padding: "16px", background: "#F5F5F2", borderRadius: 4 }}>
            <p style={{ fontSize: 14, marginBottom: 12 }}>Vue simplifiée affichée sur tablette/mobile sur le chantier.</p>
            <button className="btn btn-sec">👁️ Ouvrir en mode visite</button>
          </div>
        </div>
      )}
    </Shell>
  );
}
