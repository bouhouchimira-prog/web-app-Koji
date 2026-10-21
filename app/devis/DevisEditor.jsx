"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Shell } from "../../components/Shell";
import { AddressFields } from "../../components/AddressFields";
import { SendQuoteModal } from "../../components/SendQuoteModal";
import { DevisChatPanel } from "../../components/DevisChatPanel";
import { apiGet, apiSend } from "../../lib/client-api";
import { contactDisplayName, findSimilarContacts } from "../../lib/contacts";
import { clearChantierDraft, getChantierDraft } from "../../lib/chantier-draft";
import { pricingProfile } from "../../lib/data";
import { calculateTaskPrice } from "../../lib/pricing";
import { computeSurchargeBreakdown } from "../../lib/quote-calculations";
import { useLocale } from "../../lib/i18n";
import { useApi } from "../../lib/use-api";
import { cumulativeMarketTotal, AVENANT_STATUS_LABEL_KEYS } from "../../lib/avenant-mapping";
import catalog from "../../data/catalog-ouvrages.json";

const ROOM_SUGGESTIONS = ["Salon", "Cuisine", "Chambre", "Salle de bain", "Bureau", "Exterieur"];

const CUSTOM_OUVRAGE_UNITS = ["u", "m²", "ml", "m³", "h", "forfait"];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// `Date.now()` seul collisionne quand plusieurs lignes sont creees dans la
// meme milliseconde (ex: le chat "Avec l'IA" qui ajoute plusieurs ouvrages
// d'affilee dans le meme tour) — React remonte alors "two children with
// the same key" et des lignes se dupliquent/disparaissent. Suffixe
// aleatoire pour garantir l'unicite meme sur deux appels synchrones.
let localIdCounter = 0;
function uniqueLocalId(prefix) {
  localIdCounter += 1;
  return `${prefix}-${Date.now()}-${localIdCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

// Acompte/Solde (16 oct, maquette Artifact DevisConditions) — reutilise le
// mecanisme paymentMilestones deja existant (jusque-la reserve aux devis
// Radar des Chantiers), toujours exactement 2 entrees : le pourcentage de
// l'une pilote le complement de l'autre dans updateAcomptePercent. Ne jamais
// appeler cette fonction pour ecraser un devis qui a deja des echeances
// (voir les deux appels de setPaymentMilestones plus bas).
function defaultPaymentMilestones() {
  return [
    { id: `pm-acompte-${Date.now()}`, label: "Acompte à la signature", percent: 30 },
    { id: `pm-solde-${Date.now() + 1}`, label: "Solde — à la réception des travaux", percent: 70 }
  ];
}

function editQuoteIdFromUrl() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("id") || "";
}

// Mode choisi depuis les 2 cartes du tableau de bord Devis (17 oct, voir
// DevisHistory.jsx) — lu une seule fois au montage, l'etat "mode" prend le
// relais ensuite (la bascule manuelle dans l'en-tete reste toujours
// disponible une fois dans l'editeur).
function modeFromUrl() {
  if (typeof window === "undefined") return "manuel";
  return new URLSearchParams(window.location.search).get("mode") === "ia" ? "ia" : "manuel";
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
    name: business.raisonSociale || user?.name || "Koji",
    address: [business.addressLine1, business.addressLine2, [business.postalCode, business.city].filter(Boolean).join(" ")].filter(Boolean).join(", "),
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
    description: settings.description ?? source.description ?? "",
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

function recalculateLine(line, settings = {}, quoteVatRatePercent) {
  const lineVatRate = quoteVatRatePercent != null ? Number(quoteVatRatePercent) / 100 : Number(pricingProfile.vatRate || 0.2);
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
  const totalHt = Math.max(0, totalHtAfterAdjustment - discountAmount);
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
    vatAmount,
    vatRate: lineVatRate,
    totalHtBase,
    totalHt: round2(totalHt),
    totalTtc
  };
}

function computeSubItemLine(subItem, parentLine = {}, quoteVatRatePercent) {
  const billingMode = subItem.billingMode || "fixed";
  const vatRate = quoteVatRatePercent != null ? Number(quoteVatRatePercent) / 100 : Number(pricingProfile.vatRate || 0.2);
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

export default function DevisEditor() {
  const { L } = useLocale();
  const router = useRouter();
  const { data: quotes, setData: setQuotes, loading: quotesLoading } = useApi("/api/quotes", "quotes");
  const { data: projects, setData: setProjects } = useApi("/api/projects", "projects");
  const { data: supplies, setData: setSupplies } = useApi("/api/supplies", "supplies");
  const { data: ouvrages } = useApi("/api/ouvrages", "ouvrages", catalog);
  const { data: contacts, setData: setContacts } = useApi("/api/contacts", "contacts");

  const postes = useMemo(() => ouvrages.filter((item) => item.type === "POSTE" || item.type === "SOUS-POSTE"), [ouvrages]);
  const [company, setCompany] = useState(profileCompany(null));
  const [selectedIds, setSelectedIds] = useState([]);
  const [lineSettings, setLineSettings] = useState({});
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [generatedQuote, setGeneratedQuote] = useState(null);
  const [savedLineId, setSavedLineId] = useState(null);
  // Une ligne "Enregistree" se replie en resume compact (designation,
  // quantite, unite, prix unitaire HT, total HT) — clic dessus pour la
  // rouvrir en edition. S'applique pareil aux ouvrages, fournitures et
  // sous-ouvrages (meme rendu, la ligne parente porte l'etat).
  const [collapsedLineIds, setCollapsedLineIds] = useState(() => new Set());
  // Fiche avancee par ligne (recap manager, 19 septembre) : temps normatif,
  // taux horaire, ajustement/reduction %, lot et sous-ouvrages restent
  // caches derriere "Details avances" — seuls Designation/Description
  // client/Quantite/Unite/Prix unitaire HT restent visibles par defaut.
  const [advancedLineIds, setAdvancedLineIds] = useState(() => new Set());
  // Menu "⋮" unique par ligne (recap manager, 19-20 septembre) : regroupe
  // monter/descendre/ouvrir la reference/details avances/supprimer — une
  // seule ligne ouverte a la fois, ferme au clic exterieur.
  const [lineMenuOpenId, setLineMenuOpenId] = useState(null);
  const lineMenuRef = useRef(null);
  const [confirmDeleteLineId, setConfirmDeleteLineId] = useState(null);
  const [confirmDeleteSubId, setConfirmDeleteSubId] = useState(null);
  const [clientMessage, setClientMessage] = useState("");
  const [savingClient, setSavingClient] = useState(false);
  const [signatureDelivery, setSignatureDelivery] = useState(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [selectedSupply, setSelectedSupply] = useState(null);
  const [selectedOuvrageRef, setSelectedOuvrageRef] = useState(null);
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
    clientReference: "",
    clientEmail: "",
    clientPhone: "",
    // Identite structuree (22 septembre) : "client" (chaine) reste calcule
    // depuis ces champs au moment de l'enregistrement (voir persistQuoteImpl)
    // — tout le reste de l'app (PDF, factures, assistant koji) continue de
    // lire "client" sans aucun changement.
    clientType: "particulier",
    clientFirstName: "",
    clientLastName: "",
    clientCompanyName: "",
    contactId: "",
    projectId: "",
    project: "",
    propertyType: "Maison",
    chantierAddress: "",
    // Adresse structuree (22 septembre) : "chantierAddress" (chaine) reste
    // calcule depuis ces champs a l'enregistrement, meme principe que
    // "client" ci-dessus. Forme attendue par components/AddressFields.jsx.
    chantierAddressDetails: null,
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
  // Tous les lots visibles en accordeon (19 septembre, v2) : chaque lot a son
  // propre repli/depli ; "targetRoom" = dernier lot clique, c'est lui que
  // vise le panneau de droite (onglet Bibliotheque/Fournitures).
  const [expandedLotIds, setExpandedLotIds] = useState(() => new Set(["Services"]));
  const [lotsInitialized, setLotsInitialized] = useState(false);
  const [targetRoom, setTargetRoom] = useState("Services");
  // Bascule Manuel/Avec l'IA (16 oct, maquette Artifact) — purement
  // d'affichage pour l'instant, le mode "ia" est branche separement.
  // "manuel" par defaut cote serveur (modeFromUrl() lit window, absent au
  // rendu serveur) — jamais dans l'initialiseur de useState, qui tournerait
  // aussi pendant l'hydratation client et desynchroniserait le rendu du
  // serveur (meme principe que editQuoteIdFromUrl, toujours lu dans un
  // useEffect plus bas, jamais dans un useState).
  const [mode, setMode] = useState("manuel");
  useEffect(() => {
    if (modeFromUrl() === "ia") setMode("ia");
  }, []);
  // Derniere ligne ajoutee par le chat sans correspondance catalogue (16
  // oct) — cible de proposer_prix, voir addAiOuvrageToRoom/applyAiManualPrice.
  const lastUnmatchedAiLineIdRef = useRef("");
  const [rightPanelTab, setRightPanelTab] = useState("client");
  const [clientEditing, setClientEditing] = useState(false);
  // Avenants du devis signé (18 septembre) : chargés dès qu'un devis signé
  // est ouvert, pour l'onglet "Avenants" et le total de marché à jour dans
  // l'en-tête — jamais sur un devis non signé (un avenant exige un devis
  // signé, voir app/api/avenants/route.js).
  const [avenants, setAvenants] = useState([]);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [libraryFamily, setLibraryFamily] = useState("");
  const [supplyQuery, setSupplyQuery] = useState("");
  const [supplyCategory, setSupplyCategory] = useState("");
  const [conditioningOpen, setConditioningOpen] = useState(false);
  const [paymentCardOpen, setPaymentCardOpen] = useState(false);
  const [totalsDetailOpen, setTotalsDetailOpen] = useState(false);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  // Fenetre "Envoyer le devis" (16 oct, maquette Artifact DevisEnvoi).
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const moreActionsRef = useRef(null);
  const [addLineMenuRoom, setAddLineMenuRoom] = useState(null);
  // Panneau "outils" (Client/Lots/Bibliotheque/Fournitures) en tiroir sur
  // mobile (recap manager, 19 septembre) — sans effet au-dessus de 900px,
  // ou la colonne de droite reste affichee normalement.
  const [toolsDrawerOpen, setToolsDrawerOpen] = useState(false);
  const addLineMenuRef = useRef(null);
  const [dragRoom, setDragRoom] = useState(null);
  const [dragOverRoom, setDragOverRoom] = useState(null);
  const [customSources, setCustomSources] = useState([]);
  const [surcharges, setSurcharges] = useState([
    { id: "sc-coord", label: "Coordination de chantier", percent: 10, mode: "client" },
    { id: "sc-alea", label: "Provision aléas de chantier", percent: 5, mode: "client" },
    { id: "sc-assur", label: "Assurance décennale", percent: 8, mode: "client", calculationBase: "chiffrage_cumule" }
  ]);
  // Acompte/Solde (decisions du 4 septembre pour le module Radar des
  // Chantiers, ouvert a tous les devis le 16 octobre — maquette
  // DevisConditions) : [{ id, label, percent }], toujours exactement 2
  // entrees, somme des percent = 100.
  const [paymentMilestones, setPaymentMilestones] = useState(() => defaultPaymentMilestones());
  const [quoteVatRate, setQuoteVatRate] = useState(20);
  const [vatManual, setVatManual] = useState(false);
  const [draftQuoteNumber, setDraftQuoteNumber] = useState(null);
  const [ouvrageComposer, setOuvrageComposer] = useState({
    open: false,
    label: "",
    room: "Services",
    quantity: "1",
    unit: "u",
    priceHt: "",
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
  const [acceptComposer, setAcceptComposer] = useState({ open: false, reason: "verbal", note: "" });

  // Guards the account's default business info (fetched below) from
  // clobbering a quote's own saved company/IBAN snapshot when the two
  // network calls resolve in the wrong order.
  const quoteCompanyAppliedRef = useRef(false);
  const persistQuoteInFlightRef = useRef(null);

  useEffect(() => {
    if (!moreActionsOpen) return;
    function handleClickOutside(event) {
      if (moreActionsRef.current && !moreActionsRef.current.contains(event.target)) {
        setMoreActionsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [moreActionsOpen]);

  useEffect(() => {
    if (!lineMenuOpenId) return;
    function handleClickOutside(event) {
      if (lineMenuRef.current && !lineMenuRef.current.contains(event.target)) {
        setLineMenuOpenId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [lineMenuOpenId]);

  useEffect(() => {
    if (!addLineMenuRoom) return;
    function handleClickOutside(event) {
      if (addLineMenuRef.current && !addLineMenuRef.current.contains(event.target)) {
        setAddLineMenuRoom(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [addLineMenuRoom]);

  useEffect(() => {
    apiGet("/api/auth/profile")
      .then((payload) => {
        if (quoteCompanyAppliedRef.current) return;
        setCompany(profileCompany(payload.user));
        // TVA par defaut (15 oct, Profil) : ne s'applique qu'a un devis tout
        // neuf, jamais touche a la main ni deja charge depuis un id existant
        // — ne doit jamais ecraser le taux d'un devis en cours d'edition.
        const defaultVat = Number(payload.user?.business?.defaultVatRate);
        if (!editQuoteIdFromUrl() && !vatManual && Number.isFinite(defaultVat) && defaultVat > 0) {
          setQuoteVatRate(defaultVat);
        }
      })
      .catch(() => {
        if (!quoteCompanyAppliedRef.current) setCompany(profileCompany(null));
      });
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
    const restoredTargetRoom = window.localStorage.getItem("koji-devis-target-room") || "";
    window.localStorage.removeItem("koji-devis-target-room");

    // "Nouveau devis" doit toujours repartir d'une page vierge (20 septembre)
    // — plus de restauration silencieuse d'un brouillon localStorage. Un
    // devis avec du contenu reel est desormais toujours enregistre en base
    // (voir l'effet d'autosave plus bas) et se retrouve dans l'historique
    // /devis, avec le statut Brouillon, pour etre repris volontairement via
    // /devis?id=... — jamais en resurgissant tout seul sur un "nouveau".
    window.localStorage.removeItem("koji-devis-draft");
    const draftIds = [];

    function applyTargetRoom(ids) {
      if (!restoredTargetRoom || !ids.length) return;
      setLineSettings((current) => {
        const next = { ...current };
        ids.forEach((id) => {
          if (!next[id]?.room) next[id] = { ...next[id], room: restoredTargetRoom };
        });
        return next;
      });
    }

    if (restoredTargetRoom) {
      setExpandedLotIds((current) => new Set(current).add(restoredTargetRoom));
      setTargetRoom(restoredTargetRoom);
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
          const supplyRoom = stored.room || restoredTargetRoom || "Services";
          addFournitureLine(stored.supply, stored.quantity || 1, supplyRoom);
          setExpandedLotIds((current) => new Set(current).add(supplyRoom));
          setTargetRoom(supplyRoom);
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

  // Freeze the preview number once quotes are loaded; only regenerate on "Nouveau devis"
  useEffect(() => {
    if (editQuoteIdFromUrl()) return;
    if (draftQuoteNumber || generatedQuote?.quoteNumber) return;
    if (quotesLoading) return;
    setDraftQuoteNumber(nextQuoteNumberFromList(quotes));
  }, [quotes, quotesLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Avenants du devis signé courant — rechargés à chaque changement de devis
  // ou de statut de signature (un devis fraîchement signé doit faire
  // apparaître l'onglet "Avenants" sans re-navigation).
  useEffect(() => {
    if (!generatedQuote?.id || generatedQuote?.signatureStatus !== "Signe") {
      setAvenants([]);
      return;
    }
    let alive = true;
    apiGet(`/api/avenants?quoteId=${encodeURIComponent(generatedQuote.id)}`)
      .then((payload) => { if (alive) setAvenants(payload.avenants || []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [generatedQuote?.id, generatedQuote?.signatureStatus]);

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
    items.forEach((item, index) => {
      nextLineSettings[item.id] = {
        room: item.room || "Services",
        sortOrder: item.sortOrder ?? index,
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
    setPaymentMilestones(Array.isArray(quote.paymentMilestones) && quote.paymentMilestones.length > 0 ? quote.paymentMilestones : defaultPaymentMilestones());
    if (quote.vatRate != null) setQuoteVatRate(Number(quote.vatRate));
    setVatManual(true);
    setDraftQuoteNumber(quote.quoteNumber || null);
    setForm((current) => ({
      ...current,
      client: quote.client || "",
      clientReference: quote.clientReference || "",
      clientEmail: quote.clientEmail || "",
      clientPhone: quote.clientPhone || "",
      clientType: quote.clientType === "societe" ? "societe" : "particulier",
      clientFirstName: quote.clientFirstName || "",
      clientLastName: quote.clientLastName || "",
      clientCompanyName: quote.clientCompanyName || "",
      contactId: quote.contactId || "",
      projectId: quote.projectId || "",
      project: quote.project || "",
      chantierAddress: quote.chantierAddress || "",
      // Devis anterieur a l'adresse structuree : reprend l'ancienne chaine
      // unique comme point de depart de la rue, sans jamais tenter de la
      // decouper automatiquement en ville/code postal/departement.
      chantierAddressDetails: quote.chantierAddressDetails || (quote.chantierAddress ? { address: quote.chantierAddress } : null),
      quoteDate: quote.quoteDate || (quote.createdAt || "").slice(0, 10) || todayIso(),
      startDate: quote.startDate || "",
      expectedDuration: quote.expectedDuration || "",
      workDescription: quote.workDescription || "",
      validityDays: quote.validityDays || 30
    }));
    if (quote.company) {
      quoteCompanyAppliedRef.current = true;
      setCompany((current) => ({ ...current, ...quote.company }));
    }
    setGeneratedQuote(quote);
  }, [quotes, quotesLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Autosave: once a quote exists, further edits are persisted automatically -
  // no need to keep pressing the "Enregistrer" buttons for each change to stick.
  // Avant meme le premier clic explicite, des qu'un ouvrage/fourniture est
  // ajoute, le meme mecanisme cree le brouillon en base (statut "Brouillon",
  // visible dans l'historique /devis) — plus besoin d'un enregistrement
  // manuel pour que le travail en cours existe quelque part de retrouvable
  // (20 septembre : remplace l'ancien brouillon localStorage, invisible et
  // qui resurgissait sur "Nouveau devis").
  const autosaveTimerRef = useRef(null);
  const autosaveReadyRef = useRef(false);
  useEffect(() => {
    if (generatedQuote?.id) {
      if (!autosaveReadyRef.current) {
        // Skip the run that fires right when an existing quote is loaded.
        autosaveReadyRef.current = true;
        return;
      }
    } else if (!selectedIds.length && !customSources.length) {
      return;
    }
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      persistQuote(false).catch(() => {});
    }, 1200);
    return () => clearTimeout(autosaveTimerRef.current);
  }, [form, rooms, roomNotes, surcharges, paymentMilestones, quoteVatRate, customSources, lineSettings, selectedIds, generatedQuote?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedSources = useMemo(() => {
    const fromCatalog = selectedIds.map((id) => postes.find((item) => item.id === id)).filter(Boolean);
    return [...fromCatalog, ...customSources];
  }, [postes, selectedIds, customSources]);

  const previewQuoteNumber = generatedQuote?.quoteNumber || draftQuoteNumber || "";
  const previewVersionNumber = generatedQuote?.versionNumber || "001";

  const quoteLines = useMemo(() => {
    return selectedSources.map((source, index) => {
      const settings = lineSettings[source.id] || {};
      const sortOrder = settings.sortOrder ?? index;
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
        description: task.description,
        room: settings.room || "Services",
        sortOrder,
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
        fixedDurationUnit: settings.fixedDurationUnit || "h",
        // Badge "IA · à vérifier" (16 oct) — recalculateLine spread "line"
        // tel quel, mais cet objet est construit champ par champ : sans ces
        // 2 lignes, aiAdded/priceSource poses par addAiOuvrageToRoom
        // disparaitraient silencieusement a chaque rendu.
        aiAdded: Boolean(settings.aiAdded),
        priceSource: settings.priceSource || ""
      }, settings, quoteVatRate);

      const rawSubItems = Array.isArray(settings.subItems) ? settings.subItems : [];
      if (!rawSubItems.length) return line;
      const subItems = rawSubItems.map((sub) => computeSubItemLine(sub, line, quoteVatRate));
      const subTotalHt = round2(subItems.reduce((s, sub) => s + sub.totalHt, 0));
      const subTotalTtc = round2(subItems.reduce((s, sub) => s + sub.totalTtc, 0));
      return { ...line, totalHt: subTotalHt, totalTtc: subTotalTtc, vatAmount: round2(subTotalTtc - subTotalHt), subItems };
    });
  }, [lineSettings, selectedSources, supplies, company, quoteVatRate]);

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

  // Pied de page (19 septembre) : "Total ouvrages" / "Total fournitures" —
  // separe simplement les lignes "fourniture" (code FOURN, ajoutees via
  // addFournitureLine) du reste.
  const lotTotals = useMemo(() => {
    return quoteLines.reduce((sum, line) => {
      if (line.code === "FOURN") return { ...sum, supplies: sum.supplies + Number(line.totalHt || 0) };
      return { ...sum, works: sum.works + Number(line.totalHt || 0) };
    }, { works: 0, supplies: 0 });
  }, [quoteLines]);

  // Onglet "Bibliotheque" du panneau de droite (19 septembre) — meme
  // convention de filtrage que app/bibliotheque-ouvrages/page.jsx (familles
  // derivees des donnees, recherche sur code/designation), directement sur
  // le catalogue deja charge (`postes`), sans nouvel appel reseau.
  const libraryFamilies = useMemo(() => {
    return Array.from(new Set(postes.map((item) => item.family || "Autre"))).sort();
  }, [postes]);

  const filteredLibraryItems = useMemo(() => {
    const normalized = libraryQuery.trim().toLowerCase();
    return postes.filter((item) => {
      if (libraryFamily && item.family !== libraryFamily) return false;
      if (!normalized) return true;
      return [item.code, item.label, item.family].join(" ").toLowerCase().includes(normalized);
    });
  }, [postes, libraryQuery, libraryFamily]);

  // Onglet "Fournitures" — meme formule, categories derivees de `supplies`
  // (deja charge par la page pour le calcul des lignes existantes).
  const supplyCategories = useMemo(() => {
    return Array.from(new Set(supplies.map((item) => item.category).filter(Boolean))).sort();
  }, [supplies]);

  const filteredSupplyItems = useMemo(() => {
    const normalized = supplyQuery.trim().toLowerCase();
    return supplies.filter((item) => {
      if (supplyCategory && item.category !== supplyCategory) return false;
      if (!normalized) return true;
      return [item.name, item.category, item.supplierName].join(" ").toLowerCase().includes(normalized);
    });
  }, [supplies, supplyQuery, supplyCategory]);

  const roomGroups = useMemo(() => {
    const labels = [...rooms];
    quoteLines.forEach((line) => {
      if (line.room && !labels.includes(line.room)) labels.push(line.room);
    });
    return labels;
  }, [rooms, quoteLines]);

  // Panneau gauche : tous les lots deplies par defaut au chargement d'un
  // devis (une seule fois) — l'utilisatrice replie ensuite ce qu'elle veut.
  useEffect(() => {
    if (lotsInitialized) return;
    if (roomGroups.length > 0) {
      setExpandedLotIds(new Set(["Services", ...roomGroups]));
      setTargetRoom(roomGroups[0]);
      setLotsInitialized(true);
    }
  }, [roomGroups, lotsInitialized]);

  const linesByRoom = useMemo(() => {
    const map = {};
    roomGroups.forEach((room) => { map[room] = []; });
    quoteLines.forEach((line) => {
      const room = line.room || "Services";
      (map[room] || (map[room] = [])).push(line);
    });
    Object.keys(map).forEach((room) => {
      map[room].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    });
    return map;
  }, [roomGroups, quoteLines]);

  function moveLine(lineId, direction) {
    const line = quoteLines.find((item) => item.id === lineId);
    if (!line) return;
    const roomLines = linesByRoom[line.room || "Services"] || [];
    const index = roomLines.findIndex((item) => item.id === lineId);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || swapIndex < 0 || swapIndex >= roomLines.length) return;
    const neighbor = roomLines[swapIndex];
    setGeneratedQuote(null);
    setLineSettings((current) => ({
      ...current,
      [line.id]: { ...(current[line.id] || {}), sortOrder: neighbor.sortOrder ?? swapIndex },
      [neighbor.id]: { ...(current[neighbor.id] || {}), sortOrder: line.sortOrder ?? index }
    }));
  }

  const summaryTotals = useMemo(() => {
    const baseHt = totals.ht;
    const breakdown = computeSurchargeBreakdown(baseHt, surcharges);
    const totalHt = breakdown.totalHt;
    const vatAmount = round2(totalHt * (Number(quoteVatRate) / 100));
    const totalTtc = round2(totalHt + vatAmount);
    return { baseHt, surchargeLines: breakdown.lines, surchargeTotal: breakdown.total, totalHt, vatAmount, totalTtc };
  }, [totals.ht, surcharges, quoteVatRate]);

  const selectedProject = useMemo(() => {
    return projects.find((project) => project.id === form.projectId) || projects.find((project) => project.title === form.project) || null;
  }, [form.project, form.projectId, projects]);

  // Etat du devis transmis au chat "Avec l'IA" a chaque message — lui permet
  // de savoir ce qui existe deja sans jamais redemander, ET (21 oct) de
  // cibler une ligne precise par id pour la corriger/supprimer au lieu d'en
  // ajouter une en double (voir lib/devis-chat-prompt.js, qui met ce detail
  // en forme pour le modele).
  const devisChatSnapshot = useMemo(() => ({
    lots: roomGroups.map((room) => ({
      nom: room === "Services" ? L.devis.generalWorks : room,
      lignes: (linesByRoom[room] || []).map((line) => ({
        id: line.id,
        designation: line.label,
        quantite: line.quantity,
        unite: line.unit,
        prixUnitaireHt: line.quantity ? round2(line.totalHt / line.quantity) : 0,
        totalHt: line.totalHt,
        prixManquant: line.priceSource === "manquant"
      }))
    })),
    client: { nom: form.client, telephone: form.clientPhone, email: form.clientEmail, chantier: form.chantierAddress }
  }), [roomGroups, linesByRoom, form.client, form.clientPhone, form.clientEmail, form.chantierAddress, L.devis.generalWorks]);

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

  // Onglet "Lots" du panneau droit : cree le lot et le deplie/cible
  // immediatement a gauche (au lieu de rester replie). Prend un nom
  // optionnel (clic sur une suggestion) — sinon lit le champ libre
  // customRoom, toujours modifiable a la main (22 septembre : les
  // suggestions ne doivent jamais empecher de taper un nom personnalise,
  // corrige un souci de lisibilite sur iPad ou la liste native du
  // datalist pouvait donner l'impression d'un choix ferme).
  function addCustomRoomAndFocus(nameOverride) {
    const label = (nameOverride ?? customRoom).trim();
    if (!label) return;
    setRooms((current) => current.includes(label) ? current : [...current, label]);
    setCustomRoom("");
    setExpandedLotIds((current) => new Set(current).add(label));
    setTargetRoom(label);
  }

  // Clic sur l'en-tete d'un lot a gauche : le cible (pour le panneau de
  // droite) et bascule son repli/depli — les deux en un seul geste.
  function selectAndToggleLot(room) {
    setTargetRoom(room);
    setExpandedLotIds((current) => {
      const next = new Set(current);
      if (next.has(room)) next.delete(room);
      else next.add(room);
      return next;
    });
  }

  function handleRoomPointerDown(event, room) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragRoom(room);
    setDragOverRoom(room);
  }

  function handleRoomPointerMove(event) {
    if (!dragRoom) return;
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const rowEl = target ? target.closest("[data-room-row]") : null;
    const room = rowEl ? rowEl.getAttribute("data-room-row") : null;
    if (room && room !== "Services") setDragOverRoom(room);
  }

  function handleRoomPointerUp() {
    if (dragRoom && dragOverRoom && dragRoom !== dragOverRoom) {
      reorderRooms(dragRoom, dragOverRoom);
    }
    setDragRoom(null);
    setDragOverRoom(null);
  }

  function removeRoom(label) {
    setRooms((current) => current.filter((item) => item !== label));
    clearLineOverride("room", label);
    setTargetRoom((current) => (current === label ? "Services" : current));
    setExpandedLotIds((current) => {
      if (!current.has(label)) return current;
      const next = new Set(current);
      next.delete(label);
      return next;
    });
  }

  // Duplique un lot et toutes ses lignes (nouveaux ids, valeurs figees a
  // l'instant T) dans une copie independante — ne modifie ni le lot ni les
  // lignes d'origine.
  function duplicateRoom(room) {
    let name = `${room} (copie)`;
    let n = 2;
    while (roomGroups.includes(name)) {
      name = `${room} (copie ${n})`;
      n += 1;
    }
    setRooms((current) => {
      const base = current.length ? current : roomGroups.filter((item) => item !== "Services");
      return [...base, name];
    });
    const roomLines = linesByRoom[room] || [];
    const newCustomSources = [];
    const newLineSettings = {};
    roomLines.forEach((line, index) => {
      const id = `copy-${Date.now()}-${index}`;
      newCustomSources.push({
        id,
        code: line.code || "COPY",
        label: line.label,
        unit: line.unit,
        normativeTime: line.normativeTime,
        materialCategories: []
      });
      newLineSettings[id] = {
        room: name,
        label: line.label,
        description: line.description,
        billingMode: line.billingMode,
        quantity: line.quantity != null ? String(line.quantity) : "",
        unit: line.unit,
        normativeTime: line.normativeTime,
        hourlyRate: line.hourlyRate,
        fixedAmountInput: line.fixedAmountInput,
        fixedAmountMode: line.fixedAmountMode,
        adjustmentPercent: line.adjustmentPercent,
        discountPercent: line.discountPercent,
        materialLines: line.materialLines,
        subItems: line.subItems
      };
    });
    setCustomSources((current) => [...current, ...newCustomSources]);
    setLineSettings((current) => ({ ...current, ...newLineSettings }));
    setExpandedLotIds((current) => new Set(current).add(name));
    setGeneratedQuote(null);
  }

  // Reordonne les lots au glisser (liste de droite) — meme logique de "seed"
  // depuis roomGroups que l'ancien systeme de boutons ▲▼, mais insertion a
  // un index arbitraire plutot qu'un echange avec le voisin.
  function reorderRooms(fromRoom, toRoom) {
    if (!fromRoom || !toRoom || fromRoom === toRoom) return;
    setRooms((current) => {
      const base = current.length ? current : roomGroups.filter((item) => item !== "Services");
      const list = base.includes(fromRoom) ? [...base] : [...base, fromRoom];
      const fromIndex = list.indexOf(fromRoom);
      if (fromIndex === -1) return current;
      list.splice(fromIndex, 1);
      const toIndex = list.indexOf(toRoom);
      list.splice(toIndex === -1 ? list.length : toIndex, 0, fromRoom);
      return list;
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
    setTargetRoom((current) => (current === oldName ? trimmed : current));
    setExpandedLotIds((current) => {
      if (!current.has(oldName)) return current;
      const next = new Set(current);
      next.delete(oldName);
      next.add(trimmed);
      return next;
    });
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
    setOuvrageComposer({ open: true, label: "", room, quantity: "1", unit: "u", priceHt: "", error: "" });
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
    const unit = ouvrageComposer.unit || "u";
    setCustomSources((current) => [...current, {
      id,
      code: "PERSO",
      label,
      unit,
      normativeTime: 0,
      materialCategories: []
    }]);
    setLineSettings((current) => ({
      ...current,
      [id]: {
        room: ouvrageComposer.room,
        quantity: ouvrageComposer.quantity || "1",
        unit,
        // normativeTime=1 : meme mecanisme que le "Prix unitaire HT" simple
        // (updateLineUnitPrice) — Quantite x Prix HT = Total HT sans
        // exposer temps/taux a l'utilisatrice pour une creation rapide.
        normativeTime: 1,
        hourlyRate: Number(ouvrageComposer.priceHt || 0)
      }
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

  // Repointe vers l'onglet "Fournitures" du panneau de droite (integre a
  // la page depuis le 19 septembre) au lieu de naviguer vers /fournitures.
  function openFournitureComposer(room = "Services") {
    setTargetRoom(room);
    setExpandedLotIds((current) => new Set(current).add(room));
    setRightPanelTab("fournitures");
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
      chantierAddress: project?.address || project?.fullAddress || current.chantierAddress,
      // Le chantier n'a qu'une adresse en une seule chaine — reprise comme
      // rue, ville/code postal/departement restent a completer a la main.
      chantierAddressDetails: (project?.address || project?.fullAddress)
        ? { ...(current.chantierAddressDetails || {}), address: project.address || project.fullAddress }
        : current.chantierAddressDetails
    }));
  }

  // Rattache un Contact deja enregistre (22 septembre) : pre-remplit
  // l'identite structuree + coordonnees + adresse depuis le contact — meme
  // esprit que selectProject ci-dessus. form.contactId est ensuite envoye
  // tel quel par persistQuoteImpl, qui liait deja le contact au chantier via
  // /api/chantier-contacts des que ce champ est renseigne.
  function selectContact(contactId) {
    if (!contactId) {
      setForm((current) => ({ ...current, contactId: "" }));
      return;
    }
    const contact = contacts.find((item) => item.id === contactId);
    if (!contact) return;
    setForm((current) => ({
      ...current,
      contactId: contact.id,
      clientType: contact.type === "societe" ? "societe" : "particulier",
      clientFirstName: contact.firstName || "",
      clientLastName: contact.lastName || "",
      clientCompanyName: contact.companyName || "",
      clientEmail: contact.email || current.clientEmail,
      clientPhone: contact.phone || current.clientPhone,
      // Le Contact n'a pas de champ "departement" (absent du modele Contact) —
      // laisse vide, a completer manuellement si besoin.
      chantierAddressDetails: {
        ...(current.chantierAddressDetails || {}),
        address: contact.address || current.chantierAddressDetails?.address || "",
        city: contact.city || current.chantierAddressDetails?.city || "",
        postalCode: contact.postalCode || current.chantierAddressDetails?.postalCode || ""
      }
    }));
  }

  // Saisie du nom (23 septembre) : taper un nom deja connu propose le
  // contact correspondant (clientSuggestions ci-dessous, calcule sur
  // `contacts` deja charge) — des qu'elle retape un nom different du contact
  // rattache, on delie ce dernier (sinon l'enregistrement mettrait a jour le
  // MAUVAIS contact avec ce nouveau nom).
  function updateClientNameField(field, value) {
    setForm((current) => ({ ...current, [field]: value, contactId: "" }));
  }

  const clientNameQuery = (form.clientType === "societe" ? form.clientCompanyName : `${form.clientFirstName} ${form.clientLastName}`).trim();
  const clientSuggestions = useMemo(() => {
    if (form.contactId) return [];
    const needle = clientNameQuery.toLowerCase();
    if (needle.length < 2) return [];
    return contacts.filter((contact) => contactDisplayName(contact).toLowerCase().includes(needle)).slice(0, 6);
  }, [contacts, clientNameQuery, form.contactId]);

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

  function toggleLineAdvanced(id) {
    setAdvancedLineIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Champ "Prix unitaire HT" simple (vue non-avancee) : reecrit uniquement
  // hourlyRate a partir du prix affiche, sans toucher normativeTime tant
  // qu'il a deja une valeur reelle (visible en avance) — si normativeTime
  // est encore a 0 (ligne toute neuve), on le fixe a 1 pour que Quantite x
  // Prix unitaire = Total HT reste vrai sans exposer le calcul.
  function updateLineUnitPrice(id, line, settings, rawValue) {
    setGeneratedQuote(null);
    const price = Number(rawValue) || 0;
    setLineSettings((current) => {
      const currentSettings = current[id] || {};
      const normativeTime = Number(currentSettings.normativeTime ?? line.normativeTime ?? 0) || 1;
      return {
        ...current,
        [id]: { ...currentSettings, normativeTime, hourlyRate: price / normativeTime }
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

  function openOuvrageReference(line) {
    const source = ouvrages.find((item) => item.id === line.id);
    if (source) setSelectedOuvrageRef(source);
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

  // Repointe vers l'onglet "Bibliotheque" du panneau de droite (integre a
  // la page depuis le 19 septembre) au lieu de naviguer vers
  // /bibliotheque-ouvrages.
  function openOuvragesLibrary(room = "Services") {
    setTargetRoom(room);
    setExpandedLotIds((current) => new Set(current).add(room));
    setRightPanelTab("bibliotheque");
  }

  // Insere un ouvrage du catalogue dans le lot cible (onglet Bibliotheque,
  // panneau de droite) — meme mecanisme que le retour de
  // /bibliotheque-ouvrages, sans le detour navigation+localStorage.
  function addOuvrageToRoom(ouvrage, room, quantity) {
    setSelectedIds((current) => current.includes(ouvrage.id) ? current : [...current, ouvrage.id]);
    setLineSettings((current) => ({
      ...current,
      [ouvrage.id]: { ...(current[ouvrage.id] || {}), room, quantity: quantity != null ? String(quantity) : (current[ouvrage.id]?.quantity ?? "1") }
    }));
    setExpandedLotIds((current) => new Set(current).add(room));
    setGeneratedQuote(null);
  }

  // Ligne "a chiffrer manuellement" (aucune correspondance catalogue) —
  // meme schema que submitOuvrageComposer, avec un prix a 0€ jamais invente.
  function addUnmatchedOuvrageToRoom(label, room, quantity, unit) {
    const id = uniqueLocalId("koji");
    setCustomSources((current) => [...current, {
      id,
      code: "PERSO",
      label,
      unit: unit || "u",
      normativeTime: 0,
      materialCategories: []
    }]);
    setLineSettings((current) => ({
      ...current,
      [id]: { room, quantity: String(quantity || 1), unit: unit || "u" }
    }));
    setExpandedLotIds((current) => new Set(current).add(room));
    setGeneratedQuote(null);
    return id;
  }

  // Ajout depuis le chat "Avec l'IA" (16 oct) : mêmes fonctions que les
  // onglets Bibliothèque/Fournitures ci-dessus (jamais de prix réimplémenté
  // — resolved vient toujours de /api/devis-chat, qui résout via la même
  // logique catalogue-only que koji-assistant), avec en plus le marquage
  // aiAdded qui alimente le badge "IA · à vérifier" (voir quoteLines plus
  // bas et recalculateLine, qui doit lire explicitement ces 2 champs).
  function addAiOuvrageToRoom(resolved, room, quantity) {
    // resolveOuvrageForLabel (lib/koji-assistant-tools.js) prefixe le libelle
    // non trouve par "À chiffrer manuellement — " pour les endroits qui
    // n'ont aucun autre indicateur visuel ; ici le badge "IA · prix
    // manquant" dit deja la meme chose, le prefixe ne fait plus que
    // forcer l'entreprise a le retirer a la main a chaque fois (signale
    // par Amira).
    const cleanLabel = resolved.label.replace(/^À chiffrer manuellement\s*—\s*/, "");
    const id = resolved.matched
      ? (addOuvrageToRoom(resolved, room, quantity), resolved.id)
      : addUnmatchedOuvrageToRoom(cleanLabel, room, quantity, resolved.unit);
    setLineSettings((current) => ({
      ...current,
      [id]: { ...(current[id] || {}), aiAdded: true, priceSource: resolved.matched ? "catalogue" : "manquant" }
    }));
    // Une ligne sans correspondance catalogue devient la cible de
    // proposer_prix si l'entreprise donne un montant juste apres (16 oct,
    // demande d'Amira) — jamais pour une ligne deja chiffree par le
    // catalogue, remis a vide dans ce cas pour ne jamais ecraser le mauvais
    // prix si l'entreprise en donne un plus tard sans lien avec cette ligne.
    lastUnmatchedAiLineIdRef.current = resolved.matched ? "" : id;
  }

  // Prix donne directement par l'entreprise dans le chat pour la derniere
  // ligne ajoutee sans correspondance catalogue (16 oct) — jamais calcule/
  // estime par l'IA, transcrit tel quel (meme principe que
  // addForfaitLineToRoom plus bas). priceSource passe de "manquant" a
  // "entreprise" : le badge rouge "prix manquant" disparait, le badge ambre
  // "IA · à vérifier" reste (ligne toujours ajoutee par le chat).
  function applyAiManualPrice(amountHt) {
    const id = lastUnmatchedAiLineIdRef.current;
    if (!id || !(Number(amountHt) > 0)) return;
    setLineSettings((current) => ({
      ...current,
      [id]: { ...(current[id] || {}), billingMode: "fixed", fixedAmountInput: String(amountHt), fixedAmountMode: "ht", priceSource: "entreprise" }
    }));
    lastUnmatchedAiLineIdRef.current = "";
  }

  // Correction d'une ligne deja ajoutee par le chat (21 oct, demande
  // d'Amira : avant, une correction de prix/quantite rappelait
  // ajouter_ouvrage et creait un doublon faute de pouvoir cibler la ligne
  // existante). Reutilise EXACTEMENT les memes fonctions que l'edition
  // manuelle — updateLine pour la quantite, updateLineUnitPrice pour le prix
  // unitaire HT (qui recalcule Quantite x Prix unitaire = Total, comme
  // partout ailleurs dans l'editeur) — aucune logique de prix specifique au
  // chat, pour ne jamais diverger de ce que montre le mode Manuel juste a
  // cote.
  function updateAiOuvrageInRoom(id, { quantite, prixUnitaireHt } = {}) {
    const line = quoteLines.find((item) => item.id === id);
    if (!line) return;
    if (quantite != null && Number(quantite) > 0) {
      updateLine(id, "quantity", String(quantite));
    }
    if (prixUnitaireHt != null && Number(prixUnitaireHt) > 0) {
      updateLineUnitPrice(id, line, lineSettings[id] || {}, prixUnitaireHt);
      setLineSettings((current) => ({
        ...current,
        [id]: { ...(current[id] || {}), priceSource: "entreprise" }
      }));
    }
  }

  // Suppression d'une ligne par le chat (21 oct) — meme fonction que le
  // bouton "Retirer" manuel, seule source de verite sur la suppression.
  function removeAiOuvrageFromRoom(id) {
    removeQuoteLine(id);
    if (lastUnmatchedAiLineIdRef.current === id) lastUnmatchedAiLineIdRef.current = "";
  }

  // Informations client posees par le chat "Avec l'IA" (16 oct) — meme
  // mapping que l'ancien pont "koji-devis-page-action" (setClientInfo).
  function applyChatClientInfo(client) {
    if (!client) return;
    setForm((current) => ({
      ...current,
      client: client.nom || current.client,
      clientPhone: client.telephone || current.clientPhone,
      clientEmail: client.email || current.clientEmail,
      chantierAddress: client.chantier || current.chantierAddress
    }));
  }

  // Ligne au forfait a partir d'un montant HT explicitement donne par
  // l'utilisatrice (ex: "5000€ HT pour la peinture complete") — jamais un
  // prix devine : uniquement transcrit tel quel depuis ce qu'elle a
  // elle-meme communique, jamais calcule/estime par l'assistant.
  function addForfaitLineToRoom(label, room, amountHt) {
    const id = uniqueLocalId("koji");
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
      [id]: { room, billingMode: "fixed", fixedAmountInput: String(amountHt), fixedAmountMode: "ht" }
    }));
    setExpandedLotIds((current) => new Set(current).add(room));
    setGeneratedQuote(null);
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

  // Acompte/Solde simplifie (16 oct) : un seul champ pilote le pourcentage
  // des 2 entrees a la fois, la somme a 100% est garantie par construction
  // plutot que seulement validee apres coup (voir requireValidMilestones).
  function updateAcomptePercent(value) {
    const acompte = Math.max(0, Math.min(100, Number(value) || 0));
    setPaymentMilestones((current) => {
      const next = current.length >= 2 ? current : defaultPaymentMilestones();
      return [
        { ...next[0], percent: acompte },
        { ...next[1], percent: round2(100 - acompte) }
      ];
    });
  }

  function updateSoldeLabel(value) {
    setPaymentMilestones((current) => {
      const next = current.length >= 2 ? current : defaultPaymentMilestones();
      return [next[0], { ...next[1], label: value }];
    });
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

  async function saveClientInfo() {
    setSavingClient(true);
    try {
      await persistQuote();
      notify("Informations client et chantier enregistrées.", "success");
      setClientEditing(false);
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

  // Un devis Radar des Chantiers dont l'entreprise a commence a definir ses
  // etapes de paiement doit les boucler a 100 % avant envoi/acceptation —
  // sinon lib/chantier-paiements.js n'a aucun echeancier coherent a creer.
  // Sans etape definie, le fallback (une seule echeance a 100 %) s'applique
  // silencieusement, donc aucun blocage dans ce cas.
  function requireValidMilestones() {
    if (paymentMilestones.length === 0) return true;
    const sum = paymentMilestones.reduce((s, m) => s + Number(m.percent || 0), 0);
    if (sum === 100) return true;
    notify("Les étapes de paiement doivent totaliser 100 % avant d'envoyer ou d'accepter ce devis.", "error");
    return false;
  }

  // Guards against a double-click (or an autosave racing a manual save)
  // firing two concurrent POSTs before the first one returns an id — that
  // created two separate quote rows for the same devis instead of one
  // create + one update. Concurrent callers now await the same in-flight save.
  function persistQuote(manual = true) {
    if (persistQuoteInFlightRef.current) return persistQuoteInFlightRef.current;
    const promise = persistQuoteImpl(manual).finally(() => {
      persistQuoteInFlightRef.current = null;
    });
    persistQuoteInFlightRef.current = promise;
    return promise;
  }

  async function persistQuoteImpl(manual = true) {
    let projectId = selectedProject?.id || form.projectId || "";
    let projectReference = selectedProject?.reference || "";
    let nextProjects = projects;

    // "client"/"chantierAddress" (chaines uniques) restent ce que tout le
    // reste de l'app lit deja (PDF, factures, assistant koji...) — calcules
    // ici depuis les nouveaux champs structures, avec repli sur l'ancienne
    // valeur si les champs structures sont vides (devis non retouche par ce
    // formulaire, ou rempli par l'assistant koji qui ecrit encore "client"
    // directement).
    const derivedClient = contactDisplayName({
      type: form.clientType,
      firstName: form.clientFirstName,
      lastName: form.clientLastName,
      companyName: form.clientCompanyName
    }) || form.client;
    const addressDetails = form.chantierAddressDetails || {};
    const derivedChantierAddress = [addressDetails.address, addressDetails.postalCode, addressDetails.city]
      .filter(Boolean).join(", ") || form.chantierAddress;

    // Synchronisation automatique du client vers le carnet de Contacts (23
    // septembre) : cree ou met a jour le Contact correspondant a chaque
    // enregistrement du devis, pour le retrouver ensuite via les suggestions
    // de saisie (clientSuggestions, plus bas) sans jamais dupliquer un
    // contact deja rattache — meme detection que la page Contacts
    // (findSimilarContacts, lib/contacts.js). Non bloquant : le devis
    // s'enregistre meme si cette synchronisation echoue.
    let contactId = form.contactId || "";
    const hasClientIdentity = form.clientType === "societe"
      ? form.clientCompanyName.trim().length >= 2
      : form.clientLastName.trim().length >= 2;
    if (hasClientIdentity) {
      const contactFields = {
        type: form.clientType,
        firstName: form.clientFirstName,
        lastName: form.clientLastName,
        companyName: form.clientCompanyName,
        phone: form.clientPhone,
        email: form.clientEmail,
        address: addressDetails.address || "",
        city: addressDetails.city || "",
        postalCode: addressDetails.postalCode || ""
      };
      try {
        if (contactId) {
          await apiSend("/api/contacts", { id: contactId, ...contactFields }, "PATCH");
        } else {
          const similar = findSimilarContacts(contacts, { email: form.clientEmail, phone: form.clientPhone });
          if (similar.length) {
            contactId = similar[0].id;
            await apiSend("/api/contacts", { id: contactId, ...contactFields }, "PATCH");
          } else {
            const { contact } = await apiSend("/api/contacts", { ...contactFields, roles: ["client"] });
            contactId = contact.id;
            setContacts((current) => [contact, ...current]);
          }
        }
      } catch {
        contactId = form.contactId || "";
      }
    }

    if (!projectId && isNewChantier) {
      const { project } = await apiSend("/api/projects", {
        title: form.project || "Nouveau chantier",
        client: derivedClient || "Client",
        clientEmail: form.clientEmail,
        address: derivedChantierAddress,
        budgetHt: totals.ht,
        dueDate: form.startDate || todayIso(),
        startDate: form.startDate,
        status: "Devis genere"
      });
      projectId = project.id;
      projectReference = project.reference;
      nextProjects = [project, ...projects];
      setForm((current) => ({ ...current, projectId: project.id }));
    }

    const payload = {
      client: derivedClient || selectedProject?.client || "Client",
      clientReference: form.clientReference,
      clientEmail: form.clientEmail,
      clientPhone: form.clientPhone,
      clientType: form.clientType,
      clientFirstName: form.clientFirstName,
      clientLastName: form.clientLastName,
      clientCompanyName: form.clientCompanyName,
      contactId,
      project: form.project || selectedProject?.title || "Chantier",
      projectId,
      projectReference,
      chantierAddress: derivedChantierAddress,
      chantierAddressDetails: form.chantierAddressDetails,
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
      totalTtc: summaryTotals.totalTtc,
      paymentMilestones
    };

    const isUpdate = Boolean(generatedQuote?.id);
    const { quote } = isUpdate
      ? await apiSend("/api/quotes", { id: generatedQuote.id, action: "update", manualSave: manual, ...payload }, "PATCH")
      : await apiSend("/api/quotes", { ...payload, status: "Brouillon" });

    if (projectId) {
      const { project: syncedProject } = await apiSend("/api/projects", {
        id: projectId,
        title: form.project || selectedProject?.title || "Chantier",
        client: derivedClient || selectedProject?.client || "Client",
        clientEmail: form.clientEmail,
        address: derivedChantierAddress,
        startDate: form.startDate,
        quoteId: quote.id,
        budgetHt: totals.ht,
        status: "Devis genere"
      }, "PATCH");
      nextProjects = nextProjects.map((item) => item.id === syncedProject.id ? syncedProject : item);
      if (contactId) {
        // The dedup check lives server-side (app/api/chantier-contacts POST),
        // so this is safe to call on every save without creating duplicates.
        apiSend("/api/chantier-contacts", { contactId, projectId, roleOnSite: "client" }).catch(() => {});
      }
    }
    setProjects(nextProjects);

    setQuotes((current) => isUpdate
      ? current.map((item) => item.id === quote.id ? quote : item)
      : [quote, ...current]);
    setGeneratedQuote(quote);
    setIsNewChantier(false);
    if (contactId !== form.contactId) setForm((current) => ({ ...current, contactId }));
    return quote;
  }

  async function saveLineDraft(lineId) {
    setSavedLineId(`saving-${lineId}`);
    try {
      await persistQuote();
      setSavedLineId(`saved-${lineId}`);
      setCollapsedLineIds((current) => new Set(current).add(lineId));
      setTimeout(() => setSavedLineId(null), 2000);
    } catch {
      setSavedLineId(null);
    }
  }

  function reopenLine(lineId) {
    setCollapsedLineIds((current) => {
      if (!current.has(lineId)) return current;
      const next = new Set(current);
      next.delete(lineId);
      return next;
    });
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
      notify("Le devis a été envoyé vers Koji Signature. Les accès provisoires client sont prêts.", "success");
    } catch (error) {
      notifyError(error, "Impossible d'envoyer le devis vers Koji Signature.");
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

  async function handleTransformToInvoice() {
    if (!requireLines()) return;
    try {
      const quote = await persistQuote();
      await apiSend("/api/invoices", { transformQuote: true, quoteId: quote.id });
      router.push(`/facturation?quoteId=${quote.id}`);
    } catch (error) {
      notifyError(error, "Impossible de transformer ce devis en facture.");
    }
  }

  function openAcceptComposer() {
    if (!requireLines()) return;
    if (generatedQuote?.signatureStatus === "Signe") {
      notify("Ce devis est déjà accepté.", "info");
      return;
    }
    setAcceptComposer({ open: true, reason: "verbal", note: "" });
  }

  function closeAcceptComposer() {
    setAcceptComposer((current) => ({ ...current, open: false }));
  }

  async function submitAcceptManually() {
    if (!requireValidMilestones()) return;
    try {
      const quote = await persistQuote();
      const { quote: accepted } = await apiSend("/api/quotes", {
        id: quote.id,
        action: "accept-manually",
        acceptanceReason: acceptComposer.reason,
        acceptanceNote: acceptComposer.note
      }, "PATCH");
      setGeneratedQuote(accepted);
      setQuotes((current) => current.map((item) => item.id === accepted.id ? accepted : item));
      closeAcceptComposer();
      notify("Devis marqué comme accepté manuellement.", "success");
    } catch (error) {
      notifyError(error, "Impossible de marquer ce devis comme accepté.");
    }
  }

  async function handleMarkRefused() {
    if (!window.confirm("Marquer ce devis comme refusé par le client ?")) {
      notify("Action annulée.", "info");
      return;
    }
    try {
      const quote = await persistQuote();
      const { quote: refused } = await apiSend("/api/quotes", { id: quote.id, action: "refuse" }, "PATCH");
      setGeneratedQuote(refused);
      setQuotes((current) => current.map((item) => item.id === refused.id ? refused : item));
      notify("Devis marqué comme refusé.", "success");
    } catch (error) {
      notifyError(error, "Impossible de marquer ce devis comme refusé.");
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
      window.location.assign("/");
    } catch (error) {
      notifyError(error, "Impossible de confirmer le devis.");
    }
  }

  // Bouton "Envoyer" de l'en-tete (16 oct) : ouvre desormais la fenetre
  // dediee (SendQuoteModal) plutot que d'envoyer directement. Ne prepare
  // PAS de nouveaux acces ici expres : le mot de passe n'est jamais stocke
  // en clair (voir buildSignatureAccess cote serveur) et chaque appel
  // action:"send" en regenere un nouveau - generer une fois ici puis une
  // seconde fois au clic sur "Envoyer au client" afficherait un mot de
  // passe different de celui reellement envoye par email. La fenetre se
  // charge elle-meme de generer les acces (via "Regenerer" ou directement
  // au clic sur "Envoyer au client").
  async function openSendModal() {
    if (!requireLines()) return;
    if (!requireValidMilestones()) return;
    try {
      await persistQuote();
      setSendModalOpen(true);
    } catch (error) {
      notifyError(error, "Impossible de préparer l'envoi du devis.");
    }
  }

  function handleQuoteSent(quote, { silent } = {}) {
    setGeneratedQuote(quote);
    setQuotes((current) => current.map((item) => item.id === quote.id ? quote : item));
    if (!silent) {
      setSendModalOpen(false);
      notify("Devis envoyé au client par e-mail.", "success");
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
      { id: "sc-assur", label: "Assurance décennale", percent: 8, mode: "excluded", calculationBase: "chiffrage_cumule" }
    ]);
    setPaymentMilestones(defaultPaymentMilestones());
    setQuoteVatRate(20);
    setVatManual(false);
    setDraftQuoteNumber(nextQuoteNumberFromList(quotes));
    setForm({ client: "", clientReference: "", clientEmail: "", clientPhone: "", clientType: "particulier", clientFirstName: "", clientLastName: "", clientCompanyName: "", contactId: "", projectId: "", project: "", propertyType: "Maison", chantierAddress: "", chantierAddressDetails: null, quoteDate: todayIso(), startDate: "", expectedDuration: "", workDescription: "", validityDays: 30 });
    setIsNewChantier(false);
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

  async function handleArchiveQuote() {
    if (!generatedQuote?.id) return;
    if (!window.confirm("Archiver ce devis ?")) {
      notify("Action annulée.", "info");
      return;
    }
    try {
      const { quote } = await apiSend("/api/quotes", { id: generatedQuote.id, action: "archive" }, "PATCH");
      setQuotes((current) => current.map((item) => item.id === quote.id ? quote : item));
      notify("Devis archivé.", "success");
      router.push("/devis");
    } catch (error) {
      notify(error.message || "Impossible d'archiver le devis.", "error");
    }
  }

  async function handleDeleteQuote() {
    if (!generatedQuote?.id) return;
    if (!window.confirm("Supprimer définitivement ce devis ? Cette action est irréversible.")) {
      notify("Action annulée.", "info");
      return;
    }
    try {
      await apiSend("/api/quotes", { id: generatedQuote.id, action: "delete" }, "PATCH");
      setQuotes((current) => current.filter((item) => item.id !== generatedQuote.id));
      notify("Devis supprimé.", "success");
      router.push("/devis");
    } catch (error) {
      notify(error.message || "Impossible de supprimer le devis.", "error");
    }
  }

  function signatureShareText(access = signatureDelivery) {
    if (!access || !generatedQuote) return "";
    const clientName = form.client || generatedQuote.client || "Client";
    return [
      `Bonjour ${clientName},`,
      `Votre devis ${generatedQuote.quoteNumber} est prêt à consulter et signer sur Koji Signature.`,
      `Lien : ${access.loginUrl}`,
      `Identifiant provisoire : ${access.identifier}`,
      `Mot de passe provisoire : ${access.password}`,
      "Après signature, vos accès Koji Particulier seront préparés pour suivre l'avancement du chantier."
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

  // Assistant koji : ajout d'un ouvrage/fourniture/lot directement sur ce
  // devis pendant qu'il est ouvert (20 septembre) — voir la demande envoyee
  // par components/Shell.jsx (evenement "koji-devis-page-action", declenche
  // quand action="devisPageAction" cote serveur). Resout le lot cible
  // (nom mentionne, cree s'il n'existe pas encore, sinon le lot
  // actuellement selectionne) puis reutilise les memes fonctions d'ajout
  // que les onglets Bibliotheque/Fournitures — rien de duplique.
  useEffect(() => {
    function handleDevisPageAction(event) {
      const detail = event.detail || {};
      const { subAction, quantity } = detail;

      function resolveTargetRoom(requestedName) {
        if (!requestedName) return targetRoom;
        const existing = roomGroups.find((r) => r.toLowerCase() === String(requestedName).toLowerCase());
        if (existing) return existing;
        setRooms((current) => current.includes(requestedName) ? current : [...current, requestedName]);
        return requestedName;
      }

      if (subAction === "addLot") {
        const name = detail.lotName || detail.label;
        if (!name) return;
        setRooms((current) => current.includes(name) ? current : [...current, name]);
        setTargetRoom(name);
        setExpandedLotIds((current) => new Set(current).add(name));
        notify(`Lot "${name}" ajouté par l'assistant.`, "success");
        return;
      }

      if (subAction === "setClientInfo") {
        setForm((current) => ({
          ...current,
          client: detail.client || current.client,
          chantierAddress: detail.clientAddress || current.chantierAddress,
          workDescription: detail.description || current.workDescription
        }));
        if (detail.vatRate) {
          setQuoteVatRate(Number(detail.vatRate));
          setVatManual(true);
        }
        if (detail.lotName || detail.forfaitAmount) {
          const room = resolveTargetRoom(detail.lotName);
          if (detail.forfaitAmount) {
            addForfaitLineToRoom(detail.forfaitLabel || detail.client || "Forfait travaux", room, Number(detail.forfaitAmount));
          }
        }
        notify("Informations remplies par l'assistant.", "success");
        return;
      }

      const room = resolveTargetRoom(detail.room);

      if (subAction === "addOuvrage" && detail.ouvrage) {
        if (detail.ouvrage.matched) {
          addOuvrageToRoom(detail.ouvrage, room, quantity);
        } else {
          addUnmatchedOuvrageToRoom(detail.ouvrage.label, room, quantity, detail.ouvrage.unit);
        }
        notify(`Ouvrage ajouté par l'assistant : ${detail.ouvrage.label}`, "success");
        return;
      }

      if (subAction === "addFourniture" && detail.supply) {
        addFournitureLine(detail.supply, quantity, room);
        notify(`Fourniture ajoutée par l'assistant : ${detail.supply.name}`, "success");
      }
    }

    window.addEventListener("koji-devis-page-action", handleDevisPageAction);
    return () => window.removeEventListener("koji-devis-page-action", handleDevisPageAction);
  }, [roomGroups, targetRoom]); // eslint-disable-line react-hooks/exhaustive-deps

  function renderLineCard(line) {
    const settings = lineSettings[line.id] || {};
    const subItems = Array.isArray(line.subItems) ? line.subItems : [];
    const hasSubItems = subItems.length > 0;
    const roomLines = linesByRoom[line.room || "Services"] || [];
    const lineIndex = roomLines.findIndex((item) => item.id === line.id);
    const linkedOuvrage = ouvrages.find((item) => item.id === line.id);
    const lineNumber = lineIndex + 1;
    const isAdvanced = advancedLineIds.has(line.id);

    if (collapsedLineIds.has(line.id)) {
      const qty = Number(settings.quantity ?? line.quantity ?? 0) || (line.billingMode === "fixed" ? 1 : 0);
      const unitPriceHt = qty > 0 ? line.totalHt / qty : line.totalHt;
      return (
        <article key={line.id} className="quote-final-line quote-final-line-collapsed">
          <div className="quote-line-collapsed-row-wrap" ref={lineMenuOpenId === line.id ? lineMenuRef : null}>
            <button type="button" className="quote-line-collapsed-row" onClick={() => reopenLine(line.id)}>
              <span className="quote-line-collapsed-index">{lineNumber}</span>
              <span className="quote-line-collapsed-label">
                {settings.label ?? line.label ?? L.devis.designation}
                {line.aiAdded ? (
                  <span className={`status-pill status-pill-ia${line.priceSource === "manquant" ? " status-pill-ia-missing" : ""}`}>
                    {line.priceSource === "manquant" ? "IA · prix manquant" : "IA · à vérifier"}
                  </span>
                ) : null}
              </span>
              <span className="quote-line-collapsed-qty">{qty > 0 ? qty : "—"}</span>
              <span className="quote-line-collapsed-unit">{(settings.unit ?? line.unit ?? "u").toUpperCase()}</span>
              <span className="quote-line-collapsed-unitprice">{money(unitPriceHt)}</span>
              <strong className="quote-line-collapsed-total">{money(line.totalHt)}</strong>
            </button>
            <button
              type="button"
              className="quote-line-menu-trigger"
              onClick={(event) => { event.stopPropagation(); setLineMenuOpenId((current) => current === line.id ? null : line.id); }}
              aria-label={L.devis.advancedDetails}
            >⋮</button>
            {lineMenuOpenId === line.id ? (
              <div className="quote-line-menu-dropdown">
                <button type="button" disabled={lineIndex <= 0} onClick={() => { setLineMenuOpenId(null); moveLine(line.id, "up"); }}>{L.devis.moveUp}</button>
                <button type="button" disabled={lineIndex === -1 || lineIndex >= roomLines.length - 1} onClick={() => { setLineMenuOpenId(null); moveLine(line.id, "down"); }}>{L.devis.moveDown}</button>
                {linkedOuvrage ? (
                  <button type="button" onClick={() => { setLineMenuOpenId(null); openOuvrageReference(line); }}>{L.devis.openBtn}</button>
                ) : null}
                <button type="button" className="danger" onClick={() => { setLineMenuOpenId(null); reopenLine(line.id); setConfirmDeleteLineId(line.id); }}>{L.common.delete}</button>
              </div>
            ) : null}
          </div>
          {hasSubItems ? (
            <div className="quote-line-collapsed-subs">
              {subItems.map((sub, subIndex) => {
                const subQty = Number(sub.quantity || 0) || (sub.billingMode === "fixed" ? 1 : 0);
                const subUnitPriceHt = subQty > 0 ? sub.totalHt / subQty : sub.totalHt;
                return (
                  <div className="quote-line-collapsed-row quote-line-collapsed-sub" key={sub.id}>
                    <span className="quote-line-collapsed-index">{lineNumber}.{subIndex + 1}</span>
                    <span className="quote-line-collapsed-label">{sub.label || L.devis.designation}</span>
                    <span className="quote-line-collapsed-qty">{subQty > 0 ? subQty : "—"}</span>
                    <span className="quote-line-collapsed-unit">{(sub.unit || "u").toUpperCase()}</span>
                    <span className="quote-line-collapsed-unitprice">{money(subUnitPriceHt)}</span>
                    <strong className="quote-line-collapsed-total">{money(sub.totalHt)}</strong>
                  </div>
                );
              })}
            </div>
          ) : null}
        </article>
      );
    }

    return (
      <article key={line.id} className={`quote-final-line${hasSubItems ? " has-sub-items" : ""}`}>
        <header>
          <input className="quote-line-label-input quote-line-label-input-header" value={settings.label ?? line.label ?? ""} onChange={(event) => updateLineLabel(line.id, event.target.value)} placeholder={L.devis.designation} />
          {line.aiAdded ? (
            <span className={`status-pill status-pill-ia${line.priceSource === "manquant" ? " status-pill-ia-missing" : ""}`}>
              {line.priceSource === "manquant" ? "IA · prix manquant" : "IA · à vérifier"}
            </span>
          ) : null}
          <div className="quote-line-menu-wrap" ref={lineMenuOpenId === line.id ? lineMenuRef : null}>
            <button
              type="button"
              className="quote-line-menu-trigger"
              onClick={() => setLineMenuOpenId((current) => current === line.id ? null : line.id)}
              aria-label={L.devis.advancedDetails}
            >⋮</button>
            {lineMenuOpenId === line.id ? (
              <div className="quote-line-menu-dropdown">
                <button type="button" disabled={lineIndex <= 0} onClick={() => { setLineMenuOpenId(null); moveLine(line.id, "up"); }}>{L.devis.moveUp}</button>
                <button type="button" disabled={lineIndex === -1 || lineIndex >= roomLines.length - 1} onClick={() => { setLineMenuOpenId(null); moveLine(line.id, "down"); }}>{L.devis.moveDown}</button>
                {linkedOuvrage ? (
                  <button type="button" onClick={() => { setLineMenuOpenId(null); openOuvrageReference(line); }}>{L.devis.openBtn}</button>
                ) : null}
                <button type="button" onClick={() => { setLineMenuOpenId(null); toggleLineAdvanced(line.id); }}>{L.devis.advancedDetails}</button>
                <button type="button" className="danger" onClick={() => { setLineMenuOpenId(null); setConfirmDeleteLineId(line.id); }}>{L.common.delete}</button>
              </div>
            ) : null}
          </div>
        </header>
        <label className="quote-line-description">
          <span>{L.devis.descriptionClient}</span>
          <textarea
            rows={2}
            value={settings.description ?? line.description ?? ""}
            onChange={(event) => updateLine(line.id, "description", event.target.value)}
            placeholder={L.devis.descriptionPlaceholder}
          />
        </label>
        {!hasSubItems ? (
          <>
            <div className="quote-line-inputs compact quote-line-inputs-simple">
              {line.billingMode === "fixed" ? (
                <label className="forfait-amount-field">{L.devis.fixedAmount}<input type="number" min="0" step="0.01" value={settings.fixedAmountInput ?? line.fixedAmountInput ?? ""} onChange={(event) => updateLine(line.id, "fixedAmountInput", event.target.value)} /></label>
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
                  <label>{L.devis.priceHt}<input type="number" min="0" step="0.01" value={formatNumberInput((settings.normativeTime ?? line.normativeTime ?? 0) * (settings.hourlyRate ?? line.hourlyRate ?? 0))} onChange={(event) => updateLineUnitPrice(line.id, line, settings, event.target.value)} placeholder="0.00" /></label>
                </>
              )}
            </div>

            {isAdvanced ? (
              <div className="quote-line-advanced">
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
                      <label>{L.devis.duration}<input type="number" min="0" step="any" value={settings.fixedDuration ?? ""} onChange={(event) => updateLine(line.id, "fixedDuration", event.target.value)} placeholder="0" /></label>
                      <label>{L.bibliotheque.unit}<select value={settings.fixedDurationUnit ?? "h"} onChange={(event) => updateLine(line.id, "fixedDurationUnit", event.target.value)}>
                        <option value="h">{L.devis.hours}</option>
                        <option value="j">Jours</option>
                      </select></label>
                    </>
                  ) : (
                    <>
                      <label>{L.bibliotheque.time} h/{settings.unit ?? line.unit ?? "u"}<input type="number" min="0" step="any" value={settings.normativeTime ?? (line.normativeTime > 0 ? line.normativeTime : "")} onChange={(event) => updateLine(line.id, "normativeTime", event.target.value)} placeholder="0" /></label>
                      <label>{L.devis.hourlyRate}<input type="number" min="0" step="any" value={settings.hourlyRate ?? (company.hourlyRate > 0 ? company.hourlyRate : "")} onChange={(event) => updateLine(line.id, "hourlyRate", event.target.value)} placeholder={company.hourlyRate > 0 ? String(company.hourlyRate) : "0"} /></label>
                      <label>{L.devis.adjustment}<input type="number" min="0" step="0.5" value={line.adjustmentPercent || ""} onChange={(event) => updateLine(line.id, "adjustmentPercent", event.target.value)} /></label>
                      <label>{L.devis.discountPct}<input type="number" min="0" step="0.5" value={line.discountPercent || ""} onChange={(event) => updateLine(line.id, "discountPercent", event.target.value)} /></label>
                    </>
                  )}
                </div>
                {linkedOuvrage && (linkedOuvrage.noteInterne || linkedOuvrage.sourceInterne) ? (
                  <div className="quote-line-internal-ref">
                    {linkedOuvrage.noteInterne ? <p><span>{L.devis.noteInterne}</span>{linkedOuvrage.noteInterne}</p> : null}
                    {linkedOuvrage.sourceInterne ? <p><span>{L.devis.sourceInterne}</span>{linkedOuvrage.sourceInterne}</p> : null}
                  </div>
                ) : null}
              </div>
            ) : null}

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
                  <span>{L.nav.supplies}: {money(line.materialCost)}</span>
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
                    <span>{L.nav.supplies}</span>
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
        {(hasSubItems || isAdvanced) ? (
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
        ) : null}
        <div className="quote-line-save-bar">
          {confirmDeleteLineId === line.id ? (
            <span className="quote-line-confirm-delete">
              <span>{L.devis.deleteWork}</span>
              <button type="button" className="quote-line-confirm-yes" onClick={() => removeQuoteLine(line.id)}>{L.devis.yesDelete}</button>
              <button type="button" className="quote-line-confirm-no" onClick={() => setConfirmDeleteLineId(null)}>{L.common.cancel}</button>
            </span>
          ) : (
            <button
              type="button"
              className={`quote-line-save-btn${savedLineId === `saving-${line.id}` ? " saving" : ""}${savedLineId === `saved-${line.id}` ? " saved" : ""}`}
              onClick={() => saveLineDraft(line.id)}
            >
              {savedLineId === `saving-${line.id}` ? L.devis.saving : savedLineId === `saved-${line.id}` ? L.devis.saved : L.devis.save}
            </button>
          )}
        </div>
      </article>
    );
  }

  // Panneau "Devis en préparation" du mode Avec l'IA (16 oct, maquette
  // Artifact DevisCreerIA) — lecture seule et volontairement plus simple
  // que les cartes de lot du mode Manuel (pas de menu avancé, pas de
  // glisser-déposer) : reprend juste roomGroups/linesByRoom/summaryTotals
  // déjà calculés, avec le badge "IA · à vérifier" sur les lignes ajoutées
  // par le chat (line.aiAdded, voir quoteLines plus haut).
  function renderAiPreviewCard() {
    return (
      <section className="quote-final-card quote-ia-preview-card">
        <div className="quote-section-title">
          <div>
            <span>Devis en préparation</span>
            <h2>Se remplit au fil de la conversation</h2>
          </div>
        </div>
        <p className="quote-ia-preview-banner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
          Prix issus de la bibliothèque koji : temps normatif × taux horaire. L'IA n'invente aucun prix.
        </p>

        {roomGroups.every((room) => (linesByRoom[room] || []).length === 0) ? (
          <div className="empty-state">Les lots et lignes ajoutés par l'assistant apparaîtront ici.</div>
        ) : (
          roomGroups.map((room) => {
            const roomLines = linesByRoom[room] || [];
            if (!roomLines.length) return null;
            const roomTotalHt = roomLines.reduce((s, l) => s + l.totalHt, 0);
            return (
              <div className="quote-ia-preview-lot" key={room}>
                <div className="quote-ia-preview-lot-head">
                  <strong>{room === "Services" ? L.devis.generalWorks : room}</strong>
                  <span>{roomLines.length} ligne{roomLines.length > 1 ? "s" : ""}</span>
                  <strong>{money(roomTotalHt)}</strong>
                </div>
                {roomLines.map((line) => {
                  const qty = Number(line.quantity || 0);
                  const unitPriceHt = qty > 0 ? line.totalHt / qty : line.totalHt;
                  return (
                    <div className="quote-ia-preview-line" key={line.id}>
                      <div className="quote-ia-preview-line-label">
                        {line.code ? <small>{line.code}</small> : null}
                        <span>
                          {line.label}
                          {line.aiAdded ? (
                            <span className={`status-pill status-pill-ia${line.priceSource === "manquant" ? " status-pill-ia-missing" : ""}`}>
                              {line.priceSource === "manquant" ? "IA · prix manquant" : "IA · à vérifier"}
                            </span>
                          ) : null}
                        </span>
                      </div>
                      <span>{qty || "—"}</span>
                      <span>{line.unit}</span>
                      <span>{money(unitPriceHt)}</span>
                      <strong>{money(line.totalHt)}</strong>
                      <button type="button" className="quote-ia-preview-remove" onClick={() => removeQuoteLine(line.id)} aria-label="Supprimer">×</button>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}

        <div className="quote-lots-footer-right quote-ia-preview-totals">
          <div><span>{L.devis.totalHtGen}</span><strong>{money(summaryTotals.totalHt)}</strong></div>
          <div><span>TVA</span><strong>{money(summaryTotals.vatAmount)}</strong></div>
          <div className="total"><span>{L.devis.totalTtcGen}</span><strong>{money(summaryTotals.totalTtc)}</strong></div>
        </div>

        <div className="quote-ia-preview-actions">
          <button type="button" className="button secondary" onClick={() => setMode("manuel")}>Passer en édition manuelle</button>
          <button type="button" className="button blue" onClick={() => setMode("manuel")}>Valider et ajuster</button>
        </div>
      </section>
    );
  }

  return (
    <Shell>
      <header className="page-header quote-final-header quote-final-header-v2">
        <button type="button" className="avenant-back-btn" aria-label="Retour" onClick={() => router.push("/devis")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <div className="quote-final-header-title">
          <p className="eyebrow">{L.devis.quoteNum} {previewQuoteNumber} · {L.devis.versionNum} {previewVersionNumber}</p>
          <h1>{L.devis.newQuote}</h1>
        </div>
        <div className="quote-mode-toggle segmented large">
          <button type="button" className={mode === "manuel" ? "active" : ""} onClick={() => setMode("manuel")}>{L.devis.modeManual}</button>
          <button type="button" className={mode === "ia" ? "active" : ""} onClick={() => setMode("ia")}>{L.devis.modeAi}</button>
        </div>
        <div className="quote-final-actions">
          <button type="button" className="button secondary" onClick={() => handlePreview()}>{L.devis.preview}</button>
          <button type="button" className="button secondary" onClick={handleGenerate}>{L.devis.save}</button>
          <button type="button" className="button secondary" onClick={handleTransformToInvoice}>{L.devis.transformToInvoice}</button>
          <button type="button" className="button blue" onClick={openSendModal}>{L.devis.send}</button>
          <button type="button" className="quote-tools-drawer-trigger" onClick={() => setToolsDrawerOpen(true)}>
            <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.1-3.1a4 4 0 0 1-5.4 5.4L6 20 4 18l8.4-9.4a4 4 0 0 1 5.4-5.4l-3.1 3.1Z" /></svg>
            {L.devis.tabTools}
          </button>
        </div>
      </header>

      <form className="quote-final-page" onSubmit={(event) => event.preventDefault()}>
        {/* Numero/version deja dans l'eyebrow de l'en-tete (16 oct) — cette
            barre ne s'affiche plus que si elle a quelque chose de reellement
            utile a montrer (client, ou total de marche mis a jour par un
            avenant signe), pour ne pas laisser une carte vide/redondante. */}
        {form.client || form.chantierAddress || avenants.some((item) => item.status === "Signe") ? (
          <div className="quote-meta-bar">
            {avenants.some((item) => item.status === "Signe") ? (
              <div className="quote-meta-number">
                <span className="quote-meta-version">{L.avenants.marketTotalUpdated} : {money(cumulativeMarketTotal(generatedQuote, avenants))}</span>
              </div>
            ) : null}
            {form.client || form.chantierAddress ? (
              <div className="quote-meta-client">
                {form.client ? <strong>{form.client}</strong> : null}
                {form.chantierAddress ? <span>{form.chantierAddress}</span> : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div
          className={`quote-tools-drawer-backdrop ${toolsDrawerOpen ? "open" : ""}`}
          onClick={() => setToolsDrawerOpen(false)}
        />

        <div className={`quote-two-col${mode === "ia" ? " quote-two-col-ia" : ""}`}>
          <div className="quote-col-left">
            {mode === "ia" ? (
              <DevisChatPanel
                quoteSnapshot={devisChatSnapshot}
                onAddLot={addCustomRoomAndFocus}
                onAddOuvrage={addAiOuvrageToRoom}
                onUpdateOuvrage={updateAiOuvrageInRoom}
                onRemoveOuvrage={removeAiOuvrageFromRoom}
                onSetPrice={applyAiManualPrice}
                onSetClient={applyChatClientInfo}
                onFinish={() => setMode("manuel")}
              />
            ) : null}
            <div style={mode === "ia" ? { display: "none" } : undefined}>
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

            {(
              // "Services" ("Travaux généraux") ne s'affiche plus comme une
              // carte vide par defaut (30 sept, demande d'Amira) — uniquement
              // si elle contient deja des lignes, ou si elle a ete creee
              // explicitement par l'entreprise via le selecteur de lot.
              roomGroups.includes("Services") || (linesByRoom.Services || []).length > 0
                ? ["Services", ...roomGroups.filter((r) => r !== "Services")]
                : roomGroups.filter((r) => r !== "Services")
            ).map((room) => {
              const roomLines = linesByRoom[room] || [];
              const roomTotalHt = roomLines.reduce((s, l) => s + l.totalHt, 0);
              const isExpanded = expandedLotIds.has(room);
              const isTargeted = targetRoom === room;
              return (
                <section key={room} className={`quote-final-card quote-room-card quote-lot-editor${isTargeted ? " targeted" : ""}`}>
                  <button type="button" className="quote-section-title quote-room-title-row quote-lot-header-refined quote-lot-header-btn" onClick={() => selectAndToggleLot(room)}>
                    <span className="quote-lot-number-badge">
                      <span className="quote-lot-number-badge-emoji" aria-hidden="true">📦</span>
                      {room === "Services" ? "•" : roomGroups.filter((r) => r !== "Services").indexOf(room) + 1}
                    </span>
                    {room === "Services" ? (
                      <h2 className="quote-lot-name">{L.devis.generalWorks}</h2>
                    ) : (
                      <div className="quote-lot-name-edit">
                        <input
                          key={room}
                          className="quote-room-name-input"
                          defaultValue={room}
                          onClick={(e) => e.stopPropagation()}
                          onBlur={(e) => renameRoom(room, e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
                          placeholder="Nom du lot…"
                        />
                        <svg className="quote-lot-edit-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                      </div>
                    )}
                    <span className="quote-room-subtotal-badge">{money(roomTotalHt)} HT</span>
                    <svg className={`svg-icon quote-lot-chevron ${isExpanded ? "open" : ""}`} viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" /></svg>
                  </button>

                  {isExpanded ? (
                    <>
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
                        <div className="quote-final-lines">
                          {roomLines.map((line) => renderLineCard(line))}
                        </div>
                      )}

                      <div className="quote-add-line-row" ref={addLineMenuRoom === room ? addLineMenuRef : null}>
                        <button type="button" className="quote-add-line-btn" onClick={() => setAddLineMenuRoom((current) => current === room ? null : room)} aria-expanded={addLineMenuRoom === room}>
                          <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" d="M12 5v14M5 12h14" /></svg>
                          {L.devis.addLineFull}
                        </button>
                        {addLineMenuRoom === room ? (
                          <div className="quote-add-line-dropdown">
                            <button type="button" onClick={() => { setAddLineMenuRoom(null); openOuvragesLibrary(room); }}>
                              <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 6.5C10.5 5.5 8 5 4 5v13c4 0 6.5.5 8 1.5M12 6.5c1.5-1 4-1.5 8-1.5v13c-4 0-6.5.5-8 1.5M12 6.5v13" /></svg>
                              {L.devis.library}
                            </button>
                            <button type="button" onClick={() => { setAddLineMenuRoom(null); openOuvrageComposer(room); }}>
                              <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" /><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M12 8v8M8 12h8" /></svg>
                              {L.devis.createWork}
                            </button>
                            <button type="button" onClick={() => { setAddLineMenuRoom(null); openFournitureComposer(room); }}>
                              <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="20" r="1.5" fill="currentColor" /><circle cx="18" cy="20" r="1.5" fill="currentColor" /><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 4h2l2.4 12.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L22 7H6" /></svg>
                              {L.devis.addSupplyBtn}
                            </button>
                            <button type="button" onClick={() => { setAddLineMenuRoom(null); openNoteComposer(room); }}>
                              <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                              {L.devis.noteBtn}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </section>
              );
            })}

            <section className="quote-final-card quote-lots-footer">
              <button type="button" className="quote-totals-detail-toggle" onClick={() => setTotalsDetailOpen((open) => !open)}>
                {totalsDetailOpen ? "▾" : "▸"} {L.devis.detailsBtn}
              </button>
              {totalsDetailOpen ? (
                <div className="quote-total-panel-compact">
                  <div><span>{L.devis.totalHours}</span><strong>{totals.hours.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} h</strong></div>
                  <div><span>{L.devis.laborHt}</span><strong>{money(totals.labor)}</strong></div>
                  <div><span>{L.devis.suppliesHt}</span><strong>{money(totals.supplies)}</strong></div>
                  <div><span>{L.devis.subtotalHt}</span><strong>{money(totals.ht)}</strong></div>
                </div>
              ) : null}
              <div className="quote-lots-footer-left">
                <div><span>{L.devis.worksTotal}</span><strong>{money(lotTotals.works)}</strong></div>
                <div><span>{L.devis.suppliesTotal}</span><strong>{money(lotTotals.supplies)}</strong></div>
              </div>
              <div className="quote-lots-footer-right">
                <div><span>{L.devis.totalHtGen}</span><strong>{money(summaryTotals.totalHt)}</strong></div>
                <div><span>TVA</span><strong>{money(summaryTotals.vatAmount)}</strong></div>
                <div className="total"><span>{L.devis.totalTtcGen}</span><strong>{money(summaryTotals.totalTtc)}</strong></div>
              </div>
            </section>
            </div>
          </div>

          <div className={`quote-col-right ${toolsDrawerOpen ? "open" : ""}`}>
            {mode === "ia" ? renderAiPreviewCard() : null}
            <div style={mode === "ia" ? { display: "none" } : undefined}>
            <button type="button" className="quote-tools-drawer-close" onClick={() => setToolsDrawerOpen(false)} aria-label={L.common.cancel}>×</button>
            <div className="quote-right-tabs">
              <button type="button" className={rightPanelTab === "client" ? "active" : ""} onClick={() => setRightPanelTab("client")}>{L.devis.tabClient}</button>
              <button type="button" className={rightPanelTab === "lots" ? "active" : ""} onClick={() => setRightPanelTab("lots")}>{L.devis.tabLots}</button>
              <button type="button" className={rightPanelTab === "bibliotheque" ? "active" : ""} onClick={() => setRightPanelTab("bibliotheque")}>{L.devis.library}</button>
              <button type="button" className={rightPanelTab === "fournitures" ? "active" : ""} onClick={() => setRightPanelTab("fournitures")}>{L.nav.supplies}</button>
              {generatedQuote?.signatureStatus === "Signe" ? (
                <button type="button" className={rightPanelTab === "avenants" ? "active" : ""} onClick={() => setRightPanelTab("avenants")}>{L.avenants.tabAvenants}</button>
              ) : null}
            </div>

            {rightPanelTab === "client" && !clientEditing ? (
              <section className="quote-final-card quote-client-card">
                <div className="quote-client-summary">
                  <div><span>{L.devis.client}</span><strong>{contactDisplayName({ type: form.clientType, firstName: form.clientFirstName, lastName: form.clientLastName, companyName: form.clientCompanyName }) || form.client || "—"}</strong></div>
                  <div><span>{L.devis.clientPhone}</span><strong>{form.clientPhone || "—"}</strong></div>
                  <div><span>{L.devis.clientEmail}</span><strong>{form.clientEmail || "—"}</strong></div>
                  <div><span>{L.devis.clientAddress}</span><strong>{[form.chantierAddressDetails?.address, form.chantierAddressDetails?.postalCode, form.chantierAddressDetails?.city].filter(Boolean).join(", ") || form.chantierAddress || "—"}</strong></div>
                  {form.chantierAddressDetails?.department ? (
                    <div><span>{L.devis.department}</span><strong>{form.chantierAddressDetails.department}</strong></div>
                  ) : null}
                  <div><span>{L.devis.project}</span><strong>{form.project || "—"}</strong></div>
                </div>
                <button type="button" className="button secondary" onClick={() => setClientEditing(true)}>{L.common.edit}</button>
              </section>
            ) : null}

            {rightPanelTab === "client" && clientEditing ? (
              <section className="quote-final-card quote-client-card">
                <div className="quote-client-grid quote-client-grid-pair">
                  <label>{L.devis.clientRef}<input value={form.clientReference} onChange={(event) => setField("clientReference", event.target.value)} placeholder={L.devis.clientRef} /></label>
                  <div className="wide">
                    <span className="quote-client-type-label">{L.contacts.typeLabel}</span>
                    <div className="segmented large">
                      <button type="button" className={form.clientType !== "societe" ? "active" : ""} onClick={() => setField("clientType", "particulier")}>{L.contacts.typeParticulier}</button>
                      <button type="button" className={form.clientType === "societe" ? "active" : ""} onClick={() => setField("clientType", "societe")}>{L.contacts.typeSociete}</button>
                    </div>
                  </div>
                  {form.clientType === "societe" ? (
                    <label className="wide">{L.contacts.companyName}<input value={form.clientCompanyName} onChange={(event) => updateClientNameField("clientCompanyName", event.target.value)} placeholder={L.contacts.companyName} /></label>
                  ) : (
                    <>
                      <label>{L.contacts.firstName}<input value={form.clientFirstName} onChange={(event) => updateClientNameField("clientFirstName", event.target.value)} placeholder={L.contacts.firstName} /></label>
                      <label>{L.contacts.lastName}<input value={form.clientLastName} onChange={(event) => updateClientNameField("clientLastName", event.target.value)} placeholder={L.contacts.lastName} /></label>
                    </>
                  )}
                  {clientSuggestions.length ? (
                    <div className="wide quote-client-suggestions">
                      <span className="quote-client-suggestions-hint">{L.devis.clientSuggestHint}</span>
                      {clientSuggestions.map((contact) => (
                        <button type="button" key={contact.id} className="quote-client-suggestion-chip" onClick={() => selectContact(contact.id)}>
                          <strong>{contactDisplayName(contact)}</strong>
                          {contact.phone || contact.email ? <span>{[contact.phone, contact.email].filter(Boolean).join(" · ")}</span> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {form.contactId ? (
                    <div className="wide quote-client-linked-hint">
                      {L.devis.clientLinked}
                      <button type="button" onClick={() => selectContact("")}>{L.devis.clientUnlink}</button>
                    </div>
                  ) : null}
                  <label>{L.devis.clientPhone}<input value={form.clientPhone} onChange={(event) => setField("clientPhone", event.target.value)} placeholder="06 12 34 56 78" /></label>
                  <label>{L.devis.clientEmail}<input type="email" value={form.clientEmail} onChange={(event) => setField("clientEmail", event.target.value)} placeholder="client@email.fr" /></label>
                  <div className="wide">
                    <span className="quote-client-type-label">{L.devis.clientAddress}</span>
                    <AddressFields
                      value={form.chantierAddressDetails}
                      onChange={(next) => setField("chantierAddressDetails", next)}
                      showDepartment
                    />
                  </div>
                  <label>{L.devis.project}<select value={isNewChantier && !form.projectId ? "nouveau" : form.projectId} onChange={(event) => {
                    if (event.target.value === "nouveau") {
                      setForm((current) => ({ ...current, projectId: "", project: "", client: current.client, clientEmail: current.clientEmail, clientPhone: current.clientPhone, chantierAddress: "", chantierAddressDetails: null }));
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
                  {generatedQuote?.id && !form.projectId && !isNewChantier ? (
                    <button type="button" className="button secondary quote-create-site-btn" onClick={() => setIsNewChantier(true)}>
                      {L.devis.createSiteFromQuote}
                    </button>
                  ) : null}
                  {isNewChantier && !form.projectId ? (
                    <label>{L.devis.siteName}<input value={form.project} onChange={(event) => setField("project", event.target.value)} placeholder={L.devis.siteName} autoFocus /></label>
                  ) : null}
                  <label>{L.devis.creationDate}<input type="date" value={form.quoteDate} onChange={(event) => setField("quoteDate", event.target.value)} /></label>
                  <label>{L.devis.startDate}<input type="date" value={form.startDate} onChange={(event) => setField("startDate", event.target.value)} /></label>
                  <label>{L.devis.expectedDur}<input value={form.expectedDuration} onChange={(event) => setField("expectedDuration", event.target.value)} placeholder="Ex: 10 jours" /></label>
                  <label>{L.devis.propertyType}<select value={form.propertyType} onChange={(event) => setField("propertyType", event.target.value)}>
                    <option>Maison</option>
                    <option>Appartement</option>
                    <option>Local</option>
                    <option>Autre</option>
                  </select></label>
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
              </section>
            ) : null}

            {rightPanelTab === "lots" ? (
              <section className="quote-final-card quote-lots-list-card">
                <div className="quote-section-title">
                  <div>
                    <span>{L.devis.organization}</span>
                    <h2>{L.devis.lotsTitle}</h2>
                  </div>
                </div>
                <div className="room-add-card">
                  <div className="room-add-row">
                    <input
                      value={customRoom}
                      onChange={(event) => setCustomRoom(event.target.value)}
                      placeholder={L.devis.roomPh}
                      onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomRoomAndFocus(); } }}
                    />
                    <button type="button" onClick={() => addCustomRoomAndFocus()}>+</button>
                  </div>
                  <div className="room-add-suggestions">
                    {ROOM_SUGGESTIONS.map((room) => (
                      <button type="button" key={room} className="room-add-suggestion-chip" onClick={() => addCustomRoomAndFocus(room)}>
                        {room}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="lot-list">
                  {roomGroups.filter((room) => room !== "Services").map((room) => (
                    <div
                      key={room}
                      data-room-row={room}
                      className={`lot-list-row ${targetRoom === room ? "active" : ""} ${dragOverRoom === room && dragRoom && dragRoom !== room ? "drag-over" : ""} ${dragRoom === room ? "dragging" : ""}`}
                    >
                      <span
                        className="lot-list-drag-handle"
                        onPointerDown={(e) => handleRoomPointerDown(e, room)}
                        onPointerMove={handleRoomPointerMove}
                        onPointerUp={handleRoomPointerUp}
                        onPointerCancel={handleRoomPointerUp}
                        aria-hidden="true"
                      >⠿</span>
                      <button type="button" className="lot-list-label" onClick={() => setTargetRoom(room)}>{room}</button>
                      <button type="button" className="lot-list-duplicate" onClick={() => duplicateRoom(room)} aria-label={L.devis.duplicateLot} title={L.devis.duplicateLot}>⧉</button>
                      <button type="button" className="lot-list-remove" onClick={() => removeRoom(room)} aria-label={`Retirer ${room}`}>×</button>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {rightPanelTab === "bibliotheque" ? (
              <section className="quote-final-card quote-picker-card">
                <p className="quote-picker-hint">{L.devis.addToLot} : <strong>{targetRoom === "Services" ? L.devis.generalWorks : targetRoom}</strong></p>
                <input
                  className="quote-picker-search"
                  value={libraryQuery}
                  onChange={(event) => setLibraryQuery(event.target.value)}
                  placeholder={L.bibliotheque.search}
                />
                <div className="quote-picker-chips">
                  <button type="button" className={!libraryFamily ? "active" : ""} onClick={() => setLibraryFamily("")}>{L.fournitures.all}</button>
                  {libraryFamilies.map((family) => (
                    <button type="button" key={family} className={libraryFamily === family ? "active" : ""} onClick={() => setLibraryFamily(family)}>{family}</button>
                  ))}
                </div>
                <div className="quote-picker-list">
                  {filteredLibraryItems.map((item) => {
                    const unitPrice = Number(item.normativeTime || 0) * (Number(item.hourlyRate || 0) || company.hourlyRate || 0);
                    return (
                      <div className="quote-picker-row" key={item.id}>
                        <div className="quote-picker-row-main">
                          <span className="quote-picker-row-code">{item.code}</span>
                          <strong>{item.label}</strong>
                          <span className="quote-picker-row-stats">{L.bibliotheque.time} : {item.normativeTime || 0} h/{item.unit || "u"} · {money(unitPrice)} HT</span>
                        </div>
                        <button type="button" className="quote-picker-add-btn" onClick={() => addOuvrageToRoom(item, targetRoom)}>{L.bibliotheque.addToCatalog}</button>
                      </div>
                    );
                  })}
                  {!filteredLibraryItems.length ? <p className="empty-state">{L.bibliotheque.noFound}</p> : null}
                </div>
                <div className="quote-picker-footer">
                  <button type="button" className="button secondary" onClick={() => (ouvrageComposer.open ? closeOuvrageComposer() : openOuvrageComposer(targetRoom))}>
                    {ouvrageComposer.open ? "▾" : "+"} {L.devis.createWork}
                  </button>
                  <Link className="quote-picker-full-link" href="/bibliotheque-ouvrages">{L.bibliotheque.title} →</Link>
                </div>

                {ouvrageComposer.open ? (
                  <div className="quote-picker-inline-form">
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
                    <label className="supply-composer-field">
                      <span>{L.devis.quantity}</span>
                      <input type="number" min="0" step="any" value={ouvrageComposer.quantity} onChange={(event) => setOuvrageComposerField("quantity", event.target.value)} placeholder="1" />
                    </label>
                    <label className="supply-composer-field">
                      <span>{L.bibliotheque.unit}</span>
                      <select value={ouvrageComposer.unit} onChange={(event) => setOuvrageComposerField("unit", event.target.value)}>
                        {CUSTOM_OUVRAGE_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                      </select>
                    </label>
                    <label className="supply-composer-field">
                      <span>{L.devis.priceHt}</span>
                      <input type="number" min="0" step="0.01" value={ouvrageComposer.priceHt} onChange={(event) => setOuvrageComposerField("priceHt", event.target.value)} placeholder="0.00" />
                    </label>
                    {ouvrageComposer.error ? <p className="profile-message error">{ouvrageComposer.error}</p> : null}
                    <div className="supply-modal-actions">
                      <button type="button" onClick={closeOuvrageComposer}>{L.common.cancel}</button>
                      <button type="button" className="button blue" onClick={submitOuvrageComposer}>{L.bibliotheque.addToCatalog}</button>
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            {rightPanelTab === "fournitures" ? (
              <section className="quote-final-card quote-picker-card">
                <p className="quote-picker-hint">{L.devis.addToLot} : <strong>{targetRoom === "Services" ? L.devis.generalWorks : targetRoom}</strong></p>
                <input
                  className="quote-picker-search"
                  value={supplyQuery}
                  onChange={(event) => setSupplyQuery(event.target.value)}
                  placeholder={L.bibliotheque.search}
                />
                <div className="quote-picker-chips">
                  <button type="button" className={!supplyCategory ? "active" : ""} onClick={() => setSupplyCategory("")}>{L.fournitures.all}</button>
                  {supplyCategories.map((category) => (
                    <button type="button" key={category} className={supplyCategory === category ? "active" : ""} onClick={() => setSupplyCategory(category)}>{category}</button>
                  ))}
                </div>
                <div className="quote-picker-list">
                  {filteredSupplyItems.map((item) => (
                    <div className="quote-picker-row" key={item.id}>
                      <div className="quote-picker-row-main">
                        <strong>{item.name}</strong>
                        <span className="quote-picker-row-stats">{item.category || ""} · {money(supplyPrice(item))} HT/{item.unit || "u"}</span>
                      </div>
                      <button type="button" className="quote-picker-add-btn" onClick={() => addFournitureLine(item, 1, targetRoom)}>{L.bibliotheque.addToCatalog}</button>
                    </div>
                  ))}
                  {!filteredSupplyItems.length ? <p className="empty-state">{L.bibliotheque.noFound}</p> : null}
                </div>
                <div className="quote-picker-footer">
                  <Link className="quote-picker-full-link" href="/fournitures/catalogue">{L.nav.supplies} →</Link>
                </div>
              </section>
            ) : null}

            {rightPanelTab === "avenants" && generatedQuote?.signatureStatus === "Signe" ? (
              <section className="quote-final-card quote-avenants-card">
                <div className="quote-section-title">
                  <div><span>{L.avenants.title}</span><h2>{L.avenants.tabAvenants}</h2></div>
                </div>
                {avenants.some((item) => item.status === "Signe") ? (
                  <div className="avenant-market-total-row">
                    <span>{L.avenants.marketTotalUpdated}</span>
                    <strong>{money(cumulativeMarketTotal(generatedQuote, avenants))}</strong>
                  </div>
                ) : null}
                {avenants.length ? (
                  <div className="avenant-list">
                    {avenants.map((item) => (
                      <Link key={item.id} href={`/avenant?id=${item.id}`} className="avenant-list-row">
                        <div className="avenant-list-row-main">
                          <strong>{item.numero}</strong>
                          <span>{L.avenants[AVENANT_STATUS_LABEL_KEYS[item.status]] || item.status}</span>
                        </div>
                        <span className="avenant-list-row-amount">{money(item.totalTtcDelta)}</span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">{L.avenants.noAvenants}</p>
                )}
                <button type="button" className="button secondary" style={{ marginTop: 10 }} onClick={() => router.push(`/avenant?quoteId=${generatedQuote.id}`)}>
                  {L.avenants.newAvenant}
                </button>
              </section>
            ) : null}
            </div>
          </div>
        </div>

        <section className="quote-final-card quote-conditioning-toggle-card">
          <button type="button" className="quote-conditioning-toggle" onClick={() => setConditioningOpen((open) => !open)} aria-expanded={conditioningOpen}>
            <span>{L.devis.conditioning}</span>
            <svg className={`svg-icon ${conditioningOpen ? "open" : ""}`} viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" /></svg>
              </button>
            </section>

            {conditioningOpen ? (
        <section className="quote-recap-card">
          <div className="recap-title-row">
            <div>
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
                  <div className="surcharge-mode-pill">
                    <button
                      type="button"
                      className={(s.mode ?? "excluded") === "excluded" ? "active" : ""}
                      onClick={() => updateSurcharge(s.id, "mode", "excluded")}
                    >
                      {L.devis.notCounted}
                    </button>
                    <button
                      type="button"
                      className={s.mode === "internal" ? "active" : ""}
                      onClick={() => updateSurcharge(s.id, "mode", "internal")}
                    >
                      {L.devis.includedHidden}
                    </button>
                    <button
                      type="button"
                      className={s.mode === "client" ? "active" : ""}
                      onClick={() => updateSurcharge(s.id, "mode", "client")}
                    >
                      {L.devis.visibleClient}
                    </button>
                  </div>
                  <label className="recap-check-label recap-surcharge-base" title={L.devis.calculationBaseHint}>
                    {L.devis.calculationBase}
                    <select
                      value={s.calculationBase === "chiffrage_cumule" ? "chiffrage_cumule" : "total_lots"}
                      onChange={(e) => updateSurcharge(s.id, "calculationBase", e.target.value)}
                    >
                      <option value="total_lots">{L.devis.calculationBaseLots}</option>
                      <option value="chiffrage_cumule">{L.devis.calculationBaseCumulative}</option>
                    </select>
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
            ) : null}

            <section className="quote-final-card quote-conditioning-toggle-card">
              <button type="button" className="quote-conditioning-toggle" onClick={() => setPaymentCardOpen((open) => !open)} aria-expanded={paymentCardOpen}>
                <span>{L.devis.paymentTitle}</span>
                <svg className={`svg-icon ${paymentCardOpen ? "open" : ""}`} viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" /></svg>
              </button>
            </section>

            {paymentCardOpen ? (
              <section className="quote-final-card quote-payment-card">
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

                <div className="payment-fields-grid payment-acompte-row">
                  <label className="payment-field">
                    <span>{L.devis.depositLabel}</span>
                    <div className="payment-field-suffix">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={paymentMilestones[0]?.percent ?? 30}
                        onChange={(e) => updateAcomptePercent(e.target.value)}
                      />
                      <span>%</span>
                    </div>
                  </label>
                  <label className="payment-field">
                    <span>{L.devis.soldeLabel}</span>
                    <input
                      value={(paymentMilestones[1]?.label || "").replace(/^Solde( —\s*)?/, "")}
                      onChange={(e) => updateSoldeLabel(e.target.value ? `Solde — ${e.target.value}` : "Solde")}
                      placeholder="À la réception des travaux"
                    />
                  </label>
                  <label className="payment-field">
                    <span>{L.devis.validityLabel}</span>
                    <select value={form.validityDays || 30} onChange={(e) => setField("validityDays", Number(e.target.value))}>
                      <option value="15">15 {L.devis.days}</option>
                      <option value="30">30 {L.devis.days}</option>
                      <option value="45">45 {L.devis.days}</option>
                      <option value="60">60 {L.devis.days}</option>
                      <option value="90">90 {L.devis.days}</option>
                    </select>
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

                <div className="payment-acompte-summary-bar">
                  <span>{L.devis.depositLabel} ({paymentMilestones[0]?.percent ?? 30}%)</span>
                  <strong>{money(summaryTotals.totalTtc * (paymentMilestones[0]?.percent ?? 30) / 100)}</strong>
                </div>
              </section>
            ) : null}

        {message ? <p className={`profile-message ${messageType}`}>{message}</p> : null}

        <div className="quote-more-actions" ref={moreActionsRef}>
          <button type="button" className="quote-more-actions-trigger" onClick={() => setMoreActionsOpen((open) => !open)} aria-expanded={moreActionsOpen} aria-label="Plus d'actions">•••</button>
          {moreActionsOpen ? (
            <div className="quote-more-actions-dropdown">
              <button type="button" onClick={() => { setMoreActionsOpen(false); handleGenerate(); }}>{L.devis.generateQuote}</button>
              <button type="button" className="danger" onClick={() => { setMoreActionsOpen(false); handleCancel(); }}>{L.common.cancel}</button>
              <button type="button" onClick={() => { setMoreActionsOpen(false); handleConfirm(); }}>{L.devis.confirm}</button>
              {generatedQuote?.signatureStatus !== "Signe" ? (
                <button type="button" onClick={() => { setMoreActionsOpen(false); openAcceptComposer(); }}>{L.devis.acceptManually}</button>
              ) : null}
              {generatedQuote?.id && generatedQuote?.signatureStatus !== "Signe" && generatedQuote?.status !== "Refuse" ? (
                <button type="button" className="danger" onClick={() => { setMoreActionsOpen(false); handleMarkRefused(); }}>Marquer comme refusé</button>
              ) : null}
              {generatedQuote?.id ? (
                <button type="button" onClick={() => { setMoreActionsOpen(false); handleArchiveQuote(); }}>Archiver</button>
              ) : null}
              {generatedQuote?.id ? (
                <button type="button" className="danger" onClick={() => { setMoreActionsOpen(false); handleDeleteQuote(); }}>{L.common.delete}</button>
              ) : null}
              {generatedQuote?.signatureStatus === "Signe" && generatedQuote?.projectId ? (
                <button type="button" onClick={() => { setMoreActionsOpen(false); router.push(`/chantiers?project=${generatedQuote.projectId}`); }}>
                  {L.devis.startSite}
                </button>
              ) : null}
            </div>
          ) : null}
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
                <Link className="button secondary" href={`/fournitures/catalogue?supply=${selectedSupply.id}`}>{L.devis.openInSupply}</Link>
                <button type="button" className="button blue" onClick={() => { applySupplyToLine(selectedSupply.lineId, selectedSupply, selectedSupply.materialIndex); setSelectedSupply(null); }}>{L.devis.useBtn}</button>
              </div>
            </div>
          </div>
        ) : null}

        {selectedOuvrageRef ? (
          <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setSelectedOuvrageRef(null)}>
            <div className="mini-modal supply-detail-modal" onClick={(event) => event.stopPropagation()}>
              <h2>{selectedOuvrageRef.label}</h2>
              <p>{L.devis.ouvrageLinked}</p>
              <dl className="supply-detail-list">
                <div><dt>{L.bibliotheque.code}</dt><dd>{selectedOuvrageRef.code || "-"}</dd></div>
                <div><dt>{L.bibliotheque.family}</dt><dd>{selectedOuvrageRef.family || "-"}</dd></div>
                <div><dt>{L.bibliotheque.unit}</dt><dd>{selectedOuvrageRef.unit || "-"}</dd></div>
                <div><dt>{L.bibliotheque.normTime}</dt><dd>{Number(selectedOuvrageRef.normativeTime || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</dd></div>
                <div><dt>{L.bibliotheque.hourlyRateEur}</dt><dd>{money(selectedOuvrageRef.hourlyRate || 0)}</dd></div>
                {selectedOuvrageRef.description ? <div><dt>{L.bibliotheque.description}</dt><dd>{selectedOuvrageRef.description}</dd></div> : null}
              </dl>
              <div className="supply-modal-actions">
                <button type="button" onClick={() => setSelectedOuvrageRef(null)}>{L.devis.closeBtn}</button>
                <Link className="button secondary" href="/bibliotheque-ouvrages">{L.devis.openInLibrary}</Link>
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

        {acceptComposer.open ? (
          <div className="modal-overlay" role="dialog" aria-modal="true" onClick={closeAcceptComposer}>
            <div className="mini-modal supply-composer-modal" onClick={(event) => event.stopPropagation()}>
              <h2>{L.devis.acceptManuallyTitle}</h2>
              <p className="tool-muted">{L.devis.acceptManuallySub}</p>
              <div className="supply-composer-tabs">
                <button type="button" className={acceptComposer.reason === "verbal" ? "active" : ""} onClick={() => setAcceptComposer((current) => ({ ...current, reason: "verbal" }))}>{L.devis.acceptReasonVerbal}</button>
                <button type="button" className={acceptComposer.reason === "acompte" ? "active" : ""} onClick={() => setAcceptComposer((current) => ({ ...current, reason: "acompte" }))}>{L.devis.acceptReasonDeposit}</button>
              </div>
              <label className="supply-composer-field full">
                <span>{L.devis.acceptNoteLabel}</span>
                <textarea
                  className="note-composer-textarea"
                  value={acceptComposer.note}
                  onChange={(event) => setAcceptComposer((current) => ({ ...current, note: event.target.value }))}
                  placeholder={L.devis.acceptNotePlaceholder}
                  rows={2}
                />
              </label>
              <div className="supply-modal-actions">
                <button type="button" onClick={closeAcceptComposer}>{L.common.cancel}</button>
                <button type="button" className="button blue" onClick={submitAcceptManually}>{L.devis.acceptManually}</button>
              </div>
            </div>
          </div>
        ) : null}

        {sendModalOpen && generatedQuote ? (
          <SendQuoteModal
            quote={generatedQuote}
            quoteNumber={previewQuoteNumber}
            lotsCount={roomGroups.length}
            linesCount={quoteLines.length}
            totalTtc={summaryTotals.totalTtc}
            onClose={() => setSendModalOpen(false)}
            onSent={handleQuoteSent}
          />
        ) : null}
      </form>
    </Shell>
  );
}
