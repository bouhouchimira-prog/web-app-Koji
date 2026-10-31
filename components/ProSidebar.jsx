"use client";

import Link from "next/link";
import { Fragment } from "react";

const PERSON = "M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21a8 8 0 0 1 16 0";
const SHOP = "M4 9l1-5h14l1 5M5 9v11h14V9M9 20v-6h6v6";

// Entrées et icônes de la maquette (PRO-01 / PRO-03), complétées par les
// outils déjà présents dans l'app. "soon" : prévu dans la maquette mais sans
// page dans l'app pour l'instant.
const GROUPS = [
  {
    label: "Principal",
    items: [
      { href: "/", label: "Accueil", icon: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
      { href: "/chantiers", label: "Chantiers", icon: "M4 20h16M6 20V9l6-4 6 4v11", match: ["/chantiers", "/chantier/"] },
      { href: "/devis", label: "Devis", icon: "M6 3h9l4 4v14H6zM9 12h6M9 16h6", match: ["/devis"] },
      { href: "/marketplace", label: "Radar", icon: SHOP, badge: "radar" },
      { label: "Réseau pro", icon: PERSON, soon: true },
      { href: "/calendrier", label: "Calendrier", icon: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4", match: ["/calendrier", "/planning"] }
    ]
  },
  {
    label: "Clients",
    items: [
      { href: "/profil/site-web", label: "KojiPage", icon: SHOP },
      { label: "Messages", icon: "M4 5h16v11H9l-5 4z", soon: true },
      { href: "/contacts", label: "Contacts", icon: PERSON, match: ["/contacts", "/clients"] }
    ]
  },
  {
    label: "Gestion",
    items: [
      { href: "/facturation", label: "Factures", icon: "M16 7a5 5 0 1 0 0 10M6 11h8M6 14h8" },
      { href: "/avenant", label: "Avenant", icon: "M6 3h9l4 4v14H6zM12 11v6M9 14h6" },
      { href: "/fournitures", label: "Fournitures", icon: "M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8" },
      { href: "/bibliotheque-ouvrages", label: "Bibliothèque", icon: "M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11" }
    ]
  },
  {
    label: "Business",
    items: [
      { href: "/comptabilite", label: "Comptabilités", icon: "M5 20V10M12 20V4M19 20v-7" },
      { href: "/interventions", label: "Interventions", icon: "M14.7 6.3a4 4 0 0 0 5 5L12 19.1a2.1 2.1 0 0 1-3-3zM9.5 9.5 4 4" }
    ]
  },
  {
    label: "Autre",
    items: [
      { href: "/archives", label: "Archives", icon: "M3 4h18v4H3zM5 8v12h14V8M10 12h4" },
      { href: "/corbeille", label: "Corbeille", icon: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" },
      { href: "/profil", label: "Profil / Configuration", icon: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1", match: ["/profil", "/parametres", "/aide"], exclude: ["/profil/site-web"] }
    ]
  }
];

function isActive(item, pathname) {
  if (item.href === "/") return pathname === "/";
  if ((item.exclude || []).some((p) => pathname.startsWith(p))) return false;
  return (item.match || [item.href]).some((p) => pathname.startsWith(p));
}

function NavIcon({ d }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>
  );
}

export function ProSidebar({
  pathname,
  open,
  isLocked,
  hasNewMarketplaceOffers,
  onAsk,
  account,
  menuOpen,
  onToggleMenu,
  menuRef,
  onLogout
}) {
  return (
    <aside className={`side${open ? " open" : ""}`} aria-label="Navigation">
      <Link href="/" className="brand">KOJI</Link>

      <button type="button" className="sx kj" onClick={onAsk}>
        <span className="kjs">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z" /></svg>
        </span>
        <div>
          <b>Demander à Koji</b>
          <small>ou rechercher · Ctrl K</small>
        </div>
      </button>

      {GROUPS.map((group) => (
        <Fragment key={group.label}>
          <div className="grp">{group.label}</div>
          <nav className="nav">
            {group.items.map((item) => {
              if (item.soon) {
                return (
                  <a key={item.label} className="lk" aria-disabled="true">
                    <NavIcon d={item.icon} />{item.label}<span className="lkt">Bientôt</span>
                  </a>
                );
              }
              const locked = isLocked(item.href);
              const active = isActive(item, pathname);
              return (
                <Link
                  key={item.href}
                  href={locked ? "/parametres/abonnement" : item.href}
                  className={`${active ? "on" : ""}${locked ? " lk" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  <NavIcon d={item.icon} />{item.label}
                  {locked ? (
                    <span className="lkt" title="Inclus dans Koji Premium" aria-label="Koji Premium">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3" /></svg>
                    </span>
                  ) : null}
                  {!locked && item.badge === "radar" && hasNewMarketplaceOffers ? (
                    <span className="cnt" aria-label="Nouvelles offres">Nouveau</span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </Fragment>
      ))}

      <div className="acctwrap" ref={menuRef}>
        {menuOpen ? (
          <div className="pop">
            <Link href="/profil">Profil de l'entreprise</Link>
            <Link href="/parametres/abonnement">Abonnement</Link>
            <Link href="/parametres">Paramètres</Link>
            <Link href="/aide">Aide</Link>
            <div className="sep" />
            {account.trialDaysLeft != null ? (
              <Link href="/abonnement" className="up">Choisir un abonnement</Link>
            ) : null}
            <button type="button" className="dim" onClick={onLogout}>Déconnexion</button>
          </div>
        ) : null}
        <button type="button" className="acct" aria-haspopup="true" aria-expanded={menuOpen} onClick={onToggleMenu}>
          <span className="av">
            {account.logo ? <img src={account.logo} alt="" onError={account.onLogoError} /> : account.initials}
          </span>
          <span className="who">
            <span className="nm">{account.name || "Mon entreprise"}</span>
            <span className="sb">{account.plan}</span>
          </span>
          <span className="chev" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>
          </span>
        </button>
      </div>
    </aside>
  );
}
