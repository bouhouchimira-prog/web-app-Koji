"use client";

import { useEffect, useState } from "react";
import { abonnerSuppression, oublierSuppression, suppressionEnCours } from "../lib/annuler-suppression";

// « Devis 2026-039 supprimé · Annuler · 8 s » (maquette PRO-19.1), puis
// l'élément reste 30 jours dans Paramètres › Éléments supprimés.
export function AnnulerSuppression() {
  const [s, setS] = useState(null);
  const [reste, setReste] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setS(suppressionEnCours());
    return abonnerSuppression(setS);
  }, []);
  useEffect(() => {
    if (!s) return undefined;
    const tick = () => {
      const r = Math.ceil((s.jusqua - Date.now()) / 1000);
      if (r <= 0) oublierSuppression(); else setReste(r);
    };
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [s]);
  if (!s) return null;
  return (
    <div className="as" role="status">
      <span>{s.label}</span>
      <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await s.annuler(); } finally { setBusy(false); oublierSuppression(); } }}>Annuler</button>
      <small>{reste} s</small>
    </div>
  );
}
