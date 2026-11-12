"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

// Zone de signature au doigt ou à la souris (PV de réception, PRO-02.4).
// Trait noir sur fond transparent ; toDataURL() rend un PNG.
export const SignaturePad = forwardRef(function SignaturePad({ label, onChange }, ref) {
  const canvasRef = useRef(null);
  const traceRef = useRef(false);
  const [vide, setVide] = useState(true);

  function preparer() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#171B1E";
  }

  useEffect(() => {
    preparer();
  }, []);

  function changer(estVide) {
    setVide(estVide);
    onChange?.(estVide);
  }

  useImperativeHandle(ref, () => ({
    isEmpty: () => vide,
    toDataURL: () => canvasRef.current?.toDataURL("image/png") || "",
    clear: () => {
      preparer();
      changer(true);
    }
  }));

  function point(event) {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function debut(event) {
    event.preventDefault();
    canvasRef.current.setPointerCapture?.(event.pointerId);
    const ctx = canvasRef.current.getContext("2d");
    const p = point(event);
    traceRef.current = true;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.1, p.y + 0.1);
    ctx.stroke();
  }

  function trace(event) {
    if (!traceRef.current) return;
    event.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const p = point(event);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function fin() {
    if (!traceRef.current) return;
    traceRef.current = false;
    if (vide) changer(false);
  }

  return (
    <div className="cl-sign">
      <div className="cl-sign-h">
        <span className="lab">{label}</span>
        {!vide ? <button type="button" className="link" onClick={() => { preparer(); changer(true); }}>Effacer</button> : null}
      </div>
      <canvas
        ref={canvasRef}
        aria-label={label}
        role="img"
        onPointerDown={debut}
        onPointerMove={trace}
        onPointerUp={fin}
        onPointerCancel={fin}
        onPointerLeave={fin}
      />
      {vide ? <span className="cl-sign-ph" aria-hidden="true">Signez ici</span> : null}
    </div>
  );
});
