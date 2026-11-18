"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Navigation menu items for entreprise workspace.
const NAV_ITEMS = [
  { href: "/entreprise", label: "Accueil", icon: "🏠" },
  { href: "/entreprise/devis", label: "Devis", icon: "📋" },
  { href: "/entreprise/chantiers", label: "Chantiers", icon: "🏗️" },
  { href: "/entreprise/clients", label: "Clients", icon: "👥" },
  { href: "/entreprise/notifications", label: "Notifications", icon: "🔔" },
  { href: "/entreprise/profil", label: "Profil", icon: "👤" },
  { href: "/entreprise/parametres", label: "Paramètres", icon: "⚙️" },
];

// Layout component wrapping all entreprise pages.
// Provides: top bar, side nav (desktop) or bottom nav (mobile), content area.
export function EntrepriseShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    // Load user from localStorage (set after login).
    try {
      const stored = JSON.parse(localStorage.getItem("koji-user") || "null");
      setUser(stored);
    } catch {
      // If no valid user, page should redirect to /login.
    }
  }, []);

  useEffect(() => {
    // Check if mobile.
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("koji-user");
    localStorage.removeItem("supabase.auth.token");
    router.push("/login");
  };

  const isActive = (href) => pathname === href;

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: "#f5f7fa" }}>
      {/* Side navigation (desktop) */}
      {!isMobile && (
        <nav
          style={{
            width: sidebarOpen ? 240 : 80,
            backgroundColor: "#ffffff",
            borderRight: "1px solid #e0e6ed",
            padding: "20px 0",
            overflowY: "auto",
            transition: "width 0.3s",
          }}
        >
          {/* Koji logo / branding */}
          <div style={{ padding: "0 16px 24px", textAlign: "center", fontWeight: "800", fontSize: "18px" }}>
            {sidebarOpen ? "KojiPro" : "K"}
          </div>

          {/* Nav items */}
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href}>
              <a
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 16px",
                  color: isActive(item.href) ? "#0052cc" : "#4a5568",
                  backgroundColor: isActive(item.href) ? "#f0f4ff" : "transparent",
                  borderLeft: isActive(item.href) ? "3px solid #0052cc" : "3px solid transparent",
                  textDecoration: "none",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: isActive(item.href) ? "600" : "400",
                  transition: "all 0.2s",
                }}
              >
                <span style={{ fontSize: "18px" }}>{item.icon}</span>
                {sidebarOpen && <span>{item.label}</span>}
              </a>
            </Link>
          ))}

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Logout button */}
          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "none",
              backgroundColor: "transparent",
              color: "#e63946",
              cursor: "pointer",
              fontSize: "14px",
              textAlign: "left",
              fontWeight: "500",
            }}
          >
            {sidebarOpen ? "Déconnexion" : "↪️"}
          </button>
        </nav>
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Top bar */}
        <header
          style={{
            backgroundColor: "#ffffff",
            borderBottom: "1px solid #e0e6ed",
            padding: "16px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {!isMobile && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "20px",
                }}
              >
                ☰
              </button>
            )}
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "600" }}>Koji Pro</h1>
          </div>

          {/* User info */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "14px" }}>
            {user && <span>{user.name || user.email || "Utilisateur"}</span>}
            {!isMobile && (
              <button
                onClick={handleLogout}
                style={{
                  backgroundColor: "#f5f7fa",
                  border: "1px solid #e0e6ed",
                  padding: "8px 12px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "13px",
                }}
              >
                Déconnexion
              </button>
            )}
          </div>
        </header>

        {/* Page content */}
        <main
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "24px",
            maxWidth: "1400px",
            margin: "0 auto",
            width: "100%",
          }}
        >
          {children}
        </main>
      </div>

      {/* Bottom navigation (mobile) */}
      {isMobile && (
        <nav
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: "#ffffff",
            borderTop: "1px solid #e0e6ed",
            display: "flex",
            justifyContent: "space-around",
            padding: "8px 0",
            height: "60px",
          }}
        >
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href}>
              <a
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "4px",
                  padding: "8px 12px",
                  color: isActive(item.href) ? "#0052cc" : "#4a5568",
                  textDecoration: "none",
                  fontSize: "12px",
                  fontWeight: isActive(item.href) ? "600" : "400",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: "20px" }}>{item.icon}</span>
                <span>{item.label}</span>
              </a>
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
