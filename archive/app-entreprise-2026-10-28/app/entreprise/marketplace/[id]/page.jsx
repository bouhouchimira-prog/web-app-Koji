"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function MarketplaceProjectDetail() {
  const params = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      loadProject();
    }
  }, [params.id]);

  const loadProject = async () => {
    try {
      // TODO: fetch from /api/entreprise/marketplace/:id
      setProject({ id: params.id, title: "Project", description: "Description", status: "Published", offers: [] });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "600px" }}>
      <Link href="/entreprise/marketplace">
        <a style={{ color: "#0052cc", textDecoration: "none", fontWeight: "500", marginBottom: "24px", display: "block" }}>
          ← Retour
        </a>
      </Link>

      {loading && <div>Chargement…</div>}

      {!loading && project && (
        <>
          <h1 style={{ marginBottom: "32px" }}>{project.title}</h1>
          <div style={{ backgroundColor: "#fff", padding: "24px", borderRadius: "8px" }}>
            <p>
              <strong>Description:</strong> {project.description}
            </p>
            <p>
              <strong>Statut:</strong> {project.status}
            </p>
            <h3 style={{ marginTop: "24px", marginBottom: "16px" }}>Offres reçues</h3>
            {project.offers.length === 0 ? <p style={{ color: "#718096" }}>Aucune offre</p> : <ul>{project.offers.map((o) => <li key={o.id}>{o.name}</li>)}</ul>}
          </div>
        </>
      )}
    </div>
  );
}
