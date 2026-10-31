"use client";

import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Shell } from "../../../components/Shell";

export default function FournituresPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id;

  const project = {
    id: projectId,
    name: "Rénovation salle de bain",
    supplier: "Matériaux Pro",
    totalOrdered: 3500,
    totalReceived: 2100,
    pending: 1400
  };

  const submenu = [
    { label: "Fournitures du chantier", href: `chantier`, icon: "📦" },
    { label: "Ajouter une fourniture", href: `ajouter`, icon: "➕" },
    { label: "Partenaires Koji", href: `partenaires`, icon: "🤝" },
    { label: "Stock", href: `stock`, icon: "📊" },
    { label: "Réception des livraisons", href: `reception`, icon: "🚚" }
  ];

  return (
    <Shell>
      <div className="head">
        <div className="stack">
          <button type="button" className="link" onClick={() => router.back()}>← Retour</button>
          <span className="eyebrow">Fournitures</span>
          <h1>{project.name}</h1>
        </div>
      </div>

      <div className="kpis">
        <div>
          <div className="l">Commandé</div>
          <div className="v">{project.totalOrdered}€</div>
          <div className="s">Montant total</div>
        </div>
        <div>
          <div className="l">Reçu</div>
          <div className="v">{project.totalReceived}€</div>
          <div className="s">{Math.round((project.totalReceived / project.totalOrdered) * 100)}%</div>
        </div>
        <div>
          <div className="l">En attente</div>
          <div className="v">{project.pending}€</div>
          <div className="s">À livrer</div>
        </div>
        <div>
          <div className="l">Fournisseur</div>
          <div className="v" style={{ fontSize: 15 }}>{project.supplier}</div>
          <div className="s">Principal</div>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h2>Gestion des fournitures</h2>
        </div>
        <div className="mlist">
          {submenu.map((item) => (
            <Link key={item.href} href={item.href} className="m-card" style={{ textDecoration: "none" }}>
              <div className="top2">
                <div className="nm" style={{ fontSize: 15 }}>{item.icon} {item.label}</div>
                <span style={{ color: "var(--grey)", fontSize: 18 }}>→</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Shell>
  );
}
