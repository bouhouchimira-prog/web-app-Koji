"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shell } from "../../../../components/Shell";

export default function AjouterContactPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    type: "Carrelage",
    phone: "",
    email: "",
    address: "",
    siret: ""
  });

  const types = ["Carrelage", "Électricité", "Plomberie", "Peinture", "Menuiserie", "Maçonnerie", "Chauffage", "Autre"];

  return (
    <Shell>
      <div className="head">
        <button className="link" onClick={() => router.back()}>← Retour</button>
        <h1>Ajouter un contact</h1>
      </div>

      <div className="card">
        <div className="card-h"><h2>Informations du contact</h2></div>
        <div className="fgrid">
          <label className="full">
            <span>Nom de l'entreprise</span>
            <input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="Ex: Carrelages Modernes" />
          </label>

          <label>
            <span>Type de métier</span>
            <select value={form.type} onChange={(e) => setForm({...form, type: e.target.value})}>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>

          <label>
            <span>Téléphone</span>
            <input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} placeholder="06 12 34 56 78" />
          </label>

          <label>
            <span>Email</span>
            <input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} placeholder="contact@example.fr" />
          </label>

          <label className="full">
            <span>Adresse</span>
            <input value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} placeholder="123 Rue, Code Postal Ville" />
          </label>

          <label>
            <span>SIRET</span>
            <input value={form.siret} onChange={(e) => setForm({...form, siret: e.target.value})} placeholder="12 345 678 901 234" />
          </label>
        </div>

        <div className="ed-act" style={{ marginTop: 24 }}>
          <button className="btn btn-sec" onClick={() => router.back()}>Annuler</button>
          <button className="btn btn-main">✓ Ajouter le contact</button>
        </div>
      </div>
    </Shell>
  );
}
