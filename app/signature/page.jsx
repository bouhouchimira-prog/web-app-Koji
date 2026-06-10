"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiSend } from "../../lib/client-api";
import { euro, shortDate } from "../../lib/pricing";
import { useApi } from "../../lib/use-api";

export default function SignaturePage() {
  const { data: quotes, setData: setQuotes } = useApi("/api/quotes", "quotes");
  const { data: signatureSettings, setData: setSignatureSettings } = useApi("/api/signature-settings", "signatureSettings");
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const [message, setMessage] = useState("");
  const signable = quotes.filter((quote) => quote.status !== "Archive");
  const savedSignature = signatureSettings[0];

  useEffect(() => {
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
  }, [savedSignature?.signatureDataUrl]);

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

  async function saveSignature() {
    const canvas = canvasRef.current;
    const { signatureSettings: nextSettings } = await apiSend("/api/signature-settings", {
      signatureDataUrl: canvas.toDataURL("image/png")
    });
    setSignatureSettings(nextSettings || []);
    setMessage("Signature sauvegardee.");
  }

  async function updateQuote(id, action) {
    const { quote } = await apiSend("/api/quotes", { id, action }, "PATCH");
    setQuotes(quotes.map((item) => (item.id === quote.id ? quote : item)));
    if (action === "send") setMessage(`Lien de signature genere pour ${quote.quoteNumber}.`);
    if (action === "ready") setMessage(`${quote.quoteNumber} est pret a envoyer.`);
    if (action === "archive") setMessage(`${quote.quoteNumber} est archive.`);
  }

  async function copyLink(url) {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Lien copie.");
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
          <p>Cette signature sera apposee sur les devis generes et les documents envoyes a vos clients.</p>
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
          <button type="button" className="mobile-primary" onClick={saveSignature}>Sauvegarder</button>
        </section>

        {message ? <p className="tool-message">{message}</p> : null}

        <section className="signature-list">
          <h2>Devis a signer</h2>
          {signable.length === 0 ? <div className="tool-empty">Aucun devis a signer pour le moment.</div> : null}
          {signable.map((quote) => (
            <article className="quote-sign-row" key={quote.id}>
              <div>
                <strong>{quote.client}</strong>
                <small>{quote.quoteNumber} - {quote.sentAt ? shortDate(quote.sentAt) : "Non envoye"}</small>
              </div>
              <span>{euro(quote.totalTtc)}</span>
              <div className="row-actions">
                {quote.status === "Brouillon" ? <button className="mini-button" onClick={() => updateQuote(quote.id, "ready")}>Preparer</button> : null}
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
