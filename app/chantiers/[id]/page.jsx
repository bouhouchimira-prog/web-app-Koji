"use client";

import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Shell } from "../../../components/Shell";

export default function ChantierPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id;

  const project = {
    id: projectId,
    name: "Rénovation salle de bain - 123 Rue de Paris",
    status: "En cours",
    client: "Dupont",
    address: "123 Rue de Paris, 75000 Paris",
    startDate: "2026-10-01",
    endDate: "2026-11-15",
    budget: 5200,
    spent: 3800,
    ouvrageCounts: { completed: 4, inProgress: 2, pending: 1 }
  };

  const menuItems = [
    { label: "Photos avant / après", href: `photos`, icon: "📷" },
    { label: "Réserves", href: `reserves`, icon: "⚠️" },
    { label: "Réception et clôture", href: `reception`, icon: "✓" },
    { label: "Dossier de fin de chantier", href: `dossier-fin`, icon: "📦" },
    { label: "Avis et réalisation", href: `avis`, icon: "⭐" }
  ];

  return (
    <Shell>
      <div className="head">
        <div className="stack">
          <button type="button" className="link" onClick={() => router.back()}>← Retour</button>
          <span className="eyebrow">Chantiers</span>
          <h1>{project.name}</h1>
        </div>
        <div className="hact">
          <span className="tag tag-b">{project.status}</span>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpis">
        <div>
          <div className="l">Budget</div>
          <div className="v">{(project.budget / 1000).toFixed(1)}K€</div>
          <div className="s">Enveloppe globale</div>
        </div>
        <div>
          <div className="l">Dépensé</div>
          <div className="v">{(project.spent / 1000).toFixed(1)}K€</div>
          <div className="s">{Math.round((project.spent / project.budget) * 100)}% du budget</div>
        </div>
        <div>
          <div className="l">Progression</div>
          <div className="v">{project.ouvrageCounts.completed}/{project.ouvrageCounts.completed + project.ouvrageCounts.inProgress + project.ouvrageCounts.pending}</div>
          <div className="s">Lots terminés</div>
        </div>
        <div>
          <div className="l">Durée estimée</div>
          <div className="v">45 j</div>
          <div className="s">À partir du {new Date(project.startDate).toLocaleDateString("fr-FR")}</div>
        </div>
      </div>

      {/* Infos principales */}
      <div className="card">
        <div className="card-h">
          <h2>Informations du chantier</h2>
        </div>
        <div className="row">
          <svg><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2m0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8m.5-13H11v6l5.2 3.2.8-1.3-5.5-3.4z" /></svg>
          <div className="t">
            <small>Période estimée</small>
            <strong>{new Date(project.startDate).toLocaleDateString("fr-FR")} → {new Date(project.endDate).toLocaleDateString("fr-FR")}</strong>
          </div>
        </div>
        <div className="row">
          <svg><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2m0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8m3.5-9h-3V7h-1v5h-3v1h3v3h1v-3h3v-1z" /></svg>
          <div className="t">
            <small>Adresse</small>
            <strong>{project.address}</strong>
          </div>
        </div>
        <div className="row">
          <svg><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2m0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8m3.5-9h-3V7h-1v5h-3v1h3v3h1v-3h3v-1z" /></svg>
          <div className="t">
            <small>Client</small>
            <strong>{project.client}</strong>
          </div>
        </div>
      </div>

      {/* Navigation vers les sous-pages */}
      <div className="card">
        <div className="card-h">
          <h2>Gestion du chantier</h2>
        </div>
        <div className="mlist">
          {menuItems.map((item) => (
            <Link key={item.href} href={item.href} className="m-card" style={{ textDecoration: "none" }}>
              <div className="top2">
                <div>
                  <div className="nm" style={{ fontSize: 15 }}>{item.icon} {item.label}</div>
                </div>
                <span style={{ color: "var(--grey)", fontSize: 18 }}>→</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="card">
        <div className="card-h">
          <h2>Actions rapides</h2>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-sec">📝 Éditer les infos</button>
          <button type="button" className="btn btn-sec">📎 Ajouter des documents</button>
          <button type="button" className="btn btn-sec">👥 Ajouter un compagnon</button>
          <button type="button" className="btn btn-main">📦 Clôturer le chantier</button>
        </div>
      </div>
    </Shell>
  );
}
