"use client";

import { useRouter, useParams } from "next/navigation";
import { useState } from "react";
import { Shell } from "../../../../components/Shell";

export default function ReceptionPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id;
  const [step, setStep] = useState("inspection");
  const [inspection, setInspection] = useState({
    completeness: false,
    qualityCheck: false,
    noOutstandingReserves: false,
    clientSignoff: false
  });

  const steps = [
    { id: "inspection", label: "Inspection finale", icon: "✓" },
    { id: "cleanup", label: "Nettoyage", icon: "✓" },
    { id: "documents", label: "Documents", icon: "✓" },
    { id: "closure", label: "Clôture", icon: "✓" }
  ];

  return (
    <Shell>
      <div className="head">
        <div className="stack">
          <button type="button" className="link" onClick={() => router.back()}>← Retour</button>
          <span className="eyebrow">Fiche chantier</span>
          <h1>Réception et clôture</h1>
        </div>
      </div>

      {/* Timeline */}
      <div className="card">
        <div className="card-h">
          <h2>Étapes de clôture</h2>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {steps.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              className={`btn btn-sm ${step === s.id ? "btn-main" : "btn-sec"}`}
              style={{ fontSize: 13, padding: "0 12px" }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {step === "inspection" && (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Inspection finale</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {Object.entries(inspection).map(([key, value]) => (
                <label key={key} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => setInspection({ ...inspection, [key]: e.target.checked })}
                    style={{ width: 18, height: 18 }}
                  />
                  <span style={{ fontSize: 14 }}>
                    {key === "completeness" && "Travaux terminés conformément au devis"}
                    {key === "qualityCheck" && "Qualité conforme aux standards"}
                    {key === "noOutstandingReserves" && "Aucune réserve non résolue"}
                    {key === "clientSignoff" && "Accord du client obtenu"}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {step === "cleanup" && (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Nettoyage du chantier</h3>
            <p style={{ color: "var(--grey)" }}>Confirmez que le nettoyage du chantier a été effectué.</p>
            <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, cursor: "pointer" }}>
              <input type="checkbox" style={{ width: 18, height: 18 }} />
              <span>Nettoyage terminé et validé</span>
            </label>
          </div>
        )}

        {step === "documents" && (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Documents de clôture</h3>
            <div className="mlist" style={{ gap: 12 }}>
              {["Dossier de fin de chantier", "Certificat de fin de travaux", "PV de réception"].map((doc, i) => (
                <div key={i} className="m-card" style={{ padding: 12 }}>
                  <div className="top2">
                    <span style={{ fontWeight: 600 }}>{doc}</span>
                    <a href="#" className="link" style={{ fontSize: 12 }}>Télécharger</a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === "closure" && (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Clôture du chantier</h3>
            <p style={{ color: "var(--grey)", marginBottom: 16 }}>Une fois clôturé, le chantier ne pourra plus être modifié.</p>
            <button type="button" className="btn btn-main" onClick={() => router.back()}>Clôturer le chantier</button>
          </div>
        )}

        <div className="ed-act" style={{ marginTop: 24 }}>
          <button type="button" className="btn btn-sec" onClick={() => router.back()}>Retour</button>
        </div>
      </div>
    </Shell>
  );
}
