"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiSend } from "../../lib/client-api";
import { useLocale } from "../../lib/i18n";
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
  "task.completed":       { label: "À valider",       bg: "#fef9c3", color: "#854d0e", icon: "🛠️" },
  "client.note":          { label: "Message client",  bg: "#f0f9ff", color: "#0369a1", icon: "💬" },
  "worker.time_overrun":  { label: "Temps dépassé",   bg: "#ffedd5", color: "#c2410c", icon: "⏱️" },
  "company.time_overrun": { label: "Temps dépassé",   bg: "#ffedd5", color: "#c2410c", icon: "⏱️" },
  "urgent.alert":         { label: "🚨 URGENT",       bg: "#fee2e2", color: "#991b1b", icon: "🚨" },
  "site.lead":            { label: "Demande de devis", bg: "#e6f5ee", color: "#1e8e5a", icon: "🌐" },
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


export default function NotificationsPage() {
  const { L, lang } = useLocale();
  const router = useRouter();
  const { data: notifications, setData: setNotifications } = useApi("/api/notifications", "notifications");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [confirmDelete, setConfirmDelete] = useState(null);

  const TABS = [
    { key: "all",      label: L.notifications.filterAll },
    { key: "unread",   label: L.notifications.filterUnread },
    { key: "archived", label: L.common.archive },
  ];

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
      <div className="head">
        <div className="stack">
          <button type="button" className="link" onClick={() => window.history.back()}>← Retour</button>
          <span className="eyebrow">Notifications</span>
          <h1>{L.notifications.title}</h1>
        </div>
        {unreadCount > 0 && (
          <button type="button" className="btn btn-sec" onClick={markAllRead} style={{ marginTop: 8 }}>
            {L.notifications.markAllRead}
          </button>
        )}
      </div>

      <div className="search search-wide" style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder={L.notifications.search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="wtabs" style={{ marginBottom: 16 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={tab === t.key ? "on" : ""}
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
          >
            {t.label}
            {t.key === "unread" && unreadCount > 0 ? (
              <span style={{ marginLeft: 6, opacity: 0.6 }}>({unreadCount})</span>
            ) : null}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <strong>Pas de notifications</strong>
          <span>{search ? `aucun résultat pour "${search}"` : "Vous êtes à jour !"}</span>
        </div>
      ) : (
        <div className="mlist">
          {filtered.map((notif) => (
            <article
              key={notif.id}
              className="m-card clickable"
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/notifications/${notif.id}`)}
              onKeyDown={(event) => { if (event.key === "Enter") router.push(`/notifications/${notif.id}`); }}
            >
              <div className="top2">
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flex: 1 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center", marginTop: 2 }}>
                    <div className="notif-icon" style={{ background: TYPE_META[notif.type]?.bg || "#f1f5f9", borderRadius: 6, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 16 }}>{TYPE_META[notif.type]?.icon || "🔔"}</span>
                    </div>
                    {!notif.read && !notif.archived && (
                      <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#1d74ff", marginTop: 4 }} aria-label="Non lu" />
                    )}
                  </div>
                  <div className="nm" style={{ flex: 1 }}>
                    <strong>{notif.title}</strong>
                    <div className="meta" style={{ marginTop: 4 }}>
                      <span className="tag" style={{ fontSize: 11, padding: "2px 6px", backgroundColor: TYPE_META[notif.type]?.bg || "#f1f5f9", color: TYPE_META[notif.type]?.color || "#475569", marginRight: 8 }}>
                        {TYPE_META[notif.type]?.label || notif.type}
                      </span>
                      <time style={{ fontSize: 12, opacity: 0.6 }}>{formatDate(notif.updatedAt || notif.createdAt)}</time>
                    </div>
                    {notif.message ? <p style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>{notif.message}</p> : null}
                    {notif.metaLabel ? <p style={{ marginTop: 4, fontSize: 12, opacity: 0.6 }}>{notif.metaLabel}</p> : null}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }} onClick={(event) => event.stopPropagation()}>
                  {!notif.read && !notif.archived && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      title={L.notifications.markRead}
                      onClick={() => markRead(notif)}
                      style={{ fontSize: 12, padding: "4px 8px" }}
                    >
                      {L.notifications.markRead}
                    </button>
                  )}
                  {!notif.archived ? (
                    <button
                      type="button"
                      className="btn btn-sm"
                      title={L.notifications.archive}
                      onClick={() => archiveNotif(notif)}
                      style={{ fontSize: 12, padding: "4px 8px" }}
                    >
                      📦
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm"
                      title={L.common.back}
                      onClick={() => unarchiveNotif(notif)}
                      style={{ fontSize: 12, padding: "4px 8px" }}
                    >
                      ↩
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-sm"
                    title={L.notifications.delete}
                    onClick={() => setConfirmDelete(confirmDelete === notif.id ? null : notif.id)}
                    style={{ fontSize: 12, padding: "4px 8px", color: confirmDelete === notif.id ? "var(--err)" : "inherit" }}
                  >
                    {confirmDelete === notif.id ? "Sûr ?" : "🗑"}
                  </button>
                  {confirmDelete === notif.id && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => deleteNotif(notif.id)}
                      style={{ fontSize: 12, padding: "4px 8px", color: "var(--err)" }}
                    >
                      {L.common.delete}
                    </button>
                  )}
                </div>
              </div>
              {notif.type === "quote.draft" && !notif.archived ? (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--line)" }} onClick={(event) => event.stopPropagation()}>
                  <Link className="link" href={notif.actionUrl || "/devis/new"}>
                    Reprendre le brouillon →
                  </Link>
                </div>
              ) : notif.actionUrl && !notif.archived ? (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--line)" }} onClick={(event) => event.stopPropagation()}>
                  <Link className="link" href={notif.actionUrl} onClick={() => markRead(notif)}>
                    {notif.actionLabel || "Voir"} →
                  </Link>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </Shell>
  );
}
