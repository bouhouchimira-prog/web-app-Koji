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
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow">Gestion</span>
          <h1>Corbeille</h1>
          <span className="muted">Les éléments supprimés sont gardés 30 jours avant suppression définitive.</span>
        </div>
        <div className="hact">
          <button type="button" className="btn btn-sec" disabled={items.length === 0} onClick={() => setConfirmTarget({ bulk: true })}>
            Vider la corbeille
          </button>
        </div>
      </div>

      <div className="tbar">
        <label className="search search-wide">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4.5-4.5" /></svg>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher dans la corbeille…" />
        </label>
      </div>

      <div className="kp-seg" role="group" aria-label="Type d'élément" style={{ marginBottom: 16 }}>
        {FILTER_TABS.map((t) => (
          <button type="button" key={t.id} className={tab === t.id ? "on" : ""} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {error ? <p className="notice notice-err" role="alert">{error}</p> : null}

      {filtered.length === 0 ? (
        <div className="tbl">
          <div className="empty">
            <strong>Corbeille vide</strong>
            <span>Les éléments supprimés depuis Devis, Factures, Chantiers, Contacts et Avenants apparaîtront ici.</span>
          </div>
        </div>
      ) : (
        <>
          <div className="tbl fit has-cards">
            <table>
              <thead>
                <tr><th>Élément</th><th>Type</th><th>Supprimé le</th><th>Suppression dans</th><th /></tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const meta = TYPE_META[item.kind];
                  const left = daysLeft(item.archivedAt);
                  return (
                    <tr key={`${item.kind}-${item.id}`}>
                      <td>
                        <strong>{item.title}</strong>
                        <small className="muted" style={{ display: "block" }}>{item.subtitle}</small>
                      </td>
                      <td><span className="tag dim">{meta.label}</span></td>
                      <td>{daysAgoLabel(item.archivedAt)}</td>
                      <td><span className={left <= 5 ? "tag tag-o" : "tag"}>{left} jour{left > 1 ? "s" : ""}</span></td>
                      <td>
                        <div className="ed-act">
                          <button type="button" className="btn btn-sec" onClick={() => restore(item)}>Restaurer</button>
                          <button type="button" className="dx" aria-label="Supprimer définitivement" title="Supprimer définitivement" onClick={() => { setConfirmTarget({ item }); setConfirmText(""); }}>×</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mlist">
            {filtered.map((item) => {
              const meta = TYPE_META[item.kind];
              const left = daysLeft(item.archivedAt);
              return (
                <div className="m-card" key={`${item.kind}-${item.id}`}>
                  <div className="top2">
                    <div>
                      <div className="nm">{item.title}</div>
                      <div className="meta">{item.subtitle}</div>
                    </div>
                    <span className="tag dim">{meta.label}</span>
                  </div>
                  <div className="dvc-f">
                    <span className="meta">Supprimé {daysAgoLabel(item.archivedAt)}</span>
                    <b>{left} jour{left > 1 ? "s" : ""}</b>
                  </div>
                  <div className="ed-act">
                    <button type="button" className="btn btn-sec" onClick={() => restore(item)}>Restaurer</button>
                    <button type="button" className="dx" aria-label="Supprimer définitivement" onClick={() => { setConfirmTarget({ item }); setConfirmText(""); }}>×</button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {confirmTarget ? (
        <div className="pmodal-bg" onClick={() => !busy && setConfirmTarget(null)}>
          <form className="pmodal" role="dialog" aria-modal="true" aria-label="Supprimer définitivement" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); confirmDelete(); }}>
            <div className="card-h">
              <h2>Supprimer définitivement ?</h2>
              <button type="button" className="link" onClick={() => setConfirmTarget(null)} disabled={busy}>Fermer</button>
            </div>
            <p className="muted">Cette action est irréversible : {confirmTarget.bulk ? "les éléments et leurs pièces jointes seront effacés." : "l'élément et ses pièces jointes seront effacés."}</p>

            {!confirmTarget.bulk ? (
              <div className="kv"><span>{confirmTarget.item.title}</span><b>Supprimée {daysAgoLabel(confirmTarget.item.archivedAt)}</b></div>
            ) : (
              <p className="muted">{filtered.length} élément{filtered.length > 1 ? "s" : ""} actuellement affiché{filtered.length > 1 ? "s" : ""} seront supprimés.</p>
            )}

            <div className="fgrid" style={{ marginTop: 12 }}>
              <label className="full">
                Pour confirmer, tapez SUPPRIMER
                <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoFocus />
              </label>
            </div>

            {error ? <p className="notice notice-err" role="alert">{error}</p> : null}

            <div className="pm-act">
              <button type="button" className="btn btn-sec" onClick={() => setConfirmTarget(null)} disabled={busy}>Annuler</button>
              <button type="submit" className="btn btn-main" disabled={busy || confirmText.trim().toUpperCase() !== "SUPPRIMER"}>
                {busy ? "Suppression…" : "Supprimer définitivement"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </Shell>
  );
}
