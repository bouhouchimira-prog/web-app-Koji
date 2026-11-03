"use client";

import { useState, useRef, useEffect } from "react";

export function AssistantWindow({ isOpen, onClose, onSubmit, onFocus, isDraft, setDraft, draft, isBusy }) {
  const [position, setPosition] = useState({ x: 40, y: 80 });
  const [size, setSize] = useState({ width: 500, height: 400 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const windowRef = useRef(null);
  const inputRef = useRef(null);

  if (!isOpen) return null;

  const handleDragStart = (e) => {
    if (e.target.closest(".assistant-resize")) return;
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    }
    if (isResizing) {
      setSize({
        width: Math.max(300, e.clientX - position.x),
        height: Math.max(250, e.clientY - position.y)
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragOffset, position]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !isBusy) {
      e.preventDefault();
      onSubmit(draft);
    }
  };

  return (
    <div
      ref={windowRef}
      style={{
        position: "fixed",
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        background: "var(--card, #FFFFFF)",
        border: "1px solid var(--border, #D9D9D4)",
        borderRadius: "2px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
        display: "flex",
        flexDirection: "column",
        zIndex: 1000,
        userSelect: isDragging ? "none" : "auto",
        cursor: isDragging ? "grabbing" : "auto"
      }}
      className="pro"
    >
      {/* Header - Draggable */}
      <div
        onMouseDown={handleDragStart}
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border, #D9D9D4)",
          background: "var(--bar, #171B1E)",
          color: "var(--txt, #FFFFFF)",
          fontWeight: 600,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "grab",
          userSelect: "none"
        }}
      >
        <span style={{ fontSize: "14px" }}>Koji Assistant</span>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "inherit",
            cursor: "pointer",
            fontSize: "18px",
            padding: "0 4px"
          }}
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "16px",
          background: "var(--bg, #ECECE7)"
        }}
      >
        <p style={{ margin: "0 0 16px", fontSize: "13px", color: "var(--grey, #5B5F66)" }}>
          Posez votre question ou utilisez les suggestions de la page d'accueil.
        </p>
      </div>

      {/* Input Area */}
      <div
        style={{
          padding: "12px",
          borderTop: "1px solid var(--border, #D9D9D4)",
          background: "var(--card, #FFFFFF)"
        }}
      >
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={onFocus}
          placeholder="Votre question..."
          disabled={isBusy}
          style={{
            width: "100%",
            minHeight: "60px",
            padding: "12px",
            border: "1px solid var(--border, #D9D9D4)",
            borderRadius: "2px",
            fontFamily: "inherit",
            fontSize: "14px",
            color: "var(--ink, #171B1E)",
            background: "var(--card, #FFFFFF)",
            resize: "none",
            opacity: isBusy ? 0.6 : 1
          }}
        />
        <button
          onClick={() => onSubmit(draft)}
          disabled={isBusy || !draft.trim()}
          style={{
            marginTop: "8px",
            width: "100%",
            padding: "10px",
            background: "var(--accent, #FFC400)",
            color: "var(--ptxt, #171B1E)",
            border: "none",
            borderRadius: "2px",
            fontWeight: 600,
            fontSize: "14px",
            cursor: isBusy || !draft.trim() ? "not-allowed" : "pointer",
            opacity: isBusy || !draft.trim() ? 0.6 : 1
          }}
        >
          {isBusy ? "Envoi..." : "Envoyer"}
        </button>
      </div>

      {/* Resize Handle */}
      <div
        className="assistant-resize"
        onMouseDown={() => setIsResizing(true)}
        style={{
          position: "absolute",
          bottom: 0,
          right: 0,
          width: "20px",
          height: "20px",
          background: "var(--accent, #FFC400)",
          cursor: "nwse-resize",
          borderRadius: "0 0 2px 0"
        }}
      />
    </div>
  );
}
