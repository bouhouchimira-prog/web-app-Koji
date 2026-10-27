"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { resolveEntreprise, loadEntrepriseProfile } from "../../../lib/entreprise-auth";

// Entreprise profile page — edit business info (raison sociale, SIRET, address, etc.)
export default function EntrepriseProfil() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    raisonSociale: "",
    siret: "",
    address: "",
    phone: "",
    website: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/entreprise/profile");
      if (!response.ok) {
        if (response.status === 401) router.push("/login");
        throw new Error("Impossible de charger le profil");
      }
      const data = await response.json();
      setProfile(data);
      setFormData({
        name: data.name || "",
        email: data.email || "",
        raisonSociale: data.raisonSociale || "",
        siret: data.siret || "",
        address: data.address || "",
        phone: data.phone || "",
        website: data.website || "",
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      const response = await fetch("/api/entreprise/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!response.ok) throw new Error("Impossible de sauvegarder");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      await loadProfile();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Chargement…</div>;

  return (
    <div>
      <h1 style={{ marginBottom: "32px" }}>Profil entreprise</h1>

      {error && <div style={{ backgroundColor: "#fee", color: "red", padding: "12px", marginBottom: "16px" }}>{error}</div>}
      {success && (
        <div style={{ backgroundColor: "#efe", color: "green", padding: "12px", marginBottom: "16px" }}>Profil sauvegardé ✓</div>
      )}

      <form onSubmit={handleSave} style={{ maxWidth: "600px", backgroundColor: "#fff", padding: "24px", borderRadius: "8px" }}>
        {/* Name */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "14px", fontWeight: "500", marginBottom: "6px" }}>Nom</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            disabled
            style={{
              width: "100%",
              padding: "10px",
              border: "1px solid #e0e6ed",
              borderRadius: "4px",
              fontSize: "14px",
              backgroundColor: "#f9fafc",
            }}
          />
        </div>

        {/* Email */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "14px", fontWeight: "500", marginBottom: "6px" }}>Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            disabled
            style={{
              width: "100%",
              padding: "10px",
              border: "1px solid #e0e6ed",
              borderRadius: "4px",
              fontSize: "14px",
              backgroundColor: "#f9fafc",
            }}
          />
        </div>

        {/* Raison Sociale */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "14px", fontWeight: "500", marginBottom: "6px" }}>Raison sociale</label>
          <input
            type="text"
            name="raisonSociale"
            value={formData.raisonSociale}
            onChange={handleChange}
            style={{
              width: "100%",
              padding: "10px",
              border: "1px solid #e0e6ed",
              borderRadius: "4px",
              fontSize: "14px",
            }}
          />
        </div>

        {/* SIRET */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "14px", fontWeight: "500", marginBottom: "6px" }}>SIRET</label>
          <input
            type="text"
            name="siret"
            value={formData.siret}
            onChange={handleChange}
            placeholder="14 chiffres"
            style={{
              width: "100%",
              padding: "10px",
              border: "1px solid #e0e6ed",
              borderRadius: "4px",
              fontSize: "14px",
            }}
          />
        </div>

        {/* Address */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "14px", fontWeight: "500", marginBottom: "6px" }}>Adresse</label>
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleChange}
            style={{
              width: "100%",
              padding: "10px",
              border: "1px solid #e0e6ed",
              borderRadius: "4px",
              fontSize: "14px",
            }}
          />
        </div>

        {/* Phone */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "14px", fontWeight: "500", marginBottom: "6px" }}>Téléphone</label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            style={{
              width: "100%",
              padding: "10px",
              border: "1px solid #e0e6ed",
              borderRadius: "4px",
              fontSize: "14px",
            }}
          />
        </div>

        {/* Website */}
        <div style={{ marginBottom: "24px" }}>
          <label style={{ display: "block", fontSize: "14px", fontWeight: "500", marginBottom: "6px" }}>Site web</label>
          <input
            type="url"
            name="website"
            value={formData.website}
            onChange={handleChange}
            style={{
              width: "100%",
              padding: "10px",
              border: "1px solid #e0e6ed",
              borderRadius: "4px",
              fontSize: "14px",
            }}
          />
        </div>

        {/* Save button */}
        <button
          type="submit"
          disabled={saving}
          style={{
            backgroundColor: "#0052cc",
            color: "white",
            padding: "10px 16px",
            border: "none",
            borderRadius: "4px",
            cursor: saving ? "not-allowed" : "pointer",
            fontWeight: "500",
            fontSize: "14px",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Sauvegarde..." : "Sauvegarder"}
        </button>
      </form>
    </div>
  );
}
