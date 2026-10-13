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
      <section className="mobile-tool">
        <header className="tool-topline">
          <button type="button" className="plain-back" onClick={() => (window.history.length > 1 ? window.history.back() : window.location.assign("/"))}>{"<"}</button>
          <h1>{L.contacts.title}</h1>
          <span />
        </header>

        <a href="/clients" className="button secondary" style={{ display: "inline-block", width: "fit-content" }}>
          → Voir les Clients
        </a>

        <div className="search-pill">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={L.contacts.search} />
        </div>

        <div className="contact-role-pills">
          {FILTER_ROLES.map((role) => (
            <button type="button" key={role.id || "all"} className={roleFilter === role.id ? "active" : ""} onClick={() => setRoleFilter(role.id)}>
              {role.label}
            </button>
          ))}
        </div>

        {message ? <p className="tool-message">{message}</p> : null}

        <div className="people-list">
          {filteredContacts.length === 0 ? (
            <div className="tool-empty">
              <strong>{L.contacts.noContacts}</strong>
              <span>{L.contacts.noContactsSub}</span>
            </div>
          ) : null}
          {filteredContacts.map((contact) => (
            <article
              className="person-row clickable"
              key={contact.id}
              role="button"
              tabIndex={0}
              onClick={() => openEdit(contact)}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openEdit(contact); } }}
            >
              <div className="avatar">{initials(contact)}</div>
              <div>
                <strong>{contactDisplayName(contact)}{contact.archived ? ` (${L.contacts.archived})` : ""}</strong>
                <small>{(contact.roles || []).map((r) => ({ client: L.contacts.roleClient, prospect: L.contacts.roleProspect, equipe: L.contacts.roleEquipe, sous_traitant: L.contacts.roleSousTraitant, architecte: L.contacts.roleArchitecte, fournisseur: L.contacts.roleFournisseur, donneur_ordre: L.contacts.roleDonneurOrdre, autre: L.contacts.roleAutre }[r] || r)).join(", ")}</small>
                {contact.phone || contact.email ? <small>{[contact.phone, contact.email].filter(Boolean).join(" · ")}</small> : null}
              </div>
            </article>
          ))}
        </div>

        <label className="recap-check-label">
          <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
          {L.contacts.showArchived}
        </label>

        <button type="button" className="team-fab" onClick={openCreate} aria-label={L.contacts.newContact}>
          <span>+</span>
        </button>
      </section>
    </Shell>
  );
}
