"use client";

import { useEffect, useRef, useState } from "react";

// Chat "Avec l'IA" du devis (16 oct, maquette Artifact DevisCreerIA) —
// lecture du flux SSE calquee sur app/client/radar/new-chat/page.jsx (meme
// boucle de lecture par trames), simplifiee : pas de choix a cocher ni de
// demande de photo pour cette premiere version (texte libre uniquement).
// Chaque evenement "action" recu est applique IMMEDIATEMENT sur le devis
// ouvert via les callbacks passes en props (memes fonctions que les
// boutons "Ajouter" manuels de DevisEditor.jsx) — ce chat ne stocke rien
// lui-meme, le devis reste la seule source de verite.
function SparkleIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4 20-7z" />
    </svg>
  );
}

const FIRST_MESSAGE = "Bonjour, décrivez-moi le chantier du client en quelques mots. Je prépare le devis pendant que vous parlez.";

export function DevisChatPanel({ quoteSnapshot, onAddLot, onAddOuvrage, onUpdateOuvrage, onRemoveOuvrage, onSetPrice, onSetClient, onFinish }) {
  const [turns, setTurns] = useState(() => [{ role: "assistant", text: FIRST_MESSAGE }]);
  const [draft, setDraft] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef(null);
  const snapshotRef = useRef(quoteSnapshot);
  snapshotRef.current = quoteSnapshot;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, streamingText]);

  function applyAction(action) {
    if (!action) return;
    if (action.subAction === "addLot") onAddLot?.(action.lotName);
    else if (action.subAction === "addOuvrage") onAddOuvrage?.(action.ouvrage, action.room, action.quantity);
    else if (action.subAction === "updateOuvrage") onUpdateOuvrage?.(action.id, { quantite: action.quantite, prixUnitaireHt: action.prixUnitaireHt });
    else if (action.subAction === "removeOuvrage") onRemoveOuvrage?.(action.id);
    else if (action.subAction === "setManualPrice") onSetPrice?.(action.amountHt);
    else if (action.subAction === "setClientInfo") onSetClient?.(action.client);
  }

  async function sendToEngine(nextTurns) {
    setSending(true);
    setError("");
    setStreamingText("");
    let liveText = "";

    try {
      const response = await fetch("/api/devis-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turns: nextTurns.map(({ role, text }) => ({ role, text })),
          quoteSnapshot: snapshotRef.current
        })
      });
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "L'assistant n'a pas pu répondre.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

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
          } else if (eventType === "action") {
            applyAction(data);
          } else if (eventType === "done") {
            const finalMessage = (data.message || liveText || "").trim();
            if (finalMessage) setTurns((current) => [...current, { role: "assistant", text: finalMessage }]);
            setStreamingText("");
            if (data.finished) onFinish?.();
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

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || sending) return;
    const nextTurns = [...turns, { role: "user", text: trimmed }];
    setTurns(nextTurns);
    setDraft("");
    sendToEngine(nextTurns);
  }

  return (
    <section className="devis-chat-panel">
      <div className="devis-chat-head">
        <span className="devis-chat-head-icon"><SparkleIcon /></span>
        <div className="devis-chat-head-title">
          <strong>Assistant koji</strong>
          <small>Visite guidée de chantier</small>
        </div>
        <span className="status-pill devis-chat-status">{sending ? "En cours" : "Prêt"}</span>
      </div>

      <div className="devis-chat-thread">
        {turns.map((turn, index) => (
          <div key={index} className={`devis-chat-bubble-row ${turn.role === "user" ? "user" : ""}`}>
            <div className="devis-chat-bubble">{turn.text}</div>
          </div>
        ))}
        {streamingText ? (
          <div className="devis-chat-bubble-row">
            <div className="devis-chat-bubble">{streamingText}</div>
          </div>
        ) : null}
        <div ref={messagesEndRef} />
      </div>

      {error ? <p className="auth-error">{error}</p> : null}

      {/* <div>, pas <form> : ce panneau est rendu a l'interieur du grand
          <form> de DevisEditor.jsx — un <form> imbrique est invalide en
          HTML (avertissement React, risque de double-soumission). */}
      <div className="devis-chat-form">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(e); }}
          placeholder="Répondre à l'assistant…"
          disabled={sending}
        />
        <button type="button" onClick={handleSubmit} disabled={sending || !draft.trim()}>
          <SendIcon /> Envoyer
        </button>
      </div>
    </section>
  );
}
