"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Team members list
export default function EntrepriseEquipe() {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadTeam();
  }, []);

  const loadTeam = async () => {
    try {
      const response = await fetch("/api/entreprise/equipe");
      if (!response.ok) throw new Error("Erreur");
      const data = await response.json();
      setTeam(data.members || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
        <h1>Équipe</h1>
        <Link href="/entreprise/equipe/new">
          <a style={{ backgroundColor: "#0052cc", color: "white", padding: "10px 16px", borderRadius: "4px", textDecoration: "none", fontWeight: "500", fontSize: "14px" }}>
            + Ajouter un membre
          </a>
        </Link>
      </div>

      {error && <div style={{ backgroundColor: "#fee", color: "red", padding: "12px", marginBottom: "16px" }}>{error}</div>}

      {loading && <div>Chargement…</div>}

      {!loading && team.length === 0 && (
        <div style={{ backgroundColor: "#fff", padding: "40px", textAlign: "center", borderRadius: "8px", color: "#718096" }}>
          Aucun membre
        </div>
      )}

      {!loading && team.length > 0 && (
        <div style={{ backgroundColor: "#fff", borderRadius: "8px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#f5f7fa", borderBottom: "1px solid #e0e6ed" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", fontSize: "14px" }}>Nom</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", fontSize: "14px" }}>Email</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", fontSize: "14px" }}>Rôle</th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "600", fontSize: "14px" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {team.map((m) => (
                <tr key={m.id} style={{ borderBottom: "1px solid #e0e6ed" }}>
                  <td style={{ padding: "12px 16px", fontSize: "14px" }}>{m.name || "—"}</td>
                  <td style={{ padding: "12px 16px", fontSize: "14px" }}>{m.email || "—"}</td>
                  <td style={{ padding: "12px 16px", fontSize: "14px" }}>{m.role || "Employé"}</td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    <Link href={`/entreprise/equipe/${m.id}`}>
                      <a style={{ color: "#0052cc", textDecoration: "none", fontWeight: "500" }}>Voir</a>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
