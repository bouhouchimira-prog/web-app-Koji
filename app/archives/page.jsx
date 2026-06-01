"use client";

import { Shell } from "../../components/Shell";
import { useApi } from "../../lib/use-api";

export default function ArchivesPage() {
  const { data: projects } = useApi("/api/projects", "projects");
  const { data: quotes } = useApi("/api/quotes", "quotes");
  const archivedProjects = projects.filter((item) => item.status === "Archive");
  const archivedQuotes = quotes.filter((item) => item.status === "Archive");

  return (
    <Shell>
      <header className="page-header">
        <div>
          <p className="eyebrow">ARCHIVES</p>
          <h1>Historique archive</h1>
          <p className="muted">Chantiers et devis clotures.</p>
        </div>
      </header>

      <section className="grid cols-2">
        <div className="metric"><span>Chantiers archives</span><strong>{archivedProjects.length}</strong></div>
        <div className="metric"><span>Devis archives</span><strong>{archivedQuotes.length}</strong></div>
      </section>

      <section className="panel" style={{ marginTop: 22 }}>
        <h2>Contenu</h2>
        <div className="empty-state">Aucune archive pour le moment.</div>
      </section>
    </Shell>
  );
}
