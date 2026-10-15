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

// Maquette du 15 oct (artifact fournie par Amira) — couleurs/icones par
// type de ligne et libelles des motifs/mode de facturation.
const LIGNE_TYPE_META = {
  ajout: { icon: "+", color: "#1E8E5A", bg: "#E6F5EE" },
  suppression: { icon: "−", color: "#C4452D", bg: "#FBE9E5" },
  modification: { icon: "~", color: "#B7791F", bg: "#FDF3E3" }
};

const MOTIF_CATEGORIES = [
  { id: "demande_client", label: "Demande du client" },
  { id: "imprevu_chantier", label: "Imprévu chantier" },
  { id: "modification_technique", label: "Modification technique" }
];

export function AvenantEditor() {
  const { L } = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const quoteIdParam = params.get("quoteId") || "";
  const avenantIdParam = params.get("id") || "";

  const { data: quotes } = useApi("/api/quotes", "quotes");
  const { data: ouvrages } = useApi("/api/ouvrages", "ouvrages", catalog);
  const { data: supplies } = useApi("/api/supplies", "supplies");
  const { data: projects } = useApi("/api/projects", "projects");
  const { data: invoices } = useApi("/api/invoices", "invoices");
  const postes = useMemo(() => ouvrages.filter((item) => item.type === "POSTE" || item.type === "SOUS-POSTE"), [ouvrages]);

  const [avenant, setAvenant] = useState(null);
  const [loadingAvenant, setLoadingAvenant] = useState(Boolean(avenantIdParam));
  const [motif, setMotif] = useState("");
  const [motifCategory, setMotifCategory] = useState("demande_client");
  const [facturationMode, setFacturationMode] = useState("separee");
  const [expandedLigneId, setExpandedLigneId] = useState("");
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

  // Rattachement (15 oct, maquette fournie par Amira) — purement informatif,
  // le chantier et la facture liee sont deja determines par le devis
  // d'origine, pas de champ supplementaire a saisir.
  const linkedProject = useMemo(
    () => (quote?.projectId ? projects.find((item) => item.id === quote.projectId) : null),
    [projects, quote]
  );
  const linkedInvoice = useMemo(() => {
    if (!quote) return null;
    const quoteInvoices = invoices.filter((inv) => inv.quoteId === quote.id);
    return quoteInvoices.find((inv) => inv.status === "Payee") || quoteInvoices[0] || null;
  }, [invoices, quote]);

  useEffect(() => {
    if (!avenantIdParam) return;
    let alive = true;
    apiGet(`/api/avenants?id=${encodeURIComponent(avenantIdParam)}`)
      .then((payload) => {
        if (!alive || !payload.avenant) return;
        setAvenant(payload.avenant);
        setMotif(payload.avenant.motif || "");
        setMotifCategory(payload.avenant.motifCategory || "demande_client");
        setFacturationMode(payload.avenant.facturationMode || "separee");
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
    const payload = { motif, motifCategory, facturationMode, lignes: buildLignesPayload() };
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

  const statusLabel = avenant?.status ? (L.avenants[STATUS_KEYS[avenant.status]] || avenant.status) : "Brouillon";

  return (
    <Shell>
      <div className="avenant-page-v2">
        <div className="avenant-topbar">
          <button type="button" className="avenant-back-btn" aria-label="Retour" onClick={() => router.push(backQuoteId ? `/devis?id=${backQuoteId}` : "/devis")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <div className="avenant-topbar-title">
            <div className="avenant-topbar-title-row">
              <h1>{avenant?.numero ? `Avenant ${avenant.numero}` : "Nouvel avenant"}</h1>
              <span className={`avenant-status-pill avenant-status-pill-${avenant?.status || "Brouillon"}`}>{statusLabel}</span>
            </div>
            <p>{avenant?.numero || "Brouillon"} · modifie le devis signé sans le refaire.</p>
          </div>
          <div className="avenant-topbar-actions">
            {avenant?.id && editable ? <button type="button" className="avenant-link-btn danger" onClick={handleDelete}>{L.avenants.deleteAvenant}</button> : null}
            {editable ? (
              <>
                <button type="button" className="button secondary" onClick={handleSave} disabled={saving}>Enregistrer le brouillon</button>
                <button type="button" className="button blue" onClick={handleSend} disabled={saving}>Envoyer pour signature</button>
              </>
            ) : avenant?.status === "Envoye" ? (
              <>
                <button type="button" className="button secondary danger" onClick={openRefuseComposer}>{L.avenants.refuseAvenant}</button>
                <button type="button" className="button blue" onClick={openAcceptComposer}>{L.avenants.acceptManually}</button>
              </>
            ) : null}
            {avenant?.id ? <button type="button" className="button secondary" onClick={handleDownloadPdf}>{L.avenants.downloadPdf}</button> : null}
          </div>
        </div>

        {!editable ? <p className="profile-message info">{L.avenants.readOnlyNotice(statusLabel)}</p> : null}
        {message ? <p className={`profile-message ${messageType}`}>{message}</p> : null}

        <div className="avenant-body">
          <div className="avenant-col-left">
            <section className="avenant-card">
              <strong className="avenant-card-title">Rattachement</strong>
              <div className="avenant-rattachement-grid">
                <div className="avenant-rattachement-field">
                  <span>Devis d'origine</span>
                  {quote ? (
                    <Link href={`/devis?id=${quote.id}`} className="avenant-rattachement-box">
                      <div>
                        <div className="avenant-rattachement-main">{quote.quoteNumber} · {quote.client || "Client"}</div>
                        <div className="avenant-rattachement-sub">{money(quote.totalTtc)} TTC{quote.signedAt ? ` · signé le ${shortDate(quote.signedAt)}` : ""}</div>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
                    </Link>
                  ) : <div className="avenant-rattachement-box"><div className="avenant-rattachement-main muted">—</div></div>}
                </div>
                <div className="avenant-rattachement-field">
                  <span>Chantier</span>
                  {linkedProject ? (
                    <Link href={`/chantiers?project=${linkedProject.id}`} className="avenant-rattachement-box">
                      <div>
                        <div className="avenant-rattachement-main">{linkedProject.title}</div>
                        <div className="avenant-rattachement-sub">{[linkedProject.address, linkedProject.status].filter(Boolean).join(" · ")}</div>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
                    </Link>
                  ) : <div className="avenant-rattachement-box"><div className="avenant-rattachement-main muted">Aucun chantier lié</div></div>}
                </div>
                <div className="avenant-rattachement-field">
                  <span>Facture liée</span>
                  {linkedInvoice ? (
                    <Link href="/facturation" className="avenant-rattachement-box">
                      <div>
                        <div className="avenant-rattachement-main">{linkedInvoice.invoiceNumber} · {linkedInvoice.type || ""}</div>
                        <div className="avenant-rattachement-sub">{(L.avenants[STATUS_KEYS[linkedInvoice.status]] || linkedInvoice.status || linkedInvoice.status)} · {money(linkedInvoice.amountTtc)}</div>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
                    </Link>
                  ) : <div className="avenant-rattachement-box"><div className="avenant-rattachement-main muted">Aucune facture liée</div></div>}
                </div>
              </div>
              <div className="avenant-facturation-row">
                <span>Facturation de l'avenant</span>
                <div className="avenant-pill-group">
                  <button type="button" className={`avenant-pill ${facturationMode === "separee" ? "active" : ""}`} onClick={() => setFacturationMode("separee")} disabled={!editable}>Facture séparée</button>
                  <button type="button" className={`avenant-pill ${facturationMode === "solde" ? "active" : ""}`} onClick={() => setFacturationMode("solde")} disabled={!editable}>Ajouté au solde</button>
                </div>
              </div>
            </section>

            <section className="avenant-card">
              <div className="avenant-card-head-row">
                <strong className="avenant-card-title">Motif</strong>
                <div className="avenant-pill-group">
                  {MOTIF_CATEGORIES.map((cat) => (
                    <button type="button" key={cat.id} className={`avenant-pill ${motifCategory === cat.id ? "active" : ""}`} onClick={() => setMotifCategory(cat.id)} disabled={!editable}>{cat.label}</button>
                  ))}
                </div>
              </div>
              <textarea
                className="avenant-motif-textarea"
                value={motif}
                onChange={(event) => setMotif(event.target.value)}
                placeholder="Ex : ajout d'une cloison suite à la demande du client le 12/09…"
                rows={2}
                disabled={!editable}
              />
            </section>

            <section className="avenant-card avenant-lignes-card">
              <div className="avenant-card-head-row">
                <strong className="avenant-card-title">Lignes de l'avenant</strong>
                {editable ? (
                  <div className="avenant-ligne-add-actions">
                    <select value={newLigneType} onChange={(event) => setNewLigneType(event.target.value)}>
                      <option value="ajout">{L.avenants.typeAjout}</option>
                      <option value="suppression">{L.avenants.typeSuppression}</option>
                      <option value="modification">{L.avenants.typeModification}</option>
                    </select>
                    <button type="button" className="avenant-mini-btn" onClick={() => addLigne(emptyLigne(newLigneType))}>+ Ligne libre</button>
                  </div>
                ) : null}
              </div>

              {!normalizedForTotals.length ? (
                <div className="avenant-ligne-empty-hint">Ajoutez un ouvrage ou une fourniture depuis la liste de droite, ou une ligne libre.</div>
              ) : (
                <div className="avenant-ligne-list">
                  {normalizedForTotals.map((ligne) => {
                    const meta = LIGNE_TYPE_META[ligne.type] || LIGNE_TYPE_META.ajout;
                    const expanded = expandedLigneId === ligne.id;
                    return (
                      <div key={ligne.id} className="avenant-ligne-block">
                        <div className="avenant-ligne-row" onClick={() => editable && setExpandedLigneId(expanded ? "" : ligne.id)}>
                          <span className="avenant-ligne-icon" style={{ background: meta.bg, color: meta.color }}>{meta.icon}</span>
                          <div className="avenant-ligne-main">
                            <strong>{ligne.label || "Sans titre"}</strong>
                            <small>{ligne.quantity} {ligne.unit} × {money(ligne.unitPriceHt)}</small>
                          </div>
                          <strong className="avenant-ligne-amount" style={{ color: meta.color }}>{ligne.totalHt >= 0 ? "+" : "−"} {money(Math.abs(ligne.totalHt))}</strong>
                          {editable ? (
                            <button type="button" className="avenant-ligne-delete" onClick={(event) => { event.stopPropagation(); removeLigne(ligne.id); }} aria-label={L.avenants.removeLine}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C4452D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14" /></svg>
                            </button>
                          ) : null}
                        </div>
                        {expanded && editable ? (
                          <div className="avenant-ligne-edit">
                            <select value={ligne.type} onChange={(event) => updateLigne(ligne.id, "type", event.target.value)}>
                              <option value="ajout">{L.avenants.typeAjout}</option>
                              <option value="suppression">{L.avenants.typeSuppression}</option>
                              <option value="modification">{L.avenants.typeModification}</option>
                            </select>
                            <input value={ligne.label} onChange={(event) => updateLigne(ligne.id, "label", event.target.value)} placeholder={L.avenants.lineLabel} />
                            <input value={ligne.room} onChange={(event) => updateLigne(ligne.id, "room", event.target.value)} placeholder={L.avenants.lineRoom} />
                            <input type="number" min="0" step="any" value={ligne.quantity} onChange={(event) => updateLigne(ligne.id, "quantity", event.target.value)} placeholder={L.avenants.lineQuantity} />
                            <input value={ligne.unit} onChange={(event) => updateLigne(ligne.id, "unit", event.target.value)} placeholder={L.avenants.lineUnit} />
                            <input type="number" step="0.01" value={ligne.unitPriceHt} onChange={(event) => updateLigne(ligne.id, "unitPriceHt", event.target.value)} placeholder={L.avenants.lineUnitPrice} />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="avenant-card avenant-totals-row">
              <div className="avenant-total-item flex"><span>Devis initial</span><strong>{quote ? money(quote.totalTtc) : "—"}</strong></div>
              <div className="avenant-total-item"><span>Total HT (écart)</span><strong>{totals.totalHtDelta >= 0 ? "+ " : ""}{money(totals.totalHtDelta)}</strong></div>
              <div className="avenant-total-item"><span>{L.avenants.vatLabel} {Number(vatRate).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}%</span><strong>{totals.totalTtcDelta - totals.totalHtDelta >= 0 ? "+ " : ""}{money(totals.totalTtcDelta - totals.totalHtDelta)}</strong></div>
              <div className="avenant-total-item"><span>Avenant TTC</span><strong className="avenant-total-green">{totals.totalTtcDelta >= 0 ? "+ " : ""}{money(totals.totalTtcDelta)}</strong></div>
              <div className="avenant-total-item final"><span>Nouveau total</span><strong>{quote ? money(newMarketTotal) : "—"}</strong></div>
            </section>
          </div>

          {editable ? (
            <div className="avenant-col-right">
              <div className="avenant-right-tabs">
                <button type="button" className={pickerTab === "ouvrages" ? "active" : ""} onClick={() => setPickerTab("ouvrages")}>{L.avenants.tabOuvrages}</button>
                <button type="button" className={pickerTab === "fournitures" ? "active" : ""} onClick={() => setPickerTab("fournitures")}>{L.avenants.tabFournitures}</button>
              </div>
              <label className="avenant-picker-search">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9C9FB0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14" /></svg>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={L.avenants.searchCatalog}
                />
              </label>
              <div className="avenant-picker-list">
                {pickerTab === "ouvrages" ? filteredOuvrages.map((item) => (
                  <div className="avenant-picker-row" key={item.id}>
                    <div className="avenant-picker-row-main">
                      <span className="avenant-picker-row-code">{item.code}</span>
                      <strong>{item.label}</strong>
                    </div>
                    <span className="avenant-picker-row-price">{money(Number(item.hourlyRate || 0) * Number(item.normativeTime || 0))}/{item.unit}</span>
                    <button type="button" className="avenant-picker-add-btn" onClick={() => addOuvrageLigne(item)}>{L.common.add}</button>
                  </div>
                )) : filteredSupplies.map((item) => (
                  <div className="avenant-picker-row" key={item.id}>
                    <div className="avenant-picker-row-main">
                      <strong>{item.name}</strong>
                      <span className="avenant-picker-row-code">{item.category || ""}</span>
                    </div>
                    <span className="avenant-picker-row-price">{money(supplyPrice(item))}</span>
                    <button type="button" className="avenant-picker-add-btn" onClick={() => addSupplyLigne(item)}>{L.common.add}</button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
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
