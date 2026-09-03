"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Shell } from "../../../components/Shell";
import { apiGet, apiSend } from "../../../lib/client-api";
import { euro, shortDate } from "../../../lib/pricing";

function CallIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.68 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.32 1.85.55 2.81.68A2 2 0 0122 16.92z" />
    </svg>
  );
}
function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16v16H4z" />
      <path d="M22 6l-10 7L2 6" />
    </svg>
  );
}
function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16v12H8l-4 4V4z" />
    </svg>
  );
}
function ChatBubbleBigIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16v12H8l-4 4V4z" />
      <path d="M8 9h8M8 12.5h5" />
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
function SparkleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function MarketplaceOffreDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [offre, setOffre] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showEmail, setShowEmail] = useState(false);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiQuote, setAiQuote] = useState(null);

  useEffect(() => {
    apiGet(`/api/marketplace/offres/${params.id}`)
      .then((data) => setOffre(data.offre))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    apiGet(`/api/marketplace/offres/${params.id}/messages`)
      .then((data) => setMessages(data.messages || []))
      .catch(() => {})
      .finally(() => setMessagesLoading(false));
  }, [params.id]);

  async function generateAiQuote() {
    setAiLoading(true);
    setAiError("");
    try {
      const data = await apiSend("/api/estimer-devis", { chantierOffreId: params.id });
      setAiQuote(data.quote);
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    try {
      const data = await apiSend(`/api/marketplace/offres/${params.id}/messages`, { message: draft.trim() });
      setMessages((prev) => [...prev, data.message]);
      setDraft("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <Shell>
      <section className="mobile-tool">
        <header className="tool-topline">
          <button type="button" className="plain-back" onClick={() => router.push("/marketplace")}>{"<"}</button>
          <h1>Détail du chantier</h1>
          <span />
        </header>

        {loading ? <div className="tool-empty">Chargement…</div> : null}
        {!loading && error && !offre ? <div className="tool-empty">{error}</div> : null}

        {!loading && offre ? (
          <>
            {offre.photos.length > 0 ? (
              <div className="radar-photo-grid" style={{ marginBottom: 14 }}>
                {offre.photos.map((photo, index) => (
                  <div className="radar-photo-thumb radar-photo-thumb-lg" key={index}>
                    <img src={photo} alt={`Photo ${index + 1}`} />
                  </div>
                ))}
              </div>
            ) : null}

            <div className="radar-recap radar-recap-card">
              <div className="radar-recap-row"><span>Travaux</span><strong>{offre.description}</strong></div>
              <div className="radar-recap-row"><span>Métier</span><strong>{offre.metier || "Non précisé"}</strong></div>
              <div className="radar-recap-row"><span>Adresse</span><strong>{offre.address}</strong></div>
              <div className="radar-recap-row"><span>Budget</span><strong>{offre.budget ? euro(offre.budget) : "Non communiqué"}</strong></div>
              <div className="radar-recap-row"><span>Fournitures</span><strong>{offre.withSupplies ? "Incluses" : "Non incluses"}</strong></div>
              <div className="radar-recap-row"><span>Publiée le</span><strong>{shortDate(offre.createdAt)}</strong></div>
            </div>

            <div className="radar-contact-card">
              <p className="radar-contact-title">Devis assisté par IA</p>
              {aiQuote ? (
                <div className="radar-ai-success">
                  <p>Devis {aiQuote.quoteNumber} généré — {euro(aiQuote.totalTtc)} TTC. Il est enregistré en brouillon, à ajuster avant envoi.</p>
                  <Link href={`/devis?id=${aiQuote.id}`} className="radar-contact-btn radar-contact-btn-primary" style={{ width: "100%" }}>
                    <span className="radar-contact-icon"><SparkleIcon /></span>
                    <span>
                      <strong>Ouvrir le devis</strong>
                      <small>Vérifier et envoyer depuis l'éditeur</small>
                    </span>
                  </Link>
                </div>
              ) : (
                <>
                  <button type="button" className="radar-contact-btn radar-contact-btn-primary" onClick={generateAiQuote} disabled={aiLoading} style={{ width: "100%" }}>
                    <span className="radar-contact-icon"><SparkleIcon /></span>
                    <span>
                      <strong>{aiLoading ? "Génération en cours…" : "Générer un devis avec l'IA"}</strong>
                      <small>À partir de la photo, de la description et de notre base de prix</small>
                    </span>
                  </button>
                  {aiError ? <p className="profile-message error" style={{ marginTop: 10 }}>{aiError}</p> : null}
                </>
              )}
            </div>

            <div className="radar-contact-card">
              <p className="radar-contact-title">Contacter le client</p>
              <div className="radar-contact-actions">
                {offre.clientPhone ? (
                  <a href={`tel:${offre.clientPhone}`} className="radar-contact-btn radar-contact-btn-primary">
                    <span className="radar-contact-icon"><CallIcon /></span>
                    <span>
                      <strong>Appeler</strong>
                      <small>{offre.clientPhone}</small>
                    </span>
                  </a>
                ) : null}
                {offre.clientEmail ? (
                  <button type="button" className="radar-contact-btn" onClick={() => setShowEmail(true)}>
                    <span className="radar-contact-icon radar-contact-icon-alt"><MailIcon /></span>
                    <span>
                      <strong>E-mail</strong>
                      <small>{showEmail ? offre.clientEmail : "Cliquer pour afficher"}</small>
                    </span>
                  </button>
                ) : null}
              </div>
              {showEmail && offre.clientEmail ? (
                <a href={`mailto:${offre.clientEmail}`} className="radar-contact-mailto">Écrire à {offre.clientEmail} →</a>
              ) : null}
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
                {messagesLoading ? <p className="radar-chat-empty">Chargement…</p> : null}
                {!messagesLoading && messages.length === 0 ? (
                  <div className="radar-chat-empty-state">
                    <ChatBubbleBigIcon />
                    <p>Aucun message pour l'instant.<br />Envoyez-en un pour engager la discussion.</p>
                  </div>
                ) : null}
                {messages.map((m) => (
                  <div key={m.id} className={`radar-chat-bubble ${m.senderType}`}>
                    <p>{m.message}</p>
                    <small>{shortDate(m.createdAt)}</small>
                  </div>
                ))}
              </div>
              <form className="radar-chat-form" onSubmit={sendMessage}>
                <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Écrire un message…" />
                <button type="submit" className="radar-chat-send" disabled={sending || !draft.trim()} aria-label="Envoyer">
                  <SendIcon />
                </button>
              </form>
            </div>
          </>
        ) : null}
      </section>
    </Shell>
  );
}
