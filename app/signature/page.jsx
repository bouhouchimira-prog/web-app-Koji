"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiSend } from "../../lib/client-api";
import { euro, shortDate } from "../../lib/pricing";
import { useApi } from "../../lib/use-api";

function Toast({ message, onClose }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;
  const isError = message.toLowerCase().includes("erreur") || message.toLowerCase().includes("veuillez");
  return (
    <div className={`sig-toast${isError ? " sig-toast-error" : " sig-toast-success"}`} role="status">
      <span className="sig-toast-icon">{isError ? "⚠️" : "✓"}</span>
      <span>{message}</span>
      <button type="button" className="sig-toast-close" onClick={onClose} aria-label="Fermer">×</button>
    </div>
  );
}

export default function SignaturePage() {
  const { data: quotes, setData: setQuotes } = useApi("/api/quotes", "quotes");
  const { data: signatureSettings, setData: setSignatureSettings } = useApi("/api/signature-settings", "signatureSettings");
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const drawingRef = useRef(false);
  const [message, setMessage] = useState("");
  const [signMode, setSignMode] = useState("draw");
  const [importedImage, setImportedImage] = useState(null);
  const signable = quotes.filter((quote) => quote.status !== "Archive");
  const savedSignature = signatureSettings[0];

  useEffect(() => {
    if (signMode !== "draw") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0a1538";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);

    if (savedSignature?.signatureDataUrl) {
      const image = new Image();
      image.onload = () => {
        ctx.drawImage(image, 0, 0, rect.width, rect.height);
      };
      image.src = savedSignature.signatureDataUrl;
    }
  }, [savedSignature?.signatureDataUrl, signMode]);

  function point(event) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  function startDraw(event) {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const p = point(event);
    drawingRef.current = true;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function draw(event) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const p = point(event);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function stopDraw() {
    drawingRef.current = false;
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Le fichier sélectionné n'est pas une image.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setImportedImage(e.target.result);
    reader.readAsDataURL(file);
  }

  async function saveSignature() {
    let dataUrl;
    if (signMode === "draw") {
      const canvas = canvasRef.current;
      dataUrl = canvas.toDataURL("image/png");
    } else {
      if (!importedImage) {
        setMessage("Veuillez sélectionner une image.");
        return;
      }
      dataUrl = importedImage;
    }
    const { signatureSettings: nextSettings } = await apiSend("/api/signature-settings", {
      signatureDataUrl: dataUrl
    });
    setSignatureSettings(nextSettings || []);
    setMessage("Signature sauvegardée.");
  }

  async function updateQuote(id, action) {
    const { quote } = await apiSend("/api/quotes", { id, action }, "PATCH");
    setQuotes(quotes.map((item) => (item.id === quote.id ? quote : item)));
    if (action === "send") setMessage(`Lien de signature généré pour ${quote.quoteNumber}.`);
    if (action === "ready") setMessage(`${quote.quoteNumber} est prêt à envoyer.`);
    if (action === "archive") setMessage(`${quote.quoteNumber} est archivé.`);
  }

  async function copyLink(url) {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Lien copié.");
    } catch {
      setMessage(url);
    }
  }

  return (
    <Shell>
      <section className="mobile-tool">
        <header className="tool-topline">
          <button type="button" className="plain-back" onClick={() => (window.history.length > 1 ? window.history.back() : window.location.assign("/"))}>{"<"}</button>
          <h1>Ma Signature</h1>
          <span />
        </header>

        <section className="signature-config">
          <h2>Configuration de la signature</h2>
          <p>Cette signature sera apposée sur les devis générés et les documents envoyés à vos clients.</p>

          <div className="segmented" style={{ marginBottom: "16px" }}>
            <button type="button" className={signMode === "draw" ? "active" : ""} onClick={() => setSignMode("draw")}>Dessiner</button>
            <button type="button" className={signMode === "import" ? "active" : ""} onClick={() => setSignMode("import")}>Importer une photo</button>
          </div>

          {signMode === "draw" ? (
            <>
              <div className="signature-pad-head">
                <strong>Dessinez votre signature</strong>
                <button type="button" onClick={clearSignature}>Effacer</button>
              </div>
              <canvas
                ref={canvasRef}
                className="signature-canvas"
                onPointerDown={startDraw}
                onPointerMove={draw}
                onPointerUp={stopDraw}
                onPointerCancel={stopDraw}
                onPointerLeave={stopDraw}
              />
            </>
          ) : (
            <div className="signature-import-zone">
              {importedImage || savedSignature?.signatureDataUrl ? (
                <div className="signature-import-preview">
                  <img
                    src={importedImage || savedSignature.signatureDataUrl}
                    alt="Aperçu de la signature"
                  />
                </div>
              ) : (
                <div className="signature-import-placeholder">
                  <span>Aucune image sélectionnée</span>
                  <small>Formats acceptés : JPG, PNG, SVG, WEBP</small>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              <button type="button" className="button secondary" onClick={() => fileInputRef.current?.click()}>
                {importedImage || savedSignature?.signatureDataUrl ? "Changer l'image" : "Choisir une image"}
              </button>
              {importedImage ? (
                <button type="button" className="button danger small" onClick={() => setImportedImage(null)}>Retirer</button>
              ) : null}
            </div>
          )}

          <button type="button" className="mobile-primary" onClick={saveSignature} style={{ marginTop: "14px" }}>Sauvegarder</button>
        </section>

        <Toast message={message} onClose={() => setMessage("")} />

        <section className="signature-list">
          <h2>Devis à signer</h2>
          {signable.length === 0 ? <div className="tool-empty">Aucun devis à signer pour le moment.</div> : null}
          {signable.map((quote) => (
            <article className="quote-sign-row" key={quote.id}>
              <div>
                <strong>{quote.client}</strong>
                <small>{quote.quoteNumber} - {quote.sentAt ? shortDate(quote.sentAt) : "Non envoyé"}</small>
              </div>
              <span>{euro(quote.totalTtc)}</span>
              <div className="row-actions">
                {quote.status === "Brouillon" ? <button className="mini-button" onClick={() => updateQuote(quote.id, "ready")}>Préparer</button> : null}
                {quote.status !== "Signe" ? <button className="mini-button primary" onClick={() => updateQuote(quote.id, "send")}>Lien</button> : null}
                {quote.signatureUrl ? <Link className="mini-button" href={quote.signatureUrl}>Ouvrir</Link> : null}
                {quote.signatureUrl ? <button className="mini-button" onClick={() => copyLink(quote.signatureUrl)}>Copier</button> : null}
              </div>
            </article>
          ))}
        </section>
      </section>
    </Shell>
  );
}
