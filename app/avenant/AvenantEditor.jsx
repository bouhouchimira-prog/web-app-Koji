"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiGet, apiSend } from "../../lib/client-api";
import { useApi } from "../../lib/use-api";
import { useLocale } from "../../lib/i18n";
import { computeAvenantTotals, AVENANT_STATUS_LABEL_KEYS } from "../../lib/avenant-mapping";
import { numeroCourt } from "../../lib/avenant-koji";
import catalog from "../../data/catalog-ouvrages.json";

function money(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function shortDate(value) {
  if (!value) return "";
  const date = new Date(String(value).length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function quantityText(value) {
  return Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: 3 });
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

// Signe et style par type de ligne (DA Koji Pro, maquette PRO-05) : carré
// plein pour un ajout, contour pour une modification, barré pour une
// suppression.
const LIGNE_TYPE_META = {
  ajout: { icon: "+", cls: "add", word: "Ajout" },
  suppression: { icon: "−", cls: "del", word: "Suppression" },
  modification: { icon: "~", cls: "mod", word: "Modification" }
};

const STATUS_TAGS = { Brouillon: "tag tag-o", Envoye: "tag tag-e", Signe: "tag tag-b", Refuse: "tag dim", Archive: "tag dim" };

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
      <Shell variant="pro">
        <div className="tbl"><p className="empty">{L.common.loading}</p></div>
      </Shell>
    );
  }

  const statusLabel = avenant?.status ? (L.avenants[STATUS_KEYS[avenant.status]] || avenant.status) : "Brouillon";
  const vatText = Number(vatRate).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  const signedSign = (value) => (value >= 0 ? "+ " : "− ");

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow">
            <Link href="/avenant" className="link">Avenants</Link>
            {quote ? <>{" · "}<Link href={`/devis?id=${quote.id}`} className="link">Devis {quote.quoteNumber}</Link></> : null}
          </span>
          <h1 className="av-title">
            {avenant?.numero ? `Avenant ${avenant.numero}` : "Nouvel avenant"}
            <span className={STATUS_TAGS[avenant?.status || "Brouillon"] || "tag tag-o"}>{statusLabel}</span>
          </h1>
          <span className="muted">Modifie le devis signé sans le refaire.</span>
        </div>
        <div className="acts">
          {avenant?.id ? <button type="button" className="btn btn-sec" onClick={handleDownloadPdf}>{L.avenants.downloadPdf}</button> : null}
          {editable ? (
            <>
              <button type="button" className="btn btn-sec" onClick={handleSave} disabled={saving}>Enregistrer le brouillon</button>
              <button type="button" className="btn btn-main" onClick={handleSend} disabled={saving}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 16-2-7z" /></svg>
                Envoyer pour signature
              </button>
            </>
          ) : avenant?.status === "Envoye" ? (
            <>
              {avenant.signatureUrl ? <button type="button" className="btn btn-sec" onClick={() => navigator.clipboard?.writeText(avenant.signatureUrl)}>Copier le lien de signature</button> : null}
              <button type="button" className="btn btn-sec" onClick={openRefuseComposer}>{L.avenants.refuseAvenant}</button>
              <button type="button" className="btn btn-main" onClick={openAcceptComposer}>{L.avenants.acceptManually}</button>
            </>
          ) : null}
        </div>
      </div>

      {!editable ? <p className="notice">{L.avenants.readOnlyNotice(statusLabel)}</p> : null}
      {message ? <p className={`notice${messageType === "error" ? " notice-err" : ""}`} role={messageType === "error" ? "alert" : "status"}>{message}</p> : null}

      <div className="fiche-grid">
        <div className="fiche-main">
          <div className="env-sum">
            <div>
              <span className="lab">{avenant?.numero ? `Avenant ${avenant.numero}` : "Nouvel avenant"}</span>
              <strong>{quote ? `au devis ${quote.quoteNumber}` : "Devis d'origine introuvable"}</strong>
              <span className="muted">{[linkedProject?.title, quote?.client || avenant?.client].filter(Boolean).join(" · ") || "—"}</span>
            </div>
            <div>
              <span className="lab">Facturation de l'avenant</span>
              <div className="kp-seg" role="group" aria-label="Facturation de l'avenant">
                <button type="button" className={facturationMode === "separee" ? "on" : ""} aria-pressed={facturationMode === "separee"} onClick={() => setFacturationMode("separee")} disabled={!editable}>Facture séparée</button>
                <button type="button" className={facturationMode === "solde" ? "on" : ""} aria-pressed={facturationMode === "solde"} onClick={() => setFacturationMode("solde")} disabled={!editable}>Ajouté au solde</button>
              </div>
            </div>
          </div>

          <section className="card">
            <div className="card-h">
              <h2>Motif</h2>
              <div className="kp-seg" role="group" aria-label="Catégorie du motif">
                {MOTIF_CATEGORIES.map((cat) => (
                  <button type="button" key={cat.id} className={motifCategory === cat.id ? "on" : ""} aria-pressed={motifCategory === cat.id} onClick={() => setMotifCategory(cat.id)} disabled={!editable}>{cat.label}</button>
                ))}
              </div>
            </div>
            <div className="fgrid">
              <label className="full">{L.avenants.motifLabel}
                <textarea value={motif} onChange={(event) => setMotif(event.target.value)} placeholder="Ex : ajout d'une cloison suite à la demande du client le 12/09…" rows={2} disabled={!editable} />
              </label>
            </div>
          </section>

          <section className="card av-lines">
            <div className="lots-h">
              <span className="lab">Modifications{normalizedForTotals.length ? ` · ${normalizedForTotals.length}` : ""}</span>
              {editable ? (
                <div className="av-add">
                  <select value={newLigneType} onChange={(event) => setNewLigneType(event.target.value)} aria-label="Type de la prochaine ligne">
                    <option value="ajout">{L.avenants.typeAjout}</option>
                    <option value="suppression">{L.avenants.typeSuppression}</option>
                    <option value="modification">{L.avenants.typeModification}</option>
                  </select>
                  <button type="button" className="link" onClick={() => addLigne(emptyLigne(newLigneType))}>+ Ligne libre</button>
                </div>
              ) : null}
            </div>

            {!normalizedForTotals.length ? (
              <p className="muted av-empty">{editable ? "Ajoutez un ouvrage ou une fourniture depuis la liste de droite, ou une ligne libre." : "Aucune ligne."}</p>
            ) : normalizedForTotals.map((ligne) => {
              const meta = LIGNE_TYPE_META[ligne.type] || LIGNE_TYPE_META.ajout;
              const expanded = expandedLigneId === ligne.id;
              return (
                <div key={ligne.id} className={`avr-wrap${expanded ? " open" : ""}`}>
                  <div
                    className={`avr ${meta.cls}${editable ? " edit" : ""}`}
                    role={editable ? "button" : undefined}
                    tabIndex={editable ? 0 : undefined}
                    aria-expanded={editable ? expanded : undefined}
                    onClick={() => editable && setExpandedLigneId(expanded ? "" : ligne.id)}
                    onKeyDown={(event) => { if (editable && event.key === "Enter") setExpandedLigneId(expanded ? "" : ligne.id); }}
                  >
                    <span className="avs" aria-label={meta.word}>{meta.icon}</span>
                    <div className="avt">
                      <strong>{ligne.label || "Sans titre"}</strong>
                      <small>{[ligne.room, `${quantityText(ligne.quantity)} ${ligne.unit || ""} × ${money(ligne.unitPriceHt)}`].filter(Boolean).join(" · ")}</small>
                    </div>
                    <span className="ava">{signedSign(ligne.totalHt)}{money(Math.abs(ligne.totalHt))}</span>
                    {editable ? (
                      <button type="button" className="dx" onClick={(event) => { event.stopPropagation(); removeLigne(ligne.id); }} aria-label={L.avenants.removeLine}>×</button>
                    ) : null}
                  </div>
                  {expanded && editable ? (
                    <div className="fgrid av-edit">
                      <label>{L.avenants.lineType}
                        <select value={ligne.type} onChange={(event) => updateLigne(ligne.id, "type", event.target.value)}>
                          <option value="ajout">{L.avenants.typeAjout}</option>
                          <option value="suppression">{L.avenants.typeSuppression}</option>
                          <option value="modification">{L.avenants.typeModification}</option>
                        </select>
                      </label>
                      <label>{L.avenants.lineRoom}
                        <input value={ligne.room} onChange={(event) => updateLigne(ligne.id, "room", event.target.value)} />
                      </label>
                      <label className="full">{L.avenants.lineLabel}
                        <input value={ligne.label} onChange={(event) => updateLigne(ligne.id, "label", event.target.value)} />
                      </label>
                      <label>{L.avenants.lineQuantity}
                        <input type="number" min="0" step="any" value={ligne.quantity} onChange={(event) => updateLigne(ligne.id, "quantity", event.target.value)} />
                      </label>
                      <label>{L.avenants.lineUnit}
                        <input value={ligne.unit} onChange={(event) => updateLigne(ligne.id, "unit", event.target.value)} />
                      </label>
                      <label>{L.avenants.lineUnitPrice}
                        <input type="number" step="0.01" value={ligne.unitPriceHt} onChange={(event) => updateLigne(ligne.id, "unitPriceHt", event.target.value)} />
                      </label>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </section>

          <div className="ac-amt">
            <div><span>Devis initial TTC</span><b>{quote ? money(quote.totalTtc) : "—"}</b></div>
            <div><span>Écart HT</span><b>{signedSign(totals.totalHtDelta)}{money(Math.abs(totals.totalHtDelta))}</b></div>
            <div><span>{L.avenants.vatLabel} {vatText} %</span><b>{signedSign(totals.totalTtcDelta - totals.totalHtDelta)}{money(Math.abs(totals.totalTtcDelta - totals.totalHtDelta))}</b></div>
            <div><span>Avenant TTC</span><b>{signedSign(totals.totalTtcDelta)}{money(Math.abs(totals.totalTtcDelta))}</b></div>
            <div className="big">
              <span>{L.avenants.newMarketTotal}</span>
              <b>{quote ? `${money(newMarketTotal)} TTC` : "—"}</b>
              <small>Compté dans le total du marché une fois l'avenant signé.</small>
            </div>
          </div>
        </div>

        <aside className="fiche-side">
          {editable ? (
            <section className="card av-pick">
              <div className="card-h"><h2>Ajouter une ligne</h2></div>
              <div className="kp-seg" role="group" aria-label="Catalogue">
                <button type="button" className={pickerTab === "ouvrages" ? "on" : ""} aria-pressed={pickerTab === "ouvrages"} onClick={() => setPickerTab("ouvrages")}>{L.avenants.tabOuvrages}</button>
                <button type="button" className={pickerTab === "fournitures" ? "on" : ""} aria-pressed={pickerTab === "fournitures"} onClick={() => setPickerTab("fournitures")}>{L.avenants.tabFournitures}</button>
              </div>
              <label className="search">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4.5-4.5" /></svg>
                <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={L.avenants.searchCatalog} aria-label={L.avenants.searchCatalog} />
              </label>
              <span className="sm2">Ajouté comme : {(LIGNE_TYPE_META[newLigneType] || LIGNE_TYPE_META.ajout).word.toLowerCase()}</span>
              <div className="av-list">
                {(pickerTab === "ouvrages" ? filteredOuvrages : filteredSupplies).length === 0 ? <p className="muted">Aucun résultat.</p> : null}
                {pickerTab === "ouvrages" ? filteredOuvrages.map((item) => (
                  <div className="row av-row" key={item.id}>
                    <div className="t">
                      <strong>{item.label}</strong>
                      <small>{[item.code, `${money(Number(item.hourlyRate || 0) * Number(item.normativeTime || 0))} / ${item.unit}`].filter(Boolean).join(" · ")}</small>
                    </div>
                    <button type="button" className="link" onClick={() => addOuvrageLigne(item)}>{L.common.add}</button>
                  </div>
                )) : filteredSupplies.map((item) => (
                  <div className="row av-row" key={item.id}>
                    <div className="t">
                      <strong>{item.name}</strong>
                      <small>{[item.category, money(supplyPrice(item))].filter(Boolean).join(" · ")}</small>
                    </div>
                    <button type="button" className="link" onClick={() => addSupplyLigne(item)}>{L.common.add}</button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="card">
            <div className="card-h"><h2>Rattachement</h2></div>
            <div className="kv kv-act"><span>Devis d'origine</span><b>{quote ? <Link href={`/devis?id=${quote.id}`}>{quote.quoteNumber} · {quote.client || "Client"}</Link> : "—"}</b></div>
            {quote ? <div className="kv"><span>Montant du devis</span><b>{money(quote.totalTtc)} TTC{quote.signedAt ? ` · signé le ${shortDate(quote.signedAt)}` : ""}</b></div> : null}
            <div className="kv kv-act"><span>Chantier</span><b>{linkedProject ? <Link href={`/chantiers?project=${linkedProject.id}`}>{linkedProject.title}</Link> : "Aucun chantier lié"}</b></div>
            <div className="kv kv-act"><span>Facture liée</span><b>{linkedInvoice ? <Link href="/facturation">{linkedInvoice.invoiceNumber} · {money(linkedInvoice.amountTtc)}</Link> : "Aucune facture liée"}</b></div>
          </section>

          {avenant?.id && editable ? (
            <button type="button" className="btn btn-sec av-del" onClick={handleDelete}>{L.avenants.deleteAvenant}</button>
          ) : null}
          {!avenant?.id ? <Link href={backQuoteId ? `/devis?id=${backQuoteId}` : "/avenant"} className="btn btn-sec av-del">Annuler</Link> : null}
        </aside>
      </div>

      {acceptComposer.open ? (
        <div className="pmodal-bg" onClick={() => setAcceptComposer((current) => ({ ...current, open: false }))}>
          <div className="pmodal" role="dialog" aria-modal="true" aria-label={L.avenants.acceptManuallyTitle} onClick={(event) => event.stopPropagation()}>
            <div className="card-h">
              <h2>{L.avenants.acceptManuallyTitle}</h2>
              <button type="button" className="link" onClick={() => setAcceptComposer((current) => ({ ...current, open: false }))}>Fermer</button>
            </div>
            <p className="muted">{L.avenants.acceptManuallySub}</p>
            <div className="fgrid">
              <label className="full">{L.avenants.signerName}
                <input value={acceptComposer.signerName} onChange={(event) => setAcceptComposer((current) => ({ ...current, signerName: event.target.value }))} />
              </label>
              <div className="full">
                <span className="flab">Accord donné par</span>
                <div className="kp-seg" role="group" aria-label="Accord donné par">
                  <button type="button" className={acceptComposer.reason === "verbal" ? "on" : ""} aria-pressed={acceptComposer.reason === "verbal"} onClick={() => setAcceptComposer((current) => ({ ...current, reason: "verbal" }))}>{L.avenants.acceptReasonVerbal}</button>
                  <button type="button" className={acceptComposer.reason === "acompte" ? "on" : ""} aria-pressed={acceptComposer.reason === "acompte"} onClick={() => setAcceptComposer((current) => ({ ...current, reason: "acompte" }))}>{L.avenants.acceptReasonDeposit}</button>
                </div>
              </div>
            </div>
            <div className="pm-act">
              <button type="button" className="btn btn-sec" onClick={() => setAcceptComposer((current) => ({ ...current, open: false }))}>{L.common.cancel}</button>
              <button type="button" className="btn btn-main" onClick={submitAcceptManually}>{L.avenants.acceptManually}</button>
            </div>
          </div>
        </div>
      ) : null}

      {refuseComposer.open ? (
        <div className="pmodal-bg" onClick={() => setRefuseComposer((current) => ({ ...current, open: false }))}>
          <div className="pmodal" role="dialog" aria-modal="true" aria-label={L.avenants.refuseTitle} onClick={(event) => event.stopPropagation()}>
            <div className="card-h">
              <h2>{L.avenants.refuseTitle}</h2>
              <button type="button" className="link" onClick={() => setRefuseComposer((current) => ({ ...current, open: false }))}>Fermer</button>
            </div>
            <div className="fgrid">
              <label className="full">{L.avenants.refuseReasonLabel}
                <textarea rows={3} value={refuseComposer.reason} onChange={(event) => setRefuseComposer((current) => ({ ...current, reason: event.target.value }))} />
              </label>
            </div>
            <div className="pm-act">
              <button type="button" className="btn btn-sec" onClick={() => setRefuseComposer((current) => ({ ...current, open: false }))}>{L.common.cancel}</button>
              <button type="button" className="btn btn-main" onClick={submitRefuse}>{L.avenants.refuseAvenant}</button>
            </div>
          </div>
        </div>
      ) : null}
    </Shell>
  );
}

// /avenant sans paramètre (lien « Avenant » du menu) : liste des avenants et
// création à partir d'un devis signé. Avant, la page ouvrait un éditeur vide
// sans devis d'origine, que l'API refusait d'enregistrer.
export function AvenantList() {
  const router = useRouter();
  const { data: avenants, loading } = useApi("/api/avenants", "avenants");
  const [onglet, setOnglet] = useState("tous");

  // Liste des avenants (maquette PRO-05.1) : par état, numérotés A1, A2…
  // L'avenant se crée toujours depuis la fiche du chantier (PRO-05).
  const visibles = useMemo(() => avenants.filter((a) => a.status !== "Archive"), [avenants]);
  const etat = (a) => (a.status === "Envoye" ? "signer" : a.status === "Brouillon" ? "brouillon" : a.status === "Signe" ? "signe" : "autre");
  const comptes = { tous: visibles.length, signer: visibles.filter((a) => etat(a) === "signer").length, brouillon: visibles.filter((a) => etat(a) === "brouillon").length, signe: visibles.filter((a) => etat(a) === "signe").length };
  const rows = useMemo(() => visibles
    .filter((a) => onglet === "tous" || etat(a) === onglet)
    .sort((a, b) => String(b.signedAt || b.sentAt || b.createdAt || "").localeCompare(String(a.signedAt || a.sentAt || a.createdAt || ""))), [visibles, onglet]);
  const ONGLETS = [["tous", "Tous"], ["signer", "À signer"], ["brouillon", "Brouillons"], ["signe", "Signés"]];
  const libelle = (a) => `${numeroCourt(a.numero)} · ${a.chantier || a.client || `devis ${a.quoteNumber}`}`;
  const objet = (a) => a.motif || (a.lignes || []).map((l) => l.label).slice(0, 2).join(", ") || "—";
  const date = (a) => (a.status === "Signe" ? `signé le ${shortDate(a.signedAt)}` : a.status === "Envoye" ? `envoyé le ${shortDate(a.sentAt)} · en attente` : a.status === "Refuse" ? `refusé le ${shortDate(a.refusedAt)}` : "brouillon");
  const tag = (a) => (a.status === "Signe" ? <span className="tag tag-b">Signé</span> : a.status === "Envoye" ? <span className="tag tag-e">À signer</span> : a.status === "Refuse" ? <span className="tag dim">Refusé</span> : <span className="tag tag-o">Brouillon</span>);
  const montantTtc = (a) => `${Number(a.totalTtcDelta || 0) >= 0 ? "+ " : "− "}${money(Math.abs(Number(a.totalTtcDelta || 0)))}`;

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow">{`Avenants · ${visibles.length}${comptes.signer ? ` · ${comptes.signer} à signer` : ""}`}</span>
          <h1>Avenants</h1>
        </div>
      </div>
      <div className="avl-g">
        <div>
          <div className="tbar">
            <div className="wtabs" role="tablist" aria-label="Filtrer les avenants">
              {ONGLETS.map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={onglet === id} className={onglet === id ? "on" : ""} onClick={() => setOnglet(id)}>{label} <span>{comptes[id]}</span></button>
              ))}
            </div>
          </div>
          {loading || rows.length === 0 ? (
            <div className="tbl"><p className="empty">{loading ? "Chargement…" : "Aucun avenant dans cet onglet. Un avenant se crée depuis la fiche du chantier."}</p></div>
          ) : (
            <>
              <div className="tbl has-cards">
                <table>
                  <thead><tr><th>Avenant</th><th>Objet</th><th className="r">Montant TTC</th><th>Date</th><th>État</th><th aria-label="Action" /></tr></thead>
                  <tbody>
                    {rows.map((a) => (
                      <tr key={a.id} tabIndex={0} onClick={() => router.push(`/avenant?id=${a.id}`)} onKeyDown={(e) => { if (e.key === "Enter") router.push(`/avenant?id=${a.id}`); }}>
                        <td className="n">{libelle(a)}</td>
                        <td className="av-motif">{objet(a)}</td>
                        <td className="r">{montantTtc(a)}</td>
                        <td className="sm2">{date(a)}</td>
                        <td>{tag(a)}</td>
                        <td className="r"><Link className="link" href={`/avenant?id=${a.id}`} onClick={(e) => e.stopPropagation()}>Ouvrir</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mlist">
                {rows.map((a) => (
                  <Link className="m-card" key={a.id} href={`/avenant?id=${a.id}`}>
                    <div className="top2"><div><div className="nm">{libelle(a)}</div><div className="meta">{objet(a)}</div></div>{tag(a)}</div>
                    <div className="dvc-f"><span className="sm2">{date(a)}</span><b>{montantTtc(a)}</b></div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
        <aside className="card">
          <div className="card-h"><h2>Un avenant se crée depuis le chantier</h2></div>
          <div className="avl-rules">
            <p>Depuis la fiche du chantier : Koji repart du devis signé et de vos notes, numérote A1, A2…</p>
            <p>Signé en ligne par le client, comme le devis ; il voit chaque changement et sa justification.</p>
            <p>Un avenant signé met à jour le total du marché et le reste à facturer sur les situations.</p>
            <Link className="btn btn-sec" href="/chantiers">Voir les chantiers</Link>
          </div>
        </aside>
      </div>
    </Shell>
  );
}

export function AvenantRoute() {
  const params = useSearchParams();
  if (!params.get("id") && !params.get("quoteId")) return <AvenantList />;
  return <AvenantEditor />;
}
