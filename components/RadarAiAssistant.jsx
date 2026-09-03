"use client";

import { useState } from "react";

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
function SparkleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

const STARTER_MESSAGE = "Bonjour, j'ai des travaux à faire, aidez-moi à les décrire.";

export function RadarAiAssistant({ photos, metiers, onApply }) {
  const [started, setStarted] = useState(false);
  const [turns, setTurns] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);
  const [edited, setEdited] = useState(null);
  const [applied, setApplied] = useState(false);

  async function sendTurn(text) {
    const outgoingTurns = [...turns, { role: "user", text }];
    setTurns(outgoingTurns);
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/radar-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turns: outgoingTurns.map(({ role, text: t }) => ({ role, text: t })),
          photos: turns.length === 0 ? photos : undefined
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur de l'assistant.");
      setTurns((prev) => [...prev, { role: "assistant", text: data.message }]);
      if (data.type === "summary") {
        setSummary(data);
        setEdited({
          metier: data.metier,
          description: data.description,
          budgetMin: data.budgetMin,
          budgetMax: data.budgetMax,
          withSupplies: data.withSupplies
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  function start() {
    setStarted(true);
    sendTurn(STARTER_MESSAGE);
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    const text = draft.trim();
    setDraft("");
    sendTurn(text);
  }

  function applyEstimate() {
    onApply(edited);
    setApplied(true);
  }

  if (!started) {
    return (
      <button type="button" className="radar-ai-start-btn" onClick={start}>
        <SparkleIcon />
        Discuter avec l'assistant IA
      </button>
    );
  }

  const visibleTurns = turns.filter((t) => t.text !== STARTER_MESSAGE);

  return (
    <div className="radar-assistant-card">
      <div className="radar-chat-header">
        <span className="radar-chat-header-icon"><ChatIcon /></span>
        <div>
          <strong>Assistant Koji</strong>
          <small>Répondez à ses questions pour préparer votre demande</small>
        </div>
      </div>

      <div className="radar-chat-messages">
        {visibleTurns.map((t, index) => (
          <div key={index} className={`radar-chat-bubble ${t.role === "user" ? "user" : "assistant"}`}>
            <p>{t.text}</p>
          </div>
        ))}
        {sending ? <p className="radar-chat-empty">L'assistant réfléchit…</p> : null}
      </div>

      {error ? <p className="profile-message error">{error}</p> : null}

      {summary && edited ? (
        <div className="radar-ai-summary">
          <p className="radar-ai-summary-badge">
            {edited.budgetMin}–{edited.budgetMax} € · estimation IA, non engageante
          </p>
          <label className="radar-field">
            <span>Métier concerné</span>
            <select value={edited.metier} onChange={(e) => setEdited((c) => ({ ...c, metier: e.target.value }))}>
              <option value="">Sélectionner…</option>
              {metiers.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label className="radar-field">
            <span>Description proposée</span>
            <textarea
              rows={4}
              value={edited.description}
              onChange={(e) => setEdited((c) => ({ ...c, description: e.target.value }))}
            />
          </label>
          <div className="radar-choice-row">
            <button type="button" className={`radar-choice-btn${!edited.withSupplies ? " active" : ""}`} onClick={() => setEdited((c) => ({ ...c, withSupplies: false }))}>
              Sans fournitures
            </button>
            <button type="button" className={`radar-choice-btn${edited.withSupplies ? " active" : ""}`} onClick={() => setEdited((c) => ({ ...c, withSupplies: true }))}>
              Avec fournitures
            </button>
          </div>
          <button type="button" className="button blue" style={{ width: "100%", marginTop: 10 }} onClick={applyEstimate} disabled={applied}>
            {applied ? "Appliqué ✓" : "Utiliser cette estimation"}
          </button>
          <p className="radar-recap-note">Vous pourrez encore tout modifier aux étapes suivantes.</p>
        </div>
      ) : (
        <form className="radar-chat-form" onSubmit={handleSubmit}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Votre réponse…" disabled={sending} />
          <button type="submit" className="radar-chat-send" disabled={sending || !draft.trim()} aria-label="Envoyer">
            <SendIcon />
          </button>
        </form>
      )}
    </div>
  );
}
