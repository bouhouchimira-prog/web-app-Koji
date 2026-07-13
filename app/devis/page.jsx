"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiGet, apiSend } from "../../lib/client-api";
import { clearChantierDraft, getChantierDraft } from "../../lib/chantier-draft";
import { pricingProfile } from "../../lib/data";
import { calculateTaskPrice } from "../../lib/pricing";
import { useLocale } from "../../lib/i18n";
import { useApi } from "../../lib/use-api";
import catalog from "../../data/catalog-ouvrages.json";

const ROOM_SUGGESTIONS = ["Salon", "Cuisine", "Chambre", "Salle de bain", "Bureau", "Exterieur"];

const CUSTOM_OUVRAGE_UNITS = ["u", "m²", "ml", "m³", "h"];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function editQuoteIdFromUrl() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("id") || "";
}

function nextQuoteNumberFromList(quotes) {
  const year = new Date().getFullYear();
  const maxSeq = (quotes || []).reduce((max, q) => {
    const match = (q.quoteNumber || "").match(/_(\d+)$/);
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 1048);
  return `${year}_${String(maxSeq + 1).padStart(4, "0")}`;
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
    unit: settings.unit ?? source.unit ?? "u",
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
  const lineVatRate = Number(pricingProfile.vatRate || 0.2);
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
  const laborCost = isFixed ? fixedAmountHt : round2(Number(line.laborCost || 0));
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
  const vatRate = Number(pricingProfile.vatRate || 0.2);
  let totalHt = 0;
  if (billingMode === "fixed") {
    totalHt = round2(Number(subItem.fixedAmountInput || 0));
  } else {
    const totalHtBase = Number(subItem.quantity || 0) * Number(subItem.normativeTime || 0) * Number(subItem.hourlyRate || parentLine.hourlyRate || 0);
    const adjustmentPercent = Math.max(0, Number(subItem.adjustmentPercent || 0));
    const discountPercent = Math.max(0, Number(subItem.discountPercent || 0));
    const totalHtAfterAdjustment = totalHtBase + totalHtBase * (adjustmentPercent / 100);
    const discountAmount = totalHtAfterAdjustment * (discountPercent / 100);
    totalHt = round2(Math.max(0, totalHtAfterAdjustment - discountAmount));
  }
  const vatAmount = round2(totalHt * vatRate);
  return { ...subItem, totalHt, totalTtc: round2(totalHt + vatAmount), vatAmount, vatRate };
}

export default function QuotesPage() {
  const { L } = useLocale();
  const router = useRouter();
  const { data: quotes, setData: setQuotes, loading: quotesLoading } = useApi("/api/quotes", "quotes");
  const { data: projects, setData: setProjects } = useApi("/api/projects", "projects");
  const { data: supplies, setData: setSupplies } = useApi("/api/supplies", "supplies");
  const { data: ouvrages } = useApi("/api/ouvrages", "ouvrages", catalog);
  const { data: clients, setData: setClients } = useApi("/api/clients", "clients");

  const postes = useMemo(() => ouvrages.filter((item) => item.type === "POSTE" || item.type === "SOUS-POSTE"), [ouvrages]);
  const [company, setCompany] = useState(profileCompany(null));
  const [selectedIds, setSelectedIds] = useState([]);
  const [lineSettings, setLineSettings] = useState({});
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [generatedQuote, setGeneratedQuote] = useState(null);
  const [savedLineId, setSavedLineId] = useState(null);
  const [confirmDeleteLineId, setConfirmDeleteLineId] = useState(null);
  const [confirmDeleteSubId, setConfirmDeleteSubId] = useState(null);
  const [clientMessage, setClientMessage] = useState("");
  const [openRooms, setOpenRooms] = useState(() => new Set());
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingClient, setSavingClient] = useState(false);
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
    workDescription: "",
    validityDays: 30
  });
  const [rooms, setRooms] = useState([]);
  const [roomNotes, setRoomNotes] = useState([]);
  const [customRoom, setCustomRoom] = useState("");
  const [isNewChantier, setIsNewChantier] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
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
    if (editQuoteIdFromUrl()) return;
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
    if (editQuoteIdFromUrl()) return;
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
        if (draft.userId && currentUserId && draft.userId !== currentUserId) {
          // Draft belongs to a different, identified user — discard it
          window.localStorage.removeItem("koji-devis-draft");
        } else {
          if (Array.isArray(draft.customSources) && draft.customSources.length) setCustomSources(draft.customSources);
          if (draft.lineSettings && Object.keys(draft.lineSettings).length) setLineSettings(draft.lineSettings);
          if (Array.isArray(draft.roomNotes) && draft.roomNotes.length) setRoomNotes(draft.roomNotes);
          if (Array.isArray(draft.rooms) && draft.rooms.length) setRooms(draft.rooms);
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
    if (editQuoteIdFromUrl()) return;
    const hasContent = selectedIds.length || customSources.length ||
      Object.keys(lineSettings).length || roomNotes.length || rooms.length || generatedQuote?.id;
    if (!hasContent) return;
    let currentUserId = "";
    try { currentUserId = JSON.parse(window.localStorage.getItem("koji-user") || "null")?.id || ""; } catch { /**/ }
    window.localStorage.setItem("koji-devis-draft", JSON.stringify({
      userId: currentUserId,
      selectedIds,
      customSources,
      lineSettings,
      roomNotes,
      rooms,
      surcharges,
      quoteVatRate,
      vatManual,
      draftQuoteNumber,
      form,
      generatedQuote: generatedQuote || null
    }));
  }, [selectedIds, customSources, lineSettings, roomNotes, rooms, surcharges, quoteVatRate, vatManual, draftQuoteNumber, generatedQuote, form]);

  // Freeze the preview number once quotes are loaded; only regenerate on "Nouveau devis"
  useEffect(() => {
    if (editQuoteIdFromUrl()) return;
    if (draftQuoteNumber || generatedQuote?.quoteNumber) return;
    if (quotesLoading) return;
    setDraftQuoteNumber(nextQuoteNumberFromList(quotes));
  }, [quotes, quotesLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore an existing quote (opened via /devis?id=...) with everything that was noted on it
  const restoredEditQuoteRef = useRef(false);
  useEffect(() => {
    const editId = editQuoteIdFromUrl();
    if (!editId || quotesLoading || restoredEditQuoteRef.current) return;
    const quote = quotes.find((item) => item.id === editId);
    if (!quote) return;
    restoredEditQuoteRef.current = true;

    const items = Array.isArray(quote.items) ? quote.items : [];
    const nextCustomSources = items.map((item) => ({
      id: item.id,
      code: item.code || "",
      label: item.label || "Ouvrage",
      unit: item.unit || "u",
      normativeTime: Number(item.normativeTime || 0),
      materialCategories: Array.from(new Set((item.materialLines || []).map((material) => material.category).filter(Boolean)))
    }));
    const nextLineSettings = {};
    items.forEach((item) => {
      nextLineSettings[item.id] = {
        room: item.room || "Services",
        quantity: item.quantity ?? 0,
        normativeTime: item.normativeTime,
        billingMode: item.billingMode || "time",
        fixedAmountInput: item.fixedAmountInput ?? item.fixedAmountHt ?? "",
        fixedAmountMode: item.fixedAmountMode || "ht",
        adjustmentPercent: item.adjustmentPercent || 0,
        discountPercent: item.discountPercent || 0,
        adjustmentReason: item.adjustmentReason || "",
        hourlyRate: item.hourlyRate,
        showMaterialsToClient: item.showMaterialsToClient !== false,
        fixedDuration: item.fixedDuration ?? null,
        fixedDurationUnit: item.fixedDurationUnit || "h",
        subItems: Array.isArray(item.subItems) ? item.subItems : undefined
      };
    });

    setSelectedIds([]);
    setCustomSources(nextCustomSources);
    setLineSettings(nextLineSettings);
    setRooms(Array.isArray(quote.rooms) ? quote.rooms : []);
    setRoomNotes(Array.isArray(quote.notes) ? quote.notes : []);
    if (Array.isArray(quote.surcharges)) setSurcharges(quote.surcharges);
    if (quote.vatRate != null) setQuoteVatRate(Number(quote.vatRate));
    setVatManual(true);
    setDraftQuoteNumber(quote.quoteNumber || null);
    setForm((current) => ({
      ...current,
      client: quote.client || "",
      clientEmail: quote.clientEmail || "",
      clientPhone: quote.clientPhone || "",
      projectId: quote.projectId || "",
      project: quote.project || "",
      chantierAddress: quote.chantierAddress || "",
      quoteDate: quote.quoteDate || (quote.createdAt || "").slice(0, 10) || todayIso(),
      startDate: quote.startDate || "",
      expectedDuration: quote.expectedDuration || "",
      workDescription: quote.workDescription || "",
      validityDays: quote.validityDays || 30
    }));
    if (quote.company) setCompany((current) => ({ ...current, ...quote.company }));
    setGeneratedQuote(quote);
  }, [quotes, quotesLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Autosave: once a quote exists, further edits are persisted automatically -
  // no need to keep pressing the "Enregistrer" buttons for each change to stick.
  const autosaveTimerRef = useRef(null);
  const autosaveReadyRef = useRef(false);
  useEffect(() => {
    if (!generatedQuote?.id) return;
    if (!autosaveReadyRef.current) {
      // Skip the run that fires right when a quote is loaded/restored.
      autosaveReadyRef.current = true;
      return;
    }
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      persistQuote(false).catch(() => {});
    }, 1200);
    return () => clearTimeout(autosaveTimerRef.current);
  }, [form, rooms, roomNotes, surcharges, quoteVatRate, customSources, lineSettings]); // eslint-disable-line react-hooks/exhaustive-deps

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

  function scrollToRoom(room) {
    if (typeof window === "undefined") return;
    setOpenRooms((current) => new Set(current).add(room));
    requestAnimationFrame(() => {
      const el = document.getElementById(`lot-section-${encodeURIComponent(room)}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function toggleRoomOpen(room) {
    setOpenRooms((current) => {
      const next = new Set(current);
      if (next.has(room)) next.delete(room);
      else next.add(room);
      return next;
    });
  }

  function renameRoom(oldName, newName) {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    setRooms((prev) => prev.map((r) => r === oldName ? trimmed : r));
    setLineSettings((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((id) => {
        if (next[id].room === oldName) next[id] = { ...next[id], room: trimmed };
      });
      return next;
    });
    setRoomNotes((prev) => prev.map((note) => note.room === oldName ? { ...note, room: trimmed } : note));
    setGeneratedQuote(null);
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
    if (project) syncClientRefFromProject(project.client, project.clientEmail);
  }

  function selectClientRef(value) {
    setSelectedClientId(value);
    if (!value || value === "nouveau") return;
    const client = clients.find((c) => c.id === value);
    if (!client) return;
    setForm((current) => ({
      ...current,
      client: client.name || current.client,
      clientEmail: client.email || current.clientEmail,
      clientPhone: client.phone || current.clientPhone,
    }));
  }

  function syncClientRefFromProject(projectClient, projectEmail) {
    if (!projectClient) return;
    const match = clients.find(
      (c) => c.name === projectClient || c.email === projectEmail
    );
    setSelectedClientId(match ? match.id : "");
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
        [parentId]: { ...settings, subItems: [...subItems, { id: `sub-${Date.now()}`, label: "", billingMode: "time", fixedAmountInput: "", fixedAmountMode: "ht", vatRate: "" }] }
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

  function cycleSurchargeMode(id, current) {
    const order = ["excluded", "internal", "client"];
    const next = order[(order.indexOf(current) + 1) % order.length];
    updateSurcharge(id, "mode", next);
  }

  function notify(text, type = "info") {
    setMessage(text);
    setMessageType(type);
  }

  function notifyError(error, fallback) {
    notify(error?.message || fallback, "error");
    if (error?.upgradeRequired) {
      window.setTimeout(() => router.push("/abonnement"), 2200);
    }
  }

  async function saveCompanyProfile() {
    if (typeof window === "undefined") return;
    setSavingCompany(true);
    try {
      let localUser = null;
      try { localUser = JSON.parse(window.localStorage.getItem("koji-user") || "null"); } catch { /**/ }
      const payload = {
        userId: localUser?.id,
        name: localUser?.name || company.name,
        email: localUser?.email || company.email,
        accountType: localUser?.accountType || "entreprise",
        business: {
          raisonSociale: company.name,
          addressLine1: company.address,
          emailPro: company.email,
          phone: company.phone,
          siret: company.siret,
          tva: company.tva,
          logoDataUrl: company.logoDataUrl
        }
      };
      const response = await apiSend("/api/auth/profile", payload, "PATCH");
      window.localStorage.setItem("koji-user", JSON.stringify(response.user));
      notify("Informations entreprise enregistrées.", "success");
    } catch (error) {
      notify(error.message || "Impossible d'enregistrer les informations.", "error");
    } finally {
      setSavingCompany(false);
    }
  }

  async function saveClientInfo() {
    setSavingClient(true);
    try {
      // Sauvegarder comme nouvelle référence client si applicable
      if (selectedClientId === "nouveau" && form.client.trim()) {
        const { client: saved } = await apiSend("/api/clients", {
          name: form.client.trim(),
          email: form.clientEmail.trim(),
          phone: form.clientPhone.trim(),
        }, "POST");
        setClients((prev) => [saved, ...prev]);
        setSelectedClientId(saved.id);
      }
      await persistQuote();
      notify("Informations client et chantier enregistrées.", "success");
    } catch (error) {
      notifyError(error, "Impossible d'enregistrer les informations.");
    } finally {
      setSavingClient(false);
    }
  }

  function requireLines() {
    if (quoteLines.length) return true;
    notify("Ajoutez au moins un ouvrage ou une fourniture avant de continuer.", "error");
    return false;
  }

  async function persistQuote(manual = true) {
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
      workDescription: form.workDescription,
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
      ? await apiSend("/api/quotes", { id: generatedQuote.id, action: "update", manualSave: manual, ...payload }, "PATCH")
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

  async function saveLineDraft(lineId) {
    setSavedLineId(`saving-${lineId}`);
    try {
      await persistQuote();
      setSavedLineId(`saved-${lineId}`);
      setTimeout(() => setSavedLineId(null), 2000);
    } catch {
      setSavedLineId(null);
    }
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
      const quote = await sendQuoteToSignature(generatedQuote.id);
      // Always re-sync the message with the freshly generated access -
      // a stale message with the previous password would no longer work to log in.
      setClientMessage(signatureShareText(quote.signatureClientAccess));
      notify("Le devis a été envoyé vers Kôji Signature. Les accès provisoires client sont prêts.", "success");
    } catch (error) {
      notifyError(error, "Impossible d'envoyer le devis vers Kôji Signature.");
    }
  }

  async function handleDownload(type, format) {
    try {
      const quote = await persistQuote();
      window.open(`/api/quotes/${quote.id}/documents?type=${type}&format=${format}`, "_blank");
    } catch (error) {
      notifyError(error, "Impossible de générer le document.");
    }
  }

  async function handlePreview(type = "quote") {
    if (!requireLines()) return;
    try {
      const quote = await persistQuote();
      window.open(`/api/quotes/${quote.id}/documents?type=${type}&format=pdf&preview=1`, "_blank");
      notify("Aperçu ouvert dans un nouvel onglet.", "success");
    } catch (error) {
      notifyError(error, "Impossible de générer l'aperçu.");
    }
  }

  async function handleGenerate() {
    if (!requireLines()) return;
    try {
      const quote = await persistQuote();
      notify(`Devis ${quote.quoteNumber} généré. Les documents sont prêts.`, "success");
    } catch (error) {
      notifyError(error, "Impossible de générer le devis.");
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
      notifyError(error, "Impossible de confirmer le devis.");
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
      notifyError(error, "Impossible d'envoyer le devis au client.");
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
    setDraftQuoteNumber(nextQuoteNumberFromList(quotes));
    setForm({ client: "", clientEmail: "", clientPhone: "", projectId: "", project: "", propertyType: "Maison", chantierAddress: "", quoteDate: todayIso(), startDate: "", expectedDuration: "", workDescription: "", validityDays: 30 });
    setIsNewChantier(false);
    setSelectedClientId("");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("koji-devis-ouvrages");
      window.localStorage.removeItem("koji-devis-draft");
      window.localStorage.removeItem("koji-devis-target-room");
    }
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

  const signatureText = clientMessage || signatureShareText();
  const signatureEmail = signatureDelivery?.email || form.clientEmail || generatedQuote?.clientEmail || "";
  const signaturePhone = signatureDelivery?.phone || form.clientPhone || generatedQuote?.clientPhone || "";
  const signaturePhoneDigits = String(signaturePhone).replace(/[^\d]/g, "");
  const signatureMailHref = signatureDelivery
    ? `mailto:${encodeURIComponent(signatureEmail)}?subject=${encodeURIComponent(`Signature du devis ${generatedQuote?.quoteNumber || ""}`)}&body=${encodeURIComponent(signatureText)}`
    : "#";
  const signatureWhatsAppHref = signatureDelivery
    ? `https://wa.me/${signaturePhoneDigits || ""}?text=${encodeURIComponent(signatureText)}`
    : "#";

  useEffect(() => {
    if (signatureDelivery && !clientMessage) {
      setClientMessage(signatureShareText());
    }
  }, [signatureDelivery]); // eslint-disable-line react-hooks/exhaustive-deps

  function renderLineCard(line) {
    const settings = lineSettings[line.id] || {};
    const subItems = Array.isArray(line.subItems) ? line.subItems : [];
    const hasSubItems = subItems.length > 0;
    return (
      <article key={line.id} className={`quote-final-line${hasSubItems ? " has-sub-items" : ""}`}>
        <header>
          <input className="quote-line-label-input quote-line-label-input-header" value={settings.label ?? line.label ?? ""} onChange={(event) => updateLineLabel(line.id, event.target.value)} placeholder={L.devis.designation} />
        </header>
        {!hasSubItems ? (
          <>
            <div className="quote-mode-row">
              <button type="button" className={line.billingMode !== "fixed" ? "active" : ""} onClick={() => updateLine(line.id, "billingMode", "time")}>{L.devis.realTime}</button>
              <button type="button" className={line.billingMode === "fixed" ? "active" : ""} onClick={() => updateLine(line.id, "billingMode", "fixed")}>{L.devis.forfait}</button>
              <label>{L.devis.room}<select value={line.room} onChange={(event) => updateLine(line.id, "room", event.target.value)}>
                <option value="Services">{L.devis.noRoom}</option>
                {roomGroups.filter((r) => r !== "Services").map((roomOption) => <option key={roomOption} value={roomOption}>{roomOption}</option>)}
              </select></label>
            </div>
            <div className={`quote-line-inputs compact ${line.billingMode === "fixed" ? "fixed-only main-fixed" : ""}`}>
              {line.billingMode === "fixed" ? (
                <>
                  <label className="forfait-amount-field">{L.devis.fixedAmount}<input type="number" min="0" step="0.01" value={settings.fixedAmountInput ?? line.fixedAmountInput ?? ""} onChange={(event) => updateLine(line.id, "fixedAmountInput", event.target.value)} /></label>
                  <label>{L.devis.duration}<input type="number" min="0" step="any" value={settings.fixedDuration ?? ""} onChange={(event) => updateLine(line.id, "fixedDuration", event.target.value)} placeholder="0" /></label>
                  <label>{L.bibliotheque.unit}<select value={settings.fixedDurationUnit ?? "h"} onChange={(event) => updateLine(line.id, "fixedDurationUnit", event.target.value)}>
                    <option value="h">{L.devis.hours}</option>
                    <option value="j">Jours</option>
                  </select></label>
                </>
              ) : (
                <>
                  <label>{L.devis.quantity}<input type="number" min="0" step="any" value={settings.quantity ?? ""} onChange={(event) => updateLine(line.id, "quantity", event.target.value)} placeholder="0" /></label>
                  <label>{L.bibliotheque.unit}<select value={settings.unit ?? line.unit ?? "u"} onChange={(event) => updateLine(line.id, "unit", event.target.value)}>
                    <option value="u">U</option>
                    <option value="m">M</option>
                    <option value="m2">M²</option>
                    <option value="l">L</option>
                    <option value="pce">Pièce</option>
                    <option value="ens">Ens</option>
                    <option value="forfait">Forfait</option>
                    <option value="ml">ML</option>
                    <option value="autre">Autre</option>
                  </select></label>
                  <label>{L.bibliotheque.time} h/{settings.unit ?? line.unit ?? "u"}<input type="number" min="0" step="any" value={settings.normativeTime ?? (line.normativeTime > 0 ? line.normativeTime : "")} onChange={(event) => updateLine(line.id, "normativeTime", event.target.value)} placeholder="0" /></label>
                  <label>{L.devis.hourlyRate}<input type="number" min="0" step="any" value={settings.hourlyRate ?? (company.hourlyRate > 0 ? company.hourlyRate : "")} onChange={(event) => updateLine(line.id, "hourlyRate", event.target.value)} placeholder={company.hourlyRate > 0 ? String(company.hourlyRate) : "0"} /></label>
                  <label>{L.devis.adjustment}<input type="number" min="0" step="0.5" value={line.adjustmentPercent || ""} onChange={(event) => updateLine(line.id, "adjustmentPercent", event.target.value)} /></label>
                  <label>{L.devis.discountPct}<input type="number" min="0" step="0.5" value={line.discountPercent || ""} onChange={(event) => updateLine(line.id, "discountPercent", event.target.value)} /></label>
                </>
              )}
            </div>
            <div className="quote-line-breakdown">
              {line.billingMode === "fixed" ? (
                <>
                  {settings.fixedDuration ? <span>{L.devis.duration}: {settings.fixedDuration} {settings.fixedDurationUnit ?? "h"}</span> : null}
                  <span>{L.devis.forfait} {line.fixedAmountMode === "ttc" ? "TTC" : "HT"}: {money(line.fixedAmountMode === "ttc" ? line.totalTtc : line.totalHt)}</span>
                </>
              ) : (
                <>
                  <span>{L.devis.hours}: {Number(line.correctedTimeHours || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} h</span>
                  <span>{L.devis.labor}: {money(line.laborCost)}</span>
                  <span>{L.nav.fournitures}: {money(line.materialCost)}</span>
                </>
              )}
              <span>HT: {money(line.totalHt)}</span>
            </div>
            {(() => {
              const visibleMaterials = (line.materialLines || []).filter((m) => m.productId || m.productName || Number(m.unitPrice || 0) > 0);
              if (!visibleMaterials.length) return null;
              return (
                <div className="quote-line-supplies">
                  <div className="quote-line-supplies-head">
                    <span>{L.nav.fournitures}</span>
                  </div>
                  {visibleMaterials.map((material) => {
                    const linkedSupply = findSupplyForMaterial(supplies, material);
                    const originalIndex = (line.materialLines || []).indexOf(material);
                    return (
                      <div className="supply-card" key={`${line.id}-${material.productId || material.category}-${originalIndex}`}>
                        <div className={`supply-card-main ${linkedSupply ? "" : "needs-link"}`}>
                          <button type="button" className={linkedSupply ? "supply-open-button" : "supply-create-button"} onClick={() => openSupplyReference(line.id, originalIndex, material)}>{linkedSupply ? L.devis.openBtn : L.devis.createBtn}</button>
                          <input value={material.productName || material.category || ""} onChange={(e) => updateMaterial(line.id, originalIndex, "productName", e.target.value)} placeholder={L.devis.supplyDesig} />
                          <input type="number" min="0" step="0.01" value={material.unitsToBuy || ""} onChange={(e) => updateMaterial(line.id, originalIndex, "unitsToBuy", e.target.value)} placeholder="Qté" />
                          <strong>{money(material.total)}</strong>
                          <button type="button" className="supply-delete-btn" onClick={() => removeMaterial(line.id, originalIndex)} aria-label="Supprimer">×</button>
                        </div>
                        <div className="supply-card-extra">
                          <label className="supply-price-field">{L.devis.purchasePrice}
                            <div className="supply-price-input-group">
                              <input type="number" min="0" step="0.01" value={material.purchasePriceInput || ""} onChange={(e) => updateMaterial(line.id, originalIndex, "purchasePriceInput", e.target.value)} placeholder="0.00" />
                              <select className="supply-price-mode-select" value={material.purchasePriceMode || "ht"} onChange={(e) => updateMaterial(line.id, originalIndex, "purchasePriceMode", e.target.value)}>
                                <option value="ht">HT</option>
                                <option value="ttc">TTC</option>
                              </select>
                            </div>
                          </label>
                          <label className="supply-price-field">{L.devis.salePrice}
                            <div className="supply-price-input-group">
                              <input type="number" min="0" step="0.01" value={material.unitPrice || ""} onChange={(e) => updateMaterial(line.id, originalIndex, "unitPrice", e.target.value)} placeholder="0.00" />
                              <select className="supply-price-mode-select" value={material.salePriceMode || "ht"} onChange={(e) => updateMaterial(line.id, originalIndex, "salePriceMode", e.target.value)}>
                                <option value="ht">HT</option>
                                <option value="ttc">TTC</option>
                              </select>
                            </div>
                          </label>
                          <label className="supply-price-field">{L.devis.packaging}
                            <input value={material.packaging || ""} onChange={(e) => updateMaterial(line.id, originalIndex, "packaging", e.target.value)} placeholder="ex: Pot 5L, Boîte 12..." />
                          </label>
                          <label className="supply-price-field">{L.devis.linkedTo}
                            <select value={material.linkedTo || ""} onChange={(e) => updateMaterial(line.id, originalIndex, "linkedTo", e.target.value)}>
                              <option value="">{L.devis.thisWork}</option>
                              {subItems.map((sub) => <option key={sub.id} value={`sub:${sub.id}`}>{sub.label || L.devis.designation}</option>)}
                              {roomGroups.filter((r) => r !== "Services").map((room) => <option key={`room:${room}`} value={`room:${room}`}>{room}</option>)}
                              <option value="autre">Autre</option>
                            </select>
                          </label>
                          <div className="supply-card-actions">
                            <label className="material-visibility">
                              <input type="checkbox" checked={material.showInDevis !== false} onChange={(e) => updateMaterial(line.id, originalIndex, "showInDevis", e.target.checked)} />
                              {L.devis.showInQuote}
                            </label>
                            <button type="button" className="supply-link-button" onClick={() => openSupplyComposer(line.id, "url", originalIndex, material)}>{L.devis.viaLink}</button>
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
            <span>{L.devis.subWorks(subItems.length)}</span>
            <span>HT total : {money(line.totalHt)}</span>
          </div>
        )}
        <div className="quote-sub-items">
          {subItems.map((sub) => (
            <article key={sub.id} className="quote-sub-item-card">
              <header className="quote-sub-item-header">
                <input className="quote-line-label-input quote-line-label-input-header" value={sub.label || ""} onChange={(e) => updateSubItem(line.id, sub.id, "label", e.target.value)} placeholder={L.devis.designation} />
                <b>{money(sub.totalHt)} HT</b>
              </header>
              <div className="quote-mode-row">
                <button type="button" className={sub.billingMode !== "fixed" ? "active" : ""} onClick={() => updateSubItem(line.id, sub.id, "billingMode", "time")}>{L.devis.realTime}</button>
                <button type="button" className={sub.billingMode === "fixed" ? "active" : ""} onClick={() => updateSubItem(line.id, sub.id, "billingMode", "fixed")}>{L.devis.forfait}</button>
              </div>
              <div className={`quote-line-inputs compact ${sub.billingMode === "fixed" ? "fixed-only main-fixed" : ""}`}>
                {sub.billingMode === "fixed" ? (
                  <>
                    <label className="forfait-amount-field">{L.devis.fixedAmount}<input type="number" min="0" step="0.01" value={sub.fixedAmountInput || ""} onChange={(e) => updateSubItem(line.id, sub.id, "fixedAmountInput", e.target.value)} /></label>
                    <label>{L.devis.duration}<input type="number" min="0" step="any" value={sub.fixedDuration ?? ""} onChange={(e) => updateSubItem(line.id, sub.id, "fixedDuration", e.target.value)} placeholder="0" /></label>
                    <label>{L.bibliotheque.unit}<select value={sub.fixedDurationUnit ?? "h"} onChange={(e) => updateSubItem(line.id, sub.id, "fixedDurationUnit", e.target.value)}>
                      <option value="h">{L.devis.hours}</option>
                      <option value="j">Jours</option>
                    </select></label>
                  </>
                ) : (
                  <>
                    <label>{L.devis.quantity}<input type="number" min="0" step="any" value={sub.quantity || ""} onChange={(e) => updateSubItem(line.id, sub.id, "quantity", e.target.value)} placeholder="0" /></label>
                    <label>{L.bibliotheque.unit}<select value={sub.unit || "u"} onChange={(e) => updateSubItem(line.id, sub.id, "unit", e.target.value)}>
                      <option value="u">U</option>
                      <option value="m">M</option>
                      <option value="m2">M²</option>
                      <option value="l">L</option>
                      <option value="pce">Pièce</option>
                      <option value="ens">Ens</option>
                      <option value="forfait">Forfait</option>
                      <option value="ml">ML</option>
                      <option value="autre">Autre</option>
                    </select></label>
                    <label>{L.bibliotheque.time} h/{sub.unit || "u"}<input type="number" min="0" step="any" value={sub.normativeTime || ""} onChange={(e) => updateSubItem(line.id, sub.id, "normativeTime", e.target.value)} placeholder="0" /></label>
                    <label>{L.devis.hourlyRate}<input type="number" min="0" step="any" value={sub.hourlyRate || line.hourlyRate || (company.hourlyRate > 0 ? company.hourlyRate : "")} onChange={(e) => updateSubItem(line.id, sub.id, "hourlyRate", e.target.value)} placeholder={String(company.hourlyRate || "0")} /></label>
                    <label>{L.devis.adjustment}<input type="number" min="0" step="0.5" value={sub.adjustmentPercent || ""} onChange={(e) => updateSubItem(line.id, sub.id, "adjustmentPercent", e.target.value)} /></label>
                    <label>{L.devis.discountPct}<input type="number" min="0" step="0.5" value={sub.discountPercent || ""} onChange={(e) => updateSubItem(line.id, sub.id, "discountPercent", e.target.value)} /></label>
                  </>
                )}
              </div>
              <div className="quote-line-breakdown">
                {sub.billingMode === "fixed" ? (
                  <>
                    {sub.fixedDuration ? <span>{L.devis.duration}: {sub.fixedDuration} {sub.fixedDurationUnit ?? "h"}</span> : null}
                    <span>{L.devis.forfait} HT : {money(sub.totalHt)}</span>
                  </>
                ) : (
                  <span>{Number(sub.quantity || 0)} {sub.unit || "u"} × {Number(sub.normativeTime || 0)} h × {money(sub.hourlyRate || line.hourlyRate || 0)}/h</span>
                )}
                <span>HT : {money(sub.totalHt)}</span>
              </div>
              <div className="quote-sub-item-delete-bar">
                {confirmDeleteSubId === sub.id ? (
                  <span className="quote-line-confirm-delete">
                    <span>{L.devis.deleteSubWork}</span>
                    <button type="button" className="quote-line-confirm-yes" onClick={() => removeSubItem(line.id, sub.id)}>{L.devis.yesDelete}</button>
                    <button type="button" className="quote-line-confirm-no" onClick={() => setConfirmDeleteSubId(null)}>{L.common.cancel}</button>
                  </span>
                ) : (
                  <button type="button" className="quote-line-delete-btn" onClick={() => setConfirmDeleteSubId(sub.id)}>{L.common.delete}</button>
                )}
              </div>
            </article>
          ))}
          <button type="button" className="quote-sub-add-btn" onClick={() => addSubItem(line.id)}>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" d="M12 5v14M5 12h14" /></svg>
            {L.devis.addSubWork}
          </button>
        </div>
        <div className="quote-line-save-bar">
          {confirmDeleteLineId === line.id ? (
            <span className="quote-line-confirm-delete">
              <span>{L.devis.deleteWork}</span>
              <button type="button" className="quote-line-confirm-yes" onClick={() => removeQuoteLine(line.id)}>{L.devis.yesDelete}</button>
              <button type="button" className="quote-line-confirm-no" onClick={() => setConfirmDeleteLineId(null)}>{L.common.cancel}</button>
            </span>
          ) : (
            <>
              <button type="button" className="quote-line-delete-btn" onClick={() => setConfirmDeleteLineId(line.id)}>{L.common.delete}</button>
              <button
                type="button"
                className={`quote-line-save-btn${savedLineId === `saving-${line.id}` ? " saving" : ""}${savedLineId === `saved-${line.id}` ? " saved" : ""}`}
                onClick={() => saveLineDraft(line.id)}
              >
                {savedLineId === `saving-${line.id}` ? L.devis.saving : savedLineId === `saved-${line.id}` ? L.devis.saved : L.devis.save}
              </button>
            </>
          )}
        </div>
      </article>
    );
  }

  return (
    <Shell>
      <header className="page-header quote-final-header quote-final-header-centered">
        <div className="quote-final-header-title">
          <p className="eyebrow">{L.devis.title}</p>
          <h1>{L.devis.generate}</h1>
        </div>
        <div className="quote-final-actions">
          <Link className="button secondary" href="/signature">{L.devis.mySignature}</Link>
        </div>
      </header>

      <form className="quote-final-page" onSubmit={(event) => event.preventDefault()}>
        <div className="quote-meta-bar">
          <div className="quote-meta-number">
            <span>{L.devis.quoteNum} : {previewQuoteNumber}</span>
            <span className="quote-meta-version">{L.devis.versionNum} : {previewVersionNumber}</span>
          </div>
          <button type="button" className={`quote-meta-toggle ${identityOpen ? "open" : ""}`} onClick={() => setIdentityOpen((open) => !open)} aria-expanded={identityOpen} aria-label={identityOpen ? "Réduire les informations" : "Afficher les informations"}>
            <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" /></svg>
          </button>
        </div>

        {identityOpen ? (
          <section className="quote-identity-grid">
            <article className="quote-identity-card quote-identity-card-editable">
              {company.logoDataUrl ? (
                <img src={company.logoDataUrl} alt="Logo entreprise" className="koji-mini-logo koji-mini-logo-img" />
              ) : (
                <div className="koji-mini-logo">{(company.name || "KJ").slice(0, 2).toUpperCase()}</div>
              )}
              <div className="quote-identity-fields">
                <span>{L.devis.companySection}</span>
                <div className="quote-client-grid quote-company-grid">
                  <label>{L.devis.companyName}<input value={company.name} onChange={(event) => setCompanyField("name", event.target.value)} placeholder={L.devis.companyName} /></label>
                  <label className="wide">{L.devis.address}<input value={company.address} onChange={(event) => setCompanyField("address", event.target.value)} placeholder={L.devis.address} /></label>
                  <label>{L.devis.clientEmail}<input type="email" value={company.email} onChange={(event) => setCompanyField("email", event.target.value)} placeholder="contact@entreprise.fr" /></label>
                  <label>{L.parametres.phone}<input value={company.phone} onChange={(event) => setCompanyField("phone", event.target.value)} placeholder="+33..." /></label>
                  <label>{L.parametres.siret}<input value={company.siret} onChange={(event) => setCompanyField("siret", event.target.value)} placeholder="12345678901234" /></label>
                  <label>{L.parametres.tva}<input value={company.tva} onChange={(event) => setCompanyField("tva", event.target.value)} placeholder="FR..." /></label>
                </div>
                <div className="quote-identity-card-save">
                  <button
                    type="button"
                    className={`quote-identity-save-btn${savingCompany ? " saving" : ""}`}
                    onClick={saveCompanyProfile}
                  >
                    {savingCompany ? L.devis.saving : L.devis.save}
                  </button>
                </div>
              </div>
            </article>

            <article className="quote-identity-card">
              <div>
                <span>{L.devis.clientSite}</span>
                <div className="quote-client-grid">

                  {/* Référence client */}
                  <label className="wide client-ref-label">
                    {L.devis.clientRef}
                    <div className="client-ref-row">
                      <select
                        className="client-ref-select"
                        value={selectedClientId}
                        onChange={(e) => selectClientRef(e.target.value)}
                      >
                        <option value="">{L.devis.chooseRef}</option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}{c.email ? ` · ${c.email}` : ""}{c.phone ? ` · ${c.phone}` : ""}
                          </option>
                        ))}
                        <option value="nouveau">{L.devis.newRef}</option>
                      </select>
                      {selectedClientId && selectedClientId !== "nouveau" ? (
                        <button
                          type="button"
                          className="client-ref-clear"
                          title="Désélectionner"
                          onClick={() => setSelectedClientId("")}
                        >
                          ✕
                        </button>
                      ) : null}
                    </div>
                    {selectedClientId === "nouveau" ? (
                      <p className="client-ref-hint">
                        {L.devis.newRefHint}
                      </p>
                    ) : selectedClientId ? (
                      <p className="client-ref-hint client-ref-hint--linked">
                        {L.devis.linkedRef}
                      </p>
                    ) : null}
                  </label>

                  <label>{L.devis.client}<input value={form.client} onChange={(event) => setField("client", event.target.value)} placeholder={L.devis.client} /></label>
                  <label>{L.devis.clientEmail}<input type="email" value={form.clientEmail} onChange={(event) => setField("clientEmail", event.target.value)} placeholder="client@email.fr" /></label>
                  <label>{L.devis.clientPhone}<input value={form.clientPhone} onChange={(event) => setField("clientPhone", event.target.value)} placeholder="06 12 34 56 78" /></label>
                  <label>{L.devis.project}<select value={isNewChantier && !form.projectId ? "nouveau" : form.projectId} onChange={(event) => {
                    if (event.target.value === "nouveau") {
                      setForm((current) => ({ ...current, projectId: "", project: "", client: current.client, clientEmail: current.clientEmail, clientPhone: current.clientPhone, chantierAddress: "" }));
                      setIsNewChantier(true);
                    } else {
                      setIsNewChantier(false);
                      selectProject(event.target.value);
                    }
                  }}>
                    <option value="">{L.devis.chooseSite}</option>
                    {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
                    <option value="nouveau">{L.devis.newSite}</option>
                  </select></label>
                  {isNewChantier && !form.projectId ? (
                    <label>{L.devis.siteName}<input value={form.project} onChange={(event) => setField("project", event.target.value)} placeholder={L.devis.siteName} autoFocus /></label>
                  ) : null}
                  <label className="wide">{L.devis.clientAddress}<input value={form.chantierAddress} onChange={(event) => setField("chantierAddress", event.target.value)} placeholder={L.devis.clientAddress} /></label>
                  <label>{L.devis.creationDate}<input type="date" value={form.quoteDate} onChange={(event) => setField("quoteDate", event.target.value)} /></label>
                  <label>{L.devis.startDate}<input type="date" value={form.startDate} onChange={(event) => setField("startDate", event.target.value)} /></label>
                  <label>{L.devis.expectedDur}<input value={form.expectedDuration} onChange={(event) => setField("expectedDuration", event.target.value)} placeholder="Ex: 10 jours" /></label>
                  <label>{L.devis.propertyType}<select value={form.propertyType} onChange={(event) => setField("propertyType", event.target.value)}>
                    <option>Maison</option>
                    <option>Appartement</option>
                    <option>Local</option>
                    <option>Autre</option>
                  </select></label>
                </div>
                <div className="quote-identity-card-save">
                  <button
                    type="button"
                    className={`quote-identity-save-btn${savingClient ? " saving" : ""}`}
                    onClick={saveClientInfo}
                  >
                    {savingClient ? L.devis.saving : L.devis.save}
                  </button>
                </div>
              </div>
            </article>
          </section>
        ) : null}

        <section className="quote-final-card">
          <div className="quote-section-title">
            <div>
              <span>{L.devis.presentation}</span>
              <h2>{L.devis.workDescTitle}</h2>
            </div>
          </div>
          <textarea
            className="quote-work-description"
            value={form.workDescription}
            onChange={(event) => setField("workDescription", event.target.value)}
            placeholder={L.devis.workDescPh}
            rows={3}
          />
        </section>

        <section className="quote-final-card">
          <div className="quote-section-title">
            <div>
              <span>{L.devis.organization}</span>
              <h2>{L.devis.lotsTitle}</h2>
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
                    placeholder={L.devis.roomPh}
                    list="room-suggestions"
                    onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomRoom(); } }}
                  />
                  <datalist id="room-suggestions">
                    {ROOM_SUGGESTIONS.map((room) => <option key={room} value={room} />)}
                  </datalist>
                  <button type="button" onClick={addCustomRoom}>+</button>
                </div>
              </div>
              {roomGroups.filter((room) => room !== "Services").length ? (
                <div className="lot-chip-list">
                  {roomGroups.filter((room) => room !== "Services").map((room) => (
                    <span className="lot-chip lot-chip-clickable" key={room}>
                      <button type="button" className="lot-chip-label" onClick={() => scrollToRoom(room)}>{room}</button>
                      <button type="button" className="lot-chip-remove" onClick={(e) => { e.stopPropagation(); removeRoom(room); }} aria-label={`Retirer ${room}`}>x</button>
                    </span>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </section>

        <section className="quote-final-card">
          <div className="quote-section-title quote-room-title-row">
            <div>
              <span>{L.devis.works}</span>
              <h2>{L.devis.worksTitle}</h2>
            </div>
            <div className="quote-room-header-right">
              <span className="quote-room-subtotal-badge">{money((linesByRoom["Services"] || []).reduce((s, l) => s + l.totalHt, 0))} HT</span>
              <button
                type="button"
                className={`quote-meta-toggle ${openRooms.has("Services") ? "open" : ""}`}
                onClick={() => toggleRoomOpen("Services")}
                aria-expanded={openRooms.has("Services")}
                aria-label={openRooms.has("Services") ? "Réduire les ouvrages sans lot" : "Ouvrir les ouvrages sans lot"}
              >
                <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" /></svg>
              </button>
            </div>
          </div>

          {openRooms.has("Services") ? (
          <>
          <div className="quote-toolbar">
            <button type="button" className="quote-toolbar-button purple" onClick={() => openNoteComposer("Services")}>
              <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
              {L.devis.noteBtn}
            </button>
            <button type="button" className="quote-toolbar-button orange" onClick={() => openOuvragesLibrary("Services")}>
              <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 6.5C10.5 5.5 8 5 4 5v13c4 0 6.5.5 8 1.5M12 6.5c1.5-1 4-1.5 8-1.5v13c-4 0-6.5.5-8 1.5M12 6.5v13" /></svg>
              {L.devis.library}
            </button>
            <button type="button" className="quote-toolbar-button blue" onClick={() => openOuvrageComposer("Services")}>
              <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" /><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M12 8v8M8 12h8" /></svg>
              {L.devis.createWork}
            </button>
            <button type="button" className="quote-toolbar-button green" onClick={() => openFournitureComposer("Services")}>
              <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="20" r="1.5" fill="currentColor" /><circle cx="18" cy="20" r="1.5" fill="currentColor" /><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 4h2l2.4 12.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L22 7H6" /></svg>
              {L.devis.addSupplyBtn}
            </button>
          </div>

          {roomNotes.filter((note) => note.room === "Services").map((note) => (
            <div key={note.id} className="room-note-card">
              <div className="room-note-header">
                <span className="room-note-type">
                  {note.type === "photo" ? L.devis.photo : note.type === "attachment" ? L.devis.attachment : L.devis.messageType}
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
          </>
          ) : null}
        </section>

        {roomGroups.filter((room) => room !== "Services").map((room) => {
          const roomLines = linesByRoom[room] || [];
          const roomTotalHt = roomLines.reduce((s, l) => s + l.totalHt, 0);
          const isRoomOpen = openRooms.has(room);
          return (
            <section className={`quote-final-card quote-room-card${isRoomOpen ? "" : " collapsed"}`} id={`lot-section-${encodeURIComponent(room)}`} key={room}>
              <div className="quote-section-title quote-room-title-row">
                <div style={{ flex: 1 }}>
                  <span>LOT</span>
                  <input
                    key={room}
                    className="quote-room-name-input"
                    defaultValue={room}
                    onBlur={(e) => renameRoom(room, e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
                    placeholder="Nom du lot…"
                  />
                </div>
                <div className="quote-room-header-right">
                  <span className="quote-room-subtotal-badge">{money(roomTotalHt)} HT</span>
                  <button
                    type="button"
                    className={`quote-meta-toggle ${isRoomOpen ? "open" : ""}`}
                    onClick={() => toggleRoomOpen(room)}
                    aria-expanded={isRoomOpen}
                    aria-label={isRoomOpen ? `Réduire ${room}` : `Ouvrir ${room}`}
                  >
                    <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" /></svg>
                  </button>
                </div>
              </div>

              {isRoomOpen ? (
              <>
              <div className="quote-toolbar">
                <button type="button" className="quote-toolbar-button purple" onClick={() => openNoteComposer(room)}>
                  <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  Note
                </button>
                <button type="button" className="quote-toolbar-button orange" onClick={() => openOuvragesLibrary(room)}>
                  <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 6.5C10.5 5.5 8 5 4 5v13c4 0 6.5.5 8 1.5M12 6.5c1.5-1 4-1.5 8-1.5v13c-4 0-6.5.5-8 1.5M12 6.5v13" /></svg>
                  {L.devis.library}
                </button>
                <button type="button" className="quote-toolbar-button blue" onClick={() => openOuvrageComposer(room)}>
                  <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" /><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M12 8v8M8 12h8" /></svg>
                  {L.devis.createWork}
                </button>
                <button type="button" className="quote-toolbar-button green" onClick={() => openFournitureComposer(room)}>
                  <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="20" r="1.5" fill="currentColor" /><circle cx="18" cy="20" r="1.5" fill="currentColor" /><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 4h2l2.4 12.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L22 7H6" /></svg>
                  {L.devis.addSupplyBtn}
                </button>
              </div>

              {roomNotes.filter((note) => note.room === room).map((note) => (
                <div key={note.id} className="room-note-card">
                  <div className="room-note-header">
                    <span className="room-note-type">
                      {note.type === "photo" ? L.devis.photo : note.type === "attachment" ? L.devis.attachment : L.devis.messageType}
                    </span>
                    <button type="button" className="room-note-remove" onClick={() => removeNote(note.id)} aria-label="Supprimer la note">×</button>
                  </div>
                  {note.message ? <p className="room-note-message">{note.message}</p> : null}
                  {note.photoDataUrl ? <img src={note.photoDataUrl} alt="Note photo" className="room-note-photo" /> : null}
                  {note.fileName && !note.photoDataUrl ? <span className="room-note-file">{note.fileName}</span> : null}
                </div>
              ))}

              {!roomLines.length ? (
                <div className="empty-state">{L.devis.noWorkForLot}</div>
              ) : (
                <>
                  <div className="quote-final-lines">
                    {roomLines.map((line) => renderLineCard(line))}
                  </div>
                  <div className="quote-room-subtotal">
                    <span className="quote-room-subtotal-label">{L.devis.subtotal} {room}</span>
                    <span>{money(roomTotalHt)} HT</span>
                  </div>
                </>
              )}
              </>
              ) : null}
            </section>
          );
        })}

        <section className="room-add-bottom-card">
          <span className="room-add-bottom-label">{L.devis.addLot}</span>
          <div className="room-add-card">
            <div className="room-add-row">
              <input
                value={customRoom}
                onChange={(event) => setCustomRoom(event.target.value)}
                placeholder="Nom de la pièce (ex: Salon, Cuisine...)"
                list="room-suggestions"
                onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomRoom(); } }}
              />
              <button type="button" onClick={addCustomRoom}>+</button>
            </div>
          </div>
        </section>

        <section className="quote-total-panel">
          <div><span>{L.devis.totalHours}</span><strong>{totals.hours.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} h</strong></div>
          <div><span>{L.devis.laborHt}</span><strong>{money(totals.labor)}</strong></div>
          <div><span>{L.devis.suppliesHt}</span><strong>{money(totals.supplies)}</strong></div>
          <div><span>{L.devis.subtotalHt}</span><strong>{money(totals.ht)}</strong></div>
          <div className="total"><span>{L.devis.total}</span><strong>{money(summaryTotals.totalTtc)}</strong></div>
        </section>

        <section className="quote-recap-card">
          <div className="recap-title-row">
            <div>
              <h2 className="recap-title">{L.devis.conditioning}</h2>
              <p className="recap-title-hint">{L.devis.clickStatus}</p>
            </div>
            <div className="recap-mode-legend">
              <span className="recap-legend-chip recap-legend-excluded">{L.devis.notCounted}</span>
              <span className="recap-legend-chip recap-legend-internal">{L.devis.includedHidden}</span>
              <span className="recap-legend-chip recap-legend-client">{L.devis.visibleClient}</span>
            </div>
          </div>

          {roomGroups.map((room) => {
            const roomHt = (linesByRoom[room] || []).reduce((s, l) => s + l.totalHt, 0);
            if (roomHt === 0 && room === "Services") return null;
            return (
              <div className="recap-row recap-room-row" key={room}>
                <span>{room === "Services" ? L.devis.generalWorks : room}</span>
                <strong>{money(roomHt)}</strong>
              </div>
            );
          })}

          {surcharges.map((s) => {
            const line = summaryTotals.surchargeLines.find((x) => x.id === s.id);
            return (
              <div className={`recap-row recap-surcharge-row recap-surcharge-mode-${s.mode ?? "excluded"}`} key={s.id}>
                <div className="recap-surcharge-checks">
                  <label className="recap-check-label">
                    <input
                      type="checkbox"
                      checked={(s.mode ?? "excluded") !== "excluded"}
                      onChange={(e) => updateSurcharge(s.id, "mode", e.target.checked ? "internal" : "excluded")}
                    />
                    {L.devis.counted}
                  </label>
                  <label className="recap-check-label">
                    <input
                      type="checkbox"
                      checked={s.mode === "client"}
                      onChange={(e) => updateSurcharge(s.id, "mode", e.target.checked ? "client" : "internal")}
                    />
                    {L.devis.shown}
                  </label>
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

          <button type="button" className="recap-add-surcharge" onClick={addSurcharge}>{L.devis.addLine}</button>

          <div className="recap-divider" />

          <div className="recap-row recap-total-ht">
            <span>{L.devis.totalHtGen}</span>
            <strong>{money(summaryTotals.totalHt)}</strong>
          </div>

          <div className="recap-row recap-tva-row">
            <span>TVA / VAT</span>
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
                  <button type="button" className="recap-tva-switch" onClick={() => setVatManual(false)}>{L.devis.choose}</button>
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
                    <option value="autre">{L.devis.vatOther}</option>
                  </select>
                </>
              )}
            </div>
            <strong>{money(summaryTotals.vatAmount)}</strong>
          </div>

          <div className="recap-row recap-total-ttc">
            <span>{L.devis.totalTtcGen}</span>
            <strong>{money(summaryTotals.totalTtc)}</strong>
          </div>
        </section>

        <section className="quote-final-card quote-payment-card">
          <div className="quote-section-title">
            <div>
              <span>{L.devis.payment}</span>
              <h2>{L.devis.paymentTitle}</h2>
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
              <span>{L.devis.accountHolder}</span>
              <input
                value={company.bankHolder || ""}
                onChange={(e) => setCompanyField("bankHolder", e.target.value)}
                placeholder="Nom du titulaire"
              />
            </label>
          </div>

          <label className="payment-field payment-field-wide">
            <span>{L.devis.paymentCond}</span>
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
          <button type="button" className="button blue" onClick={handleGenerate}>{L.devis.generateQuote}</button>
          <button type="button" className="button secondary" onClick={() => handlePreview()}>{L.devis.preview}</button>
          <button type="button" className="button danger" onClick={handleCancel}>{L.common.cancel}</button>
          <button type="button" className="button secondary" onClick={handleConfirm}>{L.devis.confirm}</button>
          <button type="button" className="button blue" onClick={handleSend}>{L.devis.send}</button>
        </div>

        {generatedQuote ? (
          <section className="quote-generated-suite">
            <article className="quote-ready-card">
              <div className="quote-ready-check">OK</div>
              <div>
                <span>{L.devis.quoteReady}</span>
                <h2>{generatedQuote.quoteNumber}</h2>
                <p>{L.devis.docsReady}</p>
              </div>
              <div className="quote-ready-docs-stack">
                <div className="quote-ready-doc-row" onClick={() => handleDownload("quote", "pdf")}>
                  <span className="quote-ready-doc-label">
                    <strong>{L.devis.finalQuote}</strong>
                    <small>PDF A4</small>
                  </span>
                  <button
                    type="button"
                    className="quote-ready-doc-eye"
                    onClick={(event) => { event.stopPropagation(); handlePreview("quote"); }}
                    aria-label="Ouvrir l'aperçu du devis"
                  >
                    👁
                  </button>
                </div>
                <div className="quote-ready-doc-row" onClick={() => handleDownload("supplies", "pdf")}>
                  <span className="quote-ready-doc-label">
                    <strong>{L.devis.suppliesDoc}</strong>
                    <small>PDF A4</small>
                  </span>
                  <button
                    type="button"
                    className="quote-ready-doc-eye"
                    onClick={(event) => { event.stopPropagation(); handlePreview("supplies"); }}
                    aria-label="Ouvrir l'aperçu des fournitures"
                  >
                    👁
                  </button>
                </div>
              </div>
            </article>

            <section className="quote-final-card signature-delivery-card signature-send-card">
              <div className="signature-send-heading signature-send-heading-simple">
                <div>
                  <h2>{L.devis.signatureTitle}</h2>
                  <p>{L.devis.signatureHint}</p>
                </div>
                <button type="button" className="button blue" onClick={resendSignatureLink}>
                  {signatureDelivery ? L.devis.resendLink : L.devis.sendLink}
                </button>
              </div>

              {signatureDelivery ? (
                <>
                  <div className="signature-access-box signature-access-box-unified">
                    <div className="signature-access-row signature-access-row-copy">
                      <div>
                        <span>{L.devis.signatureLink}</span>
                        <a href={signatureDelivery.loginUrl} target="_blank" rel="noreferrer">{signatureDelivery.loginUrl}</a>
                      </div>
                      <button type="button" className="signature-copy-btn" onClick={() => copySignatureText(signatureDelivery.loginUrl, "Lien copié")}>{L.devis.copy}</button>
                    </div>
                    <div className="signature-access-row-pair">
                      <div className="signature-access-row-copy">
                        <div><span>{L.devis.tempId}</span><strong>{signatureDelivery.identifier}</strong></div>
                        <button type="button" className="signature-copy-btn" onClick={() => copySignatureText(signatureDelivery.identifier, "Identifiant copié")}>{L.devis.copy}</button>
                      </div>
                      <div className="signature-access-row-copy">
                        <div><span>{L.devis.tempPass}</span><strong>{signatureDelivery.password}</strong></div>
                        <button type="button" className="signature-copy-btn" onClick={() => copySignatureText(signatureDelivery.password, "Mot de passe copié")}>{L.devis.copy}</button>
                      </div>
                    </div>
                    <div className="signature-access-row">
                      <span>{L.devis.clientMsg}</span>
                      <textarea
                        className="signature-message-input"
                        value={clientMessage}
                        onChange={(event) => setClientMessage(event.target.value)}
                        rows={5}
                      />
                    </div>
                  </div>
                  <div className="signature-channel-row">
                    <a className="signature-channel primary" href={signatureDelivery.loginUrl} target="_blank" rel="noreferrer">{L.devis.openLink}</a>
                    <button type="button" className="signature-channel" onClick={() => copySignatureText(signatureDelivery.loginUrl, "Lien copié")}>{L.devis.copyLink}</button>
                    <button type="button" className="signature-channel" onClick={() => copySignatureText(signatureText, "Message prêt à envoyer")}>{L.devis.copyMsg}</button>
                    <a className="signature-channel" href={signatureMailHref}>{L.devis.emailClient}</a>
                    <a className="signature-channel" href={signatureWhatsAppHref} target="_blank" rel="noreferrer">WhatsApp</a>
                  </div>
                  {copyMessage ? <p className="signature-copy-message">{copyMessage}</p> : null}
                </>
              ) : (
                <p className="signature-empty-hint">
                  {L.devis.signatureEmpty}
                </p>
              )}
            </section>
          </section>
        ) : null}

        {selectedSupply ? (
          <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setSelectedSupply(null)}>
            <div className="mini-modal supply-detail-modal" onClick={(event) => event.stopPropagation()}>
              <h2>{selectedSupply.name}</h2>
              <p>{L.devis.supplyLinked}</p>
              <dl className="supply-detail-list">
                <div><dt>{L.devis.catLabel}</dt><dd>{selectedSupply.category || "Divers"}</dd></div>
                <div><dt>{L.devis.supLabel}</dt><dd>{selectedSupply.supplierName || "Non renseigne"}</dd></div>
                <div><dt>{L.devis.priceHt}</dt><dd>{money(supplyPrice(selectedSupply))}</dd></div>
                <div><dt>{L.devis.stockLabel}</dt><dd>{selectedSupply.stock ?? selectedSupply.quantity ?? 0}</dd></div>
              </dl>
              {selectedSupply.sourceUrl ? <a className="supply-source-link" href={selectedSupply.sourceUrl} target="_blank" rel="noreferrer">{L.devis.sourceLink}</a> : null}
              <div className="supply-modal-actions">
                <button type="button" onClick={() => setSelectedSupply(null)}>{L.devis.closeBtn}</button>
                <Link className="button secondary" href={`/fournitures?supply=${selectedSupply.id}`}>{L.devis.openInSupply}</Link>
                <button type="button" className="button blue" onClick={() => { applySupplyToLine(selectedSupply.lineId, selectedSupply, selectedSupply.materialIndex); setSelectedSupply(null); }}>{L.devis.useBtn}</button>
              </div>
            </div>
          </div>
        ) : null}

        {supplyComposer.open ? (
          <div className="modal-overlay" role="dialog" aria-modal="true" onClick={closeSupplyComposer}>
            <div className="mini-modal supply-composer-modal" onClick={(event) => event.stopPropagation()}>
              <h2>{supplyComposer.mode === "url" ? L.devis.addViaLink : L.devis.addSupplyTitle}</h2>
              <div className="supply-composer-tabs">
                <button type="button" className={supplyComposer.mode === "manual" ? "active" : ""} onClick={() => setSupplyComposerField("mode", "manual")}>{L.devis.manual}</button>
                <button type="button" className={supplyComposer.mode === "url" ? "active" : ""} onClick={() => setSupplyComposerField("mode", "url")}>{L.devis.viaLink}</button>
              </div>
              {supplyComposer.mode === "url" ? (
                <label className="supply-composer-field full"><span>{L.devis.productLink}</span><input value={supplyComposer.sourceUrl} onChange={(event) => setSupplyComposerField("sourceUrl", event.target.value)} placeholder="https://..." /></label>
              ) : null}
              <label className="supply-composer-field full"><span>{L.devis.name}</span><input value={supplyComposer.name} onChange={(event) => setSupplyComposerField("name", event.target.value)} placeholder={L.devis.name} /></label>
              <div className="supply-composer-grid">
                <label className="supply-composer-field"><span>{L.devis.catLabel}</span><input value={supplyComposer.category} onChange={(event) => setSupplyComposerField("category", event.target.value)} /></label>
                <label className="supply-composer-field"><span>{L.devis.supLabel}</span><input value={supplyComposer.supplierName} onChange={(event) => setSupplyComposerField("supplierName", event.target.value)} /></label>
                <label className="supply-composer-field"><span>{L.devis.qtyLabel}</span><input type="number" min="0" step="0.01" value={supplyComposer.quantity} onChange={(event) => setSupplyComposerField("quantity", event.target.value)} /></label>
                <label className="supply-composer-field"><span>{L.devis.priceHt}</span><input type="number" min="0" step="0.01" value={supplyComposer.unitPrice} onChange={(event) => setSupplyComposerField("unitPrice", event.target.value)} placeholder="Auto si lien" /></label>
              </div>
              {supplyComposer.error ? <p className="profile-message error">{supplyComposer.error}</p> : null}
              <div className="supply-modal-actions">
                <button type="button" onClick={closeSupplyComposer}>{L.common.cancel}</button>
                <button type="button" className="button blue" onClick={saveSupplyFromComposer} disabled={supplyComposer.loading}>{supplyComposer.loading ? L.devis.importing : L.common.add}</button>
              </div>
            </div>
          </div>
        ) : null}

        {ouvrageComposer.open ? (
          <div className="modal-overlay" role="dialog" aria-modal="true" onClick={closeOuvrageComposer}>
            <div className="mini-modal supply-composer-modal" onClick={(event) => event.stopPropagation()}>
              <h2>{L.devis.createWork}</h2>
              <label className="supply-composer-field full">
                <span>{L.devis.designation}</span>
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
                  <span>{L.devis.room}</span>
                  <select value={ouvrageComposer.room} onChange={(event) => setOuvrageComposerField("room", event.target.value)}>
                    <option value="Services">{L.devis.noRoom}</option>
                    {roomGroups.filter((r) => r !== "Services").map((roomOption) => <option key={roomOption} value={roomOption}>{roomOption}</option>)}
                  </select>
                </label>
              ) : null}
              {ouvrageComposer.error ? <p className="profile-message error">{ouvrageComposer.error}</p> : null}
              <div className="supply-modal-actions">
                <button type="button" onClick={closeOuvrageComposer}>{L.common.cancel}</button>
                <button type="button" className="button blue" onClick={submitOuvrageComposer}>{L.bibliotheque.addToCatalog}</button>
              </div>
            </div>
          </div>
        ) : null}

        {noteComposer.open ? (
          <div className="modal-overlay" role="dialog" aria-modal="true" onClick={closeNoteComposer}>
            <div className="mini-modal supply-composer-modal" onClick={(event) => event.stopPropagation()}>
              <h2>{L.devis.noteTitle}</h2>
              <div className="supply-composer-tabs">
                <button type="button" className={noteComposer.type === "message" ? "active" : ""} onClick={() => setNoteComposerField("type", "message")}>{L.devis.messageType}</button>
                <button type="button" className={noteComposer.type === "photo" ? "active" : ""} onClick={() => setNoteComposerField("type", "photo")}>{L.devis.photo}</button>
                <button type="button" className={noteComposer.type === "attachment" ? "active" : ""} onClick={() => setNoteComposerField("type", "attachment")}>{L.devis.attachment}</button>
              </div>
              <label className="supply-composer-field full">
                <span>{L.devis.messageType}</span>
                <textarea
                  className="note-composer-textarea"
                  value={noteComposer.message}
                  onChange={(event) => setNoteComposerField("message", event.target.value)}
                  placeholder={L.devis.noteMsg}
                  rows={3}
                />
              </label>
              {noteComposer.type === "photo" ? (
                <label className="supply-composer-field full">
                  <span>{L.devis.photo}</span>
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
                  <span>{L.devis.attachment}</span>
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
                <button type="button" onClick={closeNoteComposer}>{L.common.cancel}</button>
                <button type="button" className="button blue" onClick={submitNoteComposer}>{L.common.add}</button>
              </div>
            </div>
          </div>
        ) : null}
      </form>
    </Shell>
  );
}
