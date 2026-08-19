"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LangSwitcher } from "./LangSwitcher";
import { useLocale } from "../lib/i18n";

function getStoredClientUser() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("koji-user") || "null"); } catch { return null; }
}

export function ClientTopbar({ backHref = "/client", showBack = false }) {
  const { L } = useLocale();
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  function logout() {
    window.localStorage.removeItem("koji-user");
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login?type=particulier");
  }

  useEffect(() => {
    const user = getStoredClientUser();
    if (!user?.id) return;
    fetch(`/api/notifications?userId=${encodeURIComponent(user.id)}`)
      .then((r) => r.json())
      .then((data) => {
        const CLIENT_TYPES = new Set(["company.reply", "task.started", "task.pending_validation"]);
      const count = (data.notifications || []).filter((n) => !n.read && !n.archived && CLIENT_TYPES.has(n.type)).length;
        setUnread(count);
      })
      .catch(() => {});
  }, []);

  return (
    <header className="client-koji-topbar">
      {showBack ? (
        <button type="button" className="client-koji-topbar-btn" onClick={() => router.push(backHref)} aria-label="Retour">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      ) : (
        <span />
      )}

      <Link href="/client" className="client-koji-topbar-logo" aria-label="Accueil">
        <img src="/koji-logo.svg" alt="Koji" />
      </Link>

      <div className="client-koji-topbar-right">
        <LangSwitcher />
        <Link href="/client/notifications" className="client-koji-topbar-btn notif-bell-link" aria-label="Notifications">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 17H5l2-2v-4a5 5 0 1110 0v4l2 2h-4" />
            <path d="M9 19a3 3 0 006 0" />
          </svg>
          {unread > 0 ? <span className="notif-bell-badge">{unread > 9 ? "9+" : unread}</span> : null}
        </Link>
        <div className="client-koji-topbar-menu" ref={menuRef}>
          <button
            type="button"
            className="client-koji-topbar-btn"
            aria-label="Profil"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((current) => !current)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20a8 8 0 0116 0" />
            </svg>
          </button>
          {menuOpen ? (
            <div className="client-koji-dropdown">
              <Link href="/client/devis" onClick={() => setMenuOpen(false)}>{L.nav.quotes}</Link>
              <Link href="/client/chantiers" onClick={() => setMenuOpen(false)}>{L.nav.projects}</Link>
              <Link href="/client/profil" onClick={() => setMenuOpen(false)}>{L.nav.settings}</Link>
              <button type="button" onClick={logout}>{L.nav.logout}</button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
