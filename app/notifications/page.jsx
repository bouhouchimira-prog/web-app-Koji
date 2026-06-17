"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiSend } from "../../lib/client-api";
import { useApi } from "../../lib/use-api";

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60)   return "À l'instant";
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 172800) return "Hier";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

const TYPE_META = {
  "quote.draft":          { label: "Brouillon",       bg: "#fef3c7", color: "#92400e", icon: "✏️" },
  "quote.signed":         { label: "Signature",       bg: "#dcfce7", color: "#166534", icon: "✅" },
  "quote.updated":        { label: "Devis",           bg: "#dbeafe", color: "#1d4ed8", icon: "📄" },
  "client.access.sent":   { label: "Client",          bg: "#f3e8ff", color: "#7c3aed", icon: "👤" },
  "budget.alert":         { label: "Budget",          bg: "#fee2e2", color: "#dc2626", icon: "⚠️" },
  "marketplace.interest": { label: "Marché",          bg: "#ede9fe", color: "#5b21b6", icon: "🌟" },
  "company.worker_claim": { label: "Réclamation",     bg: "#fee2e2", color: "#dc2626", icon: "🔧" },
  "worker.time_overrun":  { label: "Temps dépassé",   bg: "#ffedd5", color: "#c2410c", icon: "⏱️" },
  "company.time_overrun": { label: "Temps dépassé",   bg: "#ffedd5", color: "#c2410c", icon: "⏱️" },
};

function TypeBadge({ type }) {
  const meta = TYPE_META[type] || { label: type || "Info", bg: "#f1f5f9", color: "#475569", icon: "🔔" };
  return (
    <span className="notif-type-badge" style={{ background: meta.bg, color: meta.color }}>
      {meta.label}
    </span>
  );
}

function TypeIcon({ type }) {
  const meta = TYPE_META[type] || { icon: "🔔", bg: "#f1f5f9", color: "#64748b" };
  return (
    <div className="notif-icon" style={{ background: meta.bg }}>
      <span style={{ fontSize: 18, lineHeight: 1 }}>{meta.icon}</span>
    </div>
  );
}

function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconArchive() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function IconDot({ read }) {
  return (
    <span
      className="notif-dot"
      style={{ background: read ? "#cbd5e1" : "#1d74ff" }}
      aria-label={read ? "Lu" : "Non lu"}
    />
  );
}

const TABS = [
  { key: "all",      label: "Toutes" },
  { key: "unread",   label: "Non lues" },
  { key: "archived", label: "Archivées" },
];

export default function NotificationsPage() {
  const { data: notifications, setData: setNotifications } = useApi("/api/notifications", "notifications");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [confirmDelete, setConfirmDelete] = useState(null);

  const unreadCount = notifications.filter((n) => !n.read && !n.archived).length;

  async function markRead(notif) {
    const { notification: updated } = await apiSend("/api/notifications", { id: notif.id, action: "read" }, "PATCH");
    setNotifications((prev) => prev.map((n) => n.id === updated.id ? updated : n));
  }

  async function markAllRead() {
    await apiSend("/api/notifications", { action: "read-all" }, "PATCH");
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function archiveNotif(notif) {
    const { notification: updated } = await apiSend("/api/notifications", { id: notif.id, action: "archive" }, "PATCH");
    setNotifications((prev) => prev.map((n) => n.id === updated.id ? updated : n));
  }

  async function unarchiveNotif(notif) {
    const { notification: updated } = await apiSend("/api/notifications", { id: notif.id, action: "unarchive" }, "PATCH");
    setNotifications((prev) => prev.map((n) => n.id === updated.id ? updated : n));
  }

  async function deleteNotif(id) {
    await apiSend("/api/notifications", { id, action: "delete" }, "PATCH");
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setConfirmDelete(null);
  }

  async function deleteDraft(notif) {
    if (notif.quoteId) {
      await apiSend("/api/quotes", { id: notif.quoteId, action: "delete" }, "PATCH");
    }
    await deleteNotif(notif.id);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...notifications]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .filter((n) => {
        if (tab === "unread")   return !n.read && !n.archived;
        if (tab === "archived") return n.archived;
        return !n.archived;
      })
      .filter((n) => {
        if (!q) return true;
        return (
          (n.title || "").toLowerCase().includes(q) ||
          (n.message || "").toLowerCase().includes(q) ||
          (n.metaLabel || "").toLowerCase().includes(q)
        );
      });
  }, [notifications, tab, search]);

  return (
    <Shell>
      <header className="page-header compact-page-header">
        <div>
          <p className="eyebrow">CENTRE DE NOTIFICATIONS</p>
          <h1>Notifications</h1>
        </div>
        {unreadCount > 0 && (
          <button type="button" className="notif-mark-all-btn" onClick={markAllRead}>
            Tout marquer comme lu
          </button>
        )}
      </header>

      {/* Barre de recherche */}
      <div className="notif-search-wrap">
        <span className="notif-search-icon"><IconSearch /></span>
        <input
          className="notif-search-input"
          type="text"
          placeholder="Rechercher dans les notifications…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search ? (
          <button className="notif-search-clear" onClick={() => setSearch("")} aria-label="Effacer">×</button>
        ) : null}
      </div>

      {/* Onglets filtre */}
      <div className="notif-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`notif-tab${tab === t.key ? " active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key === "unread" && unreadCount > 0 ? (
              <span className="notif-tab-count">{unreadCount}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Liste */}
      <section className="notif-list-card">
        {filtered.length === 0 ? (
          <div className="empty-state" style={{ minHeight: 140 }}>
            {search ? `Aucun résultat pour "${search}".` : tab === "unread" ? "Aucune notification non lue." : tab === "archived" ? "Aucune notification archivée." : "Aucune notification."}
          </div>
        ) : (
          <div className="notif-list">
            {filtered.map((notif) => (
              <article
                key={notif.id}
                className={`notif-row${notif.read ? " notif-read" : " notif-unread"}${notif.archived ? " notif-archived" : ""}`}
              >
                {/* Point non lu */}
                <div className="notif-dot-col">
                  <IconDot read={notif.read} />
                </div>

                {/* Icône type */}
                <TypeIcon type={notif.type} />

                {/* Contenu */}
                <div className="notif-content">
                  <div className="notif-content-top">
                    <TypeBadge type={notif.type} />
                    <time className="notif-time">{formatDate(notif.updatedAt || notif.createdAt)}</time>
                  </div>
                  <h2 className="notif-title">{notif.title}</h2>
                  <p className="notif-message">{notif.message}</p>
                  {notif.metaLabel ? <span className="notif-meta">{notif.metaLabel}</span> : null}

                  {/* Actions spéciales */}
                  {notif.type === "quote.draft" && !notif.archived ? (
                    <div className="notif-inline-actions">
                      <Link className="notif-action-link" href={notif.actionUrl || "/chantier/new"}>
                        Reprendre le brouillon →
                      </Link>
                      <button type="button" className="notif-action-delete-draft" onClick={() => deleteDraft(notif)}>
                        Supprimer le brouillon
                      </button>
                    </div>
                  ) : notif.actionUrl && !notif.archived ? (
                    <div className="notif-inline-actions">
                      <Link className="notif-action-link" href={notif.actionUrl} onClick={() => markRead(notif)}>
                        {notif.actionLabel || "Voir"} →
                      </Link>
                    </div>
                  ) : null}
                </div>

                {/* Actions droite */}
                <div className="notif-actions-col">
                  {!notif.read && !notif.archived && (
                    <button
                      type="button"
                      className="notif-btn notif-btn-read"
                      title="Marquer comme lu"
                      onClick={() => markRead(notif)}
                    >
                      Lu
                    </button>
                  )}
                  {!notif.archived ? (
                    <button
                      type="button"
                      className="notif-btn notif-btn-archive"
                      title="Archiver"
                      onClick={() => archiveNotif(notif)}
                    >
                      <IconArchive />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="notif-btn notif-btn-unarchive"
                      title="Désarchiver"
                      onClick={() => unarchiveNotif(notif)}
                    >
                      ↩
                    </button>
                  )}
                  {confirmDelete === notif.id ? (
                    <span className="notif-confirm-delete">
                      <button className="notif-btn notif-btn-danger" onClick={() => deleteNotif(notif.id)}>Suppr.</button>
                      <button className="notif-btn" onClick={() => setConfirmDelete(null)}>Non</button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="notif-btn notif-btn-trash"
                      title="Supprimer"
                      onClick={() => setConfirmDelete(notif.id)}
                    >
                      <IconTrash />
                    </button>
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
