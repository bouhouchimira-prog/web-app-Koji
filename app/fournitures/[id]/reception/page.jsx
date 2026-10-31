"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shell } from "../../../../components/Shell";

export default function ReceptionPage() {
  const router = useRouter();
  const [deliveries, setDeliveries] = useState([
    { id: 1, date: "2026-10-25", supplier: "Matériaux Pro", items: 15, status: "Reçue" },
    { id: 2, date: "2026-11-01", supplier: "Carrelages Européens", items: 40, status: "En transit" },
    { id: 3, date: "2026-11-05", supplier: "Plomberie Direct", items: 3, status: "Programmée" }
  ]);

  return (
    <Shell>
      <div className="head">
        <button className="link" onClick={() => router.back()}>← Retour</button>
        <h1>Réception des livraisons</h1>
      </div>

      <div className="card">
        <div className="card-h"><h2>Historique des livraisons</h2></div>
        <div className="mlist">
          {deliveries.map((d) => (
            <div key={d.id} className="m-card">
              <div className="top2">
                <div>
                  <div className="nm">{d.supplier}</div>
                  <div className="meta">{d.items} articles · {new Date(d.date).toLocaleDateString("fr-FR")}</div>
                </div>
                <span className={`tag ${d.status === "Reçue" ? "tag-b" : "tag-o"}`}>{d.status}</span>
              </div>
              {d.status !== "Reçue" && (
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <a href="#" className="link" style={{ fontSize: 12 }}>📍 Suivre</a>
                  <a href="#" className="link" style={{ fontSize: 12 }}>✓ Marquer reçu</a>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}
