"use client";

import { useRouter, useParams } from "next/navigation";
import { useState } from "react";
import { Shell } from "../../../../components/Shell";

export default function ReservesPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id;
  const [reserves, setReserves] = useState([
    { id: 1, code: "R001", description: "Fissure dans le mur façade", priority: "Majeure", status: "Ouvert" },
    { id: 2, code: "R002", description: "Joints de carrelage défectueux", priority: "Mineure", status: "Ouvert" }
  ]);
  const [newReserve, setNewReserve] = useState({ description: "", priority: "Mineure" });

  return (
    <Shell>
      <div className="head">
        <div className="stack">
          <button type="button" className="link" onClick={() => router.back()}>← Retour</button>
          <span className="eyebrow">Fiche chantier</span>
          <h1>Réserves</h1>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h2>Liste des réserves</h2>
        </div>

        {reserves.length > 0 ? (
          <div className="tbl">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Description</th>
                  <th>Priorité</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reserves.map((reserve) => (
                  <tr key={reserve.id}>
                    <td className="sm">{reserve.code}</td>
                    <td>{reserve.description}</td>
                    <td><span className="tag tag-o">{reserve.priority}</span></td>
                    <td>{reserve.status}</td>
                    <td><a href="#" className="link">Éditer</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">Aucune réserve pour le moment.</p>
        )}

        <div style={{ marginTop: 24, borderTop: "1px solid var(--line)", paddingTop: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Ajouter une réserve</h3>
          <div className="fgrid">
            <label className="full">
              <span>Description de la réserve</span>
              <textarea
                rows={3}
                value={newReserve.description}
                onChange={(e) => setNewReserve({ ...newReserve, description: e.target.value })}
                placeholder="Décrivez le problème constaté..."
              />
            </label>
            <label>
              <span>Priorité</span>
              <select value={newReserve.priority} onChange={(e) => setNewReserve({ ...newReserve, priority: e.target.value })}>
                <option>Mineure</option>
                <option>Majeure</option>
                <option>Critique</option>
              </select>
            </label>
          </div>
        </div>

        <div className="ed-act" style={{ marginTop: 24 }}>
          <button type="button" className="btn btn-sec" onClick={() => router.back()}>Annuler</button>
          <button type="button" className="btn btn-main">Enregistrer</button>
        </div>
      </div>
    </Shell>
  );
}
