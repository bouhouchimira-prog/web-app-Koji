"use client";

import { useRouter, useParams } from "next/navigation";
import { useState } from "react";
import { Shell } from "../../../../components/Shell";

export default function PhotosPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id;
  const [photos, setPhotos] = useState([]);
  const [uploadingPhase, setUploadingPhase] = useState(null);

  const phases = ["Avant travaux", "En cours", "Après travaux"];

  return (
    <Shell>
      <div className="head">
        <div className="stack">
          <button type="button" className="link" onClick={() => router.back()}>← Retour</button>
          <span className="eyebrow">Fiche chantier</span>
          <h1>Photos avant / après</h1>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h2>Galerie des travaux</h2>
        </div>

        {phases.map((phase) => (
          <div key={phase} style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>{phase}</h3>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: 12,
              marginBottom: 16
            }}>
              {[...Array(3)].map((_, i) => (
                <div key={i} style={{
                  aspectRatio: "1",
                  background: "#E6E6E0",
                  borderRadius: 4,
                  border: "1px dashed #CFCFC9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#8A8F98",
                  fontSize: 12,
                  cursor: "pointer"
                }}>
                  + Photo
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="ed-act" style={{ marginTop: 24 }}>
          <button type="button" className="btn btn-sec">+ Ajouter des photos</button>
          <button type="button" className="btn btn-main">Enregistrer</button>
        </div>
      </div>
    </Shell>
  );
}
