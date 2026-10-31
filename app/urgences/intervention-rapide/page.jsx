"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shell } from "../../../components/Shell";

export default function InterventionRapidePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    type: "Fuite",
    severity: "Moyenne",
    address: "",
    description: "",
    phone: ""
  });

  const types = ["Fuite", "Électricité", "Carrelage", "Peinture", "Autre"];

  return (
    <Shell>
      <div className="head">
        <button className="link" onClick={() => router.back()}>← Retour</button>
        <h1>Demander une intervention rapide</h1>
      </div>

      <div className="card">
        <div className="card-h"><h2>Nature de l'urgence</h2></div>
        <div className="fgrid">
          <label className="full">
            <span>Type de problème</span>
            <select value={form.type} onChange={(e) => setForm({...form, type: e.target.value})}>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>

          <label>
            <span>Urgence</span>
            <select value={form.severity} onChange={(e) => setForm({...form, severity: e.target.value})}>
              <option>Faible</option>
              <option>Moyenne</option>
              <option>Élevée</option>
              <option>Critique</option>
            </select>
          </label>

          <label className="full">
            <span>Adresse du chantier</span>
            <input value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} placeholder="123 Rue, CP Ville" />
          </label>

          <label className="full">
            <span>Description du problème</span>
            <textarea rows={4} value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} placeholder="Décrivez le problème en détail..." />
          </label>

          <label className="full">
            <span>Téléphone du client</span>
            <input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} placeholder="06 12 34 56 78" />
          </label>
        </div>

        <div className="ed-act" style={{ marginTop: 24 }}>
          <button className="btn btn-sec" onClick={() => router.back()}>Annuler</button>
          <button className="btn btn-main">⚡ Demander intervention</button>
        </div>
      </div>
    </Shell>
  );
}
