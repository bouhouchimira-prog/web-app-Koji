"use client";

import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Shell } from "../../../components/Shell";

export default function EquipePage() {
  const router = useRouter();
  const params = useParams();
  const teamId = params.id;

  const team = [
    { id: 1, name: "Jean Dupont", role: "Compagnon carreleur", status: "Actif", hours: 160, projects: 8 },
    { id: 2, name: "Marie Laurent", role: "Aide carreleur", status: "Actif", hours: 140, projects: 6 },
    { id: 3, name: "Pierre Moreau", role: "Compagnon électricien", status: "Congé", hours: 80, projects: 4 }
  ];

  const submenu = [
    { label: "Ajouter un compagnon", href: `ajouter`, icon: "➕" },
    { label: "Heures et planning", href: `heures`, icon: "⏱️" }
  ];

  return (
    <Shell>
      <div className="head">
        <div className="stack">
          <button type="button" className="link" onClick={() => router.back()}>← Retour</button>
          <span className="eyebrow">Équipe</span>
          <h1>Gestion de l'équipe</h1>
        </div>
        <div className="hact">
          <a className="btn btn-main">+ Ajouter</a>
        </div>
      </div>

      <div className="kpis">
        <div>
          <div className="l">Membres</div>
          <div className="v">{team.length}</div>
          <div className="s">Actifs</div>
        </div>
        <div>
          <div className="l">Heures cumulées</div>
          <div className="v">{team.reduce((s, m) => s + m.hours, 0)}</div>
          <div className="s">Ce mois</div>
        </div>
        <div>
          <div className="l">Chantiers couverts</div>
          <div className="v">{team.reduce((s, m) => s + m.projects, 0)}</div>
          <div className="s">Actifs</div>
        </div>
        <div>
          <div className="l">Disponibilité</div>
          <div className="v">{Math.round((team.filter(m => m.status === "Actif").length / team.length) * 100)}%</div>
          <div className="s">Moyenne</div>
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h2>Membres de l'équipe</h2></div>
        <div className="mlist">
          {team.map((m) => (
            <Link key={m.id} href={`fiche`} className="m-card" style={{ textDecoration: "none", cursor: "pointer" }}>
              <div className="top2">
                <div>
                  <div className="nm">{m.name}</div>
                  <div className="meta">{m.role}</div>
                </div>
                <span className={`tag ${m.status === "Actif" ? "tag-b" : "tag-o"}`}>{m.status}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--grey)", marginTop: 8 }}>{m.hours}h · {m.projects} chantiers</div>
            </Link>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h2>Actions rapides</h2></div>
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
