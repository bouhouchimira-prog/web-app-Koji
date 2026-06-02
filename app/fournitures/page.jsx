"use client";

import { useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiSend } from "../../lib/client-api";
import { euro } from "../../lib/pricing";
import { useApi } from "../../lib/use-api";

const categories = ["Materiaux", "Peinture", "Sol", "Accessoires", "Divers"];
const units = ["Unite", "Piece", "m2", "ml", "kg", "L", "Cartouche", "Pot 10 L"];

const initialSupply = {
  name: "",
  category: "Peinture",
  supplierId: "",
  purchasePriceHt: "",
  salePriceHt: "",
  packaging: "",
  quantity: "",
  unit: "Unite",
  barcode: "",
  imageUrl: "",
  sourceUrl: ""
};

export default function SuppliesPage() {
  const { data: supplies, setData: setSupplies } = useApi("/api/supplies", "supplies");
  const { data: suppliers, setData: setSuppliers } = useApi("/api/suppliers", "suppliers");
  const [activeTab, setActiveTab] = useState("recents");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [viaUrl, setViaUrl] = useState(false);
  const [supplierDialog, setSupplierDialog] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [form, setForm] = useState(initialSupply);
  const [message, setMessage] = useState("");

  const visibleSupplies = useMemo(() => {
    if (activeTab === "divers") return supplies.filter((item) => !item.supplierId);
    return supplies;
  }, [activeTab, supplies]);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function supplierLabel(id) {
    return suppliers.find((item) => item.id === id)?.name || "";
  }

  async function createSupply(event) {
    event.preventDefault();
    const { supply } = await apiSend("/api/supplies", {
      ...form,
      supplierName: supplierLabel(form.supplierId),
      purchasePriceHt: Number(form.purchasePriceHt || 0),
      salePriceHt: Number(form.salePriceHt || form.purchasePriceHt || 0),
      quantity: Number(form.quantity || 0),
      stock: Number(form.quantity || 0)
    });
    setSupplies([supply, ...supplies]);
    setForm(initialSupply);
    setFormOpen(false);
    setMessage(`Fourniture ajoutee: ${supply.name}`);
  }

  async function createSupplier(event) {
    event.preventDefault();
    const name = supplierName.trim();
    if (!name) return;
    const { supplier } = await apiSend("/api/suppliers", { name });
    setSuppliers([supplier, ...suppliers]);
    setSupplierName("");
    setSupplierDialog(false);
    setActiveTab("fournisseurs");
    setMessage(`Fournisseur ajoute: ${supplier.name}`);
  }

  async function deleteSupply(item) {
    const { supply } = await apiSend("/api/supplies", { id: item.id, action: "delete" }, "PATCH");
    if (supply?.deleted) setSupplies(supplies.filter((candidate) => candidate.id !== item.id));
  }

  async function deleteSupplier(item) {
    const { supplier } = await apiSend("/api/suppliers", { id: item.id, action: "delete" }, "PATCH");
    if (supplier?.deleted) setSuppliers(suppliers.filter((candidate) => candidate.id !== item.id));
  }

  if (formOpen) {
    return (
      <Shell>
        <section className="mobile-tool tool-form-view">
          <header className="tool-topline">
            <button type="button" className="plain-back" onClick={() => setFormOpen(false)}>{"<"}</button>
            <h1>Ajouter une fourniture</h1>
            <span />
          </header>

          <form className="mobile-form" onSubmit={createSupply}>
            <div className="segmented large">
              <button type="button" className={!viaUrl ? "active" : ""} onClick={() => setViaUrl(false)}>Manuel</button>
              <button type="button" className={viaUrl ? "active" : ""} onClick={() => setViaUrl(true)}>Via URL</button>
            </div>

            {viaUrl ? (
              <label className="mobile-input full">
                <span>Lien produit</span>
                <input value={form.sourceUrl} onChange={(event) => setField("sourceUrl", event.target.value)} placeholder="https://..." />
              </label>
            ) : null}

            <label className="mobile-input full">
              <span>Nom du produit</span>
              <input value={form.name} onChange={(event) => setField("name", event.target.value)} placeholder="Nom du produit" required />
            </label>

            <div className="mobile-form-grid">
              <label className="mobile-input">
                <span>Categorie</span>
                <select value={form.category} onChange={(event) => setField("category", event.target.value)}>
                  {categories.map((category) => <option key={category}>{category}</option>)}
                </select>
              </label>
              <label className="mobile-input">
                <span>Fournisseur</span>
                <select value={form.supplierId} onChange={(event) => setField("supplierId", event.target.value)}>
                  <option value="">Aucun (Divers)</option>
                  {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                </select>
              </label>
            </div>

            <div className="mobile-form-grid">
              <label className="mobile-input">
                <span>Prix d'achat H.T</span>
                <input type="number" step="0.01" value={form.purchasePriceHt} onChange={(event) => setField("purchasePriceHt", event.target.value)} placeholder="0.00" />
              </label>
              <label className="mobile-input">
                <span>Prix de vente H.T</span>
                <input type="number" step="0.01" value={form.salePriceHt} onChange={(event) => setField("salePriceHt", event.target.value)} placeholder="0.00" />
              </label>
            </div>

            <label className="mobile-input full">
              <span>Conditionnement</span>
              <input value={form.packaging} onChange={(event) => setField("packaging", event.target.value)} placeholder="Pot 10 L, piece, carton..." />
            </label>

            <div className="mobile-form-grid">
              <label className="mobile-input">
                <span>Quantite</span>
                <input type="number" step="0.01" value={form.quantity} onChange={(event) => setField("quantity", event.target.value)} placeholder="0" />
              </label>
              <label className="mobile-input">
                <span>Unite</span>
                <select value={form.unit} onChange={(event) => setField("unit", event.target.value)}>
                  {units.map((unit) => <option key={unit}>{unit}</option>)}
                </select>
              </label>
            </div>

            <label className="mobile-input full">
              <span>Code-barres</span>
              <input value={form.barcode} onChange={(event) => setField("barcode", event.target.value)} placeholder="Code-barres" />
            </label>
            <label className="mobile-input full">
              <span>URL de l'image</span>
              <input value={form.imageUrl} onChange={(event) => setField("imageUrl", event.target.value)} placeholder="URL de l'image" />
            </label>

            <button className="mobile-primary">Enregistrer</button>
          </form>
        </section>
      </Shell>
    );
  }

  return (
    <Shell>
      <section className="mobile-tool">
        <header className="tool-topline">
          <button type="button" className="plain-back" onClick={() => window.history.back()}>{"<"}</button>
          <h1>Fournitures</h1>
          <span />
        </header>

        <div className="segmented">
          <button type="button" className={activeTab === "recents" ? "active" : ""} onClick={() => setActiveTab("recents")}>Recents</button>
          <button type="button" className={activeTab === "divers" ? "active" : ""} onClick={() => setActiveTab("divers")}>Divers</button>
          <button type="button" className={activeTab === "fournisseurs" ? "active" : ""} onClick={() => setActiveTab("fournisseurs")}>Fournisseurs</button>
        </div>

        {message ? <p className="tool-message">{message}</p> : null}

        {activeTab === "fournisseurs" ? (
          <div className="tool-list">
            {suppliers.length === 0 ? <div className="tool-empty">Aucun fournisseur pour le moment.</div> : null}
            {suppliers.map((supplier) => (
              <article className="supply-row" key={supplier.id}>
                <div className="supply-icon">FS</div>
                <div>
                  <strong>{supplier.name}</strong>
                  <small>{supplier.email || supplier.phone || "Fournisseur"}</small>
                </div>
                <button type="button" className="mini-danger" onClick={() => deleteSupplier(supplier)}>Supprimer</button>
              </article>
            ))}
          </div>
        ) : (
          <div className="tool-list">
            {visibleSupplies.length === 0 ? <div className="tool-empty">Aucune fourniture pour le moment.</div> : null}
            {visibleSupplies.map((item) => (
              <article className="supply-row" key={item.id}>
                <div className="supply-icon">PR</div>
                <div>
                  <strong>{item.name}</strong>
                  <small><span>{item.category}</span>{item.packaging ? ` - ${item.packaging}` : ""}{item.supplierName ? ` - ${item.supplierName}` : ""}</small>
                </div>
                <div className="supply-price">
                  <strong>{euro(item.salePriceHt ?? item.priceHt)}</strong>
                  <small>H.T</small>
                </div>
                <button type="button" className="mini-danger" onClick={() => deleteSupply(item)}>Supprimer</button>
              </article>
            ))}
          </div>
        )}

        <button type="button" className="floating-add" onClick={() => setSheetOpen(true)} aria-label="Ajouter">+</button>

        {sheetOpen ? (
          <div className="sheet-overlay" onClick={() => setSheetOpen(false)}>
            <div className="bottom-sheet" onClick={(event) => event.stopPropagation()}>
              <span className="sheet-handle" />
              <button type="button" className="sheet-choice" onClick={() => { setSheetOpen(false); setFormOpen(true); }}>
                <span>PR</span>
                <div><strong>Ajouter une fourniture</strong><small>Ajouter manuellement ou via un lien</small></div>
                <b>{">"}</b>
              </button>
              <button type="button" className="sheet-choice" onClick={() => { setSheetOpen(false); setSupplierDialog(true); }}>
                <span>FS</span>
                <div><strong>Ajouter un fournisseur</strong><small>Creer un nouveau fournisseur</small></div>
                <b>{">"}</b>
              </button>
            </div>
          </div>
        ) : null}

        {supplierDialog ? (
          <div className="modal-overlay" onClick={() => setSupplierDialog(false)}>
            <form className="mini-modal" onSubmit={createSupplier} onClick={(event) => event.stopPropagation()}>
              <h2>Nouveau Fournisseur</h2>
              <input value={supplierName} onChange={(event) => setSupplierName(event.target.value)} placeholder="Nom du fournisseur" autoFocus required />
              <div>
                <button type="button" onClick={() => setSupplierDialog(false)}>Annuler</button>
                <button type="submit">Creer</button>
              </div>
            </form>
          </div>
        ) : null}
      </section>
    </Shell>
  );
}
