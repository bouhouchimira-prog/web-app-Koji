"use client";

import Link from "next/link";

// Onglets de l'outil Fournitures (maquettes PRO-07 à 07.6). La page
// /fournitures porte le catalogue, les commandes par chantier, les bons, les
// partenaires et le stock ; /fournitures/catalogue garde les fournisseurs et
// les achats divers (onPick y change de vue sans recharger).
const TABS = [
  { id: "catalogue", label: "Catalogue", href: "/fournitures" },
  { id: "chantiers", label: "Commandes par chantier", href: "/fournitures?tab=chantiers" },
  { id: "bons", label: "Bons de commande", href: "/fournitures?tab=bons" },
  { id: "fournisseurs", label: "Fournisseurs", href: "/fournitures/catalogue?tab=fournisseurs", pick: true },
  { id: "partenaires", label: "Partenaires Koji", href: "/fournitures?tab=partenaires" },
  { id: "stock", label: "Stock", href: "/fournitures?tab=stock" },
  { id: "divers", label: "Achats divers", href: "/fournitures/catalogue?tab=divers", pick: true }
];

export function FournituresTabs({ current, counts = {}, onPick, onTab, children }) {
  return (
    <div className="fx-tabs">
      <div className="wtabs" role="tablist" aria-label="Fournitures">
        {TABS.map((tab) => {
          const inner = <>{tab.label}{counts[tab.id] !== undefined ? <span>{counts[tab.id]}</span> : null}</>;
          if ((onPick && tab.pick) || (onTab && !tab.pick)) {
            return (
              <button key={tab.id} type="button" role="tab" aria-selected={current === tab.id} className={current === tab.id ? "on" : ""} onClick={() => (onPick && tab.pick ? onPick(tab.id) : onTab(tab.id))}>
                {inner}
              </button>
            );
          }
          return (
            <Link key={tab.id} href={tab.href} role="tab" aria-selected={current === tab.id} className={current === tab.id ? "on" : ""}>
              {inner}
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}
