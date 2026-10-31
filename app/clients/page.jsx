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
        <div className="head">
          <div className="stack">
            <button type="button" className="link" onClick={closeForm}>← Retour</button>
            <span className="eyebrow">{editingId ? "Modifier" : "Ajouter"}</span>
            <h1>{editingId ? "Modifier le client" : "Nouveau client"}</h1>
          </div>
        </div>

        {error ? <p className="notice notice-err" role="alert">{error}</p> : null}

        <section className="card">
          <form onSubmit={submitClient}>
            <div className="fgrid">
              <label className="full">
                <span className="flab">Type</span>
                <div className="kp-seg">
                  <button type="button" className={!isSociete ? "on" : ""} aria-pressed={!isSociete} onClick={() => setField("type", "particulier")}>Particulier</button>
                  <button type="button" className={isSociete ? "on" : ""} aria-pressed={isSociete} onClick={() => setField("type", "societe")}>Société</button>
                </div>
              </label>

              {isSociete ? (
                <>
                  <label className="full">
                    <span>Raison sociale</span>
                    <input value={form.companyName} onChange={(event) => setField("companyName", event.target.value)} required />
                  </label>
                  <label className="full">
                    <span>SIRET</span>
                    <input value={form.siret} onChange={(event) => setField("siret", event.target.value)} placeholder="123 456 789 00012" />
                  </label>
                  <label className="full">
                    <span>Contact</span>
                    <input value={form.contactPerson} onChange={(event) => setField("contactPerson", event.target.value)} />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    <span>Prénom</span>
                    <input value={form.firstName} onChange={(event) => setField("firstName", event.target.value)} />
                  </label>
                  <label>
                    <span>Nom</span>
                    <input value={form.lastName} onChange={(event) => setField("lastName", event.target.value)} required />
                  </label>
                </>
              )}

              <label>
                <span>Téléphone</span>
                <input value={form.phone} onChange={(event) => setField("phone", event.target.value)} placeholder="06 12 34 56 78" />
              </label>
              <label>
                <span>Email</span>
                <input type="email" value={form.email} onChange={(event) => setField("email", event.target.value)} />
              </label>

              <fieldset className="full" style={{ border: "none", margin: 0, padding: 0 }}>
                <legend className="flab">Adresse</legend>
                <div className="legacy" style={{ display: "contents" }}>
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
              </fieldset>

              <label className="full">
                <span>Notes</span>
                <textarea value={form.notes} onChange={(event) => setField("notes", event.target.value)} rows="3" />
              </label>
            </div>

            {editingId ? (
              <details style={{ marginTop: 24 }}>
                <summary style={{ cursor: "pointer", fontSize: 14, fontWeight: 500, padding: "8px 0", userSelect: "none" }}>Accès au suivi de chantier</summary>
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                  {portalIdentifier ? (
                    <label>
                      <span>Identifiant</span>
                      <input value={portalIdentifier} readOnly onFocus={(event) => event.target.select()} />
                    </label>
                  ) : null}
                  {revealedPassword ? (
                    <label>
                      <span>Mot de passe</span>
                      <input value={revealedPassword} readOnly onFocus={(event) => event.target.select()} />
                    </label>
                  ) : portalIdentifier ? (
                    <p className="muted" style={{ marginBottom: 12 }}>Mot de passe déjà transmis — régénérez-en un nouveau si besoin.</p>
                  ) : (
                    <p className="muted" style={{ marginBottom: 12 }}>Aucun accès créé pour l'instant.</p>
                  )}
                  <label>
                    <span>Lien de connexion</span>
                    <input value={loginUrl} readOnly onFocus={(event) => event.target.select()} />
                  </label>
                  <div style={{ marginTop: 12 }}>
                    <button type="button" className="btn btn-sec" disabled={busy} onClick={regenerateCredentials}>
                      {portalIdentifier ? "Régénérer le mot de passe" : "Créer l'accès"}
                    </button>
                  </div>
                </div>
              </details>
            ) : null}

            <div className="ed-act" style={{ marginTop: 24 }}>
              <button type="submit" className="btn btn-main" disabled={busy}>Enregistrer</button>
            </div>
          </form>
        </section>

        {editingId ? (
          <section className="card" style={{ borderColor: "var(--err, #e63946)", backgroundColor: "rgba(230, 57, 70, 0.04)" }}>
            <div className="ed-act">
              <button type="button" className="btn" style={{ color: "var(--err, #e63946)" }} onClick={deleteClient}>Supprimer</button>
            </div>
          </section>
        ) : null}
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="head">
        <div className="stack">
          <button type="button" className="link" onClick={() => (window.history.length > 1 ? window.history.back() : window.location.assign("/"))}>← Retour</button>
          <span className="eyebrow">Équipe & Accès</span>
          <h1>Clients</h1>
          <span className="muted">Gérez les accès de vos clients au suivi de chantier.</span>
        </div>
      </div>

      {message ? <p className="notice" style={{ backgroundColor: "var(--suc, rgba(76, 175, 80, 0.1))", borderColor: "var(--suc, #4cb050)", color: "var(--text)" }} role="status">{message}</p> : null}

      <div className="search search-wide" style={{ marginBottom: 16 }}>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un client…" />
      </div>

      <button type="button" className="btn btn-sec" onClick={copyLoginLink} style={{ marginBottom: 16 }}>
        {linkCopied ? "Lien copié !" : "Copier le lien de connexion client"}
      </button>

      {filteredClients.length === 0 ? (
        <div className="empty">
          <strong>Aucun client</strong>
          <span>Ajoutez votre premier client pour générer son accès de suivi.</span>
        </div>
      ) : (
        <div className="mlist">
          {filteredClients.map((client) => (
            <article
              className="m-card clickable"
              key={client.id}
              role="button"
              tabIndex={0}
              onClick={() => openEdit(client)}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openEdit(client); } }}
            >
              <div className="top2">
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: "var(--accent)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 500, flexShrink: 0 }}>
                    {initials(client)}
                  </div>
                  <div className="nm">
                    <strong>{contactDisplayName(client)}</strong>
                    <div className="meta">
                      {[client.phone, client.email].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                </div>
                <span className="tag" style={{ fontSize: 12, padding: "4px 8px", backgroundColor: client.linkedUserId ? "var(--accent)" : "var(--border)" }}>
                  {client.linkedUserId ? "Accès créé" : "Pas d'accès"}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}

      <button type="button" className="koji-fab" onClick={openCreate} aria-label="Nouveau client">
        <span style={{ fontSize: 20 }}>+</span>
      </button>
    </Shell>
  );
}
