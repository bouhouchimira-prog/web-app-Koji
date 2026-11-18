"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Devis list page — all quotes sent/received.
export default function EntrepriseDevisList() {
  const router = useRouter();
  const [devis, setDevis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all"); // all, pending, signed

  useEffect(() => {
    loadDevis();
  }, [filter]);

  const loadDevis = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/entreprise/devis?filter=${filter}`);
      if (!response.ok) {
        if (response.status === 401) router.push("/login");
        throw new Error("Impossible de charger les devis");
      }
      const data = await response.json();
      setDevis(data.devis || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const statusLabel = (status) => {
    const labels = {
      pending: "En attente",
      signed: "Signé",
      expired: "Expiré",
      rejected: "Rejeté",
    };
    return labels[status] || status;
  };

  const statusColor = (status) => {
    const colors = {
      pending: "#ff8c42",
      signed: "#2ecc71",
      expired: "#95a5a6",
      rejected: "#e74c3c",
    };
    return colors[status] || "#4a5568";
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
        <h1>Devis</h1>
        <Link href="/entreprise/devis-ia/new">
          <a
            style={{
              backgroundColor: "#0052cc",
              color: "white",
              padding: "10px 16px",
              borderRadius: "4px",
              textDecoration: "none",
              fontWeight: "500",
              fontSize: "14px",
            }}
          >
            + Créer un devis
          </a>
        </Link>
      </div>

      {/* Filters */}
      <div style={{ marginBottom: "24px", display: "flex", gap: "8px" }}>
        {[
          { label: "Tous", value: "all" },
          { label: "En attente", value: "pending" },
          { label: "Signés", value: "signed" },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            style={{
              padding: "8px 12px",
              backgroundColor: filter === f.value ? "#0052cc" : "#f5f7fa",
              color: filter === f.value ? "white" : "#4a5568",
              border: "1px solid #e0e6ed",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "500",
              fontSize: "14px",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ backgroundColor: "#fee", color: "red", padding: "12px", marginBottom: "16px", borderRadius: "4px" }}>
          {error}
        </div>
      )}

      {loading && <div style={{ textAlign: "center", color: "#718096" }}>Chargement…</div>}

      {!loading && devis.length === 0 && (
        <div
          style={{
            backgroundColor: "#fff",
            padding: "40px",
            textAlign: "center",
            borderRadius: "8px",
            color: "#718096",
          }}
        >
          Aucun devis
        </div>
      )}

      {!loading && devis.length > 0 && (
        <div style={{ backgroundColor: "#fff", borderRadius: "8px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#f5f7fa", borderBottom: "1px solid #e0e6ed" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", fontSize: "14px" }}>
                  Client
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", fontSize: "14px" }}>
                  Montant
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", fontSize: "14px" }}>
                  Statut
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", fontSize: "14px" }}>
                  Date
                </th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "600", fontSize: "14px" }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {devis.map((d) => (
                <tr key={d.id} style={{ borderBottom: "1px solid #e0e6ed" }}>
                  <td style={{ padding: "12px 16px", fontSize: "14px" }}>{d.clientName || "—"}</td>
                  <td style={{ padding: "12px 16px", fontSize: "14px", fontWeight: "600" }}>
                    {d.amount ? `${d.amount.toLocaleString("fr-FR")} €` : "—"}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: "14px" }}>
                    <span
                      style={{
                        backgroundColor: statusColor(d.status),
                        color: "white",
                        padding: "4px 8px",
                        borderRadius: "3px",
                        fontSize: "12px",
                        fontWeight: "500",
                      }}
                    >
                      {statusLabel(d.status)}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: "14px", color: "#718096" }}>
                    {new Date(d.createdAt).toLocaleDateString("fr-FR")}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    <Link href={`/entreprise/devis/${d.id}`}>
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
