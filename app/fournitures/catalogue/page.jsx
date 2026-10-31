"use client";

import { useEffect, useMemo, useState } from "react";
import { Shell } from "../../../components/Shell";
import { apiGet, apiSend } from "../../../lib/client-api";
import { useLocale } from "../../../lib/i18n";
import { euro, shortDate } from "../../../lib/pricing";
import { useApi } from "../../../lib/use-api";
import { FournituresTabs } from "../FournituresTabs";

const units = ["Unite", "Piece", "m2", "ml", "kg", "L", "Cartouche", "Pot 10 L"];

// Prix unitaires au centime (le catalogue mélange des articles à 1,10 € et à 569 €).
const priceFormat = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
function price(value) {
  return priceFormat.format(Number(value) || 0);
}

const UNIT_LABELS = { Unite: "u", Piece: "pièce(s)", m2: "m²", ml: "ml", kg: "kg", L: "L", Cartouche: "cartouche(s)", "Pot 10 L": "pot(s) de 10 L" };

const initialSupply = {
  name: "",
  category: "",
  subcategory: "",
  supplierId: "",
  purchasePriceHt: "",
  salePriceHt: "",
  packaging: "",
  quantity: "",
  unit: "Unite",
  barcode: "",
  imageUrl: "",
  sourceUrl: "",
  supplierName: ""
};

const initialSupplier = {
  name: "",
  email: "",
  phone: "",
  address: "",
  website: "",
  notes: ""
};

const initialCategoryForm = { name: "" };

const initialDivers = {
  name: "",
  storeName: "",
  amountTtc: "",
  projectId: "",
  ticketPhoto: ""
};

const SUGGESTED_CATEGORIES = ["Matériaux", "Plomberie", "Électricité", "Peinture", "Carrelage", "Cloisons"];

const CATALOGUE_SUBTITLES = {
  categories: "Votre catalogue de matériaux, classé par catégorie.",
  fournisseurs: "Vos fournisseurs et leurs coordonnées.",
  divers: "Achats occasionnels : bazars, petits magasins, grandes surfaces."
};

const STAT_MODAL_TITLES = {
  mois: "Dépenses du mois",
  chantier: "Achats rattachés à un chantier",
  ticket: "Achats avec ticket joint"
};

function groupByDate(items) {
  const groups = {};
  items.forEach((item) => {
    const key = item.createdAt ? item.createdAt.slice(0, 10) : "sans-date";
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });
  return Object.entries(groups)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, groupItems]) => ({
      label: key === "sans-date" ? "Date inconnue" : shortDate(groupItems[0].createdAt),
      items: groupItems
    }));
}

export default function SuppliesCataloguePage() {
  const { L } = useLocale();
  const { data: supplies, setData: setSupplies } = useApi("/api/supplies", "supplies");
  const { data: suppliers, setData: setSuppliers } = useApi("/api/suppliers", "suppliers");
  const { data: categories, setData: setCategories } = useApi("/api/categories", "categories");
  const { data: commandes } = useApi("/api/commandes", "commandes");
  const { data: projects } = useApi("/api/projects", "projects");

  const [activeTab, setActiveTab] = useState("categories");
  const [activeCategory, setActiveCategory] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [selectedStore, setSelectedStore] = useState("");
  const [diversSearch, setDiversSearch] = useState("");
  const [diversDialog, setDiversDialog] = useState(false);
  const [diversForm, setDiversForm] = useState(initialDivers);
  const [editingDivers, setEditingDivers] = useState(null);
  const [statModal, setStatModal] = useState(null);
  const [fromDevis, setFromDevis] = useState(false);
  const [devisTargetRoom, setDevisTargetRoom] = useState("Services");

  const [selectedSupplyId, setSelectedSupplyId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [viaUrl, setViaUrl] = useState(false);
  const [supplierDialog, setSupplierDialog] = useState(false);
  const [supplierForm, setSupplierForm] = useState(initialSupplier);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [editingSupply, setEditingSupply] = useState(null);
  const [form, setForm] = useState(initialSupply);
  const [message, setMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");

  const [categoryDialog, setCategoryDialog] = useState(false);
  const [categoryForm, setCategoryForm] = useState(initialCategoryForm);
  const [editingCategory, setEditingCategory] = useState(null);

  const [pendingSupplyId, setPendingSupplyId] = useState(null);
  const [pendingQty, setPendingQty] = useState(1);

  const visibleSupplies = useMemo(() => {
    let list = activeCategory ? supplies.filter((item) => item.category === activeCategory) : supplies;
    const needle = categorySearch.trim().toLowerCase();
    if (needle) list = list.filter((item) => (item.name || "").toLowerCase().includes(needle));
    return list;
  }, [activeCategory, categorySearch, supplies]);

  const diversItems = useMemo(() => supplies.filter((item) => !item.supplierId), [supplies]);

  const storeList = useMemo(() => {
    const counts = {};
    diversItems.forEach((item) => {
      const name = item.storeName || "Sans magasin";
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [diversItems]);

  const filteredDiversItems = useMemo(() => {
    let list = diversItems;
    if (selectedStore) list = list.filter((item) => (item.storeName || "Sans magasin") === selectedStore);
    const needle = diversSearch.trim().toLowerCase();
    if (needle) {
      list = list.filter((item) => (item.name || "").toLowerCase().includes(needle) || (item.storeName || "").toLowerCase().includes(needle));
    }
    return list;
  }, [diversItems, selectedStore, diversSearch]);

  const diversStats = useMemo(() => {
    const now = new Date();
    const thisMonth = diversItems.filter((item) => {
      const date = new Date(item.createdAt);
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    });
    const chantierItems = diversItems.filter((item) => item.projectId);
    const ticketItems = diversItems.filter((item) => item.ticketPhoto);
    const depensesMois = thisMonth.reduce((sum, item) => sum + (Number(item.amountTtc) || 0), 0);
    return {
      depensesMois,
      depensesCount: thisMonth.length,
      moisItems: thisMonth,
      rattachees: chantierItems.length,
      chantierItems,
      total: diversItems.length,
      avecTicket: ticketItems.length,
      ticketItems
    };
  }, [diversItems]);

  const statModalGroups = useMemo(() => {
    if (!statModal) return [];
    const source = statModal === "mois" ? diversStats.moisItems : statModal === "chantier" ? diversStats.chantierItems : diversStats.ticketItems;
    return groupByDate(source || []);
  }, [statModal, diversStats]);

  const uniqueSuppliers = useMemo(() => {
    const seen = new Set();
    return suppliers.filter((supplier) => {
      const key = (supplier.name || "").trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [suppliers]);

  const supplierArticleCount = useMemo(() => {
    const counts = {};
    supplies.forEach((item) => {
      if (!item.supplierId) return;
      counts[item.supplierId] = (counts[item.supplierId] || 0) + 1;
    });
    return counts;
  }, [supplies]);

  const filteredSupplierList = useMemo(() => {
    const needle = supplierSearch.trim().toLowerCase();
    if (!needle) return uniqueSuppliers;
    return uniqueSuppliers.filter((supplier) => (supplier.name || "").toLowerCase().includes(needle));
  }, [uniqueSuppliers, supplierSearch]);

  const selectedSupplier = useMemo(
    () => uniqueSuppliers.find((supplier) => supplier.id === selectedSupplierId) || null,
    [uniqueSuppliers, selectedSupplierId]
  );

  const selectedSupplierArticles = useMemo(
    () => (selectedSupplier ? supplies.filter((item) => item.supplierId === selectedSupplier.id) : []),
    [supplies, selectedSupplier]
  );

  const selectedSupplierStats = useMemo(() => {
    if (!selectedSupplier) return null;
    const supplierCommandes = commandes.filter((c) => c.supplierId === selectedSupplier.id);
    const enCours = supplierCommandes.filter((c) => c.status !== "livree").length;
    const now = new Date();
    const depensesMois = supplierCommandes
      .filter((c) => {
        const date = new Date(c.createdAt);
        return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
      })
      .reduce((sum, c) => sum + (Number(c.montantHt) || 0), 0);
    const delais = supplierCommandes
      .filter((c) => c.status === "livree" && c.deliveryDate && c.createdAt)
      .map((c) => Math.max(0, Math.round((new Date(c.deliveryDate) - new Date(c.createdAt)) / 86400000)));
    const delaiMoyen = delais.length ? Math.round(delais.reduce((a, b) => a + b, 0) / delais.length) : null;
    return { enCours, depensesMois, delaiMoyen };
  }, [selectedSupplier, commandes]);

  useEffect(() => {
    if (activeTab !== "fournisseurs") return;
    if (selectedSupplierId && uniqueSuppliers.some((s) => s.id === selectedSupplierId)) return;
    if (uniqueSuppliers.length > 0) setSelectedSupplierId(uniqueSuppliers[0].id);
  }, [activeTab, uniqueSuppliers, selectedSupplierId]);

  function setField(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "category") next.subcategory = "";
      return next;
    });
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (["fournisseurs", "divers"].includes(params.get("tab"))) setActiveTab(params.get("tab"));
    if (params.get("from") === "devis") {
      setFromDevis(true);
      setDevisTargetRoom(window.localStorage.getItem("koji-devis-target-room") || "Services");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !supplies.length) return;
    const id = new URLSearchParams(window.location.search).get("supply");
    if (!id || editingSupply?.id === id) return;
    const target = supplies.find((item) => item.id === id);
    if (target) openEditSupply(target);
  }, [supplies, editingSupply?.id]);

  function selectSupplyForDevis(supply, quantity = 1) {
    if (typeof window === "undefined") return;
    const room = window.localStorage.getItem("koji-devis-target-room") || devisTargetRoom;
    window.localStorage.setItem("koji-devis-fourniture", JSON.stringify({ supply, quantity, room }));
    window.location.assign("/devis?selection=fourniture");
  }

  function openQtyPicker(item) {
    setPendingSupplyId(item.id);
    setPendingQty(1);
  }

  function changeQty(delta) {
    setPendingQty((q) => Math.max(1, q + delta));
  }

  function selectTreeCategory(cat) {
    setActiveCategory(activeCategory === cat ? "" : cat);
  }

  async function fetchFromUrl() {
    const url = form.sourceUrl.trim();
    if (!url) return;
    setImporting(true);
    setImportMessage("");
    try {
      const { data } = await apiGet(`/api/supplies/import?url=${encodeURIComponent(url)}`);
      let importedSupplierId = data.supplierName ? supplierIdFromName(data.supplierName) : "";
      if (data.supplierName && !importedSupplierId) {
        const { supplier } = await apiSend("/api/suppliers", { name: data.supplierName, website: officialSupplierUrl(data.supplierName) });
        importedSupplierId = supplier.id;
        setSuppliers((current) => current.some((item) => item.id === supplier.id) ? current : [supplier, ...current]);
      }
      const purchasePrice = data.purchasePriceHt ?? data.priceHt ?? "";
      const salePrice = data.salePriceHt ?? data.priceHt ?? purchasePrice;
      setForm((current) => ({
        ...current,
        sourceUrl: data.sourceUrl || url || current.sourceUrl,
        name: data.name || current.name,
        supplierId: importedSupplierId || current.supplierId,
        supplierName: data.supplierName || current.supplierName,
        purchasePriceHt: purchasePrice !== "" ? String(purchasePrice) : current.purchasePriceHt,
        salePriceHt: salePrice !== "" ? String(salePrice) : current.salePriceHt,
        unit: units.includes(data.unit) ? data.unit : current.unit,
        quantity: data.quantity ? String(data.quantity) : current.quantity,
        packaging: data.packaging || current.packaging,
        imageUrl: data.imageUrl || current.imageUrl
      }));
      setImportMessage(data.name ? "Informations récupérées. Vérifiez le prix avant d'enregistrer." : "Lien conservé. Complétez les champs manquants.");
    } catch (error) {
      setImportMessage(error.message || "Impossible de récupérer les informations.");
    } finally {
      setImporting(false);
    }
  }

  function supplierLabel(id) {
    return suppliers.find((item) => item.id === id)?.name || "";
  }

  function supplierWebsite(id) {
    const supplier = suppliers.find((item) => item.id === id);
    if (!supplier) return "";
    return supplier.website || officialSupplierUrl(supplier.name);
  }

  function supplyExternalUrl(item) {
    if (item.sourceUrl) return item.sourceUrl;
    if (item.supplierId) return supplierWebsite(item.supplierId);
    return officialSupplierUrl(item.supplierName);
  }

  function normalizedText(value = "") {
    return String(value || "").trim().toLowerCase();
  }

  function supplierIdFromName(name = "") {
    const wanted = normalizedText(name);
    if (!wanted) return "";
    return suppliers.find((supplier) => normalizedText(supplier.name) === wanted)?.id || "";
  }

  function officialSupplierUrl(name = "") {
    const value = normalizedText(name);
    if (value.includes("leroy")) return "https://www.leroymerlin.fr/";
    if (value.includes("castorama")) return "https://www.castorama.fr/";
    if (value.includes("brico depot") || value.includes("bricodepot")) return "https://www.bricodepot.fr/";
    if (value.includes("manomano")) return "https://www.manomano.fr/";
    if (value.includes("point p") || value.includes("pointp")) return "https://www.pointp.fr/";
    if (value.includes("chausson")) return "https://www.chausson.fr/";
    if (value.includes("gedimat")) return "https://www.gedimat.fr/";
    if (value.includes("lapeyre")) return "https://www.lapeyre.fr/";
    if (/^https?:\/\//.test(String(name || ""))) return name;
    return "";
  }

  function openExternal(url, event) {
    event?.stopPropagation();
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  function handleRowKey(event, action) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      action();
    }
  }

  // ── Category management ────────────────────────────────────────────────────

  function openCategoryDialog(cat = null) {
    setEditingCategory(cat);
    setCategoryForm(cat ? { name: cat.name } : initialCategoryForm);
    setCategoryDialog(true);
  }

  function closeCategoryDialog() {
    setCategoryDialog(false);
    setEditingCategory(null);
    setCategoryForm(initialCategoryForm);
  }

  async function submitCategoryForm(event) {
    event.preventDefault();
    const name = categoryForm.name.trim();
    if (!name) return;
    if (editingCategory) {
      const { category } = await apiSend("/api/categories", { id: editingCategory.id, name }, "PATCH");
      setCategories((current) => current.map((c) => c.id === category.id ? category : c));
      setMessage(`Catégorie mise à jour : ${category.name}`);
    } else {
      const { category } = await apiSend("/api/categories", { name });
      setCategories((current) => [...current, category]);
      setMessage(`Catégorie créée : ${category.name}`);
    }
    closeCategoryDialog();
  }

  async function quickAddCategory(name) {
    const { category } = await apiSend("/api/categories", { name });
    setCategories((current) => [...current, category]);
    setActiveCategory(category.name);
  }

  async function deleteCategory(cat) {
    const { category } = await apiSend("/api/categories", { id: cat.id, action: "delete" }, "PATCH");
    if (category?.deleted) {
      setCategories((current) => current.filter((c) => c.id !== cat.id));
      if (activeCategory === cat.name) setActiveCategory("");
    }
  }

  // ── Supply management ──────────────────────────────────────────────────────

  async function createSupply(event) {
    event.preventDefault();
    const payload = {
      ...form,
      importUrl: viaUrl ? form.sourceUrl : undefined,
      supplierName: supplierLabel(form.supplierId) || form.supplierName || "",
      purchasePriceHt: Number(form.purchasePriceHt || 0),
      salePriceHt: Number(form.salePriceHt || form.purchasePriceHt || 0),
      quantity: Number(form.quantity || 0),
      stock: Number(form.quantity || 0)
    };
    const { supply } = editingSupply
      ? await apiSend("/api/supplies", { id: editingSupply.id, ...payload }, "PATCH")
      : await apiSend("/api/supplies", payload);
    setSupplies(editingSupply ? supplies.map((item) => item.id === supply.id ? supply : item) : [supply, ...supplies]);

    if (fromDevis && !editingSupply) {
      selectSupplyForDevis(supply);
      return;
    }
    setForm(initialSupply);
    setEditingSupply(null);
    setFormOpen(false);
    setMessage(editingSupply ? `Fourniture mise à jour : ${supply.name}` : `Fourniture ajoutée : ${supply.name}`);
  }

  async function createSupplier(event) {
    event.preventDefault();
    const name = supplierForm.name.trim();
    if (!name) return;
    const { supplier } = editingSupplier
      ? await apiSend("/api/suppliers", { id: editingSupplier.id, ...supplierForm, name }, "PATCH")
      : await apiSend("/api/suppliers", { ...supplierForm, name });
    setSuppliers(editingSupplier ? suppliers.map((item) => item.id === supplier.id ? supplier : item) : [supplier, ...suppliers]);
    setSupplierForm(initialSupplier);
    setEditingSupplier(null);
    setSupplierDialog(false);
    setActiveTab("fournisseurs");
    setSelectedSupplierId(supplier.id);
    setMessage(editingSupplier ? `Fournisseur mis à jour : ${supplier.name}` : `Fournisseur ajouté : ${supplier.name}`);
  }

  async function deleteSupply(item) {
    const { supply } = await apiSend("/api/supplies", { id: item.id, action: "delete" }, "PATCH");
    if (supply?.deleted) setSupplies(supplies.filter((candidate) => candidate.id !== item.id));
  }

  async function deleteSupplier(item) {
    const { supplier } = await apiSend("/api/suppliers", { id: item.id, action: "delete" }, "PATCH");
    if (supplier?.deleted) {
      setSuppliers(suppliers.filter((candidate) => candidate.id !== item.id));
      if (selectedSupplierId === item.id) setSelectedSupplierId("");
    }
  }

  function openEditSupply(item) {
    setEditingSupply(item);
    setForm({
      name: item.name || "",
      category: item.category || "",
      subcategory: item.subcategory || "",
      supplierId: item.supplierId || "",
      purchasePriceHt: String(item.purchasePriceHt ?? item.priceHt ?? ""),
      salePriceHt: String(item.salePriceHt ?? item.priceHt ?? ""),
      packaging: item.packaging || "",
      quantity: String(item.quantity ?? item.stock ?? ""),
      unit: item.unit || "Unite",
      barcode: item.barcode || "",
      imageUrl: item.imageUrl || "",
      sourceUrl: item.sourceUrl || "",
      supplierName: item.supplierName || ""
    });
    setViaUrl(Boolean(item.sourceUrl));
    setFormOpen(true);
  }

  function openEditSupplier(item) {
    setEditingSupplier(item);
    setSupplierForm({
      name: item.name || "",
      email: item.email || "",
      phone: item.phone || "",
      address: item.address || "",
      website: item.website || officialSupplierUrl(item.name),
      notes: item.notes || ""
    });
    setSupplierDialog(true);
  }

  function closeSupplierDialog() {
    setSupplierDialog(false);
    setEditingSupplier(null);
    setSupplierForm(initialSupplier);
  }

  // ── Achats "Divers" ─────────────────────────────────────────────────────────

  function openAddDivers() {
    setEditingDivers(null);
    setDiversForm({ ...initialDivers, storeName: selectedStore && selectedStore !== "Sans magasin" ? selectedStore : "" });
    setDiversDialog(true);
  }

  function openEditDivers(item) {
    setEditingDivers(item);
    setDiversForm({
      name: item.name || "",
      storeName: item.storeName || "",
      amountTtc: String(item.amountTtc ?? ""),
      projectId: item.projectId || "",
      ticketPhoto: item.ticketPhoto || ""
    });
    setDiversDialog(true);
  }

  function closeDiversDialog() {
    setDiversDialog(false);
    setEditingDivers(null);
    setDiversForm(initialDivers);
  }

  function handleTicketFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDiversForm((current) => ({ ...current, ticketPhoto: String(reader.result || "") }));
    reader.readAsDataURL(file);
  }

  async function submitDiversForm(event) {
    event.preventDefault();
    const payload = {
      name: diversForm.name.trim(),
      storeName: diversForm.storeName.trim(),
      amountTtc: Number(diversForm.amountTtc || 0),
      projectId: diversForm.projectId || "",
      ticketPhoto: diversForm.ticketPhoto || "",
      category: "Divers",
      quantity: 1,
      purchasePriceHt: 0,
      salePriceHt: 0
    };
    const { supply } = editingDivers
      ? await apiSend("/api/supplies", { id: editingDivers.id, ...payload }, "PATCH")
      : await apiSend("/api/supplies", payload);
    setSupplies(editingDivers ? supplies.map((item) => item.id === supply.id ? supply : item) : [supply, ...supplies]);
    closeDiversDialog();
    setMessage(editingDivers ? `Achat mis à jour : ${supply.name}` : `Achat ajouté : ${supply.name}`);
  }

  function storeInitials(name = "") {
    return (name || "?").slice(0, 2).toUpperCase();
  }

  function pickTab(tab) {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    if (tab === "categories") params.delete("tab"); else params.set("tab", tab);
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }

  function openNewSupply(extra = {}) {
    setForm({ ...initialSupply, category: activeCategory, ...extra });
    setEditingSupply(null);
    setViaUrl(false);
    setImportMessage("");
    setFormOpen(true);
  }

  function closeSupplyForm() {
    setFormOpen(false);
    setEditingSupply(null);
    setForm(initialSupply);
    setImportMessage("");
  }

  function openNewSupplier() {
    setEditingSupplier(null);
    setSupplierForm(initialSupplier);
    setSupplierDialog(true);
  }

  function margin(item) {
    const purchase = Number(item.purchasePriceHt ?? 0);
    const sale = Number(item.salePriceHt ?? item.priceHt ?? 0);
    if (!(purchase > 0) || !(sale > 0)) return null;
    return { amount: sale - purchase, rate: Math.round(((sale - purchase) / sale) * 100) };
  }

  function supplyMeta(item) {
    return [
      [item.category, item.subcategory].filter(Boolean).join(" › "),
      item.packaging
    ].filter(Boolean).join(" · ");
  }

  function Thumb({ item, size }) {
    return (
      <span className={`fp-th${size === "big" ? " big" : ""}`} aria-hidden="true">
        {item.imageUrl ? <img src={item.imageUrl} alt="" /> : (item.name || "?").slice(0, 2).toUpperCase()}
      </span>
    );
  }

  function devisPicker(item) {
    if (pendingSupplyId !== item.id) {
      return <button type="button" className="btn btn-sec" onClick={(event) => { event.stopPropagation(); openQtyPicker(item); }}>{L.fournitures.choose}</button>;
    }
    return (
      <div className="fp-qty" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="dx" onClick={() => changeQty(-1)} aria-label="Moins">−</button>
        <input type="number" min="1" value={pendingQty} onChange={(event) => setPendingQty(Math.max(1, Number(event.target.value) || 1))} aria-label="Quantité" />
        <button type="button" className="dx" onClick={() => changeQty(1)} aria-label="Plus">+</button>
        <button type="button" className="btn btn-main" onClick={() => selectSupplyForDevis(item, pendingQty)}>{L.fournitures.validate}</button>
      </div>
    );
  }

  const selectedSupply = supplies.find((item) => item.id === selectedSupplyId) || null;
  const activeCategoryObj = categories.find((cat) => cat.name === activeCategory) || null;
  const diversTotal = diversItems.length;
  const tabCounts = { commandes: commandes.length, categories: supplies.length, fournisseurs: uniqueSuppliers.length, divers: diversTotal };
  const searchIcon = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4.5-4.5" /></svg>;
  const plusIcon = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow">
            {[`${supplies.length} article${supplies.length > 1 ? "s" : ""}`, `${uniqueSuppliers.length} fournisseur${uniqueSuppliers.length > 1 ? "s" : ""}`, `${categories.length} catégorie${categories.length > 1 ? "s" : ""}`].join(" · ")}
          </span>
          <h1>Fournitures</h1>
          <span className="muted">{CATALOGUE_SUBTITLES[activeTab] || CATALOGUE_SUBTITLES.categories}</span>
        </div>
        <div className="acts">
          {activeTab === "categories" ? (
            <>
              <button type="button" className="btn btn-sec" onClick={() => openCategoryDialog()}>Nouvelle catégorie</button>
              <button type="button" className="btn btn-main" onClick={() => openNewSupply()}>{plusIcon}Nouvel article</button>
            </>
          ) : activeTab === "fournisseurs" ? (
            <button type="button" className="btn btn-main" onClick={openNewSupplier}>{plusIcon}Nouveau fournisseur</button>
          ) : (
            <button type="button" className="btn btn-main" onClick={openAddDivers}>{plusIcon}Ajouter un achat</button>
          )}
        </div>
      </div>

      {fromDevis ? (
        <div className="notice fp-banner">
          <span>{L.fournitures.selectForDevis}</span>
          <button type="button" className="link" onClick={() => window.location.assign("/devis?new=1")}>{L.fournitures.backNoSelect}</button>
        </div>
      ) : null}
      {message ? <p className="notice" role="status">{message}</p> : null}

      <div className="tbar">
        <FournituresTabs current={activeTab} counts={tabCounts} onPick={pickTab} />
        {activeTab === "categories" ? (
          <label className="search search-wide">
            {searchIcon}
            <input type="search" value={categorySearch} onChange={(event) => setCategorySearch(event.target.value)} placeholder="Rechercher une fourniture" aria-label="Rechercher une fourniture" />
          </label>
        ) : null}
      </div>

      {activeTab === "categories" ? (
        <>
          <div className="fp-cats">
            <div className="chips" role="group" aria-label="Catégories">
              <button type="button" className={`chip chip-s${!activeCategory ? " on" : ""}`} aria-pressed={!activeCategory} onClick={() => setActiveCategory("")}>{L.fournitures.all}</button>
              {categories.map((cat) => (
                <button type="button" key={cat.id} className={`chip chip-s${activeCategory === cat.name ? " on" : ""}`} aria-pressed={activeCategory === cat.name} onClick={() => selectTreeCategory(cat.name)}>{cat.name}</button>
              ))}
            </div>
            {activeCategoryObj ? <button type="button" className="link" onClick={() => openCategoryDialog(activeCategoryObj)}>Renommer « {activeCategoryObj.name} »</button> : null}
          </div>

          {visibleSupplies.length === 0 ? (
            <section className="card fp-empty">
              <div className="card-h"><h2>{supplies.length && (activeCategory || categorySearch.trim()) ? "Aucun article ici" : "Votre catalogue est vide"}</h2></div>
              <p className="muted">
                {supplies.length && (activeCategory || categorySearch.trim())
                  ? "Aucun article ne correspond à cette catégorie ou à cette recherche."
                  : "Ajoutez les matériaux que vous utilisez le plus souvent. Ils seront proposés en un clic dans vos devis et vos commandes."}
              </p>
              <div className="hact">
                <button type="button" className="btn btn-main" onClick={() => openNewSupply()}>{plusIcon}Ajouter une fourniture</button>
                <button type="button" className="btn btn-sec" onClick={() => { openNewSupply(); setViaUrl(true); }}>Ajouter depuis un lien</button>
              </div>
              {categories.length === 0 ? (
                <div className="fp-sugg">
                  <span className="flab">Commencer par une catégorie</span>
                  <div className="chips">
                    {SUGGESTED_CATEGORIES.map((name) => (
                      <button type="button" key={name} className="chip chip-s" onClick={() => quickAddCategory(name)}>+ {name}</button>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ) : (
            <div className={`fp-layout${fromDevis ? " solo" : ""}`}>
              <div className="fp-main">
                <div className="tbl fit has-cards">
                  <table>
                    <thead>
                      <tr>
                        <th>Article</th>
                        <th>Fournisseur</th>
                        <th className="r">Achat HT</th>
                        <th className="r">Vente HT</th>
                        <th className="r">Marge</th>
                        <th aria-label="Action" />
                      </tr>
                    </thead>
                    <tbody>
                      {visibleSupplies.map((item) => {
                        const m = margin(item);
                        const pick = fromDevis ? () => openQtyPicker(item) : () => setSelectedSupplyId(item.id);
                        return (
                          <tr key={item.id} className={item.id === selectedSupplyId ? "sel" : ""} tabIndex={0} onClick={pick} onKeyDown={(event) => handleRowKey(event, pick)}>
                            <td>
                              <div className="fp-a">
                                <Thumb item={item} />
                                <div>
                                  <div className="fp-n">{item.name}</div>
                                  <div className="sm">{supplyMeta(item) || "—"}</div>
                                </div>
                              </div>
                            </td>
                            <td>{item.supplierName || supplierLabel(item.supplierId) || <span className="sm2">{item.storeName || "Sans fournisseur"}</span>}</td>
                            <td className="r">{item.purchasePriceHt ? price(item.purchasePriceHt) : <span className="sm2">—</span>}</td>
                            <td className="r">{Number(item.salePriceHt ?? item.priceHt ?? 0) > 0 ? price(item.salePriceHt ?? item.priceHt) : <span className="sm2">—</span>}</td>
                            <td className="r">{m ? `${m.rate} %` : <span className="sm2">—</span>}</td>
                            <td className="r">
                              {fromDevis ? devisPicker(item) : supplyExternalUrl(item) ? (
                                <button type="button" className="link" onClick={(event) => openExternal(supplyExternalUrl(item), event)}>{item.sourceUrl ? L.fournitures.link : L.fournitures.site}</button>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mlist">
                  {visibleSupplies.map((item) => (
                    <div className="m-card" key={item.id} role={fromDevis ? undefined : "button"} tabIndex={fromDevis ? undefined : 0} onClick={fromDevis ? undefined : () => openEditSupply(item)} onKeyDown={fromDevis ? undefined : (event) => handleRowKey(event, () => openEditSupply(item))}>
                      <div className="top2">
                        <div className="fp-a">
                          <Thumb item={item} />
                          <div>
                            <div className="nm">{item.name}</div>
                            <div className="meta">{[supplyMeta(item), item.supplierName || supplierLabel(item.supplierId)].filter(Boolean).join(" · ") || "—"}</div>
                          </div>
                        </div>
                      </div>
                      <div className="dvc-f">
                        <b>{Number(item.salePriceHt ?? item.priceHt ?? 0) > 0 ? `${price(item.salePriceHt ?? item.priceHt)} HT` : item.amountTtc ? `${price(item.amountTtc)} TTC` : "—"}</b>
                        <span className="meta">{margin(item) ? `marge ${margin(item).rate} %` : ""}</span>
                      </div>
                      {fromDevis ? devisPicker(item) : null}
                    </div>
                  ))}
                </div>
              </div>

              {fromDevis ? null : <aside className="fp-side fp-aside">
                {!selectedSupply ? (
                  <section className="card">
                    <p className="muted">Cliquez sur un article pour voir ses prix et le modifier.</p>
                  </section>
                ) : (
                  <section className="card fp-ob">
                    <Thumb item={selectedSupply} size="big" />
                    <div className="fp-ob-h">
                      <span className="eyebrow">{supplyMeta(selectedSupply) || L.fournitures.noCategory}</span>
                      <h2>{selectedSupply.name}</h2>
                      <span className="muted">{selectedSupply.supplierName || supplierLabel(selectedSupply.supplierId) || "Sans fournisseur"}</span>
                    </div>
                    <div className="kv"><span>{L.fournitures.purchasePrice}</span><b>{selectedSupply.purchasePriceHt ? price(selectedSupply.purchasePriceHt) : "—"}</b></div>
                    <div className="kv"><span>{L.fournitures.salePrice}</span><b>{price(selectedSupply.salePriceHt ?? selectedSupply.priceHt ?? 0)}</b></div>
                    <div className="kv kv-strong"><span>Marge</span><b>{margin(selectedSupply) ? `${price(margin(selectedSupply).amount)} · ${margin(selectedSupply).rate} %` : "—"}</b></div>
                    {selectedSupply.quantity || selectedSupply.stock ? <div className="kv"><span>{L.fournitures.quantity}</span><b>{selectedSupply.quantity ?? selectedSupply.stock} {UNIT_LABELS[selectedSupply.unit] || selectedSupply.unit || ""}</b></div> : null}
                    {selectedSupply.barcode ? <div className="kv"><span>{L.fournitures.barcode}</span><b>{selectedSupply.barcode}</b></div> : null}
                    {supplyExternalUrl(selectedSupply) ? (
                      <div className="kv"><span>{selectedSupply.sourceUrl ? "Lien produit" : "Site du fournisseur"}</span><b><button type="button" className="link" onClick={(event) => openExternal(supplyExternalUrl(selectedSupply), event)}>Ouvrir</button></b></div>
                    ) : null}
                    <div className="hact fp-ob-act">
                      <button type="button" className="btn btn-sec" onClick={() => { deleteSupply(selectedSupply); setSelectedSupplyId(null); }}>{L.common.delete}</button>
                      <button type="button" className="btn btn-main" onClick={() => openEditSupply(selectedSupply)}>{L.common.edit}</button>
                    </div>
                  </section>
                )}
              </aside>}
            </div>
          )}
        </>
      ) : activeTab === "fournisseurs" ? (
        <div className="fp-split">
          <section className="card fp-list">
            <label className="search">
              {searchIcon}
              <input type="search" value={supplierSearch} onChange={(event) => setSupplierSearch(event.target.value)} placeholder="Rechercher un fournisseur" aria-label="Rechercher un fournisseur" />
            </label>
            {filteredSupplierList.length === 0 ? <p className="muted">{L.fournitures.noSuppliers}</p> : null}
            {filteredSupplierList.map((supplier) => (
              <button type="button" key={supplier.id} className={`fp-li${supplier.id === selectedSupplierId ? " on" : ""}`} onClick={() => setSelectedSupplierId(supplier.id)} aria-current={supplier.id === selectedSupplierId ? "true" : undefined}>
                <span className="ct-av fo">{(supplier.name || "FS").slice(0, 2).toUpperCase()}</span>
                <span className="fp-li-n">{supplier.name}</span>
                <span className="fp-li-c">{supplierArticleCount[supplier.id] || 0}</span>
              </button>
            ))}
          </section>

          <div className="fp-detail-col">
            {!selectedSupplier ? (
              <section className="card"><p className="muted">{L.fournitures.noSuppliers}</p></section>
            ) : (
              <>
                <div className="ct-fh">
                  <span className="ct-av big fo">{(selectedSupplier.name || "FS").slice(0, 2).toUpperCase()}</span>
                  <div className="t">
                    <span className="eyebrow">Fournisseur</span>
                    <h2>{selectedSupplier.name}</h2>
                    <small>
                      {[selectedSupplier.phone, selectedSupplier.email].filter(Boolean).join(" · ")}
                      {(selectedSupplier.website || officialSupplierUrl(selectedSupplier.name)) ? (
                        <>{selectedSupplier.phone || selectedSupplier.email ? " · " : ""}<button type="button" className="fp-web" onClick={(event) => openExternal(selectedSupplier.website || officialSupplierUrl(selectedSupplier.name), event)}>{(selectedSupplier.website || officialSupplierUrl(selectedSupplier.name)).replace(/^https?:\/\//, "").replace(/\/$/, "")}</button></>
                      ) : null}
                    </small>
                  </div>
                  <div className="hact">
                    <button type="button" className="btn btn-sec" onClick={() => deleteSupplier(selectedSupplier)}>{L.common.delete}</button>
                    <button type="button" className="btn btn-sec" onClick={() => openEditSupplier(selectedSupplier)}>{L.common.edit}</button>
                  </div>
                </div>

                <div className="kpis">
                  <div><div className="l">Articles</div><div className="v">{selectedSupplierArticles.length}</div><div className="s">au catalogue</div></div>
                  <div><div className="l">Commandes en cours</div><div className="v">{selectedSupplierStats.enCours}</div><div className="s">non livrées</div></div>
                  <div><div className="l">Dépenses du mois</div><div className="v">{euro(selectedSupplierStats.depensesMois)}</div><div className="s">HT, ce mois-ci</div></div>
                  <div><div className="l">Délai moyen</div><div className="v">{selectedSupplierStats.delaiMoyen === null ? "—" : `${selectedSupplierStats.delaiMoyen} j`}</div><div className="s">de livraison</div></div>
                </div>

                <section className="card">
                  <div className="card-h">
                    <h2>Articles de ce fournisseur{selectedSupplierArticles.length ? <span className="kcnt">{selectedSupplierArticles.length}</span> : null}</h2>
                    <button type="button" className="link" onClick={() => openNewSupply({ supplierId: selectedSupplier.id, category: "" })}>+ {L.common.add}</button>
                  </div>
                  {selectedSupplierArticles.length === 0 ? <p className="muted">{L.fournitures.noSupplies}</p> : selectedSupplierArticles.map((item) => (
                    <div className="row fp-row" key={item.id} role="button" tabIndex={0} onClick={() => openEditSupply(item)} onKeyDown={(event) => handleRowKey(event, () => openEditSupply(item))}>
                      <Thumb item={item} />
                      <div className="t">
                        <strong>{item.name}</strong>
                        <small>{supplyMeta(item) || "—"}</small>
                      </div>
                      {item.sourceUrl ? <button type="button" className="link" onClick={(event) => openExternal(item.sourceUrl, event)}>{L.fournitures.link}</button> : null}
                      <b>{price(item.salePriceHt ?? item.priceHt ?? 0)}</b>
                    </div>
                  ))}
                </section>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="fp-split">
          <section className="card fp-list">
            <div className="card-h"><h2>Magasins</h2></div>
            <button type="button" className={`fp-li${!selectedStore ? " on" : ""}`} onClick={() => setSelectedStore("")}>
              <span className="fp-li-n">Tous les magasins</span>
              <span className="fp-li-c">{diversTotal}</span>
            </button>
            {storeList.map((store) => (
              <button type="button" key={store.name} className={`fp-li${selectedStore === store.name ? " on" : ""}`} onClick={() => setSelectedStore(store.name)}>
                <span className="ct-av sm st">{storeInitials(store.name)}</span>
                <span className="fp-li-n">{store.name}</span>
                <span className="fp-li-c">{store.count}</span>
              </button>
            ))}
          </section>

          <div className="fp-detail-col">
            <p className="notice">Pour les petits achats sans fournisseur : prenez le ticket en photo et rattachez l'achat à un chantier pour suivre vos dépenses.</p>

            <div className="kpis k3">
              <button type="button" onClick={() => setStatModal("mois")}>
                <div className="l">Dépenses du mois</div>
                <div className="v">{euro(diversStats.depensesMois)}</div>
                <div className="s">{diversStats.depensesCount} achat{diversStats.depensesCount > 1 ? "s" : ""} · voir le détail</div>
              </button>
              <button type="button" onClick={() => setStatModal("chantier")}>
                <div className="l">Rattachés à un chantier</div>
                <div className="v">{diversStats.rattachees}</div>
                <div className="s">sur {diversStats.total} achat{diversStats.total > 1 ? "s" : ""}</div>
              </button>
              <button type="button" onClick={() => setStatModal("ticket")}>
                <div className="l">Tickets joints</div>
                <div className="v">{diversStats.avecTicket}/{diversStats.total}</div>
                <div className="s">{diversStats.total - diversStats.avecTicket > 0 ? `${diversStats.total - diversStats.avecTicket} ticket${diversStats.total - diversStats.avecTicket > 1 ? "s" : ""} manquant${diversStats.total - diversStats.avecTicket > 1 ? "s" : ""}` : "tout est à jour"}</div>
              </button>
            </div>

            <label className="search">
              {searchIcon}
              <input type="search" value={diversSearch} onChange={(event) => setDiversSearch(event.target.value)} placeholder="Rechercher un achat ou un magasin" aria-label="Rechercher un achat ou un magasin" />
            </label>

            {filteredDiversItems.length === 0 ? (
              <div className="tbl"><p className="empty">{L.fournitures.noDivers}</p></div>
            ) : (
              <>
                <div className="tbl fit has-cards">
                  <table>
                    <thead>
                      <tr>
                        <th>Achat</th>
                        <th>Chantier</th>
                        <th>Ticket</th>
                        <th className="r">Montant TTC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDiversItems.map((item) => (
                        <tr key={item.id} tabIndex={0} onClick={() => openEditDivers(item)} onKeyDown={(event) => handleRowKey(event, () => openEditDivers(item))}>
                          <td className="n">{item.name}<div className="sm">{item.storeName || "Sans magasin"} · {shortDate(item.createdAt)}</div></td>
                          <td>{item.projectTitle || <span className="sm2">Sans chantier</span>}</td>
                          <td>{item.ticketPhoto ? <span className="tag tag-e">Ticket joint</span> : <span className="tag dim">Sans ticket</span>}</td>
                          <td className="r">{price(item.amountTtc)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mlist">
                  {filteredDiversItems.map((item) => (
                    <button type="button" className="m-card" key={item.id} onClick={() => openEditDivers(item)}>
                      <div className="top2">
                        <div>
                          <div className="nm">{item.name}</div>
                          <div className="meta">{item.storeName || "Sans magasin"} · {shortDate(item.createdAt)}</div>
                        </div>
                        {item.ticketPhoto ? <span className="tag tag-e">Ticket</span> : <span className="tag dim">Sans ticket</span>}
                      </div>
                      <div className="dvc-f">
                        <b>{price(item.amountTtc)} TTC</b>
                        <span className="meta">{item.projectTitle || "Sans chantier"}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {formOpen ? (
        <div className="pmodal-bg" onClick={closeSupplyForm}>
          <form className="pmodal" role="dialog" aria-modal="true" aria-label={editingSupply ? L.fournitures.editSupply : L.fournitures.addSupply} onSubmit={createSupply} onClick={(event) => event.stopPropagation()}>
            <div className="card-h">
              <h2>{editingSupply ? L.fournitures.editSupply : L.fournitures.addSupply}</h2>
              <button type="button" className="link" onClick={closeSupplyForm}>Fermer</button>
            </div>
            {fromDevis && !editingSupply ? <p className="notice">Cette fourniture sera ajoutée directement à votre devis.</p> : null}
            <div className="fgrid">
              <div className="full">
                <div className="kp-seg" role="group" aria-label="Mode d'ajout">
                  <button type="button" className={!viaUrl ? "on" : ""} aria-pressed={!viaUrl} onClick={() => setViaUrl(false)}>{L.fournitures.manual}</button>
                  <button type="button" className={viaUrl ? "on" : ""} aria-pressed={viaUrl} onClick={() => setViaUrl(true)}>{L.fournitures.addViaUrl}</button>
                </div>
              </div>
              {viaUrl ? (
                <div className="full">
                  <span className="flab">{L.fournitures.productLink}</span>
                  <div className="pair">
                    <input value={form.sourceUrl} onChange={(event) => setField("sourceUrl", event.target.value)} placeholder="https://..." aria-label={L.fournitures.productLink} />
                    <button type="button" className="btn btn-sec" onClick={fetchFromUrl} disabled={!form.sourceUrl.trim() || importing}>{importing ? "Lecture…" : L.fournitures.fetch}</button>
                  </div>
                  {importMessage ? <small className="muted">{importMessage}</small> : null}
                </div>
              ) : null}
              <label className="full">{L.fournitures.description}
                <input value={form.name} onChange={(event) => setField("name", event.target.value)} placeholder={L.fournitures.name} required={!viaUrl} />
                <small className="muted">{L.fournitures.descriptionHint}</small>
              </label>
              <label>{L.fournitures.category}
                <select value={form.category} onChange={(event) => setField("category", event.target.value)}>
                  <option value="">{L.fournitures.noCategory}</option>
                  {categories.map((cat) => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                </select>
              </label>
              <label>{L.fournitures.supplier}
                <select value={form.supplierId} onChange={(event) => setField("supplierId", event.target.value)}>
                  <option value="">{L.fournitures.noSupplierOpt}</option>
                  {uniqueSuppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                </select>
                {supplierWebsite(form.supplierId) ? <button type="button" className="fp-web" onClick={(event) => openExternal(supplierWebsite(form.supplierId), event)}>{L.fournitures.openSite}</button> : null}
              </label>
              <label>{L.fournitures.purchasePrice}
                <input type="number" step="0.01" value={form.purchasePriceHt} onChange={(event) => setField("purchasePriceHt", event.target.value)} placeholder="0.00" />
              </label>
              <label>{L.fournitures.salePrice}
                <input type="number" step="0.01" value={form.salePriceHt} onChange={(event) => setField("salePriceHt", event.target.value)} placeholder="0.00" />
              </label>
              <label className="full">{L.fournitures.packaging}
                <input value={form.packaging} onChange={(event) => setField("packaging", event.target.value)} placeholder="Pot 10 L, pièce, carton..." />
              </label>
              <label>{L.fournitures.quantity}
                <input type="number" step="0.01" value={form.quantity} onChange={(event) => setField("quantity", event.target.value)} placeholder="0" />
              </label>
              <label>{L.fournitures.unit}
                <select value={form.unit} onChange={(event) => setField("unit", event.target.value)}>
                  {units.map((unit) => <option key={unit}>{unit}</option>)}
                </select>
              </label>
              <label>{L.fournitures.barcode}
                <input value={form.barcode} onChange={(event) => setField("barcode", event.target.value)} />
              </label>
              <label>{L.fournitures.image}
                <input value={form.imageUrl} onChange={(event) => setField("imageUrl", event.target.value)} placeholder="https://..." />
              </label>
            </div>
            <div className="pm-act">
              <button type="button" className="btn btn-sec" onClick={closeSupplyForm}>{L.common.cancel}</button>
              <button type="submit" className="btn btn-main">{editingSupply ? L.common.save : fromDevis ? L.fournitures.addToDevisBtn : L.fournitures.createSupply}</button>
            </div>
          </form>
        </div>
      ) : null}

      {supplierDialog ? (
        <div className="pmodal-bg" onClick={closeSupplierDialog}>
          <form className="pmodal" role="dialog" aria-modal="true" aria-label={editingSupplier ? L.fournitures.editSupplier : L.fournitures.newSupplier} onSubmit={createSupplier} onClick={(event) => event.stopPropagation()}>
            <div className="card-h">
              <h2>{editingSupplier ? L.fournitures.editSupplier : L.fournitures.newSupplier}</h2>
              <button type="button" className="link" onClick={closeSupplierDialog}>Fermer</button>
            </div>
            <div className="fgrid">
              <label className="full">{L.fournitures.supplierName}
                <input value={supplierForm.name} onChange={(event) => setSupplierForm((current) => ({ ...current, name: event.target.value }))} autoFocus required />
              </label>
              <label>{L.fournitures.supplierEmail}
                <input type="email" value={supplierForm.email} onChange={(event) => setSupplierForm((current) => ({ ...current, email: event.target.value }))} placeholder="email@..." />
              </label>
              <label>{L.fournitures.supplierPhone}
                <input value={supplierForm.phone} onChange={(event) => setSupplierForm((current) => ({ ...current, phone: event.target.value }))} placeholder="06 00 00 00 00" />
              </label>
              <label className="full">{L.fournitures.supplierAddress}
                <input value={supplierForm.address} onChange={(event) => setSupplierForm((current) => ({ ...current, address: event.target.value }))} />
              </label>
              <label className="full">{L.fournitures.supplierWebsite}
                <input value={supplierForm.website} onChange={(event) => setSupplierForm((current) => ({ ...current, website: event.target.value }))} placeholder="https://..." />
              </label>
              <label className="full">{L.fournitures.supplierNotes}
                <input value={supplierForm.notes} onChange={(event) => setSupplierForm((current) => ({ ...current, notes: event.target.value }))} />
              </label>
            </div>
            <div className="pm-act">
              {editingSupplier ? <button type="button" className="btn btn-sec pm-left" onClick={() => { closeSupplierDialog(); deleteSupplier(editingSupplier); }}>{L.common.delete}</button> : null}
              <button type="button" className="btn btn-sec" onClick={closeSupplierDialog}>{L.common.cancel}</button>
              <button type="submit" className="btn btn-main">{editingSupplier ? L.common.save : L.common.create}</button>
            </div>
          </form>
        </div>
      ) : null}

      {diversDialog ? (
        <div className="pmodal-bg" onClick={closeDiversDialog}>
          <form className="pmodal" role="dialog" aria-modal="true" aria-label={editingDivers ? "Modifier l'achat" : "Nouvel achat"} onSubmit={submitDiversForm} onClick={(event) => event.stopPropagation()}>
            <div className="card-h">
              <h2>{editingDivers ? "Modifier l'achat" : "Nouvel achat"}</h2>
              <button type="button" className="link" onClick={closeDiversDialog}>Fermer</button>
            </div>
            <div className="fgrid">
              <label className="full">Description
                <input value={diversForm.name} onChange={(event) => setDiversForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ex : Rallonge électrique 10 m, adaptateur" autoFocus required />
              </label>
              <label>Magasin
                <input value={diversForm.storeName} onChange={(event) => setDiversForm((current) => ({ ...current, storeName: event.target.value }))} placeholder="Ex : Lidl, Action, Bazar du coin..." />
              </label>
              <label>Montant TTC
                <input type="number" step="0.01" value={diversForm.amountTtc} onChange={(event) => setDiversForm((current) => ({ ...current, amountTtc: event.target.value }))} placeholder="0,00" />
              </label>
              <label className="full">Chantier
                <select value={diversForm.projectId} onChange={(event) => setDiversForm((current) => ({ ...current, projectId: event.target.value }))}>
                  <option value="">Sans chantier</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </label>
              <label className="full">Photo du ticket
                <input type="file" accept="image/*" onChange={handleTicketFile} />
                {diversForm.ticketPhoto ? <img src={diversForm.ticketPhoto} alt="Ticket" className="fp-ticket" /> : null}
              </label>
            </div>
            <div className="pm-act">
              {editingDivers ? <button type="button" className="btn btn-sec pm-left" onClick={() => { closeDiversDialog(); deleteSupply(editingDivers); }}>{L.common.delete}</button> : null}
              <button type="button" className="btn btn-sec" onClick={closeDiversDialog}>{L.common.cancel}</button>
              <button type="submit" className="btn btn-main">{editingDivers ? L.common.save : L.common.create}</button>
            </div>
          </form>
        </div>
      ) : null}

      {categoryDialog ? (
        <div className="pmodal-bg" onClick={closeCategoryDialog}>
          <form className="pmodal fp-small" role="dialog" aria-modal="true" aria-label={editingCategory ? L.fournitures.editCategory : L.fournitures.newCategory} onSubmit={submitCategoryForm} onClick={(event) => event.stopPropagation()}>
            <div className="card-h">
              <h2>{editingCategory ? L.fournitures.editCategory : L.fournitures.newCategory}</h2>
              <button type="button" className="link" onClick={closeCategoryDialog}>Fermer</button>
            </div>
            <div className="fgrid">
              <label className="full">Nom de la catégorie
                <input value={categoryForm.name} onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))} placeholder={L.fournitures.category} autoFocus required />
              </label>
            </div>
            <div className="pm-act">
              {editingCategory ? <button type="button" className="btn btn-sec pm-left" onClick={() => { closeCategoryDialog(); deleteCategory(editingCategory); }}>{L.common.delete}</button> : null}
              <button type="button" className="btn btn-sec" onClick={closeCategoryDialog}>{L.common.cancel}</button>
              <button type="submit" className="btn btn-main">{editingCategory ? L.common.save : L.common.create}</button>
            </div>
          </form>
        </div>
      ) : null}

      {statModal ? (
        <div className="pmodal-bg" onClick={() => setStatModal(null)}>
          <div className="pmodal" role="dialog" aria-modal="true" aria-label={STAT_MODAL_TITLES[statModal]} onClick={(event) => event.stopPropagation()}>
            <div className="card-h">
              <h2>{STAT_MODAL_TITLES[statModal]}</h2>
              <button type="button" className="link" onClick={() => setStatModal(null)}>Fermer</button>
            </div>
            {statModalGroups.length === 0 ? <p className="muted">Aucun achat pour le moment.</p> : statModalGroups.map((group) => (
              <div key={group.label}>
                <h3>{group.label}</h3>
                {group.items.map((item) => (
                  <div className="row fp-row" key={item.id} role="button" tabIndex={0} onClick={() => { setStatModal(null); openEditDivers(item); }} onKeyDown={(event) => handleRowKey(event, () => { setStatModal(null); openEditDivers(item); })}>
                    <span className="ct-av sm st">{storeInitials(item.storeName)}</span>
                    <div className="t">
                      <strong>{item.name}</strong>
                      <small>{[item.storeName || "Sans magasin", item.projectTitle || "sans chantier", item.ticketPhoto ? "ticket joint" : "sans ticket"].join(" · ")}</small>
                    </div>
                    <b>{price(item.amountTtc)} TTC</b>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Shell>
  );
}
