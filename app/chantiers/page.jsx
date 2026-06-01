"use client";

import { useState } from "react";
import { Shell } from "../../components/Shell";
import { apiSend } from "../../lib/client-api";
import { euro, shortDate } from "../../lib/pricing";
import { useApi } from "../../lib/use-api";

const initialForm = {
  title: "",
  client: "",
  address: "",
  budgetHt: "",
  dueDate: ""
};

export default function ProjectsPage() {
  const { data: projects, setData: setProjects } = useApi("/api/projects", "projects");
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function createProject(event) {
    event.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      budgetHt: Number(form.budgetHt || 0),
      dueDate: form.dueDate || new Date().toISOString().slice(0, 10)
    };
    const { project } = await apiSend("/api/projects", payload);
    setProjects([project, ...projects]);
    setForm(initialForm);
    setSaving(false);
  }

  return (
    <Shell>
      <header className="page-header">
        <div>
          <p className="eyebrow">CHANTIERS</p>
          <h1>Suivi des chantiers</h1>
          <p className="muted">Créez les chantiers, suivez les statuts, budgets et échéances.</p>
        </div>
      </header>

      <section className="grid cols-3">
        <div className="metric"><span>Total</span><strong>{projects.length}</strong></div>
        <div className="metric"><span>En cours</span><strong>{projects.filter((p) => p.status === "En cours").length}</strong></div>
        <div className="metric"><span>Budget total</span><strong>{euro(projects.reduce((sum, p) => sum + Number(p.budgetHt || 0), 0))}</strong></div>
      </section>

      <section className="grid cols-2" style={{ marginTop: 22 }}>
        <form className="panel" onSubmit={createProject}>
          <h2>Nouveau chantier</h2>
          <div className="form-grid">
            <label className="field full">Référence / nom du chantier<input value={form.title} onChange={(event) => setField("title", event.target.value)} placeholder="Loft Durand - Cuisine" required /></label>
            <label className="field">Client<input value={form.client} onChange={(event) => setField("client", event.target.value)} placeholder="Nom client" required /></label>
            <label className="field">Budget HT<input value={form.budgetHt} onChange={(event) => setField("budgetHt", event.target.value)} type="number" placeholder="12000" /></label>
            <label className="field full">Adresse<input value={form.address} onChange={(event) => setField("address", event.target.value)} placeholder="Numéro, rue, ville" /></label>
            <label className="field">Échéance<input value={form.dueDate} onChange={(event) => setField("dueDate", event.target.value)} type="date" /></label>
          </div>
          <button className="button blue" disabled={saving} style={{ marginTop: 16 }}>{saving ? "Création..." : "Créer le chantier"}</button>
        </form>

        <div className="panel">
          <h2>Workflow Koji</h2>
          <div className="work-card">
            <strong>1. Créer le chantier</strong>
            <p className="muted">Client, adresse, type de bien, budget estimé.</p>
          </div>
          <div className="work-card" style={{ marginTop: 12 }}>
            <strong>2. Ajouter les ouvrages</strong>
            <p className="muted">Pièces, prestations, temps normatif, fournitures.</p>
          </div>
          <div className="work-card" style={{ marginTop: 12 }}>
            <strong>3. Suivre l'exécution</strong>
            <p className="muted">Planning, tâches, devis, documents et signature.</p>
          </div>
        </div>
      </section>

      <section className="table-card" style={{ marginTop: 22 }}>
        <table className="data-table">
          <thead>
            <tr><th>Chantier</th><th>Client</th><th>Échéance</th><th>Statut</th><th>Progression</th><th>Budget</th></tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id}>
                <td><strong>{project.title}</strong><br /><span className="muted">{project.reference}</span></td>
                <td>{project.client}</td>
                <td>{shortDate(project.dueDate)}</td>
                <td><span className="status">{project.status}</span></td>
                <td><div className="progress"><span style={{ width: `${project.progress}%` }} /></div></td>
                <td>{euro(project.budgetHt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </Shell>
  );
}
