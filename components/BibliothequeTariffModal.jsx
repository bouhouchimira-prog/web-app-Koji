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
// DA Koji Pro : fenetre .pmodal, champs en .fgrid.
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
    <div className="pmodal-bg" onClick={onClose}>
      <form className="pmodal" role="dialog" aria-modal="true" aria-label={initial ? L.bibliotheque.editTariffTitle : L.bibliotheque.newTariffTitle} onClick={(event) => event.stopPropagation()} onSubmit={handleSubmit}>
        <div className="card-h">
          <div className="stack">
            <h2>{initial ? L.bibliotheque.editTariffTitle : L.bibliotheque.newTariffTitle}</h2>
            {form.family ? <span className="muted">{form.family} · {formatMoney(companyHourlyRate)} / h</span> : null}
          </div>
          <button type="button" className="link" onClick={onClose}>Fermer</button>
        </div>

        <div className="fgrid">
          <label className="full">{L.bibliotheque.designation}
            <input value={form.label} onChange={(event) => setField("label", event.target.value)} required autoFocus />
          </label>
          <label>{L.bibliotheque.family}
            <input list="biblio-family-options" value={form.family} onChange={(event) => setField("family", event.target.value)} required />
            <datalist id="biblio-family-options">
              {families.map((item) => <option key={item} value={item} />)}
            </datalist>
          </label>
          <label>{L.bibliotheque.category}
            <input list="biblio-category-options" value={form.category} onChange={(event) => setField("category", event.target.value)} />
            <datalist id="biblio-category-options">
              {categories.map((item) => <option key={item} value={item} />)}
            </datalist>
          </label>
          <label>{L.bibliotheque.unit}
            <select value={form.unit} onChange={(event) => setField("unit", event.target.value)}>
              {UNITS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <div>
            <span className="flab">{L.bibliotheque.pricingModeLabel}</span>
            <div className="kp-seg" role="group" aria-label={L.bibliotheque.pricingModeLabel}>
              <button type="button" className={form.billingMode !== "fixed" ? "on" : ""} aria-pressed={form.billingMode !== "fixed"} onClick={() => setField("billingMode", "time")}>{L.bibliotheque.pricingModeTime}</button>
              <button type="button" className={form.billingMode === "fixed" ? "on" : ""} aria-pressed={form.billingMode === "fixed"} onClick={() => setField("billingMode", "fixed")}>{L.bibliotheque.pricingModeFixed}</button>
            </div>
          </div>

          {form.billingMode === "fixed" ? (
            <label>{L.bibliotheque.totalBreakdown}
              <input type="number" step="0.01" min="0" value={form.fixedAmountHt} onChange={(event) => setField("fixedAmountHt", event.target.value)} placeholder="0,00" />
            </label>
          ) : (
            <>
              <label>{L.bibliotheque.normTimeShort} ({L.bibliotheque.hoursUnit})
                <input type="number" step="0.01" min="0" value={form.normativeTime} onChange={(event) => setField("normativeTime", event.target.value)} placeholder="0,00" />
              </label>
              <label>{L.bibliotheque.suppliesFieldLabel} ({L.bibliotheque.euroHtUnit})
                <input type="number" step="0.01" min="0" value={form.suppliesCost} onChange={(event) => setField("suppliesCost", event.target.value)} placeholder="0,00" />
              </label>
            </>
          )}

          <div className="full bib-calc">
            {form.billingMode === "fixed" ? (
              <div className="bib-calc-t"><span>{L.bibliotheque.totalBreakdown}</span><b>{formatMoney(totalHt)}</b></div>
            ) : (
              <>
                <div><span>{L.bibliotheque.laborBreakdown}</span><b>{formatMoney(laborCost)}</b></div>
                <i aria-hidden="true">+</i>
                <div><span>{L.bibliotheque.suppliesFieldLabel}</span><b>{formatMoney(suppliesCost)}</b></div>
                <i aria-hidden="true">=</i>
                <div className="bib-calc-t"><span>{L.bibliotheque.totalBreakdown}</span><b>{formatMoney(totalHt)}</b></div>
              </>
            )}
          </div>

          {isAdmin ? (
            <label className="full chk">
              <input type="checkbox" checked={form.addToKojiCatalog} onChange={(event) => setField("addToKojiCatalog", event.target.checked)} />
              {L.bibliotheque.addToKojiCheckbox}
            </label>
          ) : null}

          {showCodeField ? (
            <label className="full">{L.bibliotheque.code}
              <input value={form.code} onChange={(event) => setField("code", event.target.value)} placeholder="Ex: PLO-WC-03" required />
            </label>
          ) : (
            <p className="full muted">{L.bibliotheque.privacyNote}</p>
          )}

          {error ? <p className="full err" role="alert">{error}</p> : null}
        </div>

        <div className="pm-act">
          <button type="button" className="btn btn-sec" onClick={onClose}>{L.bibliotheque.cancel}</button>
          <button type="submit" className="btn btn-main" disabled={saving}>{saving ? "Enregistrement…" : L.bibliotheque.saveTariff}</button>
        </div>
      </form>
    </div>
  );
}
