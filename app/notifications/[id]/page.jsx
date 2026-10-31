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
        <div className="empty">{L.clientSpace.loading}</div>
      </Shell>
    );
  }

  if (!notif) {
    return (
      <Shell>
        <div className="head">
          <div className="stack">
            <Link className="link" href="/notifications">← Notifications</Link>
            <span className="eyebrow">Notification</span>
            <h1>{L.notifications.notFound}</h1>
          </div>
        </div>
        <div className="empty">{L.notifications.notifGone}</div>
      </Shell>
    );
  }

  const metaEntries = Object.entries(notif.meta || {}).filter(([, value]) => value);

  return (
    <Shell>
      <div className="head">
        <div className="stack">
          <Link className="link" href="/notifications">← Notifications</Link>
          <span className="eyebrow">Détail</span>
          <h1>{notif.title}</h1>
        </div>
      </div>

      <section className="card">
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid var(--line)" }}>
          <div style={{ background: meta.bg, borderRadius: 8, width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 24 }}>{meta.icon}</span>
          </div>
          <div>
            <span className="tag" style={{ fontSize: 12, padding: "4px 8px", backgroundColor: meta.bg, color: meta.color, marginBottom: 6, display: "inline-block" }}>
              {meta.label}
            </span>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{formatFullDate(notif.createdAt)}</p>
          </div>
        </div>

        <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>{notif.message}</p>

        {metaEntries.length > 0 ? (
          <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid var(--line)" }}>
            {metaEntries.map(([key, value]) => (
              <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>{META_ICONS[key] || "•"}</span>
                  <span>{META_LABELS[key] || key}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {key === "loginUrl" ? (
                    <a href={value} target="_blank" rel="noreferrer" className="link" style={{ fontSize: 13 }}>{value}</a>
                  ) : (
                    <span style={{ fontSize: 13, fontWeight: 500, wordBreak: "break-word" }}>{String(value)}</span>
                  )}
                  {key === "portalIdentifier" || key === "password" || key === "loginUrl" ? (
                    <button type="button" className="btn btn-sm" onClick={() => copyValue(key, value)} style={{ fontSize: 11, padding: "2px 6px" }}>
                      {copiedKey === key ? "✓" : "Copier"}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {notif.meta?.portalIdentifier && notif.meta?.password ? (
          <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid var(--line)" }}>
            <h3 style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>{L.notifications.resendTitle}</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="btn btn-sec" onClick={resendByEmail} disabled={!notif.meta.email || resendState === "sending"} style={{ fontSize: 12 }}>
                ✉️ {L.notifications.resendEmail}
              </button>
              {!notif.meta.phone ? (
                <input
                  value={phoneDraft}
                  onChange={(event) => setPhoneDraft(event.target.value)}
                  placeholder={L.notifications.phonePlaceholder}
                  style={{ padding: "6px 8px", border: "1px solid var(--line)", borderRadius: 4, fontSize: 12 }}
                />
              ) : null}
              <button type="button" className="btn btn-sec" onClick={resendByWhatsapp} disabled={!notif.meta.phone && !phoneDraft.trim()} style={{ fontSize: 12 }}>
                💬 {L.notifications.resendWhatsapp}
              </button>
            </div>
            {resendState === "sent" ? <p style={{ marginTop: 8, fontSize: 12, color: "var(--suc, #4cb050)" }}>{L.notifications.resendSuccess}</p> : null}
            {resendState && resendState !== "sending" && resendState !== "sent" ? <p style={{ marginTop: 8, fontSize: 12, color: "var(--err)" }}>{resendState}</p> : null}
          </div>
        ) : null}

        {notif.actionUrl ? (
          <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid var(--line)" }}>
            <Link className="link" href={notif.actionUrl}>
              {notif.actionLabel || L.notifications.see} →
            </Link>
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 8 }}>
          {!notif.archived ? <button type="button" className="btn btn-sec" onClick={archiveNotif} style={{ fontSize: 12 }}>{L.notifications.archive}</button> : null}
          <button type="button" className="btn" onClick={deleteNotif} style={{ fontSize: 12, color: "var(--err)" }}>{L.notifications.delete}</button>
        </div>
      </section>
    </Shell>
  );
}
