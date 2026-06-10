"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Shell } from "../../../components/Shell";
import { apiSend } from "../../../lib/client-api";
import { pricingProfile } from "../../../lib/data";
import { calculateTaskPrice, euro } from "../../../lib/pricing";
import { fixText } from "../../../lib/text";
import { useApi } from "../../../lib/use-api";
import catalog from "../../../data/catalog-ouvrages.json";

const roomOptions = [
  { id: "salon", label: "Salon", image: "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=720&q=80" },
  { id: "cuisine", label: "Cuisine", image: "https://images.unsplash.com/photo-1556912173-3bb406ef7e77?auto=format&fit=crop&w=720&q=80" },
  { id: "chambre", label: "Chambre", image: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=720&q=80" },
  { id: "salle_de_bain", label: "Salle de bain", image: "https://images.unsplash.com/photo-1620626011761-996317b8d101?auto=format&fit=crop&w=720&q=80" },
  { id: "bureau", label: "Bureau", image: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=720&q=80" },
  { id: "exterieur", label: "Exterieur", image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=720&q=80" }
];

const adjustmentReasons = [
  { id: "none", label: "Aucun ajustement", percent: 0 },
  { id: "mur_fissure", label: "Mur fissure", percent: 15 },
  { id: "dernier_etage", label: "Dernier etage", percent: 10 },
  { id: "acces_difficile", label: "Acces difficile", percent: 12 },
  { id: "support_degrade", label: "Support degrade", percent: 18 },
  { id: "intervention_complexe", label: "Intervention complexe", percent: 20 },
  { id: "custom", label: "Raison personnalisee", percent: 0 }
];

const initialProject = {
  title: "",
  street: "",
  postalCode: "",
  city: "",
  client: "",
  clientEmail: "",
  propertyType: "Maison"
};

const initialWorkConfig = {
  quantity: 1,
  adjustmentReasonId: "none",
  customAdjustmentReason: "",
  adjustmentPercent: 0,
  discountPercent: 0,
  showMaterialsToClient: true
};

const CREATION_DRAFT_STATUS = "Brouillon en cours";

function normalizeRoomId(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function makeTask(source, timeOverride) {
  return {
    id: source.id,
    code: source.code,
    label: source.label,
    unit: source.unit || "u",
    normativeTime: Number(timeOverride ?? source.normativeTime ?? 0),
    isFixedTime: source.unit === "u",
    materialRequirements: (source.materialCategories || []).map((category) => ({
      productCategory: category,
      yield: 1,
      defaultPricePerUnit: 0,
      isFixedQuantity: false
    }))
  };
}

export default function ProjectsPage() {
  const { data: projects, setData: setProjects } = useApi("/api/projects", "projects");
  const { data: quotes, setData: setQuotes } = useApi("/api/quotes", "quotes");
  const { data: supplies } = useApi("/api/supplies", "supplies");
  const { data: ouvrages, setData: setOuvrages } = useApi("/api/ouvrages", "ouvrages", catalog);
  const quotesRef = useRef(quotes);

  const postes = useMemo(() => ouvrages.filter((item) => item.type === "POSTE"), [ouvrages]);

  useEffect(() => {
    quotesRef.current = quotes;
  }, [quotes]);

  const [step, setStep] = useState(1);
  const [projectForm, setProjectForm] = useState(initialProject);
  const [rooms, setRooms] = useState([]);
  const [customRoom, setCustomRoom] = useState("");
  const [selectedRoom, setSelectedRoom] = useState("salon");
  const [worksSource, setWorksSource] = useState("hidden");
  const [search, setSearch] = useState("");
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [pendingWork, setPendingWork] = useState(null);
  const [workConfig, setWorkConfig] = useState(initialWorkConfig);
  const [hiddenRecentWorks, setHiddenRecentWorks] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(window.localStorage.getItem("koji-hidden-recent-ouvrages") || "[]");
    } catch {
      return [];
    }
  });
  const [workOverrides, setWorkOverrides] = useState({});
  const [openWorkMenuId, setOpenWorkMenuId] = useState("");
  const [editingWork, setEditingWork] = useState(null);
  const [createdProject, setCreatedProject] = useState(null);
  const [createdQuote, setCreatedQuote] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [draftQuoteId, setDraftQuoteId] = useState("");
  const [draftPrompt, setDraftPrompt] = useState(null);
  const [autoSaveMessage, setAutoSaveMessage] = useState("");
  const [signatureCopyMessage, setSignatureCopyMessage] = useState("");

  const stepTitle = step === 1
    ? "Créer un nouveau chantier"
    : step === 2
      ? "Créer votre chantier"
      : step === 3
        ? "Créer vos ouvrages"
        : step === 4
          ? "Récapitulatif de votre devis"
          : "Devis prêt";

  const selectedRoomLabel = rooms.find((room) => room.id === selectedRoom)?.label || roomOptions.find((room) => room.id === selectedRoom)?.label || "Salon";
  const visibleRooms = rooms.length > 0 ? rooms : roomOptions.filter((room) => room.id === selectedRoom);

  const recentWorks = useMemo(() => {
    const byId = new Map(postes.map((item) => [item.id, item]));
    const byCode = new Map(postes.map((item) => [item.code, item]));
    const seen = new Set();
    const out = [];

    quotes.forEach((quote) => {
      (quote.items || []).forEach((line, index) => {
        const base = byId.get(line.taskId || line.id) || byCode.get(line.code);
        const id = base?.id || line.taskId || line.id || `recent-${quote.id}-${index}`;
        const recentKey = `${id}-${line.code || ""}-${fixText(line.label || "")}`;
        if (hiddenRecentWorks.includes(recentKey) || seen.has(recentKey)) return;
        seen.add(recentKey);
        const item = {
          ...(base || {}),
          id,
          recentKey,
          code: fixText(line.code || base?.code || "OUV-RECENT"),
          label: fixText(line.label || base?.label || "Ouvrage recent"),
          family: fixText(line.family || base?.family || "Recent"),
          category: fixText(line.category || base?.category || line.family || "Recent"),
          unit: fixText(line.unit || base?.unit || "u"),
          normativeTime: Number(line.normativeTime || base?.normativeTime || 0),
          description: fixText(line.description || base?.description || ""),
          materialCategories: base?.materialCategories || line.materialCategories || [],
          quoteNumber: quote.quoteNumber,
          project: quote.project,
          isRecentOnly: !base
        };
        out.push({ ...item, ...(workOverrides[id] || {}) });
      });
    });

    return out.slice(0, 24);
  }, [hiddenRecentWorks, postes, quotes, workOverrides]);

  const activeWorks = useMemo(() => {
    if (worksSource === "recent") return recentWorks;
    if (worksSource === "library") return postes;
    return search.trim() ? postes : [];
  }, [postes, recentWorks, search, worksSource]);

  const filteredPostes = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return activeWorks.filter((item) => {
      if (!needle) return true;
      return [item.code, item.label, item.family, item.category].join(" ").toLowerCase().includes(needle);
    });
  }, [activeWorks, search]);

  const groupedPostes = useMemo(() => {
    const grouped = {};
    filteredPostes.slice(0, 24).forEach((item) => {
      const key = item.family || "Ouvrages";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });
    return grouped;
  }, [filteredPostes]);

  const quoteLines = useMemo(() => {
    return selectedTasks.map((line) => {
      const source = postes.find((item) => item.id === line.taskId) || line;
      if (!source) return null;
      const task = makeTask(source, line.normativeTime);
      task.adjustmentPercent = Number(line.adjustmentPercent || 0);
      task.discountPercent = Number(line.discountPercent || 0);
      task.showMaterialsToClient = line.showMaterialsToClient !== false;
      const estimate = calculateTaskPrice({
        task,
        quantity: Number(line.quantity || 0),
        realityFactors: {},
        pricingProfile,
        selectedProducts: supplies
      });
      return {
        ...line,
        code: source.code,
        label: source.label,
        family: source.family,
        unit: source.unit || "u",
        normativeTime: task.normativeTime,
        laborCost: estimate.laborCost,
        materialCost: estimate.materialCost,
        materialLines: estimate.materialLines,
        totalCoefficient: estimate.totalCoefficient,
        adjustmentReason: line.adjustmentReason || "",
        adjustmentPercent: estimate.adjustmentPercent,
        adjustmentAmount: estimate.adjustmentAmount,
        discountPercent: estimate.discountPercent,
        discountAmount: estimate.discountAmount,
        showMaterialsToClient: line.showMaterialsToClient !== false,
        totalTimeHours: estimate.totalTimeHours,
        marginAmount: estimate.marginAmount,
        vatAmount: estimate.vatAmount,
        totalHt: estimate.totalHt,
        totalTtc: estimate.totalTtc,
        correctedTimeHours: estimate.correctedTimeHours
      };
    }).filter(Boolean);
  }, [postes, selectedTasks, supplies]);

  const totalHt = quoteLines.reduce((sum, line) => sum + Number(line.totalHt || 0), 0);
  const totalTtc = quoteLines.reduce((sum, line) => sum + Number(line.totalTtc || 0), 0);
  const totalLabor = quoteLines.reduce((sum, line) => sum + Number(line.laborCost || 0), 0);
  const totalSupplies = quoteLines.reduce((sum, line) => sum + Number(line.materialCost || 0), 0);

  useEffect(() => {
    if (draftQuoteId || draftPrompt) return;
    if (step !== 1) return;
    if (projectForm.title.trim() || rooms.length || selectedTasks.length) return;
    const draft = quotes.find((quote) => quote.isCreationDraft && quote.status === CREATION_DRAFT_STATUS && quote.draftData);
    if (draft) setDraftPrompt(draft);
  }, [draftPrompt, draftQuoteId, projectForm.title, quotes, rooms.length, selectedTasks.length, step]);
  useEffect(() => {
    if (typeof window === "undefined" || draftQuoteId) return;
    const resumeDraftId = new URLSearchParams(window.location.search).get("resumeDraft");
    if (!resumeDraftId) return;
    const draft = quotes.find((quote) => quote.id === resumeDraftId && quote.draftData);
    if (draft) applyDraft(draft);
  }, [draftQuoteId, quotes]);

  useEffect(() => {
    if (step === 5 || draftPrompt) return;
    if (!projectForm.title.trim()) return;

    const draftData = {
      step,
      projectForm,
      rooms,
      selectedRoom,
      worksSource,
      search,
      selectedTasks
    };

    const timer = window.setTimeout(async () => {
      try {
        setAutoSaveMessage("Brouillon enregistre automatiquement");
        const payload = {
          client: projectForm.client || projectForm.title || "Client",
          clientEmail: projectForm.clientEmail,
          project: projectForm.title,
          projectReference: projectForm.title,
          status: CREATION_DRAFT_STATUS,
          signatureStatus: "Non envoye",
          rooms: rooms.map((room) => room.label),
          items: quoteLines,
          totalHt,
          totalTtc,
          draftStep: step,
          draftData,
          isCreationDraft: true
        };
        const currentQuotes = quotesRef.current;
        if (draftQuoteId) {
          const { quote } = await apiSend("/api/quotes", { id: draftQuoteId, action: "update", ...payload }, "PATCH");
          const nextQuotes = currentQuotes.map((item) => item.id === quote.id ? quote : item);
          quotesRef.current = nextQuotes;
          setQuotes(nextQuotes);
        } else {
          const { quote } = await apiSend("/api/quotes", payload);
          setDraftQuoteId(quote.id);
          const nextQuotes = [quote, ...currentQuotes];
          quotesRef.current = nextQuotes;
          setQuotes(nextQuotes);
        }
      } catch {
        setAutoSaveMessage("Brouillon non enregistre");
      }
    }, 700);

    return () => window.clearTimeout(timer);
  }, [draftPrompt, draftQuoteId, projectForm, quoteLines, rooms, search, selectedRoom, selectedTasks, setQuotes, step, totalHt, totalTtc, worksSource]);

  function applyDraft(quote) {
    const draft = quote?.draftData || {};
    const nextProjectForm = { ...initialProject, ...(draft.projectForm || {}) };
    const nextRooms = Array.isArray(draft.rooms) ? draft.rooms : [];
    setDraftQuoteId(quote.id);
    setProjectForm(nextProjectForm);
    setRooms(nextRooms);
    setSelectedRoom(draft.selectedRoom || nextRooms[0]?.id || "salon");
    setWorksSource(draft.worksSource || "hidden");
    setSearch(draft.search || "");
    setSelectedTasks(Array.isArray(draft.selectedTasks) ? draft.selectedTasks : []);
    setPendingWork(null);
    setWorkConfig(initialWorkConfig);
    setCreatedProject(null);
    setCreatedQuote(null);
    setMessage("");
    setAutoSaveMessage("Brouillon repris");
    setDraftPrompt(null);
    setStep(Number(draft.step || quote.draftStep || 1));
  }

  async function deleteDraft(quote = draftPrompt) {
    if (!quote?.id) return;
    await apiSend("/api/quotes", { id: quote.id, action: "delete" }, "PATCH");
    const nextQuotes = quotesRef.current.filter((item) => item.id !== quote.id);
    quotesRef.current = nextQuotes;
    setQuotes(nextQuotes);
    setDraftQuoteId("");
    setDraftPrompt(null);
    setAutoSaveMessage("");
    setStep(1);
    setProjectForm(initialProject);
    setRooms([]);
    setSelectedRoom("salon");
    setWorksSource("hidden");
    setSearch("");
    setSelectedTasks([]);
    setPendingWork(null);
    setWorkConfig(initialWorkConfig);
    setCreatedProject(null);
    setCreatedQuote(null);
    setMessage("");
  }

  function setProjectField(field, value) {
    setProjectForm((current) => ({ ...current, [field]: value }));
  }

  function toggleRoom(room) {
    setRooms((current) => {
      const exists = current.some((item) => item.id === room.id);
      const next = exists ? current.filter((item) => item.id !== room.id) : [...current, room];
      if (!exists) setSelectedRoom(room.id);
      if (exists && selectedRoom === room.id && next[0]) setSelectedRoom(next[0].id);
      return next;
    });
  }

  function addCustomRoom() {
    const label = customRoom.trim();
    const id = normalizeRoomId(label);
    if (!id) return;
    const room = { id, label, icon: "PI" };
    setRooms((current) => current.some((item) => item.id === id) ? current : [...current, room]);
    setSelectedRoom(id);
    setCustomRoom("");
  }

  function toggleTask(item) {
    const taskId = item.id || item.taskId || item.code;
    const alreadySelected = selectedTasks.some((line) => line.roomId === selectedRoom && line.taskId === taskId);
    if (!alreadySelected) {
      setPendingWork(item);
      setWorkConfig(initialWorkConfig);
      return;
    }
    setSelectedTasks((current) => {
      return current.filter((line) => !(line.roomId === selectedRoom && line.taskId === taskId));
    });
  }

  function setWorkConfigField(field, value) {
    setWorkConfig((current) => ({ ...current, [field]: value }));
  }

  function selectAdjustmentReason(reasonId) {
    const reason = adjustmentReasons.find((item) => item.id === reasonId) || adjustmentReasons[0];
    setWorkConfig((current) => ({
      ...current,
      adjustmentReasonId: reason.id,
      adjustmentPercent: reason.percent
    }));
  }

  function confirmPendingWork() {
    if (!pendingWork) return;
    const taskId = pendingWork.id || pendingWork.taskId || pendingWork.code;
    const reason = adjustmentReasons.find((item) => item.id === workConfig.adjustmentReasonId);
    const adjustmentReason = workConfig.adjustmentReasonId === "custom"
      ? workConfig.customAdjustmentReason.trim()
      : reason?.label || "";
    setSelectedTasks((current) => [
      ...current,
      {
        roomId: selectedRoom,
        room: selectedRoomLabel,
        taskId,
        code: pendingWork.code,
        label: pendingWork.label,
        family: pendingWork.family,
        category: pendingWork.category,
        unit: pendingWork.unit || "u",
        description: pendingWork.description || "",
        materialCategories: pendingWork.materialCategories || [],
        quantity: Number(workConfig.quantity || 0),
        normativeTime: Number(pendingWork.normativeTime || 0),
        adjustmentReason,
        adjustmentPercent: Number(workConfig.adjustmentPercent || 0),
        discountPercent: Number(workConfig.discountPercent || 0),
        showMaterialsToClient: workConfig.showMaterialsToClient !== false
      }
    ]);
    setPendingWork(null);
    setWorkConfig(initialWorkConfig);
  }

  function hideRecentWork(item) {
    if (!item.recentKey) return;
    const next = [...hiddenRecentWorks, item.recentKey];
    setHiddenRecentWorks(next);
    window.localStorage.setItem("koji-hidden-recent-ouvrages", JSON.stringify(next));
    setSelectedTasks((current) => current.filter((line) => line.taskId !== item.id));
    setOpenWorkMenuId("");
  }

  async function deleteWork(item) {
    if (worksSource === "recent" || item.isRecentOnly) {
      hideRecentWork(item);
      return;
    }
    const response = await fetch(`/api/ouvrages?id=${encodeURIComponent(item.id)}`, { method: "DELETE" });
    const payload = await response.json();
    if (payload.ouvrages) setOuvrages(payload.ouvrages);
    setSelectedTasks((current) => current.filter((line) => line.taskId !== item.id));
    setOpenWorkMenuId("");
  }

  function startEditWork(item) {
    setEditingWork({
      ...item,
      normativeTime: String(item.normativeTime || 0)
    });
    setOpenWorkMenuId("");
  }

  async function saveEditedWork(event) {
    event.preventDefault();
    if (!editingWork) return;
    const updated = {
      ...editingWork,
      label: editingWork.label.trim(),
      code: editingWork.code.trim(),
      family: editingWork.family.trim() || "Ouvrages",
      category: editingWork.category?.trim() || editingWork.family?.trim() || "General",
      unit: editingWork.unit || "u",
      normativeTime: Number(editingWork.normativeTime || 0)
    };
    setWorkOverrides((current) => ({ ...current, [updated.id]: updated }));
    setSelectedTasks((current) => current.map((line) => line.taskId === updated.id ? {
      ...line,
      code: updated.code,
      label: updated.label,
      family: updated.family,
      category: updated.category,
      unit: updated.unit,
      normativeTime: updated.normativeTime,
      description: updated.description || ""
    } : line));

    if (!updated.isRecentOnly) {
      const payload = {
        id: updated.id,
        code: updated.code,
        label: updated.label,
        family: updated.family,
        category: updated.category,
        unit: updated.unit,
        normativeTime: updated.normativeTime,
        description: updated.description || "",
        type: "POSTE",
        materialCategories: updated.materialCategories || []
      };
      const response = await apiSend("/api/ouvrages", payload, "PATCH");
      if (response.ouvrages) setOuvrages(response.ouvrages);
    }

    setEditingWork(null);
  }

  function updateLine(index, patch) {
    setSelectedTasks((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line));
  }

  async function generateQuote() {
    if (!quoteLines.length) return;
    setSaving(true);
    setMessage("");
    const address = [projectForm.street, `${projectForm.postalCode} ${projectForm.city}`.trim()].filter(Boolean).join(", ");
    const title = projectForm.title || "Nouveau chantier";
    const client = projectForm.client || title;
    const { project } = await apiSend("/api/projects", {
      title,
      client,
      clientEmail: projectForm.clientEmail,
      address,
      budgetHt: totalHt,
      dueDate: new Date().toISOString().slice(0, 10),
      status: "Devis genere"
    });
    const quotePayload = {
      client,
      clientEmail: projectForm.clientEmail,
      project: project.title,
      projectId: project.id,
      projectReference: project.reference,
      rooms: rooms.map((room) => room.label),
      items: quoteLines,
      totalHt,
      totalTtc,
      status: "Pret a envoyer",
      draftStep: 0,
      draftData: null,
      isCreationDraft: false
    };
    const { quote } = draftQuoteId
      ? await apiSend("/api/quotes", { id: draftQuoteId, action: "update", ...quotePayload }, "PATCH")
      : await apiSend("/api/quotes", quotePayload);
    const { project: linkedProject } = await apiSend("/api/projects", {
      id: project.id,
      quoteId: quote.id,
      budgetHt: totalHt,
      status: "Devis genere"
    }, "PATCH");
    const finalProject = { ...linkedProject, quoteId: quote.id, budgetHt: totalHt, status: "Devis genere" };
    const currentQuotes = quotesRef.current;
    const nextQuotes = draftQuoteId
      ? currentQuotes.map((item) => item.id === quote.id ? quote : item)
      : [quote, ...currentQuotes];
    quotesRef.current = nextQuotes;
    setCreatedProject(finalProject);
    setCreatedQuote(quote);
    setProjects([finalProject, ...projects.filter((item) => item.id !== finalProject.id)]);
    setQuotes(nextQuotes);
    setDraftQuoteId("");
    setAutoSaveMessage("");
    setStep(5);
    setSaving(false);
  }

  async function sendSignature() {
    if (!createdQuote) return;
    const { quote } = await apiSend("/api/quotes", { id: createdQuote.id, action: "send" }, "PATCH");
    setCreatedQuote(quote);
    const nextQuotes = quotesRef.current.map((item) => item.id === quote.id ? quote : item);
    quotesRef.current = nextQuotes;
    setQuotes(nextQuotes);
    setMessage(`Lien de signature cree: ${quote.signatureUrl}`);
  }

  function signatureShareText(access = createdQuote?.signatureClientAccess) {
    if (!access || !createdQuote) return "";
    const clientName = projectForm.client || createdQuote.client || "Client";
    return [
      `Bonjour ${clientName},`,
      `Votre devis ${createdQuote.quoteNumber} est pret a consulter et signer sur Koji Signature.`,
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
      setSignatureCopyMessage(successLabel);
      window.setTimeout(() => setSignatureCopyMessage(""), 2600);
    } catch {
      setSignatureCopyMessage("Copie impossible. Vous pouvez selectionner le lien manuellement.");
    }
  }

  function resetWizard() {
    setStep(1);
    setProjectForm(initialProject);
    setRooms([]);
    setSelectedRoom("salon");
    setSelectedTasks([]);
    setPendingWork(null);
    setWorkConfig(initialWorkConfig);
    setCreatedProject(null);
    setCreatedQuote(null);
    setDraftQuoteId("");
    setDraftPrompt(null);
    setAutoSaveMessage("");
    setMessage("");
    setSignatureCopyMessage("");
  }

  function documentUrl(type, format) {
    if (!createdQuote?.id) return "#";
    return `/api/quotes/${createdQuote.id}/documents?type=${type}&format=${format}`;
  }

  const signatureAccess = createdQuote?.signatureClientAccess || null;
  const signatureText = signatureShareText(signatureAccess);
  const signatureEmail = signatureAccess?.email || projectForm.clientEmail || createdQuote?.clientEmail || "";
  const signaturePhone = signatureAccess?.phone || createdQuote?.clientPhone || "";
  const signaturePhoneDigits = String(signaturePhone).replace(/[^\d]/g, "");
  const signatureMailHref = signatureAccess
    ? `mailto:${encodeURIComponent(signatureEmail)}?subject=${encodeURIComponent(`Signature du devis ${createdQuote?.quoteNumber || ""}`)}&body=${encodeURIComponent(signatureText)}`
    : "#";
  const signatureWhatsAppHref = signatureAccess
    ? `https://wa.me/${signaturePhoneDigits || ""}?text=${encodeURIComponent(signatureText)}`
    : "#";

  return (
    <Shell>
      <div className="koji-wizard">
        <header className="wizard-top">
          <button type="button" className="wizard-back" onClick={() => step > 1 ? setStep(step - 1) : (window.history.length > 1 ? window.history.back() : window.location.assign("/"))}>{"<"}</button>
          <div>
            <h1>{stepTitle}</h1>
          </div>
          <span />
        </header>

        {autoSaveMessage && step < 5 ? <p className="wizard-autosave">{autoSaveMessage}</p> : null}

        {step === 1 && (
          <section className="wizard-form-card">
            <div className="wizard-form-grid">
              <label className="wizard-field full">Reference du chantier<input value={projectForm.title} onChange={(event) => setProjectField("title", event.target.value)} placeholder="Loft Durand - Cuisine ..." /></label>
              <label className="wizard-field full">Numero / Rue<input value={projectForm.street} onChange={(event) => setProjectField("street", event.target.value)} placeholder="Rajouter votre texte..." /></label>
              <label className="wizard-field">Code postale<input value={projectForm.postalCode} onChange={(event) => setProjectField("postalCode", event.target.value)} placeholder="Rajouter votre texte..." /></label>
              <label className="wizard-field">Ville<input value={projectForm.city} onChange={(event) => setProjectField("city", event.target.value)} placeholder="Rajouter votre texte..." /></label>
              <label className="wizard-field">Client<input value={projectForm.client} onChange={(event) => setProjectField("client", event.target.value)} placeholder="Nom client" /></label>
              <label className="wizard-field">Adresse e-mail du client<input type="email" value={projectForm.clientEmail} onChange={(event) => setProjectField("clientEmail", event.target.value)} placeholder="client@exemple.com" /></label>
              <label className="wizard-field full">Type du bien<select value={projectForm.propertyType} onChange={(event) => setProjectField("propertyType", event.target.value)}>
                <option>Maison</option>
                <option>Appartement</option>
                <option>Local</option>
                <option>Autre</option>
              </select></label>
            </div>
            <button className="wizard-primary" onClick={() => setStep(2)} disabled={!projectForm.title.trim()}>Suivant <span>{">"}</span></button>
          </section>
        )}

        {step === 2 && (
          <section className="wizard-step">
            <div className="room-add-card">
              <h2>Ajouter une piece</h2>
              <div className="room-add-row">
                <input value={customRoom} onChange={(event) => setCustomRoom(event.target.value)} placeholder="Ex: Buanderie, Garage..." />
                <button type="button" onClick={addCustomRoom}>+</button>
              </div>
            </div>
            <div className="section-divider"><span />Suggestions Rapides<span /></div>
            <div className="room-grid">
              {roomOptions.map((room) => {
                const active = rooms.some((item) => item.id === room.id);
                return (
                  <button
                    type="button"
                    className={`room-option ${active ? "active" : ""}`}
                    key={room.id}
                    onClick={() => toggleRoom(room)}
                    style={{ "--room-photo": `url("${room.image}")` }}
                  >
                    <strong>{room.label}</strong>
                    <i />
                  </button>
                );
              })}
            </div>
            <button className="wizard-primary" onClick={() => setStep(3)} disabled={rooms.length === 0}>Continuer ({rooms.length} selectionnes) <span>{">"}</span></button>
          </section>
        )}

        {step === 3 && (
          <section className="wizard-step no-pad">
            <div className="works-room-tabs">
              {visibleRooms.map((room) => (
                <button key={room.id} className={selectedRoom === room.id ? "active" : ""} onClick={() => setSelectedRoom(room.id)}>{room.label}</button>
              ))}
            </div>
            <div className="works-body">
              <h2>Ajouter des ouvrages</h2>
              <input className="works-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un ouvrage" />
              <div className="works-actions">
                <Link href="/bibliotheque-ouvrages">Bibliothèque d'ouvrages</Link>
                <Link href="/bibliotheque-ouvrages?action=create">Créer un ouvrage</Link>
                <Link href="/fournitures">Ajouter fourniture</Link>
                <button type="button" onClick={() => setWorksSource("recent")}>Historique des ouvrages {recentWorks.length ? `(${recentWorks.length})` : ""}</button>
              </div>
              {worksSource === "recent" && recentWorks.length === 0 ? (
                <div className="works-empty">
                  Aucun ouvrage récent pour le moment. Les ouvrages utilisés dans vos anciens devis apparaîtront ici.
                </div>
              ) : null}
              {Object.entries(groupedPostes).map(([family, items]) => (
                <div className="works-group" key={family}>
                  <h3>{family}</h3>
                  {items.map((item) => {
                    const checked = selectedTasks.some((line) => line.roomId === selectedRoom && line.taskId === item.id);
                    return (
                      <article className="ouvrage-card" key={item.id}>
                        <button type="button" className={`ouvrage-select ${checked ? "checked" : ""}`} onClick={() => toggleTask(item)}>{checked ? "OK" : ""}</button>
                        <div>
                          <small>{item.family}</small>
                          <strong>{item.label}</strong>
                          <em>{Number(item.normativeTime || 0).toLocaleString("fr-FR", { maximumFractionDigits: 3 })} h/{item.unit}</em>
                          {item.quoteNumber ? <small>Historique: {item.quoteNumber} - {item.project}</small> : null}
                        </div>
                        <button type="button" className="ouvrage-menu-button" onClick={() => setOpenWorkMenuId(openWorkMenuId === item.id ? "" : item.id)}>...</button>
                        {openWorkMenuId === item.id ? (
                          <div className="ouvrage-menu">
                            <button type="button" onClick={() => startEditWork(item)}>Modifier</button>
                            <button type="button" className="danger" onClick={() => deleteWork(item)}>Supprimer</button>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ))}
              {editingWork ? (
                <form className="ouvrage-edit-panel" onSubmit={saveEditedWork}>
                  <div className="edit-panel-head">
                    <strong>Modifier l'ouvrage</strong>
                    <button type="button" onClick={() => setEditingWork(null)}>Fermer</button>
                  </div>
                  <label>Code<input value={editingWork.code} onChange={(event) => setEditingWork((current) => ({ ...current, code: event.target.value }))} /></label>
                  <label className="full">Désignation<input value={editingWork.label} onChange={(event) => setEditingWork((current) => ({ ...current, label: event.target.value }))} /></label>
                  <label>Famille<input value={editingWork.family} onChange={(event) => setEditingWork((current) => ({ ...current, family: event.target.value }))} /></label>
                  <label>Unité<input value={editingWork.unit} onChange={(event) => setEditingWork((current) => ({ ...current, unit: event.target.value }))} /></label>
                  <label>Temps h/u<input type="number" step="0.001" value={editingWork.normativeTime} onChange={(event) => setEditingWork((current) => ({ ...current, normativeTime: event.target.value }))} /></label>
                  <label className="full">Commentaire<textarea value={editingWork.description || ""} onChange={(event) => setEditingWork((current) => ({ ...current, description: event.target.value }))} /></label>
                  <button className="wizard-primary">Enregistrer</button>
                </form>
              ) : null}
              {pendingWork ? (
                <div className="work-config-overlay" role="dialog" aria-modal="true">
                  <div className="work-config-modal">
                    <header>
                      <div>
                        <h3>Ajouter l'ouvrage</h3>
                      </div>
                      <button type="button" onClick={() => setPendingWork(null)}>Fermer</button>
                    </header>
                    <p>{pendingWork.label}</p>
                    <div className="work-config-grid">
                      <label>Quantite
                        <input type="number" min="0" step="0.01" value={workConfig.quantity} onChange={(event) => setWorkConfigField("quantity", event.target.value)} />
                      </label>
                      <label>Ajustement
                        <select value={workConfig.adjustmentReasonId} onChange={(event) => selectAdjustmentReason(event.target.value)}>
                          {adjustmentReasons.map((reason) => (
                            <option key={reason.id} value={reason.id}>{reason.label}</option>
                          ))}
                        </select>
                      </label>
                      {workConfig.adjustmentReasonId === "custom" ? (
                        <label className="full">Raison personnalisee
                          <input value={workConfig.customAdjustmentReason} onChange={(event) => setWorkConfigField("customAdjustmentReason", event.target.value)} placeholder="Ex: support tres abime" />
                        </label>
                      ) : null}
                      <label>Surcout (%)
                        <input type="number" min="0" step="1" value={workConfig.adjustmentPercent} onChange={(event) => setWorkConfigField("adjustmentPercent", event.target.value)} />
                      </label>
                      <label>Reduction (%)
                        <input type="number" min="0" step="1" value={workConfig.discountPercent} onChange={(event) => setWorkConfigField("discountPercent", event.target.value)} />
                      </label>
                      <label className="check-field full">
                        <input type="checkbox" checked={workConfig.showMaterialsToClient} onChange={(event) => setWorkConfigField("showMaterialsToClient", event.target.checked)} />
                        Afficher les fournitures dans le devis client
                      </label>
                    </div>
                    <button type="button" className="wizard-primary" onClick={confirmPendingWork}>Ajouter au devis</button>
                  </div>
                </div>
              ) : null}
            </div>
            <button className="wizard-primary sticky" onClick={() => setStep(4)} disabled={selectedTasks.length === 0}>Continuer</button>
          </section>
        )}

        {step === 4 && (
          <section className="wizard-step">
            <div className="quote-info-banner">
              Méthode de calcul : quantité x heures de l'ouvrage x taux horaire, puis fournitures, ajustement et réduction. <strong>{pricingProfile.hourlyRate.toFixed(2)} EUR/h</strong>
            </div>
            <div className="calculation-details wizard-calculation">
              <h3>Méthode de calcul Koji</h3>
              <div className="calculation-grid">
                <span>Main d'oeuvre</span><strong>{euro(totalLabor)}</strong>
                <span>Fournitures</span><strong>{euro(totalSupplies)}</strong>
                <span>Total TTC</span><strong>{euro(totalTtc)}</strong>
              </div>
              {quoteLines.slice(0, 4).map((line) => (
                <article key={`${line.roomId}-${line.taskId}`}>
                  <strong>{line.label}</strong>
                  <span>{Number(line.quantity || 0).toLocaleString("fr-FR")} x {Number(line.normativeTime || 0).toLocaleString("fr-FR", { maximumFractionDigits: 3 })} h x {pricingProfile.hourlyRate.toFixed(2)} EUR/h = {euro(line.laborCost || 0)} HT</span>
                  {line.adjustmentPercent ? <span>Ajustement: +{line.adjustmentPercent}%{line.adjustmentReason ? ` (${line.adjustmentReason})` : ""}</span> : null}
                  {line.discountPercent ? <span>Réduction: -{line.discountPercent}%</span> : null}
                  <span>Fournitures: {line.materialLines?.length ? line.materialLines.map((material) => `${material.category} (${material.unitsToBuy})`).join(", ") : "aucune"}</span>
                </article>
              ))}
            </div>
            <div className="quote-preview-head">
              <img src="/koji-logo.svg" alt="Koji" />
              <div>
                <strong>BOUHOUCHI</strong>
                <span>98 Quai de la Loire<br />75019 Paris</span>
              </div>
              <aside>
                <small>DEVIS N°</small>
                <b>{createdQuote?.quoteNumber || "DEVIS-2026"}</b>
              </aside>
            </div>
            <div className="quote-work-card quote-legal-card">
              <small>MENTIONS LÉGALES DU CHANTIER</small>
              <p>Lieu d'exécution des travaux : ____________________</p>
              <p>Date de début des travaux : ____________________</p>
              <p>Durée des travaux : ____________________</p>
            </div>
            <div className="quote-room-card">
              <header><strong>{rooms[0]?.label || "Pièce"}</strong><span>{euro(totalTtc)}</span></header>
              {quoteLines.map((line, index) => (
                <article className="quote-line-editor" key={`${line.roomId}-${line.taskId}`}>
                  <div className="quote-line-title">
                    <strong>{line.label}</strong>
                    <b>{euro(line.totalTtc)}</b>
                    <div className="quote-line-tools">
                      <button type="button" onClick={() => updateLine(index, { showMaterialsToClient: !line.showMaterialsToClient })}>
                        {line.showMaterialsToClient ? "Fournitures visibles" : "Fournitures masquées"}
                      </button>
                      <button type="button" className="danger" onClick={() => setSelectedTasks((current) => current.filter((_, lineIndex) => lineIndex !== index))}>Supprimer</button>
                    </div>
                  </div>
                  <div className="quote-line-inputs">
                    <label>Qté<input type="number" value={line.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.target.value || 0) })} /></label>
                    <label>Temps h/{line.unit}<input type="number" step="0.001" value={line.normativeTime} onChange={(event) => updateLine(index, { normativeTime: Number(event.target.value || 0) })} /></label>
                    <label>Ajustement %<input type="number" min="0" step="1" value={line.adjustmentPercent || 0} onChange={(event) => updateLine(index, { adjustmentPercent: Number(event.target.value || 0) })} /></label>
                    <label>Réduction %<input type="number" min="0" step="1" value={line.discountPercent || 0} onChange={(event) => updateLine(index, { discountPercent: Number(event.target.value || 0) })} /></label>
                  </div>
                  <div className="quote-line-breakdown">
                    <span>Main d'oeuvre HT : {euro(line.laborCost || 0)}</span>
                    <span>Fournitures HT : {euro(line.materialCost || 0)}</span>
                    {line.adjustmentPercent ? <span>Ajustement : +{euro(line.adjustmentAmount || 0)}</span> : null}
                    {line.discountPercent ? <span>Réduction : -{euro(line.discountAmount || 0)}</span> : null}
                  </div>
                </article>
              ))}
            </div>
            <button className="wizard-primary" onClick={generateQuote} disabled={saving}>{saving ? "Génération..." : "Générer le Devis"}</button>
          </section>
        )}

        {step === 5 && (
          <section className="wizard-step wizard-generated-suite">
            <div className="success-card final-success-card">
              <div className="success-check">OK</div>
              <h2>Devis prêt !</h2>
              <p>Le devis #{createdQuote?.quoteNumber} a été généré avec succès.</p>
              <div className="success-progress"><span>PROGRESSION</span><strong>100%</strong><i /></div>
            </div>

            <div className="final-documents-list">
              <article className="document-card final-document-card">
                <span>PDF</span>
                <div><strong>Devis_Final_{createdQuote?.quoteNumber}.pdf</strong><small>PDF Devis (A4)</small></div>
                <a href={documentUrl("quote", "pdf")} download>Voir</a>
              </article>
              <div className="doc-actions final-doc-actions">
                <a href={documentUrl("quote", "pdf")} download>PDF</a>
                <a href={documentUrl("quote", "word")} download>Word</a>
              </div>
              <div className="share-actions final-share-actions">
                <a href={documentUrl("quote", "pdf")} download>Partager PDF</a>
                <a href={documentUrl("quote", "word")} download>Partager Word</a>
              </div>

              <article className="document-card final-document-card">
                <span>MAT</span>
                <div><strong>Fournitures_{createdQuote?.quoteNumber}.pdf</strong><small>Liste de matériaux (A4)</small></div>
                <a href={documentUrl("supplies", "pdf")} download>Voir</a>
              </article>
              <div className="doc-actions final-doc-actions">
                <a href={documentUrl("supplies", "pdf")} download>PDF</a>
                <a href={documentUrl("supplies", "word")} download>Word</a>
              </div>
            </div>

            <section className="wizard-signature-panel">
              <div className="signature-send-heading">
                <div className="signature-send-icon">-&gt;</div>
                <div>
                  <span>Signature client</span>
                  <h2>Envoyer le lien de signature</h2>
                  <p>Le client reçoit un lien Kôji Signature avec un identifiant et un mot de passe provisoire.</p>
                </div>
                <button type="button" className="wizard-primary signature-main-button" onClick={sendSignature} disabled={!createdQuote}>
                  {signatureAccess ? "Renvoyer le lien" : "Envoyer le lien"}
                </button>
              </div>

              {signatureAccess ? (
                <>
                  <div className="signature-access-box">
                    <div>
                      <span>Lien Kôji Signature</span>
                      <a href={signatureAccess.loginUrl} target="_blank" rel="noreferrer">{signatureAccess.loginUrl}</a>
                    </div>
                    <div><span>Identifiant provisoire</span><strong>{signatureAccess.identifier}</strong></div>
                    <div><span>Mot de passe provisoire</span><strong>{signatureAccess.password}</strong></div>
                  </div>
                  <div className="signature-channel-row">
                    <a className="signature-channel primary" href={signatureAccess.loginUrl} target="_blank" rel="noreferrer">Ouvrir le lien</a>
                    <button type="button" className="signature-channel" onClick={() => copySignatureText(signatureAccess.loginUrl, "Lien copié")}>Copier le lien</button>
                    <button type="button" className="signature-channel" onClick={() => copySignatureText(signatureText, "Message prêt à envoyer")}>Copier le message</button>
                    <a className="signature-channel" href={signatureMailHref}>E-mail client</a>
                    <a className="signature-channel" href={signatureWhatsAppHref} target="_blank" rel="noreferrer">WhatsApp</a>
                  </div>
                  {signatureCopyMessage ? <p className="signature-copy-message">{signatureCopyMessage}</p> : null}
                </>
              ) : (
                <div className="signature-empty-card">
                  Cliquez sur "Envoyer le lien" pour créer les accès client et préparer l'envoi vers Kôji Signature.
                </div>
              )}
            </section>

            {message ? <p className="wizard-message">{message}</p> : null}
            <button type="button" className="wizard-text-button" onClick={resetWizard}>Créer un autre chantier</button>
          </section>
        )}

      </div>
    </Shell>
  );
}
