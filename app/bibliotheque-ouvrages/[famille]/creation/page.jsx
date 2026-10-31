"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shell } from "../../../../components/Shell";

export default function CreationOuvragePage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", description: "", unit: "m²", basePrice: "" });

  return (
    <Shell>
      <div className="head">
        <button className="link" onClick={() => router.back()}>← Retour</button>
        <h1>Créer un ouvrage</h1>
      </div>

      <div className="card">
        <div className="card-h"><h2>Détails de l'ouvrage</h2></div>
        <div className="fgrid">
          <label className="full">
            <span>Nom de l'ouvrage</span>
            <input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="Ex: Carrelage 60x60" />
          </label>
          <label className="full">
            <span>Description</span>
            <textarea rows={3} value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} placeholder="Détails, finitions..." />
          </label>
          <label>
            <span>Unité</span>
            <select value={form.unit} onChange={(e) => setForm({...form, unit: e.target.value})}>
              <option>m²</option><option>m</option><option>pcs</option>
            </select>
          </label>
          <label>
            <span>Prix de base (€)</span>
            <input type="number" value={form.basePrice} onChange={(e) => setForm({...form, basePrice: e.target.value})} placeholder="0" />
          </label>
        </div>
        <div className="ed-act" style={{ marginTop: 24 }}>
          <button className="btn btn-sec" onClick={() => router.back()}>Annuler</button>
          <button className="btn btn-main">✓ Créer</button>
        </div>
      </div>
    </Shell>
  );
}
