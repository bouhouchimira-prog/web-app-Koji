"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClientTopbar } from "../../../components/ClientTopbar";
import { useLocale } from "../../../lib/i18n";

function getStoredUser() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("koji-user") || "null"); } catch { return null; }
}

function formatTime(value) {
  if (!value) return "";
  const diff = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 172800) return "Hier";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value));
}

const CLIENT_TYPES = new Set(["company.reply", "task.started", "task.pending_validation"]);

const TYPE_META = {
  "company.reply":          { label: "Réponse de l'entreprise", bg: "#f0fdf4", color: "#166534", icon: "💬" },
  "task.started":           { label: "Chantier démarré",        bg: "#dbeafe", color: "#1d4ed8", icon: "🚀" },
  "task.pending_validation":{ label: "Validation requise",      bg: "#fef9c3", color: "#854d0e", icon: "✅" },
};

export default function ClientNotificationsPage() {
  const { L } = useLocale();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getStoredUser();
    setUser(stored);
    if (!stored?.id) { setLoading(false); return; }
    fetch(`/api/notifications?userId=${encodeURIComponent(stored.id)}`)
      .then((r) => r.json())
      .then((data) => setNotifications(data.notifications || []))
      .finally(() => setLoading(false));
  }, []);

  async function markRead(notif) {
    const user = getStoredUser();
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: notif.id, action: "read", userId: user?.id })
    });
    setNotifications((prev) => prev.map((n) => n.id === notif.id ? { ...n, read: true } : n));
  }

  async function markAllRead() {
    const user = getStoredUser();
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read-all", userId: user?.id })
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function deleteNotif(id) {
    const user = getStoredUser();
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "delete", userId: user?.id })
    });
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  function handleClick(notif) {
    if (!notif.read) markRead(notif);
    if (notif.quoteId) {
      router.push(`/client/chantier/${notif.quoteId}`);
    } else {
      router.push("/client");
    }
  }

  const visible = notifications
    .filter((n) => !n.archived && CLIENT_TYPES.has(n.type))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const unread = visible.filter((n) => !n.read).length;

  return (
    <main className="client-space">
      <ClientTopbar showBack backHref="/client" />

      <div className="cn-header">
        <h1 className="cn-title">{L.clientSpace.clientNotifTitle}</h1>
        {unread > 0 ? (
          <button type="button" className="ghost-button" onClick={markAllRead}>
            {L.clientSpace.markAllRead}
          </button>
        ) : null}
      </div>

      {loading ? <div className="client-empty">{L.clientSpace.loading}</div> : null}
      {!loading && visible.length === 0 ? (
        <div className="client-empty">{L.clientSpace.noNotifs}</div>
      ) : null}

      <div className="cn-list">
        {visible.map((notif) => {
          const meta = TYPE_META[notif.type] || { label: notif.type || "Info", bg: "#f1f5f9", color: "#475569", icon: "🔔" };
          return (
            <button
              key={notif.id}
              type="button"
              className={`cn-notif${notif.read ? " read" : ""}`}
              onClick={() => handleClick(notif)}
            >
              <div className="cn-notif-icon" style={{ background: meta.bg }}>
                <span>{meta.icon}</span>
              </div>
              <div className="cn-notif-body">
                <div className="cn-notif-top">
                  <span className="cn-notif-badge" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                  <time className="cn-notif-time">{formatTime(notif.createdAt)}</time>
                </div>
                <strong className="cn-notif-title">{notif.title}</strong>
                <p className="cn-notif-msg">{notif.message}</p>
              </div>
              {!notif.read ? <span className="cn-unread-dot" /> : null}
              <button
                type="button"
                className="cn-delete-btn"
                aria-label={L.common.delete}
                onClick={(e) => { e.stopPropagation(); deleteNotif(notif.id); }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>
              </button>
            </button>
          );
        })}
      </div>
    </main>
  );
}
