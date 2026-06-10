"use client";

import Link from "next/link";
import { Shell } from "../../components/Shell";
import { apiSend } from "../../lib/client-api";
import { useApi } from "../../lib/use-api";

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function NotificationsPage() {
  const { data: notifications, setData: setNotifications } = useApi("/api/notifications", "notifications");

  async function markRead(notification) {
    const { notification: updated } = await apiSend("/api/notifications", { id: notification.id, action: "read" }, "PATCH");
    setNotifications(notifications.map((item) => item.id === updated.id ? updated : item));
  }

  async function deleteDraft(notification) {
    if (notification.quoteId) {
      await apiSend("/api/quotes", { id: notification.quoteId, action: "delete" }, "PATCH");
    }
    setNotifications(notifications.filter((item) => item.id !== notification.id));
  }

  const ordered = [...notifications].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  return (
    <Shell>
      <header className="page-header compact-page-header">
        <div>
          <p className="eyebrow">NOTIFICATIONS</p>
          <h1>Notifications</h1>
        </div>
      </header>

      <section className="notifications-page-card">
        {!ordered.length ? (
          <div className="empty-state">Aucune notification pour le moment.</div>
        ) : (
          <div className="notifications-list">
            {ordered.map((notification) => (
              <article className={`notification-row ${notification.read ? "read" : "unread"}`} key={notification.id}>
                <span className="notification-dot" aria-hidden="true" />
                <div>
                  <h2>{notification.title}</h2>
                  <p>{notification.message}</p>
                  {notification.metaLabel ? <small>{notification.metaLabel}</small> : null}
                  <time>{formatDate(notification.updatedAt || notification.createdAt)}</time>
                </div>
                <div className="notification-actions">
                  {notification.type === "quote.draft" ? (
                    <>
                      <Link className="button small" href={notification.actionUrl || "/chantier/new"}>Continuer</Link>
                      <button type="button" className="button secondary small" onClick={() => deleteDraft(notification)}>Supprimer</button>
                    </>
                  ) : (
                    <button type="button" className="button secondary small" onClick={() => markRead(notification)}>Marquer lu</button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </Shell>
  );
}
