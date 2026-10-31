"use client";

import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Shell } from "../../../components/Shell";

export default function ContactsPage() {
  const router = useRouter();
  const params = useParams();
  const contactId = params.id;

  const contacts = [
    { id: 1, name: "Talab Carrelage", type: "Carrelage", city: "Paris", phone: "06 12 34 56 78", verified: true },
    { id: 2, name: "Électrique Laurent", type: "Électricité", city: "Lyon", phone: "06 98 76 54 32", verified: true },
    { id: 3, name: "Plomberie Dupont", type: "Plomberie", city: "Marseille", phone: "06 55 66 77 88", verified: false }
  ];

  const submenu = [
    { label: "Ajouter un contact", href: `ajouter`, icon: "➕" },
    { label: "Fiches par type", href: `par-type`, icon: "📂" }
  ];

  return (
    <Shell>
      <div className="head">
        <div className="stack">
          <button type="button" className="link" onClick={() => router.back()}>← Retour</button>
          <span className="eyebrow">Contacts</span>
          <h1>Répertoire des contacts</h1>
        </div>
        <div className="hact">
          <a className="btn btn-main">+ Nouveau contact</a>
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h2>Tous les contacts</h2></div>
        <div className="mlist">
          {contacts.map((c) => (
            <Link key={c.id} href={`fiche`} className="m-card" style={{ textDecoration: "none", cursor: "pointer" }}>
              <div className="top2">
                <div>
                  <div className="nm">{c.name}</div>
                  <div className="meta">{c.type} · {c.city}</div>
                </div>
                {c.verified && <span className="ver"><svg viewBox="0 0 24 24"><path d="M4 12l5 5L20 6" /></svg>Vérifié</span>}
              </div>
              <div style={{ fontSize: 13, color: "var(--grey)", marginTop: 8 }}>{c.phone}</div>
            </Link>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h2>Actions rapides</h2></div>
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
