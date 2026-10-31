"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shell } from "../../../../components/Shell";

export default function AjouterFourniturePage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", qty: "", unit: "m²", cost: "" });

  return (
    <Shell>
      <div className="head">
        <button className="link" onClick={() => router.back()}>← Retour</button>
        <h1>Ajouter une fourniture</h1>
      </div>

      <div className="card">
        <div className="card-h"><h2>Détails de la fourniture</h2></div>
        <div className="fgrid">
          <label className="full">
            <span>Nom de l'article</span>
            <input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="Ex: Carrelage 60x60" />
          </label>
          <label>
            <span>Quantité</span>
            <input type="number" value={form.qty} onChange={(e) => setForm({...form, qty: e.target.value})} placeholder="0" />
          </label>
          <label>
            <span>Unité</span>
            <select value={form.unit} onChange={(e) => setForm({...form, unit: e.target.value})}>
              <option>m²</option>
              <option>pcs</option>
              <option>sacs</option>
              <option>m</option>
              <option>l</option>
            </select>
          </label>
          <label>
            <span>Coût unitaire (€)</span>
            <input type="number" value={form.cost} onChange={(e) => setForm({...form, cost: e.target.value})} placeholder="0" />
          </label>
        </div>
        <div className="ed-act" style={{ marginTop: 24 }}>
          <button className="btn btn-sec" onClick={() => router.back()}>Annuler</button>
          <button className="btn btn-main">✓ Ajouter</button>
        </div>
      </div>
    </Shell>
  );
}
