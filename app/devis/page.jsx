"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiGet, apiSend } from "../../lib/client-api";
import { pricingProfile } from "../../lib/data";
import { calculateTaskPrice } from "../../lib/pricing";
import { useApi } from "../../lib/use-api";
import catalog from "../../data/catalog-ouvrages.json";

const CREATION_DRAFT_STATUS = "Brouillon en cours";
const ROOMS = ["Salon", "Cuisine", "Chambre", "Salle de bain", "Bureau", "Extérieur"];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

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

function formatNumberInput(value, digits = 2) {
  if (value === "" || value === null || value === undefined) return "";
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : "";
}

function fixedAmountHtFromSettings(settings = {}) {
  const amount = Math.max(0, Number((settings.fixedAmountInput ?? settings.fixedAmountHt) || 0));
  const mode = settings.fixedAmountMode === "ttc" ? "ttc" : "ht";
  return mode === "ttc" ? amount / (1 + Number(pricingProfile.vatRate || 0)) : amount;
}

function profileCompany(user) {
  const business = user?.business || {};
  return {
    name: business.raisonSociale || user?.name || "Kôji",
    address: [business.addressLine1, business.addressLine2].filter(Boolean).join(" "),
    email: business.emailPro || user?.email || "",
    phone: business.phone || "",
    siret: business.siret || "",
    tva: business.tva || "",
    logoDataUrl: business.logoDataUrl || ""
  };
}

function sourceToTask(source, settings = {}) {
  return {
    id: source.id,
    code: source.code,
    label: source.label,
    unit: source.unit || "u",
    normativeTime: round2(settings.normativeTime ?? source.normativeTime ?? 0),
    isFixedTime: source.unit === "u",
    billingMode: settings.billingMode || "time",
    fixedAmountHt: fixedAmountHtFromSettings(settings),
    fixedAmountInput: settings.fixedAmountInput ?? settings.fixedAmountHt ?? "",
    fixedAmountMode: settings.fixedAmountMode === "ttc" ? "ttc" : "ht",
    adjustmentPercent: Number(settings.adjustmentPercent || 0),
    discountPercent: Number(settings.discountPercent || 0),
    adjustmentReason: settings.adjustmentReason || "",
    showMaterialsToClient: settings.showMaterialsToClient !== false,
    materialRequirements: (source.materialCategories || []).map((category) => ({
      productCategory: category,
      yield: 1,
      defaultPricePerUnit: 0,
      isFixedQuantity: false
    }))
  };
}

function recalculateLine(line, settings = {}) {
  const editedMaterials = Array.isArray(settings.materialLines) ? settings.materialLines : null;
  const materialLines = (editedMaterials || line.materialLines || []).map((material) => {
    const unitsToBuy = Math.max(0, Number(material.unitsToBuy ?? material.quantityNeeded ?? 0));
    const unitPrice = Math.max(0, Number(material.unitPrice || 0));
    return {
      ...material,
      unitsToBuy,
      unitPrice,
      total: unitsToBuy * unitPrice,
      showToClient: settings.showMaterialsToClient !== false
    };
  });
  const materialCost = materialLines.reduce((sum, material) => sum + Number(material.total || 0), 0);
  const isFixed = line.billingMode === "fixed";
  const fixedAmountHt = isFixed ? fixedAmountHtFromSettings(settings) : Number(line.fixedAmountHt || 0);
  const laborCost = isFixed ? fixedAmountHt : Number(line.laborCost || 0);
  const totalHtBase = isFixed ? fixedAmountHt : laborCost + materialCost;
  const adjustmentPercent = isFixed ? 0 : Math.max(0, Number(settings.adjustmentPercent ?? line.adjustmentPercent ?? 0));
  const discountPercent = isFixed ? 0 : Math.max(0, Number(settings.discountPercent ?? line.discountPercent ?? 0));
  const adjustmentAmount = totalHtBase * (adjustmentPercent / 100);
  const totalHtAfterAdjustment = totalHtBase + adjustmentAmount;
  const discountAmount = totalHtAfterAdjustment * (discountPercent / 100);
  const totalHtBeforeMargin = Math.max(0, totalHtAfterAdjustment - discountAmount);
  const marginAmount = isFixed ? 0 : totalHtBeforeMargin * Number(pricingProfile.marginRate || 0);
  const totalHt = totalHtBeforeMargin + marginAmount;
  const vatAmount = totalHt * Number(pricingProfile.vatRate || 0);

  return {
    ...line,
    materialLines,
    materialCost,
    laborCost,
    fixedAmountHt,
    adjustmentPercent,
    discountPercent,
    adjustmentAmount,
    discountAmount,
    marginAmount,
    vatAmount,
    totalHtBase,
    totalHtBeforeMargin,
    totalHt,
    totalTtc: totalHt + vatAmount
  };
}

export default function QuotesPage() {
  const { data: quotes, setData: setQuotes } = useApi("/api/quotes", "quotes");
  const { data: projects } = useApi("/api/projects", "projects");
  const { data: supplies } = useApi("/api/supplies", "supplies");
  const { data: ouvrages } = useApi("/api/ouvrages", "ouvrages", catalog);

  const postes = useMemo(() => ouvrages.filter((item) => item.type === "POSTE" || item.type === "SOUS-POSTE"), [ouvrages]);
  const [company, setCompany] = useState(profileCompany(null));
  const [selectedIds, setSelectedIds] = useState([]);
  const [lineSettings, setLineSettings] = useState({});
  const [message, setMessage] = useState("");
  const [draftPrompt, setDraftPrompt] = useState(null);
  const [generatedQuote, setGeneratedQuote] = useState(null);
  const [signatureDelivery, setSignatureDelivery] = useState(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [form, setForm] = useState({
    client: "",
    clientEmail: "",
    clientPhone: "",
    projectId: "",
    project: "",
    room: "Salon",
    chantierAddress: "",
    quoteDate: todayIso(),
    startDate: "",
    expectedDuration: "",
    validityDays: 30
  });

  useEffect(() => {
    apiGet("/api/auth/profile")
      .then((payload) => setCompany(profileCompany(payload.user)))
      .catch(() => setCompany(profileCompany(null)));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const ouvrage = params.get("ouvrage");
    const fromSelection = params.get("selection") === "ouvrages";
    if (fromSelection) {
      try {
        const stored = JSON.parse(window.localStorage.getItem("koji-devis-ouvrages") || "[]");
        if (Array.isArray(stored)) setSelectedIds(stored.filter(Boolean));
      } catch {
        window.localStorage.removeItem("koji-devis-ouvrages");
      }
    } else if (ouvrage) {
      window.localStorage.removeItem("koji-devis-ouvrages");
      setSelectedIds([ouvrage]);
    } else {
      window.localStorage.removeItem("koji-devis-ouvrages");
      setSelectedIds([]);
    }
  }, []);

  useEffect(() => {
    const draft = quotes.find((quote) => quote.isCreationDraft && quote.status === CREATION_DRAFT_STATUS && quote.draftData);
    setDraftPrompt(draft || null);
  }, [quotes]);

  const selectedSources = useMemo(() => {
    return selectedIds.map((id) => postes.find((item) => item.id === id)).filter(Boolean);
  }, [postes, selectedIds]);

  const quoteLines = useMemo(() => {
    return selectedSources.map((source) => {
      const settings = lineSettings[source.id] || {};
      const task = sourceToTask(source, settings);
      const estimate = calculateTaskPrice({
        task,
        quantity: Number(settings.quantity || 1),
        realityFactors: { access: 1, support: 1, complexity: 1 },
        pricingProfile,
        selectedProducts: supplies
      });
      return recalculateLine({
        id: task.id,
        code: task.code,
        label: task.label,
        room: settings.room || form.room,
        unit: task.unit,
        quantity: Number(settings.quantity || 1),
        normativeTime: task.normativeTime,
        billingMode: task.billingMode,
        fixedAmountHt: task.fixedAmountHt,
        fixedAmountInput: task.fixedAmountInput,
        fixedAmountMode: task.fixedAmountMode,
        hourlyRate: estimate.hourlyRate,
        laborCost: estimate.laborCost,
        materialCost: estimate.materialCost,
        materialLines: estimate.materialLines,
        totalCoefficient: estimate.totalCoefficient,
        totalTimeHours: estimate.totalTimeHours,
        correctedTimeHours: estimate.correctedTimeHours,
        showMaterialsToClient: task.showMaterialsToClient,
        adjustmentReason: task.adjustmentReason
      }, settings);
    });
  }, [form.room, lineSettings, selectedSources, supplies]);

  const totals = useMemo(() => {
    return quoteLines.reduce((sum, line) => ({
      hours: sum.hours + Number(line.correctedTimeHours || 0),
      labor: sum.labor + Number(line.laborCost || 0),
      supplies: sum.supplies + Number(line.materialCost || 0),
      ht: sum.ht + Number(line.totalHt || 0),
      ttc: sum.ttc + Number(line.totalTtc || 0)
    }), { hours: 0, labor: 0, supplies: 0, ht: 0, ttc: 0 });
  }, [quoteLines]);

  const selectedProject = useMemo(() => {
    return projects.find((project) => project.id === form.projectId) || projects.find((project) => project.title === form.project) || null;
  }, [form.project, form.projectId, projects]);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function setCompanyField(field, value) {
    setCompany((current) => ({ ...current, [field]: value }));
  }

  function selectProject(projectId) {
    const project = projects.find((item) => item.id === projectId);
    setForm((current) => ({
      ...current,
      projectId,
      project: project?.title || "",
      client: project?.client || current.client,
      clientEmail: project?.clientEmail || current.clientEmail,
      clientPhone: project?.clientPhone || current.clientPhone,
      chantierAddress: project?.address || project?.fullAddress || current.chantierAddress
    }));
  }

  function updateLine(id, field, value) {
    setGeneratedQuote(null);
    setLineSettings((current) => {
      const currentSettings = current[id] || {};
      const nextSettings = {
        ...currentSettings,
        [field]: value
      };

      if (field === "billingMode" && value === "fixed" && !currentSettings.fixedAmountInput) {
        const line = quoteLines.find((item) => item.id === id);
        nextSettings.fixedAmountMode = currentSettings.fixedAmountMode || "ht";
        nextSettings.fixedAmountInput = formatNumberInput(line?.totalHt || 0);
      }

      return {
        ...current,
        [id]: nextSettings
      };
    });
  }

  function updateMaterial(lineId, index, field, value) {
    setGeneratedQuote(null);
    setLineSettings((current) => {
      const line = quoteLines.find((item) => item.id === lineId);
      const settings = current[lineId] || {};
      const materials = (settings.materialLines || line?.materialLines || []).map((item) => ({ ...item }));
      materials[index] = { ...materials[index], [field]: value };
      return { ...current, [lineId]: { ...settings, materialLines: materials } };
    });
  }

  function removeMaterial(lineId, index) {
    setGeneratedQuote(null);
    setLineSettings((current) => {
      const line = quoteLines.find((item) => item.id === lineId);
      const settings = current[lineId] || {};
      const materials = (settings.materialLines || line?.materialLines || []).filter((_, itemIndex) => itemIndex !== index);
      return { ...current, [lineId]: { ...settings, materialLines: materials } };
    });
  }

  function addMaterial(lineId, supplyId) {
    if (!supplyId) return;
    const supply = supplies.find((item) => item.id === supplyId);
    if (!supply) return;
    setGeneratedQuote(null);
    setLineSettings((current) => {
      const line = quoteLines.find((item) => item.id === lineId);
      const settings = current[lineId] || {};
      const materials = (settings.materialLines || line?.materialLines || []).map((item) => ({ ...item }));
      materials.push({
        category: supply.category || "Divers",
        productId: supply.id,
        productName: supply.name,
        quantityNeeded: 1,
        unitsToBuy: 1,
        unitPrice: Number(supply.priceHt ?? supply.salePriceHt ?? 0),
        total: Number(supply.priceHt ?? supply.salePriceHt ?? 0),
        showToClient: settings.showMaterialsToClient !== false
      });
      return { ...current, [lineId]: { ...settings, materialLines: materials } };
    });
  }

  function clearSelection() {
    setSelectedIds([]);
    setGeneratedQuote(null);
    if (typeof window !== "undefined") window.localStorage.removeItem("koji-devis-ouvrages");
  }

  function openOuvragesLibrary() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem("koji-devis-ouvrages");
    window.location.assign("/bibliotheque-ouvrages?from=devis&resetSelection=1");
  }

  async function continueDraft() {
    window.location.assign("/chantier/new");
  }

  async function deleteDraft() {
    if (!draftPrompt?.id) return;
    await apiSend("/api/quotes", { id: draftPrompt.id, action: "delete" }, "PATCH");
    setQuotes(quotes.filter((quote) => quote.id !== draftPrompt.id));
    setDraftPrompt(null);
  }

  async function saveQuote(event) {
    event.preventDefault();
    if (!quoteLines.length) {
      setMessage("Ajoutez au moins un ouvrage ou une fourniture avant de générer le devis.");
      return;
    }
    const payload = {
      client: form.client || selectedProject?.client || "Client",
      clientEmail: form.clientEmail,
      clientPhone: form.clientPhone,
      project: form.project || selectedProject?.title || "Chantier",
      projectId: selectedProject?.id || form.projectId,
      projectReference: selectedProject?.reference || "",
      chantierAddress: form.chantierAddress,
      startDate: form.startDate,
      expectedDuration: form.expectedDuration,
      validityDays: Number(form.validityDays || 30),
      quoteDate: form.quoteDate || todayIso(),
      createdAt: form.quoteDate || todayIso(),
      company: {
        name: company.name,
        address: company.address,
        email: company.email,
        phone: company.phone,
        siret: company.siret,
        tva: company.tva,
        logoDataUrl: company.logoDataUrl
      },
      rooms: [...new Set(quoteLines.map((line) => line.room || "Général"))],
      items: quoteLines,
      totalHt: totals.ht,
      totalTtc: totals.ttc,
      status: "Brouillon"
    };
    const { quote } = await apiSend("/api/quotes", payload);
    setQuotes([quote, ...quotes]);
    setGeneratedQuote(quote);
    setSignatureDelivery(null);
    setMessage(`Devis ${quote.quoteNumber} généré. Les documents sont prêts.`);
  }

  async function sendGeneratedQuote() {
    if (!generatedQuote?.id) return;
    try {
      const { quote } = await apiSend("/api/quotes", {
        id: generatedQuote.id,
        action: "send",
        clientEmail: form.clientEmail || generatedQuote.clientEmail || "",
        clientPhone: form.clientPhone || generatedQuote.clientPhone || ""
      }, "PATCH");
      setGeneratedQuote(quote);
      setSignatureDelivery(quote.signatureClientAccess || null);
      setQuotes((current) => current.map((item) => item.id === quote.id ? quote : item));
      setMessage("Le devis a été envoyé vers Kôji Signature. Les accès provisoires client sont prêts.");
    } catch (error) {
      setMessage(error.message || "Impossible d'envoyer le devis vers Kôji Signature.");
    }
  }

  function signatureShareText(access = signatureDelivery) {
    if (!access || !generatedQuote) return "";
    const clientName = form.client || generatedQuote.client || "Client";
    return [
      `Bonjour ${clientName},`,
      `Votre devis ${generatedQuote.quoteNumber} est pret a consulter et signer sur Koji Signature.`,
      `Lien : ${access.loginUrl}`,
      `Identifiant provisoire : ${access.identifier}`,
      `Mot de passe provisoire : ${access.password}`,
      "Apres signature, vos acces Koji Particulier seront prepares pour suivre l'avancement du chantier."
    ].join("\n");
  }

  async function copySignatureText(text, successLabel = "Copie effectuee") {
    if (!text) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else if (typeof document !== "undefined") {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopyMessage(successLabel);
      window.setTimeout(() => setCopyMessage(""), 2600);
    } catch {
      setCopyMessage("Copie impossible. Vous pouvez selectionner le lien manuellement.");
    }
  }

  const signatureText = signatureShareText();
  const signatureEmail = signatureDelivery?.email || form.clientEmail || generatedQuote?.clientEmail || "";
  const signaturePhone = signatureDelivery?.phone || form.clientPhone || generatedQuote?.clientPhone || "";
  const signaturePhoneDigits = String(signaturePhone).replace(/[^\d]/g, "");
  const signatureMailHref = signatureDelivery
    ? `mailto:${encodeURIComponent(signatureEmail)}?subject=${encodeURIComponent(`Signature du devis ${generatedQuote?.quoteNumber || ""}`)}&body=${encodeURIComponent(signatureText)}`
    : "#";
  const signatureWhatsAppHref = signatureDelivery
    ? `https://wa.me/${signaturePhoneDigits || ""}?text=${encodeURIComponent(signatureText)}`
    : "#";

  return (
    <Shell>
      <header className="page-header quote-final-header">
        <div>
          <p className="eyebrow">DEVIS</p>
          <h1>Générer mon devis</h1>
        </div>
        <div className="quote-final-actions">
          <Link className="button secondary" href="/bibliotheque-ouvrages?resetSelection=1">Bibliothèque d'ouvrages</Link>
          <Link className="button secondary" href="/signature">Suivre les signatures</Link>
        </div>
      </header>

      <form className="quote-final-page" onSubmit={saveQuote}>
        <section className="quote-identity-grid">
          <article className="quote-identity-card quote-identity-card-editable">
            <div className="koji-mini-logo">KJ</div>
            <div className="quote-identity-fields">
              <span>Entreprise</span>
              <div className="quote-client-grid quote-company-grid">
                <label>Nom entreprise<input value={company.name} onChange={(event) => setCompanyField("name", event.target.value)} placeholder="Nom de l'entreprise" /></label>
                <label className="wide">Adresse<input value={company.address} onChange={(event) => setCompanyField("address", event.target.value)} placeholder="Adresse complète" /></label>
                <label>E-mail<input type="email" value={company.email} onChange={(event) => setCompanyField("email", event.target.value)} placeholder="contact@entreprise.fr" /></label>
                <label>Téléphone<input value={company.phone} onChange={(event) => setCompanyField("phone", event.target.value)} placeholder="+33..." /></label>
                <label>SIRET<input value={company.siret} onChange={(event) => setCompanyField("siret", event.target.value)} placeholder="12345678901234" /></label>
                <label>TVA<input value={company.tva} onChange={(event) => setCompanyField("tva", event.target.value)} placeholder="FR..." /></label>
              </div>
            </div>
          </article>

          <article className="quote-identity-card">
            <div>
              <span>Client et chantier</span>
              <div className="quote-client-grid">
                <label>Client<input value={form.client} onChange={(event) => setField("client", event.target.value)} placeholder="Nom et prénom" /></label>
                <label>E-mail<input type="email" value={form.clientEmail} onChange={(event) => setField("clientEmail", event.target.value)} placeholder="client@email.fr" /></label>
                <label>Téléphone<input value={form.clientPhone} onChange={(event) => setField("clientPhone", event.target.value)} placeholder="06 12 34 56 78" /></label>
                <label>Chantier<select value={form.projectId} onChange={(event) => selectProject(event.target.value)}>
                  <option value="">Choisir un chantier</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
                </select></label>
                <label className="wide">Adresse du chantier<input value={form.chantierAddress} onChange={(event) => setField("chantierAddress", event.target.value)} placeholder="Lieu d'exécution des travaux" /></label>
                <label>Date de création<input type="date" value={form.quoteDate} onChange={(event) => setField("quoteDate", event.target.value)} /></label>
                <label>Début prévu<input type="date" value={form.startDate} onChange={(event) => setField("startDate", event.target.value)} /></label>
                <label>Durée prévue<input value={form.expectedDuration} onChange={(event) => setField("expectedDuration", event.target.value)} placeholder="Ex: 10 jours" /></label>
              </div>
            </div>
          </article>
        </section>

        <section className="quote-final-card">
          <div className="quote-section-title">
            <div>
              <span>Travaux</span>
              <h2>Récapitulatif des ouvrages</h2>
            </div>
            <button type="button" className="button secondary" onClick={openOuvragesLibrary}>Ajouter des ouvrages</button>
          </div>

          {!quoteLines.length ? (
            <div className="empty-state">Aucun ouvrage sélectionné. Ouvrez la bibliothèque pour ajouter des lignes au devis.</div>
          ) : (
            <div className="quote-final-lines">
              {quoteLines.map((line) => (
                <article key={line.id} className="quote-final-line">
                  <header>
                    <div>
                      <small>{line.room || "Général"}</small>
                      <strong>{line.label}</strong>
                    </div>
                    <b>{money(line.totalHt)} HT</b>
                  </header>

                  <div className="quote-mode-row">
                    <button type="button" className={line.billingMode !== "fixed" ? "active" : ""} onClick={() => updateLine(line.id, "billingMode", "time")}>Temps réel</button>
                    <button type="button" className={line.billingMode === "fixed" ? "active" : ""} onClick={() => updateLine(line.id, "billingMode", "fixed")}>Forfait</button>
                    <label>Pièce<select value={line.room} onChange={(event) => updateLine(line.id, "room", event.target.value)}>
                      {ROOMS.map((room) => <option key={room}>{room}</option>)}
                    </select></label>
                  </div>

                  <div className={`quote-line-inputs compact ${line.billingMode === "fixed" ? "fixed-only" : ""}`}>
                    {line.billingMode === "fixed" ? (
                      <>
                        <label className="forfait-amount-field">Montant forfaitaire<input type="number" min="0" step="0.01" value={lineSettings[line.id]?.fixedAmountInput ?? line.fixedAmountInput ?? ""} onChange={(event) => updateLine(line.id, "fixedAmountInput", event.target.value)} /></label>
                        <label className="forfait-mode-field">Type<select value={line.fixedAmountMode || "ht"} onChange={(event) => updateLine(line.id, "fixedAmountMode", event.target.value)}>
                          <option value="ht">HT</option>
                          <option value="ttc">TTC</option>
                        </select></label>
                      </>
                    ) : (
                      <>
                        <label>Quantité<input type="number" min="0" step="0.01" value={line.quantity} onChange={(event) => updateLine(line.id, "quantity", event.target.value)} /></label>
                        <label>Temps h/{line.unit}<input type="number" min="0" step="0.01" value={lineSettings[line.id]?.normativeTime ?? formatNumberInput(line.normativeTime)} onChange={(event) => updateLine(line.id, "normativeTime", event.target.value)} onBlur={(event) => updateLine(line.id, "normativeTime", formatNumberInput(event.target.value))} /></label>
                        <label>Taux horaire<input value={`${pricingProfile.hourlyRate} EUR/h`} readOnly /></label>
                        <label>Ajustement %<input type="number" min="0" step="0.5" value={line.adjustmentPercent || ""} onChange={(event) => updateLine(line.id, "adjustmentPercent", event.target.value)} /></label>
                        <label>Réduction %<input type="number" min="0" step="0.5" value={line.discountPercent || ""} onChange={(event) => updateLine(line.id, "discountPercent", event.target.value)} /></label>
                        <label className="wide">Raison d'ajustement<input value={line.adjustmentReason || ""} onChange={(event) => updateLine(line.id, "adjustmentReason", event.target.value)} placeholder="Accès difficile, support dégradé..." /></label>
                      </>
                    )}
                  </div>

                  <div className="quote-line-breakdown">
                    {line.billingMode === "fixed" ? (
                      <span>Forfait {line.fixedAmountMode === "ttc" ? "TTC" : "HT"}: {money(line.fixedAmountMode === "ttc" ? line.totalTtc : line.totalHt)}</span>
                    ) : (
                      <>
                        <span>Heures: {Number(line.correctedTimeHours || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} h</span>
                        <span>Main-d'œuvre: {money(line.laborCost)}</span>
                        <span>Fournitures: {money(line.materialCost)}</span>
                      </>
                    )}
                    <span>Total TTC: {money(line.totalTtc)}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="quote-final-card">
          <div className="quote-section-title">
            <div>
              <span>Contrôle final</span>
              <h2>Récapitulatif des fournitures</h2>
            </div>
            <button type="button" className="button secondary" onClick={clearSelection}>Réinitialiser les ouvrages</button>
          </div>

          {!quoteLines.some((line) => line.materialLines?.length) ? (
            <div className="empty-state">Aucune fourniture liée. Vous pouvez en ajouter depuis une ligne d'ouvrage.</div>
          ) : null}

          <div className="supplies-review-list">
            {quoteLines.map((line) => (
              <article key={line.id}>
                <header>
                  <strong>{line.label}</strong>
                  <label className="material-visibility">
                    <input type="checkbox" checked={line.showMaterialsToClient !== false} onChange={(event) => updateLine(line.id, "showMaterialsToClient", event.target.checked)} />
                    Afficher au client
                  </label>
                </header>
                {(line.materialLines || []).map((material, index) => (
                  <div className="supply-review-row" key={`${line.id}-${material.productId || material.category}-${index}`}>
                    <input value={material.productName || material.category || ""} onChange={(event) => updateMaterial(line.id, index, "productName", event.target.value)} placeholder="Fourniture" />
                    <input type="number" min="0" step="0.01" value={material.unitsToBuy} onChange={(event) => updateMaterial(line.id, index, "unitsToBuy", event.target.value)} />
                    <input type="number" min="0" step="0.01" value={material.unitPrice} onChange={(event) => updateMaterial(line.id, index, "unitPrice", event.target.value)} />
                    <strong>{money(material.total)}</strong>
                    <button type="button" onClick={() => removeMaterial(line.id, index)}>Supprimer</button>
                  </div>
                ))}
                <select className="add-supply-select" value="" onChange={(event) => {
                  addMaterial(line.id, event.target.value);
                  event.target.value = "";
                }}>
                  <option value="">Ajouter une fourniture</option>
                  {supplies.map((supply) => <option key={supply.id} value={supply.id}>{supply.name}</option>)}
                </select>
              </article>
            ))}
          </div>
        </section>

        <section className="quote-total-panel">
          <div><span>Total heures</span><strong>{totals.hours.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} h</strong></div>
          <div><span>Main-d'œuvre HT</span><strong>{money(totals.labor)}</strong></div>
          <div><span>Fournitures HT</span><strong>{money(totals.supplies)}</strong></div>
          <div><span>Total HT</span><strong>{money(totals.ht)}</strong></div>
          <div className="total"><span>Total TTC</span><strong>{money(totals.ttc)}</strong></div>
        </section>

        {message ? <p className="profile-message">{message}</p> : null}

        <div className="quote-submit-row">
          <button className="button blue" type="submit">Générer les documents</button>
        </div>

        {generatedQuote ? (
          <section className="quote-generated-suite">
            <article className="quote-ready-card">
              <div className="quote-ready-check">OK</div>
              <div>
                <span>Devis prêt</span>
                <h2>{generatedQuote.quoteNumber}</h2>
                <p>Les documents sont générés et prêts à être envoyés au client.</p>
              </div>
              <div className="quote-ready-progress"><strong>100%</strong><i /></div>
            </article>

            <section className="quote-documents-grid quote-documents-grid-polished">
              <a className="quote-document-download primary" href={`/api/quotes/${generatedQuote.id}/documents?type=quote&format=pdf`} download>
                <span>PDF</span>
                <strong>Devis final</strong>
                <small>PDF A4</small>
              </a>
              <a className="quote-document-download" href={`/api/quotes/${generatedQuote.id}/documents?type=quote&format=word`} download>
                <span>DOC</span>
                <strong>Devis Word</strong>
                <small>.docx</small>
              </a>
              <a className="quote-document-download" href={`/api/quotes/${generatedQuote.id}/documents?type=supplies&format=pdf`} download>
                <span>MAT</span>
                <strong>Fournitures</strong>
                <small>PDF A4</small>
              </a>
              <a className="quote-document-download" href={`/api/quotes/${generatedQuote.id}/documents?type=supplies&format=word`} download>
                <span>DOC</span>
                <strong>Liste Word</strong>
                <small>.docx</small>
              </a>
            </section>

            <section className="quote-final-card signature-delivery-card signature-send-card">
              <div className="signature-send-heading">
                <div className="signature-send-icon">-&gt;</div>
                <div>
                  <span>Signature client</span>
                  <h2>Envoyer le lien de signature</h2>
                  <p>Le client reçoit un lien Kôji Signature avec un identifiant et un mot de passe provisoire.</p>
                </div>
                <button type="button" className="button blue" onClick={sendGeneratedQuote}>
                  {signatureDelivery ? "Renvoyer le lien" : "Envoyer le lien"}
                </button>
              </div>

              {signatureDelivery ? (
                <>
                  <div className="signature-access-box">
                    <div>
                      <span>Lien Kôji Signature</span>
                      <a href={signatureDelivery.loginUrl} target="_blank" rel="noreferrer">{signatureDelivery.loginUrl}</a>
                    </div>
                    <div><span>Identifiant provisoire</span><strong>{signatureDelivery.identifier}</strong></div>
                    <div><span>Mot de passe provisoire</span><strong>{signatureDelivery.password}</strong></div>
                  </div>
                  <div className="signature-channel-row">
                    <a className="signature-channel primary" href={signatureDelivery.loginUrl} target="_blank" rel="noreferrer">Ouvrir le lien</a>
                    <button type="button" className="signature-channel" onClick={() => copySignatureText(signatureDelivery.loginUrl, "Lien copié")}>Copier le lien</button>
                    <button type="button" className="signature-channel" onClick={() => copySignatureText(signatureText, "Message prêt à envoyer")}>Copier le message</button>
                    <a className="signature-channel" href={signatureMailHref}>E-mail client</a>
                    <a className="signature-channel" href={signatureWhatsAppHref} target="_blank" rel="noreferrer">WhatsApp</a>
                  </div>
                  {copyMessage ? <p className="signature-copy-message">{copyMessage}</p> : null}
                </>
              ) : (
                <div className="signature-empty-card">
                  Cliquez sur "Envoyer le lien" pour créer les accès client et préparer l'envoi vers Kôji Signature.
                </div>
              )}
            </section>
          </section>
        ) : null}
      </form>
    </Shell>
  );
}
