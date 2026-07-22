"use client";

import { useEffect, useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiSend } from "../../lib/client-api";
import { useLocale } from "../../lib/i18n";
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
  const { L } = useLocale();
  const { data: ouvrages, setData: setOuvrages } = useApi("/api/ouvrages", "ouvrages", catalog);
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("Toutes");
  const [selectedIds, setSelectedIds] = useState([]);
  const [openMenuId, setOpenMenuId] = useState("");
  const [formMode, setFormMode] = useState("list");
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");

  const families = useMemo(() => {
    return [L.fournitures.all, ...Array.from(new Set(ouvrages.map((item) => item.family || "Autre"))).sort()];
  }, [ouvrages]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return ouvrages.filter((item) => {
      if (family !== L.fournitures.all && item.family !== family) return false;
      if (!normalized) return true;
      return [item.code, item.label, item.family, item.category, item.description]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [ouvrages, query, family]);

  const grouped = useMemo(() => {
    const out = {};
    const filteredCodes = new Set(filtered.map((item) => item.code));
    for (const item of filtered) {
      if (item.parentCode && filteredCodes.has(item.parentCode)) continue;
      const key = item.family || "Autre";
      if (!out[key]) out[key] = [];
      out[key].push(item);
    }
    return out;
  }, [filtered]);

  const childrenByParent = useMemo(() => {
    const out = {};
    for (const item of filtered) {
      if (!item.parentCode) continue;
      if (!out[item.parentCode]) out[item.parentCode] = [];
      out[item.parentCode].push(item);
    }
    return out;
  }, [filtered]);

  const selectedItems = useMemo(() => {
    return selectedIds.map((id) => ouvrages.find((item) => item.id === id)).filter(Boolean);
  }, [ouvrages, selectedIds]);

  const units = ["m²", "m³", "ml", "u", "h", "jour"];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "create") startCreate();
    const keepSelection = params.get("keepSelection") === "1";
    const resetSelection = params.get("resetSelection") === "1";
    if (resetSelection || !keepSelection) {
      window.localStorage.removeItem("koji-devis-ouvrages");
      setSelectedIds([]);
      return;
    }
    try {
      const stored = JSON.parse(window.localStorage.getItem("koji-devis-ouvrages") || "[]");
      if (Array.isArray(stored)) setSelectedIds(stored.filter(Boolean));
    } catch {
      window.localStorage.removeItem("koji-devis-ouvrages");
    }
  }, []);

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
      family: parent?.family || (family !== L.fournitures.all ? family : "Carrelage"),
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
    setMessage(formMode === "edit" ? L.bibliotheque.savedMsg : L.bibliotheque.createdMsg);
  }

  async function deleteOuvrage(item) {
    setOpenMenuId("");
    if (!window.confirm(L.bibliotheque.confirmDelete(item.code))) return;
    const response = await fetch(`/api/ouvrages?id=${encodeURIComponent(item.id)}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error || L.bibliotheque.deleteError);
      return;
    }
    setOuvrages(payload.ouvrages);
    setSelectedIds((current) => current.filter((id) => id !== item.id));
    setMessage(L.bibliotheque.deletedMsg);
  }

  function addSelectionToQuote() {
    const nextIds = Array.from(new Set(selectedItems.map((item) => item.id).filter(Boolean)));
    window.localStorage.setItem("koji-devis-ouvrages", JSON.stringify(nextIds));
    window.location.href = "/devis?selection=ouvrages";
  }

  function goBack() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.assign("/");
  }

  function renderOuvrageCard(item, { child = false } = {}) {
    const selected = selectedIds.includes(item.id);

    return (
      <article key={item.id} className={`library-card ${child ? "library-card-child" : ""} ${selected ? "selected" : ""}`}>
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
            <span>{L.bibliotheque.normTime}: <strong>{formatHours(item.normativeTime)} h/{item.unit}</strong></span>
            <span>{L.bibliotheque.hourlyRate}: <strong>{formatMoney(item.hourlyRate || 0)}</strong></span>
            <span>{L.bibliotheque.moCost}: <strong>{formatMoney(moCost(item))}</strong></span>
          </p>
          {item.description ? <p className="library-description">{item.description}</p> : null}
        </div>
        <button type="button" className="library-menu-button" onClick={() => setOpenMenuId(openMenuId === item.id ? "" : item.id)}>...</button>
        {openMenuId === item.id ? (
          <div className="library-menu">
            <button type="button" onClick={() => startEdit(item)}>{L.common.edit}</button>
            <button type="button" className="danger" onClick={() => deleteOuvrage(item)}>{L.common.delete}</button>
          </div>
        ) : null}
      </article>
    );
  }

  if (formMode !== "list") {
    const title = formMode === "edit" ? L.bibliotheque.editItem : formMode === "sub" ? L.bibliotheque.newSubItem : L.bibliotheque.newItem;
    const buttonLabel = formMode === "edit" ? L.common.save : formMode === "sub" ? L.bibliotheque.createSubItem : L.bibliotheque.createItem;
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
            <label className="library-field full">{L.bibliotheque.code}<input value={form.code} onChange={(event) => setField("code", event.target.value)} placeholder="Ex: CAR-01" required /></label>
            <label className="library-field full">{L.bibliotheque.designation}<textarea value={form.label} onChange={(event) => setField("label", event.target.value)} placeholder={L.bibliotheque.designation} required /></label>
            <label className="library-field">{L.bibliotheque.family}
              <input
                list="family-options"
                value={form.family}
                onChange={(event) => setField("family", event.target.value)}
                placeholder={L.bibliotheque.familyPlaceholder}
              />
              <datalist id="family-options">
                {families.filter((item) => item !== L.fournitures.all).map((item) => <option key={item} value={item} />)}
              </datalist>
            </label>
            <label className="library-field">{L.bibliotheque.unit}<select value={form.unit} onChange={(event) => setField("unit", event.target.value)}>
              {units.map((item) => <option key={item}>{item}</option>)}
            </select></label>
            <label className="library-field">{L.bibliotheque.time}<input type="number" step="0.001" value={form.normativeTime} onChange={(event) => setField("normativeTime", event.target.value)} placeholder="1.20" /></label>
            <label className="library-field">{L.bibliotheque.hourlyRateEur}<input type="number" step="0.01" value={form.hourlyRate} onChange={(event) => setField("hourlyRate", event.target.value)} /></label>
            <div className="mo-box">{L.bibliotheque.moCostPerUnit} : <strong>{formatMoney(cost)}</strong></div>
            <label className="library-field">{L.bibliotheque.coefficient}<input type="number" step="0.05" value={form.coefficient} onChange={(event) => setField("coefficient", event.target.value)} /></label>
            <label className="library-field">{L.bibliotheque.reduction}<input type="number" step="1" value={form.discount} onChange={(event) => setField("discount", event.target.value)} /></label>
            <label className="library-field full">{L.bibliotheque.comment}<textarea value={form.description} onChange={(event) => setField("description", event.target.value)} placeholder={L.bibliotheque.comment} /></label>
            {form.parentCode ? <p className="library-note">{L.bibliotheque.subOf} {form.parentCode}</p> : null}
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
          <button type="button" onClick={goBack} aria-label="Retour">{"<"}</button>
          <h1>{L.bibliotheque.chooseItem}</h1>
          <button type="button" className="library-add" onClick={() => startCreate()} aria-label="Nouvel ouvrage">+</button>
        </header>

        <input
          className="library-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={L.bibliotheque.search}
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
          <section className="library-empty">{L.bibliotheque.noFound}</section>
        ) : (
          Object.entries(grouped).map(([title, items]) => (
            <section className="library-group" key={title}>
              <h2>{title}</h2>
              {items.map((item) => (
                  <div className="library-card-block" key={item.id}>
                    {renderOuvrageCard(item)}
                    {(childrenByParent[item.code] || []).map((child) => renderOuvrageCard(child, { child: true }))}
                    {item.type === "POSTE" ? (
                      <button type="button" className="sub-ouvrage-button" onClick={() => startCreate(item)}>
                        {L.bibliotheque.addSubItem}
                      </button>
                    ) : null}
                  </div>
              ))}
            </section>
          ))
        )}

        {selectedItems.length > 0 ? (
          <div className="library-selection-bar">
            <span>{L.bibliotheque.selected(selectedItems.length)}</span>
            <button type="button" onClick={addSelectionToQuote}>
              {L.bibliotheque.addToQuote(selectedItems.length)}
            </button>
          </div>
        ) : null}
      </main>
    </Shell>
  );
}
