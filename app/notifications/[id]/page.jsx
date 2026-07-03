"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Shell } from "../../../components/Shell";
import { apiSend } from "../../../lib/client-api";
import { useApi } from "../../../lib/use-api";

function formatFullDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(new Date(value));
}

const TYPE_META = {
  "quote.draft":          { label: "Brouillon",     bg: "#fef3c7", color: "#92400e", icon: "✏️" },
  "quote.signed":         { label: "Signature",     bg: "#dcfce7", color: "#166534", icon: "✅" },
  "quote.updated":        { label: "Devis",         bg: "#dbeafe", color: "#1d4ed8", icon: "📄" },
  "client.access.sent":   { label: "Client",        bg: "#f3e8ff", color: "#7c3aed", icon: "👤" },
  "budget.alert":         { label: "Budget",        bg: "#fee2e2", color: "#dc2626", icon: "⚠️" },
  "marketplace.interest": { label: "Marché",        bg: "#ede9fe", color: "#5b21b6", icon: "🌟" },
  "company.worker_claim": { label: "Réclamation",   bg: "#fee2e2", color: "#dc2626", icon: "🔧" },
  "task.completed":       { label: "À valider",     bg: "#fef9c3", color: "#854d0e", icon: "🛠️" },
  "client.note":          { label: "Message client", bg: "#f0f9ff", color: "#0369a1", icon: "💬" },
  "worker.time_overrun":  { label: "Temps dépassé", bg: "#ffedd5", color: "#c2410c", icon: "⏱️" },
  "company.time_overrun": { label: "Temps dépassé", bg: "#ffedd5", color: "#c2410c", icon: "⏱️" }
};

const META_LABELS = {
  portalIdentifier: "Identifiant client",
  password: "Mot de passe",
  email: "Email",
  phone: "Téléphone",
  loginUrl: "Lien de connexion",
  quoteNumber: "Devis",
  signerName: "Signé par",
  taskLabel: "Ouvrage",
  completedByName: "Termine par",
  completedByType: "Type",
  clientName: "Client",
  noteType: "Type",
  noteTitle: "Titre",
  noteText: "Message"
};

export default function NotificationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: notifications, setData: setNotifications, loading } = useApi("/api/notifications", "notifications");
  const notif = notifications.find((item) => item.id === params.id);
  const meta = TYPE_META[notif?.type] || { label: notif?.type || "Info", bg: "#f1f5f9", color: "#475569", icon: "🔔" };

  useEffect(() => {
    if (notif && !notif.read) {
      apiSend("/api/notifications", { id: notif.id, action: "read" }, "PATCH")
        .then(({ notification: updated }) => setNotifications((prev) => prev.map((item) => (item.id === updated.id ? updated : item))))
        .catch(() => {});
    }
  }, [notif?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function archiveNotif() {
    const { notification: updated } = await apiSend("/api/notifications", { id: notif.id, action: "archive" }, "PATCH");
    setNotifications((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    router.push("/notifications");
  }

  async function deleteNotif() {
    await apiSend("/api/notifications", { id: notif.id, action: "delete" }, "PATCH");
    setNotifications((prev) => prev.filter((item) => item.id !== notif.id));
    router.push("/notifications");
  }

  if (loading) {
    return (
      <Shell>
        <section className="panel"><div className="empty-state">Chargement...</div></section>
      </Shell>
    );
  }

  if (!notif) {
    return (
      <Shell>
        <header className="page-header compact-page-header">
          <div>
            <p className="eyebrow">NOTIFICATION</p>
            <h1>Introuvable</h1>
          </div>
        </header>
        <div className="empty-state">Cette notification n'existe plus.</div>
        <Link className="notif-action-link" href="/notifications">← Retour aux notifications</Link>
      </Shell>
    );
  }

  const metaEntries = Object.entries(notif.meta || {}).filter(([, value]) => value);

  return (
    <Shell>
      <header className="page-header compact-page-header">
        <div>
          <p className="eyebrow">NOTIFICATION</p>
          <h1>Détail</h1>
        </div>
        <Link className="notif-action-link" href="/notifications">← Retour</Link>
      </header>

      <section className="notif-detail-card">
        <div className="notif-detail-top">
          <div className="notif-icon" style={{ background: meta.bg }}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>{meta.icon}</span>
          </div>
          <div>
            <span className="notif-type-badge" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
            <time className="notif-time">{formatFullDate(notif.createdAt)}</time>
          </div>
        </div>

        <h2 className="notif-detail-title">{notif.title}</h2>
        <p className="notif-detail-message">{notif.message}</p>

        {metaEntries.length > 0 ? (
          <dl className="notif-detail-meta">
            {metaEntries.map(([key, value]) => (
              <div key={key}>
                <dt>{META_LABELS[key] || key}</dt>
                <dd>{key === "loginUrl" ? <a href={value} target="_blank" rel="noreferrer">{value}</a> : String(value)}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {notif.actionUrl ? (
          <Link className="notif-action-link notif-detail-action" href={notif.actionUrl}>
            {notif.actionLabel || "Voir"} →
          </Link>
        ) : null}

        <div className="notif-detail-actions">
          {!notif.archived ? <button type="button" className="mini-button" onClick={archiveNotif}>Archiver</button> : null}
          <button type="button" className="mini-danger" onClick={deleteNotif}>Supprimer</button>
        </div>
      </section>
    </Shell>
  );
}
