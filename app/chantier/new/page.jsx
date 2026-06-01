"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shell } from "../../../components/Shell";
import { apiSend } from "../../../lib/client-api";

export default function NewProjectPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    client: "",
    street: "",
    postalCode: "",
    city: "",
    propertyType: "Maison",
    budgetHt: ""
  });

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    await apiSend("/api/projects", {
      title: form.title,
      client: form.client || form.title.split(" ")[0] || "Client",
      address: `${form.street}, ${form.postalCode} ${form.city}`,
      budgetHt: Number(form.budgetHt || 0),
      dueDate: new Date().toISOString().slice(0, 10)
    });
    router.push("/chantiers");
  }

  return (
    <Shell>
      <header className="page-header">
        <div>
          <p className="eyebrow">NOUVEAU CHANTIER</p>
          <h1>Créer un chantier</h1>
          <p className="muted">Renseignez les informations de départ, puis ajoutez les ouvrages depuis le générateur de devis.</p>
        </div>
      </header>

      <form className="panel" onSubmit={submit}>
        <div className="form-grid">
          <label className="field">Référence du chantier<input value={form.title} onChange={(event) => setField("title", event.target.value)} placeholder="Loft Durand - Cuisine" required /></label>
          <label className="field">Client<input value={form.client} onChange={(event) => setField("client", event.target.value)} placeholder="Durand" /></label>
          <label className="field full">Numéro / Rue<input value={form.street} onChange={(event) => setField("street", event.target.value)} placeholder="12 rue des Artisans" /></label>
          <label className="field">Code postal<input value={form.postalCode} onChange={(event) => setField("postalCode", event.target.value)} placeholder="75011" /></label>
          <label className="field">Ville<input value={form.city} onChange={(event) => setField("city", event.target.value)} placeholder="Paris" /></label>
          <label className="field">Type du bien<select value={form.propertyType} onChange={(event) => setField("propertyType", event.target.value)}>
            <option>Maison</option>
            <option>Appartement</option>
            <option>Local commercial</option>
          </select></label>
          <label className="field">Budget estimé HT<input type="number" value={form.budgetHt} onChange={(event) => setField("budgetHt", event.target.value)} placeholder="15000" /></label>
        </div>
        <div className="actions" style={{ marginTop: 18 }}>
          <button className="button blue">Créer le chantier</button>
          <button className="button secondary" type="button" onClick={() => router.push("/devis")}>Créer un devis ensuite</button>
        </div>
      </form>
    </Shell>
  );
}
