"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shell } from "../../components/Shell";

export default function UrgencesPage() {
  const router = useRouter();
  const [requests, setRequests] = useState([
    { id: 1, client: "Dupont", issue: "Fuite robinetterie", severity: "Élevée", time: "2h ago" },
    { id: 2, client: "Martin", issue: "Carrelage craqué", severity: "Moyenne", time: "4h ago" },
    { id: 3, client: "Moreau", issue: "Électricité coupée", severity: "Critique", time: "6h ago" }
  ]);

  return (
    <Shell>
      <div className="head">
        <div className="stack">
          <span className="eyebrow">Support</span>
          <h1>Interventions d'urgence</h1>
        </div>
        <div className="hact">
          <a href="intervention-rapide" className="btn btn-main">⚡ Intervention rapide</a>
        </div>
      </div>

      <div className="kpis">
        <div>
          <div className="l">Demandes urgentes</div>
          <div className="v">{requests.length}</div>
          <div className="s">En attente</div>
        </div>
        <div>
          <div className="l">Temps moyen réponse</div>
          <div className="v">45min</div>
          <div className="s">Cibles</div>
        </div>
        <div>
          <div className="l">Taux de satisfaction</div>
          <div className="v">94%</div>
          <div className="s">Clients</div>
        </div>
        <div>
          <div className="l">Interventions ce mois</div>
          <div className="v">12</div>
          <div className="s">Réalisées</div>
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h2>Demandes en cours</h2></div>
        <div className="mlist">
          {requests.map((r) => (
            <div key={r.id} className="m-card">
              <div className="top2">
                <div>
                  <div className="nm">{r.client}</div>
                  <div className="meta">{r.issue}</div>
                </div>
                <span className={`tag ${r.severity === "Critique" ? "tag-b" : "tag-o"}`}>{r.severity}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--grey)", marginTop: 8 }}>{r.time}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <a href="#" className="link" style={{ fontSize: 12 }}>Appeler</a>
                <a href="#" className="link" style={{ fontSize: 12 }}>Accepter</a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}
