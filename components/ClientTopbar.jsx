"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LangSwitcher } from "./LangSwitcher";
import { useLocale } from "../lib/i18n";

function getStoredClientUser() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("koji-user") || "null"); } catch { return null; }
}

function DrawerIcon({ name }) {
  const base = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "home":
      return (
        <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path {...base} d="M3 11l9-8 9 8" />
          <path {...base} d="M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
        </svg>
      );
    case "file":
      return (
        <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path {...base} d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
          <path {...base} d="M14 3v5h5M9 13h6M9 17h6" />
        </svg>
      );
    case "tools":
      return (
        <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path {...base} d="M4 20l6-6M14 10l6-6M13 6l5 5M8 11l5 5" />
          <circle {...base} cx="7" cy="7" r="2.5" />
          <circle {...base} cx="17" cy="17" r="2.5" />
        </svg>
      );
    case "settings":
      return (
        <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle {...base} cx="12" cy="12" r="3.5" />
          <path {...base} d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1" />
        </svg>
      );
    case "logout":
      return (
        <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path {...base} d="M10 4H6a2 2 0 00-2 2v12a2 2 0 002 2h4" />
          <path {...base} d="M13 16l4-4-4-4M9 12h8" />
        </svg>
      );
    case "menu":
      return (
        <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path {...base} d="M3 6h18M3 12h13M3 18h10" />
        </svg>
      );
    default:
      return null;
  }
}

export function ClientTopbar({ backHref = "/client", showBack = false }) {
  const { L } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const navItems = [
    { href: "/client", label: L.clientSpace.home, icon: "home" },
    { href: "/client/devis", label: L.nav.quotes, icon: "file" },
    { href: "/client/chantiers", label: L.nav.projects, icon: "tools" },
  ];

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
    <>
      <header className="client-koji-topbar">
        <div className="client-koji-topbar-left">
          <button type="button" className="client-koji-topbar-btn" aria-label={L.shell.openMenu} onClick={() => setDrawerOpen(true)}>
            <DrawerIcon name="menu" />
          </button>
          {showBack ? (
            <button type="button" className="client-koji-topbar-btn" onClick={() => router.push(backHref)} aria-label="Retour">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          ) : null}
        </div>

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
          <Link href="/client/profil" className="client-koji-topbar-btn" aria-label="Profil">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20a8 8 0 0116 0" />
            </svg>
          </Link>
        </div>
      </header>

      <div className={`drawer-backdrop ${drawerOpen ? "open" : ""}`} onClick={() => setDrawerOpen(false)} />
      <aside className={`drawer ${drawerOpen ? "open" : ""}`} aria-label={L.nav.settings}>
        <div className="drawer-brand">
          <img src="/koji-logo.svg" alt="Koji" />
          <div>
            <strong>Koji</strong>
            <small>{L.shell.spacePersonal}</small>
          </div>
        </div>

        <nav className="drawer-nav" aria-label="nav">
          {navItems.map((item) => {
            const active = item.href === "/client" ? pathname === "/client" : pathname.startsWith(item.href);
            return (
              <Link href={item.href} className={active ? "active" : ""} key={item.href}>
                <span><DrawerIcon name={item.icon} /></span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="drawer-divider" />

        <div className="drawer-footer">
          <Link href="/client/profil"><DrawerIcon name="settings" />{L.nav.settings}</Link>
          <button type="button" onClick={logout}><DrawerIcon name="logout" />{L.nav.logout}</button>
        </div>
      </aside>
    </>
  );
}
