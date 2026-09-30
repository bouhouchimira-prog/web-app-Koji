"use client";

// Éléments partagés par les pages « Mes demandes » du particulier
// (app/client/page.jsx et app/client/radar/page.jsx). Styles : client-home.css.

import Link from "next/link";
import { useEffect, useState } from "react";
import { euro } from "../../lib/pricing";

// ---------- Aides d'affichage ----------

export function Svg({ children, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const ChevronRight = () => <Svg size={16}><polyline points="9 18 15 12 9 6" /></Svg>;
export const IconPlus = () => <Svg size={18}><path d="M12 5v14M5 12h14" /></Svg>;
export const IconShield = () => <Svg size={16}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /><path d="M9 12l2 2 4-4" /></Svg>;

// Couleur et pictogramme par métier (mêmes teintes que le tableau de bord artisan)
const METIERS = [
  { match: ["plomb"], color: "#2f6fb5", icon: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" /> },
  { match: ["electri", "électri"], color: "#d99a1e", icon: <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /> },
  { match: ["carrel"], color: "#1f8a7a", icon: <><rect x="4" y="4" width="7" height="7" /><rect x="13" y="4" width="7" height="7" /><rect x="4" y="13" width="7" height="7" /><rect x="13" y="13" width="7" height="7" /></> },
  { match: ["menuis"], color: "#8a6a3a", icon: <><path d="M4 20V8l8-4 8 4v12" /><path d="M9 20v-6h6v6" /></> },
  { match: ["peint"], color: "#c0567a", icon: <><rect x="4" y="3" width="14" height="6" rx="1" /><path d="M18 6h2v5h-8v3" /><rect x="10" y="14" width="4" height="7" rx="1" /></> },
  { match: ["serrur"], color: "#6b5bb5", icon: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></> },
  { match: ["maçon", "macon"], color: "#a0673a", icon: <><rect x="3" y="5" width="8" height="5" /><rect x="13" y="5" width="8" height="5" /><rect x="7" y="14" width="10" height="5" /></> }
];
const METIER_DEFAUT = { color: "#172549", icon: <><path d="M3 21h18" /><path d="M5 21V10l7-5 7 5v11" /></> };

export function metierVisuel(metier) {
  const texte = String(metier || "").toLowerCase();
  return METIERS.find((m) => m.match.some((mot) => texte.includes(mot))) || METIER_DEFAUT;
}

// Titre court tiré de la description (il n'existe pas encore de titre)
const COUPURES = [",", ".", ";", " : ", " - ", " qui ", " car ", " dans ", " pour ", " avec ", " depuis ", " et "];
export function titreCourt(description) {
  const texte = String(description || "").replace(/\s+/g, " ").trim();
  if (!texte) return "Mon chantier";
  let fin = texte.length;
  for (const c of COUPURES) {
    const i = texte.toLowerCase().indexOf(c);
    if (i >= 15 && i < fin) fin = i;
  }
  let titre = texte.slice(0, fin);
  if (titre.length > 45) titre = `${titre.slice(0, 44).replace(/\s+\S*$/, "")}…`;
  return titre.charAt(0).toUpperCase() + titre.slice(1);
}

export function villeDe(offre) {
  if (offre.city) return offre.city;
  const parties = String(offre.address || "").split(",").map((p) => p.trim()).filter(Boolean);
  const derniere = parties[parties.length - 1] || "";
  return derniere.replace(/\b\d{5}\b/, "").trim();
}

export function publieLe(dateIso) {
  if (!dateIso) return "";
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return "";
  const jours = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (jours <= 0) return "Publiée aujourd'hui";
  if (jours === 1) return "Publiée hier";
  if (jours < 7) return `Publiée il y a ${jours} jours`;
  return `Publiée le ${date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`;
}

// État affiché sur chaque demande, du plus important au moins important
export function etatDemande(offre, suivi) {
  if (offre.status === "Terminee") return { texte: "Terminée", ton: "fin" };
  if (offre.status === "SansSuite") return { texte: "Sans suite", ton: "fin" };
  if (!suivi) return { texte: "…", ton: "attente" };
  if (suivi.nouveauMessage) return { texte: "Un artisan vous a écrit", ton: "action" };
  if (suivi.artisans > 0) {
    return { texte: `${suivi.artisans} artisan${suivi.artisans > 1 ? "s" : ""} intéressé${suivi.artisans > 1 ? "s" : ""}`, ton: "ok" };
  }
  return { texte: "En attente d'artisans", ton: "attente" };
}

async function lireJson(url) {
  const reponse = await fetch(url);
  if (!reponse.ok) throw new Error(String(reponse.status));
  return reponse.json();
}

// Pour chaque demande en cours : nombre d'artisans positionnés et dernier message
export function useSuivis(offres, limite = 20) {
  const [suivis, setSuivis] = useState({}); // { [offreId]: { artisans, nouveauMessage } }
  useEffect(() => {
    const actives = offres.filter((o) => o.status !== "Terminee" && o.status !== "SansSuite").slice(0, limite);
    if (!actives.length) return;
    let annule = false;
    Promise.all(actives.map(async (offre) => {
      const [pos, msg] = await Promise.all([
        lireJson(`/api/marketplace/offres/${offre.id}/positionner`).catch(() => null),
        lireJson(`/api/marketplace/offres/${offre.id}/messages`).catch(() => null)
      ]);
      const fil = Array.isArray(msg?.messages) ? msg.messages : [];
      const dernier = fil[fil.length - 1];
      return [offre.id, {
        artisans: Array.isArray(pos?.positionnements) ? pos.positionnements.length : 0,
        nouveauMessage: Boolean(dernier && dernier.senderType && dernier.senderType !== "particulier")
      }];
    })).then((paires) => {
      if (!annule) setSuivis(Object.fromEntries(paires));
    });
    return () => { annule = true; };
  }, [offres, limite]);
  return suivis;
}

// Une demande dans une liste
export function DemandeItem({ offre, suivi }) {
  const visuel = metierVisuel(offre.metier);
  const etat = etatDemande(offre, suivi);
  const ville = villeDe(offre);
  return (
    <li>
      <Link href={`/client/radar/${offre.id}`} className="kc-demande">
        <span className="kc-thumb" style={{ background: visuel.color }}><Svg>{visuel.icon}</Svg></span>
        <span className="kc-demande-text">
          <strong>{titreCourt(offre.description)}</strong>
          <small>{[offre.metier, ville, publieLe(offre.publishedAt || offre.createdAt)].filter(Boolean).join(" · ")}</small>
          {offre.priceRangeMin ? (
            <small className="kc-price">Estimation {euro(offre.priceRangeMin)} – {euro(offre.priceRangeMax)}</small>
          ) : null}
        </span>
        <span className={`kc-status is-${etat.ton}`}>{etat.texte}</span>
        <span className="kc-chevron"><ChevronRight /></span>
      </Link>
    </li>
  );
}
