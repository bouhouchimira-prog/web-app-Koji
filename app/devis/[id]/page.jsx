"use client";

import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Shell } from "../../../components/Shell";

export default function DevisPage() {
  const router = useRouter();
  const params = useParams();
  const quoteId = params.id;

  const quote = {
    id: quoteId,
    number: "DV-2026-001",
    client: "Dupont",
    total: 5200,
    status: "Brouillon",
    createdAt: "2026-10-20"
  };

  const submenu = [
    { label: "Envoyer le devis", href: `envoyer`, icon: "📧" },
    { label: "Après l'envoi", href: `apres-envoi`, icon: "✓" },
    { label: "Facture d'acompte", href: `acompte`, icon: "💳" },
    { label: "TVA automatique", href: `tva`, icon: "📊" },
    { label: "Versions du devis", href: `versions`, icon: "📜" },
    { label: "Signature et rétractation", href: `signature`, icon: "✍️" },
    { label: "Mode visite", href: `mode-visite`, icon: "👁️" }
  ];

  return (
    <Shell>
      <div className="head">
        <div className="stack">
          <button type="button" className="link" onClick={() => router.back()}>← Retour</button>
          <span className="eyebrow">Devis</span>
          <h1>{quote.number}</h1>
        </div>
        <div className="hact">
          <span className="tag tag-b">{quote.status}</span>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h2>Informations</h2>
        </div>
        <div className="row">
          <div className="t">
            <small>Client</small>
            <strong>{quote.client}</strong>
          </div>
        </div>
        <div className="row">
          <div className="t">
            <small>Montant total TTC</small>
            <strong>{quote.total}€</strong>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h2>Gestion du devis</h2>
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
