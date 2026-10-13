"use client";

import { useMemo, useState } from "react";
import { AddressFields } from "../../components/AddressFields";
import { Shell } from "../../components/Shell";
import { apiSend } from "../../lib/client-api";
import { contactDisplayName } from "../../lib/contacts";
import { useApi } from "../../lib/use-api";

// Page dediee aux clients (12 oct, demande d'Amira) — jusque-la, les
// clients etaient un role parmi d'autres dans /contacts. Meme principe que
// /equipe (liste + fiche + section "Acces" generant des identifiants de
// connexion), mais pour le portail particulier existant (/client) plutot
// que le portail ouvrier. Design volontairement garde identique aux pages
// Contacts/Equipe "pour l'instant" (demande explicite d'Amira) — texte en
// dur en francais comme app/legal/page.jsx avant sa traduction, pas encore
// passe par lib/i18n.js pour eviter de dupliquer ~30 cles dans les 6 langues
// pour une toute premiere version.

const initialClient = {
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
  notes: ""
};

function initials(client) {
  const name = contactDisplayName(client) || "??";
  return name.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export default function ClientsPage() {
  const { data: clients, setData: setClients } = useApi("/api/contacts?role=client", "contacts");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(initialClient);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [accessOpen, setAccessOpen] = useState(false);
  const [revealedPassword, setRevealedPassword] = useState("");
  const [portalIdentifier, setPortalIdentifier] = useState("");
  const [busy, setBusy] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const filteredClients = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return clients.filter((client) => {
      if (!needle) return true;
      const haystack = [contactDisplayName(client), client.companyName, client.phone, client.email, client.city].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(needle);
    }).sort((a, b) => contactDisplayName(a).localeCompare(contactDisplayName(b), "fr"));
  }, [clients, search]);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setAccessOpen(false);
    setRevealedPassword("");
    setPortalIdentifier("");
    setError("");
  }

  function openCreate() {
    setForm(initialClient);
    setEditingId(null);
    setAccessOpen(false);
    setRevealedPassword("");
    setPortalIdentifier("");
    setError("");
    setFormOpen(true);
  }

  function openEdit(client) {
    setForm({ ...initialClient, ...client });
    setEditingId(client.id);
    setAccessOpen(Boolean(client.linkedUserId));
    setRevealedPassword("");
    setPortalIdentifier(client.portalIdentifier || "");
    setError("");
    setFormOpen(true);
  }

  async function createAccessFor(contactId) {
    try {
      const { contact: updated, access } = await apiSend("/api/contacts", { id: contactId, action: "createAccess" }, "PATCH");
      setClients((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setRevealedPassword(access.password);
      setPortalIdentifier(access.portalIdentifier);
      setAccessOpen(true);
      return updated;
    } catch (err) {
      setError(err.message || "Impossible de créer l'accès.");
      return null;
    }
  }

  async function submitClient(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (editingId) {
        const { contact } = await apiSend("/api/contacts", { id: editingId, ...form }, "PATCH");
        setClients(clients.map((item) => (item.id === contact.id ? contact : item)));
        setMessage(`${contactDisplayName(contact)} mis à jour`);
        closeForm();
      } else {
        const { contact } = await apiSend("/api/contacts", { ...form, roles: ["client"] });
        setClients([contact, ...clients]);
        if (contact.email || contact.phone) {
          await createAccessFor(contact.id);
          setMessage(`${contactDisplayName(contact)} ajouté — accès créé`);
          setEditingId(contact.id);
        } else {
          setMessage(`${contactDisplayName(contact)} ajouté — ajoutez un email ou un téléphone pour créer son accès`);
          closeForm();
        }
      }
    } catch (err) {
      setError(err.message || "Erreur.");
    } finally {
      setBusy(false);
    }
  }

  async function regenerateCredentials() {
    if (!editingId) return;
    setBusy(true);
    setError("");
    await createAccessFor(editingId);
    setBusy(false);
  }

  async function deleteClient() {
    if (!editingId) return;
    try {
      const { contact } = await apiSend("/api/contacts", { id: editingId, action: "delete" }, "PATCH");
      if (contact?.deleted) {
        setClients(clients.filter((item) => item.id !== editingId));
        closeForm();
      }
    } catch (err) {
      setError(err.message || "Ce client a des documents liés : archivez-le plutôt que de le supprimer.");
    }
  }

  const loginUrl = typeof window !== "undefined" ? `${window.location.origin}/login?type=particulier` : "/login?type=particulier";

  // Bouton rapide en haut de liste (12 oct, demande d'Amira) — meme lien que
  // dans la fiche d'un client, mais accessible sans ouvrir un profil precis,
  // pour l'envoyer rapidement a n'importe quel client.
  async function copyLoginLink() {
    try {
      await navigator.clipboard.writeText(loginUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      setError("Impossible de copier le lien — copiez-le manuellement : " + loginUrl);
    }
  }

  if (formOpen) {
    const isSociete = form.type === "societe";
    return (
      <Shell>
        <section className="mobile-tool tool-form-view">
          <header className="tool-topline">
            <button type="button" className="plain-back" onClick={closeForm}>{"<"}</button>
            <h1>{editingId ? "Modifier le client" : "Nouveau client"}</h1>
            <span />
          </header>

          {error ? <p className="tool-message">{error}</p> : null}

          <form className="mobile-form" onSubmit={submitClient}>
            <label className="mobile-input full">
              <span>Type</span>
              <div className="segmented large">
                <button type="button" className={!isSociete ? "active" : ""} onClick={() => setField("type", "particulier")}>Particulier</button>
                <button type="button" className={isSociete ? "active" : ""} onClick={() => setField("type", "societe")}>Société</button>
              </div>
            </label>

            {isSociete ? (
              <>
                <label className="mobile-input full">
                  <span>Raison sociale</span>
                  <input value={form.companyName} onChange={(event) => setField("companyName", event.target.value)} required />
                </label>
                <label className="mobile-input full">
                  <span>SIRET</span>
                  <input value={form.siret} onChange={(event) => setField("siret", event.target.value)} placeholder="123 456 789 00012" />
                </label>
                <label className="mobile-input full">
                  <span>Contact</span>
                  <input value={form.contactPerson} onChange={(event) => setField("contactPerson", event.target.value)} />
                </label>
              </>
            ) : (
              <>
                <label className="mobile-input full">
                  <span>Prénom</span>
                  <input value={form.firstName} onChange={(event) => setField("firstName", event.target.value)} />
                </label>
                <label className="mobile-input full">
                  <span>Nom</span>
                  <input value={form.lastName} onChange={(event) => setField("lastName", event.target.value)} required />
                </label>
              </>
            )}

            <label className="mobile-input full">
              <span>Téléphone</span>
              <input value={form.phone} onChange={(event) => setField("phone", event.target.value)} placeholder="06 12 34 56 78" />
            </label>
            <label className="mobile-input full">
              <span>Email</span>
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
              <span>Notes</span>
              <input value={form.notes} onChange={(event) => setField("notes", event.target.value)} />
            </label>

            {editingId ? (
              <section className="follow-section">
                <button type="button" className="follow-section-head follow-section-head-toggle" onClick={() => setAccessOpen((current) => !current)}>
                  <h2>Accès au suivi de chantier</h2>
                </button>
                {accessOpen ? (
                  <div className="mobile-form">
                    {portalIdentifier ? (
                      <label className="mobile-input full">
                        <span>Identifiant</span>
                        <input value={portalIdentifier} readOnly onFocus={(event) => event.target.select()} />
                      </label>
                    ) : null}
                    {revealedPassword ? (
                      <label className="mobile-input full">
                        <span>Mot de passe</span>
                        <input value={revealedPassword} readOnly onFocus={(event) => event.target.select()} />
                      </label>
                    ) : portalIdentifier ? (
                      <p className="tool-muted">Mot de passe déjà transmis — régénérez-en un nouveau si besoin.</p>
                    ) : (
                      <p className="tool-muted">Aucun accès créé pour l'instant.</p>
                    )}
                    <label className="mobile-input full">
                      <span>Lien de connexion</span>
                      <input value={loginUrl} readOnly onFocus={(event) => event.target.select()} />
                    </label>
                    <button type="button" className="mini-button" disabled={busy} onClick={regenerateCredentials}>
                      {portalIdentifier ? "Régénérer le mot de passe" : "Créer l'accès"}
                    </button>
                  </div>
                ) : null}
              </section>
            ) : null}

            <button className="mobile-primary" disabled={busy}>Enregistrer</button>
          </form>

          {editingId ? (
            <div className="quote-action-row">
              <button type="button" className="button danger" onClick={deleteClient}>Supprimer</button>
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
          <h1>Clients</h1>
          <span />
        </header>

        <div className="search-pill">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un client…" />
        </div>

        <button type="button" className="button secondary" onClick={copyLoginLink}>
          {linkCopied ? "Lien copié !" : "Copier le lien de connexion client"}
        </button>

        {message ? <p className="tool-message">{message}</p> : null}

        <div className="people-list">
          {filteredClients.length === 0 ? (
            <div className="tool-empty">
              <strong>Aucun client</strong>
              <span>Ajoutez votre premier client pour générer son accès de suivi.</span>
            </div>
          ) : null}
          {filteredClients.map((client) => (
            <article
              className="person-row clickable"
              key={client.id}
              role="button"
              tabIndex={0}
              onClick={() => openEdit(client)}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openEdit(client); } }}
            >
              <div className="avatar">{initials(client)}</div>
              <div>
                <strong>{contactDisplayName(client)}</strong>
                <small>{client.linkedUserId ? "Accès créé" : "Pas encore d'accès"}</small>
                {client.phone || client.email ? <small>{[client.phone, client.email].filter(Boolean).join(" · ")}</small> : null}
              </div>
            </article>
          ))}
        </div>

        <button type="button" className="team-fab" onClick={openCreate} aria-label="Nouveau client">
          <span>+</span>
        </button>
      </section>
    </Shell>
  );
}
