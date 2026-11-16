"use client";

import { fetchWithAuthRetry } from "../../lib/client-api";
import { fichierPourEnvoi } from "../../lib/fichier-client";

// Photo de la KojiPage : réduite à 1 600 px puis envoyée au stockage privé.
export async function envoyerPhoto(file) {
  const dataUrl = await fichierPourEnvoi(file, { cote: 1600, qualite: 0.82 });
  const blob = await (await fetch(dataUrl)).blob();
  const fd = new FormData();
  fd.append("photo", blob, "photo.jpg");
  const res = await fetchWithAuthRetry(() => fetch("/api/kojipage", { method: "POST", body: fd }));
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Photo non enregistrée.");
  return data;
}

export function Bascule({ on, onChange, label, disabled }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className={`kj2-sw${on ? " on" : ""}`} onClick={() => onChange(!on)}><i /></button>;
}
