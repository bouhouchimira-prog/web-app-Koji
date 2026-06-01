"use client";

import { useState } from "react";
import { Shell } from "../../components/Shell";
import { apiSend } from "../../lib/client-api";
import { shortDate } from "../../lib/pricing";
import { useApi } from "../../lib/use-api";

const initialTask = {
  label: "",
  project: "",
  room: "Salon",
  dueDate: "",
  durationHours: 1,
  assignedTo: ""
};

export default function PlanningPage() {
  const { data: tasks, setData: setTasks } = useApi("/api/tasks", "tasks");
  const { data: projects } = useApi("/api/projects", "projects");
  const [form, setForm] = useState(initialTask);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function createTask(event) {
    event.preventDefault();
    const { task } = await apiSend("/api/tasks", {
      ...form,
      dueDate: form.dueDate || new Date().toISOString().slice(0, 10)
    });
    setTasks([task, ...tasks]);
    setForm(initialTask);
  }

  const grouped = tasks.reduce((acc, task) => {
    acc[task.dueDate] = [...(acc[task.dueDate] || []), task];
    return acc;
  }, {});

  return (
    <Shell>
      <header className="page-header">
        <div>
          <p className="eyebrow">PLANNING</p>
          <h1>Organisation des tâches</h1>
          <p className="muted">Planifiez les interventions, assignez les personnes et suivez les durées.</p>
        </div>
      </header>

      <section className="grid cols-2">
        <form className="panel" onSubmit={createTask}>
          <h2>Ajouter une tâche</h2>
          <div className="form-grid">
            <label className="field full">Libellé<input value={form.label} onChange={(event) => setField("label", event.target.value)} placeholder="Planification cuisine IKEA" required /></label>
            <label className="field">Chantier<select value={form.project} onChange={(event) => setField("project", event.target.value)}>
              <option value="">Choisir</option>
              {projects.map((project) => <option key={project.id}>{project.title}</option>)}
            </select></label>
            <label className="field">Pièce<input value={form.room} onChange={(event) => setField("room", event.target.value)} /></label>
            <label className="field">Date<input type="date" value={form.dueDate} onChange={(event) => setField("dueDate", event.target.value)} /></label>
            <label className="field">Durée (h)<input type="number" step="0.5" value={form.durationHours} onChange={(event) => setField("durationHours", event.target.value)} /></label>
            <label className="field">Assigné à<input value={form.assignedTo} onChange={(event) => setField("assignedTo", event.target.value)} placeholder="Amir" /></label>
          </div>
          <button className="button blue" style={{ marginTop: 16 }}>Ajouter au planning</button>
        </form>

        <div className="panel">
          <h2>Vue opérationnelle</h2>
          <div className="grid">
            {Object.entries(grouped).slice(0, 4).map(([date, items]) => (
              <div className="work-card" key={date}>
                <strong>{shortDate(date)}</strong>
                <p className="muted">{items.length} tâche(s)</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="table-card" style={{ marginTop: 22 }}>
        <table className="data-table">
          <thead><tr><th>Tâche</th><th>Chantier</th><th>Pièce</th><th>Date</th><th>Durée</th><th>Assigné</th></tr></thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td><strong>{task.label}</strong></td>
                <td>{task.project}</td>
                <td>{task.room}</td>
                <td>{shortDate(task.dueDate)}</td>
                <td>{task.durationHours} h</td>
                <td>{task.assignedTo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </Shell>
  );
}
