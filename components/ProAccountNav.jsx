"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

// Navigation commune aux pages du compte (DA Koji Pro, maquette PRO-15) :
// les onglets du profil changent de section sans recharger (onPick) ; les
// autres entrées sont des pages à part.
// Paramètres (maquette PRO-15.6) : une seule navigation, une entrée par
// section ; les pages existantes en deviennent les sections.
const ITEMS = [
  { id: "entreprise", label: "Mon entreprise", href: "/profil" },
  { id: "profil", label: "Mon profil", href: "/parametres?section=profil" },
  { id: "devis", label: "Devis et factures", href: "/profil?tab=devis" },
  { id: "langue", label: "Langue et traduction", href: "/parametres?section=langue" },
  { id: "notifications", label: "Notifications et sécurité", href: "/parametres?section=notifications" },
  { id: "abonnement", label: "Abonnement et jetons", href: "/parametres/abonnement" },
  { id: "progression", label: "Ma progression", href: "/progression" },
  { id: "corbeille", label: "Éléments supprimés", href: "/corbeille" },
  { id: "donnees", label: "Mes données", href: "/parametres?section=donnees" },
  { id: "aide", label: "Aide et support", href: "/aide" }
];

const PROFILE_TABS = ["entreprise", "devis", "securite"];

export function ProAccountNav({ current, onPick, badges = {} }) {
  const navRef = useRef(null);

  // Sur téléphone le menu défile à l'horizontale : on amène l'entrée active
  // en vue, sinon « Abonnement » ou « Préférences » restent hors de l'écran.
  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector(".on");
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollLeft = active.offsetLeft - nav.offsetLeft - 16;
  }, [current]);

  return (
    <nav ref={navRef} className="pf-nav" aria-label="Profil et compte">
      {ITEMS.map((item) => {
        const inner = <>{item.label}{badges[item.id] ? <span>{badges[item.id]}</span> : null}</>;
        const on = current === item.id || (current === "securite" && item.id === "profil");
        if (onPick && PROFILE_TABS.includes(item.id)) {
          return (
            <button key={item.id} type="button" className={on ? "on" : ""} aria-current={on ? "page" : undefined} onClick={() => onPick(item.id)}>
              {inner}
            </button>
          );
        }
        return (
          <Link key={item.id} href={item.href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>
            {inner}
          </Link>
        );
      })}
    </nav>
  );
}
