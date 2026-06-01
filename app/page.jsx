"use client";

import Link from "next/link";
import { Shell } from "../components/Shell";
import { euro, shortDate } from "../lib/pricing";
import { useApi } from "../lib/use-api";

export default function HomePage() {
  const { data: projects } = useApi("/api/projects", "projects");
  const { data: quotes } = useApi("/api/quotes", "quotes");
  const { data: tasks } = useApi("/api/tasks", "tasks");

  const activeProjects = projects.filter((project) => project.status !== "Termine");
  const pendingQuotes = quotes.filter((quote) => quote.status === "Brouillon" || quote.status === "Envoye");
  const signedRevenue = quotes.filter((quote) => quote.status === "Signe").reduce((sum, quote) => sum + quote.totalTtc, 0);
  const pendingRevenue = pendingQuotes.reduce((sum, quote) => sum + quote.totalTtc, 0);

  return (
    <Shell>
      <header className="page-header">
        <div>
          <p className="eyebrow">TABLEAU DE BORD</p>
          <h1>Pilotage des chantiers</h1>
          <p className="muted">Vue globale de l&apos;activite chantier, devis, planning et execution.</p>
        </div>
        <div className="actions">
          <Link className="button blue" href="/chantier/new">Nouveau chantier</Link>
          <Link className="button secondary" href="/devis">Nouveau devis</Link>
        </div>
      </header>

      <section className="grid cols-4">
        <div className="metric"><span>Chantiers actifs</span><strong>{activeProjects.length}</strong></div>
        <div className="metric"><span>Devis en cours</span><strong>{pendingQuotes.length}</strong></div>
        <div className="metric"><span>Facture</span><strong>{euro(signedRevenue)}</strong></div>
        <div className="metric"><span>A signer</span><strong>{euro(pendingRevenue)}</strong></div>
      </section>

      <section className="grid cols-2" style={{ marginTop: 22 }}>
        <div className="panel">
          <h2>A faire maintenant</h2>
          {tasks.length === 0 ? (
            <div className="empty-state">Aucune tache pour le moment.</div>
          ) : (
            tasks.slice(0, 4).map((task) => (
              <article className="task-card" key={task.id}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <strong>{task.label}</strong>
                  <span className="status red">A traiter</span>
                </div>
                <p className="muted" style={{ margin: "8px 0 0" }}>{task.project} - {task.room} - {shortDate(task.dueDate)}</p>
              </article>
            ))
          )}
        </div>

        <div className="panel">
          <h2>Devis recents</h2>
          {quotes.length === 0 ? (
            <div className="empty-state">Aucun devis pour le moment.</div>
          ) : (
            <div className="table-card" style={{ boxShadow: "none" }}>
              <table className="data-table">
                <tbody>
                  {quotes.slice(0, 4).map((quote) => (
                    <tr key={quote.id}>
                      <td><strong>{quote.client}</strong><br /><span className="muted">{quote.quoteNumber}</span></td>
                      <td>{euro(quote.totalTtc)}</td>
                      <td><span className="status">{quote.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="panel" style={{ marginTop: 22 }}>
        <h2>Chantiers</h2>
        {projects.length === 0 ? (
          <div className="empty-state">Aucun chantier cree pour le moment.</div>
        ) : (
          <div className="table-card" style={{ boxShadow: "none" }}>
            <table className="data-table">
              <thead>
                <tr><th>Reference</th><th>Client</th><th>Adresse</th><th>Progression</th><th>Budget</th></tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id}>
                    <td><strong>{project.title}</strong><br /><span className="muted">{project.reference}</span></td>
                    <td>{project.client}</td>
                    <td>{project.address}</td>
                    <td><div className="progress"><span style={{ width: `${project.progress}%` }} /></div></td>
                    <td>{euro(project.budgetHt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </Shell>
  );
}
