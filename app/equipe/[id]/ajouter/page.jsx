"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shell } from "../../../../components/Shell";

export default function AjouterCompagnonPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    role: "Compagnon",
    phone: "",
    email: "",
    expertise: []
  });

  const roles = ["Compagnon", "Aide", "Apprenti", "Chef d'équipe"];
  const expertiseOptions = ["Carrelage", "Électricité", "Plomberie", "Peinture", "Menuiserie", "Maçonnerie"];

  const toggleExpertise = (exp) => {
    setForm({
      ...form,
      expertise: form.expertise.includes(exp)
        ? form.expertise.filter(e => e !== exp)
        : [...form.expertise, exp]
    });
  };

  return (
    <Shell>
      <div className="head">
        <button className="link" onClick={() => router.back()}>← Retour</button>
        <h1>Ajouter un compagnon</h1>
      </div>

      <div className="card">
        <div className="card-h"><h2>Informations personnelles</h2></div>
        <div className="fgrid">
          <label className="full">
            <span>Nom complet</span>
            <input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="Ex: Jean Dupont" />
          </label>

          <label>
            <span>Fonction</span>
            <select value={form.role} onChange={(e) => setForm({...form, role: e.target.value})}>
              {roles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>

          <label>
            <span>Téléphone</span>
            <input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} placeholder="06 12 34 56 78" />
          </label>

          <label className="full">
            <span>Email</span>
            <input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} placeholder="jean@example.fr" />
          </label>
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h2>Domaines d'expertise</h2></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {expertiseOptions.map((exp) => (
            <button
              key={exp}
              type="button"
              onClick={() => toggleExpertise(exp)}
              className={`btn btn-sm ${form.expertise.includes(exp) ? "btn-main" : "btn-sec"}`}
              style={{ fontSize: 13, padding: "0 12px" }}
            >
              {form.expertise.includes(exp) ? "✓ " : ""}{exp}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="ed-act">
          <button className="btn btn-sec" onClick={() => router.back()}>Annuler</button>
          <button className="btn btn-main">✓ Ajouter le compagnon</button>
        </div>
      </div>
    </Shell>
  );
}
