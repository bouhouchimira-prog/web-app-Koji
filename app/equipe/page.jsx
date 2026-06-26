"use client";

import { useMemo, useRef, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiSend } from "../../lib/client-api";
import { useApi } from "../../lib/use-api";

const professions = ["Peintre", "Carreleur", "Electricien", "Plombier", "Menuisier", "Tout corps d'etat"];

const initialWorker = {
  type: "Ouvrier",
  name: "",
  profession: "Peintre",
  phone: "",
  email: "",
  address: "",
  photoDataUrl: "",
  hourlyRate: "",
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
  const photoInputRef = useRef(null);

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

  function onPhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setField("photoDataUrl", String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  async function createWorker(event) {
    event.preventDefault();
    const { worker } = await apiSend("/api/workers", {
      ...form,
      type: activeTab,
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
              <div className="worker-photo-frame">
                {form.photoDataUrl ? <img src={form.photoDataUrl} alt="Photo" /> : null}
                <button type="button" className="worker-photo-upload" onClick={() => photoInputRef.current?.click()} aria-label="Ajouter une photo">+</button>
              </div>
              <small>Photo</small>
              <input ref={photoInputRef} type="file" accept="image/*" onChange={onPhotoChange} style={{ display: "none" }} />
            </div>
            <label className="mobile-input full">
              <span>Nom et prenom</span>
              <input value={form.name} onChange={(event) => setField("name", event.target.value)} placeholder="Rajouter votre texte..." required />
            </label>
            <label className="mobile-input full">
              <span>Numero de telephone</span>
              <input value={form.phone} onChange={(event) => setField("phone", event.target.value)} placeholder="06 12 34 56 78" />
            </label>
            <label className="mobile-input full">
              <span>Email</span>
              <input type="email" value={form.email} onChange={(event) => setField("email", event.target.value)} placeholder="exemple@email.com" />
            </label>
            <label className="mobile-input full">
              <span>Adresse postale</span>
              <input value={form.address} onChange={(event) => setField("address", event.target.value)} placeholder="Adresse du participant" />
            </label>
            <label className="mobile-input full">
              <span>Profession</span>
              <select value={form.profession} onChange={(event) => setField("profession", event.target.value)}>
                {professions.map((profession) => <option key={profession}>{profession}</option>)}
              </select>
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
              <span>Taux horaire / journalier</span>
              <input type="number" step="0.01" value={form.hourlyRate} onChange={(event) => setField("hourlyRate", event.target.value)} placeholder="0.00" />
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
                {worker.photoDataUrl ? (
                  <img src={worker.photoDataUrl} alt={worker.name} />
                ) : (
                  (worker.name || "AB").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()
                )}
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
