"use client";

import { useEffect, useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiGet, apiSend } from "../../lib/client-api";
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
  description: "",
  noteInterne: "",
  sourceInterne: "",
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

function moCost(item, fallbackRate = 0) {
  const rate = Number(item.hourlyRate || 0) || fallbackRate;
  return Math.max(0, Number(item.normativeTime || 0) * rate);
}

// Catalogue Electricite recu le 19 septembre (KOJI_ouvrages_ELEC_Suchet.pdf,
// 21 lignes) — pre-rempli dans la zone d'import ci-dessous pour que cette
// demande se traite en un clic, tout en laissant la zone reutilisable pour
// d'autres catalogues (colle simplement un nouveau tableau par-dessus).
// Colonnes : code, designation, famille, sous-famille, unite, temps (h/u),
// taux horaire (€/h), commentaire — separees par une tabulation.
const DEFAULT_IMPORT_TEXT = [
  "ELEC-GEN-001\tInstallation de chantier, déplacements, protections, nettoyage\tÉlectricité\tGEN\tforfait\t4,00\t60\tchantier < 150 m²",
  "ELEC-GEN-002\tEssais, mise en service, étiquetage du tableau\tÉlectricité\tGEN\tforfait\t4,00\t60\t",
  "ELEC-DEP-001\tDépose point existant supprimé, mise en sécurité\tÉlectricité\tDEP\tu\t0,25\t60\tpoint non reposé",
  "ELEC-DEP-002\tDépose appareillage existant, neutralisation de la boîte, point neuf complet en goulotte\tÉlectricité\tDEP\tu\t1,00\t60\taucune boîte encastrée réutilisée",
  "ELEC-TAB-001\tRemplacement tableau 3 rangées, 2 ID 30 mA, 14 départs, repérage\tÉlectricité\tTAB\tu\t8,00\t60\t",
  "ELEC-TAB-002\tLiaison disjoncteur de branchement → tableau, 16 mm²\tÉlectricité\tTAB\tu\t3,00\t60\t",
  "ELEC-TAB-003\tMise à la terre / liaison équipotentielle pièces d'eau\tÉlectricité\tTAB\tforfait\t3,00\t60\t",
  "ELEC-CHE-001\tGoulotte PVC 2 compartiments, câbles compris\tÉlectricité\tCHE\tml\t0,30\t60\tcompté au périmètre hors portes",
  "ELEC-CHE-002\tDépose plinthe bois existante, évacuation\tÉlectricité\tCHE\tml\t0,10\t60\toption plinthe électrique",
  "ELEC-CHE-003\tPlinthe électrique 3 compartiments, câbles compris\tÉlectricité\tCHE\tml\t0,35\t60\tremplace ELEC-CHE-001",
  "ELEC-PT-001\tPrise 2P+T 16 A, point complet\tÉlectricité\tPT\tu\t0,75\t60\t",
  "ELEC-PT-002\tPrise dédiée 20 A, circuit spécialisé\tÉlectricité\tPT\tu\t0,90\t60\t",
  "ELEC-PT-003\tPrise RJ45 cat.6\tÉlectricité\tPT\tu\t1,00\t60\t",
  "ELEC-PT-004\tInterrupteur simple allumage\tÉlectricité\tPT\tu\t0,75\t60\t",
  "ELEC-PT-005\tVa-et-vient / double commande\tÉlectricité\tPT\tu\t1,10\t60\t",
  "ELEC-PT-006\tPoint lumineux plafond DCL\tÉlectricité\tPT\tu\t1,00\t60\t",
  "ELEC-PT-007\tSortie applique murale\tÉlectricité\tPT\tu\t0,90\t60\t",
  "ELEC-LUM-001\tSpot LED encastré, raccordement\tÉlectricité\tLUM\tu\t0,80\t60\t",
  "ELEC-LUM-002\tRail triphasé plafond, alimentation\tÉlectricité\tLUM\tml\t0,50\t60\t",
  "ELEC-LUM-003\tSpot LED sur rail\tÉlectricité\tLUM\tu\t0,25\t60\t",
  "ELEC-EQU-001\tAlimentation VMC, circuit dédié\tÉlectricité\tEQU\tu\t1,50\t60\t"
].join("\n");

function parseImportLine(line) {
  const parts = line.split("\t").map((p) => p.trim());
  if (parts.length < 7) return null;
  const [code, label, family, category, unit, normativeTime, hourlyRate, description = ""] = parts;
  if (!code || !label) return null;
  const comment = description ? `${description} — estimation KOJI, à vérifier (source PDF, sept. 2026)` : "Estimation KOJI, à vérifier (source PDF, sept. 2026)";
  return {
    code,
    label,
    family: family || "Autre",
    category: category || "General",
    unit: unit || "u",
    normativeTime: Number(String(normativeTime).replace(",", ".")) || 0,
    hourlyRate: Number(String(hourlyRate).replace(",", ".")) || 0,
    description: comment
  };
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
  // Plus d'onglet "Toutes" (demande du 19 septembre) — un metier est
  // toujours selectionne, jamais une liste complete non filtree.
  const [family, setFamily] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [openMenuId, setOpenMenuId] = useState("");
  const [formMode, setFormMode] = useState("list");
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [companyHourlyRate, setCompanyHourlyRate] = useState(0);
  // Import en masse (19 septembre) — colle un tableau code/designation/
  // famille/sous-famille/unite/temps/taux (separateurs tabulation, comme un
  // copier-coller depuis un tableur ou un PDF) et cree chaque ouvrage via le
  // meme POST /api/ouvrages que le formulaire "+", un par un. Pre-rempli ici
  // avec le catalogue Electricite recu (21 lignes), reutilisable ensuite
  // pour d'autres metiers (Plomberie...).
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState(DEFAULT_IMPORT_TEXT);
  const [importBusy, setImportBusy] = useState(false);
  const [importMessage, setImportMessage] = useState("");

  useEffect(() => {
    apiGet("/api/auth/profile")
      .then((payload) => {
        const business = payload?.user?.business || {};
        const daily = Number(business.dailyRate || 0);
        const hpd = Number(business.hoursPerDay || 7);
        setCompanyHourlyRate(daily > 0 ? Math.round((daily / hpd) * 100) / 100 : 0);
      })
      .catch(() => {});
  }, []);

  const families = useMemo(() => {
    return Array.from(new Set(ouvrages.map((item) => item.family || "Autre"))).sort();
  }, [ouvrages]);

  // Sous-familles proposees dans le formulaire : celles deja utilisees pour
  // la famille en cours de saisie (ex: GEN/DEP/TAB/CHE/PT/LUM/EQU pour
  // Electricite) — evite de retaper la meme sous-famille a chaque ouvrage.
  const categories = useMemo(() => {
    return Array.from(
      new Set(
        ouvrages
          .filter((item) => !form.family || item.family === form.family)
          .map((item) => item.category)
          .filter(Boolean)
      )
    ).sort();
  }, [ouvrages, form.family]);

  // Selectionne automatiquement le premier metier des que la bibliotheque
  // est chargee — jamais d'etat "aucun metier choisi" affichant tout.
  useEffect(() => {
    if (!family && families.length > 0) setFamily(families[0]);
  }, [families, family]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return ouvrages.filter((item) => {
      if (family && item.family !== family) return false;
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
      hourlyRate: companyHourlyRate,
      family: parent?.family || family || "Carrelage",
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
      hourlyRate: item.hourlyRate || companyHourlyRate,
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

  async function importCatalog() {
    const lines = importText.split("\n").map((line) => line.trim()).filter(Boolean);
    const rows = lines.map(parseImportLine).filter(Boolean);
    if (rows.length === 0) {
      setImportMessage("Aucune ligne valide à importer (code et désignation obligatoires).");
      return;
    }
    setImportBusy(true);
    setImportMessage("");
    let created = 0;
    let lastOuvrages = ouvrages;
    for (const row of rows) {
      try {
        const { ouvrages: nextOuvrages } = await apiSend("/api/ouvrages", row, "POST");
        lastOuvrages = nextOuvrages;
        created += 1;
      } catch {
        // une ligne en erreur ne bloque pas les suivantes
      }
    }
    setOuvrages(lastOuvrages);
    setImportBusy(false);
    setImportMessage(`${created}/${rows.length} ouvrage(s) importé(s).`);
    if (created === rows.length) {
      setImportText("");
      setImportOpen(false);
    }
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
          {item.category ? <p className="library-subfamily">{item.category}</p> : null}
          <p className="library-stats">
            <span>{L.bibliotheque.normTime}: <strong>{formatHours(item.normativeTime)} h/{item.unit}</strong></span>
            <span>{L.bibliotheque.hourlyRate}: <strong>{formatMoney(item.hourlyRate || companyHourlyRate)}</strong></span>
            <span>{L.bibliotheque.moCost}: <strong>{formatMoney(moCost(item, companyHourlyRate))}</strong></span>
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
    const cost = moCost(form, companyHourlyRate);

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
                {families.map((item) => <option key={item} value={item} />)}
              </datalist>
            </label>
            <label className="library-field">{L.bibliotheque.category}
              <input
                list="category-options"
                value={form.category}
                onChange={(event) => setField("category", event.target.value)}
                placeholder={L.bibliotheque.categoryPlaceholder}
              />
              <datalist id="category-options">
                {categories.map((item) => <option key={item} value={item} />)}
              </datalist>
            </label>
            <label className="library-field">{L.bibliotheque.unit}<select value={form.unit} onChange={(event) => setField("unit", event.target.value)}>
              {units.map((item) => <option key={item}>{item}</option>)}
            </select></label>
            <label className="library-field">{L.bibliotheque.time}<input type="number" step="0.001" value={form.normativeTime} onChange={(event) => setField("normativeTime", event.target.value)} placeholder="1.20" /></label>
            <label className="library-field">{L.bibliotheque.hourlyRateEur}<input type="number" step="0.01" value={form.hourlyRate} onChange={(event) => setField("hourlyRate", event.target.value)} /></label>
            <div className="mo-box">{L.bibliotheque.moCostPerUnit} : <strong>{formatMoney(cost)}</strong></div>
            <label className="library-field full">{L.devis.descriptionClient}<textarea value={form.description} onChange={(event) => setField("description", event.target.value)} placeholder={L.bibliotheque.comment} /></label>
            <label className="library-field full">{L.devis.noteInterne} <span className="library-field-hint">({L.devis.noteInterneHint})</span><textarea value={form.noteInterne} onChange={(event) => setField("noteInterne", event.target.value)} placeholder={L.devis.noteInterne} /></label>
            <label className="library-field full">{L.devis.sourceInterne}<input value={form.sourceInterne} onChange={(event) => setField("sourceInterne", event.target.value)} placeholder={L.devis.sourceInterne} /></label>
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

        <button type="button" className="library-import-toggle" onClick={() => setImportOpen((prev) => !prev)}>
          {importOpen ? "Fermer l'import" : "Importer un catalogue (coller un tableau)"}
        </button>

        {importOpen ? (
          <div className="library-import-panel">
            <p className="library-import-hint">
              Une ligne par ouvrage, colonnes séparées par une tabulation : code, désignation, famille, sous-famille, unité, temps (h/u), taux horaire (€/h), commentaire (optionnel).
            </p>
            <textarea
              className="library-import-textarea"
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              rows={8}
            />
            {importMessage ? <p className="library-message">{importMessage}</p> : null}
            <button type="button" className="library-submit" onClick={importCatalog} disabled={importBusy}>
              {importBusy ? "Import en cours…" : `Importer (${importText.split("\n").filter((l) => l.trim()).length} ligne(s))`}
            </button>
          </div>
        ) : null}

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
