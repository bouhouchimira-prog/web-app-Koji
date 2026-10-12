"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ClientTopbar } from "../../../../components/ClientTopbar";

// Nouveau parcours 100% conversationnel (9-10 oct, refonte demandee par
// Amira) — remplace a terme app/client/radar/new/page.jsx (onglet "Offre
// IA" + les 6 ecrans de formulaire separes qui suivaient). Page de test
// isolee pour l'instant : /client/radar/new continue de fonctionner comme
// avant tant que celle-ci n'est pas validee. Une fois la collecte terminee
// (l'IA appelle terminer_collecte, cote serveur), redirige vers l'ecran de
// recap EXISTANT (/client/radar/new?draftId=...), qui charge desormais
// l'etat structure depuis la nouvelle table plutot que depuis son propre
// state accumule localement — voir le useEffect ajoute dans ce fichier.
function SparkleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" />
      <circle cx="12" cy="12" r="3" />
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
function PaperclipIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a5 5 0 01-7.07-7.07l9.19-9.19a3.5 3.5 0 014.95 4.95l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function nowTime() {
  return new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function readAsDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

function getStoredUser() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("koji-user") || "null"); } catch { return null; }
}

export default function RadarNewChatPage() {
  const router = useRouter();
  const [turns, setTurns] = useState([
    { role: "assistant", text: "Bonjour ! 👋 Je suis koji, votre conseiller rénovation. Dites-moi, quel est votre projet ?", time: nowTime() }
  ]);
  const [draft, setDraft] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [photos, setPhotos] = useState([]);
  const conversationIdRef = useRef(`radarchat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const draftIdRef = useRef("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, streamingText]);

  function onPhotosChange(event) {
    const files = Array.from(event.target.files || []).slice(0, 8 - photos.length);
    if (!files.length) return;
    Promise.all(files.map(readAsDataUrl)).then((dataUrls) => setPhotos((p) => [...p, ...dataUrls]));
    event.target.value = "";
  }
  function removePhoto(index) {
    setPhotos((p) => p.filter((_, i) => i !== index));
  }

  async function sendToEngine(nextTurns, photosForThisTurn) {
    setSending(true);
    setError("");
    setStreamingText("");
    const user = getStoredUser();
    const prenom = (user?.name || "").trim().split(/\s+/)[0] || "";

    try {
      const response = await fetch("/api/radar-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turns: nextTurns.map(({ role, text }) => ({ role, text })),
          conversationId: conversationIdRef.current,
          draftId: draftIdRef.current || undefined,
          photos: photosForThisTurn,
          prenom
        })
      });
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "L'assistant n'a pas pu répondre.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let liveText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() || "";
        for (const frame of frames) {
          const eventMatch = /event: (\w+)/.exec(frame);
          const dataMatch = /data: (.+)/.exec(frame);
          if (!eventMatch || !dataMatch) continue;
          const eventType = eventMatch[1];
          let data;
          try { data = JSON.parse(dataMatch[1]); } catch { continue; }

          if (eventType === "delta") {
            liveText += data.text;
            setStreamingText(liveText);
          } else if (eventType === "done") {
            draftIdRef.current = data.draftId;
            const finalMessage = data.message || liveText || "D'accord.";
            setTurns((current) => [...current, { role: "assistant", text: finalMessage, time: nowTime() }]);
            setStreamingText("");
            if (data.finished) {
              router.push(`/client/radar/new?draftId=${encodeURIComponent(data.draftId)}`);
            }
          } else if (eventType === "error") {
            setError(data.message || "L'assistant n'a pas pu répondre.");
          }
        }
      }
    } catch (err) {
      setError(err.message || "L'assistant n'a pas pu répondre. Réessayez.");
    } finally {
      setSending(false);
    }
  }

  function answerText(text) {
    const trimmed = text.trim();
    if ((!trimmed && photos.length === 0) || sending) return;
    const nextTurns = [...turns, { role: "user", text: trimmed || "(photos jointes)", time: nowTime() }];
    setTurns(nextTurns);
    setDraft("");
    const photosForThisTurn = photos;
    setPhotos([]);
    sendToEngine(nextTurns, photosForThisTurn);
  }

  function handleSubmit(event) {
    event.preventDefault();
    answerText(draft);
  }

  return (
    <main className="client-space">
      <ClientTopbar showBack backHref="/client/radar" />

      <div className="ct-welcome">
        <strong>Publier un chantier</strong>
        <small>Décrivez votre projet, je m'occupe du reste.</small>
      </div>

      <section className="radar-form-card radar-form-card-flush">
        <div className="radar-field radar-form-card-pad">
          <div className="radar-chat-header">
            <span className="radar-chat-header-icon"><SparkleIcon /></span>
            <div>
              <strong>Assistant koji</strong>
              <small>Décrivez votre projet, je prépare votre demande</small>
            </div>
          </div>

          <div className="radar-chat-messages">
            {turns.map((t, index) => (
              <div key={index} className={`radar-chat-row ${t.role === "user" ? "user" : "assistant"}`}>
                {t.role === "assistant" ? <span className="radar-chat-avatar"><img src="/koji-logo.svg" alt="" /></span> : null}
                <div className="radar-chat-bubble-wrap">
                  <div className={`radar-chat-bubble ${t.role === "user" ? "user" : "assistant"}`}>
                    <p>{t.text}</p>
                  </div>
                  <span className="radar-chat-meta">
                    {t.time}
                    {t.role === "user" ? <CheckIcon /> : null}
                  </span>
                </div>
              </div>
            ))}
            {sending ? (
              <div className="radar-chat-row assistant">
                <span className="radar-chat-avatar"><img src="/koji-logo.svg" alt="" /></span>
                <div className="radar-chat-bubble-wrap">
                  <div className="radar-chat-bubble assistant">
                    {streamingText ? <p>{streamingText}</p> : (
                      <div className="radar-chat-typing">
                        <span className="radar-chat-dot" /><span className="radar-chat-dot" /><span className="radar-chat-dot" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>

          {error ? <p className="profile-message error">{error}</p> : null}

          {photos.length > 0 ? (
            <div className="radar-photo-grid">
              {photos.map((photo, index) => (
                <div className="radar-photo-thumb" key={index}>
                  <img src={photo} alt={`Photo ${index + 1}`} />
                  <button type="button" onClick={() => removePhoto(index)} aria-label="Retirer la photo">×</button>
                </div>
              ))}
            </div>
          ) : null}

          <form className="radar-chat-form" onSubmit={handleSubmit}>
            <label className="radar-chat-attach" title="Ajouter une photo">
              <input type="file" accept="image/*" multiple onChange={onPhotosChange} hidden />
              <PaperclipIcon />
            </label>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Écrivez votre réponse…" disabled={sending} />
            <button type="submit" className="radar-chat-send" disabled={sending || (!draft.trim() && photos.length === 0)} aria-label="Envoyer">
              <SendIcon />
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
