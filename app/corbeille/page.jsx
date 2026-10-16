"use client";

import { useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiSend } from "../../lib/client-api";
import { contactDisplayName } from "../../lib/contacts";
import { shortDate } from "../../lib/pricing";
import { useApi } from "../../lib/use-api";

// Corbeille (16 oct, maquette Artifact CorbeilleListe/CorbeilleAjout) —
// refonte complete depuis la premiere version (15 oct, Contacts + Avenants
// uniquement, Chantiers/Devis renvoyaient vers Archives). Regroupe
// desormais les 5 types directement, avec un vrai compte a rebours avant
// suppression definitive (date d'archivage reelle pour chaque type — voir
// app/api/{contacts,avenants,quotes,projects,invoices}/route.js) et une
// confirmation "tapez SUPPRIMER" avant toute suppression definitive.
// Important : il n'existe aucune tache planifiee qui purge automatiquement
// au bout de 30 jours — le decompte est informatif, la suppression reste
// toujours une action volontaire (Restaurer / Supprimer definitivement).
const RETENTION_DAYS = 30;

const TYPE_META = {
  devis: { label: "Devis", icon: "📄" },
  facture: { label: "Facture", icon: "🧾" },
  chantier: { label: "Chantier", icon: "🏗️" },
  contact: { label: "Contact", icon: "👤" },
  avenant: { label: "Avenant", icon: "📝" }
};

const FILTER_TABS = [
  { id: "tous", label: "Tout" },
  { id: "devis", label: "Devis" },
  { id: "facture", label: "Factures" },
  { id: "chantier", label: "Chantiers" },
  { id: "contact", label: "Contacts" },
  { id: "avenant", label: "Avenants" }
];

function daysAgoLabel(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const that = new Date(date); that.setHours(0, 0, 0, 0);
  const diff = Math.round((today - that) / 86400000);
  if (diff <= 0) return "Aujourd'hui";
  if (diff === 1) return "Hier";
  return shortDate(iso);
}

function daysLeft(iso) {
  if (!iso) return RETENTION_DAYS;
  const elapsed = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return Math.max(0, RETENTION_DAYS - elapsed);
}

export default function CorbeillePage() {
  const { data: allContacts, setData: setAllContacts } = useApi("/api/contacts?includeArchived=1", "contacts");
  const { data: allAvenants, setData: setAllAvenants } = useApi("/api/avenants", "avenants");
  const { data: allProjects, setData: setAllProjects } = useApi("/api/projects", "projects");
  const { data: allQuotes, setData: setAllQuotes } = useApi("/api/quotes", "quotes");
  const { data: allInvoices, setData: setAllInvoices } = useApi("/api/invoices?includeArchived=1", "invoices");

  const [tab, setTab] = useState("tous");
  const [search, setSearch] = useState("");
  const [confirmTarget, setConfirmTarget] = useState(null); // { item } or { bulk: true }
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const items = useMemo(() => {
    const contacts = allContacts.filter((c) => c.archived).map((c) => ({
      kind: "contact",
      id: c.id,
      title: contactDisplayName(c),
      subtitle: "Supprimé par vous",
      archivedAt: c.archivedAt,
      raw: c
    }));
    const avenants = allAvenants.filter((a) => a.status === "Archive").map((a) => ({
      kind: "avenant",
      id: a.id,
      title: `${a.numero} · ${a.quoteNumber}`,
      subtitle: "Supprimé par vous",
      archivedAt: a.archivedAt,
      raw: a
    }));
    const chantiers = allProjects.filter((p) => p.status === "Archive").map((p) => ({
      kind: "chantier",
      id: p.id,
      title: p.title,
      subtitle: "Supprimé par vous",
      archivedAt: p.archivedAt,
      raw: p
    }));
    const devis = allQuotes.filter((q) => q.status === "Archive").map((q) => ({
      kind: "devis",
      id: q.id,
      title: `Devis ${q.quoteNumber || ""}`.trim(),
      subtitle: "Supprimé par vous",
      archivedAt: q.archivedAt,
      raw: q
    }));
    const factures = allInvoices.filter((i) => i.archived).map((i) => ({
      kind: "facture",
      id: i.id,
      title: `Facture ${i.invoiceNumber}${i.status === "Annulee" ? " (annulée)" : ""}`,
      subtitle: "Supprimé par vous",
      archivedAt: i.archivedAt,
      raw: i
    }));
    return [...devis, ...factures, ...chantiers, ...contacts, ...avenants]
      .sort((a, b) => String(b.archivedAt || "").localeCompare(String(a.archivedAt || "")));
  }, [allContacts, allAvenants, allProjects, allQuotes, allInvoices]);

  const filtered = useMemo(() => {
    let list = tab === "tous" ? items : items.filter((item) => item.kind === tab);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((item) => item.title.toLowerCase().includes(q));
    return list;
  }, [items, tab, search]);

  async function restore(item) {
    setError("");
    try {
      if (item.kind === "contact") {
        const { contact } = await apiSend("/api/contacts", { id: item.id, action: "restore" }, "PATCH");
        setAllContacts(allContacts.map((c) => (c.id === contact.id ? contact : c)));
      } else if (item.kind === "avenant") {
        const { avenant } = await apiSend("/api/avenants", { id: item.id, action: "restore" }, "PATCH");
        setAllAvenants(allAvenants.map((a) => (a.id === avenant.id ? avenant : a)));
      } else if (item.kind === "chantier") {
        const { project } = await apiSend("/api/projects", { id: item.id, action: "restore" }, "PATCH");
        setAllProjects(allProjects.map((p) => (p.id === project.id ? project : p)));
      } else if (item.kind === "devis") {
        const { quote } = await apiSend("/api/quotes", { id: item.id, action: "restore" }, "PATCH");
        setAllQuotes(allQuotes.map((q) => (q.id === quote.id ? quote : q)));
      } else if (item.kind === "facture") {
        const { invoice } = await apiSend("/api/invoices", { id: item.id, action: "restore" }, "PATCH");
        setAllInvoices(allInvoices.map((i) => (i.id === invoice.id ? invoice : i)));
      }
    } catch (err) {
      setError(err.message || "Restauration impossible.");
    }
  }

  async function permanentlyDelete(item) {
    if (item.kind === "contact") {
      const { contact } = await apiSend("/api/contacts", { id: item.id, action: "delete" }, "PATCH");
      if (contact?.deleted) setAllContacts((current) => current.filter((c) => c.id !== item.id));
    } else if (item.kind === "avenant") {
      await apiSend("/api/avenants", { id: item.id, action: "purge" }, "PATCH");
      setAllAvenants((current) => current.filter((a) => a.id !== item.id));
    } else if (item.kind === "chantier") {
      await apiSend("/api/projects", { id: item.id, action: "delete" }, "PATCH");
      setAllProjects((current) => current.filter((p) => p.id !== item.id));
    } else if (item.kind === "devis") {
      await apiSend("/api/quotes", { id: item.id, action: "delete" }, "PATCH");
      setAllQuotes((current) => current.filter((q) => q.id !== item.id));
    } else if (item.kind === "facture") {
      await apiSend("/api/invoices", { id: item.id, action: "purge" }, "PATCH");
      setAllInvoices((current) => current.filter((i) => i.id !== item.id));
    }
  }

  async function confirmDelete() {
    if (confirmText.trim().toUpperCase() !== "SUPPRIMER") return;
    setBusy(true);
    setError("");
    try {
      if (confirmTarget.bulk) {
        for (const item of filtered) {
          await permanentlyDelete(item); // eslint-disable-line no-await-in-loop
        }
      } else {
        await permanentlyDelete(confirmTarget.item);
      }
      setConfirmTarget(null);
      setConfirmText("");
    } catch (err) {
      setError(err.message || "Suppression impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <section className="fournitures-dashboard">
        <header className="fournitures-dashboard-head">
          <div>
            <h1><span className="title-chip">Corbeille</span></h1>
            <p>Les éléments supprimés sont gardés 30 jours avant suppression définitive.</p>
          </div>
          <div className="fournitures-dashboard-head-actions">
            <button
              type="button"
              className="button secondary"
              disabled={items.length === 0}
              onClick={() => setConfirmTarget({ bulk: true })}
            >
              Vider la corbeille
            </button>
          </div>
        </header>

        <div className="fournitures-main-card">
          <div className="fournitures-main-card-head">
            <input
              className="fournitures-search-input"
              style={{ flex: "1 1 auto", minWidth: 200, height: 42, borderRadius: 12, border: "1px solid var(--line)", padding: "0 14px" }}
              placeholder="Rechercher dans la corbeille…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="fournitures-filter-tabs">
              {FILTER_TABS.map((t) => (
                <button type="button" key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {error ? <p className="auth-error">{error}</p> : null}

          {filtered.length === 0 ? (
            <div className="tool-empty">
              <strong>Corbeille vide</strong>
              <span>Les éléments supprimés depuis Devis, Factures, Chantiers, Contacts et Avenants apparaîtront ici.</span>
            </div>
          ) : (
            <div className="fournitures-table">
              <div className="fournitures-table-row fournitures-table-head-row">
                <div>ÉLÉMENT</div>
                <div>TYPE</div>
                <div>SUPPRIMÉ LE</div>
                <div>SUPPRESSION DANS</div>
                <div></div>
              </div>
              {filtered.map((item) => {
                const meta = TYPE_META[item.kind];
                const left = daysLeft(item.archivedAt);
                return (
                  <div className="fournitures-table-row-wrap" key={`${item.kind}-${item.id}`}>
                    <div className="fournitures-table-row">
                      <div className="fournitures-table-cell" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span className="fournitures-kpi-icon fournitures-kpi-icon-blue">{meta.icon}</span>
                        <div>
                          <strong>{item.title}</strong>
                          <small>{item.subtitle}</small>
                        </div>
                      </div>
                      <div>
                        <span className="status-pill" style={{ color: "#6B7280", background: "#F0F1F5" }}>{meta.label}</span>
                      </div>
                      <div className="fournitures-table-cell">{daysAgoLabel(item.archivedAt)}</div>
                      <div className="fournitures-table-cell">
                        <span style={{ color: left <= 5 ? "#C4452D" : "#B7791F", fontWeight: 600 }}>{left} jour{left > 1 ? "s" : ""}</span>
                      </div>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button type="button" className="mini-button" onClick={() => restore(item)}>Restaurer</button>
                        <button type="button" className="mini-danger" onClick={() => { setConfirmTarget({ item }); setConfirmText(""); }} aria-label="Supprimer définitivement">🗑</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {confirmTarget ? (
        <div className="modal-overlay open" onClick={() => !busy && setConfirmTarget(null)}>
          <div className="mini-modal" onClick={(event) => event.stopPropagation()}>
            <h2 style={{ color: "#C4452D" }}>Supprimer définitivement ?</h2>
            <p className="muted">Cette action est irréversible : {confirmTarget.bulk ? "les éléments et leurs pièces jointes seront effacés." : "l'élément et ses pièces jointes seront effacés."}</p>

            {!confirmTarget.bulk ? (
              <div className="divers-purchase-row" style={{ background: "#FBE9E5" }}>
                <div className="divers-purchase-main">
                  <strong>{confirmTarget.item.title}</strong>
                  <small>Supprimée le {daysAgoLabel(confirmTarget.item.archivedAt)}</small>
                </div>
              </div>
            ) : (
              <p className="muted">{filtered.length} élément{filtered.length > 1 ? "s" : ""} actuellement affiché{filtered.length > 1 ? "s" : ""} seront supprimés.</p>
            )}

            <label style={{ display: "block", marginTop: 10 }}>
              <small className="ct-profil-field-hint" style={{ textTransform: "uppercase", fontWeight: 700 }}>Pour confirmer, tapez SUPPRIMER</small>
              <input
                className="profile-textarea"
                style={{ height: 46, minHeight: "unset" }}
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoFocus
              />
            </label>

            {error ? <p className="profile-message error">{error}</p> : null}

            <div>
              <button type="button" onClick={() => setConfirmTarget(null)} disabled={busy}>Annuler</button>
              <button
                type="button"
                className="mini-danger"
                disabled={busy || confirmText.trim().toUpperCase() !== "SUPPRIMER"}
                onClick={confirmDelete}
              >
                {busy ? "Suppression…" : "Supprimer définitivement"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Shell>
  );
}
