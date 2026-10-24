"use client";

import { useEffect, useState } from "react";
import { formatMoney } from "../lib/bibliotheque-pricing";

const UNITS = ["u", "m²", "m³", "ml", "h", "jour", "t"];

function emptyFormFor(family) {
  return {
    label: "",
    family: family || "",
    category: "",
    unit: "u",
    billingMode: "time",
    normativeTime: "",
    suppliesCost: "",
    fixedAmountHt: "",
    addToKojiCatalog: false,
    code: ""
  };
}

// Modal de creation/edition d'un tarif personnalise (25 oct, refonte
// navigation par familles) — remplace l'ancien formulaire pleine page.
// Reutilise par la page d'accueil, la page famille et "Compléter" sur un
// metier sans ouvrage.
export function BibliothequeTariffModal({
  L,
  open,
  onClose,
  onSave,
  initial, // null = creation, objet ouvrage = edition
  defaultFamily,
  families,
  categoriesForFamily,
  isAdmin,
  companyHourlyRate
}) {
  const [form, setForm] = useState(() => emptyFormFor(defaultFamily));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        label: initial.label || "",
        family: initial.family || "",
        category: initial.category || "",
        unit: initial.unit || "u",
        billingMode: initial.billingMode === "fixed" ? "fixed" : "time",
        normativeTime: initial.normativeTime || "",
        suppliesCost: initial.suppliesCost ?? "",
        fixedAmountHt: initial.fixedAmountHt || "",
        addToKojiCatalog: false,
        code: initial.code || ""
      });
    } else {
      setForm(emptyFormFor(defaultFamily));
    }
    setError("");
  }, [open, initial, defaultFamily]);

  if (!open) return null;

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  const normativeTime = Number(form.normativeTime || 0);
  const suppliesCost = Number(form.suppliesCost || 0);
  const laborCost = normativeTime * companyHourlyRate;
  const totalHt = form.billingMode === "fixed" ? Number(form.fixedAmountHt || 0) : laborCost + suppliesCost;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.label.trim()) { setError(L.bibliotheque.designation); return; }
    if (!form.family.trim()) { setError(L.bibliotheque.family); return; }
    if (showCodeField && !form.code.trim()) { setError(L.bibliotheque.code); return; }
    setSaving(true);
    setError("");
    try {
      await onSave({
        id: initial?.id,
        code: form.code.trim(),
        label: form.label.trim(),
        family: form.family.trim(),
        category: form.category.trim() || form.family.trim(),
        unit: form.unit,
        billingMode: form.billingMode,
        normativeTime: form.billingMode === "fixed" ? 0 : normativeTime,
        hourlyRate: 0,
        suppliesCost: form.billingMode === "fixed" ? null : (form.suppliesCost === "" ? null : suppliesCost),
        fixedAmountHt: form.billingMode === "fixed" ? Number(form.fixedAmountHt || 0) : 0,
        addToKojiCatalog: Boolean(isAdmin && form.addToKojiCatalog),
        copiedFromCode: initial?.copiedFromCode || null,
        copiedFromKojiPriceHt: initial?.copiedFromKojiPriceHt ?? null
      });
    } catch (err) {
      setError(err.message || L.bibliotheque.deleteError);
    } finally {
      setSaving(false);
    }
  }

  const categories = categoriesForFamily(form.family);
  // Edition d'un ouvrage koji existant (admin, via le menu "···" d'une
  // ligne koji) : deja dans le catalogue partage, jamais "prive" — le code
  // reste visible/modifiable, jamais la note de confidentialite.
  const editingKojiItem = Boolean(initial && !initial.userId);
  const showCodeField = isAdmin && (form.addToKojiCatalog || editingKojiItem);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="biblio-modal" onClick={(event) => event.stopPropagation()} onSubmit={handleSubmit}>
        <header className="biblio-modal-head">
          <div>
            <h2>{initial ? L.bibliotheque.editTariffTitle : L.bibliotheque.newTariffTitle}</h2>
            {form.family ? <p>{form.family} · {formatMoney(companyHourlyRate)} / h</p> : null}
          </div>
          <button type="button" className="biblio-modal-close" aria-label={L.common.close || L.bibliotheque.cancel} onClick={onClose}>✕</button>
        </header>

        <div className="biblio-modal-body">
          <label className="library-field full">
            {L.bibliotheque.designation}
            <input value={form.label} onChange={(event) => setField("label", event.target.value)} required autoFocus />
          </label>

          <div className="biblio-modal-row">
            <label className="library-field">
              {L.bibliotheque.family}
              <input list="biblio-family-options" value={form.family} onChange={(event) => setField("family", event.target.value)} required />
              <datalist id="biblio-family-options">
                {families.map((item) => <option key={item} value={item} />)}
              </datalist>
            </label>
            <label className="library-field">
              {L.bibliotheque.category}
              <input list="biblio-category-options" value={form.category} onChange={(event) => setField("category", event.target.value)} />
              <datalist id="biblio-category-options">
                {categories.map((item) => <option key={item} value={item} />)}
              </datalist>
            </label>
          </div>

          <label className="library-field">
            {L.bibliotheque.unit}
            <select value={form.unit} onChange={(event) => setField("unit", event.target.value)}>
              {UNITS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>

          <div className="library-field">
            {L.bibliotheque.pricingModeLabel}
            <div className="segmented">
              <button type="button" className={form.billingMode !== "fixed" ? "active" : ""} onClick={() => setField("billingMode", "time")}>{L.bibliotheque.pricingModeTime}</button>
              <button type="button" className={form.billingMode === "fixed" ? "active" : ""} onClick={() => setField("billingMode", "fixed")}>{L.bibliotheque.pricingModeFixed}</button>
            </div>
          </div>

          {form.billingMode === "fixed" ? (
            <label className="library-field">
              {L.bibliotheque.totalBreakdown}
              <input type="number" step="0.01" min="0" value={form.fixedAmountHt} onChange={(event) => setField("fixedAmountHt", event.target.value)} placeholder="0,00" />
            </label>
          ) : (
            <div className="biblio-modal-row">
              <label className="library-field">
                {L.bibliotheque.normTimeShort} ({L.bibliotheque.hoursUnit})
                <input type="number" step="0.01" min="0" value={form.normativeTime} onChange={(event) => setField("normativeTime", event.target.value)} placeholder="0,00" />
              </label>
              <label className="library-field">
                {L.bibliotheque.suppliesFieldLabel} ({L.bibliotheque.euroHtUnit})
                <input type="number" step="0.01" min="0" value={form.suppliesCost} onChange={(event) => setField("suppliesCost", event.target.value)} placeholder="0,00" />
              </label>
            </div>
          )}

          <div className="biblio-breakdown">
            {form.billingMode === "fixed" ? (
              <div className="biblio-breakdown-total">
                <span>{L.bibliotheque.totalBreakdown}</span>
                <strong>{formatMoney(totalHt)}</strong>
              </div>
            ) : (
              <>
                <div>
                  <span>{L.bibliotheque.laborBreakdown}</span>
                  <strong>{formatMoney(laborCost)}</strong>
                </div>
                <span className="biblio-breakdown-op">+</span>
                <div>
                  <span>{L.bibliotheque.suppliesFieldLabel}</span>
                  <strong>{formatMoney(suppliesCost)}</strong>
                </div>
                <span className="biblio-breakdown-op">=</span>
                <div className="biblio-breakdown-total">
                  <span>{L.bibliotheque.totalBreakdown}</span>
                  <strong>{formatMoney(totalHt)}</strong>
                </div>
              </>
            )}
          </div>

          {isAdmin ? (
            <label className="library-field full library-field-checkbox">
              <input type="checkbox" checked={form.addToKojiCatalog} onChange={(event) => setField("addToKojiCatalog", event.target.checked)} />
              {L.bibliotheque.addToKojiCheckbox}
            </label>
          ) : null}

          {showCodeField ? (
            <label className="library-field full">
              {L.bibliotheque.code}
              <input value={form.code} onChange={(event) => setField("code", event.target.value)} placeholder="Ex: PLO-WC-03" required />
            </label>
          ) : (
            <p className="biblio-privacy-note">{L.bibliotheque.privacyNote}</p>
          )}

          {error ? <p className="library-message">{error}</p> : null}
        </div>

        <footer className="biblio-modal-footer">
          <button type="button" className="button secondary" onClick={onClose}>{L.bibliotheque.cancel}</button>
          <button type="submit" className="button gold" disabled={saving}>{saving ? "…" : L.bibliotheque.saveTariff}</button>
        </footer>
      </form>
    </div>
  );
}
