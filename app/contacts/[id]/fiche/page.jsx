"use client";

import { useRouter } from "next/navigation";
import { Shell } from "../../../../components/Shell";

export default function FicheSousTraitantPage() {
  const router = useRouter();
  const contact = {
    name: "Talab Carrelage",
    type: "Carrelage",
    phone: "06 12 34 56 78",
    email: "contact@talab-carrelage.fr",
    address: "123 Rue des Artisans, 75000 Paris",
    city: "Paris",
    siret: "12 345 678 901 234",
    verified: true,
    rating: 4.8,
    reviews: 12,
    worksDone: 24
  };

  return (
    <Shell>
      <div className="head">
        <button className="link" onClick={() => router.back()}>← Retour</button>
        <h1>{contact.name}</h1>
      </div>

      <div className="card">
        <div className="card-h"><h2>Informations</h2></div>
        <div className="row">
          <div className="t"><small>Type</small><strong>{contact.type}</strong></div>
        </div>
        <div className="row">
          <div className="t"><small>Téléphone</small><strong>{contact.phone}</strong></div>
        </div>
        <div className="row">
          <div className="t"><small>Email</small><strong>{contact.email}</strong></div>
        </div>
        <div className="row">
          <div className="t"><small>Adresse</small><strong>{contact.address}</strong></div>
        </div>
        <div className="row">
          <div className="t"><small>SIRET</small><strong className="sm">{contact.siret}</strong></div>
        </div>
      </div>

      <div className="kpis">
        <div>
          <div className="l">Note</div>
          <div className="v">{contact.rating}/5</div>
          <div className="s">{contact.reviews} avis</div>
        </div>
        <div>
          <div className="l">Chantiers</div>
          <div className="v">{contact.worksDone}</div>
          <div className="s">Travaux réalisés</div>
        </div>
        <div>
          <div className="l">Statut</div>
          <div className="v" style={{ fontSize: 15 }}>{contact.verified ? "✓" : "⏳"}</div>
          <div className="s">{contact.verified ? "Vérifié" : "En attente"}</div>
        </div>
        <div>
          <div className="l">Dernier chantier</div>
          <div className="v" style={{ fontSize: 15 }}>Oct 2026</div>
          <div className="s">Contact actif</div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-sec">📞 Appeler</button>
          <button className="btn btn-sec">📧 Email</button>
          <button className="btn btn-main">✏️ Éditer</button>
        </div>
      </div>
    </Shell>
  );
}
