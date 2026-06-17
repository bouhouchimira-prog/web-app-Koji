"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiGet, apiSend } from "../../lib/client-api";
import { clearChantierDraft, getChantierDraft } from "../../lib/chantier-draft";
import { pricingProfile } from "../../lib/data";
import { calculateTaskPrice } from "../../lib/pricing";
import { useApi } from "../../lib/use-api";
import catalog from "../../data/catalog-ouvrages.json";

const ROOM_SUGGESTIONS = ["Salon", "Cuisine", "Chambre", "Salle de bain", "Bureau", "Exterieur"];

const CUSTOM_OUVRAGE_UNITS = ["u", "m²", "ml", "m³", "h"];

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
  const amount = Math.max(0, Number(settings.fixedAmountInput ?? settings.fixedAmountHt ?? 0));
  const mode = settings.fixedAmountMode === "ttc" ? "ttc" : "ht";
  if (mode !== "ttc") return amount;
  const vatRate = settings.vatRate != null && settings.vatRate !== ""
    ? Number(settings.vatRate)
    : Number(pricingProfile.vatRate || 0);
  return amount / (1 + vatRate);
}

function supplyPrice(supply = {}) {
  return Number(supply.priceHt ?? supply.salePriceHt ?? supply.purchasePriceHt ?? 0);
}

function normalizeSupplyName(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function findSupplyForMaterial(supplies = [], material = {}) {
  if (material.productId) {
    const byId = supplies.find((item) => item.id === material.productId);
    if (byId) return byId;
  }
  const materialName = normalizeSupplyName(material.productName || material.category);
  if (!materialName) return null;
  return supplies.find((item) => normalizeSupplyName(item.name) === materialName) || null;
}

function profileCompany(user) {
  const business = user?.business || {};
  const daily = Number(business.dailyRate || 0);
  const hpd = Number(business.hoursPerDay || 7);
  return {
    name: business.raisonSociale || user?.name || "Kôji",
    address: [business.addressLine1, business.addressLine2].filter(Boolean).join(" "),
    email: business.emailPro || user?.email || "",
    phone: business.phone || "",
    siret: business.siret || "",
    tva: business.tva || "",
    logoDataUrl: business.logoDataUrl || "",
    iban: business.iban || "",
    bic: business.bic || "",
    bankHolder: business.bankHolder || business.raisonSociale || user?.name || "",
    paymentTerms: business.paymentTerms || "",
    hourlyRate: daily > 0 ? round2(daily / hpd) : 0
  };
}

function sourceToTask(source, settings = {}) {
  return {
    id: source.id,
    code: source.code,
    label: settings.label || source.label,
    unit: source.unit || "u",
    normativeTime: round2(settings.normativeTime ?? 0),
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
  const lineVatRate = settings.vatRate != null && settings.vatRate !== ""
    ? Number(settings.vatRate)
    : Number(pricingProfile.vatRate || 0.2);
  const editedMaterials = Array.isArray(settings.materialLines) ? settings.materialLines : null;
  const materialLines = (editedMaterials || line.materialLines || []).map((material) => {
    const unitsToBuy = Math.max(0, Number(material.unitsToBuy ?? material.quantityNeeded ?? 0));
    const rawPrice = Math.max(0, Number(material.unitPrice || 0));
    // unitPriceHt = HT price used for totals; unitPrice (raw user input) is never overwritten
    const unitPriceHt = material.salePriceMode === "ttc" ? round2(rawPrice / (1 + lineVatRate)) : rawPrice;
    return {
      ...material,
      unitsToBuy,
      unitPriceHt,
      total: round2(unitsToBuy * unitPriceHt),
      showToClient: material.showInDevis !== false && settings.showMaterialsToClient !== false
    };
  });
  const materialCost = materialLines.reduce((sum, material) => sum + Number(material.total || 0), 0);
  const isFixed = line.billingMode === "fixed";
  const isFixedTtcMode = isFixed && (settings.fixedAmountMode ?? line.fixedAmountMode) === "ttc";
  // round2 the HT amount immediately to avoid float drift on TTC→HT division
  const fixedAmountHt = isFixed ? round2(fixedAmountHtFromSettings(settings)) : Number(line.fixedAmountHt || 0);
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
  const vatAmount = totalHt * lineVatRate;
  // For TTC forfait: use the typed value directly to avoid HT→TTC float round-trip errors
  const totalTtc = isFixedTtcMode
    ? round2(Math.max(0, Number(settings.fixedAmountInput ?? line.fixedAmountInput ?? 0)))
    : round2(totalHt + vatAmount);

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
    vatRate: lineVatRate,
    totalHtBase,
    totalHtBeforeMargin,
    totalHt: round2(totalHt),
    totalTtc
  };
}

function computeSubItemLine(subItem, parentLine = {}) {
  const billingMode = subItem.billingMode || "fixed";
  const vatRate = subItem.vatRate != null && subItem.vatRate !== ""
    ? Number(subItem.vatRate)
    : (parentLine.vatRate || 0.2);
  let totalHt = 0;
  if (billingMode === "fixed") {
    const input = Number(subItem.fixedAmountInput || 0);
    totalHt = subItem.fixedAmountMode === "ttc"
      ? round2(input / (1 + vatRate))
      : round2(input);
  } else {
    totalHt = round2(
      Number(subItem.quantity || 0) * Number(subItem.normativeTime || 0) * Number(subItem.hourlyRate || parentLine.hourlyRate || 0)
    );
  }
  const vatAmount = round2(totalHt * vatRate);
  return { ...subItem, totalHt, totalTtc: round2(totalHt + vatAmount), vatAmount, vatRate };
}

export default function QuotesPage() {
  const { data: quotes, setData: setQuotes } = useApi("/api/quotes", "quotes");
  const { data: projects, setData: setProjects } = useApi("/api/projects", "projects");
  const { data: supplies, setData: setSupplies } = useApi("/api/supplies", "supplies");
  const { data: ouvrages } = useApi("/api/ouvrages", "ouvrages", catalog);

  const postes = useMemo(() => ouvrages.filter((item) => item.type === "POSTE" || item.type === "SOUS-POSTE"), [ouvrages]);
  const [company, setCompany] = useState(profileCompany(null));
  const [selectedIds, setSelectedIds] = useState([]);
  const [lineSettings, setLineSettings] = useState({});
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [generatedQuote, setGeneratedQuote] = useState(null);
  const [signatureDelivery, setSignatureDelivery] = useState(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [selectedSupply, setSelectedSupply] = useState(null);
  const [supplyComposer, setSupplyComposer] = useState({
    open: false,
    mode: "manual",
    lineId: "",
    materialIndex: null,
    name: "",
    category: "Materiaux",
    supplierName: "",
    unitPrice: "",
    quantity: "1",
    sourceUrl: "",
    loading: false,
    error: ""
  });
  const [form, setForm] = useState({
    client: "",
    clientEmail: "",
    clientPhone: "",
    projectId: "",
    project: "",
    propertyType: "Maison",
    chantierAddress: "",
    quoteDate: todayIso(),
    startDate: "",
    expectedDuration: "",
    validityDays: 30
  });
  const [rooms, setRooms] = useState([]);
  const [roomNotes, setRoomNotes] = useState([]);
  const [customRoom, setCustomRoom] = useState("");
  const [isNewChantier, setIsNewChantier] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [roomsOpen, setRoomsOpen] = useState(true);
  const [customSources, setCustomSources] = useState([]);
  const [surcharges, setSurcharges] = useState([
    { id: "sc-coord", label: "Coordination de chantier", percent: 10, mode: "client" },
    { id: "sc-alea", label: "Provision aléas de chantier", percent: 5, mode: "client" },
    { id: "sc-assur", label: "Assurance décennale", percent: 8, mode: "client" }
  ]);
  const [quoteVatRate, setQuoteVatRate] = useState(20);
  const [vatManual, setVatManual] = useState(false);
  const [draftQuoteNumber, setDraftQuoteNumber] = useState(null);
  const [ouvrageComposer, setOuvrageComposer] = useState({
    open: false,
    label: "",
    room: "Services",
    error: ""
  });
  const [noteComposer, setNoteComposer] = useState({
    open: false,
    room: "Services",
    type: "message",
    message: "",
    photoDataUrl: "",
    fileName: "",
    error: ""
  });

  useEffect(() => {
    apiGet("/api/auth/profile")
      .then((payload) => setCompany(profileCompany(payload.user)))
      .catch(() => setCompany(profileCompany(null)));
  }, []);

  useEffect(() => {
    const draft = getChantierDraft();
    if (!draft) return;
    // Nouveau chantier → repartir d'un devis vierge, pas restaurer l'ancien brouillon
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("koji-devis-draft");
      window.localStorage.removeItem("koji-devis-ouvrages");
    }
    setForm((current) => ({
      ...current,
      client: draft.client || current.client,
      clientEmail: draft.clientEmail || current.clientEmail,
      project: draft.title || current.project,
      propertyType: draft.propertyType || current.propertyType,
      chantierAddress: [draft.street, [draft.postalCode, draft.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || current.chantierAddress
    }));
    setIsNewChantier(true);
    clearChantierDraft();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const ouvrage = params.get("ouvrage");
    const fromSelection = params.get("selection") === "ouvrages";
    const fromFournitureSelection = params.get("selection") === "fourniture";
    const targetRoom = window.localStorage.getItem("koji-devis-target-room") || "";
    window.localStorage.removeItem("koji-devis-target-room");

    // Restore persisted draft state (only if it belongs to the current user)
    let draftIds = [];
    try {
      const raw = window.localStorage.getItem("koji-devis-draft");
      if (raw) {
        const draft = JSON.parse(raw);
        let currentUserId = "";
        try { currentUserId = JSON.parse(window.localStorage.getItem("koji-user") || "null")?.id || ""; } catch { /**/ }
        if (!draft.userId || draft.userId !== currentUserId) {
          // Draft has no userId (old format) or belongs to a different user — discard it
          window.localStorage.removeItem("koji-devis-draft");
        } else {
          if (Array.isArray(draft.customSources) && draft.customSources.length) setCustomSources(draft.customSources);
          if (draft.lineSettings && Object.keys(draft.lineSettings).length) setLineSettings(draft.lineSettings);
          if (Array.isArray(draft.roomNotes) && draft.roomNotes.length) setRoomNotes(draft.roomNotes);
          if (Array.isArray(draft.surcharges)) setSurcharges(draft.surcharges);
          if (draft.quoteVatRate != null) setQuoteVatRate(Number(draft.quoteVatRate));
          if (draft.form && typeof draft.form === "object") setForm((current) => ({ ...current, ...draft.form }));
          if (draft.vatManual != null) setVatManual(Boolean(draft.vatManual));
          if (draft.draftQuoteNumber) setDraftQuoteNumber(draft.draftQuoteNumber);
          if (Array.isArray(draft.selectedIds)) draftIds = draft.selectedIds;
          if (draft.generatedQuote?.id) {
            setGeneratedQuote(draft.generatedQuote);
            if (draft.generatedQuote.signatureClientAccess) {
              setSignatureDelivery(draft.generatedQuote.signatureClientAccess);
            }
          }
        }
      }
    } catch {
      window.localStorage.removeItem("koji-devis-draft");
    }

    function applyTargetRoom(ids) {
      if (!targetRoom || !ids.length) return;
      setLineSettings((current) => {
        const next = { ...current };
        ids.forEach((id) => {
          if (!next[id]?.room) next[id] = { ...next[id], room: targetRoom };
        });
        return next;
      });
    }

    if (fromSelection) {
      try {
        const stored = JSON.parse(window.localStorage.getItem("koji-devis-ouvrages") || "[]");
        if (Array.isArray(stored)) {
          const newIds = stored.filter(Boolean);
          // Merge library selection with draft IDs already in progress
          const merged = Array.from(new Set([...draftIds, ...newIds]));
          setSelectedIds(merged);
          applyTargetRoom(newIds);
        } else {
          setSelectedIds(draftIds);
        }
      } catch {
        window.localStorage.removeItem("koji-devis-ouvrages");
        setSelectedIds(draftIds);
      }
    } else if (fromFournitureSelection) {
      window.localStorage.removeItem("koji-devis-ouvrages");
      setSelectedIds(draftIds);
      try {
        const stored = JSON.parse(window.localStorage.getItem("koji-devis-fourniture") || "null");
        window.localStorage.removeItem("koji-devis-fourniture");
        if (stored?.supply) {
          addFournitureLine(stored.supply, stored.quantity || 1, stored.room || targetRoom || "Services");
        }
      } catch {
        window.localStorage.removeItem("koji-devis-fourniture");
      }
    } else if (ouvrage) {
      window.localStorage.removeItem("koji-devis-ouvrages");
      const merged = Array.from(new Set([...draftIds, ouvrage]));
      setSelectedIds(merged);
      applyTargetRoom([ouvrage]);
    } else {
      window.localStorage.removeItem("koji-devis-ouvrages");
      // Restore from draft instead of clearing
      setSelectedIds(draftIds);
    }
  }, []);

  // Persist working draft to localStorage on every relevant change
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasContent = selectedIds.length || customSources.length ||
      Object.keys(lineSettings).length || roomNotes.length || generatedQuote?.id;
    if (!hasContent) return;
    let currentUserId = "";
    try { currentUserId = JSON.parse(window.localStorage.getItem("koji-user") || "null")?.id || ""; } catch { /**/ }
    window.localStorage.setItem("koji-devis-draft", JSON.stringify({
      userId: currentUserId,
      selectedIds,
      customSources,
      lineSettings,
      roomNotes,
      surcharges,
      quoteVatRate,
      vatManual,
      draftQuoteNumber,
      form,
      generatedQuote: generatedQuote || null
    }));
  }, [selectedIds, customSources, lineSettings, roomNotes, surcharges, quoteVatRate, vatManual, draftQuoteNumber, generatedQuote, form]);

  // Freeze the preview number once quotes are loaded; only regenerate on "Nouveau devis"
  useEffect(() => {
    if (draftQuoteNumber || generatedQuote?.quoteNumber) return;
    const year = new Date().getFullYear();
    setDraftQuoteNumber(`${year}_${String(1048 + quotes.length + 1).padStart(4, "0")}`);
  }, [quotes]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedSources = useMemo(() => {
    const fromCatalog = selectedIds.map((id) => postes.find((item) => item.id === id)).filter(Boolean);
    return [...fromCatalog, ...customSources];
  }, [postes, selectedIds, customSources]);

  const previewQuoteNumber = generatedQuote?.quoteNumber || draftQuoteNumber || "";
  const previewVersionNumber = generatedQuote?.versionNumber || "001";

  const quoteLines = useMemo(() => {
    return selectedSources.map((source) => {
      const settings = lineSettings[source.id] || {};
      const task = sourceToTask(source, settings);
      const lineHourlyRate = settings.hourlyRate != null
        ? Number(settings.hourlyRate)
        : (company.hourlyRate || 0);
      const estimate = calculateTaskPrice({
        task,
        quantity: Number(settings.quantity ?? 0),
        realityFactors: { access: 1, support: 1, complexity: 1 },
        pricingProfile: { ...pricingProfile, hourlyRate: lineHourlyRate },
        selectedProducts: supplies
      });
      const line = recalculateLine({
        id: task.id,
        code: task.code,
        label: task.label,
        room: settings.room || "Services",
        unit: task.unit,
        quantity: Number(settings.quantity ?? 0),
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
        adjustmentReason: task.adjustmentReason,
        fixedDuration: settings.fixedDuration != null ? Number(settings.fixedDuration) : null,
        fixedDurationUnit: settings.fixedDurationUnit || "h"
      }, settings);

      const rawSubItems = Array.isArray(settings.subItems) ? settings.subItems : [];
      if (!rawSubItems.length) return line;
      const subItems = rawSubItems.map((sub) => computeSubItemLine(sub, line));
      const subTotalHt = round2(subItems.reduce((s, sub) => s + sub.totalHt, 0));
      const subTotalTtc = round2(subItems.reduce((s, sub) => s + sub.totalTtc, 0));
      return { ...line, totalHt: subTotalHt, totalTtc: subTotalTtc, vatAmount: round2(subTotalTtc - subTotalHt), subItems };
    });
  }, [lineSettings, selectedSources, supplies, company]);

  const totals = useMemo(() => {
    const hoursPerDay = Number(company.hoursPerDay || 7);
    return quoteLines.reduce((sum, line) => ({
      hours: sum.hours + (line.billingMode === "fixed"
        ? (line.fixedDuration != null ? (line.fixedDurationUnit === "j" ? line.fixedDuration * hoursPerDay : line.fixedDuration) : 0)
        : Number(line.correctedTimeHours || 0)),
      labor: sum.labor + Number(line.laborCost || 0),
      supplies: sum.supplies + Number(line.materialCost || 0),
      ht: sum.ht + Number(line.totalHt || 0),
      ttc: sum.ttc + Number(line.totalTtc || 0)
    }), { hours: 0, labor: 0, supplies: 0, ht: 0, ttc: 0 });
  }, [quoteLines, company.hoursPerDay]);

  const roomGroups = useMemo(() => {
    const labels = [...rooms];
    quoteLines.forEach((line) => {
      if (line.room && !labels.includes(line.room)) labels.push(line.room);
    });
    return labels;
  }, [rooms, quoteLines]);

  const linesByRoom = useMemo(() => {
    const map = {};
    roomGroups.forEach((room) => { map[room] = []; });
    quoteLines.forEach((line) => {
      const room = line.room || "Services";
      (map[room] || (map[room] = [])).push(line);
    });
    return map;
  }, [roomGroups, quoteLines]);

  const summaryTotals = useMemo(() => {
    const baseHt = totals.ht;
    const surchargeLines = surcharges.map((s) => ({
      ...s,
      amount: round2(baseHt * (Number(s.percent) / 100))
    }));
    const surchargeTotal = surchargeLines.filter((s) => s.mode === "internal" || s.mode === "client").reduce((sum, s) => sum + s.amount, 0);
    const totalHt = round2(baseHt + surchargeTotal);
    const vatAmount = round2(totalHt * (Number(quoteVatRate) / 100));
    const totalTtc = round2(totalHt + vatAmount);
    return { baseHt, surchargeLines, surchargeTotal, totalHt, vatAmount, totalTtc };
  }, [totals.ht, surcharges, quoteVatRate]);

  const selectedProject = useMemo(() => {
    return projects.find((project) => project.id === form.projectId) || projects.find((project) => project.title === form.project) || null;
  }, [form.project, form.projectId, projects]);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function setCompanyField(field, value) {
    setCompany((current) => ({ ...current, [field]: value }));
  }

  function clearLineOverride(field, value) {
    setLineSettings((current) => {
      const next = { ...current };
      Object.keys(next).forEach((id) => {
        if (next[id]?.[field] === value) next[id] = { ...next[id], [field]: "" };
      });
      return next;
    });
  }

  function addCustomRoom() {
    const label = customRoom.trim();
    if (!label) return;
    setRooms((current) => current.includes(label) ? current : [...current, label]);
    setCustomRoom("");
  }

  function removeRoom(label) {
    setRooms((current) => current.filter((item) => item !== label));
    clearLineOverride("room", label);
  }

  function removeQuoteLine(lineId) {
    setGeneratedQuote(null);
    if (customSources.some((item) => item.id === lineId)) {
      setCustomSources((current) => current.filter((item) => item.id !== lineId));
    } else {
      setSelectedIds((current) => current.filter((id) => id !== lineId));
    }
    setLineSettings((current) => {
      if (!(lineId in current)) return current;
      const next = { ...current };
      delete next[lineId];
      return next;
    });
  }

  function openOuvrageComposer(room = "Services") {
    setOuvrageComposer({ open: true, label: "", room, error: "" });
  }

  function closeOuvrageComposer() {
    setOuvrageComposer((current) => ({ ...current, open: false }));
  }

  function setOuvrageComposerField(field, value) {
    setOuvrageComposer((current) => ({ ...current, [field]: value, error: "" }));
  }

  function submitOuvrageComposer() {
    const label = ouvrageComposer.label.trim();
    if (!label) {
      setOuvrageComposer((current) => ({ ...current, error: "Indiquez une désignation." }));
      return;
    }
    const id = `custom-${Date.now()}`;
    setCustomSources((current) => [...current, {
      id,
      code: "PERSO",
      label,
      unit: "u",
      normativeTime: 0,
      materialCategories: []
    }]);
    setLineSettings((current) => ({
      ...current,
      [id]: { room: ouvrageComposer.room }
    }));
    setGeneratedQuote(null);
    setOuvrageComposer((current) => ({ ...current, open: false }));
  }

  function updateLineLabel(id, newLabel) {
    setGeneratedQuote(null);
    setLineSettings((current) => ({
      ...current,
      [id]: { ...current[id], label: newLabel }
    }));
  }

  function openFournitureComposer(room = "Services") {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("koji-devis-target-room", room);
    window.location.assign("/fournitures?from=devis");
  }

  function addFournitureLine(supply, quantity, room) {
    const id = `fourniture-${Date.now()}`;
    setCustomSources((current) => [...current, {
      id,
      code: "FOURN",
      label: supply.name,
      unit: supply.unit || "u",
      normativeTime: 0,
      materialCategories: []
    }]);
    const qty = Math.max(0, Number(quantity || 1));
    setLineSettings((current) => ({
      ...current,
      [id]: {
        billingMode: "time",
        quantity: "1",
        materialLines: [supplyMaterialPayload(supply, qty)],
        room
      }
    }));
    setGeneratedQuote(null);
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

  function addSubItem(parentId) {
    setGeneratedQuote(null);
    setLineSettings((current) => {
      const settings = current[parentId] || {};
      const subItems = Array.isArray(settings.subItems) ? settings.subItems : [];
      return {
        ...current,
        [parentId]: { ...settings, subItems: [...subItems, { id: `sub-${Date.now()}`, label: "", billingMode: "fixed", fixedAmountInput: "", fixedAmountMode: "ht", vatRate: "" }] }
      };
    });
  }

  function updateSubItem(parentId, subItemId, field, value) {
    setGeneratedQuote(null);
    setLineSettings((current) => {
      const settings = current[parentId] || {};
      const subItems = (settings.subItems || []).map((sub) => sub.id === subItemId ? { ...sub, [field]: value } : sub);
      return { ...current, [parentId]: { ...settings, subItems } };
    });
  }

  function removeSubItem(parentId, subItemId) {
    setGeneratedQuote(null);
    setLineSettings((current) => {
      const settings = current[parentId] || {};
      const subItems = (settings.subItems || []).filter((sub) => sub.id !== subItemId);
      return { ...current, [parentId]: { ...settings, subItems } };
    });
  }

  function supplyMaterialPayload(supply, quantity = 1) {
    const unitsToBuy = Math.max(0, Number(quantity || 1));
    const unitPrice = Math.max(0, supplyPrice(supply));
    const purchasePrice = Number(supply.purchasePriceHt || 0);
    return {
      category: supply.category || "Divers",
      productId: supply.id,
      productName: supply.name,
      supplierName: supply.supplierName || "",
      sourceUrl: supply.sourceUrl || "",
      packaging: supply.packaging || "",
      quantityNeeded: unitsToBuy,
      unitsToBuy,
      unitPrice,
      total: unitsToBuy * unitPrice,
      purchasePriceInput: purchasePrice > 0 ? String(purchasePrice) : "",
      purchasePriceMode: "ht",
      salePriceMode: "ht"
    };
  }

  function setLineMaterials(lineId, updater) {
    setGeneratedQuote(null);
    setLineSettings((current) => {
      const line = quoteLines.find((item) => item.id === lineId);
      const settings = current[lineId] || {};
      const materials = (settings.materialLines || line?.materialLines || []).map((item) => ({ ...item }));
      const nextMaterials = updater(materials).map((material) => ({
        ...material,
        showToClient: settings.showMaterialsToClient !== false
      }));
      return { ...current, [lineId]: { ...settings, materialLines: nextMaterials } };
    });
  }

  function applySupplyToLine(lineId, supply, materialIndex = null, quantity = 1) {
    if (!lineId || !supply) return;
    const payload = supplyMaterialPayload(supply, quantity);
    setLineMaterials(lineId, (materials) => {
      if (Number.isInteger(materialIndex) && materialIndex >= 0 && materials[materialIndex]) {
        materials[materialIndex] = {
          ...materials[materialIndex],
          ...payload,
          unitsToBuy: Number(payload.unitsToBuy ?? materials[materialIndex].unitsToBuy ?? 0),
          total: Number(payload.unitsToBuy ?? materials[materialIndex].unitsToBuy ?? 0) * payload.unitPrice
        };
        return materials;
      }
      return [...materials, payload];
    });
  }

  function openSupplyReference(lineId, materialIndex, material) {
    const supply = findSupplyForMaterial(supplies, material);
    if (supply) {
      setSelectedSupply({ ...supply, lineId, materialIndex });
      return;
    }
    setSupplyComposer({
      open: true,
      mode: "manual",
      lineId,
      materialIndex,
      name: material.productName || material.category || "",
      category: material.category || "Materiaux",
      supplierName: material.supplierName || "",
      unitPrice: material.unitPrice ? String(material.unitPrice) : "",
      quantity: material.unitsToBuy ? String(material.unitsToBuy) : "1",
      sourceUrl: material.sourceUrl || "",
      loading: false,
      error: ""
    });
  }

  function openSupplyComposer(lineId, mode = "manual", materialIndex = null, material = {}) {
    setSupplyComposer({
      open: true,
      mode,
      lineId,
      materialIndex,
      name: material.productName || material.category || "",
      category: material.category || "Materiaux",
      supplierName: material.supplierName || "",
      unitPrice: material.unitPrice ? String(material.unitPrice) : "",
      quantity: material.unitsToBuy ? String(material.unitsToBuy) : "1",
      sourceUrl: material.sourceUrl || "",
      loading: false,
      error: ""
    });
  }

  function closeSupplyComposer() {
    setSupplyComposer({
      open: false,
      mode: "manual",
      lineId: "",
      materialIndex: null,
      name: "",
      category: "Materiaux",
      supplierName: "",
      unitPrice: "",
      quantity: "1",
      sourceUrl: "",
      loading: false,
      error: ""
    });
  }

  function setSupplyComposerField(field, value) {
    setSupplyComposer((current) => ({ ...current, [field]: value, error: "" }));
  }

  async function saveSupplyFromComposer(event) {
    event.preventDefault();
    if (supplyComposer.loading) return;
    const isUrlImport = supplyComposer.mode === "url";
    if (isUrlImport && !supplyComposer.sourceUrl.trim()) {
      setSupplyComposer((current) => ({ ...current, error: "Ajoutez un lien produit pour importer la fourniture." }));
      return;
    }
    if (!isUrlImport && !supplyComposer.name.trim()) {
      setSupplyComposer((current) => ({ ...current, error: "Ajoutez un nom de fourniture." }));
      return;
    }

    setSupplyComposer((current) => ({ ...current, loading: true, error: "" }));
    try {
      const payload = isUrlImport
        ? {
            importUrl: supplyComposer.sourceUrl,
            name: supplyComposer.name,
            category: supplyComposer.category,
            supplierName: supplyComposer.supplierName,
            quantity: Number(supplyComposer.quantity || 1),
            purchasePriceHt: Number(supplyComposer.unitPrice || 0),
            salePriceHt: Number(supplyComposer.unitPrice || 0)
          }
        : {
            name: supplyComposer.name,
            category: supplyComposer.category,
            supplierName: supplyComposer.supplierName,
            quantity: Number(supplyComposer.quantity || 1),
            stock: Number(supplyComposer.quantity || 1),
            purchasePriceHt: Number(supplyComposer.unitPrice || 0),
            salePriceHt: Number(supplyComposer.unitPrice || 0)
          };
      const { supply } = await apiSend("/api/supplies", payload);
      setSupplies([supply, ...supplies.filter((item) => item.id !== supply.id)]);
      applySupplyToLine(supplyComposer.lineId, supply, supplyComposer.materialIndex, supplyComposer.quantity);
      setSupplyComposer((current) => ({ ...current, open: false, loading: false }));
      notify(`Fourniture ajoutée dans Koji : ${supply.name}`, "success");
    } catch (error) {
      setSupplyComposer((current) => ({
        ...current,
        loading: false,
        error: error.message || "Impossible d'ajouter cette fourniture."
      }));
    }
  }

  function clearSelection() {
    setSelectedIds([]);
    setCustomSources([]);
    setLineSettings({});
    setRooms([]);
    setRoomNotes([]);
    setGeneratedQuote(null);
    setSignatureDelivery(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("koji-devis-ouvrages");
      window.localStorage.removeItem("koji-devis-draft");
    }
  }

  function openOuvragesLibrary(room = "Services") {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem("koji-devis-ouvrages");
    window.localStorage.setItem("koji-devis-target-room", room);
    window.location.assign("/bibliotheque-ouvrages?from=devis&resetSelection=1");
  }

  function openNoteComposer(room = "Services") {
    setNoteComposer({ open: true, room, type: "message", message: "", photoDataUrl: "", fileName: "", error: "" });
  }

  function closeNoteComposer() {
    setNoteComposer((current) => ({ ...current, open: false }));
  }

  function setNoteComposerField(field, value) {
    setNoteComposer((current) => ({ ...current, [field]: value, error: "" }));
  }

  function submitNoteComposer() {
    if (noteComposer.type === "message" && !noteComposer.message.trim()) {
      setNoteComposer((current) => ({ ...current, error: "Écrivez un message avant d'ajouter la note." }));
      return;
    }
    setRoomNotes((current) => [...current, {
      id: `note-${Date.now()}`,
      room: noteComposer.room,
      type: noteComposer.type,
      message: noteComposer.message,
      photoDataUrl: noteComposer.photoDataUrl,
      fileName: noteComposer.fileName
    }]);
    closeNoteComposer();
  }

  function removeNote(id) {
    setRoomNotes((current) => current.filter((note) => note.id !== id));
  }

  function addSurcharge() {
    setSurcharges((current) => [...current, { id: `sc-${Date.now()}`, label: "", percent: 0, mode: "client" }]);
  }

  function updateSurcharge(id, field, value) {
    setSurcharges((current) => current.map((s) => s.id === id ? { ...s, [field]: value } : s));
  }

  function removeSurcharge(id) {
    setSurcharges((current) => current.filter((s) => s.id !== id));
  }

  function notify(text, type = "info") {
    setMessage(text);
    setMessageType(type);
  }

  function requireLines() {
    if (quoteLines.length) return true;
    notify("Ajoutez au moins un ouvrage ou une fourniture avant de continuer.", "error");
    return false;
  }

  async function persistQuote() {
    let projectId = selectedProject?.id || form.projectId || "";
    let projectReference = selectedProject?.reference || "";
    let nextProjects = projects;

    if (!projectId && isNewChantier) {
      const { project } = await apiSend("/api/projects", {
        title: form.project || "Nouveau chantier",
        client: form.client || "Client",
        clientEmail: form.clientEmail,
        address: form.chantierAddress,
        budgetHt: totals.ht,
        dueDate: todayIso(),
        status: "Devis genere"
      });
      projectId = project.id;
      projectReference = project.reference;
      nextProjects = [project, ...projects];
    }

    const payload = {
      client: form.client || selectedProject?.client || "Client",
      clientEmail: form.clientEmail,
      clientPhone: form.clientPhone,
      project: form.project || selectedProject?.title || "Chantier",
      projectId,
      projectReference,
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
        logoDataUrl: company.logoDataUrl,
        iban: company.iban,
        bic: company.bic,
        bankHolder: company.bankHolder
      },
      payment: {
        iban: company.iban,
        bic: company.bic,
        bankHolder: company.bankHolder
      },
      paymentConditions: company.paymentTerms,
      rooms: Array.from(new Set([...rooms, ...quoteLines.map((line) => line.room).filter(Boolean)])),
      items: quoteLines,
      notes: roomNotes,
      surcharges,
      vatRate: quoteVatRate,
      totalHt: summaryTotals.totalHt,
      totalTtc: summaryTotals.totalTtc
    };

    const isUpdate = Boolean(generatedQuote?.id);
    const { quote } = isUpdate
      ? await apiSend("/api/quotes", { id: generatedQuote.id, action: "update", ...payload }, "PATCH")
      : await apiSend("/api/quotes", { ...payload, status: "Brouillon" });

    if (projectId) {
      nextProjects = nextProjects.map((item) => item.id === projectId ? { ...item, quoteId: quote.id, budgetHt: totals.ht, status: "Devis genere" } : item);
    }
    setProjects(nextProjects);

    setQuotes((current) => isUpdate
      ? current.map((item) => item.id === quote.id ? quote : item)
      : [quote, ...current]);
    setGeneratedQuote(quote);
    setIsNewChantier(false);
    return quote;
  }

  async function sendQuoteToSignature(quoteId) {
    const { quote } = await apiSend("/api/quotes", {
      id: quoteId,
      action: "send",
      clientEmail: form.clientEmail || generatedQuote?.clientEmail || "",
      clientPhone: form.clientPhone || generatedQuote?.clientPhone || ""
    }, "PATCH");
    setGeneratedQuote(quote);
    setSignatureDelivery(quote.signatureClientAccess || null);
    setQuotes((current) => current.map((item) => item.id === quote.id ? quote : item));
    return quote;
  }

  async function resendSignatureLink() {
    if (!generatedQuote?.id) return;
    try {
      await sendQuoteToSignature(generatedQuote.id);
      notify("Le devis a été envoyé vers Kôji Signature. Les accès provisoires client sont prêts.", "success");
    } catch (error) {
      notify(error.message || "Impossible d'envoyer le devis vers Kôji Signature.", "error");
    }
  }

  async function handleDownload(type, format) {
    try {
      const quote = await persistQuote();
      window.open(`/api/quotes/${quote.id}/documents?type=${type}&format=${format}`, "_blank");
    } catch (error) {
      notify(error.message || "Impossible de générer le document.", "error");
    }
  }

  async function handlePreview() {
    if (!requireLines()) return;
    try {
      const quote = await persistQuote();
      window.open(`/api/quotes/${quote.id}/documents?type=quote&format=pdf&preview=1`, "_blank");
      notify("Aperçu ouvert dans un nouvel onglet.", "success");
    } catch (error) {
      notify(error.message || "Impossible de générer l'aperçu.", "error");
    }
  }

  async function handleConfirm() {
    if (!requireLines()) return;
    if (!window.confirm("Confirmer ce devis ? Il sera enregistré et vous pourrez y revenir plus tard.")) {
      notify("Confirmation annulée.", "info");
      return;
    }
    try {
      const quote = await persistQuote();
      notify(`Devis ${quote.quoteNumber} confirmé et enregistré. Les documents sont prêts.`, "success");
    } catch (error) {
      notify(error.message || "Impossible de confirmer le devis.", "error");
    }
  }

  async function handleSend() {
    if (!requireLines()) return;
    if (!window.confirm("Envoyer ce devis au client ? Un lien Kôji Signature sera généré.")) {
      notify("Envoi annulé.", "info");
      return;
    }
    try {
      const quote = await persistQuote();
      await sendQuoteToSignature(quote.id);
      notify("Devis envoyé au client. Lien de signature généré.", "success");
    } catch (error) {
      notify(error.message || "Impossible d'envoyer le devis au client.", "error");
    }
  }

  function resetDevisState() {
    setSelectedIds([]);
    setCustomSources([]);
    setLineSettings({});
    setRooms([]);
    setRoomNotes([]);
    setGeneratedQuote(null);
    setSignatureDelivery(null);
    setSurcharges([
      { id: "sc-coord", label: "Coordination de chantier", percent: 10, mode: "excluded" },
      { id: "sc-alea", label: "Provision aléas de chantier", percent: 5, mode: "excluded" },
      { id: "sc-assur", label: "Assurance décennale", percent: 8, mode: "excluded" }
    ]);
    setQuoteVatRate(20);
    setVatManual(false);
    const nextYear = new Date().getFullYear();
    setDraftQuoteNumber(`${nextYear}_${String(1048 + quotes.length + 1).padStart(4, "0")}`);
    setForm({ client: "", clientEmail: "", clientPhone: "", projectId: "", project: "", propertyType: "Maison", chantierAddress: "", quoteDate: todayIso(), startDate: "", expectedDuration: "", validityDays: 30 });
    setIsNewChantier(false);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("koji-devis-ouvrages");
      window.localStorage.removeItem("koji-devis-draft");
      window.localStorage.removeItem("koji-devis-target-room");
    }
  }

  function startFreshDevis() {
    const hasContent = selectedIds.length || customSources.length || rooms.length || quoteLines.length;
    if (hasContent && !window.confirm("Démarrer un nouveau devis ? Le devis en cours sera perdu.")) return;
    resetDevisState();
    notify("Nouveau devis prêt.", "success");
  }

  async function handleCancel() {
    if (!window.confirm("Annuler ce devis ? Les ouvrages et fournitures seront réinitialisés.")) {
      notify("Annulation annulée.", "info");
      return;
    }
    try {
      if (generatedQuote?.id) {
        const { quote } = await apiSend("/api/quotes", { id: generatedQuote.id, action: "cancel" }, "PATCH");
        setQuotes((current) => current.map((item) => item.id === quote.id ? quote : item));
      }
      resetDevisState();
      notify("Devis annulé.", "success");
    } catch (error) {
      notify(error.message || "Impossible d'annuler le devis.", "error");
    }
  }

  function signatureShareText(access = signatureDelivery) {
    if (!access || !generatedQuote) return "";
    const clientName = form.client || generatedQuote.client || "Client";
    return [
      `Bonjour ${clientName},`,
      `Votre devis ${generatedQuote.quoteNumber} est prêt à consulter et signer sur Kôji Signature.`,
      `Lien : ${access.loginUrl}`,
      `Identifiant provisoire : ${access.identifier}`,
      `Mot de passe provisoire : ${access.password}`,
      "Après signature, vos accès Kôji Particulier seront préparés pour suivre l'avancement du chantier."
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
      setCopyMessage("Copie impossible. Vous pouvez sélectionner le lien manuellement.");
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

  function renderLineCard(line) {
    const settings = lineSettings[line.id] || {};
    const subItems = Array.isArray(line.subItems) ? line.subItems : [];
    const hasSubItems = subItems.length > 0;
    return (
      <article key={line.id} className={`quote-final-line${hasSubItems ? " has-sub-items" : ""}`}>
        <header>
          <div className="quote-final-line-header-actions">
            <b>{money(line.totalHt)} HT</b>
            <button type="button" className="quote-line-remove" onClick={() => removeQuoteLine(line.id)} aria-label="Supprimer cette ligne">×</button>
          </div>
        </header>
        <input className="quote-line-label-input" value={settings.label ?? line.label ?? ""} onChange={(event) => updateLineLabel(line.id, event.target.value)} placeholder="Désignation de l'ouvrage..." />
        {!hasSubItems ? (
          <>
            <div className="quote-mode-row">
              <button type="button" className={line.billingMode !== "fixed" ? "active" : ""} onClick={() => updateLine(line.id, "billingMode", "time")}>Temps réel</button>
              <button type="button" className={line.billingMode === "fixed" ? "active" : ""} onClick={() => updateLine(line.id, "billingMode", "fixed")}>Forfait</button>
              <label>Pièce<select value={line.room} onChange={(event) => updateLine(line.id, "room", event.target.value)}>
                <option value="Services">— Sans pièce —</option>
                {roomGroups.filter((r) => r !== "Services").map((roomOption) => <option key={roomOption} value={roomOption}>{roomOption}</option>)}
              </select></label>
            </div>
            <div className={`quote-line-inputs compact ${line.billingMode === "fixed" ? "fixed-only" : ""}`}>
              {line.billingMode === "fixed" ? (
                <>
                  <label className="forfait-amount-field">Montant forfaitaire<input type="number" min="0" step="0.01" value={settings.fixedAmountInput ?? line.fixedAmountInput ?? ""} onChange={(event) => updateLine(line.id, "fixedAmountInput", event.target.value)} /></label>
                  <label className="forfait-mode-field">Type<select value={line.fixedAmountMode || "ht"} onChange={(event) => updateLine(line.id, "fixedAmountMode", event.target.value)}>
                    <option value="ht">HT</option>
                    <option value="ttc">TTC</option>
                  </select></label>
                  <label>TVA %<input type="number" min="0" max="100" step="any" value={settings.vatRate != null && settings.vatRate !== "" ? Math.round(settings.vatRate * 10000) / 100 : ""} onChange={(event) => updateLine(line.id, "vatRate", event.target.value === "" ? "" : Number(event.target.value) / 100)} placeholder="20" /></label>
                  <label>Durée<input type="number" min="0" step="any" value={settings.fixedDuration ?? ""} onChange={(event) => updateLine(line.id, "fixedDuration", event.target.value)} placeholder="0" /></label>
                  <label>Unité<select value={settings.fixedDurationUnit ?? "h"} onChange={(event) => updateLine(line.id, "fixedDurationUnit", event.target.value)}>
                    <option value="h">Heures</option>
                    <option value="j">Jours</option>
                  </select></label>
                </>
              ) : (
                <>
                  <label>Quantité<input type="number" min="0" step="any" value={settings.quantity ?? ""} onChange={(event) => updateLine(line.id, "quantity", event.target.value)} placeholder="0" /></label>
                  <label>Temps h/{line.unit}<input type="number" min="0" step="any" value={settings.normativeTime ?? ""} onChange={(event) => updateLine(line.id, "normativeTime", event.target.value)} placeholder="0" /></label>
                  <label>Taux horaire<input type="number" min="0" step="any" value={settings.hourlyRate ?? (company.hourlyRate > 0 ? company.hourlyRate : "")} onChange={(event) => updateLine(line.id, "hourlyRate", event.target.value)} placeholder={company.hourlyRate > 0 ? String(company.hourlyRate) : "0"} /></label>
                  <label>Ajustement %<input type="number" min="0" step="0.5" value={line.adjustmentPercent || ""} onChange={(event) => updateLine(line.id, "adjustmentPercent", event.target.value)} /></label>
                  <label>Réduction %<input type="number" min="0" step="0.5" value={line.discountPercent || ""} onChange={(event) => updateLine(line.id, "discountPercent", event.target.value)} /></label>
                  <label>TVA %<input type="number" min="0" max="100" step="any" value={settings.vatRate != null && settings.vatRate !== "" ? Math.round(settings.vatRate * 10000) / 100 : ""} onChange={(event) => updateLine(line.id, "vatRate", event.target.value === "" ? "" : Number(event.target.value) / 100)} placeholder="20" /></label>
                  <label className="wide">Raison d'ajustement<input value={line.adjustmentReason || ""} onChange={(event) => updateLine(line.id, "adjustmentReason", event.target.value)} placeholder="Accès difficile, support dégradé..." /></label>
                </>
              )}
            </div>
            <div className="quote-line-breakdown">
              {line.billingMode === "fixed" ? (
                <>
                  {settings.fixedDuration ? <span>Durée: {settings.fixedDuration} {settings.fixedDurationUnit ?? "h"}</span> : null}
                  <span>Forfait {line.fixedAmountMode === "ttc" ? "TTC" : "HT"}: {money(line.fixedAmountMode === "ttc" ? line.totalTtc : line.totalHt)}</span>
                </>
              ) : (
                <>
                  <span>Heures: {Number(line.correctedTimeHours || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} h</span>
                  <span>Main-d'œuvre: {money(line.laborCost)}</span>
                  <span>Fournitures: {money(line.materialCost)}</span>
                </>
              )}
              <span>HT: {money(line.totalHt)}</span>
              <span>TVA {Math.round((line.vatRate ?? 0.2) * 100)} %: {money(line.vatAmount)}</span>
              <span>Total TTC: {money(line.totalTtc)}</span>
            </div>
            {(() => {
              const visibleMaterials = (line.materialLines || []).filter((m) => m.productId || m.productName || Number(m.unitPrice || 0) > 0);
              if (!visibleMaterials.length) return null;
              return (
                <div className="quote-line-supplies">
                  <div className="quote-line-supplies-head">
                    <span>Fournitures</span>
                  </div>
                  {visibleMaterials.map((material) => {
                    const linkedSupply = findSupplyForMaterial(supplies, material);
                    const originalIndex = (line.materialLines || []).indexOf(material);
                    return (
                      <div className="supply-card" key={`${line.id}-${material.productId || material.category}-${originalIndex}`}>
                        <div className={`supply-card-main ${linkedSupply ? "" : "needs-link"}`}>
                          <button type="button" className={linkedSupply ? "supply-open-button" : "supply-create-button"} onClick={() => openSupplyReference(line.id, originalIndex, material)}>{linkedSupply ? "Ouvrir" : "Creer"}</button>
                          <input value={material.productName || material.category || ""} onChange={(e) => updateMaterial(line.id, originalIndex, "productName", e.target.value)} placeholder="Désignation fourniture" />
                          <input type="number" min="0" step="0.01" value={material.unitsToBuy || ""} onChange={(e) => updateMaterial(line.id, originalIndex, "unitsToBuy", e.target.value)} placeholder="Qté" />
                          <strong>{money(material.total)}</strong>
                          <button type="button" className="supply-delete-btn" onClick={() => removeMaterial(line.id, originalIndex)} aria-label="Supprimer">×</button>
                        </div>
                        <div className="supply-card-extra">
                          <label className="supply-price-field">Prix d&apos;achat
                            <div className="supply-price-input-group">
                              <input type="number" min="0" step="0.01" value={material.purchasePriceInput || ""} onChange={(e) => updateMaterial(line.id, originalIndex, "purchasePriceInput", e.target.value)} placeholder="0.00" />
                              <select className="supply-price-mode-select" value={material.purchasePriceMode || "ht"} onChange={(e) => updateMaterial(line.id, originalIndex, "purchasePriceMode", e.target.value)}>
                                <option value="ht">HT</option>
                                <option value="ttc">TTC</option>
                              </select>
                            </div>
                          </label>
                          <label className="supply-price-field">Prix de vente
                            <div className="supply-price-input-group">
                              <input type="number" min="0" step="0.01" value={material.unitPrice || ""} onChange={(e) => updateMaterial(line.id, originalIndex, "unitPrice", e.target.value)} placeholder="0.00" />
                              <select className="supply-price-mode-select" value={material.salePriceMode || "ht"} onChange={(e) => updateMaterial(line.id, originalIndex, "salePriceMode", e.target.value)}>
                                <option value="ht">HT</option>
                                <option value="ttc">TTC</option>
                              </select>
                            </div>
                          </label>
                          <label className="supply-price-field">Conditionnement
                            <input value={material.packaging || ""} onChange={(e) => updateMaterial(line.id, originalIndex, "packaging", e.target.value)} placeholder="ex: Pot 5L, Boîte 12..." />
                          </label>
                          <label className="supply-price-field">Liée à
                            <select value={material.linkedTo || ""} onChange={(e) => updateMaterial(line.id, originalIndex, "linkedTo", e.target.value)}>
                              <option value="">Cet ouvrage</option>
                              {subItems.map((sub) => <option key={sub.id} value={`sub:${sub.id}`}>{sub.label || "Sous-ouvrage"}</option>)}
                              {roomGroups.filter((r) => r !== "Services").map((room) => <option key={`room:${room}`} value={`room:${room}`}>{room}</option>)}
                              <option value="autre">Autre</option>
                            </select>
                          </label>
                          <div className="supply-card-actions">
                            <label className="material-visibility">
                              <input type="checkbox" checked={material.showInDevis !== false} onChange={(e) => updateMaterial(line.id, originalIndex, "showInDevis", e.target.checked)} />
                              Afficher dans le devis
                            </label>
                            <button type="button" className="supply-link-button" onClick={() => openSupplyComposer(line.id, "url", originalIndex, material)}>Via lien</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </>
        ) : (
          <div className="quote-line-breakdown sub-items-summary">
            <span>{subItems.length} sous-ouvrage{subItems.length > 1 ? "s" : ""}</span>
            <span>HT total : {money(line.totalHt)}</span>
            <span>TTC total : {money(line.totalTtc)}</span>
          </div>
        )}
        <div className="quote-sub-items">
          {subItems.map((sub) => (
            <article key={sub.id} className="quote-sub-item-card">
              <header>
                <div className="quote-final-line-header-actions">
                  <b>{money(sub.totalHt)} HT</b>
                  <button type="button" className="quote-line-remove" onClick={() => removeSubItem(line.id, sub.id)} aria-label="Supprimer">×</button>
                </div>
              </header>
              <input className="quote-line-label-input" value={sub.label || ""} onChange={(e) => updateSubItem(line.id, sub.id, "label", e.target.value)} placeholder="Désignation du sous-ouvrage..." />
              <div className="quote-mode-row">
                <button type="button" className={sub.billingMode !== "fixed" ? "active" : ""} onClick={() => updateSubItem(line.id, sub.id, "billingMode", "time")}>Temps réel</button>
                <button type="button" className={sub.billingMode === "fixed" ? "active" : ""} onClick={() => updateSubItem(line.id, sub.id, "billingMode", "fixed")}>Forfait</button>
              </div>
              <div className={`quote-line-inputs compact ${sub.billingMode === "fixed" ? "fixed-only" : ""}`}>
                {sub.billingMode === "fixed" ? (
                  <>
                    <label className="forfait-amount-field">Montant forfaitaire<input type="number" min="0" step="0.01" value={sub.fixedAmountInput || ""} onChange={(e) => updateSubItem(line.id, sub.id, "fixedAmountInput", e.target.value)} /></label>
                    <label className="forfait-mode-field">Type<select value={sub.fixedAmountMode || "ht"} onChange={(e) => updateSubItem(line.id, sub.id, "fixedAmountMode", e.target.value)}>
                      <option value="ht">HT</option>
                      <option value="ttc">TTC</option>
                    </select></label>
                    <label>TVA %<input type="number" min="0" max="100" step="any" value={sub.vatRate != null && sub.vatRate !== "" ? Math.round(Number(sub.vatRate) * 10000) / 100 : ""} onChange={(e) => updateSubItem(line.id, sub.id, "vatRate", e.target.value === "" ? "" : Number(e.target.value) / 100)} placeholder="20" /></label>
                  </>
                ) : (
                  <>
                    <label>Quantité<input type="number" min="0" step="any" value={sub.quantity || ""} onChange={(e) => updateSubItem(line.id, sub.id, "quantity", e.target.value)} placeholder="0" /></label>
                    <label>Temps h/u<input type="number" min="0" step="any" value={sub.normativeTime || ""} onChange={(e) => updateSubItem(line.id, sub.id, "normativeTime", e.target.value)} placeholder="0" /></label>
                    <label>Taux horaire<input type="number" min="0" step="any" value={sub.hourlyRate || ""} onChange={(e) => updateSubItem(line.id, sub.id, "hourlyRate", e.target.value)} placeholder={String(company.hourlyRate || "0")} /></label>
                    <label>TVA %<input type="number" min="0" max="100" step="any" value={sub.vatRate != null && sub.vatRate !== "" ? Math.round(Number(sub.vatRate) * 10000) / 100 : ""} onChange={(e) => updateSubItem(line.id, sub.id, "vatRate", e.target.value === "" ? "" : Number(e.target.value) / 100)} placeholder="20" /></label>
                  </>
                )}
              </div>
              <div className="quote-line-breakdown">
                {sub.billingMode === "fixed" ? (
                  <span>Forfait {sub.fixedAmountMode === "ttc" ? "TTC" : "HT"} : {money(sub.fixedAmountMode === "ttc" ? sub.totalTtc : sub.totalHt)}</span>
                ) : (
                  <span>{Number(sub.quantity || 0)} u × {Number(sub.normativeTime || 0)} h × {money(sub.hourlyRate || line.hourlyRate || 0)}/h</span>
                )}
                <span>HT : {money(sub.totalHt)}</span>
                <span>TVA {Math.round(Number(sub.vatRate || 0.2) * 100)} % : {money(sub.vatAmount)}</span>
                <span>Total TTC : {money(sub.totalTtc)}</span>
              </div>
            </article>
          ))}
          <button type="button" className="quote-sub-add-btn" onClick={() => addSubItem(line.id)}>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" d="M12 5v14M5 12h14" /></svg>
            Ajouter un sous-ouvrage
          </button>
        </div>
      </article>
    );
  }

  return (
    <Shell>
      <header className="page-header quote-final-header">
        <div>
          <p className="eyebrow">DEVIS</p>
          <h1>Générer mon devis</h1>
        </div>
        <div className="quote-final-actions">
          <button type="button" className="button secondary" onClick={startFreshDevis}>Nouveau devis</button>
          <Link className="button secondary" href="/signature">Ma Signature</Link>
        </div>
      </header>

      <form className="quote-final-page" onSubmit={(event) => event.preventDefault()}>
        <div className="quote-meta-bar">
          <div className="quote-meta-number">
            <span>Devis N° : {previewQuoteNumber}</span>
            <span className="quote-meta-version">Version N° : {previewVersionNumber}</span>
          </div>
          <button type="button" className={`quote-meta-toggle ${identityOpen ? "open" : ""}`} onClick={() => setIdentityOpen((open) => !open)} aria-expanded={identityOpen} aria-label={identityOpen ? "Réduire les informations" : "Afficher les informations"}>
            <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" /></svg>
          </button>
        </div>

        {identityOpen ? (
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
                  <label>Chantier<select value={isNewChantier && !form.projectId ? "nouveau" : form.projectId} onChange={(event) => {
                    if (event.target.value === "nouveau") {
                      setForm((current) => ({ ...current, projectId: "", project: "", client: current.client, clientEmail: current.clientEmail, clientPhone: current.clientPhone, chantierAddress: "" }));
                      setIsNewChantier(true);
                    } else {
                      setIsNewChantier(false);
                      selectProject(event.target.value);
                    }
                  }}>
                    <option value="">Choisir un chantier</option>
                    {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
                    <option value="nouveau">— Créer à la main —</option>
                  </select></label>
                  {isNewChantier && !form.projectId ? (
                    <label>Nom du chantier<input value={form.project} onChange={(event) => setField("project", event.target.value)} placeholder="Ex: Rénovation cuisine Dupont" autoFocus /></label>
                  ) : null}
                  <label className="wide">Adresse du chantier<input value={form.chantierAddress} onChange={(event) => setField("chantierAddress", event.target.value)} placeholder="Lieu d'exécution des travaux" /></label>
                  <label>Date de création<input type="date" value={form.quoteDate} onChange={(event) => setField("quoteDate", event.target.value)} /></label>
                  <label>Début prévu<input type="date" value={form.startDate} onChange={(event) => setField("startDate", event.target.value)} /></label>
                  <label>Durée prévue<input value={form.expectedDuration} onChange={(event) => setField("expectedDuration", event.target.value)} placeholder="Ex: 10 jours" /></label>
                  <label>Type du bien<select value={form.propertyType} onChange={(event) => setField("propertyType", event.target.value)}>
                    <option>Maison</option>
                    <option>Appartement</option>
                    <option>Local</option>
                    <option>Autre</option>
                  </select></label>
                </div>
              </div>
            </article>
          </section>
        ) : null}

        <section className="quote-final-card">
          <div className="quote-section-title">
            <div>
              <span>Organisation</span>
              <h2>Pièces du chantier</h2>
            </div>
            <button type="button" className={`quote-meta-toggle ${roomsOpen ? "open" : ""}`} onClick={() => setRoomsOpen((open) => !open)} aria-expanded={roomsOpen} aria-label={roomsOpen ? "Réduire les pièces" : "Afficher les pièces"}>
              <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" /></svg>
            </button>
          </div>

          {roomsOpen ? (
            <>
              <div className="room-add-card">
                <div className="room-add-row">
                  <input
                    value={customRoom}
                    onChange={(event) => setCustomRoom(event.target.value)}
                    placeholder="Nom de la pièce (ex: Salon, Cuisine...)"
                    list="room-suggestions"
                    onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomRoom(); } }}
                  />
                  <datalist id="room-suggestions">
                    {ROOM_SUGGESTIONS.map((room) => <option key={room} value={room} />)}
                  </datalist>
                  <button type="button" onClick={addCustomRoom}>+</button>
                </div>
              </div>
              {rooms.length ? (
                <div className="added-chip-list">
                  {rooms.map((room) => (
                    <span className="added-chip" key={room}>
                      {room}
                      <button type="button" onClick={() => removeRoom(room)} aria-label={`Retirer ${room}`}>x</button>
                    </span>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </section>

        <section className="quote-final-card">
          <div className="quote-section-title">
            <div>
              <span>Travaux</span>
              <h2>Ouvrages et fournitures</h2>
            </div>
            {(quoteLines.length > 0 || rooms.length > 0) ? (
              <button type="button" className="button secondary" onClick={clearSelection}>Réinitialiser les ouvrages</button>
            ) : null}
          </div>

          <div className="quote-toolbar">
            <button type="button" className="quote-toolbar-button purple" onClick={() => openNoteComposer("Services")}>
              <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
              Note
            </button>
            <button type="button" className="quote-toolbar-button orange" onClick={() => openOuvragesLibrary("Services")}>
              <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 6.5C10.5 5.5 8 5 4 5v13c4 0 6.5.5 8 1.5M12 6.5c1.5-1 4-1.5 8-1.5v13c-4 0-6.5.5-8 1.5M12 6.5v13" /></svg>
              Bibliothèque d'ouvrages
            </button>
            <button type="button" className="quote-toolbar-button blue" onClick={() => openOuvrageComposer("Services")}>
              <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" /><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M12 8v8M8 12h8" /></svg>
              Créer une ouvrage
            </button>
            <button type="button" className="quote-toolbar-button green" onClick={() => openFournitureComposer("Services")}>
              <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="20" r="1.5" fill="currentColor" /><circle cx="18" cy="20" r="1.5" fill="currentColor" /><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 4h2l2.4 12.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L22 7H6" /></svg>
              Ajouter fourniture
            </button>
          </div>

          {roomNotes.filter((note) => note.room === "Services").map((note) => (
            <div key={note.id} className="room-note-card">
              <div className="room-note-header">
                <span className="room-note-type">
                  {note.type === "photo" ? "Photo" : note.type === "attachment" ? "Pièce jointe" : "Message"}
                </span>
                <button type="button" className="room-note-remove" onClick={() => removeNote(note.id)} aria-label="Supprimer la note">×</button>
              </div>
              {note.message ? <p className="room-note-message">{note.message}</p> : null}
              {note.photoDataUrl ? <img src={note.photoDataUrl} alt="Note photo" className="room-note-photo" /> : null}
              {note.fileName && !note.photoDataUrl ? <span className="room-note-file">{note.fileName}</span> : null}
            </div>
          ))}

          {(linesByRoom["Services"] || []).length > 0 ? (
            <div className="quote-final-lines">
              {(linesByRoom["Services"] || []).map((line) => renderLineCard(line))}
            </div>
          ) : null}

        </section>

        {roomGroups.filter((room) => room !== "Services").map((room) => {
          const roomLines = linesByRoom[room] || [];
          return (
            <section className="quote-final-card quote-room-card" key={room}>
              <div className="quote-section-title">
                <div>
                  <span>Pièce</span>
                  <h2>{room}</h2>
                </div>
              </div>

              <div className="quote-toolbar">
                <button type="button" className="quote-toolbar-button purple" onClick={() => openNoteComposer(room)}>
                  <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  Note
                </button>
                <button type="button" className="quote-toolbar-button orange" onClick={() => openOuvragesLibrary(room)}>
                  <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 6.5C10.5 5.5 8 5 4 5v13c4 0 6.5.5 8 1.5M12 6.5c1.5-1 4-1.5 8-1.5v13c-4 0-6.5.5-8 1.5M12 6.5v13" /></svg>
                  Bibliothèque d'ouvrages
                </button>
                <button type="button" className="quote-toolbar-button blue" onClick={() => openOuvrageComposer(room)}>
                  <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" /><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M12 8v8M8 12h8" /></svg>
                  Créer une ouvrage
                </button>
                <button type="button" className="quote-toolbar-button green" onClick={() => openFournitureComposer(room)}>
                  <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="20" r="1.5" fill="currentColor" /><circle cx="18" cy="20" r="1.5" fill="currentColor" /><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 4h2l2.4 12.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L22 7H6" /></svg>
                  Ajouter fourniture
                </button>
              </div>

              {roomNotes.filter((note) => note.room === room).map((note) => (
                <div key={note.id} className="room-note-card">
                  <div className="room-note-header">
                    <span className="room-note-type">
                      {note.type === "photo" ? "Photo" : note.type === "attachment" ? "Pièce jointe" : "Message"}
                    </span>
                    <button type="button" className="room-note-remove" onClick={() => removeNote(note.id)} aria-label="Supprimer la note">×</button>
                  </div>
                  {note.message ? <p className="room-note-message">{note.message}</p> : null}
                  {note.photoDataUrl ? <img src={note.photoDataUrl} alt="Note photo" className="room-note-photo" /> : null}
                  {note.fileName && !note.photoDataUrl ? <span className="room-note-file">{note.fileName}</span> : null}
                </div>
              ))}

              {!roomLines.length ? (
                <div className="empty-state">Aucun ouvrage pour cette pièce. Utilisez les boutons ci-dessus pour en ajouter.</div>
              ) : (
                <>
                  <div className="quote-final-lines">
                    {roomLines.map((line) => renderLineCard(line))}
                  </div>
                  <div className="quote-room-subtotal">
                    <span className="quote-room-subtotal-label">Sous-total {room}</span>
                    <span>{money(roomLines.reduce((s, l) => s + l.totalHt, 0))} HT</span>
                    <span>{money(roomLines.reduce((s, l) => s + l.totalTtc, 0))} TTC</span>
                  </div>
                </>
              )}
            </section>
          );
        })}

        <section className="quote-total-panel">
          <div><span>Total heures</span><strong>{totals.hours.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} h</strong></div>
          <div><span>Main-d'œuvre HT</span><strong>{money(totals.labor)}</strong></div>
          <div><span>Fournitures HT</span><strong>{money(totals.supplies)}</strong></div>
          <div><span>Sous-total HT</span><strong>{money(totals.ht)}</strong></div>
          <div className="total"><span>Total TTC</span><strong>{money(summaryTotals.totalTtc)}</strong></div>
        </section>

        <section className="quote-recap-card">
          <div className="recap-title-row">
            <h2 className="recap-title">CONDITIONNEMENT DU CHANTIER</h2>
            <label className="recap-global-toggle" title="Afficher / masquer tout au client">
              <input
                type="checkbox"
                checked={surcharges.length > 0 && surcharges.every((s) => s.mode === "client")}
                onChange={(e) => setSurcharges((current) => current.map((s) => ({ ...s, mode: e.target.checked ? "client" : "excluded" })))}
              />
              <span>{surcharges.every((s) => s.mode === "client") ? "Affiché au client" : "Masqué au client"}</span>
            </label>
          </div>

          {roomGroups.map((room) => {
            const roomHt = (linesByRoom[room] || []).reduce((s, l) => s + l.totalHt, 0);
            if (roomHt === 0 && room === "Services") return null;
            return (
              <div className="recap-row recap-room-row" key={room}>
                <span>{room === "Services" ? "Travaux généraux" : room}</span>
                <strong>{money(roomHt)}</strong>
              </div>
            );
          })}

          {surcharges.map((s) => {
            const line = summaryTotals.surchargeLines.find((x) => x.id === s.id);
            return (
              <div className={`recap-row recap-surcharge-row recap-surcharge-mode-${s.mode ?? "excluded"}`} key={s.id}>
                <div className="recap-mode-toggle">
                  {["excluded", "internal", "client"].map((m) => (
                    <button key={m} type="button" className={`recap-mode-btn${(s.mode ?? "excluded") === m ? " active" : ""}`} onClick={() => updateSurcharge(s.id, "mode", m)} title={m === "excluded" ? "Exclu du total, non affiché" : m === "internal" ? "Compté dans le total, non affiché au client" : "Compté dans le total et affiché au client"}>
                      {m === "excluded" ? "Exclu" : m === "internal" ? "Interne" : "Client"}
                    </button>
                  ))}
                </div>
                <input
                  className="recap-surcharge-label"
                  value={s.label}
                  onChange={(e) => updateSurcharge(s.id, "label", e.target.value)}
                  placeholder="Libellé (ex: Coordination...)"
                />
                <input
                  type="number"
                  className="recap-surcharge-pct"
                  value={s.percent}
                  min="0"
                  max="100"
                  step="0.5"
                  onChange={(e) => updateSurcharge(s.id, "percent", e.target.value)}
                />
                <span className="recap-pct-sym">%</span>
                <strong className="recap-surcharge-amount">
                  {s.mode === "excluded" ? <span className="recap-surcharge-dim">{money(line?.amount ?? 0)}</span> : money(line?.amount ?? 0)}
                </strong>
                <button type="button" className="recap-remove-btn" onClick={() => removeSurcharge(s.id)} aria-label="Supprimer">×</button>
              </div>
            );
          })}

          <button type="button" className="recap-add-surcharge" onClick={addSurcharge}>+ Ajouter une ligne</button>

          <div className="recap-divider" />

          <div className="recap-row recap-total-ht">
            <span>TOTAL GÉNÉRAL H.T.</span>
            <strong>{money(summaryTotals.totalHt)}</strong>
          </div>

          <div className="recap-row recap-tva-row">
            <span>TVA</span>
            <div className="recap-tva-controls">
              {vatManual ? (
                <>
                  <input
                    type="number"
                    className="recap-tva-input"
                    value={quoteVatRate}
                    min="0"
                    max="100"
                    step="0.5"
                    onChange={(e) => setQuoteVatRate(Math.max(0, Number(e.target.value) || 0))}
                  />
                  <span className="recap-pct-sym">%</span>
                  <button type="button" className="recap-tva-switch" onClick={() => setVatManual(false)}>Choisir</button>
                </>
              ) : (
                <>
                  <select
                    className="recap-tva-select"
                    value={[5.5, 10, 20].includes(Number(quoteVatRate)) ? String(quoteVatRate) : "autre"}
                    onChange={(e) => {
                      if (e.target.value === "autre") {
                        setVatManual(true);
                      } else {
                        setQuoteVatRate(Number(e.target.value));
                      }
                    }}
                  >
                    <option value="5.5">5,5 %</option>
                    <option value="10">10 %</option>
                    <option value="20">20 %</option>
                    <option value="autre">Autre...</option>
                  </select>
                </>
              )}
            </div>
            <strong>{money(summaryTotals.vatAmount)}</strong>
          </div>

          <div className="recap-row recap-total-ttc">
            <span>TOTAL GÉNÉRAL T.T.C.</span>
            <strong>{money(summaryTotals.totalTtc)}</strong>
          </div>
        </section>

        <section className="quote-final-card quote-payment-card">
          <div className="quote-section-title">
            <div>
              <span>Règlement</span>
              <h2>Modalités de paiement</h2>
            </div>
          </div>

          <div className="payment-fields-grid">
            <label className="payment-field">
              <span>IBAN</span>
              <input
                value={company.iban || ""}
                onChange={(e) => setCompanyField("iban", e.target.value)}
                placeholder="FR76 3000 6000 0112 3456 7890 189"
              />
            </label>
            <label className="payment-field">
              <span>BIC / SWIFT</span>
              <input
                value={company.bic || ""}
                onChange={(e) => setCompanyField("bic", e.target.value)}
                placeholder="BNPAFRPP"
              />
            </label>
            <label className="payment-field">
              <span>Titulaire du compte</span>
              <input
                value={company.bankHolder || ""}
                onChange={(e) => setCompanyField("bankHolder", e.target.value)}
                placeholder="Nom du titulaire"
              />
            </label>
          </div>

          <label className="payment-field payment-field-wide">
            <span>Conditions de règlement</span>
            <textarea
              className="payment-terms-textarea"
              value={company.paymentTerms || ""}
              onChange={(e) => setCompanyField("paymentTerms", e.target.value)}
              placeholder={"Modalités de paiement : 30 % à la signature, solde à la réception.\nDélai d'exécution : à convenir avec le client.\nDevis valable 30 jours. TVA applicable selon la réglementation en vigueur."}
              rows={3}
            />
          </label>
        </section>

        {message ? <p className={`profile-message ${messageType}`}>{message}</p> : null}

        <div className="quote-action-row">
          <button type="button" className="button secondary" onClick={handlePreview}>Aperçu</button>
          <button type="button" className="button danger" onClick={handleCancel}>Annuler</button>
          <button type="button" className="button secondary" onClick={handleConfirm}>Confirmer</button>
          <button type="button" className="button blue" onClick={handleSend}>Envoyer</button>
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
              <button type="button" className="quote-document-download primary" onClick={() => handleDownload("quote", "pdf")}>
                <span>PDF</span>
                <strong>Devis final</strong>
                <small>PDF A4</small>
              </button>
              <button type="button" className="quote-document-download" onClick={() => handleDownload("quote", "word")}>
                <span>DOC</span>
                <strong>Devis Word</strong>
                <small>.docx</small>
              </button>
              <button type="button" className="quote-document-download" onClick={() => handleDownload("supplies", "pdf")}>
                <span>MAT</span>
                <strong>Fournitures</strong>
                <small>PDF A4</small>
              </button>
              <button type="button" className="quote-document-download" onClick={() => handleDownload("supplies", "word")}>
                <span>DOC</span>
                <strong>Liste Word</strong>
                <small>.docx</small>
              </button>
            </section>

            <section className="quote-final-card signature-delivery-card signature-send-card">
              <div className="signature-send-heading">
                <div className="signature-send-icon">-&gt;</div>
                <div>
                  <span>Signature client</span>
                  <h2>Envoyer le lien de signature</h2>
                  <p>Le client reçoit un lien Kôji Signature avec un identifiant et un mot de passe provisoire.</p>
                </div>
                <button type="button" className="button blue" onClick={resendSignatureLink}>
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
                    <button type="button" className="signature-channel" onClick={() => copySignatureText(signatureDelivery.loginUrl, "Lien copi?")}>Copier le lien</button>
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

        {selectedSupply ? (
          <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setSelectedSupply(null)}>
            <div className="mini-modal supply-detail-modal" onClick={(event) => event.stopPropagation()}>
              <h2>{selectedSupply.name}</h2>
              <p>Fourniture liee au module Fournitures.</p>
              <dl className="supply-detail-list">
                <div><dt>Categorie</dt><dd>{selectedSupply.category || "Divers"}</dd></div>
                <div><dt>Fournisseur</dt><dd>{selectedSupply.supplierName || "Non renseigne"}</dd></div>
                <div><dt>Prix HT</dt><dd>{money(supplyPrice(selectedSupply))}</dd></div>
                <div><dt>Stock</dt><dd>{selectedSupply.stock ?? selectedSupply.quantity ?? 0}</dd></div>
              </dl>
              {selectedSupply.sourceUrl ? <a className="supply-source-link" href={selectedSupply.sourceUrl} target="_blank" rel="noreferrer">Voir le lien source</a> : null}
              <div className="supply-modal-actions">
                <button type="button" onClick={() => setSelectedSupply(null)}>Fermer</button>
                <Link className="button secondary" href={`/fournitures?supply=${selectedSupply.id}`}>Ouvrir dans Fournitures</Link>
                <button type="button" className="button blue" onClick={() => { applySupplyToLine(selectedSupply.lineId, selectedSupply, selectedSupply.materialIndex); setSelectedSupply(null); }}>Utiliser</button>
              </div>
            </div>
          </div>
        ) : null}

        {supplyComposer.open ? (
          <div className="modal-overlay" role="dialog" aria-modal="true" onClick={closeSupplyComposer}>
            <div className="mini-modal supply-composer-modal" onClick={(event) => event.stopPropagation()}>
              <h2>{supplyComposer.mode === "url" ? "Ajouter via lien" : "Ajouter une fourniture"}</h2>
              <div className="supply-composer-tabs">
                <button type="button" className={supplyComposer.mode === "manual" ? "active" : ""} onClick={() => setSupplyComposerField("mode", "manual")}>Manuel</button>
                <button type="button" className={supplyComposer.mode === "url" ? "active" : ""} onClick={() => setSupplyComposerField("mode", "url")}>Via lien</button>
              </div>
              {supplyComposer.mode === "url" ? (
                <label className="supply-composer-field full"><span>Lien produit</span><input value={supplyComposer.sourceUrl} onChange={(event) => setSupplyComposerField("sourceUrl", event.target.value)} placeholder="https://..." /></label>
              ) : null}
              <label className="supply-composer-field full"><span>Nom</span><input value={supplyComposer.name} onChange={(event) => setSupplyComposerField("name", event.target.value)} placeholder="Nom de la fourniture" /></label>
              <div className="supply-composer-grid">
                <label className="supply-composer-field"><span>Categorie</span><input value={supplyComposer.category} onChange={(event) => setSupplyComposerField("category", event.target.value)} /></label>
                <label className="supply-composer-field"><span>Fournisseur</span><input value={supplyComposer.supplierName} onChange={(event) => setSupplyComposerField("supplierName", event.target.value)} /></label>
                <label className="supply-composer-field"><span>Quantite</span><input type="number" min="0" step="0.01" value={supplyComposer.quantity} onChange={(event) => setSupplyComposerField("quantity", event.target.value)} /></label>
                <label className="supply-composer-field"><span>Prix HT</span><input type="number" min="0" step="0.01" value={supplyComposer.unitPrice} onChange={(event) => setSupplyComposerField("unitPrice", event.target.value)} placeholder="Auto si lien" /></label>
              </div>
              {supplyComposer.error ? <p className="profile-message error">{supplyComposer.error}</p> : null}
              <div className="supply-modal-actions">
                <button type="button" onClick={closeSupplyComposer}>Annuler</button>
                <button type="button" className="button blue" onClick={saveSupplyFromComposer} disabled={supplyComposer.loading}>{supplyComposer.loading ? "Import..." : "Ajouter"}</button>
              </div>
            </div>
          </div>
        ) : null}

        {ouvrageComposer.open ? (
          <div className="modal-overlay" role="dialog" aria-modal="true" onClick={closeOuvrageComposer}>
            <div className="mini-modal supply-composer-modal" onClick={(event) => event.stopPropagation()}>
              <h2>Créer une ouvrage</h2>
              <label className="supply-composer-field full">
                <span>Désignation</span>
                <input
                  value={ouvrageComposer.label}
                  onChange={(event) => setOuvrageComposerField("label", event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); submitOuvrageComposer(); } }}
                  placeholder="Ex: Pose de carrelage, Peinture murs..."
                  autoFocus
                />
              </label>
              {roomGroups.filter((r) => r !== "Services").length > 0 ? (
                <label className="supply-composer-field full">
                  <span>Pièce</span>
                  <select value={ouvrageComposer.room} onChange={(event) => setOuvrageComposerField("room", event.target.value)}>
                    <option value="Services">— Sans pièce —</option>
                    {roomGroups.filter((r) => r !== "Services").map((roomOption) => <option key={roomOption} value={roomOption}>{roomOption}</option>)}
                  </select>
                </label>
              ) : null}
              {ouvrageComposer.error ? <p className="profile-message error">{ouvrageComposer.error}</p> : null}
              <div className="supply-modal-actions">
                <button type="button" onClick={closeOuvrageComposer}>Annuler</button>
                <button type="button" className="button blue" onClick={submitOuvrageComposer}>Ajouter au devis</button>
              </div>
            </div>
          </div>
        ) : null}

        {noteComposer.open ? (
          <div className="modal-overlay" role="dialog" aria-modal="true" onClick={closeNoteComposer}>
            <div className="mini-modal supply-composer-modal" onClick={(event) => event.stopPropagation()}>
              <h2>Ajouter une note</h2>
              <div className="supply-composer-tabs">
                <button type="button" className={noteComposer.type === "message" ? "active" : ""} onClick={() => setNoteComposerField("type", "message")}>Message</button>
                <button type="button" className={noteComposer.type === "photo" ? "active" : ""} onClick={() => setNoteComposerField("type", "photo")}>Photo</button>
                <button type="button" className={noteComposer.type === "attachment" ? "active" : ""} onClick={() => setNoteComposerField("type", "attachment")}>Pièce jointe</button>
              </div>
              <label className="supply-composer-field full">
                <span>Message</span>
                <textarea
                  className="note-composer-textarea"
                  value={noteComposer.message}
                  onChange={(event) => setNoteComposerField("message", event.target.value)}
                  placeholder="Votre note..."
                  rows={3}
                />
              </label>
              {noteComposer.type === "photo" ? (
                <label className="supply-composer-field full">
                  <span>Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (e) => setNoteComposerField("photoDataUrl", e.target.result);
                      reader.readAsDataURL(file);
                      setNoteComposerField("fileName", file.name);
                    }}
                  />
                  {noteComposer.photoDataUrl ? <img src={noteComposer.photoDataUrl} alt="Aperçu" className="room-note-photo" /> : null}
                </label>
              ) : noteComposer.type === "attachment" ? (
                <label className="supply-composer-field full">
                  <span>Pièce jointe</span>
                  <input
                    type="file"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) setNoteComposerField("fileName", file.name);
                    }}
                  />
                  {noteComposer.fileName ? <span className="room-note-file">{noteComposer.fileName}</span> : null}
                </label>
              ) : null}
              {noteComposer.error ? <p className="profile-message error">{noteComposer.error}</p> : null}
              <div className="supply-modal-actions">
                <button type="button" onClick={closeNoteComposer}>Annuler</button>
                <button type="button" className="button blue" onClick={submitNoteComposer}>Ajouter</button>
              </div>
            </div>
          </div>
        ) : null}
      </form>
    </Shell>
  );
}
