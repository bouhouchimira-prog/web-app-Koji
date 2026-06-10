"use client";

import { useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiSend } from "../../lib/client-api";
import { useApi } from "../../lib/use-api";

const professions = ["Peintre", "Carreleur", "Electricien", "Plombier", "Menuisier", "Tout corps d'etat"];

const initialWorker = {
  type: "Ouvrier",
  firstName: "",
  lastName: "",
  profession: "Peintre",
  phone: "",
  email: "",
  address: "",
  socialSecurityNumber: "",
  idCardUrl: "",
  hourlyRate: "",
  hireDate: "",
  notes: "",
  availability: "Disponible",
  favorite: true
};

export default function TeamPage() {
  const { data: workers, setData: setWorkers } = useApi("/api/workers", "workers");
  const [activeTab, setActiveTab] = useState("Ouvrier");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(initialWorker);
  const [message, setMessage] = useState("");

  const filteredWorkers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return workers.filter((worker) => {
      const type = worker.type || "Ouvrier";
      if (type !== activeTab) return false;
      if (!needle) return true;
      return [worker.name, worker.profession, worker.role, worker.email, worker.phone].join(" ").toLowerCase().includes(needle);
    });
  }, [activeTab, search, workers]);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function createWorker(event) {
    event.preventDefault();
    const name = [form.firstName, form.lastName].filter(Boolean).join(" ");
    const { worker } = await apiSend("/api/workers", {
      ...form,
      type: activeTab,
      name,
      role: form.profession,
      status: form.availability
    });
    setWorkers([worker, ...workers]);
    setForm({ ...initialWorker, type: activeTab });
    setFormOpen(false);
    setMessage(`${activeTab} ajoute: ${worker.name}`);
  }

  async function updateWorker(worker, patch) {
    const { worker: updated } = await apiSend("/api/workers", { id: worker.id, ...patch }, "PATCH");
    setWorkers(workers.map((item) => (item.id === updated.id ? updated : item)));
  }

  async function deleteWorker(worker) {
    const { worker: deleted } = await apiSend("/api/workers", { id: worker.id, action: "delete" }, "PATCH");
    if (deleted?.deleted) setWorkers(workers.filter((item) => item.id !== worker.id));
  }

  if (formOpen) {
    return (
      <Shell>
        <section className="mobile-tool tool-form-view">
          <header className="tool-topline">
            <button type="button" className="plain-back" onClick={() => setFormOpen(false)}>{"<"}</button>
            <h1>Nouveau {activeTab}</h1>
            <span />
          </header>

          <form className="mobile-form" onSubmit={createWorker}>
            <div className="worker-photo-box">
              <div>Photo</div>
              <span>+</span>
              <small>Photo de {activeTab.toLowerCase()}</small>
            </div>
            <label className="mobile-input full">
              <span>Prenom</span>
              <input value={form.firstName} onChange={(event) => setField("firstName", event.target.value)} placeholder="Rajouter votre texte..." required />
            </label>
            <label className="mobile-input full">
              <span>Nom</span>
              <input value={form.lastName} onChange={(event) => setField("lastName", event.target.value)} placeholder="Rajouter votre texte..." />
            </label>
            <label className="mobile-input full">
              <span>Profession</span>
              <select value={form.profession} onChange={(event) => setField("profession", event.target.value)}>
                {professions.map((profession) => <option key={profession}>{profession}</option>)}
              </select>
            </label>
            <label className="mobile-input full">
              <span>Numero de telephone</span>
              <input value={form.phone} onChange={(event) => setField("phone", event.target.value)} placeholder="06 12 34 56 78" />
            </label>
            <label className="mobile-input full">
              <span>Email</span>
              <input type="email" value={form.email} onChange={(event) => setField("email", event.target.value)} placeholder="exemple@email.com" />
            </label>
            <div className="mobile-form-grid">
              <label className="mobile-input">
                <span>Tarif horaire</span>
                <input type="number" step="0.01" value={form.hourlyRate} onChange={(event) => setField("hourlyRate", event.target.value)} placeholder="0.00" />
              </label>
              <label className="mobile-input">
                <span>Date d'entree</span>
                <input type="date" value={form.hireDate} onChange={(event) => setField("hireDate", event.target.value)} />
              </label>
            </div>
            <label className="mobile-input full">
              <span>Adresse</span>
              <input value={form.address} onChange={(event) => setField("address", event.target.value)} placeholder="Adresse du participant" />
            </label>
            <label className="mobile-input full">
              <span>Numero securite sociale</span>
              <input value={form.socialSecurityNumber} onChange={(event) => setField("socialSecurityNumber", event.target.value)} placeholder="Information interne" />
            </label>
            <label className="mobile-input full">
              <span>Document d'identite</span>
              <input value={form.idCardUrl} onChange={(event) => setField("idCardUrl", event.target.value)} placeholder="URL ou reference du document" />
            </label>
            <label className="mobile-input full">
              <span>Disponibilite</span>
              <select value={form.availability} onChange={(event) => setField("availability", event.target.value)}>
                <option>Disponible</option>
                <option>Occupe</option>
                <option>Absent</option>
              </select>
            </label>
            <label className="mobile-input full">
              <span>Notes</span>
              <input value={form.notes} onChange={(event) => setField("notes", event.target.value)} placeholder="Competences, contrat, remarques..." />
            </label>
            <button className="mobile-primary">Enregistrer le profil</button>
          </form>
        </section>
      </Shell>
    );
  }

  return (
    <Shell>
      <section className="mobile-tool">
        <header className="tool-topline">
          <button type="button" className="plain-back" onClick={() => (window.history.length > 1 ? window.history.back() : window.location.assign("/"))}>{"<"}</button>
          <h1>Equipe</h1>
          <button type="button" className="round-dark" onClick={() => setFormOpen(true)}>+</button>
        </header>

        <div className="search-pill">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un participant..." />
        </div>

        <div className="segmented large">
          <button type="button" className={activeTab === "Ouvrier" ? "active" : ""} onClick={() => setActiveTab("Ouvrier")}>Ouvriers</button>
          <button type="button" className={activeTab === "Sous-traitant" ? "active" : ""} onClick={() => setActiveTab("Sous-traitant")}>Sous-traitants</button>
        </div>

        {message ? <p className="tool-message">{message}</p> : null}
        <h2 className="tool-subtitle">Favoris</h2>

        <div className="people-list">
          {filteredWorkers.length === 0 ? <div className="tool-empty">Aucun participant pour le moment.</div> : null}
          {filteredWorkers.map((worker) => (
            <article className="person-row" key={worker.id}>
              <div className="avatar">
                {(worker.name || "AB").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
                <i className={worker.availability === "Disponible" ? "online" : ""} />
              </div>
              <div>
                <strong>{worker.name}</strong>
                <small>{worker.profession || worker.role} - {worker.availability || "Disponible"}{worker.hourlyRate ? ` - ${worker.hourlyRate} EUR/h` : ""}</small>
                {worker.phone || worker.email ? <small>{[worker.phone, worker.email].filter(Boolean).join(" - ")}</small> : null}
              </div>
              <button type="button" className={worker.favorite ? "select-dot selected" : "select-dot"} onClick={() => updateWorker(worker, { favorite: !worker.favorite })} aria-label="Favori" />
              <button type="button" className="mini-danger" onClick={() => deleteWorker(worker)}>Supprimer</button>
            </article>
          ))}
        </div>

        <button type="button" className="mobile-primary sticky-bottom" onClick={() => setFormOpen(true)}>Ajouter</button>
      </section>
    </Shell>
  );
}
