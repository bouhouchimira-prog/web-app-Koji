"use client";

import { useState } from "react";
import { Shell } from "../../components/Shell";
import { apiSend } from "../../lib/client-api";
import { euro } from "../../lib/pricing";
import { useApi } from "../../lib/use-api";

const initialSupply = {
  name: "",
  category: "",
  unit: "unité",
  priceHt: "",
  stock: ""
};

export default function SuppliesPage() {
  const { data: supplies, setData: setSupplies } = useApi("/api/supplies", "supplies");
  const [form, setForm] = useState(initialSupply);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function createSupply(event) {
    event.preventDefault();
    const { supply } = await apiSend("/api/supplies", {
      ...form,
      priceHt: Number(form.priceHt || 0),
      stock: Number(form.stock || 0)
    });
    setSupplies([supply, ...supplies]);
    setForm(initialSupply);
  }

  return (
    <Shell>
      <header className="page-header">
        <div>
          <p className="eyebrow">FOURNITURES</p>
          <h1>Stock et prix matériaux</h1>
          <p className="muted">Gérez les produits utilisés par le moteur de devis.</p>
        </div>
      </header>

      <section className="grid cols-3">
        <div className="metric"><span>Produits</span><strong>{supplies.length}</strong></div>
        <div className="metric"><span>Stock total</span><strong>{supplies.reduce((sum, item) => sum + Number(item.stock || 0), 0)}</strong></div>
        <div className="metric"><span>Valeur HT</span><strong>{euro(supplies.reduce((sum, item) => sum + Number(item.stock || 0) * Number(item.priceHt || 0), 0))}</strong></div>
      </section>

      <section className="grid cols-2" style={{ marginTop: 22 }}>
        <form className="panel" onSubmit={createSupply}>
          <h2>Ajouter une fourniture</h2>
          <div className="form-grid">
            <label className="field full">Nom<input value={form.name} onChange={(event) => setField("name", event.target.value)} placeholder="Peinture velours blanc 10L" required /></label>
            <label className="field">Catégorie<input value={form.category} onChange={(event) => setField("category", event.target.value)} placeholder="peinture" required /></label>
            <label className="field">Unité<input value={form.unit} onChange={(event) => setField("unit", event.target.value)} /></label>
            <label className="field">Prix HT<input type="number" value={form.priceHt} onChange={(event) => setField("priceHt", event.target.value)} /></label>
            <label className="field">Stock<input type="number" value={form.stock} onChange={(event) => setField("stock", event.target.value)} /></label>
          </div>
          <button className="button blue" style={{ marginTop: 16 }}>Ajouter au stock</button>
        </form>

        <div className="panel">
          <h2>Lien avec les devis</h2>
          <p className="muted">Les catégories comme <strong>peinture</strong>, <strong>enduit</strong>, <strong>primaire</strong> et <strong>carrelage</strong> sont automatiquement utilisées par le calculateur de devis.</p>
          <div className="screen-note" style={{ marginTop: 14 }}>Modifiez ou ajoutez les fournitures ici, puis créez un devis pour voir les prix se recalculer.</div>
        </div>
      </section>

      <section className="table-card" style={{ marginTop: 22 }}>
        <table className="data-table">
          <thead><tr><th>Produit</th><th>Catégorie</th><th>Unité</th><th>Prix HT</th><th>Stock</th></tr></thead>
          <tbody>
            {supplies.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.name}</strong></td>
                <td>{item.category}</td>
                <td>{item.unit}</td>
                <td>{euro(item.priceHt)}</td>
                <td>{item.stock}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </Shell>
  );
}
