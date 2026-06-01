"use client";

import { Shell } from "../../components/Shell";
import { useApi } from "../../lib/use-api";

export default function TeamPage() {
  const { data: workers } = useApi("/api/workers", "workers");

  return (
    <Shell>
      <header className="page-header">
        <div>
          <p className="eyebrow">ÉQUIPE</p>
          <h1>Ressources et pointage</h1>
          <p className="muted">Suivez les rôles, disponibilités et heures par personne.</p>
        </div>
        <button className="button blue">+ Ajouter un contact</button>
      </header>

      <section className="table-card">
        <table className="data-table">
          <thead><tr><th>Nom</th><th>Rôle</th><th>Disponibilité</th><th>Heures</th></tr></thead>
          <tbody>
            {workers.map((worker) => (
              <tr key={worker.id}>
                <td><strong>{worker.name}</strong></td>
                <td>{worker.role}</td>
                <td><span className="status green">{worker.availability}</span></td>
                <td>{worker.hours} h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </Shell>
  );
}
