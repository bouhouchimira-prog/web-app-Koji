"use client";

import { useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiSend } from "../../lib/client-api";
import { useApi } from "../../lib/use-api";
import catalog from "../../data/catalog-ouvrages.json";

const emptyForm = {
  id: "",
  code: "",
  label: "",
  family: "Carrelage",
  category: "General",
  unit: "m²",
  normativeTime: "",
  hourlyRate: 0,
  coefficient: 1,
  discount: 0,
  description: "",
  parentCode: ""
};

function formatHours(value) {
  return Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: 3 });
}

function formatMoney(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function moCost(item) {
  const base = Number(item.normativeTime || 0) * Number(item.hourlyRate || 0);
  const coefficient = Number(item.coefficient || 1);
  const discount = 1 - Number(item.discount || 0) / 100;
  return Math.max(0, base * coefficient * discount);
}

function nextSubCode(parentCode, siblings) {
  const numbers = siblings
    .map((item) => item.code?.replace(`${parentCode}-`, ""))
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  const next = Math.max(0, ...numbers) + 1;
  return `${parentCode}-${String(next).padStart(2, "0")}`;
}

export default function OuvragesLibraryPage() {
  const { data: ouvrages, setData: setOuvrages } = useApi("/api/ouvrages", "ouvrages", catalog);
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("Toutes");
  const [selectedIds, setSelectedIds] = useState([]);
  const [openMenuId, setOpenMenuId] = useState("");
  const [formMode, setFormMode] = useState("list");
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");

  const families = useMemo(() => {
    return ["Toutes", ...Array.from(new Set(ouvrages.map((item) => item.family || "Autre"))).sort()];
  }, [ouvrages]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return ouvrages.filter((item) => {
      if (family !== "Toutes" && item.family !== family) return false;
      if (!normalized) return true;
      return [item.code, item.label, item.family, item.category, item.description]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [ouvrages, query, family]);

  const grouped = useMemo(() => {
    const out = {};
    for (const item of filtered) {
      const key = item.family || "Autre";
      if (!out[key]) out[key] = [];
      out[key].push(item);
    }
    return out;
  }, [filtered]);

  const selectedItems = useMemo(() => {
    return selectedIds.map((id) => ouvrages.find((item) => item.id === id)).filter(Boolean);
  }, [ouvrages, selectedIds]);

  const units = ["m²", "m³", "ml", "u", "h", "jour"];

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleSelected(id) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function startCreate(parent = null) {
    const siblings = parent ? ouvrages.filter((item) => item.parentCode === parent.code) : [];
    setForm({
      ...emptyForm,
      family: parent?.family || (family !== "Toutes" ? family : "Carrelage"),
      category: parent?.category || "General",
      unit: parent?.unit || "m²",
      parentCode: parent?.code || "",
      code: parent ? nextSubCode(parent.code, siblings) : ""
    });
    setFormMode(parent ? "sub" : "create");
    setOpenMenuId("");
    setMessage("");
  }

  function startEdit(item) {
    setForm({
      ...emptyForm,
      ...item,
      parentCode: item.parentCode || "",
      normativeTime: item.normativeTime ?? ""
    });
    setFormMode("edit");
    setOpenMenuId("");
    setMessage("");
  }

  async function saveOuvrage(event) {
    event.preventDefault();
    const payload = {
      ...form,
      normativeTime: Number(form.normativeTime || 0),
      hourlyRate: Number(form.hourlyRate || 0),
      coefficient: Number(form.coefficient || 1),
      discount: Number(form.discount || 0)
    };
    const method = formMode === "edit" ? "PATCH" : "POST";
    const { ouvrages: nextOuvrages } = await apiSend("/api/ouvrages", payload, method);
    setOuvrages(nextOuvrages);
    setFormMode("list");
    setForm(emptyForm);
    setMessage(formMode === "edit" ? "Ouvrage enregistre." : "Ouvrage cree.");
  }

  async function deleteOuvrage(item) {
    setOpenMenuId("");
    if (!window.confirm(`Supprimer ${item.code} ?`)) return;
    const response = await fetch(`/api/ouvrages?id=${encodeURIComponent(item.id)}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error || "Suppression impossible.");
      return;
    }
    setOuvrages(payload.ouvrages);
    setSelectedIds((current) => current.filter((id) => id !== item.id));
    setMessage("Ouvrage supprime.");
  }

  function addSelectionToQuote() {
    window.localStorage.setItem("koji-devis-ouvrages", JSON.stringify(selectedItems.map((item) => item.id)));
    window.location.href = "/devis?selection=ouvrages";
  }

  if (formMode !== "list") {
    const title = formMode === "edit" ? "Modifier ouvrage" : "Nouvel ouvrage";
    const buttonLabel = formMode === "edit" ? "Enregistrer" : "Creer l'ouvrage";
    const cost = moCost(form);

    return (
      <Shell>
        <main className="library-page">
          <header className="library-top">
            <button type="button" onClick={() => setFormMode("list")} aria-label="Retour">{"<"}</button>
            <h1>{title}</h1>
            <span />
          </header>

          <form className="ouvrage-form" onSubmit={saveOuvrage}>
            <label className="library-field full">Code<input value={form.code} onChange={(event) => setField("code", event.target.value)} placeholder="Ex: CAR-01" required /></label>
            <label className="library-field full">Designation<textarea value={form.label} onChange={(event) => setField("label", event.target.value)} placeholder="Pose carrelage sol <= 60x60 cm" required /></label>
            <label className="library-field">Famille<select value={form.family} onChange={(event) => setField("family", event.target.value)}>
              {families.filter((item) => item !== "Toutes").map((item) => <option key={item}>{item}</option>)}
            </select></label>
            <label className="library-field">Unite<select value={form.unit} onChange={(event) => setField("unit", event.target.value)}>
              {units.map((item) => <option key={item}>{item}</option>)}
            </select></label>
            <label className="library-field">Temps (h/u)<input type="number" step="0.001" value={form.normativeTime} onChange={(event) => setField("normativeTime", event.target.value)} placeholder="1.20" /></label>
            <label className="library-field">Taux horaire (EUR)<input type="number" step="0.01" value={form.hourlyRate} onChange={(event) => setField("hourlyRate", event.target.value)} /></label>
            <div className="mo-box">Cout MO/u : <strong>{formatMoney(cost)}</strong></div>
            <label className="library-field">Coefficient<input type="number" step="0.05" value={form.coefficient} onChange={(event) => setField("coefficient", event.target.value)} /></label>
            <label className="library-field">Reduction (%)<input type="number" step="1" value={form.discount} onChange={(event) => setField("discount", event.target.value)} /></label>
            <label className="library-field full">Commentaire<textarea value={form.description} onChange={(event) => setField("description", event.target.value)} placeholder="Colle + joints inclus" /></label>
            {form.parentCode ? <p className="library-note">Sous-ouvrage de {form.parentCode}</p> : null}
            <button className="library-submit">{buttonLabel}</button>
          </form>
        </main>
      </Shell>
    );
  }

  return (
    <Shell>
      <main className="library-page">
        <header className="library-top">
          <button type="button" onClick={() => window.history.back()} aria-label="Retour">{"<"}</button>
          <h1>Choisir un ouvrage</h1>
          <button type="button" className="library-add" onClick={() => startCreate()} aria-label="Nouvel ouvrage">+</button>
        </header>

        <input
          className="library-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher par code, designation ou famille"
        />

        <div className="library-chips">
          {families.map((item) => (
            <button type="button" key={item} className={family === item ? "active" : ""} onClick={() => setFamily(item)}>
              {item}
            </button>
          ))}
        </div>

        {message ? <p className="library-message">{message}</p> : null}

        {Object.keys(grouped).length === 0 ? (
          <section className="library-empty">Aucun ouvrage trouve.</section>
        ) : (
          Object.entries(grouped).map(([title, items]) => (
            <section className="library-group" key={title}>
              <h2>{title}</h2>
              {items.map((item) => {
                const selected = selectedIds.includes(item.id);
                return (
                  <div key={item.id}>
                    <article className={`library-card ${selected ? "selected" : ""}`}>
                      <button type="button" className="library-select" onClick={() => toggleSelected(item.id)}>
                        {selected ? "OK" : ""}
                      </button>
                      <div className="library-card-main" onClick={() => toggleSelected(item.id)}>
                        <div className="library-code-row">
                          <span>{item.code}</span>
                          <b>{item.unit}</b>
                        </div>
                        <h3>{item.label}</h3>
                        <p className="library-stats">
                          <span>Temps: <strong>{formatHours(item.normativeTime)} h/{item.unit}</strong></span>
                          <span>Taux: <strong>{formatMoney(item.hourlyRate || 0)}</strong></span>
                          <span>MO/u: <strong>{formatMoney(moCost(item))}</strong></span>
                        </p>
                        {item.description ? <p className="library-description">{item.description}</p> : null}
                      </div>
                      <button type="button" className="library-menu-button" onClick={() => setOpenMenuId(openMenuId === item.id ? "" : item.id)}>...</button>
                      {openMenuId === item.id ? (
                        <div className="library-menu">
                          <button type="button" onClick={() => startEdit(item)}>Modifier</button>
                          <button type="button" className="danger" onClick={() => deleteOuvrage(item)}>Supprimer</button>
                        </div>
                      ) : null}
                    </article>
                    {item.type === "POSTE" ? (
                      <button type="button" className="sub-ouvrage-button" onClick={() => startCreate(item)}>
                        + Ajouter un sous-ouvrage
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </section>
          ))
        )}

        {selectedItems.length > 0 ? (
          <div className="library-selection-bar">
            <span>{selectedItems.length} ouvrage{selectedItems.length > 1 ? "s" : ""} selectionne{selectedItems.length > 1 ? "s" : ""}</span>
            <button type="button" onClick={addSelectionToQuote}>Ajouter au devis</button>
          </div>
        ) : null}
      </main>
    </Shell>
  );
}
