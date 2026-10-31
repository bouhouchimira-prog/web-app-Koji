"use client";

import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Shell } from "../../../components/Shell";

export default function FacturationPage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params.id;

  const invoice = {
    id: invoiceId,
    number: "F-2026-001",
    client: "Dupont",
    total: 5200,
    paid: 3640,
    remaining: 1560,
    status: "Partiellement payée",
    dueDate: "2026-11-15"
  };

  const submenu = [
    { label: "Facture d'avoir", href: `avoir`, icon: "📋" },
    { label: "Relances et mise en demeure", href: `relances`, icon: "📬" }
  ];

  return (
    <Shell>
      <div className="head">
        <div className="stack">
          <button type="button" className="link" onClick={() => router.back()}>← Retour</button>
          <span className="eyebrow">Facturation</span>
          <h1>{invoice.number}</h1>
        </div>
        <div className="hact">
          <span className="tag tag-b">{invoice.status}</span>
        </div>
      </div>

      <div className="kpis">
        <div>
          <div className="l">Montant TTC</div>
          <div className="v">{invoice.total}€</div>
          <div className="s">Total facturé</div>
        </div>
        <div>
          <div className="l">Payé</div>
          <div className="v">{invoice.paid}€</div>
          <div className="s">{Math.round((invoice.paid / invoice.total) * 100)}% reçu</div>
        </div>
        <div>
          <div className="l">Restant dû</div>
          <div className="v">{invoice.remaining}€</div>
          <div className="s">À percevoir</div>
        </div>
        <div>
          <div className="l">Échéance</div>
          <div className="v">{new Date(invoice.dueDate).toLocaleDateString("fr-FR")}</div>
          <div className="s">Date limite</div>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h2>Gestion de la facture</h2>
        </div>
        <div className="mlist">
          {submenu.map((item) => (
            <Link key={item.href} href={item.href} className="m-card" style={{ textDecoration: "none" }}>
              <div className="top2">
                <div className="nm" style={{ fontSize: 15 }}>{item.icon} {item.label}</div>
                <span style={{ color: "var(--grey)", fontSize: 18 }}>→</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Shell>
  );
}
