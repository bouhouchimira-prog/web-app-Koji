"use client";

import Link from "next/link";

// Onglets de la Bibliothèque (maquettes PRO-08 à 08.3).
const TABS = [
  { id: "ouvrages", label: "Ouvrages", href: "/bibliotheque-ouvrages" },
  { id: "fournitures", label: "Fournitures", href: "/fournitures" },
  { id: "prix", label: "Mes prix", href: "/bibliotheque-ouvrages/mes-prix" }
];

export function BibliothequeTabs({ current, counts = {}, children }) {
  return (
    <div className="fx-tabs">
      <div className="wtabs" role="tablist" aria-label="Bibliothèque">
        {TABS.map((t) => (
          <Link key={t.id} href={t.href} role="tab" aria-selected={current === t.id} className={current === t.id ? "on" : ""}>
            {t.label}{counts[t.id] !== undefined ? <span>{counts[t.id]}</span> : null}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
