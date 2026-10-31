"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AddressFields } from "../../components/AddressFields";
import { Shell } from "../../components/Shell";
import { apiGet, apiSend } from "../../lib/client-api";
import { contactDisplayName } from "../../lib/contacts";
import { useLocale } from "../../lib/i18n";
import { euro } from "../../lib/pricing";
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

// Onglets de la liste (maquette PRO-10 : Tous / À faire / Clients / Pros).
// Les clients restent sur /clients (12 oct, demande d'Amira) : les prospects
// prennent leur place, "Pros" regroupe tous les autres rôles, et le menu
// "Type" affine sur un rôle précis.
const GROUPS = [
  { id: "tous", label: "Tous", test: () => true },
  { id: "prospect", label: "Prospects", test: (roles) => roles.includes("prospect") },
  { id: "pros", label: "Pros", test: (roles) => roles.some((r) => r !== "prospect" && r !== "client") }
];

const ROLE_SINGULAR = {
  client: "Client",
  prospect: "Prospect",
  equipe: "Équipe",
  sous_traitant: "Sous-traitant",
  architecte: "Architecte",
  fournisseur: "Fournisseur",
  donneur_ordre: "Donneur d'ordre",
  autre: "Autre"
};

const QUOTE_STATUS_WORDS = { Brouillon: "brouillon", "Pret a envoyer": "prêt à envoyer", Envoye: "envoyé", Signe: "signé", Refuse: "refusé", Annule: "annulé", Archive: "archivé" };
const INVOICE_STATUS_WORDS = { Brouillon: "brouillon", Emise: "envoyée", Payee: "payée", Retard: "en retard", Annulee: "annulée" };

const HISTORY_FILTERS = [
  { id: "tout", label: "Tout" },
  { id: "devis", label: "Devis" },
  { id: "chantier", label: "Chantiers" },
  { id: "facture", label: "Factures" },
  { id: "intervention", label: "Interventions" }
];

const ICONS = {
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
  plus: "M12 5v14M5 12h14",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  pin: "M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11zM12 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4",
  edit: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
  alert: "M12 3l9 16H3zM12 10v4M12 17v.5",
  archive: "M3 4h18v4H3zM5 8v12h14V8M10 12h4"
};

function Icon({ name }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS[name]} /></svg>;
}

function initials(contact) {
  const name = contactDisplayName(contact) || "??";
  return name.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

// Forme de l'avatar selon le rôle, comme la maquette : rond plein pour un
// prospect, carré plein pour l'équipe et les sous-traitants, carré vide pour
// un fournisseur, rond vide pour les autres partenaires.
function avatarKind(roles) {
  if (roles.includes("fournisseur")) return "fo";
  if (roles.includes("sous_traitant") || roles.includes("equipe")) return "st";
  if (roles.includes("prospect") || roles.length === 0) return "";
  return "pr";
}

function shortDay(value) {
  if (!value) return "";
  const text = String(value);
  const date = new Date(text.length === 10 ? `${text}T00:00:00` : text);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(date);
}

function longDay(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function rolesText(contact) {
  return (contact.roles || []).map((r) => ROLE_SINGULAR[r] || r).join(", ");
}

function fullAddress(contact) {
  const town = [contact.postalCode, contact.city].filter(Boolean).join(" ");
  const street = String(contact.address || "").trim();
  if (!street) return town;
  return town && !street.includes(town) ? `${street}, ${town}` : street;
}

function accessText(contact) {
  return [contact.floor ? `étage ${contact.floor}` : "", contact.accessCode ? `code ${contact.accessCode}` : "", contact.complement].filter(Boolean).join(" · ");
}

function invoiceBucket(invoice) {
  if (invoice.status === "Emise" && invoice.dueDate && new Date(`${invoice.dueDate}T00:00:00`) < new Date(new Date().toDateString())) return "Retard";
  return invoice.status;
}

export default function ContactsPage() {
  const { L } = useLocale();
  const [showArchived, setShowArchived] = useState(false);
  const { data: contacts, setData: setContacts, loading } = useApi(showArchived ? "/api/contacts?includeArchived=1" : "/api/contacts", "contacts");
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("tous");
  const [roleFilter, setRoleFilter] = useState("");
  const [sortBy, setSortBy] = useState("nom");
  const [selectedId, setSelectedId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(initialContact);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [similar, setSimilar] = useState([]);
  const [history, setHistory] = useState(emptyHistory);
  const [historyFilter, setHistoryFilter] = useState("tout");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // "client" n'est plus un role selectionnable ici — les clients ont leur
  // propre page dediee (/clients, 12 oct, demande d'Amira), avec generation
  // d'acces au portail particulier directement integree.
  const ALL_ROLES = [
    { id: "prospect", label: L.contacts.roleProspect },
    { id: "equipe", label: L.contacts.roleEquipe },
    { id: "sous_traitant", label: L.contacts.roleSousTraitant },
    { id: "architecte", label: L.contacts.roleArchitecte },
    { id: "fournisseur", label: L.contacts.roleFournisseur },
    { id: "donneur_ordre", label: L.contacts.roleDonneurOrdre },
    { id: "autre", label: L.contacts.roleAutre }
  ];

  // Les clients ont leur propre page (/clients, 12 oct, demande d'Amira) —
  // jamais affiches ici, meme s'ils ont aussi un autre role. Filtre cote page
  // (pas dans /api/contacts) : DevisEditor.jsx lit la meme API sans ce filtre
  // pour son selecteur de contact.
  const activeContacts = useMemo(() => contacts.filter((c) => !(c.roles || []).includes("client")), [contacts]);

  const groupCounts = useMemo(
    () => Object.fromEntries(GROUPS.map((g) => [g.id, activeContacts.filter((c) => g.test(c.roles || [])).length])),
    [activeContacts]
  );

  const filteredContacts = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const test = GROUPS.find((g) => g.id === group)?.test || (() => true);
    return activeContacts.filter((contact) => {
      if (!test(contact.roles || [])) return false;
      if (roleFilter && !(contact.roles || []).includes(roleFilter)) return false;
      if (!needle) return true;
      const haystack = [contactDisplayName(contact), contact.companyName, contact.siret, contact.phone, contact.email, contact.address, contact.city, contact.postalCode].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(needle);
    }).sort((a, b) => (sortBy === "recent"
      ? String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
      : contactDisplayName(a).localeCompare(contactDisplayName(b), "fr")));
  }, [activeContacts, search, group, roleFilter, sortBy]);

  const selected = activeContacts.find((c) => c.id === selectedId) || null;

  // Sur ordinateur la fiche du premier contact s'ouvre d'office (la maquette
  // montre toujours une fiche) ; sur téléphone on reste sur la liste.
  useEffect(() => {
    if (selected || !filteredContacts.length) return;
    if (window.matchMedia("(min-width: 901px)").matches) setSelectedId(filteredContacts[0].id);
  }, [filteredContacts, selected]);

  useEffect(() => {
    setHistory(emptyHistory);
    setHistoryFilter("tout");
    setConfirmDelete(false);
    if (!selectedId) return;
    let alive = true;
    apiGet(`/api/contacts/${selectedId}/history`).then((payload) => {
      if (alive) setHistory({ quotes: payload.quotes || [], chantiers: payload.chantiers || [], invoices: payload.invoices || [], interventions: payload.interventions || [] });
    }).catch(() => {});
    return () => { alive = false; };
  }, [selectedId]);

  function selectContact(id) {
    setSelectedId(id);
    setMessage("");
  }

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
    setFormOpen(true);
  }

  async function submitContact(event) {
    event.preventDefault();
    if (editingId) {
      const { contact } = await apiSend("/api/contacts", { id: editingId, ...form }, "PATCH");
      setContacts(contacts.map((item) => (item.id === contact.id ? contact : item)));
      setMessage(`Fiche de ${contactDisplayName(contact)} enregistrée.`);
      closeForm();
    } else {
      const { contact, similar: similarContacts } = await apiSend("/api/contacts", form);
      setContacts([contact, ...contacts]);
      setSelectedId(contact.id);
      if (similarContacts?.length) {
        openEdit(contact);
        setSimilar(similarContacts);
        setMessage("");
        return;
      }
      setMessage(`${contactDisplayName(contact)} ajouté aux contacts.`);
      closeForm();
    }
  }

  async function archiveContact() {
    if (!selected) return;
    const { contact } = await apiSend("/api/contacts", { id: selected.id, action: "archive" }, "PATCH");
    if (showArchived) {
      setContacts(contacts.map((item) => (item.id === contact.id ? contact : item)));
    } else {
      setContacts(contacts.filter((item) => item.id !== contact.id));
      setSelectedId(null);
    }
  }

  async function restoreContact() {
    if (!selected) return;
    const { contact } = await apiSend("/api/contacts", { id: selected.id, action: "restore" }, "PATCH");
    setContacts(contacts.map((item) => (item.id === contact.id ? contact : item)));
  }

  async function deleteContact() {
    if (!selected) return;
    try {
      const { contact } = await apiSend("/api/contacts", { id: selected.id, action: "delete" }, "PATCH");
      if (contact?.deleted) {
        setContacts(contacts.filter((item) => item.id !== selected.id));
        setSelectedId(null);
      }
    } catch (error) {
      setMessage(error.message || L.contacts.cannotDelete);
      setConfirmDelete(false);
    }
  }

  const events = useMemo(() => {
    const rows = [
      ...history.quotes.map((quote) => ({
        id: `q-${quote.id}`, kind: "devis", label: "Devis", date: quote.createdAtIso || quote.createdAt, href: `/devis?id=${quote.id}`,
        text: [`Devis ${quote.quoteNumber || ""}`.trim(), QUOTE_STATUS_WORDS[quote.status] || quote.status, `${euro(quote.totalTtc)} TTC`].filter(Boolean).join(" · ")
      })),
      ...history.chantiers.map((chantier) => ({
        id: `c-${chantier.id}`, kind: "chantier", label: "Chantier", date: chantier.createdAt, href: `/chantiers?project=${chantier.id}`,
        text: [chantier.title, chantier.roleOnSite, chantier.status].filter(Boolean).join(" · ")
      })),
      ...history.invoices.map((invoice) => ({
        id: `f-${invoice.id}`, kind: "facture", label: "Facture", date: invoice.issuedAt || invoice.createdAt, href: "/facturation",
        text: [invoice.invoiceNumber, INVOICE_STATUS_WORDS[invoiceBucket(invoice)] || invoice.status, euro(invoice.amountTtc)].filter(Boolean).join(" · ")
      })),
      ...history.interventions.map((intervention) => ({
        id: `i-${intervention.id}`, kind: "intervention", label: "Intervention", date: intervention.date, href: "/interventions",
        text: [intervention.site || "Rapport d'intervention", intervention.status].filter(Boolean).join(" · ")
      }))
    ];
    return rows.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  }, [history]);

  const visibleEvents = historyFilter === "tout" ? events : events.filter((e) => e.kind === historyFilter);

  // Montants réels tirés de l'historique : devis signés, facturé (hors
  // brouillons et annulées), payé, et ce qui est échu sans paiement.
  const money = useMemo(() => {
    const sum = (items, pick) => items.reduce((total, item) => total + (Number(pick(item)) || 0), 0);
    const issued = history.invoices.filter((i) => !["Brouillon", "Annulee"].includes(i.status));
    const late = issued.filter((i) => invoiceBucket(i) === "Retard");
    return {
      signed: sum(history.quotes.filter((q) => q.status === "Signe"), (q) => q.totalTtc),
      invoiced: sum(issued, (i) => i.amountTtc),
      paid: sum(issued.filter((i) => i.status === "Payee"), (i) => i.amountTtc),
      late: sum(late, (i) => i.amountTtc),
      lateInvoices: late
    };
  }, [history]);

  const isSociete = form.type === "societe";

  return (
    <Shell variant="pro">
      <div className={`ct-grid${selected ? " has-sel" : ""}`}>
        <div className="ct-list">
          <div className="ct-lh">
            <div className="ct-top">
              <h1>{L.contacts.title}</h1>
              <button type="button" className="btn btn-main ct-add" onClick={openCreate}><Icon name="plus" />Ajouter</button>
            </div>
            <label className="ct-srch">
              <Icon name="search" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nom, téléphone, SIRET, ville" aria-label={L.contacts.search} />
            </label>
            <div className="kp-seg" role="group" aria-label="Type de contact">
              {GROUPS.map((g) => (
                <button type="button" key={g.id} className={group === g.id ? "on" : ""} aria-pressed={group === g.id} onClick={() => setGroup(g.id)}>
                  {g.label}<b>{groupCounts[g.id]}</b>
                </button>
              ))}
            </div>
          </div>
          <div className="ct-sub">
            <label>Trier :
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="nom">par nom</option>
                <option value="recent">ajouts récents</option>
              </select>
            </label>
            <label>Type :
              <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                <option value="">tous</option>
                {ALL_ROLES.map((role) => <option key={role.id} value={role.id}>{(ROLE_SINGULAR[role.id] || role.label).toLowerCase()}</option>)}
              </select>
            </label>
            <label className="chk">
              <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
              Archivés
            </label>
          </div>
          <div className="ct-items">
            {filteredContacts.length === 0 ? (
              <p className="empty">{loading ? "Chargement…" : activeContacts.length === 0 ? L.contacts.noContactsSub : "Aucun contact ne correspond."}</p>
            ) : filteredContacts.map((contact) => {
              const roles = contact.roles || [];
              return (
                <button type="button" key={contact.id} className={`ct-li2${contact.id === selectedId ? " on" : ""}`} onClick={() => selectContact(contact.id)} aria-current={contact.id === selectedId ? "true" : undefined}>
                  <span className={`ct-av ${avatarKind(roles)}`}>{initials(contact)}</span>
                  <span className="b">
                    <span className="l1">
                      <strong>{contactDisplayName(contact) || "Sans nom"}</strong>
                      <small>{shortDay(contact.createdAt)}</small>
                    </span>
                    <span className="l2">
                      <small>{[rolesText(contact) || "Sans rôle", contact.city].filter(Boolean).join(" · ")}</small>
                      {contact.archived ? <span className="ct-todo">archivé</span> : null}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="ct-foot">
            Voir aussi
            <Link href="/clients" className="link">Clients</Link>
            <Link href="/equipe" className="link">Équipe</Link>
          </p>
        </div>

        <section className="ct-f">
          {message ? <p className="notice" role="status">{message}</p> : null}
          {!selected ? (
            <div className="card">
              <p className="empty">{loading ? "Chargement…" : activeContacts.length ? "Choisissez un contact dans la liste." : L.contacts.noContactsSub}</p>
            </div>
          ) : (
            <>
              <button type="button" className="link ct-back" onClick={() => setSelectedId(null)}>← Contacts</button>
              <div className="ct-fh">
                <span className={`ct-av big ${avatarKind(selected.roles || [])}`}>{initials(selected)}</span>
                <div className="t">
                  <span className="eyebrow">
                    {[rolesText(selected) || "Sans rôle", selected.type === "societe" ? "société" : "particulier", selected.createdAt ? `depuis le ${longDay(selected.createdAt)}` : ""].filter(Boolean).join(" · ")}
                  </span>
                  <h2>{contactDisplayName(selected) || "Sans nom"}</h2>
                  <small>{[selected.phone, selected.email].filter(Boolean).join(" · ") || "Pas de téléphone ni d'e-mail"}</small>
                </div>
                <div className="ct-acts">
                  {selected.phone ? <a className="ct-ab" href={`tel:${selected.phone.replace(/\s+/g, "")}`}><Icon name="phone" />Appeler</a> : null}
                  {selected.email ? <a className="ct-ab" href={`mailto:${selected.email}`}><Icon name="mail" />E-mail</a> : null}
                  {fullAddress(selected) ? (
                    <a className="ct-ab" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress(selected))}`} target="_blank" rel="noopener noreferrer"><Icon name="pin" />Itinéraire</a>
                  ) : null}
                  <button type="button" className="ct-ab" onClick={() => openEdit(selected)}><Icon name="edit" />Modifier</button>
                </div>
              </div>

              {selected.archived ? (
                <div className="ct-next">
                  <span className="ic"><Icon name="archive" /></span>
                  <div>
                    <strong>{L.contacts.archived}</strong>
                    <small>Ce contact n'apparaît plus dans la liste des contacts.</small>
                  </div>
                  <button type="button" className="btn btn-main" onClick={restoreContact}>{L.contacts.restoreContact}</button>
                </div>
              ) : null}

              {money.lateInvoices.length ? (
                <div className="ct-next">
                  <span className="ic"><Icon name="alert" /></span>
                  <div>
                    <strong>
                      {money.lateInvoices.length > 1
                        ? `${money.lateInvoices.length} factures en retard · ${euro(money.late)}`
                        : `Facture ${money.lateInvoices[0].invoiceNumber} en retard · ${euro(money.late)}`}
                    </strong>
                    <small>{money.lateInvoices.length > 1 ? "Échues sans paiement enregistré." : `Échue le ${shortDay(money.lateInvoices[0].dueDate)}, aucun paiement enregistré.`}</small>
                  </div>
                  <Link href="/facturation" className="btn btn-main">Voir les factures</Link>
                </div>
              ) : null}

              {history.quotes.length || history.invoices.length ? (
                <div className="ct-strip">
                  <div><span>Signé TTC</span><b>{euro(money.signed)}</b></div>
                  <div><span>Facturé TTC</span><b>{euro(money.invoiced)}</b></div>
                  <div><span>Payé</span><b>{euro(money.paid)}</b></div>
                  <div className={money.late ? "ko" : ""}><span>En retard</span><b>{euro(money.late)}</b></div>
                </div>
              ) : null}

              <div className="ct-g3">
                <div className="card">
                  <div className="card-h"><h2>Adresse</h2></div>
                  {fullAddress(selected) ? (
                    <>
                      <div className="kv"><span>{L.contacts.address}</span><b>{fullAddress(selected)}</b></div>
                      {accessText(selected) ? <div className="kv"><span>Accès</span><b>{accessText(selected)}</b></div> : null}
                      {selected.accessInstructions ? <div className="kv"><span>Consignes</span><b>{selected.accessInstructions}</b></div> : null}
                    </>
                  ) : <p className="muted">Aucune adresse enregistrée.</p>}
                </div>
                <div className="card">
                  <div className="card-h"><h2>Personnes</h2></div>
                  {selected.type === "societe" && selected.contactPerson ? (
                    <div className="ct-pp">
                      <span className="ct-av sm">{initials({ firstName: selected.contactPerson })}</span>
                      <div><strong>{selected.contactPerson}</strong><small>{L.contacts.contactPerson.toLowerCase()}</small></div>
                    </div>
                  ) : null}
                  {selected.type !== "societe" ? (
                    <div className="ct-pp">
                      <span className={`ct-av sm ${avatarKind(selected.roles || [])}`}>{initials(selected)}</span>
                      <div><strong>{contactDisplayName(selected)}</strong><small>{rolesText(selected).toLowerCase() || "contact"}</small></div>
                    </div>
                  ) : null}
                  {selected.type === "societe" && !selected.contactPerson ? <p className="muted">Aucun interlocuteur renseigné.</p> : null}
                </div>
                <div className="card">
                  <div className="card-h"><h2>Infos</h2></div>
                  <div className="kv"><span>{L.contacts.typeLabel}</span><b>{selected.type === "societe" ? L.contacts.typeSociete : L.contacts.typeParticulier}</b></div>
                  {selected.siret ? <div className="kv"><span>{L.contacts.siret}</span><b>{selected.siret}</b></div> : null}
                  <div className="kv"><span>{L.contacts.rolesLabel}</span><b>{rolesText(selected) || "aucun"}</b></div>
                  {selected.notes ? <div className="kv"><span>{L.contacts.notes}</span><b>{selected.notes}</b></div> : null}
                </div>
              </div>

              <div className="card ct-tl">
                <div className="card-h">
                  <h2>{L.contacts.historyTitle}{events.length ? <span className="kcnt">{events.length}</span> : null}</h2>
                  {events.length ? (
                    <div className="ct-fl" role="group" aria-label="Filtrer l'historique">
                      {HISTORY_FILTERS.map((f) => (
                        <button type="button" key={f.id} className={historyFilter === f.id ? "on" : ""} aria-pressed={historyFilter === f.id} onClick={() => setHistoryFilter(f.id)}>{f.label}</button>
                      ))}
                    </div>
                  ) : null}
                </div>
                {events.length === 0 ? <p className="muted">{L.contacts.noHistory}</p> : null}
                {events.length && visibleEvents.length === 0 ? <p className="muted">Rien dans cette catégorie.</p> : null}
                {visibleEvents.map((event) => (
                  <Link key={event.id} href={event.href} className="ct-ev">
                    <span className="d">{shortDay(event.date) || "—"}</span>
                    <span className="s">{event.label}</span>
                    <span className="x">{event.text}</span>
                  </Link>
                ))}
              </div>

              <div className="ct-end">
                {selected.archived ? null : <button type="button" className="btn btn-sec" onClick={archiveContact}>{L.contacts.archiveContact}</button>}
                {confirmDelete ? (
                  <>
                    <span className="muted">Supprimer définitivement ce contact ?</span>
                    <button type="button" className="btn btn-sec" onClick={deleteContact}>{L.common.confirm}</button>
                    <button type="button" className="btn btn-sec" onClick={() => setConfirmDelete(false)}>{L.common.cancel}</button>
                  </>
                ) : (
                  <button type="button" className="btn btn-sec" onClick={() => setConfirmDelete(true)}>{L.contacts.deleteContact}</button>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {formOpen ? (
        <div className="pmodal-bg" onClick={closeForm}>
          <form className="pmodal" role="dialog" aria-modal="true" aria-label={editingId ? L.contacts.editContact : L.contacts.newContact} onClick={(event) => event.stopPropagation()} onSubmit={submitContact}>
            <div className="card-h">
              <h2>{editingId ? L.contacts.editContact : L.contacts.newContact}</h2>
              <button type="button" className="link" onClick={closeForm}>Fermer</button>
            </div>

            {similar.length ? (
              <p className="notice">
                <strong>{L.contacts.similarWarning}.</strong>{" "}
                {similar.map((s) => L.contacts.similarWarningHint(contactDisplayName(s))).join(" ")}
              </p>
            ) : null}

            <div className="fgrid">
              <div className="full">
                <span className="flab">{L.contacts.typeLabel}</span>
                <div className="kp-seg" role="group" aria-label={L.contacts.typeLabel}>
                  <button type="button" className={!isSociete ? "on" : ""} aria-pressed={!isSociete} onClick={() => setField("type", "particulier")}>{L.contacts.typeParticulier}</button>
                  <button type="button" className={isSociete ? "on" : ""} aria-pressed={isSociete} onClick={() => setField("type", "societe")}>{L.contacts.typeSociete}</button>
                </div>
              </div>

              {isSociete ? (
                <>
                  <label className="full">{L.contacts.companyName}
                    <input value={form.companyName} onChange={(event) => setField("companyName", event.target.value)} required />
                  </label>
                  <label>{L.contacts.siret}
                    <input value={form.siret} onChange={(event) => setField("siret", event.target.value)} placeholder="123 456 789 00012" />
                  </label>
                  <label>{L.contacts.contactPerson}
                    <input value={form.contactPerson} onChange={(event) => setField("contactPerson", event.target.value)} />
                  </label>
                </>
              ) : (
                <>
                  <label>{L.contacts.firstName}
                    <input value={form.firstName} onChange={(event) => setField("firstName", event.target.value)} />
                  </label>
                  <label>{L.contacts.lastName}
                    <input value={form.lastName} onChange={(event) => setField("lastName", event.target.value)} required />
                  </label>
                </>
              )}

              <label>{L.contacts.phone}
                <input value={form.phone} onChange={(event) => setField("phone", event.target.value)} placeholder="06 12 34 56 78" />
              </label>
              <label>{L.contacts.email}
                <input type="email" value={form.email} onChange={(event) => setField("email", event.target.value)} />
              </label>

              <div className="full">
                <div className="legacy addr">
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
              </div>

              <label className="full">{L.contacts.notes}
                <textarea rows={3} value={form.notes} onChange={(event) => setField("notes", event.target.value)} />
              </label>

              <div className="full">
                <span className="flab">{L.contacts.rolesLabel}</span>
                <div className="chips" role="group" aria-label={L.contacts.rolesLabel}>
                  {ALL_ROLES.map((role) => {
                    const on = (form.roles || []).includes(role.id);
                    return (
                      <button type="button" key={role.id} className={`chip chip-s${on ? " on" : ""}`} aria-pressed={on} onClick={() => toggleRole(role.id)}>{role.label}</button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pm-act">
              <button type="button" className="btn btn-sec" onClick={closeForm}>{L.common.cancel}</button>
              <button type="submit" className="btn btn-main">{L.contacts.save}</button>
            </div>
          </form>
        </div>
      ) : null}
    </Shell>
  );
}
