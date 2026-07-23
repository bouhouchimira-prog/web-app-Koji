"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiSend } from "../lib/client-api";
import { useLocale } from "../lib/i18n";
import { useApi } from "../lib/use-api";

function getNavItems(L) {
  return [
    { href: "/",                      label: L.nav.home,        icon: "home"     },
    { href: "/archives",              label: L.nav.archives,    icon: "archive"  },
    { href: "/bibliotheque-ouvrages", label: L.nav.library,     icon: "book"     },
    { href: "/calendrier",            label: L.nav.calendar,    icon: "calendar" },
    { href: "/chantiers",             label: L.nav.projects,    icon: "tools"    },
    { href: "/devis",                 label: L.nav.quotes,      icon: "file"     },
    { href: "/equipe",                label: L.nav.team,        icon: "users"    },
    { href: "/facturation",           label: L.nav.invoicing,   icon: "invoice"  },
    { href: "/fournitures",           label: L.nav.supplies,    icon: "box"      },
    { href: "/marketplace",           label: L.nav.marketplace, icon: "market"   },
  ];
}

const FREE_PATHS = ["/login", "/activate", "/set-password", "/abonnement"];

function getTrialInfo(user) {
  if (!user) return { daysLeft: 0, expired: true, subscribed: false };
  if (user.isAdmin || user.plan === "active" || user.plan === "subscribed" || !user.trialStartedAt) {
    return { daysLeft: Infinity, expired: false, subscribed: true };
  }
  const start = new Date(user.trialStartedAt);
  const now = new Date();
  const daysUsed = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  const daysLeft = Math.max(0, 14 - daysUsed);
  return { daysLeft, expired: daysLeft === 0, subscribed: false };
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
    default:
      return null;
  }
}

export function Shell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, setLang, L } = useLocale();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const langRef = useRef(null);
  const notifRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (langRef.current && !langRef.current.contains(e.target)) setLangOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);
  const [profileType, setProfileType] = useState("entreprise");
  const [isAdmin, setIsAdmin] = useState(false);
  const [trial, setTrial] = useState({ daysLeft: Infinity, expired: false, subscribed: true });
  const { data: notifications, setData: setNotifications } = useApi("/api/notifications", "notifications");
  const unreadCount = notifications.filter((n) => !n.read && !n.archived).length;
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
      // Sessions without a Supabase access token predate the Supabase accounts
      // (or were tampered with) — treat them as logged out.
      if (!parsed?.accessToken) {
        window.localStorage.removeItem("koji-user");
        router.replace("/login?type=entreprise");
        return;
      }
      if (parsed?.accountType === "particulier") setProfileType("particulier");
      else setProfileType("entreprise");
      if (parsed?.isAdmin) setIsAdmin(true);
      const trialInfo = getTrialInfo(parsed);
      setTrial(trialInfo);
      if (trialInfo.expired && !FREE_PATHS.some((p) => pathname.startsWith(p))) {
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
    }
    router.push("/login?type=entreprise");
  }

  return (
    <div className="web-shell">
      <header className="app-topbar">
        <button type="button" className="icon-round" onClick={() => setDrawerOpen(true)} aria-label={L.shell.openMenu}>
          <Icon name="menu" className="svg-icon" />
        </button>
        <Link href="/" className="topbar-logo" aria-label={L.shell.spaceCompany}>
          <img src="/koji-logo.svg" alt="Koji" />
        </Link>
        <div className="topbar-right">
          <div className="topbar-lang" ref={langRef}>
            <button
              type="button"
              className="topbar-lang-btn"
              onClick={() => setLangOpen((o) => !o)}
              aria-haspopup="listbox"
              aria-expanded={langOpen}
            >
              <span>{lang === "fr" ? "FR" : lang === "en" ? "EN" : lang === "ar" ? "AR" : lang === "de" ? "DE" : "IT"}</span>
              <svg viewBox="0 0 10 6" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 3, opacity: 0.7 }}><path d="M1 1l4 4 4-4"/></svg>
            </button>
            {langOpen && (
              <ul className="topbar-lang-dropdown" role="listbox">
                {["fr", "en", "ar", "de", "it"].map((code) => (
                  <li key={code} role="option" aria-selected={lang === code}>
                    <button
                      type="button"
                      className={lang === code ? "active" : ""}
                      onClick={() => { setLang(code); setLangOpen(false); }}
                    >
                      <span>{code.toUpperCase()}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
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
                          href={notif.actionUrl || "/notifications"}
                          onClick={() => { markNotifRead(notif); setNotifOpen(false); }}
                        >
                          <strong>{notif.title}</strong>
                          <span>{notif.message}</span>
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
          <Link href="/parametres" className="icon-round" aria-label={L.nav.settings}><Icon name="user" className="svg-icon" /></Link>
        </div>
      </header>

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

        <nav className="drawer-nav" aria-label="nav">
          {navItems.map((item) => {
            const active = item.href === "/"
              ? pathname === "/"
              : item.href === "/calendrier"
                ? pathname.startsWith("/calendrier") || pathname.startsWith("/planning")
                : pathname.startsWith(item.href);
            return (
              <Link href={item.href} className={active ? "active" : ""} key={item.href}>
                <span><Icon name={item.icon} className="svg-icon" /></span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="drawer-divider" />

        <div className="drawer-footer">
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

      <main className="web-main">{children}</main>
    </div>
  );
}
