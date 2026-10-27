"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Clients list — all customer contacts
export default function EntrepriseClientsList() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const response = await fetch("/api/entreprise/clients");
      if (!response.ok) throw new Error("Erreur");
      const data = await response.json();
      setClients(data.clients || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
        <h1>Clients</h1>
        <Link href="/entreprise/clients/new">
          <a style={{ backgroundColor: "#0052cc", color: "white", padding: "10px 16px", borderRadius: "4px", textDecoration: "none", fontWeight: "500", fontSize: "14px" }}>
            + Ajouter un client
          </a>
        </Link>
      </div>

      {error && <div style={{ backgroundColor: "#fee", color: "red", padding: "12px", marginBottom: "16px" }}>{error}</div>}

      {loading && <div>Chargement…</div>}

      {!loading && clients.length === 0 && (
        <div style={{ backgroundColor: "#fff", padding: "40px", textAlign: "center", borderRadius: "8px", color: "#718096" }}>
          Aucun client
        </div>
      )}

      {!loading && clients.length > 0 && (
        <div style={{ backgroundColor: "#fff", borderRadius: "8px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#f5f7fa", borderBottom: "1px solid #e0e6ed" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", fontSize: "14px" }}>Nom</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", fontSize: "14px" }}>Email</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", fontSize: "14px" }}>Téléphone</th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "600", fontSize: "14px" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid #e0e6ed" }}>
                  <td style={{ padding: "12px 16px", fontSize: "14px" }}>{c.name || "—"}</td>
                  <td style={{ padding: "12px 16px", fontSize: "14px" }}>{c.email || "—"}</td>
                  <td style={{ padding: "12px 16px", fontSize: "14px" }}>{c.phone || "—"}</td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    <Link href={`/entreprise/clients/${c.id}`}>
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
