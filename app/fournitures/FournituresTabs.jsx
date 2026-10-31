"use client";

import Link from "next/link";

// Onglets communs aux deux pages Fournitures (DA Koji Pro, maquette PRO-07) :
// /fournitures garde les commandes, /fournitures/catalogue le catalogue, les
// fournisseurs et les achats divers. Sur le catalogue, ses trois onglets
// changent de vue sans recharger (onPick) ; les autres sont des liens.
const TABS = [
  { id: "commandes", label: "Commandes", href: "/fournitures" },
  { id: "categories", label: "Catalogue", href: "/fournitures/catalogue" },
  { id: "fournisseurs", label: "Fournisseurs", href: "/fournitures/catalogue?tab=fournisseurs" },
  { id: "divers", label: "Achats divers", href: "/fournitures/catalogue?tab=divers" }
];

export function FournituresTabs({ current, counts = {}, onPick }) {
  return (
    <div className="wtabs" role="tablist" aria-label="Fournitures">
      {TABS.map((tab) => {
        const inner = <>{tab.label}{counts[tab.id] !== undefined ? <span>{counts[tab.id]}</span> : null}</>;
        if (onPick && tab.id !== "commandes") {
          return (
            <button key={tab.id} type="button" role="tab" aria-selected={current === tab.id} className={current === tab.id ? "on" : ""} onClick={() => onPick(tab.id)}>
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
  );
}
