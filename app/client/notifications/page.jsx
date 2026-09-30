"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClientTopbar } from "../../../components/ClientTopbar";
import "../client-home.css";
import { Svg } from "../demandes-ui";

// Notifications du particulier (refonte UX, septembre 2026). Même logique et
// mêmes appels qu'avant (GET /api/notifications, PATCH read / read-all /
// delete) ; seul l'affichage change.

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
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(value));
}

const CLIENT_TYPES = new Set(["company.reply", "task.started", "task.pending_validation", "radar.message", "radar.positionnement"]);

const ICONES = {
  message: <path d="M4 4h16v12H8l-4 4V4z" />,
  artisan: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>,
  chantier: <><path d="M3 21h18" /><path d="M5 21V10l7-5 7 5v11" /></>,
  valider: <><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></>
};

const TYPE_META = {
  "company.reply":           { label: "Réponse d'un artisan",   icon: ICONES.message },
  "task.started":            { label: "Chantier démarré",       icon: ICONES.chantier },
  "task.pending_validation": { label: "Étape à valider",        icon: ICONES.valider },
  "radar.message":           { label: "Nouveau message",        icon: ICONES.message },
  "radar.positionnement":    { label: "Un artisan est intéressé", icon: ICONES.artisan }
};

const IconTrash = () => <Svg size={16}><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></Svg>;

export default function ClientNotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored?.id) { setLoading(false); return; }
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data) => setNotifications(data.notifications || []))
      .catch(() => setNotifications([]))
      .finally(() => setLoading(false));
  }, []);

  async function markRead(notif) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: notif.id, action: "read" })
    });
    setNotifications((prev) => prev.map((n) => n.id === notif.id ? { ...n, read: true } : n));
  }

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read-all" })
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function deleteNotif(id) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "delete" })
    });
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  function handleClick(notif) {
    if (!notif.read) markRead(notif);
    if (notif.offerId) {
      router.push(`/client/radar/${notif.offerId}`);
    } else if (notif.quoteId) {
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

      <div className="kc">
        <div className="kc-page-head">
          <div>
            <h1 className="kc-page-title">Notifications</h1>
            <p className="kc-page-sub">{unread > 0 ? `${unread} non lue${unread > 1 ? "s" : ""}` : "Tout est lu"}</p>
          </div>
          {unread > 0 ? (
            <button type="button" className="kc-btn kc-btn-outline" onClick={markAllRead}>Tout marquer comme lu</button>
          ) : null}
        </div>

        {loading ? (
          <div className="kc-empty">Chargement…</div>
        ) : visible.length === 0 ? (
          <div className="kc-empty">
            <strong>Aucune notification</strong>
            <span>Vous serez prévenu ici quand un artisan s'intéresse à votre demande ou vous écrit.</span>
          </div>
        ) : (
          <ul className="kc-list">
            {visible.map((notif) => {
              const meta = TYPE_META[notif.type] || { label: "Information", icon: ICONES.message };
              return (
                <li key={notif.id} className={`kc-notif${notif.read ? " is-read" : ""}`}>
                  <button type="button" className="kc-notif-main" onClick={() => handleClick(notif)}>
                    <span className="kc-notif-icon"><Svg>{meta.icon}</Svg></span>
                    <span className="kc-notif-text">
                      <span className="kc-notif-top">
                        <small className="kc-notif-label">{meta.label}</small>
                        <small className="kc-notif-time">{formatTime(notif.createdAt)}</small>
                      </span>
                      <strong>{notif.title}</strong>
                      {notif.message ? <span className="kc-notif-msg">{notif.message}</span> : null}
                    </span>
                    {!notif.read ? <span className="kc-notif-dot" aria-label="Non lue" /> : null}
                  </button>
                  <button type="button" className="kc-notif-delete" aria-label="Supprimer" onClick={() => deleteNotif(notif.id)}>
                    <IconTrash />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
