"use client";

import Link from "next/link";
import { useState } from "react";

export default function NewTeamMember() {
  const [formData, setFormData] = useState({ name: "", email: "", role: "Employé" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("/api/entreprise/equipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!response.ok) throw new Error("Erreur");
      window.location.href = "/entreprise/equipe";
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "600px" }}>
      <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
        <Link href="/entreprise/equipe">
          <a style={{ color: "#0052cc", textDecoration: "none", fontWeight: "500" }}>← Retour</a>
        </Link>
      </div>

      <h1 style={{ marginBottom: "32px" }}>Ajouter un membre</h1>

      {error && <div style={{ backgroundColor: "#fee", color: "red", padding: "12px", marginBottom: "16px" }}>{error}</div>}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontWeight: "600", marginBottom: "8px" }}>Nom</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #e0e6ed",
              borderRadius: "4px",
              fontSize: "14px",
            }}
            required
          />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontWeight: "600", marginBottom: "8px" }}>Email</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #e0e6ed",
              borderRadius: "4px",
              fontSize: "14px",
            }}
            required
          />
        </div>

        <div style={{ marginBottom: "24px" }}>
          <label style={{ display: "block", fontWeight: "600", marginBottom: "8px" }}>Rôle</label>
          <select
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #e0e6ed",
              borderRadius: "4px",
              fontSize: "14px",
            }}
          >
            <option>Employé</option>
            <option>Manager</option>
            <option>Admin</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            backgroundColor: "#0052cc",
            color: "white",
            padding: "10px 16px",
            border: "none",
            borderRadius: "4px",
            fontWeight: "500",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Ajout..." : "Ajouter"}
        </button>
      </form>
    </div>
  );
}
