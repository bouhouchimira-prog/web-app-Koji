"use client";

import { useRouter, useParams } from "next/navigation";
import { useState } from "react";
import { Shell } from "../../../../components/Shell";

export default function DossierFinPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id;
  const [documents, setDocuments] = useState([
    { id: 1, name: "Facture finale", type: "PDF", date: "2026-10-31", status: "Généré" },
    { id: 2, name: "PV de réception", type: "PDF", date: "2026-10-30", status: "Signé" },
    { id: 3, name: "Attestation de fin", type: "PDF", date: "2026-10-31", status: "Généré" }
  ]);

  return (
    <Shell>
      <div className="head">
        <div className="stack">
          <button type="button" className="link" onClick={() => router.back()}>← Retour</button>
          <span className="eyebrow">Fiche chantier</span>
          <h1>Dossier de fin de chantier</h1>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h2>Documents générés</h2>
        </div>

        {documents.length > 0 ? (
          <div className="mlist">
            {documents.map((doc) => (
              <div key={doc.id} className="m-card">
                <div className="top2">
                  <div>
                    <div className="nm">{doc.name}</div>
                    <div className="meta">{doc.type} · {new Date(doc.date).toLocaleDateString("fr-FR")}</div>
                  </div>
                  <span className="tag" style={{ fontSize: 11 }}>{doc.status}</span>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <a href="#" className="link" style={{ fontSize: 12 }}>Télécharger</a>
                  <a href="#" className="link" style={{ fontSize: 12 }}>Partager</a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty">Aucun document généré pour le moment.</p>
        )}
      </div>

      <div className="card">
        <div className="card-h">
          <h2>Archivage</h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ padding: "16px", background: "#F5F5F2", borderRadius: 4 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500, marginBottom: 12 }}>Exporter le dossier complet</p>
            <p style={{ margin: 0, fontSize: 12, color: "var(--grey)", marginBottom: 12 }}>Génère un fichier ZIP contenant tous les documents du chantier.</p>
            <button type="button" className="btn btn-sec" style={{ fontSize: 13 }}>
              ⬇ Exporter en ZIP
            </button>
          </div>

          <div style={{ padding: "16px", background: "#F5F5F2", borderRadius: 4 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500, marginBottom: 12 }}>Archiver le chantier</p>
            <p style={{ margin: 0, fontSize: 12, color: "var(--grey)", marginBottom: 12 }}>Une fois archivé, le chantier sera déplacé dans les archives.</p>
            <button type="button" className="btn btn-sec" style={{ fontSize: 13 }}>
              📦 Archiver
            </button>
          </div>
        </div>
      </div>
    </Shell>
  );
}
