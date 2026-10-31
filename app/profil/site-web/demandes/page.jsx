"use client";
import { useRouter } from "next/navigation";
import { Shell } from "../../../../components/Shell";

export default function DemandesPage() {
  const router = useRouter();
  const requests = [
    { id: 1, client: "Dupont", project: "Salle de bain", date: "2026-10-28", status: "Nouvelle" },
    { id: 2, client: "Martin", project: "Cuisine", date: "2026-10-25", status: "Lue" },
    { id: 3, client: "Moreau", project: "Terrasse", date: "2026-10-20", status: "Répondue" }
  ];

  return (
    <Shell>
      <div className="head">
        <button className="link" onClick={() => router.back()}>← Retour</button>
        <h1>Demandes via KojiPage</h1>
      </div>

      <div className="kpis">
        <div>
          <div className="l">Nouvelles demandes</div>
          <div className="v">{requests.filter(r => r.status === "Nouvelle").length}</div>
          <div className="s">À lire</div>
        </div>
        <div>
          <div className="l">Total ce mois</div>
          <div className="v">{requests.length}</div>
          <div className="s">Reçues</div>
        </div>
        <div>
          <div className="l">Taux de réponse</div>
          <div className="v">67%</div>
          <div className="s">Moyen</div>
        </div>
        <div>
          <div className="l">Temps de réponse</div>
          <div className="v">4h</div>
          <div className="s">Moyen</div>
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h2>Demandes</h2></div>
        <div className="mlist">
          {requests.map((r) => (
            <div key={r.id} className="m-card">
              <div className="top2">
                <div>
                  <div className="nm">{r.client}</div>
                  <div className="meta">{r.project} · {new Date(r.date).toLocaleDateString("fr-FR")}</div>
                </div>
                <span className={`tag ${r.status === "Nouvelle" ? "tag-b" : "tag-o"}`}>{r.status}</span>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <a href="#" className="link" style={{ fontSize: 12 }}>Voir</a>
                <a href="#" className="link" style={{ fontSize: 12 }}>Répondre</a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}
