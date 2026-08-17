"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Shell } from "../../../components/Shell";
import { apiSend } from "../../../lib/client-api";
import { useApi } from "../../../lib/use-api";
import { useLocale } from "../../../lib/i18n";

const META_ICONS = {
  portalIdentifier: "🆔",
  password: "🔑",
  email: "✉️",
  phone: "📱",
  loginUrl: "🔗",
  quoteNumber: "📄"
};

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
  "company.time_overrun": { label: "Temps dépassé", bg: "#ffedd5", color: "#c2410c", icon: "⏱️" },
  "urgent.alert":         { label: "🚨 URGENT",     bg: "#fee2e2", color: "#991b1b", icon: "🚨" },
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
  const { L } = useLocale();
  const params = useParams();
  const router = useRouter();
  const { data: notifications, setData: setNotifications, loading } = useApi("/api/notifications", "notifications");
  const notif = notifications.find((item) => item.id === params.id);
  const meta = TYPE_META[notif?.type] || { label: notif?.type || "Info", bg: "#f1f5f9", color: "#475569", icon: "🔔" };
  const [resendState, setResendState] = useState("");
  const [phoneDraft, setPhoneDraft] = useState("");
  const [copiedKey, setCopiedKey] = useState("");

  async function resendByEmail() {
    setResendState("sending");
    try {
      await apiSend("/api/notifications", { id: notif.id, action: "resend-email" }, "PATCH");
      setResendState("sent");
    } catch (error) {
      setResendState(error.message || "error");
    }
  }

  function resendByWhatsapp() {
    const meta = notif.meta || {};
    const phone = (meta.phone || phoneDraft || "").replace(/\D/g, "");
    if (!phone) return;
    const text = [
      `Bonjour, votre espace Koji Particulier est prêt.`,
      meta.quoteNumber ? `Devis : ${meta.quoteNumber}` : "",
      meta.portalIdentifier ? `Identifiant : ${meta.portalIdentifier}` : "",
      meta.password ? `Mot de passe : ${meta.password}` : "",
      meta.loginUrl ? `Connexion : ${meta.loginUrl}` : ""
    ].filter(Boolean).join("\n");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
  }

  function copyValue(key, value) {
    navigator.clipboard?.writeText(String(value)).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(""), 1500);
    }).catch(() => {});
  }

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
        <section className="panel"><div className="empty-state">{L.clientSpace.loading}</div></section>
      </Shell>
    );
  }

  if (!notif) {
    return (
      <Shell>
        <header className="page-header compact-page-header">
          <div>
            <p className="eyebrow">NOTIFICATION</p>
            <h1>{L.notifications.notFound}</h1>
          </div>
        </header>
        <div className="empty-state">{L.notifications.notifGone}</div>
        <Link className="notif-action-link" href="/notifications">{L.notifications.backToList}</Link>
      </Shell>
    );
  }

  const metaEntries = Object.entries(notif.meta || {}).filter(([, value]) => value);

  return (
    <Shell>
      <header className="page-header compact-page-header">
        <div>
          <p className="eyebrow">NOTIFICATION</p>
          <h1>{L.notifications.detail}</h1>
        </div>
        <Link className="notif-action-link" href="/notifications">{L.notifications.back}</Link>
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
          <table className="notif-detail-table">
            <tbody>
              {metaEntries.map(([key, value]) => (
                <tr key={key}>
                  <td className="notif-detail-table-label">
                    <span className="notif-detail-table-icon">{META_ICONS[key] || "•"}</span>
                    {META_LABELS[key] || key}
                  </td>
                  <td className="notif-detail-table-value">
                    {key === "loginUrl" ? (
                      <a href={value} target="_blank" rel="noreferrer">{value}</a>
                    ) : (
                      <span>{String(value)}</span>
                    )}
                    {key === "portalIdentifier" || key === "password" || key === "loginUrl" ? (
                      <button type="button" className="notif-detail-copy" onClick={() => copyValue(key, value)}>
                        {copiedKey === key ? "✓" : "Copier"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {notif.meta?.portalIdentifier && notif.meta?.password ? (
          <div className="notif-resend-card">
            <strong>{L.notifications.resendTitle}</strong>
            <div className="notif-resend-row">
              <button type="button" className="mini-button" onClick={resendByEmail} disabled={!notif.meta.email || resendState === "sending"}>
                ✉️ {L.notifications.resendEmail}
              </button>
              {!notif.meta.phone ? (
                <input
                  className="notif-resend-phone"
                  value={phoneDraft}
                  onChange={(event) => setPhoneDraft(event.target.value)}
                  placeholder={L.notifications.phonePlaceholder}
                />
              ) : null}
              <button type="button" className="mini-button" onClick={resendByWhatsapp} disabled={!notif.meta.phone && !phoneDraft.trim()}>
                💬 {L.notifications.resendWhatsapp}
              </button>
            </div>
            {resendState === "sent" ? <p className="notif-resend-status success">{L.notifications.resendSuccess}</p> : null}
            {resendState && resendState !== "sending" && resendState !== "sent" ? <p className="notif-resend-status error">{resendState}</p> : null}
          </div>
        ) : null}

        {notif.actionUrl ? (
          <Link className="notif-action-link notif-detail-action" href={notif.actionUrl}>
            {notif.actionLabel || L.notifications.see} →
          </Link>
        ) : null}

        <div className="notif-detail-actions">
          {!notif.archived ? <button type="button" className="mini-button" onClick={archiveNotif}>{L.notifications.archive}</button> : null}
          <button type="button" className="mini-danger" onClick={deleteNotif}>{L.notifications.delete}</button>
        </div>
      </section>
    </Shell>
  );
}
