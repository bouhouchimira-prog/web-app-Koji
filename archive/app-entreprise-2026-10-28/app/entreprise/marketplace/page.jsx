"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Marketplace — publish projects (Radar des Chantiers entreprise)
export default function EntrepriseMarketplace() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const response = await fetch("/api/entreprise/marketplace");
      if (!response.ok) throw new Error("Erreur");
      const data = await response.json();
      setProjects(data.projects || []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
        <h1>Mes projets publiés</h1>
        <Link href="/entreprise/marketplace/new">
          <a style={{ backgroundColor: "#0052cc", color: "white", padding: "10px 16px", borderRadius: "4px", textDecoration: "none", fontWeight: "500" }}>
            + Publier un projet
          </a>
        </Link>
      </div>

      {loading && <div>Chargement…</div>}

      {!loading && projects.length === 0 && (
        <div style={{ backgroundColor: "#fff", padding: "40px", textAlign: "center", borderRadius: "8px", color: "#718096" }}>
          Aucun projet publié
        </div>
      )}

      {!loading && projects.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
          {projects.map((p) => (
            <Link key={p.id} href={`/entreprise/marketplace/${p.id}`}>
              <a style={{ backgroundColor: "#fff", border: "1px solid #e0e6ed", borderRadius: "8px", padding: "16px", textDecoration: "none", color: "inherit" }}>
                <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: "600" }}>{p.title}</h3>
                <p style={{ margin: "0 0 8px 0", color: "#718096", fontSize: "14px" }}>{p.description}</p>
                <span style={{ display: "inline-block", backgroundColor: "#f5f7fa", padding: "4px 8px", borderRadius: "3px", fontSize: "12px", fontWeight: "500" }}>
                  {p.status}
                </span>
              </a>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
