"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/chantiers", label: "Chantiers", icon: "tools" },
  { href: "/devis", label: "Devis", icon: "file" },
  { href: "/calendrier", label: "Calendrier", icon: "calendar" },
  { href: "/fournitures", label: "Fournitures", icon: "box" },
  { href: "/equipe", label: "Equipe", icon: "users" },
  { href: "/signature", label: "Signatures", icon: "pen" },
  { href: "/archives", label: "Archives", icon: "archive" },
  { href: "/bibliotheque-ouvrages", label: "Bibliotheque d'ouvrages", icon: "book" }
];

function Icon({ name, className = "" }) {
  const base = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "menu":
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
          <path {...base} d="M3 6h18M3 12h13M3 18h10" />
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileType, setProfileType] = useState("entreprise");

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("koji-user");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.accountType === "particulier") setProfileType("particulier");
      else setProfileType("entreprise");
    } catch {
      setProfileType("entreprise");
    }
  }, []);

  function logout() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("koji-user");
    }
    router.push("/login?type=entreprise");
  }

  return (
    <div className="web-shell">
      <header className="app-topbar">
        <button type="button" className="icon-round" onClick={() => setDrawerOpen(true)} aria-label="Ouvrir le menu">
          <Icon name="menu" className="svg-icon" />
        </button>
        <Link href="/" className="topbar-logo" aria-label="Aller au tableau de bord">
          <img src="/koji-logo.svg" alt="Koji" />
        </Link>
        <div className="topbar-right">
          <Link href="/calendrier" className="icon-round" aria-label="Notifications"><Icon name="bell" className="svg-icon" /></Link>
          <Link href="/parametres" className="icon-round" aria-label="Profil"><Icon name="user" className="svg-icon" /></Link>
        </div>
      </header>

      <div className={`drawer-backdrop ${drawerOpen ? "open" : ""}`} onClick={() => setDrawerOpen(false)} />
      <aside className={`drawer ${drawerOpen ? "open" : ""}`} aria-label="Menu lateral">
        <div className="drawer-brand">
          <img src="/koji-logo.svg" alt="Koji" />
          <div>
            <strong>Koji</strong>
            <small>Espace {profileType}</small>
          </div>
        </div>

        <nav className="drawer-nav" aria-label="Outils">
          {navItems.map((item) => {
            const active = item.href === "/calendrier"
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
          <Link href="/parametres"><Icon name="settings" className="svg-icon" />Parametres</Link>
          <button type="button" onClick={logout}><Icon name="logout" className="svg-icon" />Deconnexion</button>
        </div>
      </aside>

      <main className="web-main">{children}</main>
    </div>
  );
}
