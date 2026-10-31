"use client";
import { useRouter } from "next/navigation";
import { Shell } from "../../../components/Shell";

export default function PlanifierPage() {
  const router = useRouter();

  return (
    <Shell>
      <div className="head">
        <button className="link" onClick={() => router.back()}>← Retour</button>
        <h1>Planifier les tâches</h1>
      </div>

      <div className="card">
        <div className="card-h"><h2>Attribution des compagnons</h2></div>
        <div style={{ padding: "24px", textAlign: "center", color: "var(--grey)" }}>
          <p>Sélectionnez les tâches et assignez-les à des compagnons</p>
          <button className="btn btn-main" style={{ marginTop: 16 }}>+ Ajouter une tâche</button>
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h2>Tâches à planifier</h2></div>
        <p className="empty">Aucune tâche en attente.</p>
      </div>
    </Shell>
  );
}
