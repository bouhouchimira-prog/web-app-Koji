"use client";

import { useState } from "react";
import { Shell } from "../../components/Shell";

export default function ReseauProPage() {
  const [selectedTab, setSelectedTab] = useState("tous");

  const professionals = [
    { id: 1, name: "Talab Carrelage", type: "Carrelage", rating: 4.8, reviews: 12, verified: true },
    { id: 2, name: "Électrique Laurent", type: "Électricité", rating: 4.9, reviews: 8, verified: true },
    { id: 3, name: "Plomberie Dupont", type: "Plomberie", rating: 4.6, reviews: 15, verified: true },
    { id: 4, name: "Peinture Moderne", type: "Peinture", rating: 4.7, reviews: 10, verified: false },
    { id: 5, name: "Menuiserie Bois", type: "Menuiserie", rating: 4.5, reviews: 6, verified: true },
  ];

  const types = ["Tous", "Carrelage", "Électricité", "Plomberie", "Peinture", "Menuiserie"];

  const filteredProfessionals =
    selectedTab === "tous" ? professionals : professionals.filter((p) => p.type === selectedTab);

  return (
    <Shell>
      <div className="head">
        <div className="stack">
          <span className="eyebrow">Gestion</span>
          <h1>Réseau pro</h1>
        </div>
        <div className="hact">
          <a className="btn btn-main">+ Ajouter un professionnel</a>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h2>Professionnels disponibles</h2>
        </div>

        <div className="wtabs">
          {types.map((type) => (
            <a
              key={type}
              className={selectedTab === type.toLowerCase() ? "on" : ""}
              onClick={() => setSelectedTab(type.toLowerCase())}
            >
              {type}
            </a>
          ))}
        </div>

        <div style={{ marginTop: 24 }}>
          {filteredProfessionals.length === 0 ? (
            <p className="empty">Aucun professionnel trouvé dans cette catégorie.</p>
          ) : (
            <div className="mlist">
              {filteredProfessionals.map((prof) => (
                <div key={prof.id} className="m-card">
                  <div className="top2">
                    <div>
                      <div className="nm">{prof.name}</div>
                      <div className="meta">{prof.type}</div>
                    </div>
                    {prof.verified && (
                      <span className="ver">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M4 12l5 5L20 6" />
                        </svg>
                        Vérifié
                      </span>
                    )}
                  </div>
                  <div className="line">⭐ {prof.rating} · {prof.reviews} avis</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <a className="link">Voir le profil</a>
                    <a className="link">Contacter</a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
