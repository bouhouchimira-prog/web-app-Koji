"use client";

import { useRouter } from "next/navigation";
import { Shell } from "../../../../components/Shell";

export default function FicheCompagnonPage() {
  const router = useRouter();
  const member = {
    name: "Jean Dupont",
    role: "Compagnon carreleur",
    phone: "06 12 34 56 78",
    email: "jean.dupont@example.fr",
    startDate: "2024-03-15",
    status: "Actif",
    hoursThisMonth: 160,
    projectsActive: 8,
    expertise: ["Carrelage", "Mosaïque", "Dallage"],
    rating: 4.9
  };

  return (
    <Shell>
      <div className="head">
        <button className="link" onClick={() => router.back()}>← Retour</button>
        <h1>{member.name}</h1>
      </div>

      <div className="card">
        <div className="card-h"><h2>Informations personnelles</h2></div>
        <div className="row">
          <div className="t"><small>Fonction</small><strong>{member.role}</strong></div>
        </div>
        <div className="row">
          <div className="t"><small>Téléphone</small><strong>{member.phone}</strong></div>
        </div>
        <div className="row">
          <div className="t"><small>Email</small><strong>{member.email}</strong></div>
        </div>
        <div className="row">
          <div className="t"><small>Date d'embauche</small><strong>{new Date(member.startDate).toLocaleDateString("fr-FR")}</strong></div>
        </div>
      </div>

      <div className="kpis">
        <div>
          <div className="l">Statut</div>
          <div className="v" style={{ fontSize: 15 }}>{member.status}</div>
          <div className="s">Disponible</div>
        </div>
        <div>
          <div className="l">Heures (mois)</div>
          <div className="v">{member.hoursThisMonth}h</div>
          <div className="s">Travaillées</div>
        </div>
        <div>
          <div className="l">Chantiers actifs</div>
          <div className="v">{member.projectsActive}</div>
          <div className="s">En cours</div>
        </div>
        <div>
          <div className="l">Note</div>
          <div className="v">{member.rating}/5</div>
          <div className="s">Évaluation</div>
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h2>Domaines d'expertise</h2></div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {member.expertise.map((exp) => (
            <span key={exp} className="tag tag-b">{exp}</span>
          ))}
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
