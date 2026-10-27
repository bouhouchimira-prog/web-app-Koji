"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Entreprise settings page — notifications, theme, danger zone (delete account, logout).
export default function EntrepriseParametres() {
  const router = useRouter();
  const [theme, setTheme] = useState("light");
  const [notifyNewDevis, setNotifyNewDevis] = useState(true);
  const [notifyMessages, setNotifyMessages] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("koji-user");
    localStorage.removeItem("supabase.auth.token");
    router.push("/login");
  };

  const handleDeleteAccount = async () => {
    if (!confirm("Êtes-vous sûr ? Cette action ne peut pas être annulée.")) return;
    try {
      setDeleting(true);
      const response = await fetch("/api/account/deletion-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Demande de suppression de compte entreprise" }),
      });
      if (!response.ok) throw new Error("Erreur lors de la suppression");
      alert("Votre demande de suppression a été enregistrée.");
      handleLogout();
    } catch (err) {
      alert("Erreur: " + err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <h1 style={{ marginBottom: "32px" }}>Paramètres</h1>

      {/* Theme */}
      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "16px" }}>Apparence</h2>
        <div style={{ backgroundColor: "#fff", padding: "16px", borderRadius: "8px", maxWidth: "400px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
            <input
              type="radio"
              name="theme"
              value="light"
              checked={theme === "light"}
              onChange={(e) => setTheme(e.target.value)}
            />
            <span>Mode clair</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", marginTop: "8px" }}>
            <input
              type="radio"
              name="theme"
              value="dark"
              checked={theme === "dark"}
              onChange={(e) => setTheme(e.target.value)}
            />
            <span>Mode sombre</span>
          </label>
        </div>
      </section>

      {/* Notifications */}
      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "16px" }}>Notifications</h2>
        <div style={{ backgroundColor: "#fff", padding: "16px", borderRadius: "8px", maxWidth: "400px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={notifyNewDevis}
              onChange={(e) => setNotifyNewDevis(e.target.checked)}
            />
            <span>Nouveaux devis</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", marginTop: "8px" }}>
            <input
              type="checkbox"
              checked={notifyMessages}
              onChange={(e) => setNotifyMessages(e.target.checked)}
            />
            <span>Nouveaux messages</span>
          </label>
        </div>
      </section>

      {/* Account */}
      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "16px" }}>Compte</h2>
        <div style={{ backgroundColor: "#fff", padding: "16px", borderRadius: "8px", maxWidth: "400px" }}>
          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              backgroundColor: "#f5f7fa",
              border: "1px solid #e0e6ed",
              padding: "10px 16px",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "500",
              fontSize: "14px",
              marginBottom: "8px",
            }}
          >
            Déconnexion
          </button>
          <a
            href="/entreprise/parametres/abonnement"
            style={{
              display: "block",
              width: "100%",
              backgroundColor: "#f5f7fa",
              border: "1px solid #e0e6ed",
              padding: "10px 16px",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "500",
              fontSize: "14px",
              textDecoration: "none",
              textAlign: "center",
              marginBottom: "8px",
            }}
          >
            Abonnement
          </a>
        </div>
      </section>

      {/* Danger zone */}
      <section style={{ borderTop: "1px solid #e0e6ed", paddingTop: "32px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "16px", color: "#e63946" }}>Zone dangereuse</h2>
        <div
          style={{
            backgroundColor: "#fff",
            padding: "16px",
            borderRadius: "8px",
            maxWidth: "400px",
            border: "1px solid #fcc",
          }}
        >
          <p style={{ fontSize: "14px", marginBottom: "12px", color: "#718096" }}>
            Supprimer votre compte et toutes les données associées. Cette action ne peut pas être annulée.
          </p>
          <button
            onClick={handleDeleteAccount}
            disabled={deleting}
            style={{
              width: "100%",
              backgroundColor: "#e63946",
              color: "white",
              border: "none",
              padding: "10px 16px",
              borderRadius: "4px",
              cursor: deleting ? "not-allowed" : "pointer",
              fontWeight: "500",
              fontSize: "14px",
              opacity: deleting ? 0.6 : 1,
            }}
          >
            {deleting ? "Suppression..." : "Supprimer mon compte"}
          </button>
        </div>
      </section>
    </div>
  );
}
