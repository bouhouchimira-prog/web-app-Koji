"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Shell } from "../../../components/Shell";
import { apiGet, apiSend } from "../../../lib/client-api";
import { euro, shortDate } from "../../../lib/pricing";
import { estNouveau, publication, titreCourt, villeSeule } from "../../../lib/radar-display";

// Fiche d'un chantier du Radar, maquette PRO-04 (DA Koji Pro, 30 oct) :
// projet du client à gauche, positionnement et suite à droite, discussion
// sous le projet. Coordonnées du client masquées jusqu'au RDV confirmé.

const STEP_LABEL = { acompte: "Acompte", avancement: "Avancement", solde: "Solde" };
const PAIEMENT_STATUS_LABEL = { pending: "En attente de paiement", paid_platform: "Payé, en attente de vos photos", released: "Débloqué" };

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
  const messagesEndRef = useRef(null);

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

  useEffect(() => {
    const box = messagesEndRef.current?.parentElement;
    if (box) box.scrollTop = box.scrollHeight;
  }, [messages]);

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

  const title = offre ? titreCourt(offre.description) : "Chantier";

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow">
            <Link href="/marketplace" className="link">Radar des chantiers</Link>
            {" · "}{title}
          </span>
          <h1>{title}</h1>
          {offre ? (
            <span className="muted">{[villeSeule(offre.address), publication(offre.createdAt), offre.metier].filter(Boolean).join(" · ")}</span>
          ) : null}
        </div>
      </div>

      {loading ? <div className="tbl"><p className="empty">Chargement…</p></div> : null}
      {!loading && error && !offre ? <p className="notice" role="alert">{error}</p> : null}

      {!loading && offre ? (
        <div className="fiche-grid">
          <div className="fiche-main">
            <section className="card">
              <div className="card-h">
                <h2>Le projet du client</h2>
                {estNouveau(offre.createdAt) ? <span className="tag tag-e">Nouveau</span> : null}
              </div>
              <p className="rd-msg">« {offre.description} »</p>

              <div className="rd-sec">
                <span className="flab">Travaux prévus</span>
                {offre.ouvrages?.length > 0 ? offre.ouvrages.map((lot) => (
                  <div className="rd-lot" key={lot.room}>
                    <b>{lot.room}</b>
                    <ul className="rd-ul">{lot.postes.map((poste, index) => <li key={index}>{poste}</li>)}</ul>
                  </div>
                )) : (
                  <ul className="rd-ul">{descriptionToPoints(offre.description).map((point, index) => <li key={index}>{point}</li>)}</ul>
                )}
              </div>

              {offre.photosUnlocked && offre.photos?.length > 0 ? (
                <div className="rd-ph">
                  {offre.photos.map((photo, index) => <img key={index} src={photo} alt={`Photo ${index + 1} du chantier`} />)}
                </div>
              ) : offre.photosCount > 0 ? (
                <div className="rd-photo-ask">
                  <span className="muted">{offre.photosCount} photo{offre.photosCount > 1 ? "s" : ""} jointe{offre.photosCount > 1 ? "s" : ""} par le client, visibles quand il vous en donne l'accès.</span>
                  <button type="button" className="btn btn-sec" onClick={requestPhotos} disabled={photoRequesting}>
                    {photoRequesting ? "Demande envoyée…" : "Demander l'accès aux photos"}
                  </button>
                </div>
              ) : null}

              <div className="rd-facts">
                <div className="kv"><span>Métier</span><b>{offre.metier || "Non précisé"}</b></div>
                <div className="kv"><span>Zone</span><b>{offre.address || "Non précisée"}{!offre.rdvConfirmed ? " (secteur seulement)" : ""}</b></div>
                <div className="kv"><span>Prix</span><b>à proposer selon votre taux journalier</b></div>
                {offre.delaiEstimeJours ? <div className="kv"><span>Délai estimé</span><b>{offre.delaiEstimeJours} jour{offre.delaiEstimeJours > 1 ? "s" : ""}</b></div> : null}
                <div className="kv"><span>Publié le</span><b>{shortDate(offre.createdAt)}</b></div>
              </div>
            </section>

            <section className="card rd-chat">
              <div className="card-h">
                <h2>Discussion avec le client</h2>
                <span className="muted">reste sur Koji jusqu'au rendez-vous</span>
              </div>
              <div className="msgs" aria-live="polite">
                {messagesLoading ? <p className="muted">Chargement…</p> : null}
                {!messagesLoading && messages.length === 0 ? <p className="muted">Aucun message pour l'instant. Écrivez au client pour engager la discussion.</p> : null}
                {messages.map((m) => (
                  <div key={m.id} className={`msg ${m.senderType === "particulier" ? "k" : "u"}`}>
                    {m.message}
                    {m.kind === "rdv_proposal" && m.senderType === "particulier" && !hasResponse(m.id) ? (
                      <span className="rd-rdv-act">
                        <button type="button" className="btn btn-sec" onClick={() => respondRdv(m.id, "accepted")} disabled={sending}>Accepter</button>
                        <button type="button" className="btn btn-sec" onClick={() => respondRdv(m.id, "declined")} disabled={sending}>Refuser</button>
                      </span>
                    ) : null}
                    <small>{shortDate(m.createdAt)}</small>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {showRdvForm ? (
                <form className="pform rd-rdv" onSubmit={proposeRdv}>
                  <input type="datetime-local" value={rdvDate} onChange={(e) => setRdvDate(e.target.value)} required aria-label="Date du rendez-vous" />
                  <button type="submit" className="btn btn-sec" disabled={sending || !rdvDate}>Proposer</button>
                  <button type="button" className="btn btn-sec" onClick={() => setShowRdvForm(false)}>Annuler</button>
                </form>
              ) : (
                <div className="rd-rdv">
                  <button type="button" className="link" onClick={() => setShowRdvForm(true)}>+ Proposer un rendez-vous</button>
                </div>
              )}

              <form className="composer" onSubmit={sendMessage}>
                <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Écrire au client…" aria-label="Message au client" />
                <button type="submit" className="send" disabled={sending || !draft.trim()} aria-label="Envoyer">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 16-2-7z" /></svg>
                </button>
              </form>
              {error && offre ? <p className="err" role="alert">{error}</p> : null}
            </section>
          </div>

          <aside className="fiche-side">
            <section className="card">
              <div className="card-h">
                <h2>Se positionner</h2>
                {positionState.positionnee ? <span className="tag tag-b">Position prise</span> : null}
              </div>
              {positionState.positionnee ? (
                <>
                  <p className="muted">Votre position est prise sur ce chantier. Le client voit votre profil et peut vous proposer un rendez-vous.</p>
                  <Link href={`/marketplace/${params.id}/visite`} className="btn btn-main rd-go">Démarrer la visite guidée</Link>
                  <p className="pu">Métré pièce par pièce, devis chiffré à votre taux horaire.</p>
                </>
              ) : (
                <>
                  <p className="muted">{positionState.plafondAtteint ? "Vous avez atteint le plafond de chantiers simultanés. Retirez-vous d'un chantier pour vous positionner ici." : "Premier arrivé, premier servi : le client choisit ensuite avec qui prendre rendez-vous."}</p>
                  <button type="button" className="btn btn-main rd-go" onClick={sePositionner} disabled={positioning || positionState.plafondAtteint}>
                    {positioning ? "Positionnement…" : "Me positionner"}
                  </button>
                  {positionError ? <p className="err" role="alert">{positionError}</p> : null}
                </>
              )}
            </section>

            <section className="card">
              <div className="card-h"><h2>Préparer le devis</h2></div>
              <p className="muted">Reprenez les lots du client, ajustez-les, puis créez le devis.</p>
              <div><button type="button" className="btn btn-sec" onClick={() => router.push(`/marketplace/${params.id}/proposition-devis`)}>Créer mon devis via cette offre</button></div>
            </section>

            {paiements.length > 0 ? (
              <section className="card">
                <div className="card-h"><h2>Paiement échelonné</h2></div>
                {paiements.map((p) => (
                  <div className="row" key={p.id}>
                    <div className="t">
                      <strong>{STEP_LABEL[p.step] || p.step}</strong>
                      <small>{euro(p.amountTtc)} · {PAIEMENT_STATUS_LABEL[p.status] || p.status}</small>
                    </div>
                    {p.status === "paid_platform" ? (
                      <label className="btn btn-sec rd-upload">
                        {paiementUploading === p.id ? "Envoi…" : p.photos?.length ? "Changer les photos" : "Ajouter des photos"}
                        <input type="file" accept="image/*" multiple hidden onChange={(e) => uploadPaiementPhotos(p.id, e.target.files)} disabled={paiementUploading === p.id} />
                      </label>
                    ) : null}
                  </div>
                ))}
              </section>
            ) : null}

            {!offre.rdvConfirmed ? (
              <section className="card">
                <div className="card-h"><h2>Confidentialité</h2></div>
                <p className="muted">Adresse exacte, nom et téléphone du client visibles après la confirmation d'un rendez-vous. D'ici là, tout passe par la discussion.</p>
              </section>
            ) : null}
          </aside>
        </div>
      ) : null}
    </Shell>
  );
}
