"use client";

import { useEffect, useState } from "react";

// Notifications page
export default function EntrepriseNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const response = await fetch("/api/entreprise/notifications");
      if (!response.ok) throw new Error("Erreur");
      const data = await response.json();
      setNotifications(data.notifications || []);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (notificationId) => {
    try {
      await fetch(`/api/entreprise/notifications?id=${notificationId}`, { method: "PATCH" });
      loadNotifications();
    } catch {
      // ignore
    }
  };

  return (
    <div>
      <h1 style={{ marginBottom: "32px" }}>Notifications</h1>

      {loading && <div>Chargement…</div>}

      {!loading && notifications.length === 0 && (
        <div style={{ backgroundColor: "#fff", padding: "40px", textAlign: "center", borderRadius: "8px", color: "#718096" }}>
          Aucune notification
        </div>
      )}

      {!loading && notifications.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {notifications.map((n) => (
            <div
              key={n.id}
              style={{
                backgroundColor: "#fff",
                border: "1px solid #e0e6ed",
                borderRadius: "8px",
                padding: "16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h3 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "600" }}>{n.title}</h3>
                <p style={{ margin: 0, color: "#718096", fontSize: "13px" }}>{n.message}</p>
              </div>
              {!n.read && (
                <button
                  onClick={() => handleMarkRead(n.id)}
                  style={{
                    backgroundColor: "#f5f7fa",
                    border: "1px solid #e0e6ed",
                    padding: "6px 12px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: "500",
                  }}
                >
                  Marquer lu
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
