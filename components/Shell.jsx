"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiSend } from "../lib/client-api";
import { useLocale } from "../lib/i18n";
import { useApi } from "../lib/use-api";
import "./shell-layout.css";

// Menu restructure en 2 groupes (23 septembre, Koji Premium) : "principal"
// toujours accessible, "premium" verrouille sauf abonnement Koji Premium
// (ou compte admin) — Devis reste en principal, necessaire pour creer un
// devis a partir d'une offre publiee sur le Marketplace, lui-meme gratuit.
function getNavItems(L) {
  return [
    { href: "/",                      label: L.nav.home,        icon: "home",    group: "principal", color: "#1d74ff" },
    { href: "/bibliotheque-ouvrages", label: L.nav.library,     icon: "book",    group: "principal", color: "#7c4dff" },
    { href: "/marketplace",           label: L.nav.marketplace, icon: "market",  group: "principal", color: "#12b3a8" },
    { href: "/archives",              label: L.nav.archives,    icon: "archive", group: "principal", color: "#6b7280" },
    { href: "/devis",                 label: L.nav.quotes,      icon: "file",    group: "principal", color: "#f2994a" },
    { href: "/chantiers",             label: L.nav.projects,    icon: "tools",    group: "premium", color: "#e6398b" },
    { href: "/interventions",         label: L.nav.interventions, icon: "wrench", group: "premium", color: "#ff8a3d" },
    { href: "/calendrier",            label: L.nav.calendar,    icon: "calendar", group: "premium", color: "#5b5fc7" },
    { href: "/contacts",              label: L.nav.contacts,    icon: "user",     group: "premium", color: "#2fa1e8" },
    { href: "/equipe",                label: L.nav.team,        icon: "users",    group: "premium", color: "#8a5cf6" },
    { href: "/facturation",           label: L.nav.invoicing,   icon: "invoice",  group: "premium", color: "#17ad5b" },
    { href: "/fournitures",           label: L.nav.supplies,    icon: "box",      group: "premium", color: "#b08542" },
  ];
}

const PREMIUM_PATHS = ["/calendrier", "/planning", "/chantiers", "/contacts", "/equipe", "/facturation", "/fournitures", "/interventions"];

const FREE_PATHS = ["/login", "/activate", "/set-password", "/abonnement"];

const NOTIF_TYPE_ICONS = {
  "quote.draft": "✏️",
  "quote.signed": "✅",
  "quote.updated": "📄",
  "client.access.sent": "👤",
  "budget.alert": "⚠️",
  "marketplace.interest": "🌟",
  "company.worker_claim": "🔧",
  "task.completed": "🛠️",
  "client.note": "💬",
  "worker.time_overrun": "⏱️",
  "company.time_overrun": "⏱️",
  "urgent.alert": "🚨",
  "radar.expertise_publiee": "🧭"
};

// Initiales affichees dans la photo de profil quand aucun logo n'est
// renseigne (raison sociale, sinon nom du compte).
function initialsFrom(text) {
  const clean = String(text || "").trim();
  if (!clean) return "?";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function kojiGreeting(firstName) {
  const hour = new Date().getHours();
  const base = hour >= 18 || hour < 5 ? "Bonsoir" : "Bonjour";
  return firstName ? `${base} ${firstName}` : base;
}

function formatRelativeTime(value) {
  if (!value) return "";
  const date = new Date(value);
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  if (diff < 172800) return "Hier";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(date);
}

function getTrialInfo(user) {
  if (!user) return { daysLeft: 0, expired: true, subscribed: false };
  if (user.isAdmin || user.plan === "active" || user.plan === "subscribed" || !user.trialStartedAt) {
    return { daysLeft: Infinity, expired: false, subscribed: true };
  }
  const start = new Date(user.trialStartedAt);
  const now = new Date();
  const daysUsed = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  const daysLeft = Math.max(0, 7 - daysUsed);
  return { daysLeft, expired: daysLeft === 0, subscribed: false };
}

// Symbole koji (meme forme que public/koji-logo.svg) rendu inline en
// currentColor plutot qu'un <img> fige — pour l'assistant koji, a la place
// de l'etoile, tout en restant reteignable via CSS (bleu marine sur fond
// blanc, blanc sur la bulle).
function KojiSymbol({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 76 75" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path fill="currentColor" d="M75.5188 0.0462758C75.4602 0.0288482 75.3146 -0.0014607 75.0001 5.47421e-05C66.5238 0.0621879 57.7947 0.0750692 49.0555 0.0386986C48.1338 0.0364254 47.5751 0.289505 46.9077 1.01237C37.1745 11.5477 27.2524 22.2346 17.6563 32.57L14.4296 36.0449C14.1814 36.3124 13.9171 36.5533 13.5827 36.8594C13.4008 37.0254 13.1942 37.2141 12.9515 37.4421L11.5928 38.7181L11.3932 36.8814C11.3563 36.5435 11.3185 36.2548 11.2854 36.0002C11.2206 35.5054 11.169 35.1144 11.169 34.6992V34.4703C11.169 23.4175 11.169 11.988 11.2129 0.746411C11.2145 0.368308 11.1767 0.212217 11.1567 0.156145C11.1043 0.139476 10.9655 0.109924 10.6611 0.12129C8.77227 0.189485 6.85953 0.18115 5.00844 0.173573C4.28094 0.170542 3.52802 0.167511 2.78974 0.169027C1.94126 0.170542 1.09201 0.170542 0.239671 0.169784H0V68.0359C7.0468 60.4951 13.4231 53.671 19.9027 46.725L23.9209 42.4181C32.919 32.7738 42.223 22.8007 51.3444 12.9662C52.4317 11.794 53.5785 11.2992 55.0604 11.3613C57.2321 11.453 59.3367 11.4614 61.3158 11.3871C61.9554 11.3629 62.7638 11.406 63.3464 11.9599C63.9352 12.5191 64.0076 13.3291 64.0053 13.9724C63.9745 22.1786 63.9822 30.5234 63.9899 38.5931C63.993 41.7513 63.9953 44.9087 63.9961 48.0669C63.9961 48.2829 63.9968 48.4988 63.9976 48.7148C64.0015 49.7824 64.0053 50.8864 63.9244 51.9836C63.7387 54.5151 62.9334 56.6716 61.5308 58.3916C60.1721 60.0586 58.2447 61.3248 55.8018 62.1552C53.5076 62.9357 51.134 63.019 48.9376 62.3977C46.7713 61.7839 44.7584 60.4784 43.1154 58.6212C42.2715 57.668 41.4184 56.6958 40.5923 55.7563C39.5142 54.5288 38.399 53.2596 37.2955 52.0184C35.8621 50.406 34.4456 48.8299 32.9459 47.1614C32.5136 46.6803 32.079 46.1961 31.6405 45.7081L23.7452 54.2636C24.9358 55.5661 26.135 56.8959 27.2963 58.1833C30.103 61.2952 33.0053 64.5133 35.9761 67.5563C39.9742 71.6502 45.0605 73.856 51.0939 74.1106C57.6074 74.3856 63.7341 72.1503 68.3479 67.8169C72.9602 63.4843 75.5103 57.571 75.528 51.1667C75.5527 42.1824 75.5527 33.0473 75.5519 24.2131C75.5519 16.4782 75.5512 8.47972 75.5673 0.613052C75.5673 0.260711 75.5373 0.107651 75.518 0.0462758H75.5188Z" />
    </svg>
  );
}

function Icon({ name, className = "" }) {
  const base = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "menu":
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <path {...base} d="M3 6h18M3 12h13M3 18h10" />
        </svg>
      );
    case "home":
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <path {...base} d="M3 11l9-8 9 8" />
          <path {...base} d="M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
        </svg>
      );
    case "bell":
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <path {...base} d="M15 17H5l2-2v-4a5 5 0 1110 0v4l2 2h-4" />
          <path {...base} d="M9 19a3 3 0 006 0" />
        </svg>
      );
    case "user":
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <circle {...base} cx="12" cy="8" r="4" />
          <path {...base} d="M4 20a8 8 0 0116 0" />
        </svg>
      );
    case "calendar":
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <rect {...base} x="3" y="5" width="18" height="16" rx="2" />
          <path {...base} d="M16 3v4M8 3v4M3 10h18" />
        </svg>
      );
    case "file":
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <path {...base} d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
          <path {...base} d="M14 3v5h5M9 13h6M9 17h6" />
        </svg>
      );
    case "invoice":
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <path {...base} d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" />
          <path {...base} d="M9 8h6M9 12h6M9 16h4" />
        </svg>
      );
    case "tools":
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <path {...base} d="M4 20l6-6M14 10l6-6M13 6l5 5M8 11l5 5" />
          <circle {...base} cx="7" cy="7" r="2.5" />
          <circle {...base} cx="17" cy="17" r="2.5" />
        </svg>
      );
    case "box":
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <path {...base} d="M3 7l9-4 9 4-9 4-9-4z" />
          <path {...base} d="M3 7v10l9 4 9-4V7" />
          <path {...base} d="M12 11v10" />
        </svg>
      );
    case "users":
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <circle {...base} cx="9" cy="8" r="3" />
          <circle {...base} cx="17" cy="10" r="2.5" />
          <path {...base} d="M3 20a6 6 0 0112 0M14 20a4 4 0 018 0" />
        </svg>
      );
    case "pen":
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <path {...base} d="M3 21l4-1 11-11-3-3L4 17l-1 4zM14 6l3 3" />
        </svg>
      );
    case "archive":
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <rect {...base} x="3" y="4" width="18" height="4" rx="1" />
          <path {...base} d="M5 8v11a2 2 0 002 2h10a2 2 0 002-2V8M10 13h4" />
        </svg>
      );
    case "book":
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <path {...base} d="M4 5a3 3 0 013-3h13v18H7a3 3 0 01-3-3V5z" />
          <path {...base} d="M7 2v15a3 3 0 003 3" />
        </svg>
      );
    case "market":
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <path {...base} d="M3 9l1-5h16l1 5" />
          <path {...base} d="M3 9a3 3 0 006 0 3 3 0 006 0 3 3 0 006 0" />
          <path {...base} d="M5 9v11h14V9" />
          <path {...base} d="M10 21v-6h4v6" />
        </svg>
      );
    case "settings":
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <circle {...base} cx="12" cy="12" r="3.5" />
          <path {...base} d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1" />
        </svg>
      );
    case "logout":
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <path {...base} d="M10 4H6a2 2 0 00-2 2v12a2 2 0 002 2h4" />
          <path {...base} d="M13 16l4-4-4-4M9 12h8" />
        </svg>
      );
    case "lock":
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <rect {...base} x="5" y="11" width="14" height="9" rx="2" />
          <path {...base} d="M8 11V7a4 4 0 018 0v4" />
        </svg>
      );
    case "wrench":
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <path {...base} d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      );
    case "help":
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <circle {...base} cx="12" cy="12" r="9" />
          <path {...base} d="M9.5 9a2.5 2.5 0 015 0c0 2-2.5 2-2.5 4.5" />
          <path {...base} d="M12 17.5h.01" />
        </svg>
      );
    case "chevron-down":
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <polyline {...base} points="6 9 12 15 18 9" />
        </svg>
      );
    default:
      return null;
  }
}

export function Shell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { L } = useLocale();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);
  // Menu deroulant sur l'avatar (30 sept, demande d'Amira) : Profil /
  // Parametres / Deconnexion accessibles directement au clic sur l'avatar,
  // sans dependre du bouton menu du panneau lateral (.side-rail) — ce
  // dernier peut se retrouver cache (ex: mauvais profileType en cache), ce
  // qui rendait la deconnexion inaccessible en version bureau.
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef(null);

  // Assistant koji (15 septembre, historique en menu deroulant le 19) —
  // widget flottant bas-droite, visible sur toutes les pages entreprise
  // puisque c'est ici, dans Shell, que ces pages sont toutes encadrees (30
  // pages verifiees, aucune page particulier/ouvrier n'utilise ce
  // composant). Shell est instancie par page (pas un app/layout.jsx
  // persistant) : une navigation le remonte, donc l'ouvert/ferme et une
  // clarification en cours ne survivent pas au changement de page — seul
  // l'etat ouvert/ferme est memorise dans localStorage pour attenuer ca.
  // Les discussions, elles, sont reellement persistees cote serveur
  // (db.kojiAssistantMessages, regroupees par conversationId) et se
  // rechargent a la demande.
  const [kojiAssistantOpen, setKojiAssistantOpen] = useState(false);
  const [kojiAssistantExpanded, setKojiAssistantExpanded] = useState(false);
  // Menu deroulant d'historique (comme le menu notifications juste au-dessus
  // dans ce meme fichier) — ouvre par-dessus la conversation en cours, ne la
  // remplace jamais.
  const [kojiAssistantMenuOpen, setKojiAssistantMenuOpen] = useState(false);
  const kojiAssistantMenuRef = useRef(null);
  const kojiAssistantInputRef = useRef(null);
  const [kojiAssistantConversations, setKojiAssistantConversations] = useState([]);
  const [kojiAssistantConversationId, setKojiAssistantConversationId] = useState("");
  const [kojiAssistantMessages, setKojiAssistantMessages] = useState([]);
  const [kojiAssistantDraft, setKojiAssistantDraft] = useState("");
  const [kojiAssistantBusy, setKojiAssistantBusy] = useState(false);
  const [kojiAssistantClarification, setKojiAssistantClarification] = useState(null);
  const [kojiAssistantLive, setKojiAssistantLive] = useState(null);
  const [kojiAssistantNotice, setKojiAssistantNotice] = useState("");
  // Suggestions affichees quand la demande est hors-perimetre (ex: "pizza")
  // — distinctes de kojiAssistantClarification pour que le prochain message
  // reparte de zero (pas de conversation.state/question a reinjecter).
  const [kojiAssistantSuggestions, setKojiAssistantSuggestions] = useState([]);
  const [kojiAssistantPhotos, setKojiAssistantPhotos] = useState([]);

  function newKojiConversationId() {
    return `koji-conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async function loadKojiConversations() {
    try {
      const data = await apiGet("/api/koji-assistant");
      setKojiAssistantConversations(data.conversations || []);
    } catch { /**/ }
  }

  async function reloadKojiMessages(conversationId) {
    if (!conversationId) return;
    try {
      const data = await apiGet(`/api/koji-assistant?conversationId=${encodeURIComponent(conversationId)}`);
      setKojiAssistantMessages(data.messages || []);
    } catch { /**/ }
  }

  useEffect(() => {
    try {
      if (window.localStorage.getItem("koji-assistant-open") === "1") setKojiAssistantOpen(true);
    } catch { /**/ }
  }, []);

  useEffect(() => {
    function handleClick(e) {
      if (kojiAssistantMenuRef.current && !kojiAssistantMenuRef.current.contains(e.target)) setKojiAssistantMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggleKojiAssistant() {
    setKojiAssistantOpen((prev) => {
      const next = !prev;
      try { window.localStorage.setItem("koji-assistant-open", next ? "1" : "0"); } catch { /**/ }
      if (!next) setKojiAssistantMenuOpen(false);
      return next;
    });
  }

  function toggleKojiAssistantMenu() {
    setKojiAssistantMenuOpen((prev) => {
      const next = !prev;
      if (next) loadKojiConversations();
      return next;
    });
  }

  function openKojiConversation(id) {
    setKojiAssistantConversationId(id);
    setKojiAssistantMenuOpen(false);
    setKojiAssistantClarification(null);
    setKojiAssistantLive(null);
    setKojiAssistantNotice("");
    setKojiAssistantSuggestions([]);
    reloadKojiMessages(id);
  }

  function startNewKojiConversation() {
    setKojiAssistantConversationId(newKojiConversationId());
    setKojiAssistantMenuOpen(false);
    setKojiAssistantMessages([]);
    setKojiAssistantDraft("");
    setKojiAssistantClarification(null);
    setKojiAssistantLive(null);
    setKojiAssistantNotice("");
    setKojiAssistantSuggestions([]);
    setKojiAssistantPhotos([]);
  }

  async function submitKojiAssistant(text) {
    const value = String(text || "").trim();
    if (!value || kojiAssistantBusy) return;
    setKojiAssistantBusy(true);
    setKojiAssistantNotice("");
    const activeConversationId = kojiAssistantConversationId || newKojiConversationId();
    if (!kojiAssistantConversationId) setKojiAssistantConversationId(activeConversationId);
    // Sur la page devis, l'assistant peut ajouter des ouvrages/fournitures/
    // lots directement dans la page ouverte (20 septembre) — voir l'ecoute
    // de "koji-devis-page-action" dans app/devis/DevisEditor.jsx.
    // Sur la fiche d'un chantier (8 oct), une depense/tache/alerte/visite
    // creee sans chantier nomme explicitement se rattache directement a CE
    // chantier (voir handleCreate dans app/api/koji-assistant/route.js) — le
    // selecteur de chantier de app/chantiers/page.jsx vit en dehors du
    // routeur Next (window.history.replaceState, pas de re-render ici), donc
    // on relit directement l'URL au moment de l'envoi plutot que via un hook.
    const chantierIdInUrl = pathname === "/chantiers" && typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("project")
      : "";
    const pageContext = pathname?.startsWith("/devis")
      ? { page: "devis" }
      : chantierIdInUrl
        ? { page: "chantier", chantierId: chantierIdInUrl }
        : undefined;
    const payload = kojiAssistantClarification
      ? { message: value, conversationId: activeConversationId, conversation: { question: kojiAssistantClarification.question, originalMessage: kojiAssistantClarification.originalMessage, state: kojiAssistantClarification.state }, pageContext }
      : { message: value, conversationId: activeConversationId, photos: kojiAssistantPhotos, pageContext };
    try {
      const data = await apiSend("/api/koji-assistant", payload, "POST");
      setKojiAssistantDraft("");
      setKojiAssistantPhotos([]);
      setKojiAssistantSuggestions([]);
      if (data.conversationId) setKojiAssistantConversationId(data.conversationId);
      if (data.outcome === "clarify") {
        setKojiAssistantClarification({ question: data.question, quickReplies: data.quickReplies || [], originalMessage: data.originalMessage, state: data.state });
        setKojiAssistantLive(null);
      } else if (data.outcome === "created" || data.outcome === "confirmDelete" || data.outcome === "updated") {
        setKojiAssistantLive(data);
        setKojiAssistantClarification(null);
      } else if (data.outcome === "failed") {
        setKojiAssistantNotice(data.message || "L'action a échoué.");
        setKojiAssistantClarification(null);
        setKojiAssistantLive(null);
      } else if (data.outcome === "unsupported") {
        setKojiAssistantNotice(data.message || "Je n'ai pas ce service.");
        setKojiAssistantSuggestions(data.quickReplies || []);
        setKojiAssistantClarification(null);
        setKojiAssistantLive(null);
      } else if (data.outcome === "navigate") {
        setKojiAssistantClarification(null);
        setKojiAssistantLive(null);
        toggleKojiAssistant();
        router.push(data.path);
      } else if (data.outcome === "devisPageAction") {
        window.dispatchEvent(new CustomEvent("koji-devis-page-action", { detail: data }));
        setKojiAssistantNotice(`✓ Ajouté sur le devis : ${data.label}`);
        setKojiAssistantClarification(null);
        setKojiAssistantLive(null);
      } else {
        setKojiAssistantNotice("Je n'ai pas compris votre demande.");
        setKojiAssistantClarification(null);
        setKojiAssistantLive(null);
      }
      if (data.outcome !== "navigate") await reloadKojiMessages(data.conversationId || activeConversationId);
    } catch (error) {
      setKojiAssistantNotice(error.message || "Une erreur est survenue.");
    } finally {
      setKojiAssistantBusy(false);
    }
  }

  function performKojiDelete(deleteRoute, deleteMethod, id) {
    if (deleteMethod === "query-delete") return apiSend(`${deleteRoute}?id=${encodeURIComponent(id)}`, {}, "DELETE");
    const action = deleteMethod === "patch-resolve" ? "resolve" : "delete";
    return apiSend(deleteRoute, { id, action }, "PATCH");
  }

  async function undoKojiAssistantCreate() {
    if (!kojiAssistantLive) return;
    try {
      await performKojiDelete(kojiAssistantLive.deleteRoute, kojiAssistantLive.deleteMethod, kojiAssistantLive.id);
    } catch { /**/ }
    setKojiAssistantLive(null);
  }

  async function confirmKojiAssistantDelete() {
    if (!kojiAssistantLive) return;
    setKojiAssistantBusy(true);
    try {
      await performKojiDelete(kojiAssistantLive.deleteRoute, kojiAssistantLive.deleteMethod, kojiAssistantLive.id);
      setKojiAssistantNotice(`${kojiAssistantLive.typeLabel} supprimé.`);
    } catch (error) {
      setKojiAssistantNotice(error.message || "La suppression a échoué.");
    } finally {
      setKojiAssistantBusy(false);
      setKojiAssistantLive(null);
    }
  }

  function handleKojiPhotoChange(event) {
    const files = Array.from(event.target.files || []).slice(0, Math.max(0, 8 - kojiAssistantPhotos.length));
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => setKojiAssistantPhotos((prev) => (prev.length >= 8 ? prev : [...prev, reader.result]));
      reader.readAsDataURL(file);
    });
    event.target.value = "";
  }

  useEffect(() => {
    function handleClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target)) setAvatarMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);
  const [profileType, setProfileType] = useState("entreprise");
  const [kojiUserName, setKojiUserName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [premiumTools, setPremiumTools] = useState(false);
  const [trial, setTrial] = useState({ daysLeft: Infinity, expired: false, subscribed: true });
  // Photo de profil dans la barre du haut (29 septembre) : logo de
  // l'entreprise si renseigne (profile.logo_url, voir lib/user-profile.js),
  // sinon les initiales de la raison sociale ou du nom du compte.
  const [avatarLogo, setAvatarLogo] = useState("");
  const [avatarLabel, setAvatarLabel] = useState("");
  // Repli sur les initiales si l'image ne charge pas (lien casse/inaccessible)
  // plutot que l'icone d'image cassee du navigateur (30 septembre).
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  // Groupe "Gestion" (outils Koji Premium) repliable (29 septembre) :
  // ouvert par defaut des qu'on est deja sur une de ces pages, sinon replie.
  const [gestionOpen, setGestionOpen] = useState(() => PREMIUM_PATHS.some((p) => pathname.startsWith(p)));
  const { data: notifications, setData: setNotifications } = useApi("/api/notifications", "notifications");
  const unreadCount = notifications.filter((n) => !n.read && !n.archived).length;
  // Point rouge sur "Marketplace" / "Trouvez un chantier" (26 septembre,
  // demande d'Amira) : reutilise la meme notification que la cloche
  // (radar.expertise_publiee, creee par app/api/chantier-offres/route.js a
  // chaque nouvelle offre publiee) plutot qu'un nouveau systeme separe.
  const hasNewMarketplaceOffers = notifications.some((n) => n.type === "radar.expertise_publiee" && !n.read && !n.archived);
  const recentNotifications = useMemo(() => {
    return [...notifications]
      .filter((n) => !n.archived)
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .slice(0, 5);
  }, [notifications]);

  async function markNotifRead(notif) {
    if (notif.read) return;
    try {
      const { notification: updated } = await apiSend("/api/notifications", { id: notif.id, action: "read" }, "PATCH");
      setNotifications((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    } catch { /* ignore */ }
  }
  const navItems = getNavItems(L);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (PREMIUM_PATHS.some((p) => pathname.startsWith(p))) setGestionOpen(true);
  }, [pathname]);

  useEffect(() => {
    function blurNumberInputOnWheel(event) {
      if (document.activeElement?.tagName === "INPUT" && document.activeElement.type === "number") {
        document.activeElement.blur();
      }
    }
    document.addEventListener("wheel", blurNumberInputOnWheel, { passive: true });
    return () => document.removeEventListener("wheel", blurNumberInputOnWheel);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("koji-user");
      if (!raw) {
        router.replace("/login?type=entreprise");
        return;
      }
      const parsed = JSON.parse(raw);
      // The session token itself lives in an HttpOnly cookie now (see
      // lib/session-cookies.js), not in this localStorage entry — this is
      // just cached profile data, so all we can check here is that it looks
      // like a real profile. If the cookie is missing/expired, the first API
      // call will 401 and lib/client-api.js's fetchWithAuthRetry sends the
      // user back to /login.
      if (!parsed?.id) {
        window.localStorage.removeItem("koji-user");
        router.replace("/login?type=entreprise");
        return;
      }
      if (parsed?.accountType === "particulier") setProfileType("particulier");
      else setProfileType("entreprise");
      if (parsed?.name) setKojiUserName(String(parsed.name).trim().split(" ")[0]);
      setAvatarLogo(parsed?.logoUrl || "");
      setAvatarLoadError(false);
      setAvatarLabel(parsed?.business?.raisonSociale || parsed?.name || "");
      const isAdminNow = Boolean(parsed?.isAdmin);
      if (isAdminNow) setIsAdmin(true);
      setPremiumTools(Boolean(parsed?.premiumTools));
      const trialInfo = getTrialInfo(parsed);
      setTrial(trialInfo);
      if (trialInfo.expired && !FREE_PATHS.some((p) => pathname.startsWith(p))) {
        router.replace("/abonnement");
      }
      // Koji Premium (23 septembre) : abonnement distinct de Koji Pro,
      // gratuit pour les admins — verrouille les outils Calendrier/
      // Chantiers/Contacts/Equipe/Facturation/Fournitures tant qu'il n'est
      // pas pris, meme mecanisme de redirection que le trial expire ci-dessus.
      if (!isAdminNow && !parsed?.premiumTools && PREMIUM_PATHS.some((p) => pathname.startsWith(p))) {
        router.replace("/abonnement");
      }
    } catch {
      window.localStorage.removeItem("koji-user");
      router.replace("/login?type=entreprise");
    }
  }, [pathname]);

  function logout() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("koji-user");
      fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    }
    router.push("/login?type=entreprise");
  }

  return (
    <div className="web-shell">
      <header className="app-topbar">
        <button type="button" className="icon-round menu-toggle-btn" onClick={() => setDrawerOpen(true)} aria-label={L.shell.openMenu}>
          <Icon name="menu" className="svg-icon" />
        </button>
        <Link href="/" className="topbar-logo" aria-label={L.shell.spaceCompany}>
          <img src="/koji-logo.svg" alt="Koji" />
        </Link>
        <div className="topbar-right">
          <div className="topbar-notif" ref={notifRef}>
            <button
              type="button"
              className="icon-round notif-bell-link"
              aria-label={L.shell.notifications}
              aria-haspopup="true"
              aria-expanded={notifOpen}
              onClick={() => setNotifOpen((open) => !open)}
            >
              <Icon name="bell" className="svg-icon" />
              {unreadCount > 0 ? <span className="notif-bell-badge">{unreadCount > 9 ? "9+" : unreadCount}</span> : null}
            </button>
            {notifOpen ? (
              <div className="notif-dropdown">
                <div className="notif-dropdown-head">{L.shell.notifications}</div>
                {recentNotifications.length === 0 ? (
                  <p className="notif-dropdown-empty">{L.notifications.noResults}</p>
                ) : (
                  <ul className="notif-dropdown-list">
                    {recentNotifications.map((notif) => (
                      <li key={notif.id} className={notif.read ? "" : "unread"}>
                        <Link
                          href={`/notifications/${notif.id}`}
                          onClick={() => { markNotifRead(notif); setNotifOpen(false); }}
                        >
                          <span className="notif-dropdown-icon" aria-hidden="true">{NOTIF_TYPE_ICONS[notif.type] || "🔔"}</span>
                          <span className="notif-dropdown-body">
                            <span className="notif-dropdown-row-top">
                              <strong>{notif.title}</strong>
                              <time>{formatRelativeTime(notif.createdAt)}</time>
                            </span>
                            <span className="notif-dropdown-message">{notif.message}</span>
                          </span>
                          {!notif.read ? <span className="notif-dropdown-dot" aria-hidden="true" /> : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <Link href="/notifications" className="notif-dropdown-footer" onClick={() => setNotifOpen(false)}>
                  {L.shell.seeAllNotifications}
                </Link>
              </div>
            ) : null}
          </div>
          <div className="topbar-avatar" ref={avatarMenuRef}>
            <button
              type="button"
              className="icon-round avatar-btn"
              aria-label={L.nav.profile}
              aria-expanded={avatarMenuOpen}
              onClick={() => setAvatarMenuOpen((v) => !v)}
            >
              {avatarLogo && !avatarLoadError ? (
                <img src={avatarLogo} alt="" className="avatar-btn-img" onError={() => setAvatarLoadError(true)} />
              ) : (
                <span className="avatar-btn-initials">{initialsFrom(avatarLabel)}</span>
              )}
            </button>
            {avatarMenuOpen ? (
              <ul className="avatar-dropdown">
                <li>
                  <Link href="/profil" onClick={() => setAvatarMenuOpen(false)}>
                    <Icon name="user" className="svg-icon" />{L.nav.profile}
                  </Link>
                </li>
                <li>
                  <Link href="/parametres" onClick={() => setAvatarMenuOpen(false)}>
                    <Icon name="settings" className="svg-icon" />{L.nav.settings}
                  </Link>
                </li>
                <li>
                  <button type="button" onClick={logout}>
                    <Icon name="logout" className="svg-icon" />{L.nav.logout}
                  </button>
                </li>
              </ul>
            ) : null}
          </div>
        </div>
      </header>

      {profileType !== "particulier" ? (
        <nav className="side-rail" aria-label="nav bureau">
          <button type="button" className="side-rail-item side-rail-menu-btn" onClick={() => setDrawerOpen(true)} aria-label={L.shell.openMenu}>
            <span className="side-rail-icon side-rail-icon-neutral"><Icon name="menu" className="svg-icon" /></span>
          </button>
          <div className="side-rail-divider" />
          {navItems.filter((item) => item.group === "principal").map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link href={item.href} key={item.href} className={`side-rail-item${active ? " active" : ""}`} title={item.label}>
                <span className="side-rail-icon" style={{ background: item.color }}><Icon name={item.icon} className="svg-icon" /></span>
                {item.href === "/marketplace" && hasNewMarketplaceOffers ? <span className="side-rail-dot" aria-label="Nouvelles offres" /> : null}
              </Link>
            );
          })}
          <div className="side-rail-divider" />
          {navItems.filter((item) => item.group === "premium").map((item) => {
            const active = item.href === "/calendrier"
              ? pathname.startsWith("/calendrier") || pathname.startsWith("/planning")
              : pathname.startsWith(item.href);
            const locked = !isAdmin && !premiumTools;
            return (
              <Link href={locked ? "/abonnement" : item.href} key={item.href} className={`side-rail-item${active ? " active" : ""}${locked ? " locked" : ""}`} title={item.label}>
                <span className="side-rail-icon" style={{ background: locked ? "#c7cddb" : item.color }}><Icon name={item.icon} className="svg-icon" /></span>
                {locked ? <Icon name="lock" className="svg-icon side-rail-lock" /> : null}
              </Link>
            );
          })}
        </nav>
      ) : null}

      <div className={`drawer-backdrop ${drawerOpen ? "open" : ""}`} onClick={() => setDrawerOpen(false)} />
      <aside className={`drawer ${drawerOpen ? "open" : ""}`} aria-label={L.nav.settings}>
        <div className="drawer-brand">
          <img src="/koji-logo.svg" alt="Koji" />
          <div>
            <strong>Koji</strong>
            <small>{profileType === "particulier" ? L.shell.spacePersonal : L.shell.spaceCompany}</small>
          </div>
        </div>
        {isAdmin && (
          <div className="admin-badge">
            <span>{L.shell.admin}</span>
            <small>{L.shell.adminHint}</small>
          </div>
        )}
        {isAdmin && (
          <Link href="/admin/clients" className="drawer-nav-section" style={{ display: "block", textDecoration: "none" }} onClick={() => setDrawerOpen(false)}>
            🗂️ Conversations enregistrées
          </Link>
        )}

        {profileType !== "particulier" ? (
          <Link href="/marketplace" className="drawer-hero-cta">
            <Icon name="market" className="svg-icon" />
            {L.shell.findSite}
            {hasNewMarketplaceOffers ? <span className="drawer-hero-cta-dot" aria-label="Nouvelles offres" /> : null}
          </Link>
        ) : null}

        <nav className="drawer-nav" aria-label="nav">
          <span className="drawer-nav-section">{L.nav.sectionPrincipal}</span>
          {navItems.filter((item) => item.group === "principal").map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link href={item.href} className={active ? "active" : ""} key={item.href}>
                <span className="drawer-nav-icon" style={{ background: item.color }}><Icon name={item.icon} className="svg-icon" /></span>
                {item.label}
                {item.href === "/marketplace" && hasNewMarketplaceOffers ? (
                  <span className="drawer-nav-dot" aria-label="Nouvelles offres" />
                ) : null}
              </Link>
            );
          })}

          <button
            type="button"
            className="drawer-nav-section drawer-nav-section-premium drawer-gestion-toggle"
            onClick={() => setGestionOpen((open) => !open)}
            aria-expanded={gestionOpen}
          >
            <Icon name="lock" className="svg-icon" />
            {L.nav.sectionPremium}
            <Icon name="chevron-down" className={`svg-icon drawer-gestion-chevron${gestionOpen ? " open" : ""}`} />
          </button>
          {gestionOpen ? (
            <div className="drawer-gestion-list">
              {navItems.filter((item) => item.group === "premium").map((item) => {
                const active = item.href === "/calendrier"
                  ? pathname.startsWith("/calendrier") || pathname.startsWith("/planning")
                  : pathname.startsWith(item.href);
                const locked = !isAdmin && !premiumTools;
                return (
                  <Link href={locked ? "/abonnement" : item.href} className={`${active ? "active" : ""}${locked ? " locked" : ""}`} key={item.href}>
                    <span className="drawer-nav-icon" style={{ background: locked ? "#c7cddb" : item.color }}><Icon name={item.icon} className="svg-icon" /></span>
                    {item.label}
                    {locked ? <Icon name="lock" className="svg-icon drawer-nav-lock" /> : null}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </nav>

        <div className="drawer-divider" />

        <div className="drawer-footer">
          <Link href="/profil"><Icon name="user" className="svg-icon" />{L.nav.profile}</Link>
          <span className="drawer-nav-section">{L.nav.sectionConfiguration}</span>
          <Link href="/aide"><Icon name="help" className="svg-icon" />{L.nav.help}</Link>
          <Link href="/parametres"><Icon name="settings" className="svg-icon" />{L.nav.settings}</Link>
          <button type="button" onClick={logout}><Icon name="logout" className="svg-icon" />{L.nav.logout}</button>
        </div>
      </aside>

      {!trial.subscribed && !trial.expired && trial.daysLeft !== Infinity && (
        <div className={`trial-banner${trial.daysLeft <= 3 ? " trial-banner-urgent" : ""}`}>
          <span>
            {trial.daysLeft === 0
              ? L.shell.trialExpired
              : L.shell.trialLeft(trial.daysLeft)}
          </span>
          <a href="/abonnement" className="trial-banner-btn">{L.shell.choosePlan}</a>
        </div>
      )}

      {profileType !== "particulier" ? (
        <nav className="bottom-nav" aria-label="nav mobile">
          {(() => {
            const chantiersLocked = !isAdmin && !premiumTools;
            const chantiersActive = pathname.startsWith("/chantiers");
            return (
              <Link href={chantiersLocked ? "/abonnement" : "/chantiers"} className={`bottom-nav-item${chantiersActive ? " active" : ""}${chantiersLocked ? " locked" : ""}`}>
                <Icon name="tools" className="svg-icon" />
                <span>{L.nav.projects}</span>
                {chantiersLocked ? <Icon name="lock" className="svg-icon bottom-nav-lock" /> : null}
              </Link>
            );
          })()}
          <Link href="/devis" className={`bottom-nav-item${pathname.startsWith("/devis") ? " active" : ""}`}>
            <Icon name="file" className="svg-icon" />
            <span>{L.nav.quotes}</span>
          </Link>
          <Link href="/marketplace" className="bottom-nav-item bottom-nav-item-main">
            <span className="bottom-nav-main-btn">
              <Icon name="market" className="svg-icon" />
              {hasNewMarketplaceOffers ? <span className="bottom-nav-dot" aria-label="Nouvelles offres" /> : null}
            </span>
            <span>{L.nav.marketplace}</span>
          </Link>
          <Link href="/bibliotheque-ouvrages" className={`bottom-nav-item${pathname.startsWith("/bibliotheque-ouvrages") ? " active" : ""}`}>
            <Icon name="book" className="svg-icon" />
            <span>{L.nav.library}</span>
          </Link>
          <Link href="/notifications" className={`bottom-nav-item${pathname.startsWith("/notifications") ? " active" : ""}`}>
            <Icon name="bell" className="svg-icon" />
            {unreadCount > 0 ? <span className="bottom-nav-badge">{unreadCount > 9 ? "9+" : unreadCount}</span> : null}
            <span>{L.shell.notifications}</span>
          </Link>
        </nav>
      ) : null}

      <main className={`web-main${profileType !== "particulier" ? " has-bottom-nav" : ""}`}>{children}</main>

      <button
        type="button"
        className="koji-assistant-bubble"
        onClick={toggleKojiAssistant}
        aria-label="Assistant koji"
        aria-expanded={kojiAssistantOpen}
      >
        <KojiSymbol className="koji-assistant-bubble-icon" />
      </button>

      {kojiAssistantOpen ? (
        <div className={`koji-assistant-panel ${kojiAssistantExpanded ? "koji-assistant-panel-expanded" : ""}`}>
          <div className="koji-assistant-panel-head">
            <div className="koji-assistant-menu" ref={kojiAssistantMenuRef}>
              <button
                type="button"
                className="koji-assistant-sidebar-toggle"
                onClick={toggleKojiAssistantMenu}
                aria-label="Historique des discussions"
                aria-expanded={kojiAssistantMenuOpen}
                title="Historique des discussions"
              >
                <Icon name="menu" className="svg-icon" />
              </button>
              {kojiAssistantMenuOpen ? (
                <div className="koji-assistant-menu-dropdown">
                  <button type="button" className="koji-assistant-menu-new" onClick={startNewKojiConversation}>
                    + Nouvelle discussion
                  </button>
                  {kojiAssistantConversations.length > 0 ? (
                    kojiAssistantConversations.map((conv) => (
                      <button
                        key={conv.id}
                        type="button"
                        className="koji-assistant-menu-item"
                        onClick={() => openKojiConversation(conv.id)}
                      >
                        <span className="koji-assistant-menu-item-title">{conv.title}</span>
                        <time>{formatRelativeTime(conv.updatedAt)}</time>
                      </button>
                    ))
                  ) : (
                    <p className="koji-assistant-menu-empty">Aucune discussion pour l'instant.</p>
                  )}
                </div>
              ) : null}
            </div>
            <strong><KojiSymbol className="koji-assistant-panel-icon" /> KOJI</strong>
            <div className="koji-assistant-head-actions">
              <button
                type="button"
                className="koji-assistant-resize-toggle"
                onClick={() => setKojiAssistantExpanded((expanded) => !expanded)}
                aria-label={kojiAssistantExpanded ? "Réduire l'assistant" : "Agrandir l'assistant"}
                title={kojiAssistantExpanded ? "Réduire l'assistant" : "Agrandir l'assistant"}
              >
                {kojiAssistantExpanded ? (
                  <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" /></svg>
                ) : (
                  <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
                )}
              </button>
              <button type="button" className="koji-assistant-summary-close" onClick={toggleKojiAssistant} aria-label={L.common.close}>✕</button>
            </div>
          </div>

          <>
              <div className="koji-assistant-panel-body">
                {kojiAssistantMessages.length > 0 ? (
                  <div className="koji-assistant-thread">
                    {kojiAssistantMessages.slice(-12).map((entry) => (
                      <div key={entry.id} className={`koji-assistant-thread-row koji-assistant-thread-${entry.role}`}>
                        {entry.message}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="koji-assistant-notice">
                    {kojiGreeting(kojiUserName)} 👋 Demandez-moi de créer ou supprimer un RDV, un devis, une dépense, une tâche...
                  </p>
                )}

                {kojiAssistantClarification?.quickReplies?.length > 0 ? (
                  <div className="koji-assistant-quick-replies">
                    {kojiAssistantClarification.quickReplies.map((reply) => (
                      <button
                        key={reply}
                        type="button"
                        className="radar-quick-option-btn"
                        disabled={kojiAssistantBusy}
                        onClick={() => submitKojiAssistant(reply)}
                      >
                        {reply}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="radar-quick-option-btn koji-assistant-quick-other"
                      disabled={kojiAssistantBusy}
                      onClick={() => kojiAssistantInputRef.current?.focus()}
                    >
                      Autre
                    </button>
                  </div>
                ) : null}

                {kojiAssistantNotice ? <p className="koji-assistant-notice">{kojiAssistantNotice}</p> : null}

                {kojiAssistantSuggestions.length > 0 ? (
                  <div className="koji-assistant-quick-replies">
                    {kojiAssistantSuggestions.map((reply) => (
                      <button
                        key={reply}
                        type="button"
                        className="radar-quick-option-btn"
                        disabled={kojiAssistantBusy}
                        onClick={() => submitKojiAssistant(reply)}
                      >
                        {reply}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="radar-quick-option-btn koji-assistant-quick-other"
                      disabled={kojiAssistantBusy}
                      onClick={() => kojiAssistantInputRef.current?.focus()}
                    >
                      Autre
                    </button>
                  </div>
                ) : null}

                {kojiAssistantLive?.outcome === "created" ? (
                  <div className="koji-assistant-summary-card">
                    <div className="koji-assistant-summary-head">
                      <strong>✓ {kojiAssistantLive.typeLabel}</strong>
                      <button
                        type="button"
                        className="koji-assistant-summary-close"
                        onClick={() => setKojiAssistantLive(null)}
                        aria-label={L.common.close}
                      >
                        ✕
                      </button>
                    </div>
                    <dl className="koji-assistant-summary-fields">
                      {Object.entries(kojiAssistantLive.summary || {}).map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="koji-assistant-summary-actions">
                      <button type="button" className="koji-assistant-summary-confirm" onClick={() => setKojiAssistantLive(null)}>
                        ✓ Valider
                      </button>
                      {kojiAssistantLive.correctUrl ? (
                        <Link href={kojiAssistantLive.correctUrl} className="koji-assistant-summary-link">Corriger</Link>
                      ) : null}
                      <button type="button" className="koji-assistant-summary-undo" onClick={undoKojiAssistantCreate}>
                        Supprimer
                      </button>
                    </div>
                  </div>
                ) : null}

                {kojiAssistantLive?.outcome === "updated" ? (
                  <div className="koji-assistant-summary-card">
                    <div className="koji-assistant-summary-head">
                      <strong>✓ {kojiAssistantLive.typeLabel} modifié</strong>
                      <button
                        type="button"
                        className="koji-assistant-summary-close"
                        onClick={() => setKojiAssistantLive(null)}
                        aria-label={L.common.close}
                      >
                        ✕
                      </button>
                    </div>
                    <dl className="koji-assistant-summary-fields">
                      {Object.entries(kojiAssistantLive.summary || {}).map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="koji-assistant-summary-actions">
                      <button type="button" className="koji-assistant-summary-confirm" onClick={() => setKojiAssistantLive(null)}>
                        ✓ Valider
                      </button>
                      {kojiAssistantLive.correctUrl ? (
                        <Link href={kojiAssistantLive.correctUrl} className="koji-assistant-summary-link">Corriger</Link>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {kojiAssistantLive?.outcome === "confirmDelete" ? (
                  <div className="koji-assistant-summary-card koji-assistant-summary-card-danger">
                    <div className="koji-assistant-summary-head">
                      <strong>Supprimer : {kojiAssistantLive.typeLabel} ?</strong>
                    </div>
                    <dl className="koji-assistant-summary-fields">
                      {Object.entries(kojiAssistantLive.summary || {}).map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="koji-assistant-summary-actions">
                      <button type="button" className="koji-assistant-summary-undo" disabled={kojiAssistantBusy} onClick={confirmKojiAssistantDelete}>
                        Supprimer
                      </button>
                      <button type="button" className="koji-assistant-summary-link" disabled={kojiAssistantBusy} onClick={() => setKojiAssistantLive(null)}>
                        Non
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <form
                className="koji-assistant-bar"
                onSubmit={(event) => { event.preventDefault(); submitKojiAssistant(kojiAssistantDraft); }}
              >
                <span className="koji-assistant-bar-icon"><KojiSymbol /></span>
                <input
                  ref={kojiAssistantInputRef}
                  type="text"
                  value={kojiAssistantDraft}
                  onChange={(event) => setKojiAssistantDraft(event.target.value)}
                  placeholder={kojiAssistantClarification ? kojiAssistantClarification.question : "Demandez à l'assistant koji…"}
                  disabled={kojiAssistantBusy}
                />
                <label className="koji-assistant-bar-photo" title="Joindre une photo (facture, reçu...)">
                  📎{kojiAssistantPhotos.length > 0 ? ` ${kojiAssistantPhotos.length}` : ""}
                  <input type="file" accept="image/*" multiple hidden onChange={handleKojiPhotoChange} disabled={kojiAssistantBusy} />
                </label>
              </form>
            </>
        </div>
      ) : null}
    </div>
  );
}
