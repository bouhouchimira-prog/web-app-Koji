"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Shell } from "../../../components/Shell";
import { apiGet, apiSend } from "../../../lib/client-api";
import { euro, shortDate } from "../../../lib/pricing";

function PhotoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="11" r="2" />
      <path d="M21 15l-4.5-4.5L9 18" />
    </svg>
  );
}
function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16v12H8l-4 4V4z" />
    </svg>
  );
}
function ChatBubbleBigIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16v12H8l-4 4V4z" />
      <path d="M8 9h8M8 12.5h5" />
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
function SparkleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function FileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z" />
      <path d="M14 3v6h6M9 13h6M9 17h6" />
    </svg>
  );
}
function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s7-6.6 7-11.5A7 7 0 105 9.5C5 14.4 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
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

const STEP_LABEL = { acompte: "Acompte", avancement: "Avancement", solde: "Solde" };
const PAIEMENT_STATUS_LABEL = { pending: "En attente de paiement", paid_platform: "Payé — en attente de vos photos", released: "Débloqué" };

function descriptionToPoints(text) {
  if (!text) return [];
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function readAsDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

export default function MarketplaceOffreDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [offre, setOffre] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [positionState, setPositionState] = useState({ positionnee: false, plafondAtteint: false });
  const [positioning, setPositioning] = useState(false);
  const [positionError, setPositionError] = useState("");
  const [showRdvForm, setShowRdvForm] = useState(false);
  const [rdvDate, setRdvDate] = useState("");
  const [paiements, setPaiements] = useState([]);
  const [paiementUploading, setPaiementUploading] = useState("");
  const [photoRequesting, setPhotoRequesting] = useState(false);

  function reload() {
    apiGet(`/api/marketplace/offres/${params.id}`)
      .then((data) => setOffre(data.offre))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    apiGet(`/api/marketplace/offres/${params.id}/messages`)
      .then((data) => setMessages(data.messages || []))
      .catch(() => {})
      .finally(() => setMessagesLoading(false));
    apiGet(`/api/marketplace/offres/${params.id}/positionner`)
      .then((data) => setPositionState(data))
      .catch(() => {});
    apiGet(`/api/marketplace/offres/${params.id}/paiement`)
      .then((data) => setPaiements(data.paiements || []))
      .catch(() => {});
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  function creerDevis() {
    router.push(`/marketplace/${params.id}/proposition-devis`);
  }

  async function sePositionner() {
    setPositioning(true);
    setPositionError("");
    try {
      await apiSend(`/api/marketplace/offres/${params.id}/positionner`, {});
      setPositionState((s) => ({ ...s, positionnee: true }));
    } catch (err) {
      setPositionError(err.message);
    } finally {
      setPositioning(false);
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    try {
      const data = await apiSend(`/api/marketplace/offres/${params.id}/messages`, { message: draft.trim() });
      setMessages((prev) => [...prev, data.message]);
      setDraft("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function requestPhotos() {
    setPhotoRequesting(true);
    try {
      const data = await apiSend(`/api/marketplace/offres/${params.id}/messages`, { kind: "photo_request" });
      setMessages((prev) => [...prev, data.message]);
    } catch (err) {
      setError(err.message);
    } finally {
      setPhotoRequesting(false);
    }
  }

  async function proposeRdv(event) {
    event.preventDefault();
    if (!rdvDate) return;
    setSending(true);
    try {
      const data = await apiSend(`/api/marketplace/offres/${params.id}/messages`, {
        kind: "rdv_proposal",
        rdvDate: new Date(rdvDate).toISOString()
      });
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
    setSending(true);
    try {
      const data = await apiSend(`/api/marketplace/offres/${params.id}/messages`, {
        kind: "rdv_response",
        respondsToId: proposalId,
        rdvStatus
      });
      setMessages((prev) => [...prev, data.message]);
      if (rdvStatus === "accepted") reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  const hasResponse = (proposalId) => messages.some((m) => m.respondsToId === proposalId);

  async function uploadPaiementPhotos(paiementId, files) {
    if (!files.length) return;
    setPaiementUploading(paiementId);
    try {
      const photos = await Promise.all(Array.from(files).slice(0, 8).map(readAsDataUrl));
      await apiSend(`/api/marketplace/offres/${params.id}/paiement/${paiementId}`, { photos }, "PATCH");
      setPaiements((prev) => prev.map((p) => (p.id === paiementId ? { ...p, photos } : p)));
    } catch (err) {
      setError(err.message);
    } finally {
      setPaiementUploading("");
    }
  }

  return (
    <Shell>
      <section className="mobile-tool">
        <header className="tool-topline">
          <button type="button" className="plain-back" onClick={() => router.push("/marketplace")}>{"<"}</button>
          <h1>Détail du chantier</h1>
          <span />
        </header>

        {loading ? <div className="tool-empty">Chargement…</div> : null}
        {!loading && error && !offre ? <div className="tool-empty">{error}</div> : null}

        {!loading && offre ? (
          <>
            <button
              type="button"
              className="radar-contact-btn radar-contact-btn-primary"
              style={{ width: "100%", marginBottom: 14 }}
              onClick={creerDevis}
            >
              <span className="radar-contact-icon"><FileIcon /></span>
              <span>
                <strong>Créer mon devis via cette offre</strong>
                <small>Relisez et ajustez les lots avant de créer le devis</small>
              </span>
            </button>

            {offre.photosUnlocked && offre.photos.length > 0 ? (
              <div className="radar-photo-grid" style={{ marginBottom: 14 }}>
                {offre.photos.map((photo, index) => (
                  <div className="radar-photo-thumb radar-photo-thumb-lg" key={index}>
                    <img src={photo} alt={`Photo ${index + 1}`} />
                  </div>
                ))}
              </div>
            ) : offre.photosCount > 0 ? (
              <button type="button" className="radar-contact-btn" style={{ width: "100%", marginBottom: 14 }} onClick={requestPhotos} disabled={photoRequesting}>
                <span className="radar-contact-icon radar-contact-icon-alt"><PhotoIcon /></span>
                <span>
                  <strong>{photoRequesting ? "Demande envoyée…" : `Demander l'accès aux ${offre.photosCount} photo${offre.photosCount > 1 ? "s" : ""}`}</strong>
                  <small>Le client débloque l'accès depuis la discussion</small>
                </span>
              </button>
            ) : null}

            <div className="radar-recap radar-recap-card">
              <div className="radar-recap-row"><span>Métier</span><strong>{offre.metier || "Non précisé"}</strong></div>
              <div className="radar-recap-row"><span>Zone</span><strong>{offre.address || "Non précisé"}{!offre.rdvConfirmed ? " (secteur uniquement)" : ""}</strong></div>
              <div className="radar-recap-row"><span>Prix proposé</span><strong>{offre.priceRangeMin ? `${euro(offre.priceRangeMin)} – ${euro(offre.priceRangeMax)}` : "Non communiqué"}</strong></div>
              {offre.delaiEstimeJours ? <div className="radar-recap-row"><span>Délai estimé</span><strong>{offre.delaiEstimeJours} jour{offre.delaiEstimeJours > 1 ? "s" : ""}</strong></div> : null}
              <div className="radar-recap-row"><span>Publiée le</span><strong>{shortDate(offre.createdAt)}</strong></div>
            </div>

            <div className="radar-recap-card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span className="radar-field-label">Travaux prévus</span>
              {offre.ouvrages?.length > 0 ? (
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
              ) : (
                <div className="radar-ouvrages-lot">
                  <ul>
                    {descriptionToPoints(offre.description).map((point, index) => <li key={index}>{point}</li>)}
                  </ul>
                </div>
              )}
            </div>

            <div className="radar-contact-card">
              <p className="radar-contact-title">Positionnement</p>
              {positionState.positionnee ? (
                <p className="radar-recap-note" style={{ margin: 0 }}>Vous êtes positionnée sur ce chantier.</p>
              ) : (
                <>
                  <button type="button" className="radar-contact-btn radar-contact-btn-primary" style={{ width: "100%" }} onClick={sePositionner} disabled={positioning || positionState.plafondAtteint}>
                    <span className="radar-contact-icon"><PinIcon /></span>
                    <span>
                      <strong>{positioning ? "Positionnement…" : "Se positionner"}</strong>
                      <small>{positionState.plafondAtteint ? "Plafond de chantiers simultanés atteint" : "Premier arrivé, premier servi"}</small>
                    </span>
                  </button>
                  {positionError ? <p className="profile-message error" style={{ marginTop: 10 }}>{positionError}</p> : null}
                </>
              )}
            </div>

            <div className="radar-contact-card">
              <p className="radar-contact-title">Visite guidée</p>
              {positionState.positionnee ? (
                <Link href={`/marketplace/${params.id}/visite`} className="radar-contact-btn radar-contact-btn-primary" style={{ width: "100%" }}>
                  <span className="radar-contact-icon"><SparkleIcon /></span>
                  <span>
                    <strong>Démarrer la visite guidée</strong>
                    <small>Métré pièce par pièce, devis chiffré à votre taux horaire</small>
                  </span>
                </Link>
              ) : (
                <p className="radar-recap-note" style={{ margin: 0 }}>Positionnez-vous d'abord sur ce chantier pour démarrer la visite.</p>
              )}
            </div>

            {!offre.rdvConfirmed ? (
              <p className="radar-recap-note" style={{ margin: "0 0 14px" }}>Aucune coordonnée n'est visible tant que le rendez-vous n'est pas confirmé — tout passe par la discussion ci-dessous.</p>
            ) : null}

            {paiements.length > 0 ? (
              <div className="radar-contact-card">
                <p className="radar-contact-title">Paiement échelonné</p>
                <div className="radar-paiement-list">
                  {paiements.map((p) => (
                    <div key={p.id} className="radar-paiement-row">
                      <div>
                        <strong>{STEP_LABEL[p.step] || p.step}</strong>
                        <small>{euro(p.amountTtc)} · {PAIEMENT_STATUS_LABEL[p.status]}</small>
                      </div>
                      {p.status === "paid_platform" ? (
                        <label className="button secondary" style={{ cursor: "pointer" }}>
                          {paiementUploading === p.id ? "Envoi…" : p.photos.length ? "Changer les photos" : "Ajouter des photos"}
                          <input type="file" accept="image/*" multiple hidden onChange={(e) => uploadPaiementPhotos(p.id, e.target.files)} disabled={paiementUploading === p.id} />
                        </label>
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
                {messagesLoading ? <p className="radar-chat-empty">Chargement…</p> : null}
                {!messagesLoading && messages.length === 0 ? (
                  <div className="radar-chat-empty-state">
                    <ChatBubbleBigIcon />
                    <p>Aucun message pour l'instant.<br />Envoyez-en un pour engager la discussion.</p>
                  </div>
                ) : null}
                {messages.map((m) => (
                  <div key={m.id} className={`radar-chat-bubble ${m.senderType}`}>
                    <p>{m.message}</p>
                    {m.kind === "rdv_proposal" && m.senderType === "particulier" && !hasResponse(m.id) ? (
                      <div className="radar-rdv-actions">
                        <button type="button" className="button blue" onClick={() => respondRdv(m.id, "accepted")} disabled={sending}>Accepter</button>
                        <button type="button" className="button secondary" onClick={() => respondRdv(m.id, "declined")} disabled={sending}>Refuser</button>
                      </div>
                    ) : null}
                    <small>{shortDate(m.createdAt)}</small>
                  </div>
                ))}
              </div>

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

              <form className="radar-chat-form" onSubmit={sendMessage}>
                <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Écrire un message…" />
                <button type="submit" className="radar-chat-send" disabled={sending || !draft.trim()} aria-label="Envoyer">
                  <SendIcon />
                </button>
              </form>
            </div>
          </>
        ) : null}
      </section>
    </Shell>
  );
}
