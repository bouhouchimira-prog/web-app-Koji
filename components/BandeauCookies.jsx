"use client";

import { useEffect, useState } from "react";
import "./bandeau-cookies.css";

// Bandeau cookies (maquette PRO-20) : Refuser et Accepter au même niveau,
// Personnaliser en lien. Le choix est gardé dans ce navigateur ; la mesure
// d'audience ne doit être chargée que si window.kojiCookies.audience vaut true.
const CLE = "koji-cookies";

export function lireChoixCookies() {
  try { return JSON.parse(window.localStorage.getItem(CLE) || "null"); } catch { return null; }
}
function enregistrer(audience) {
  const choix = { audience: Boolean(audience), le: new Date().toISOString() };
  try { window.localStorage.setItem(CLE, JSON.stringify(choix)); } catch { /* navigateur sans stockage */ }
  window.kojiCookies = choix;
  window.dispatchEvent(new CustomEvent("koji-cookies", { detail: choix }));
  return choix;
}

export function BandeauCookies() {
  const [afficher, setAfficher] = useState(false);
  useEffect(() => {
    const c = lireChoixCookies();
    if (c) window.kojiCookies = c;
    setAfficher(!c && !window.location.pathname.startsWith("/legal/cookies"));
    const maj = () => setAfficher(false);
    window.addEventListener("koji-cookies", maj);
    return () => window.removeEventListener("koji-cookies", maj);
  }, []);
  if (!afficher) return null;
  return (
    <div className="bc" role="dialog" aria-label="Cookies">
      <p><b>Cookies</b> Koji utilise des cookies nécessaires au service et, avec votre accord, des cookies de mesure d'audience.</p>
      <div className="bc-a">
        <button type="button" onClick={() => enregistrer(false)}>Refuser</button>
        <button type="button" onClick={() => enregistrer(true)}>Accepter</button>
      </div>
      <a href="/legal/cookies">Personnaliser</a>
    </div>
  );
}

// Choix détaillé, sur la page Cookies.
export function ChoixCookies() {
  const [c, setC] = useState(null);
  useEffect(() => { setC(lireChoixCookies() || { audience: false, le: "" }); }, []);
  if (!c) return null;
  return (
    <div className="bc-choix">
      <label><input type="checkbox" checked disabled /> Cookies nécessaires au service (connexion, sécurité) · toujours actifs</label>
      <label><input type="checkbox" checked={c.audience} onChange={(e) => setC(enregistrer(e.target.checked))} /> Mesure d'audience</label>
      <small>{c.le ? `Choix enregistré le ${new Date(c.le).toLocaleDateString("fr-FR")}.` : "Aucun choix enregistré."}</small>
    </div>
  );
}
