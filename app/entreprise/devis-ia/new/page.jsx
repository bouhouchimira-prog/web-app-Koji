"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// Create devis with IA assistant — guides user to create a professional quote.
// Uses /api/radar-chat (same SSE backend as client, but with entreprise prompt).
export default function EntrepriseDevisIANew() {
  const router = useRouter();
  const [turns, setTurns] = useState([]);
  const [draft, setDraft] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [draftId, setDraftId] = useState(null);
  const [finished, setFinished] = useState(false);

  const messagesEndRef = useRef(null);
  const conversationIdRef = useRef(`devis-ia-${Date.now()}`);

  useEffect(() => {
    // Auto-start conversation
    sendToEngine([{ role: "user", text: "Bonjour" }]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, streamingText]);

  const sendToEngine = async (nextTurns) => {
    setSending(true);
    setError(null);
    setStreamingText("");

    try {
      const response = await fetch("/api/radar-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turns: nextTurns.map(({ role, text }) => ({ role, text })),
          conversationId: conversationIdRef.current,
          draftId: draftId || undefined,
          mode: "entreprise-devis", // différent du client
        }),
      });

      if (!response.ok) throw new Error("Erreur serveur");
      if (!response.body) throw new Error("Pas de réponse");

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
          try {
            data = JSON.parse(dataMatch[1]);
          } catch {
            continue;
          }

          if (eventType === "delta") {
            liveText += data.text || "";
            setStreamingText(liveText);
          } else if (eventType === "done") {
            const finalMessage = data.message || liveText || "";
            if (finalMessage.trim()) {
              setTurns((prev) => [...prev, { role: "assistant", text: finalMessage }]);
            }
            setStreamingText("");
            setDraftId(data.draftId);
            if (data.finished) {
              setFinished(true);
            }
          } else if (eventType === "error") {
            setError(data.message || "Erreur");
          }
        }
      }
    } catch (err) {
      setError(err.message || "Impossible de communiquer avec l'assistant");
    } finally {
      setSending(false);
    }
  };

  const handleSendMessage = (text) => {
    if (!text.trim() || sending) return;
    const nextTurns = [...turns, { role: "user", text: text.trim() }];
    setTurns(nextTurns);
    setDraft("");
    sendToEngine(nextTurns);
  };

  if (finished && draftId) {
    return (
      <div
        style={{
          maxWidth: "600px",
          margin: "0 auto",
          padding: "40px 20px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>✓</div>
        <h1 style={{ marginBottom: "16px" }}>Devis créé avec succès !</h1>
        <p style={{ color: "#718096", marginBottom: "24px" }}>
          Votre brouillon est prêt. Vous pouvez le finaliser et l'envoyer au client.
        </p>
        <Link href={`/entreprise/devis/${draftId}`}>
          <a
            style={{
              display: "inline-block",
              backgroundColor: "#0052cc",
              color: "white",
              padding: "12px 24px",
              borderRadius: "4px",
              textDecoration: "none",
              fontWeight: "500",
            }}
          >
            Voir le devis
          </a>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link href="/entreprise/devis">
        <a style={{ color: "#0052cc", textDecoration: "none", fontWeight: "500", marginBottom: "24px", display: "inline-block" }}>
          ← Retour aux devis
        </a>
      </Link>

      <h1 style={{ marginBottom: "24px" }}>Créer un devis avec l'IA</h1>

      {error && (
        <div style={{ backgroundColor: "#fee", color: "red", padding: "12px", marginBottom: "16px", borderRadius: "4px" }}>
          {error}
        </div>
      )}

      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "8px",
          border: "1px solid #e0e6ed",
          display: "flex",
          flexDirection: "column",
          height: "600px",
        }}
      >
        {/* Chat area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {turns.map((turn, idx) => (
            <div
              key={idx}
              style={{
                marginBottom: "16px",
                display: "flex",
                justifyContent: turn.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "70%",
                  backgroundColor: turn.role === "user" ? "#0052cc" : "#f5f7fa",
                  color: turn.role === "user" ? "white" : "#2d3748",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  lineHeight: "1.4",
                }}
              >
                {turn.text}
              </div>
            </div>
          ))}

          {streamingText && (
            <div
              style={{
                marginBottom: "16px",
                display: "flex",
                justifyContent: "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "70%",
                  backgroundColor: "#f5f7fa",
                  color: "#2d3748",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  lineHeight: "1.4",
                }}
              >
                {streamingText}
              </div>
            </div>
          )}

          {sending && !streamingText && (
            <div style={{ color: "#718096", fontSize: "14px" }}>L'assistant réfléchit…</div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div style={{ borderTop: "1px solid #e0e6ed", padding: "16px" }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(draft);
            }}
            style={{ display: "flex", gap: "8px" }}
          >
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Décrivez ce devis…"
              disabled={sending || finished}
              style={{
                flex: 1,
                padding: "10px 12px",
                border: "1px solid #e0e6ed",
                borderRadius: "4px",
                fontSize: "14px",
                fontFamily: "inherit",
              }}
            />
            <button
              type="submit"
              disabled={sending || !draft.trim() || finished}
              style={{
                backgroundColor: "#0052cc",
                color: "white",
                border: "none",
                padding: "10px 16px",
                borderRadius: "4px",
                cursor: sending || !draft.trim() ? "not-allowed" : "pointer",
                fontWeight: "500",
                opacity: sending || !draft.trim() ? 0.5 : 1,
              }}
            >
              Envoyer
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
