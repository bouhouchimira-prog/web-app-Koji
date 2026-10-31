"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shell } from "../../../../components/Shell";

export default function FichesParTypePage() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState("Tous");

  const types = ["Tous", "Carrelage", "Électricité", "Plomberie", "Peinture", "Menuiserie"];

  const contacts = {
    "Tous": [
      { id: 1, name: "Talab Carrelage", type: "Carrelage", city: "Paris" },
      { id: 2, name: "Électrique Laurent", type: "Électricité", city: "Lyon" },
      { id: 3, name: "Plomberie Dupont", type: "Plomberie", city: "Marseille" }
    ],
    "Carrelage": [
      { id: 1, name: "Talab Carrelage", type: "Carrelage", city: "Paris" }
    ],
    "Électricité": [
      { id: 2, name: "Électrique Laurent", type: "Électricité", city: "Lyon" }
    ],
    "Plomberie": [
      { id: 3, name: "Plomberie Dupont", type: "Plomberie", city: "Marseille" }
    ]
  };

  const filteredContacts = contacts[selectedType] || [];

  return (
    <Shell>
      <div className="head">
        <button className="link" onClick={() => router.back()}>← Retour</button>
        <h1>Contacts par type</h1>
      </div>

      <div className="card">
        <div className="card-h"><h2>Filtrer par métier</h2></div>
        <div className="wtabs">
          {types.map((t) => (
            <a key={t} className={selectedType === t ? "on" : ""} onClick={() => setSelectedType(t)}>
              {t}
            </a>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h2>{selectedType}</h2></div>
        {filteredContacts.length > 0 ? (
          <div className="mlist">
            {filteredContacts.map((c) => (
              <div key={c.id} className="m-card">
                <div className="top2">
                  <div>
                    <div className="nm">{c.name}</div>
                    <div className="meta">{c.type} · {c.city}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <a href="#" className="link" style={{ fontSize: 12 }}>Voir la fiche</a>
                  <a href="#" className="link" style={{ fontSize: 12 }}>Contacter</a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty">Aucun contact de ce type.</p>
        )}
      </div>
    </Shell>
  );
}
