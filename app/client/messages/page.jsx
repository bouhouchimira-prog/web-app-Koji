"use client";

import { useEffect, useMemo, useState } from "react";
import { ClientTopbar } from "../../../components/ClientTopbar";
import { shortDate } from "../../../lib/pricing";

function getStoredUser() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("koji-user") || "null"); } catch { return null; }
}

function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16v12H8l-4 4V4z" />
    </svg>
  );
}
function SendIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2L11 13" />
      <path d="M22 2L15 22l-4-9-9-4 20-7z" />
    </svg>
  );
}

// Boite de reception unique "Messages" (16 oct, maquette Artifact) — les
// conversations existaient deja en vrai (par offre, voir
// app/client/radar/[id]/page.jsx) mais seulement visibles une offre a la
// fois. Cette page regroupe les memes fils via /api/client/messages, avec
// la meme logique d'envoi (POST sur /api/marketplace/offres/[id]/messages)
// que la page existante.
export default function ClientMessagesPage() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeKey, setActiveKey] = useState(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  function load() {
    fetch("/api/client/messages")
      .then((r) => r.json())
      .then((data) => setConversations(data.conversations || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const activeConversation = conversations.find((c) => `${c.offerId}:${c.entrepriseUserId}` === activeKey) || null;

  // Marque les notifications "radar.message" liees a cette conversation
  // comme lues, maintenant qu'elle est ouverte — reutilise l'API de
  // notifications existante (meme mecanisme que la cloche du menu).
  useEffect(() => {
    if (!activeConversation?.unread) return;
    const user = getStoredUser();
    if (!user?.id) return;
    fetch(`/api/notifications?userId=${encodeURIComponent(user.id)}`)
      .then((r) => r.json())
      .then((data) => {
        const toMark = (data.notifications || []).filter(
          (n) => n.type === "radar.message" && !n.read && n.offerId === activeConversation.offerId && n.entrepriseUserId === activeConversation.entrepriseUserId
        );
        return Promise.all(toMark.map((n) => fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: n.id, action: "read" })
        })));
      })
      .then(() => setConversations((prev) => prev.map((c) => (
        c.offerId === activeConversation.offerId && c.entrepriseUserId === activeConversation.entrepriseUserId
          ? { ...c, unread: false }
          : c
      ))))
      .catch(() => {});
  }, [activeConversation]); // eslint-disable-line react-hooks/exhaustive-deps

  const unreadCount = useMemo(() => conversations.filter((c) => c.unread).length, [conversations]);

  async function sendReply(event) {
    event.preventDefault();
    if (!draft.trim() || !activeConversation) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch(`/api/marketplace/offres/${activeConversation.offerId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: draft.trim(), entrepriseUserId: activeConversation.entrepriseUserId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur lors de l'envoi.");
      setConversations((prev) => prev.map((c) => (
        c.offerId === activeConversation.offerId && c.entrepriseUserId === activeConversation.entrepriseUserId
          ? { ...c, messages: [...c.messages, data.message] }
          : c
      )));
      setDraft("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="client-space">
      <ClientTopbar showBack backHref="/client" />

      {!activeConversation ? (
        <>
          <div className="ct-welcome">
            <strong>Messages</strong>
            <small>Vos échanges avec les artisans, rattachés à chaque chantier.</small>
          </div>

          <section className="ct-section">
            <div className="ct-section-title-row">
              <h2 className="ct-section-title">
                Conversations{unreadCount > 0 ? <span className="ct-count">{unreadCount}</span> : null}
              </h2>
            </div>
            {loading ? <div className="client-empty">Chargement…</div> : null}
            {!loading && conversations.length === 0 ? (
              <div className="client-empty">Aucun message pour l'instant. Les artisans qui vous contactent sur vos demandes apparaîtront ici.</div>
            ) : null}
            <div className="radar-conv-list">
              {conversations.map((conv) => {
                const key = `${conv.offerId}:${conv.entrepriseUserId}`;
                const last = conv.messages[conv.messages.length - 1];
                return (
                  <button key={key} type="button" className="radar-conv-row" onClick={() => setActiveKey(key)}>
                    <span className="radar-conv-avatar">{(conv.entrepriseSnapshot?.raisonSociale || "?").slice(0, 1).toUpperCase()}</span>
                    <span className="radar-conv-main">
                      <strong>
                        {conv.entrepriseSnapshot?.raisonSociale || "Entreprise"}
                        {conv.unread ? <span className="radar-status-badge" style={{ marginLeft: 8 }}>Nouveau</span> : null}
                      </strong>
                      <small>{conv.offre.description?.slice(0, 50)}{conv.offre.description?.length > 50 ? "…" : ""}</small>
                      <small>{last?.message?.slice(0, 60) || ""}</small>
                    </span>
                    <span className="ct-devis-row-right">
                      {last ? <small>{shortDate(last.createdAt)}</small> : null}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </>
      ) : (
        <section className="ct-section">
          <button type="button" className="radar-conv-back" onClick={() => setActiveKey(null)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="15 18 9 12 15 6" /></svg>
            Toutes les conversations
          </button>

          <div className="radar-contact-card">
            <p className="radar-contact-title">{activeConversation.entrepriseSnapshot?.raisonSociale || "Entreprise"}</p>
            <div className="radar-entreprise-meta">
              <span>{activeConversation.offre.description}</span>
              {activeConversation.offre.address ? <span>{activeConversation.offre.address}</span> : null}
            </div>
          </div>

          <div className="radar-chat-card">
            <div className="radar-chat-header">
              <span className="radar-chat-header-icon"><ChatIcon /></span>
              <div>
                <strong>Discussion interne Koji</strong>
                <small>Vos échanges restent sur Koji tant que le rendez-vous n'est pas confirmé.</small>
              </div>
            </div>
            <div className="radar-chat-messages">
              {activeConversation.messages.map((m) => (
                <div key={m.id} className={`radar-chat-bubble ${m.senderType === "particulier" ? "entreprise" : "particulier"}`}>
                  <p>{m.message}</p>
                  <small>{shortDate(m.createdAt)}</small>
                </div>
              ))}
            </div>

            {error ? <p className="auth-error">{error}</p> : null}

            <form className="radar-chat-form" onSubmit={sendReply}>
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Écrire un message…" />
              <button type="submit" className="radar-chat-send" disabled={sending || !draft.trim()} aria-label="Envoyer">
                <SendIcon />
              </button>
            </form>
          </div>
        </section>
      )}
    </main>
  );
}
