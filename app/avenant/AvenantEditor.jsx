"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiGet, apiSend } from "../../lib/client-api";
import { useApi } from "../../lib/use-api";
import { useLocale } from "../../lib/i18n";
import { computeAvenantTotals, AVENANT_STATUS_LABEL_KEYS } from "../../lib/avenant-mapping";
import catalog from "../../data/catalog-ouvrages.json";

function money(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function round2(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0;
}

function supplyPrice(supply = {}) {
  return Number(supply.priceHt ?? supply.salePriceHt ?? supply.purchasePriceHt ?? 0);
}

function makeTmpId() {
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptyLigne(type) {
  return { id: makeTmpId(), type, room: "", label: "", quantity: "1", unit: "u", unitPriceHt: "" };
}

const STATUS_KEYS = AVENANT_STATUS_LABEL_KEYS;

export function AvenantEditor() {
  const { L } = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const quoteIdParam = params.get("quoteId") || "";
  const avenantIdParam = params.get("id") || "";

  const { data: quotes } = useApi("/api/quotes", "quotes");
  const { data: ouvrages } = useApi("/api/ouvrages", "ouvrages", catalog);
  const { data: supplies } = useApi("/api/supplies", "supplies");
  const postes = useMemo(() => ouvrages.filter((item) => item.type === "POSTE" || item.type === "SOUS-POSTE"), [ouvrages]);

  const [avenant, setAvenant] = useState(null);
  const [loadingAvenant, setLoadingAvenant] = useState(Boolean(avenantIdParam));
  const [motif, setMotif] = useState("");
  const [lignes, setLignes] = useState([]);
  const [newLigneType, setNewLigneType] = useState("ajout");
  const [pickerTab, setPickerTab] = useState("ouvrages");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [acceptComposer, setAcceptComposer] = useState({ open: false, signerName: "", reason: "verbal" });
  const [refuseComposer, setRefuseComposer] = useState({ open: false, reason: "" });

  const quote = useMemo(
    () => quotes.find((item) => item.id === (avenant?.quoteId || quoteIdParam)),
    [quotes, avenant, quoteIdParam]
  );

  useEffect(() => {
    if (!avenantIdParam) return;
    let alive = true;
    apiGet(`/api/avenants?id=${encodeURIComponent(avenantIdParam)}`)
      .then((payload) => {
        if (!alive || !payload.avenant) return;
        setAvenant(payload.avenant);
        setMotif(payload.avenant.motif || "");
        setLignes((payload.avenant.lignes || []).map((ligne) => ({
          ...ligne,
          quantity: String(ligne.quantity ?? ""),
          unitPriceHt: String(ligne.unitPriceHt ?? "")
        })));
      })
      .catch(() => { if (alive) notify("Avenant introuvable.", "error"); })
      .finally(() => { if (alive) setLoadingAvenant(false); });
    return () => { alive = false; };
  }, [avenantIdParam]);

  function notify(text, type = "info") {
    setMessage(text);
    setMessageType(type);
  }

  const editable = !avenant || avenant.status === "Brouillon";

  const normalizedForTotals = useMemo(() => lignes.map((ligne) => {
    const quantity = Number(ligne.quantity || 0);
    const unitPriceHt = Number(ligne.unitPriceHt || 0);
    const raw = round2(quantity * unitPriceHt);
    return { ...ligne, totalHt: ligne.type === "suppression" ? -Math.abs(raw) : raw };
  }), [lignes]);

  const vatRate = quote?.vatRate ?? avenant?.vatRate ?? 20;
  const totals = useMemo(() => computeAvenantTotals(normalizedForTotals, vatRate), [normalizedForTotals, vatRate]);
  const newMarketTotal = Number(quote?.totalTtc || 0) + totals.totalTtcDelta;

  const libraryFamilies = useMemo(() => Array.from(new Set(postes.map((item) => item.family || "Autre"))).sort(), [postes]);
  const filteredOuvrages = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return postes.slice(0, 40);
    return postes.filter((item) => [item.code, item.label, item.family].join(" ").toLowerCase().includes(normalized));
  }, [postes, query]);
  const filteredSupplies = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return supplies.slice(0, 40);
    return supplies.filter((item) => [item.name, item.category, item.supplierName].join(" ").toLowerCase().includes(normalized));
  }, [supplies, query]);

  function addLigne(ligne) {
    setLignes((current) => [...current, ligne]);
  }

  function addOuvrageLigne(item) {
    const hourlyRate = Number(item.hourlyRate || 0);
    const unitPriceHt = hourlyRate ? round2(Number(item.normativeTime || 0) * hourlyRate) : "";
    addLigne({ id: makeTmpId(), type: newLigneType, room: "", label: item.label, quantity: "1", unit: item.unit || "u", unitPriceHt: String(unitPriceHt) });
  }

  function addSupplyLigne(item) {
    addLigne({ id: makeTmpId(), type: newLigneType, room: "", label: item.name, quantity: "1", unit: item.unite || item.unit || "u", unitPriceHt: String(supplyPrice(item)) });
  }

  function updateLigne(id, field, value) {
    setLignes((current) => current.map((ligne) => ligne.id === id ? { ...ligne, [field]: value } : ligne));
  }

  function removeLigne(id) {
    setLignes((current) => current.filter((ligne) => ligne.id !== id));
  }

  function buildLignesPayload() {
    return normalizedForTotals.map((ligne) => ({
      type: ligne.type,
      room: ligne.room,
      label: ligne.label,
      quantity: Number(ligne.quantity || 0),
      unit: ligne.unit,
      unitPriceHt: Number(ligne.unitPriceHt || 0)
    }));
  }

  async function persistDraft() {
    const payload = { motif, lignes: buildLignesPayload() };
    if (avenant?.id) {
      const { avenant: updated } = await apiSend("/api/avenants", { id: avenant.id, action: "update", ...payload }, "PATCH");
      setAvenant(updated);
      return updated;
    }
    const { avenant: created } = await apiSend("/api/avenants", { quoteId: quoteIdParam, ...payload });
    setAvenant(created);
    router.replace(`/avenant?id=${created.id}`);
    return created;
  }

  async function handleSave() {
    if (!lignes.length) { notify("Ajoutez au moins une ligne avant d'enregistrer.", "error"); return; }
    setSaving(true);
    try {
      await persistDraft();
      notify("Avenant enregistré en brouillon.", "success");
    } catch (error) {
      notify(error.message || "Impossible d'enregistrer cet avenant.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleSend() {
    if (!lignes.length) { notify("Ajoutez au moins une ligne avant d'envoyer.", "error"); return; }
    setSaving(true);
    try {
      const saved = await persistDraft();
      const { avenant: sent } = await apiSend("/api/avenants", { id: saved.id, action: "send" }, "PATCH");
      setAvenant(sent);
      notify("Avenant marqué comme envoyé.", "success");
    } catch (error) {
      notify(error.message || "Impossible d'envoyer cet avenant.", "error");
    } finally {
      setSaving(false);
    }
  }

  function openAcceptComposer() {
    if (!avenant?.id) { notify(L.avenants.needSaveFirst, "error"); return; }
    setAcceptComposer({ open: true, signerName: quote?.client || avenant.client || "", reason: "verbal" });
  }

  async function submitAcceptManually() {
    try {
      const { avenant: signed } = await apiSend("/api/avenants", {
        id: avenant.id,
        action: "accept-manually",
        signerName: acceptComposer.signerName,
        acceptanceReason: acceptComposer.reason
      }, "PATCH");
      setAvenant(signed);
      setAcceptComposer((current) => ({ ...current, open: false }));
      notify("Avenant marqué comme signé.", "success");
    } catch (error) {
      notify(error.message || "Impossible de marquer cet avenant comme signé.", "error");
    }
  }

  function openRefuseComposer() {
    if (!avenant?.id) { notify(L.avenants.needSaveFirst, "error"); return; }
    setRefuseComposer({ open: true, reason: "" });
  }

  async function submitRefuse() {
    try {
      const { avenant: refused } = await apiSend("/api/avenants", {
        id: avenant.id,
        action: "refuse",
        refusalReason: refuseComposer.reason
      }, "PATCH");
      setAvenant(refused);
      setRefuseComposer((current) => ({ ...current, open: false }));
      notify("Avenant marqué comme refusé.", "info");
    } catch (error) {
      notify(error.message || "Impossible de refuser cet avenant.", "error");
    }
  }

  async function handleDownloadPdf() {
    try {
      const saved = avenant?.id && !editable ? avenant : await persistDraft();
      window.open(`/api/avenants/${saved.id}/documents?format=pdf`, "_blank");
    } catch (error) {
      notify(error.message || "Impossible de générer le PDF.", "error");
    }
  }

  async function handleDelete() {
    if (!avenant?.id) { router.push(`/devis?id=${quoteIdParam}`); return; }
    if (!window.confirm(L.avenants.confirmDelete)) return;
    try {
      await apiSend("/api/avenants", { id: avenant.id, action: "delete" }, "PATCH");
      router.push(`/devis?id=${avenant.quoteId}`);
    } catch (error) {
      notify(error.message || "Impossible de supprimer cet avenant.", "error");
    }
  }

  const backQuoteId = avenant?.quoteId || quoteIdParam;

  if (loadingAvenant) {
    return (
      <Shell>
        <div className="quote-final-page"><p className="empty-state">{L.common.loading}</p></div>
      </Shell>
    );
  }

  return (
    <Shell>
      <header className="page-header quote-final-header quote-final-header-centered">
        <div className="quote-final-header-title">
          <p className="eyebrow">{L.avenants.title}</p>
          <h1>{avenant?.numero || L.avenants.newAvenant}</h1>
        </div>
        <div className="quote-final-actions">
          {backQuoteId ? <Link className="button secondary" href={`/devis?id=${backQuoteId}`}>{L.avenants.backToQuote}</Link> : null}
          {avenant?.status ? <span className={`avenant-status-badge avenant-status-${avenant.status}`}>{L.avenants[STATUS_KEYS[avenant.status]] || avenant.status}</span> : null}
        </div>
      </header>

      <div className="quote-final-page avenant-page">
        <div className="quote-meta-bar">
          <div className="quote-meta-number">
            <span>{L.avenants.parentQuote} : {quote?.quoteNumber || "—"}</span>
          </div>
          {quote?.client || quote?.chantierAddress ? (
            <div className="quote-meta-client">
              {quote?.client ? <strong>{quote.client}</strong> : null}
              {quote?.chantierAddress ? <span>{quote.chantierAddress}</span> : null}
            </div>
          ) : null}
        </div>

        {!editable ? <p className="profile-message info">{L.avenants.readOnlyNotice(L.avenants[STATUS_KEYS[avenant.status]] || avenant.status)}</p> : null}
        {message ? <p className={`profile-message ${messageType}`}>{message}</p> : null}

        <div className="quote-two-col">
          <div className="quote-col-left">
            <section className="quote-final-card">
              <div className="quote-section-title">
                <div><span>{L.avenants.title}</span><h2>{L.avenants.motifLabel}</h2></div>
              </div>
              <textarea
                className="quote-work-description"
                value={motif}
                onChange={(event) => setMotif(event.target.value)}
                placeholder={L.avenants.motifPlaceholder}
                rows={3}
                disabled={!editable}
              />
            </section>

            <section className="quote-final-card">
              <div className="quote-section-title">
                <div><span>{L.avenants.title}</span><h2>{L.avenants.lignesTitle}</h2></div>
                {editable ? (
                  <div className="avenant-ligne-add-actions">
                    <select value={newLigneType} onChange={(event) => setNewLigneType(event.target.value)}>
                      <option value="ajout">{L.avenants.typeAjout}</option>
                      <option value="suppression">{L.avenants.typeSuppression}</option>
                      <option value="modification">{L.avenants.typeModification}</option>
                    </select>
                    <button type="button" className="button secondary" onClick={() => addLigne(emptyLigne(newLigneType))}>{L.avenants.addFreeLine}</button>
                  </div>
                ) : null}
              </div>

              {!normalizedForTotals.length ? (
                <p className="empty-state">{L.avenants.noLines}</p>
              ) : (
                <div className="avenant-ligne-list">
                  {normalizedForTotals.map((ligne) => (
                    <div key={ligne.id} className={`avenant-ligne-row avenant-type-${ligne.type}`}>
                      <select value={ligne.type} onChange={(event) => updateLigne(ligne.id, "type", event.target.value)} disabled={!editable}>
                        <option value="ajout">{L.avenants.typeAjout}</option>
                        <option value="suppression">{L.avenants.typeSuppression}</option>
                        <option value="modification">{L.avenants.typeModification}</option>
                      </select>
                      <input
                        className="avenant-ligne-label"
                        value={ligne.label}
                        onChange={(event) => updateLigne(ligne.id, "label", event.target.value)}
                        placeholder={L.avenants.lineLabel}
                        disabled={!editable}
                      />
                      <input
                        className="avenant-ligne-room"
                        value={ligne.room}
                        onChange={(event) => updateLigne(ligne.id, "room", event.target.value)}
                        placeholder={L.avenants.lineRoom}
                        disabled={!editable}
                      />
                      <input
                        type="number" min="0" step="any"
                        value={ligne.quantity}
                        onChange={(event) => updateLigne(ligne.id, "quantity", event.target.value)}
                        placeholder={L.avenants.lineQuantity}
                        disabled={!editable}
                      />
                      <input
                        className="avenant-ligne-unit"
                        value={ligne.unit}
                        onChange={(event) => updateLigne(ligne.id, "unit", event.target.value)}
                        placeholder={L.avenants.lineUnit}
                        disabled={!editable}
                      />
                      <input
                        type="number" step="0.01"
                        value={ligne.unitPriceHt}
                        onChange={(event) => updateLigne(ligne.id, "unitPriceHt", event.target.value)}
                        placeholder={L.avenants.lineUnitPrice}
                        disabled={!editable}
                      />
                      <strong className="avenant-ligne-total">{money(ligne.totalHt)}</strong>
                      {editable ? (
                        <button type="button" className="avenant-ligne-remove" onClick={() => removeLigne(ligne.id)} aria-label={L.avenants.removeLine}>×</button>
                      ) : <span />}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="quote-final-card avenant-totals-card">
              <div><span>{L.avenants.totalHtDelta}</span><strong>{money(totals.totalHtDelta)}</strong></div>
              <div><span>{L.avenants.vatLabel} {Number(vatRate).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}%</span><strong>{money(totals.totalTtcDelta - totals.totalHtDelta)}</strong></div>
              <div className="total"><span>{L.avenants.totalTtcDelta}</span><strong>{money(totals.totalTtcDelta)}</strong></div>
              {quote ? <div className="avenant-market-total"><span>{L.avenants.newMarketTotal}</span><strong>{money(newMarketTotal)}</strong></div> : null}
            </section>
          </div>

          {editable ? (
            <div className="quote-col-right">
              <div className="quote-right-tabs">
                <button type="button" className={pickerTab === "ouvrages" ? "active" : ""} onClick={() => setPickerTab("ouvrages")}>{L.avenants.tabOuvrages}</button>
                <button type="button" className={pickerTab === "fournitures" ? "active" : ""} onClick={() => setPickerTab("fournitures")}>{L.avenants.tabFournitures}</button>
              </div>
              <section className="quote-final-card quote-picker-card">
                <input
                  className="quote-picker-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={L.avenants.searchCatalog}
                />
                <div className="quote-picker-list">
                  {pickerTab === "ouvrages" ? filteredOuvrages.map((item) => (
                    <div className="quote-picker-row" key={item.id}>
                      <div className="quote-picker-row-main">
                        <span className="quote-picker-row-code">{item.code}</span>
                        <strong>{item.label}</strong>
                      </div>
                      <button type="button" className="quote-picker-add-btn" onClick={() => addOuvrageLigne(item)}>{L.common.add}</button>
                    </div>
                  )) : filteredSupplies.map((item) => (
                    <div className="quote-picker-row" key={item.id}>
                      <div className="quote-picker-row-main">
                        <strong>{item.name}</strong>
                        <span className="quote-picker-row-stats">{item.category || ""} · {money(supplyPrice(item))} HT</span>
                      </div>
                      <button type="button" className="quote-picker-add-btn" onClick={() => addSupplyLigne(item)}>{L.common.add}</button>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : null}
        </div>

        <div className="avenant-actions-bar">
          {editable ? (
            <>
              <button type="button" className="button secondary" onClick={handleDelete}>{L.avenants.deleteAvenant}</button>
              <button type="button" className="button secondary" onClick={handleSave} disabled={saving}>{L.avenants.saveDraft}</button>
              <button type="button" className="button blue" onClick={handleSend} disabled={saving}>{L.avenants.sendAvenant}</button>
            </>
          ) : null}
          {avenant?.status === "Envoye" ? (
            <>
              <button type="button" className="button secondary danger" onClick={openRefuseComposer}>{L.avenants.refuseAvenant}</button>
              <button type="button" className="button blue" onClick={openAcceptComposer}>{L.avenants.acceptManually}</button>
            </>
          ) : null}
          {avenant?.id ? <button type="button" className="button secondary" onClick={handleDownloadPdf}>{L.avenants.downloadPdf}</button> : null}
        </div>

        {acceptComposer.open ? (
          <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setAcceptComposer((current) => ({ ...current, open: false }))}>
            <div className="mini-modal supply-composer-modal" onClick={(event) => event.stopPropagation()}>
              <h2>{L.avenants.acceptManuallyTitle}</h2>
              <p className="tool-muted">{L.avenants.acceptManuallySub}</p>
              <label className="supply-composer-field full">
                <span>{L.avenants.signerName}</span>
                <input value={acceptComposer.signerName} onChange={(event) => setAcceptComposer((current) => ({ ...current, signerName: event.target.value }))} />
              </label>
              <div className="supply-composer-tabs">
                <button type="button" className={acceptComposer.reason === "verbal" ? "active" : ""} onClick={() => setAcceptComposer((current) => ({ ...current, reason: "verbal" }))}>{L.avenants.acceptReasonVerbal}</button>
                <button type="button" className={acceptComposer.reason === "acompte" ? "active" : ""} onClick={() => setAcceptComposer((current) => ({ ...current, reason: "acompte" }))}>{L.avenants.acceptReasonDeposit}</button>
              </div>
              <div className="supply-modal-actions">
                <button type="button" onClick={() => setAcceptComposer((current) => ({ ...current, open: false }))}>{L.common.cancel}</button>
                <button type="button" className="button blue" onClick={submitAcceptManually}>{L.avenants.acceptManually}</button>
              </div>
            </div>
          </div>
        ) : null}

        {refuseComposer.open ? (
          <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setRefuseComposer((current) => ({ ...current, open: false }))}>
            <div className="mini-modal supply-composer-modal" onClick={(event) => event.stopPropagation()}>
              <h2>{L.avenants.refuseTitle}</h2>
              <label className="supply-composer-field full">
                <span>{L.avenants.refuseReasonLabel}</span>
                <textarea rows={2} value={refuseComposer.reason} onChange={(event) => setRefuseComposer((current) => ({ ...current, reason: event.target.value }))} />
              </label>
              <div className="supply-modal-actions">
                <button type="button" onClick={() => setRefuseComposer((current) => ({ ...current, open: false }))}>{L.common.cancel}</button>
                <button type="button" className="button blue" onClick={submitRefuse}>{L.avenants.refuseAvenant}</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Shell>
  );
}
