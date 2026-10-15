"use client";

import { useEffect, useMemo, useState } from "react";
import { AddressFields } from "../../components/AddressFields";
import { Shell } from "../../components/Shell";
import { apiGet, apiSend } from "../../lib/client-api";
import { contactDisplayName } from "../../lib/contacts";
import { useLocale } from "../../lib/i18n";
import { euro, shortDate } from "../../lib/pricing";
import { useApi } from "../../lib/use-api";

const initialContact = {
  type: "particulier",
  firstName: "",
  lastName: "",
  companyName: "",
  siret: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  postalCode: "",
  floor: "",
  accessCode: "",
  complement: "",
  accessInstructions: "",
  notes: "",
  roles: [],
  linkedUserId: ""
};

const emptyHistory = { quotes: [], chantiers: [], invoices: [], interventions: [] };

function CardChevron({ collapsed }) {
  return (
    <svg className="card-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function initials(contact) {
  const name = contactDisplayName(contact) || "??";
  return name.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export default function ContactsPage() {
  const { L } = useLocale();
  const [showArchived, setShowArchived] = useState(false);
  const { data: contacts, setData: setContacts } = useApi(showArchived ? "/api/contacts?includeArchived=1" : "/api/contacts", "contacts");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(initialContact);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [similar, setSimilar] = useState([]);
  const [history, setHistory] = useState(emptyHistory);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // "client" n'est plus un role selectionnable ici — les clients ont leur
  // propre page dediee (/clients, 12 oct, demande d'Amira), avec generation
  // d'acces au portail particulier directement integree.
  const FILTER_ROLES = [
    { id: "", label: L.contacts.roleAll },
    { id: "prospect", label: L.contacts.roleProspect },
    { id: "equipe", label: L.contacts.roleEquipe },
    { id: "sous_traitant", label: L.contacts.roleSousTraitant },
    { id: "architecte", label: L.contacts.roleArchitecte },
    { id: "fournisseur", label: L.contacts.roleFournisseur }
  ];

  const ALL_ROLES = [
    ...FILTER_ROLES.slice(1),
    { id: "donneur_ordre", label: L.contacts.roleDonneurOrdre },
    { id: "autre", label: L.contacts.roleAutre }
  ];

  const filteredContacts = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return contacts.filter((contact) => {
      // Les clients ont leur propre page (/clients, 12 oct, demande
      // d'Amira) — jamais affiches ici, meme s'ils ont aussi un autre role.
      // Filtre cote page (pas dans /api/contacts) : DevisEditor.jsx lit la
      // meme API sans ce filtre pour son selecteur de contact.
      if ((contact.roles || []).includes("client")) return false;
      if (roleFilter && !(contact.roles || []).includes(roleFilter)) return false;
      if (!needle) return true;
      const haystack = [contactDisplayName(contact), contact.companyName, contact.phone, contact.email, contact.address, contact.city, contact.postalCode].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(needle);
    }).sort((a, b) => contactDisplayName(a).localeCompare(contactDisplayName(b), "fr"));
  }, [contacts, search, roleFilter]);

  useEffect(() => {
    if (!editingId) {
      setHistory(emptyHistory);
      return;
    }
    let alive = true;
    apiGet(`/api/contacts/${editingId}/history`).then((payload) => {
      if (alive) setHistory({ quotes: payload.quotes || [], chantiers: payload.chantiers || [], invoices: payload.invoices || [], interventions: payload.interventions || [] });
    }).catch(() => {});
    return () => { alive = false; };
  }, [editingId]);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleRole(roleId) {
    setForm((current) => {
      const roles = current.roles || [];
      return { ...current, roles: roles.includes(roleId) ? roles.filter((r) => r !== roleId) : [...roles, roleId] };
    });
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setSimilar([]);
    setConfirmDelete(false);
    setHistoryOpen(true);
  }

  function openCreate() {
    setForm(initialContact);
    setEditingId(null);
    setSimilar([]);
    setFormOpen(true);
  }

  function openEdit(contact) {
    setForm({ ...initialContact, ...contact });
    setEditingId(contact.id);
    setSimilar([]);
    setConfirmDelete(false);
    setFormOpen(true);
  }

  async function submitContact(event) {
    event.preventDefault();
    if (editingId) {
      const { contact } = await apiSend("/api/contacts", { id: editingId, ...form }, "PATCH");
      setContacts(contacts.map((item) => (item.id === contact.id ? contact : item)));
      setMessage(`${contactDisplayName(contact)} ${L.common.update.toLowerCase()}`);
      closeForm();
    } else {
      const { contact, similar: similarContacts } = await apiSend("/api/contacts", form);
      if (similarContacts?.length) {
        setSimilar(similarContacts);
        openEdit(contact);
        setMessage("");
        return;
      }
      setContacts([contact, ...contacts]);
      setMessage(`${contactDisplayName(contact)} ${L.common.create.toLowerCase()}`);
      closeForm();
    }
  }

  async function archiveContact() {
    if (!editingId) return;
    const { contact } = await apiSend("/api/contacts", { id: editingId, action: "archive" }, "PATCH");
    setContacts(contacts.filter((item) => item.id !== contact.id));
    closeForm();
  }

  async function restoreContact() {
    if (!editingId) return;
    const { contact } = await apiSend("/api/contacts", { id: editingId, action: "restore" }, "PATCH");
    setContacts(contacts.map((item) => (item.id === contact.id ? contact : item)));
    setForm((current) => ({ ...current, archived: false }));
  }

  async function deleteContact() {
    if (!editingId) return;
    try {
      const { contact } = await apiSend("/api/contacts", { id: editingId, action: "delete" }, "PATCH");
      if (contact?.deleted) {
        setContacts(contacts.filter((item) => item.id !== editingId));
        closeForm();
      }
    } catch (error) {
      setMessage(error.message || L.contacts.cannotDelete);
      setConfirmDelete(false);
    }
  }

  const totalHistoryCount = history.quotes.length + history.chantiers.length + history.invoices.length + history.interventions.length;

  // Tableau de bord (15 oct) — compteurs reels, pas de chiffres inventes :
  // actifs = tous les contacts hors clients (deja exclus de `contacts`),
  // repartis par role deja existant sur chaque fiche.
  const activeContacts = useMemo(() => contacts.filter((c) => !(c.roles || []).includes("client")), [contacts]);
  const dashboardStats = useMemo(() => {
    const now = new Date();
    const nouveauxCeMois = activeContacts.filter((c) => {
      const d = new Date(c.createdAt || "");
      return !Number.isNaN(d.getTime()) && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
    const hasRole = (role) => (c) => (c.roles || []).includes(role);
    return {
      total: activeContacts.length,
      nouveauxCeMois,
      prospects: activeContacts.filter(hasRole("prospect")).length,
      equipe: activeContacts.filter((c) => hasRole("equipe")(c) || hasRole("sous_traitant")(c)).length,
      fournisseurs: activeContacts.filter(hasRole("fournisseur")).length
    };
  }, [activeContacts]);

  const recentContacts = useMemo(
    () => [...activeContacts].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))).slice(0, 6),
    [activeContacts]
  );

  const ROLE_LABELS = { client: L.contacts.roleClient, prospect: L.contacts.roleProspect, equipe: L.contacts.roleEquipe, sous_traitant: L.contacts.roleSousTraitant, architecte: L.contacts.roleArchitecte, fournisseur: L.contacts.roleFournisseur, donneur_ordre: L.contacts.roleDonneurOrdre, autre: L.contacts.roleAutre };

  if (formOpen) {
    const isSociete = form.type === "societe";
    return (
      <Shell>
        <section className="mobile-tool tool-form-view">
          <header className="tool-topline">
            <button type="button" className="plain-back" onClick={closeForm}>{"<"}</button>
            <h1>{editingId ? L.contacts.editContact : L.contacts.newContact}</h1>
            <span />
          </header>

          {similar.length ? (
            <div className="tool-message">
              <strong>{L.contacts.similarWarning}</strong>
              <p>{similar.map((s) => L.contacts.similarWarningHint(contactDisplayName(s))).join(" ")}</p>
            </div>
          ) : null}

          {form.archived ? (
            <div className="tool-message">{L.contacts.archived}</div>
          ) : null}

          <form className="mobile-form" onSubmit={submitContact}>
            <label className="mobile-input full">
              <span>{L.contacts.typeLabel}</span>
              <div className="segmented large">
                <button type="button" className={!isSociete ? "active" : ""} onClick={() => setField("type", "particulier")}>{L.contacts.typeParticulier}</button>
                <button type="button" className={isSociete ? "active" : ""} onClick={() => setField("type", "societe")}>{L.contacts.typeSociete}</button>
              </div>
            </label>

            {isSociete ? (
              <>
                <label className="mobile-input full">
                  <span>{L.contacts.companyName}</span>
                  <input value={form.companyName} onChange={(event) => setField("companyName", event.target.value)} required />
                </label>
                <label className="mobile-input full">
                  <span>{L.contacts.siret}</span>
                  <input value={form.siret} onChange={(event) => setField("siret", event.target.value)} placeholder="123 456 789 00012" />
                </label>
                <label className="mobile-input full">
                  <span>{L.contacts.contactPerson}</span>
                  <input value={form.contactPerson} onChange={(event) => setField("contactPerson", event.target.value)} />
                </label>
              </>
            ) : (
              <>
                <label className="mobile-input full">
                  <span>{L.contacts.firstName}</span>
                  <input value={form.firstName} onChange={(event) => setField("firstName", event.target.value)} />
                </label>
                <label className="mobile-input full">
                  <span>{L.contacts.lastName}</span>
                  <input value={form.lastName} onChange={(event) => setField("lastName", event.target.value)} required />
                </label>
              </>
            )}

            <label className="mobile-input full">
              <span>{L.contacts.phone}</span>
              <input value={form.phone} onChange={(event) => setField("phone", event.target.value)} placeholder="06 12 34 56 78" />
            </label>
            <label className="mobile-input full">
              <span>{L.contacts.email}</span>
              <input type="email" value={form.email} onChange={(event) => setField("email", event.target.value)} />
            </label>
            <div className="mobile-input full">
              <AddressFields
                value={{
                  address: form.address,
                  city: form.city,
                  postalCode: form.postalCode,
                  floor: form.floor,
                  accessCode: form.accessCode,
                  complement: form.complement,
                  accessInstructions: form.accessInstructions
                }}
                onChange={(next) => setForm((current) => ({ ...current, ...next }))}
              />
            </div>
            <label className="mobile-input full">
              <span>{L.contacts.notes}</span>
              <input value={form.notes} onChange={(event) => setField("notes", event.target.value)} />
            </label>

            <div className="mobile-input full">
              <span>{L.contacts.rolesLabel}</span>
              <div className="contact-role-checks">
                {ALL_ROLES.map((role) => (
                  <label key={role.id} className="recap-check-label">
                    <input type="checkbox" checked={(form.roles || []).includes(role.id)} onChange={() => toggleRole(role.id)} />
                    {role.label}
                  </label>
                ))}
              </div>
            </div>

            <button className="mobile-primary">{L.contacts.save}</button>
          </form>

          {editingId ? (
            <section className="follow-section">
              <button type="button" className="follow-section-head follow-section-head-toggle" onClick={() => setHistoryOpen((current) => !current)}>
                <h2>{L.contacts.historyTitle}</h2>
                <span>{totalHistoryCount || null}</span>
                <CardChevron collapsed={!historyOpen} />
              </button>
              {historyOpen ? (
                <div className="contact-history-lists">
                  {totalHistoryCount === 0 ? <p className="tool-muted">{L.contacts.noHistory}</p> : null}
                  {history.quotes.length ? (
                    <div className="contact-history-group">
                      <small>{L.contacts.historyQuotes}</small>
                      {history.quotes.map((quote) => (
                        <a key={quote.id} className="contact-history-row" href={`/devis?id=${quote.id}`}>
                          <span>{quote.quoteNumber}</span>
                          <span className="contact-history-status">{quote.status}</span>
                          <strong>{euro(quote.totalTtc)}</strong>
                        </a>
                      ))}
                    </div>
                  ) : null}
                  {history.chantiers.length ? (
                    <div className="contact-history-group">
                      <small>{L.contacts.historyChantiers}</small>
                      {history.chantiers.map((chantier) => (
                        <a key={chantier.id} className="contact-history-row" href={`/chantiers?project=${chantier.id}`}>
                          <span>{chantier.title}</span>
                          <span className="contact-history-status">{chantier.status}{chantier.roleOnSite ? ` · ${chantier.roleOnSite}` : ""}</span>
                          <strong>{euro(chantier.budgetHt)}</strong>
                        </a>
                      ))}
                    </div>
                  ) : null}
                  {history.invoices.length ? (
                    <div className="contact-history-group">
                      <small>{L.contacts.historyInvoices}</small>
                      {history.invoices.map((invoice) => (
                        <a key={invoice.id} className="contact-history-row" href="/facturation">
                          <span>{invoice.invoiceNumber}</span>
                          <span className="contact-history-status">{invoice.status}</span>
                          <strong>{euro(invoice.amountTtc)}</strong>
                        </a>
                      ))}
                    </div>
                  ) : null}
                  {history.interventions.length ? (
                    <div className="contact-history-group">
                      <small>{L.contacts.historyInterventions}</small>
                      {history.interventions.map((intervention) => (
                        <a key={intervention.id} className="contact-history-row" href="/interventions">
                          <span>{shortDate(intervention.date)}</span>
                          <span className="contact-history-status">{intervention.status}</span>
                          <strong>{intervention.site || ""}</strong>
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}

          {editingId ? (
            <div className="quote-action-row">
              {form.archived ? (
                <button type="button" className="button secondary" onClick={restoreContact}>{L.contacts.restoreContact}</button>
              ) : (
                <button type="button" className="button secondary" onClick={archiveContact}>{L.contacts.archiveContact}</button>
              )}
              {confirmDelete ? (
                <>
                  <button type="button" className="button danger" onClick={deleteContact}>{L.common.confirm}</button>
                  <button type="button" className="button" onClick={() => setConfirmDelete(false)}>{L.common.cancel}</button>
                </>
              ) : (
                <button type="button" className="button danger" onClick={() => setConfirmDelete(true)}>{L.contacts.deleteContact}</button>
              )}
            </div>
          ) : null}
        </section>
      </Shell>
    );
  }

  return (
    <Shell>
      <section className="fournitures-dashboard">
        <header className="fournitures-dashboard-head">
          <div>
            <h1><span className="title-chip">{L.contacts.title}</span></h1>
            <p>Vos prospects, votre équipe et vos partenaires, au même endroit.</p>
          </div>
          <div className="fournitures-dashboard-head-actions">
            <a href="/clients" className="button secondary">👤 Clients</a>
            <a href="/equipe" className="button secondary">👷 Équipe</a>
            <button type="button" className="button blue" onClick={openCreate}>+ Nouveau contact</button>
          </div>
        </header>

        <div className="fournitures-kpi-row">
          <div className="fournitures-kpi-card">
            <div className="fournitures-kpi-card-head">
              <span className="fournitures-kpi-icon fournitures-kpi-icon-blue">👤</span>
              <span className="title-chip">Contacts</span>
            </div>
            <strong>{dashboardStats.total}</strong>
            <small className={dashboardStats.nouveauxCeMois > 0 ? "positive" : ""}>
              {dashboardStats.nouveauxCeMois > 0 ? `+${dashboardStats.nouveauxCeMois} ce mois-ci` : "actifs"}
            </small>
          </div>
          <div className="fournitures-kpi-card">
            <div className="fournitures-kpi-card-head">
              <span className="fournitures-kpi-icon fournitures-kpi-icon-amber">🎯</span>
              <span className="title-chip">Prospects</span>
            </div>
            <strong>{dashboardStats.prospects}</strong>
            <small>à convertir</small>
          </div>
          <div className="fournitures-kpi-card">
            <div className="fournitures-kpi-card-head">
              <span className="fournitures-kpi-icon fournitures-kpi-icon-green">👷</span>
              <span className="title-chip">Équipe &amp; sous-traitants</span>
            </div>
            <strong>{dashboardStats.equipe}</strong>
            <small>intervenants</small>
          </div>
          <div className="fournitures-kpi-card">
            <div className="fournitures-kpi-card-head">
              <span className="fournitures-kpi-icon fournitures-kpi-icon-purple">📦</span>
              <span className="title-chip">Fournisseurs</span>
            </div>
            <strong>{dashboardStats.fournisseurs}</strong>
            <small>référencés</small>
          </div>
        </div>

        <div className="fournitures-dashboard-body">
          <div className="fournitures-main-card">
            <div className="fournitures-main-card-head">
              <strong className="title-chip">Tous les contacts</strong>
              <div className="fournitures-filter-tabs">
                {FILTER_ROLES.map((role) => (
                  <button type="button" key={role.id || "all"} className={roleFilter === role.id ? "active" : ""} onClick={() => setRoleFilter(role.id)}>
                    {role.label}
                  </button>
                ))}
              </div>
            </div>

            <input
              className="supplier-search-input"
              style={{ marginBottom: 12 }}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={L.contacts.search}
            />

            {message ? <p className="tool-message">{message}</p> : null}

            {filteredContacts.length === 0 ? (
              <div className="tool-empty">
                <strong>{L.contacts.noContacts}</strong>
                <span>{L.contacts.noContactsSub}</span>
              </div>
            ) : (
              <div className="supplier-articles-list">
                {filteredContacts.map((contact) => (
                  <div className="divers-purchase-row" key={contact.id} onClick={() => openEdit(contact)}>
                    <span className="supplier-list-avatar">{initials(contact)}</span>
                    <div className="divers-purchase-main">
                      <strong>{contactDisplayName(contact)}{contact.archived ? ` (${L.contacts.archived})` : ""}</strong>
                      <small>{[contact.phone, contact.email].filter(Boolean).join(" · ")}</small>
                    </div>
                    <div className="divers-purchase-tags">
                      {(contact.roles || []).map((r) => <span className="divers-tag" key={r}>{ROLE_LABELS[r] || r}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <label className="recap-check-label" style={{ marginTop: 14 }}>
              <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
              {L.contacts.showArchived}
            </label>
          </div>

          <div className="fournitures-sidebar-card">
            <strong className="title-chip">Ajoutés récemment</strong>
            {recentContacts.length === 0 ? (
              <div className="tool-empty">Aucun contact pour le moment.</div>
            ) : (
              recentContacts.map((contact) => (
                <div className="divers-purchase-row" key={contact.id} onClick={() => openEdit(contact)}>
                  <span className="supplier-list-avatar">{initials(contact)}</span>
                  <div className="divers-purchase-main">
                    <strong>{contactDisplayName(contact)}</strong>
                    <small>{(contact.roles || []).map((r) => ROLE_LABELS[r] || r).join(", ")}</small>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </Shell>
  );
}
