"use client";

import Link from "next/link";

// Onglets de Dépenses (maquettes PRO-09 à 09.4).
const TABS = [
  { id: "ranger", label: "À ranger", href: "/depenses" },
  { id: "recues", label: "Factures reçues", href: "/depenses/recues" },
  { id: "chantiers", label: "Coût des chantiers", href: "/depenses/chantiers" },
  { id: "export", label: "Export comptable", href: "/depenses/export" }
];

export function DepensesTabs({ current, counts = {} }) {
  return (
    <div className="wtabs" role="tablist" aria-label="Dépenses" style={{ marginBottom: 16 }}>
      {TABS.map((t) => (
        <Link key={t.id} href={t.href} role="tab" aria-selected={current === t.id} className={current === t.id ? "on" : ""}>
          {t.label}{counts[t.id] ? <span>{counts[t.id]}</span> : null}
        </Link>
      ))}
    </div>
  );
}

export const euro = (n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n) || 0);
export const euro0 = (n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(n) || 0);
export const jourCourt = (iso) => (iso ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(`${String(iso).slice(0, 10)}T12:00:00Z`)) : "");
export const SOURCE = { photo: "photo", pdf: "facture PDF", commande: "commande Koji", manuel: "saisie", csv: "fichier" };
