"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ClientTopbar } from "../../../../components/ClientTopbar";
import { euro, shortDate } from "../../../../lib/pricing";

const STEP_LABEL = { acompte: "Acompte", avancement: "Avancement", solde: "Solde" };
const PAIEMENT_STATUS_LABEL = { pending: "À payer", paid_platform: "Payé — en attente des photos de l'entreprise", released: "Débloqué" };

const STATUS_LABEL = {
  Publiee: "Publiée",
  "En attente": "En attente",
  Terminee: "Terminée",
  SansSuite: "Sans suite"
};

function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16v12H8l-4 4V4z" />
    </svg>
  );
}
function SendIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2L11 13" />
      <path d="M22 2L15 22l-4-9-9-4 20-7z" />
    </svg>
  );
}
function CardIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20M6 15h4" />
    </svg>
  );
}
function GlobeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 010 18 15 15 0 010-18z" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  );
}

export default function RadarOffreDetailPage() {
  const params = useParams();
  const [offre, setOffre] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [activeEntrepriseId, setActiveEntrepriseId] = useState(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [positioned, setPositioned] = useState([]);
  const [showRdvForm, setShowRdvForm] = useState(false);
  const [rdvDate, setRdvDate] = useState("");
  const [paiements, setPaiements] = useState([]);
  const [paying, setPaying] = useState("");
  const [validating, setValidating] = useState("");

  useEffect(() => {
    fetch(`/api/chantier-offres/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        setOffre(data.offre || null);
      })
      .catch(() => setError("Impossible de charger cette offre."))
      .finally(() => setLoading(false));

    fetch(`/api/marketplace/offres/${params.id}/messages`)
      .then((r) => r.json())
      .then((data) => setMessages(data.messages || []))
      .catch(() => {})
      .finally(() => setMessagesLoading(false));

    fetch(`/api/marketplace/offres/${params.id}/positionner`)
      .then((r) => r.json())
      .then((data) => setPositioned((data.positionnements || []).map((p) => p.entrepriseUserId)))
      .catch(() => {});

    fetch(`/api/marketplace/offres/${params.id}/paiement`)
      .then((r) => r.json())
      .then((data) => setPaiements(data.paiements || []))
      .catch(() => {});
  }, [params.id]);

  const conversations = useMemo(() => {
    const byEntreprise = new Map();
    for (const m of messages) {
      if (!byEntreprise.has(m.entrepriseUserId)) {
        byEntreprise.set(m.entrepriseUserId, { entrepriseUserId: m.entrepriseUserId, snapshot: m.entrepriseSnapshot, messages: [] });
      }
      const conv = byEntreprise.get(m.entrepriseUserId);
      conv.messages.push(m);
      if (m.entrepriseSnapshot) conv.snapshot = m.entrepriseSnapshot;
    }
    return Array.from(byEntreprise.values()).sort((a, b) => {
      const aLast = a.messages[a.messages.length - 1]?.createdAt || "";
      const bLast = b.messages[b.messages.length - 1]?.createdAt || "";
      return bLast.localeCompare(aLast);
    });
  }, [messages]);

  const activeConversation = conversations.find((c) => c.entrepriseUserId === activeEntrepriseId) || null;

  async function sendReply(event) {
    event.preventDefault();
    if (!draft.trim() || !activeEntrepriseId) return;
    setSending(true);
    try {
      const response = await fetch(`/api/marketplace/offres/${params.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: draft.trim(), entrepriseUserId: activeEntrepriseId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur lors de l'envoi.");
      setMessages((prev) => [...prev, data.message]);
      setDraft("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function proposeRdv(event) {
    event.preventDefault();
    if (!rdvDate || !activeEntrepriseId) return;
    setSending(true);
    try {
      const response = await fetch(`/api/marketplace/offres/${params.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "rdv_proposal", rdvDate: new Date(rdvDate).toISOString(), entrepriseUserId: activeEntrepriseId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur lors de l'envoi.");
      setMessages((prev) => [...prev, data.message]);
      setShowRdvForm(false);
      setRdvDate("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function respondRdv(proposalId, rdvStatus) {
    if (!activeEntrepriseId) return;
    setSending(true);
    try {
      const response = await fetch(`/api/marketplace/offres/${params.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "rdv_response", respondsToId: proposalId, rdvStatus, entrepriseUserId: activeEntrepriseId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur lors de l'envoi.");
      setMessages((prev) => [...prev, data.message]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  const hasResponse = (proposalId) => messages.some((m) => m.respondsToId === proposalId);

  async function grantPhotos() {
    if (!activeEntrepriseId) return;
    setSending(true);
    try {
      const response = await fetch(`/api/marketplace/offres/${params.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "photo_grant", entrepriseUserId: activeEntrepriseId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur lors de l'envoi.");
      setMessages((prev) => [...prev, data.message]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function payStep(paiementId) {
    setPaying(paiementId);
    setError("");
    try {
      const response = await fetch(`/api/marketplace/offres/${params.id}/paiement/${paiementId}/checkout`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur lors du paiement.");
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setPaying("");
    }
  }

  async function validateStep(paiementId) {
    setValidating(paiementId);
    setError("");
    try {
      const response = await fetch(`/api/marketplace/offres/${params.id}/paiement/${paiementId}/valider`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur lors de la validation.");
      setPaiements((prev) => prev.map((p) => (p.id === paiementId ? { ...p, status: "released", validatedAt: data.paiement.validatedAt } : p)));
    } catch (err) {
      setError(err.message);
    } finally {
      setValidating("");
    }
  }

  return (
    <main className="client-space">
      <ClientTopbar showBack backHref="/client/radar" />

      <div className="ct-welcome">
        <strong>Détail de l'offre</strong>
      </div>

      {loading ? <div className="client-empty">Chargement…</div> : null}
      {!loading && error ? <div className="client-empty">{error}</div> : null}

      {!loading && offre ? (
        <>
          <section className="ct-section radar-form-card">
            {offre.photos?.length > 0 ? (
              <div className="radar-photo-grid">
                {offre.photos.map((photo, index) => (
                  <div className="radar-photo-thumb" key={index}>
                    <img src={photo} alt={`Photo ${index + 1}`} />
                  </div>
                ))}
              </div>
            ) : null}

            <div className="radar-recap">
              <div className="radar-recap-row"><span>Statut</span><strong><span className="radar-status-badge">{STATUS_LABEL[offre.status] || offre.status}</span></strong></div>
              <div className="radar-recap-row"><span>Publiée le</span><strong>{shortDate(offre.createdAt)}</strong></div>
              <div className="radar-recap-row"><span>Description</span><strong>{offre.description || "—"}</strong></div>
              <div className="radar-recap-row"><span>Métier</span><strong>{offre.metier || "Non précisé"}</strong></div>
              <div className="radar-recap-row"><span>Adresse</span><strong>{offre.address || "—"}</strong></div>
              {offre.delaiEstimeJours ? <div className="radar-recap-row"><span>Délai estimé</span><strong>{offre.delaiEstimeJours} jour{offre.delaiEstimeJours > 1 ? "s" : ""}</strong></div> : null}
            </div>

            {offre.ouvrages?.length > 0 ? (
              <div className="radar-ouvrages-block">
                <span className="radar-field-label">Travaux prévus</span>
                <div className="radar-ouvrages-list">
                  {offre.ouvrages.map((lot) => (
                    <div className="radar-ouvrages-lot" key={lot.room}>
                      <strong>{lot.room}</strong>
                      <ul>
                        {lot.postes.map((poste, index) => <li key={index}>{poste}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <p className="radar-recap-note">
              Dès qu'une entreprise dont la zone couvre votre adresse se positionne, vous recevrez son devis ici.
            </p>
          </section>

          {!activeConversation ? (
            <section className="ct-section">
              <h2 className="ct-section-title">Entreprises qui vous ont contacté</h2>
              {messagesLoading ? <div className="client-empty">Chargement…</div> : null}
              {!messagesLoading && conversations.length === 0 ? (
                <div className="client-empty">Aucune entreprise ne vous a encore contacté pour ce chantier.</div>
              ) : null}
              <div className="radar-conv-list">
                {conversations.map((conv) => {
                  const last = conv.messages[conv.messages.length - 1];
                  return (
                    <button key={conv.entrepriseUserId} type="button" className="radar-conv-row" onClick={() => setActiveEntrepriseId(conv.entrepriseUserId)}>
                      <span className="radar-conv-avatar">{(conv.snapshot?.raisonSociale || "?").slice(0, 1).toUpperCase()}</span>
                      <span className="radar-conv-main">
                        <strong>{conv.snapshot?.raisonSociale || "Entreprise"}{positioned.includes(conv.entrepriseUserId) ? <span className="radar-status-badge" style={{ marginLeft: 8 }}>Positionnée</span> : null}</strong>
                        <small>{last?.message?.slice(0, 60) || ""}</small>
                      </span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : (
            <section className="ct-section">
              <button type="button" className="radar-conv-back" onClick={() => setActiveEntrepriseId(null)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="15 18 9 12 15 6" /></svg>
                Toutes les entreprises
              </button>

              <div className="radar-contact-card">
                <p className="radar-contact-title">{activeConversation.snapshot?.raisonSociale || "Entreprise"}</p>
                <div className="radar-entreprise-meta">
                  {activeConversation.snapshot?.address ? <span>{activeConversation.snapshot.address}</span> : null}
                  {activeConversation.snapshot?.website ? (
                    <a href={activeConversation.snapshot.website.startsWith("http") ? activeConversation.snapshot.website : `https://${activeConversation.snapshot.website}`} target="_blank" rel="noopener noreferrer">
                      <GlobeIcon />{activeConversation.snapshot.website}
                    </a>
                  ) : null}
                </div>
                {activeConversation.snapshot?.isPro ? (
                  <a
                    className="radar-contact-btn radar-contact-btn-primary"
                    style={{ marginTop: 10 }}
                    href={`/api/marketplace/offres/${params.id}/entreprise-card?entrepriseUserId=${activeConversation.entrepriseUserId}&preview=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="radar-contact-icon"><CardIcon /></span>
                    <span>
                      <strong>Carte de visite Koji</strong>
                      <small>Voir la carte de cette entreprise</small>
                    </span>
                  </a>
                ) : null}
              </div>

              {activeConversation.messages.some((m) => m.entrepriseUserId === activeEntrepriseId) && paiements.filter((p) => p.entrepriseUserId === activeEntrepriseId).length > 0 ? (
                <div className="radar-contact-card">
                  <p className="radar-contact-title">Paiement échelonné</p>
                  <div className="radar-paiement-list">
                    {paiements.filter((p) => p.entrepriseUserId === activeEntrepriseId).map((p) => (
                      <div key={p.id} className="radar-paiement-row">
                        <div>
                          <strong>{STEP_LABEL[p.step] || p.step}</strong>
                          <small>{euro(p.amountTtc)} · {PAIEMENT_STATUS_LABEL[p.status]}</small>
                        </div>
                        {p.status === "pending" ? (
                          <button type="button" className="button blue" onClick={() => payStep(p.id)} disabled={paying === p.id}>
                            {paying === p.id ? "Redirection…" : "Payer"}
                          </button>
                        ) : null}
                        {p.status === "paid_platform" && p.photos.length > 0 ? (
                          <button type="button" className="button blue" onClick={() => validateStep(p.id)} disabled={validating === p.id}>
                            {validating === p.id ? "Validation…" : "Valider cette étape"}
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="radar-chat-card">
                <div className="radar-chat-header">
                  <span className="radar-chat-header-icon"><ChatIcon /></span>
                  <div>
                    <strong>Discussion interne Koji</strong>
                    <small>Vos échanges restent sur Koji tant que le rendez-vous n'est pas confirmé.</small>
                  </div>
                </div>
                <div className="radar-chat-messages">
                  {activeConversation.messages.map((m) => (
                    <div key={m.id} className={`radar-chat-bubble ${m.senderType === "particulier" ? "entreprise" : "particulier"}`}>
                      <p>{m.message}</p>
                      {m.kind === "rdv_proposal" && m.senderType === "entreprise" && !hasResponse(m.id) ? (
                        <div className="radar-rdv-actions">
                          <button type="button" className="button blue" onClick={() => respondRdv(m.id, "accepted")} disabled={sending}>Accepter</button>
                          <button type="button" className="button secondary" onClick={() => respondRdv(m.id, "declined")} disabled={sending}>Refuser</button>
                        </div>
                      ) : null}
                      <small>{shortDate(m.createdAt)}</small>
                    </div>
                  ))}
                </div>

                {offre.photos?.length > 0 &&
                activeConversation.messages.some((m) => m.kind === "photo_request") &&
                !activeConversation.messages.some((m) => m.kind === "photo_grant") ? (
                  <button type="button" className="radar-rdv-toggle" onClick={grantPhotos} disabled={sending}>
                    <ChatIcon />
                    Débloquer mes photos pour {activeConversation.snapshot?.raisonSociale || "cette entreprise"}
                  </button>
                ) : null}

                {showRdvForm ? (
                  <form className="radar-rdv-form" onSubmit={proposeRdv}>
                    <input type="datetime-local" value={rdvDate} onChange={(e) => setRdvDate(e.target.value)} required />
                    <button type="submit" className="button blue" disabled={sending || !rdvDate}>Proposer</button>
                    <button type="button" className="button secondary" onClick={() => setShowRdvForm(false)}>Annuler</button>
                  </form>
                ) : (
                  <button type="button" className="radar-rdv-toggle" onClick={() => setShowRdvForm(true)}>
                    <CalendarIcon />
                    Proposer un rendez-vous
                  </button>
                )}

                <form className="radar-chat-form" onSubmit={sendReply}>
                  <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Écrire un message…" />
                  <button type="submit" className="radar-chat-send" disabled={sending || !draft.trim()} aria-label="Envoyer">
                    <SendIcon />
                  </button>
                </form>
              </div>
            </section>
          )}
        </>
      ) : null}
    </main>
  );
}
