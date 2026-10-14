"use client";

import { useEffect, useMemo, useState } from "react";
import { Shell } from "../../../components/Shell";
import { apiGet, apiSend } from "../../../lib/client-api";
import { useLocale } from "../../../lib/i18n";
import { euro, shortDate } from "../../../lib/pricing";
import { useApi } from "../../../lib/use-api";

const units = ["Unite", "Piece", "m2", "ml", "kg", "L", "Cartouche", "Pot 10 L"];

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
  const [fromDevis, setFromDevis] = useState(false);
  const [devisTargetRoom, setDevisTargetRoom] = useState("Services");

  const [sheetOpen, setSheetOpen] = useState(false);
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
    const depensesMois = thisMonth.reduce((sum, item) => sum + (Number(item.amountTtc) || 0), 0);
    const rattachees = diversItems.filter((item) => item.projectId).length;
    const avecTicket = diversItems.filter((item) => item.ticketPhoto).length;
    return {
      depensesMois,
      depensesCount: thisMonth.length,
      rattachees,
      total: diversItems.length,
      avecTicket
    };
  }, [diversItems]);

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

  // ── Supply row ──────────────────────────────────────────────────────────────

  function SupplyRow({ item }) {
    return (
      <article
        className={`supply-row ${fromDevis ? "" : "clickable"}`}
        role={fromDevis ? undefined : "button"}
        tabIndex={fromDevis ? undefined : 0}
        onClick={fromDevis ? undefined : () => openEditSupply(item)}
        onKeyDown={fromDevis ? undefined : (event) => handleRowKey(event, () => openEditSupply(item))}
      >
        <div className="supply-icon">PR</div>
        <div>
          <strong>{item.name}</strong>
          <small>
            {item.category || ""}
            {item.subcategory ? ` › ${item.subcategory}` : ""}
            {item.packaging ? ` — ${item.packaging}` : ""}
            {item.supplierName ? ` — ${item.supplierName}` : ""}
          </small>
        </div>
        <div className="supply-price">
          <strong>{euro(item.salePriceHt ?? item.priceHt)}</strong>
          <small>H.T</small>
        </div>
        {fromDevis ? (
          pendingSupplyId === item.id ? (
            <div className="supply-qty-picker" onClick={(event) => event.stopPropagation()}>
              <button type="button" className="qty-btn" onClick={() => changeQty(-1)}>−</button>
              <input
                type="number"
                className="qty-input"
                min="1"
                value={pendingQty}
                onChange={(event) => setPendingQty(Math.max(1, Number(event.target.value) || 1))}
              />
              <button type="button" className="qty-btn" onClick={() => changeQty(1)}>+</button>
              <button type="button" className="mini-button primary" onClick={() => selectSupplyForDevis(item, pendingQty)}>{L.fournitures.validate}</button>
            </div>
          ) : (
            <button type="button" className="mini-button primary" onClick={(event) => { event.stopPropagation(); openQtyPicker(item); }}>{L.fournitures.choose}</button>
          )
        ) : (
          <>
            {supplyExternalUrl(item) ? <button type="button" className="mini-button" onClick={(event) => openExternal(supplyExternalUrl(item), event)}>{item.sourceUrl ? L.fournitures.link : L.fournitures.site}</button> : null}
            <button type="button" className="mini-button" onClick={(event) => { event.stopPropagation(); openEditSupply(item); }}>{L.common.edit}</button>
            <button type="button" className="mini-danger" onClick={(event) => { event.stopPropagation(); deleteSupply(item); }}>{L.common.delete}</button>
          </>
        )}
      </article>
    );
  }

  // ── Supply form (full-page view) ────────────────────────────────────────────

  if (formOpen) {
    return (
      <Shell>
        <section className="mobile-tool tool-form-view">
          <header className="tool-topline">
            <button type="button" className="plain-back" onClick={() => { setFormOpen(false); setEditingSupply(null); setForm(initialSupply); setImportMessage(""); }}>{"<"}</button>
            <h1>{editingSupply ? L.fournitures.editSupply : L.fournitures.addSupply}</h1>
            <span />
          </header>

          {fromDevis && !editingSupply ? (
            <p className="tool-message">Cette fourniture sera ajoutée directement à votre devis.</p>
          ) : null}

          <form className="mobile-form" onSubmit={createSupply}>
            <div className="segmented large">
              <button type="button" className={!viaUrl ? "active" : ""} onClick={() => setViaUrl(false)}>{L.fournitures.manual}</button>
              <button type="button" className={viaUrl ? "active" : ""} onClick={() => setViaUrl(true)}>{L.fournitures.addViaUrl}</button>
            </div>

            {viaUrl ? (
              <label className="mobile-input full">
                <span>{L.fournitures.productLink}</span>
                <div className="url-fetch-row">
                  <input value={form.sourceUrl} onChange={(event) => setField("sourceUrl", event.target.value)} placeholder="https://..." />
                  <button type="button" className="mini-button primary" onClick={fetchFromUrl} disabled={!form.sourceUrl.trim() || importing}>
                    {importing ? "..." : L.fournitures.fetch}
                  </button>
                </div>
                {importMessage ? <small className="import-message">{importMessage}</small> : null}
              </label>
            ) : null}

            <label className="mobile-input full">
              <span>{L.fournitures.description}</span>
              <input value={form.name} onChange={(event) => setField("name", event.target.value)} placeholder={L.fournitures.name} required={!viaUrl} />
              <small className="muted">{L.fournitures.descriptionHint}</small>
            </label>

            <div className="mobile-form-grid">
              <label className="mobile-input">
                <span>{L.fournitures.category}</span>
                <select value={form.category} onChange={(event) => setField("category", event.target.value)}>
                  <option value="">{L.fournitures.noCategory}</option>
                  {categories.map((cat) => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                </select>
              </label>
              <label className="mobile-input">
                <span>{L.fournitures.supplier}</span>
                <select value={form.supplierId} onChange={(event) => setField("supplierId", event.target.value)}>
                  <option value="">{L.fournitures.noSupplierOpt}</option>
                  {uniqueSuppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                </select>
              </label>
            </div>

            {supplierWebsite(form.supplierId) ? (
              <button type="button" className="supplier-site-button" onClick={(event) => openExternal(supplierWebsite(form.supplierId), event)}>
                {L.fournitures.openSite}
              </button>
            ) : null}

            <div className="mobile-form-grid">
              <label className="mobile-input">
                <span>{L.fournitures.purchasePrice}</span>
                <input type="number" step="0.01" value={form.purchasePriceHt} onChange={(event) => setField("purchasePriceHt", event.target.value)} placeholder="0.00" />
              </label>
              <label className="mobile-input">
                <span>{L.fournitures.salePrice}</span>
                <input type="number" step="0.01" value={form.salePriceHt} onChange={(event) => setField("salePriceHt", event.target.value)} placeholder="0.00" />
              </label>
            </div>

            <label className="mobile-input full">
              <span>{L.fournitures.packaging}</span>
              <input value={form.packaging} onChange={(event) => setField("packaging", event.target.value)} placeholder="Pot 10 L, pièce, carton..." />
            </label>

            <div className="mobile-form-grid">
              <label className="mobile-input">
                <span>{L.fournitures.quantity}</span>
                <input type="number" step="0.01" value={form.quantity} onChange={(event) => setField("quantity", event.target.value)} placeholder="0" />
              </label>
              <label className="mobile-input">
                <span>{L.fournitures.unit}</span>
                <select value={form.unit} onChange={(event) => setField("unit", event.target.value)}>
                  {units.map((unit) => <option key={unit}>{unit}</option>)}
                </select>
              </label>
            </div>

            <label className="mobile-input full">
              <span>{L.fournitures.barcode}</span>
              <input value={form.barcode} onChange={(event) => setField("barcode", event.target.value)} placeholder={L.fournitures.barcode} />
            </label>
            <label className="mobile-input full">
              <span>{L.fournitures.image}</span>
              <input value={form.imageUrl} onChange={(event) => setField("imageUrl", event.target.value)} placeholder={L.fournitures.image} />
            </label>

            <button className="mobile-primary">{editingSupply ? L.common.save : fromDevis ? L.fournitures.addToDevisBtn : L.fournitures.createSupply}</button>
          </form>
        </section>
      </Shell>
    );
  }

  // ── Main list view ──────────────────────────────────────────────────────────

  return (
    <Shell>
      <section className="mobile-tool">
        <header className="catalogue-topline">
          <button type="button" className="plain-back" onClick={() => fromDevis ? window.location.assign("/devis?new=1") : (window.history.length > 1 ? window.history.back() : window.location.assign("/fournitures"))}>{"<"}</button>
          <div className="catalogue-topline-title">
            <h1>Fournitures</h1>
            <p>{CATALOGUE_SUBTITLES[activeTab] || CATALOGUE_SUBTITLES.categories}</p>
          </div>
          {!fromDevis ? <a href="/fournitures?newOrder=1" className="button blue">+ Nouvelle commande</a> : <span />}
        </header>

        {fromDevis ? (
          <div className="fournitures-select-banner">
            <span>{L.fournitures.selectForDevis}</span>
            <button type="button" className="mini-button" onClick={() => window.location.assign("/devis?new=1")}>{L.fournitures.backNoSelect}</button>
          </div>
        ) : null}

        <div className="segmented">
          <button type="button" className={activeTab === "categories" ? "active" : ""} onClick={() => setActiveTab("categories")}>{L.fournitures.categories}</button>
          <button type="button" className={activeTab === "fournisseurs" ? "active" : ""} onClick={() => setActiveTab("fournisseurs")}>{L.fournitures.bySupplier}</button>
          <button type="button" className={activeTab === "divers" ? "active" : ""} onClick={() => setActiveTab("divers")}>{L.fournitures.various}</button>
        </div>

        {message ? <p className="tool-message">{message}</p> : null}

        {activeTab === "categories" ? (
          <div className="categories-layout">
            {/* Left: category tree */}
            <div className="category-tree">
              <button
                type="button"
                className={`cat-tree-btn ${!activeCategory ? "active" : ""}`}
                onClick={() => setActiveCategory("")}
              >
                {L.fournitures.all}
              </button>

              {categories.map((cat) => {
                const isCatActive = activeCategory === cat.name;
                return (
                  <div key={cat.id} className="cat-tree-row">
                    <button
                      type="button"
                      className={`cat-tree-btn ${isCatActive ? "active" : ""}`}
                      onClick={() => selectTreeCategory(cat.name)}
                    >
                      {cat.name}
                    </button>
                    <button type="button" className="cat-tree-edit" onClick={() => openCategoryDialog(cat)} title="Modifier">✎</button>
                  </div>
                );
              })}

              <button type="button" className="cat-tree-add" onClick={() => openCategoryDialog()}>
                + {L.fournitures.addCategory}
              </button>
            </div>

            {/* Right: supply list */}
            <div className="cat-supply-panel">
              <div className="catalogue-search-row">
                <input
                  className="supplier-search-input"
                  value={categorySearch}
                  onChange={(event) => setCategorySearch(event.target.value)}
                  placeholder="Rechercher une fourniture..."
                />
                <button
                  type="button"
                  className="button blue"
                  onClick={() => { setForm({ ...initialSupply, category: activeCategory }); setEditingSupply(null); setFormOpen(true); }}
                >
                  + Ajouter une fourniture
                </button>
              </div>

              {visibleSupplies.length === 0 ? (
                <>
                  <div className="catalogue-empty-card">
                    <span className="catalogue-empty-icon">📦</span>
                    <strong>Votre catalogue est vide</strong>
                    <p>Ajoutez les matériaux que vous utilisez le plus souvent. Ils seront proposés en un clic dans vos devis et vos commandes.</p>
                    <div className="catalogue-empty-actions">
                      <button
                        type="button"
                        className="button blue"
                        onClick={() => { setForm({ ...initialSupply, category: activeCategory }); setEditingSupply(null); setFormOpen(true); }}
                      >
                        + Ajouter une fourniture
                      </button>
                      <button type="button" className="button secondary" onClick={() => { setForm({ ...initialSupply, category: activeCategory }); setEditingSupply(null); setViaUrl(true); setFormOpen(true); }}>
                        Importer un fichier
                      </button>
                    </div>
                  </div>
                  {categories.length === 0 ? (
                    <div className="catalogue-suggestions-card">
                      <strong>Commencer par une catégorie</strong>
                      <div className="catalogue-suggestions-row">
                        {SUGGESTED_CATEGORIES.map((name) => (
                          <button type="button" key={name} className="catalogue-suggestion-pill" onClick={() => quickAddCategory(name)}>+ {name}</button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                visibleSupplies.map((item) => <SupplyRow key={item.id} item={item} />)
              )}
            </div>
          </div>
        ) : activeTab === "fournisseurs" ? (
          <div className="supplier-master-detail">
            <div className="supplier-list-panel">
              <div className="panel-header">
                <strong className="title-chip">{L.fournitures.bySupplier}</strong>
                <button type="button" className="mini-button primary" onClick={() => { setEditingSupplier(null); setSupplierForm(initialSupplier); setSupplierDialog(true); }}>+ {L.common.add}</button>
              </div>
              <input
                className="supplier-search-input"
                value={supplierSearch}
                onChange={(event) => setSupplierSearch(event.target.value)}
                placeholder="Rechercher un fournisseur..."
              />
              {filteredSupplierList.length === 0 ? <div className="tool-empty">{L.fournitures.noSuppliers}</div> : null}
              <div className="supplier-list-items">
                {filteredSupplierList.map((supplier) => (
                  <button
                    type="button"
                    key={supplier.id}
                    className={`supplier-list-item ${supplier.id === selectedSupplierId ? "active" : ""}`}
                    onClick={() => setSelectedSupplierId(supplier.id)}
                  >
                    <span className="supplier-list-avatar">{(supplier.name || "FS").slice(0, 2).toUpperCase()}</span>
                    <span className="supplier-list-name">{supplier.name}</span>
                    <span className="supplier-list-count">{supplierArticleCount[supplier.id] || 0}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="supplier-detail-panel">
              {!selectedSupplier ? (
                <div className="tool-empty">{L.fournitures.noSuppliers}</div>
              ) : (
                <>
                  <div className="supplier-detail-header">
                    <span className="supplier-detail-avatar">{(selectedSupplier.name || "FS").slice(0, 2).toUpperCase()}</span>
                    <div className="supplier-detail-identity">
                      <strong>{selectedSupplier.name}</strong>
                      <div className="supplier-detail-contacts">
                        {selectedSupplier.phone ? <span>📞 {selectedSupplier.phone}</span> : null}
                        {selectedSupplier.email ? <span>✉️ {selectedSupplier.email}</span> : null}
                        {(selectedSupplier.website || officialSupplierUrl(selectedSupplier.name)) ? (
                          <span
                            className="supplier-detail-link"
                            onClick={(event) => openExternal(selectedSupplier.website || officialSupplierUrl(selectedSupplier.name), event)}
                          >
                            🌐 {selectedSupplier.website || officialSupplierUrl(selectedSupplier.name)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="supplier-detail-actions">
                      <button type="button" className="mini-button" onClick={() => openEditSupplier(selectedSupplier)}>{L.common.edit}</button>
                      <button type="button" className="mini-danger" onClick={() => deleteSupplier(selectedSupplier)}>{L.common.delete}</button>
                    </div>
                  </div>

                  <div className="supplier-stat-grid">
                    <div className="fournitures-kpi-card">
                      <div className="fournitures-kpi-card-head">
                        <span className="fournitures-kpi-icon fournitures-kpi-icon-blue">📦</span>
                        <span className="title-chip">Articles</span>
                      </div>
                      <strong>{selectedSupplierArticles.length}</strong>
                      <small>au catalogue</small>
                    </div>
                    <div className="fournitures-kpi-card">
                      <div className="fournitures-kpi-card-head">
                        <span className="fournitures-kpi-icon fournitures-kpi-icon-amber">🛒</span>
                        <span className="title-chip">Commandes en cours</span>
                      </div>
                      <strong>{selectedSupplierStats.enCours}</strong>
                      <small>non livrées</small>
                    </div>
                    <div className="fournitures-kpi-card">
                      <div className="fournitures-kpi-card-head">
                        <span className="fournitures-kpi-icon fournitures-kpi-icon-green">💶</span>
                        <span className="title-chip">Dépenses du mois</span>
                      </div>
                      <strong>{euro(selectedSupplierStats.depensesMois)}</strong>
                      <small>HT, ce mois-ci</small>
                    </div>
                    <div className="fournitures-kpi-card">
                      <div className="fournitures-kpi-card-head">
                        <span className="fournitures-kpi-icon fournitures-kpi-icon-purple">⏱</span>
                        <span className="title-chip">Délai moyen</span>
                      </div>
                      <strong>{selectedSupplierStats.delaiMoyen === null ? "—" : `${selectedSupplierStats.delaiMoyen} j`}</strong>
                      <small>de livraison</small>
                    </div>
                  </div>

                  <div className="supplier-articles-section">
                    <div className="panel-header">
                      <strong className="title-chip">Articles de ce fournisseur</strong>
                      <button
                        type="button"
                        className="mini-button primary"
                        onClick={() => { setForm({ ...initialSupply, supplierId: selectedSupplier.id }); setEditingSupply(null); setFormOpen(true); }}
                      >
                        + {L.common.add}
                      </button>
                    </div>
                    {selectedSupplierArticles.length === 0 ? (
                      <div className="tool-empty">{L.fournitures.noSupplies}</div>
                    ) : (
                      <div className="supplier-articles-list">
                        {selectedSupplierArticles.map((item) => (
                          <div className="supplier-article-row" key={item.id} onClick={() => openEditSupply(item)}>
                            <span className="supplier-article-name">{item.name}</span>
                            <span className="supplier-article-price">{euro(item.salePriceHt ?? item.priceHt)}</span>
                            {item.sourceUrl ? (
                              <button type="button" className="mini-button" onClick={(event) => openExternal(item.sourceUrl, event)}>Lien</button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="supplier-master-detail">
            <div className="supplier-list-panel">
              <div className="panel-header">
                <strong className="title-chip">Tous les magasins</strong>
                <span className="supplier-list-count">{diversItems.length}</span>
              </div>
              <div className="supplier-list-items">
                <button
                  type="button"
                  className={`supplier-list-item ${!selectedStore ? "active" : ""}`}
                  onClick={() => setSelectedStore("")}
                >
                  <span className="supplier-list-name">Tous les magasins</span>
                  <span className="supplier-list-count">{diversItems.length}</span>
                </button>
                {storeList.map((store) => (
                  <button
                    type="button"
                    key={store.name}
                    className={`supplier-list-item ${selectedStore === store.name ? "active" : ""}`}
                    onClick={() => setSelectedStore(store.name)}
                  >
                    <span className="supplier-list-name">{store.name}</span>
                    <span className="supplier-list-count">{store.count}</span>
                  </button>
                ))}
              </div>
              <button type="button" className="cat-tree-add" onClick={openAddDivers}>
                + Ajouter un magasin
              </button>
            </div>

            <div className="supplier-detail-panel">
              <div className="catalogue-info-banner">
                ℹ️ Pour les petits achats sans fournisseur : prenez le ticket en photo et rattachez l'achat à un chantier pour suivre vos dépenses.
              </div>

              <div className="supplier-stat-grid">
                <div className="fournitures-kpi-card">
                  <div className="fournitures-kpi-card-head">
                    <span className="fournitures-kpi-icon fournitures-kpi-icon-green">💶</span>
                    <span className="title-chip">Dépenses du mois</span>
                  </div>
                  <strong>{euro(diversStats.depensesMois)}</strong>
                  <small>{diversStats.depensesCount} achat{diversStats.depensesCount > 1 ? "s" : ""}</small>
                </div>
                <div className="fournitures-kpi-card">
                  <div className="fournitures-kpi-card-head">
                    <span className="fournitures-kpi-icon fournitures-kpi-icon-blue">🏗️</span>
                    <span className="title-chip">Rattachées à un chantier</span>
                  </div>
                  <strong>{diversStats.rattachees}</strong>
                  <small>sur {diversStats.total} achat{diversStats.total > 1 ? "s" : ""}</small>
                </div>
                <div className="fournitures-kpi-card">
                  <div className="fournitures-kpi-card-head">
                    <span className="fournitures-kpi-icon fournitures-kpi-icon-amber">🧾</span>
                    <span className="title-chip">Tickets joints</span>
                  </div>
                  <strong>{diversStats.avecTicket}/{diversStats.total}</strong>
                  <small>{diversStats.total - diversStats.avecTicket > 0 ? `${diversStats.total - diversStats.avecTicket} ticket${diversStats.total - diversStats.avecTicket > 1 ? "s" : ""} manquant${diversStats.total - diversStats.avecTicket > 1 ? "s" : ""}` : "tout est à jour"}</small>
                </div>
              </div>

              <div className="catalogue-search-row">
                <input
                  className="supplier-search-input"
                  value={diversSearch}
                  onChange={(event) => setDiversSearch(event.target.value)}
                  placeholder="Rechercher un achat ou un magasin..."
                />
                <button type="button" className="button blue" onClick={openAddDivers}>+ Ajouter un achat</button>
              </div>

              {filteredDiversItems.length === 0 ? (
                <div className="tool-empty">{L.fournitures.noDivers}</div>
              ) : (
                <div className="supplier-articles-list">
                  {filteredDiversItems.map((item) => (
                    <div className="divers-purchase-row" key={item.id} onClick={() => openEditDivers(item)}>
                      <span className="supplier-list-avatar">{storeInitials(item.storeName)}</span>
                      <div className="divers-purchase-main">
                        <strong>{item.name}</strong>
                        <small>{item.storeName || "Sans magasin"} · {shortDate(item.createdAt)}</small>
                      </div>
                      <div className="divers-purchase-tags">
                        {item.projectTitle ? <span className="divers-tag divers-tag-project">{item.projectTitle}</span> : <span className="divers-tag">Sans chantier</span>}
                        {item.ticketPhoto ? <span className="divers-tag divers-tag-ticket">📎 Ticket</span> : <span className="divers-tag divers-tag-warning">Sans ticket</span>}
                      </div>
                      <span className="supplier-article-price">{euro(item.amountTtc)} <small>TTC</small></span>
                      <button type="button" className="mini-button" onClick={(event) => { event.stopPropagation(); openEditDivers(item); }}>{L.common.edit}</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <button type="button" className="floating-add" onClick={() => setSheetOpen(true)} aria-label="Ajouter">+</button>

        {sheetOpen ? (
          <div className="sheet-overlay" onClick={() => setSheetOpen(false)}>
            <div className="bottom-sheet" onClick={(event) => event.stopPropagation()}>
              <span className="sheet-handle" />
              <button type="button" className="sheet-choice" onClick={() => { setSheetOpen(false); setFormOpen(true); }}>
                <span>PR</span>
                <div><strong>{L.fournitures.addSupply}</strong><small>{L.fournitures.addSupplySub}</small></div>
                <b>{">"}</b>
              </button>
              <button type="button" className="sheet-choice" onClick={() => { setSheetOpen(false); setEditingSupplier(null); setSupplierForm(initialSupplier); setSupplierDialog(true); }}>
                <span>FS</span>
                <div><strong>{L.fournitures.addSupplier}</strong><small>{L.fournitures.addSupplierSub}</small></div>
                <b>{">"}</b>
              </button>
              <button type="button" className="sheet-choice" onClick={() => { setSheetOpen(false); openCategoryDialog(); }}>
                <span>CT</span>
                <div><strong>{L.fournitures.addCategory}</strong><small>{L.fournitures.addCategorySub}</small></div>
                <b>{">"}</b>
              </button>
            </div>
          </div>
        ) : null}

        {supplierDialog ? (
          <div className="modal-overlay" onClick={closeSupplierDialog}>
            <form className="mini-modal category-modal" onSubmit={createSupplier} onClick={(event) => event.stopPropagation()}>
              <h2>{editingSupplier ? L.fournitures.editSupplier : L.fournitures.newSupplier}</h2>
              <label className="category-modal-field">
                <span>{L.fournitures.supplierName}</span>
                <input value={supplierForm.name} onChange={(event) => setSupplierForm((current) => ({ ...current, name: event.target.value }))} placeholder={L.fournitures.supplierName} autoFocus required />
              </label>
              <label className="category-modal-field">
                <span>{L.fournitures.supplierEmail}</span>
                <input value={supplierForm.email} onChange={(event) => setSupplierForm((current) => ({ ...current, email: event.target.value }))} placeholder="email@..." type="email" />
              </label>
              <label className="category-modal-field">
                <span>{L.fournitures.supplierPhone}</span>
                <input value={supplierForm.phone} onChange={(event) => setSupplierForm((current) => ({ ...current, phone: event.target.value }))} placeholder="06 00 00 00 00" />
              </label>
              <label className="category-modal-field">
                <span>{L.fournitures.supplierAddress}</span>
                <input value={supplierForm.address} onChange={(event) => setSupplierForm((current) => ({ ...current, address: event.target.value }))} placeholder={L.fournitures.supplierAddress} />
              </label>
              <label className="category-modal-field">
                <span>{L.fournitures.supplierWebsite}</span>
                <input value={supplierForm.website} onChange={(event) => setSupplierForm((current) => ({ ...current, website: event.target.value }))} placeholder="https://..." />
              </label>
              <label className="category-modal-field">
                <span>{L.fournitures.supplierNotes}</span>
                <input value={supplierForm.notes} onChange={(event) => setSupplierForm((current) => ({ ...current, notes: event.target.value }))} placeholder={L.fournitures.supplierNotes} />
              </label>
              <div className="category-modal-actions">
                {editingSupplier ? (
                  <button type="button" className="button danger small" onClick={() => { closeSupplierDialog(); deleteSupplier(editingSupplier); }}>{L.common.delete}</button>
                ) : null}
                <button type="button" onClick={closeSupplierDialog}>{L.common.cancel}</button>
                <button type="submit" className="button blue">{editingSupplier ? L.common.save : L.common.create}</button>
              </div>
            </form>
          </div>
        ) : null}

        {diversDialog ? (
          <div className="modal-overlay" onClick={closeDiversDialog}>
            <form className="mini-modal category-modal" onSubmit={submitDiversForm} onClick={(event) => event.stopPropagation()}>
              <h2>{editingDivers ? "Modifier l'achat" : "Nouvel achat"}</h2>
              <label className="category-modal-field">
                <span>Description</span>
                <input
                  value={diversForm.name}
                  onChange={(event) => setDiversForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Ex : Rallonge électrique 10 m, adaptateur"
                  autoFocus
                  required
                />
              </label>
              <label className="category-modal-field">
                <span>Magasin</span>
                <input
                  value={diversForm.storeName}
                  onChange={(event) => setDiversForm((current) => ({ ...current, storeName: event.target.value }))}
                  placeholder="Ex : Lidl, Action, Bazar du coin..."
                />
              </label>
              <label className="category-modal-field">
                <span>Montant (TTC)</span>
                <input
                  type="number"
                  step="0.01"
                  value={diversForm.amountTtc}
                  onChange={(event) => setDiversForm((current) => ({ ...current, amountTtc: event.target.value }))}
                  placeholder="0,00"
                />
              </label>
              <label className="category-modal-field">
                <span>Chantier</span>
                <select value={diversForm.projectId} onChange={(event) => setDiversForm((current) => ({ ...current, projectId: event.target.value }))}>
                  <option value="">Sans chantier</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </label>
              <label className="category-modal-field">
                <span>Photo du ticket</span>
                <input type="file" accept="image/*" onChange={handleTicketFile} />
                {diversForm.ticketPhoto ? <img src={diversForm.ticketPhoto} alt="Ticket" className="divers-ticket-preview" /> : null}
              </label>
              <div className="category-modal-actions">
                {editingDivers ? (
                  <button type="button" className="button danger small" onClick={() => { closeDiversDialog(); deleteSupply(editingDivers); }}>{L.common.delete}</button>
                ) : null}
                <button type="button" onClick={closeDiversDialog}>{L.common.cancel}</button>
                <button type="submit" className="button blue">{editingDivers ? L.common.save : L.common.create}</button>
              </div>
            </form>
          </div>
        ) : null}

        {categoryDialog ? (
          <div className="modal-overlay" onClick={closeCategoryDialog}>
            <form className="mini-modal category-modal" onSubmit={submitCategoryForm} onClick={(event) => event.stopPropagation()}>
              <h2>{editingCategory ? L.fournitures.editCategory : L.fournitures.newCategory}</h2>

              <label className="category-modal-field">
                <span>{L.fournitures.description}</span>
                <input
                  value={categoryForm.name}
                  onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder={L.fournitures.category}
                  autoFocus
                  required
                />
              </label>

              <div className="category-modal-actions">
                {editingCategory ? (
                  <button type="button" className="button danger small" onClick={() => { closeCategoryDialog(); deleteCategory(editingCategory); }}>{L.common.delete}</button>
                ) : null}
                <button type="button" onClick={closeCategoryDialog}>{L.common.cancel}</button>
                <button type="submit" className="button blue">{editingCategory ? L.common.save : L.common.create}</button>
              </div>
            </form>
          </div>
        ) : null}
      </section>
    </Shell>
  );
}
