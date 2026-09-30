"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ClientTopbar } from "../../../../components/ClientTopbar";
import { euro } from "../../../../lib/pricing";
import "../../client-home.css";
import { ChevronRight, Svg, metierVisuel, publieLe, titreCourt, villeDe } from "../../demandes-ui";

// Détail d'une demande côté particulier (refonte UX, septembre 2026).
// Même logique et mêmes routes qu'avant, seul l'affichage change :
// GET /api/chantier-offres/[id], GET et POST .../messages,
// GET .../positionner, GET .../paiement, POST .../paiement/[id]/checkout
// et .../valider, lien .../entreprise-card.
// Nouveau : les artisans positionnés qui n'ont pas encore écrit apparaissent
// aussi dans la liste (la route ne permet pas encore au client d'ouvrir la
// conversation le premier, voir les notes pour Amira).

const STEP_LABEL = { acompte: "Acompte", avancement: "Avancement", solde: "Solde" };
const PAIEMENT_STATUS_LABEL = { pending: "À payer", paid_platform: "Payé, en attente des photos de l'artisan", released: "Débloqué" };

const IconSend = () => <Svg size={18}><path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4 20-7z" /></Svg>;
const IconCalendar = () => <Svg size={18}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></Svg>;
const IconImage = () => <Svg size={18}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 17l-5-5-9 8" /></Svg>;
const IconCard = () => <Svg size={18}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20M6 15h4" /></Svg>;
const IconBack = () => <Svg size={16}><polyline points="15 18 9 12 15 6" /></Svg>;
const IconLock = () => <Svg size={15}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></Svg>;

function dateHeure(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function heureMessage(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const memeJour = d.toDateString() === new Date().toDateString();
  return memeJour
    ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function initiale(nom) {
  return String(nom || "?").trim().charAt(0).toUpperCase() || "?";
}

function villeEntreprise(snapshot) {
  const parties = String(snapshot?.address || "").split(",").map((p) => p.trim()).filter(Boolean);
  return (parties[parties.length - 1] || "").replace(/\b\d{5}\b/, "").trim();
}

// Où en est l'échange avec un artisan : ce qui s'affiche sous son nom
function suiviArtisan(fil) {
  if (!fil.length) return { texte: "Intéressé par votre chantier. Il va vous écrire.", ton: "attente" };
  const propositions = fil.filter((m) => m.kind === "rdv_proposal" && m.rdvDate);
  const proposition = propositions[propositions.length - 1];
  const reponse = proposition ? fil.find((m) => m.kind === "rdv_response" && m.respondsToId === proposition.id) : null;
  const dernier = fil[fil.length - 1];
  if (proposition && !reponse && proposition.senderType === "entreprise") return { texte: `Propose une visite · ${dateHeure(proposition.rdvDate)}`, ton: "action" };
  if (dernier.senderType === "entreprise" && (dernier.kind || "text") === "text") return { texte: "Vous a écrit", ton: "action" };
  if (proposition && reponse?.rdvStatus === "accepted") return { texte: `Visite confirmée · ${dateHeure(proposition.rdvDate)}`, ton: "ok" };
  if (proposition && !reponse) return { texte: `Visite proposée · ${dateHeure(proposition.rdvDate)}`, ton: "info" };
  return { texte: "En discussion", ton: "attente" };
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
  const [positionnements, setPositionnements] = useState([]);
  const [showRdvForm, setShowRdvForm] = useState(false);
  const [rdvDate, setRdvDate] = useState("");
  const [paiements, setPaiements] = useState([]);
  const [paying, setPaying] = useState("");
  const [validating, setValidating] = useState("");
  const [detailOuvert, setDetailOuvert] = useState(false);

  useEffect(() => {
    fetch(`/api/chantier-offres/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        setOffre(data.offre || null);
      })
      .catch(() => setError("Impossible de charger cette demande."))
      .finally(() => setLoading(false));

    fetch(`/api/marketplace/offres/${params.id}/messages`)
      .then((r) => r.json())
      .then((data) => setMessages(data.messages || []))
      .catch(() => {})
      .finally(() => setMessagesLoading(false));

    fetch(`/api/marketplace/offres/${params.id}/positionner`)
      .then((r) => r.json())
      .then((data) => setPositionnements(data.positionnements || []))
      .catch(() => {});

    fetch(`/api/marketplace/offres/${params.id}/paiement`)
      .then((r) => r.json())
      .then((data) => setPaiements(data.paiements || []))
      .catch(() => {});
  }, [params.id]);

  // Un artisan par ligne : ceux qui ont écrit, puis ceux qui se sont
  // seulement positionnés. Le plus récent en premier.
  const artisans = useMemo(() => {
    const parId = new Map();
    for (const p of positionnements) {
      parId.set(p.entrepriseUserId, { entrepriseUserId: p.entrepriseUserId, snapshot: p.entrepriseSnapshot, positionne: true, messages: [], depuis: p.createdAt || "" });
    }
    for (const m of messages) {
      if (!parId.has(m.entrepriseUserId)) {
        parId.set(m.entrepriseUserId, { entrepriseUserId: m.entrepriseUserId, snapshot: m.entrepriseSnapshot, positionne: false, messages: [], depuis: "" });
      }
      const a = parId.get(m.entrepriseUserId);
      a.messages.push(m);
      if (m.entrepriseSnapshot) a.snapshot = m.entrepriseSnapshot;
    }
    return Array.from(parId.values()).sort((a, b) => {
      if (Boolean(a.messages.length) !== Boolean(b.messages.length)) return a.messages.length ? -1 : 1;
      const aLast = a.messages[a.messages.length - 1]?.createdAt || a.depuis;
      const bLast = b.messages[b.messages.length - 1]?.createdAt || b.depuis;
      return String(bLast).localeCompare(String(aLast));
    });
  }, [messages, positionnements]);

  const actif = artisans.find((a) => a.entrepriseUserId === activeEntrepriseId && a.messages.length) || null;
  const paiementsActifs = actif ? paiements.filter((p) => p.entrepriseUserId === actif.entrepriseUserId) : [];

  async function envoyer(payload) {
    const response = await fetch(`/api/marketplace/offres/${params.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, entrepriseUserId: activeEntrepriseId })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Erreur lors de l'envoi.");
    setMessages((prev) => [...prev, data.message]);
  }

  async function sendReply(event) {
    event.preventDefault();
    if (!draft.trim() || !activeEntrepriseId) return;
    setSending(true);
    setError("");
    try {
      await envoyer({ message: draft.trim() });
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
    setError("");
    try {
      await envoyer({ kind: "rdv_proposal", rdvDate: new Date(rdvDate).toISOString() });
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
    setError("");
    try {
      await envoyer({ kind: "rdv_response", respondsToId: proposalId, rdvStatus });
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
    setError("");
    try {
      await envoyer({ kind: "photo_grant" });
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

  function ouvrir(artisan) {
    if (!artisan.messages.length) return;
    setActiveEntrepriseId(artisan.entrepriseUserId);
    setShowRdvForm(false);
    setDraft("");
    setError("");
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }

  // ---------- Conversation avec un artisan ----------
  if (!loading && offre && actif) {
    const nom = actif.snapshot?.raisonSociale || "Artisan";
    const photosDemandees = actif.messages.some((m) => m.kind === "photo_request") && !actif.messages.some((m) => m.kind === "photo_grant");
    return (
      <main className="client-space">
        <ClientTopbar showBack backHref="/client/radar" />
        <div className="kc">
          <button type="button" className="kc-back" onClick={() => setActiveEntrepriseId(null)}>
            <IconBack /> {titreCourt(offre.description)}
          </button>

          <section className="kc-artisan-head">
            <span className="kc-avatar kc-avatar-lg">{initiale(nom)}</span>
            <span className="kc-artisan-text">
              <strong>{nom}</strong>
              <small>{[offre.metier, villeEntreprise(actif.snapshot)].filter(Boolean).join(" · ")}</small>
            </span>
            {actif.snapshot?.isPro ? (
              <a
                className="kc-btn kc-btn-outline"
                href={`/api/marketplace/offres/${params.id}/entreprise-card?entrepriseUserId=${actif.entrepriseUserId}&preview=1`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <IconCard /> Carte de visite
              </a>
            ) : null}
          </section>

          {paiementsActifs.length > 0 ? (
            <section className="kc-block">
              <div className="kc-block-head"><h2 className="kc-block-title">Paiement par étapes</h2></div>
              <ul className="kc-pay-list">
                {paiementsActifs.map((p) => (
                  <li key={p.id} className="kc-pay">
                    <span>
                      <strong>{STEP_LABEL[p.step] || p.step} · {euro(p.amountTtc)}</strong>
                      <small>{PAIEMENT_STATUS_LABEL[p.status] || p.status}</small>
                    </span>
                    {p.status === "pending" ? (
                      <button type="button" className="kc-btn kc-btn-navy" onClick={() => payStep(p.id)} disabled={paying === p.id}>
                        {paying === p.id ? "Redirection…" : "Payer"}
                      </button>
                    ) : null}
                    {p.status === "paid_platform" && p.photos?.length > 0 ? (
                      <button type="button" className="kc-btn kc-btn-navy" onClick={() => validateStep(p.id)} disabled={validating === p.id}>
                        {validating === p.id ? "Validation…" : "Valider cette étape"}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="kc-chat">
            <p className="kc-chat-note"><IconLock /> Messagerie Koji : vos coordonnées ne sont pas partagées.</p>

            <div className="kc-chat-list">
              {actif.messages.map((m) => {
                const moi = m.senderType === "particulier";
                if (m.kind === "rdv_proposal") {
                  const aRepondre = !moi && !hasResponse(m.id);
                  return (
                    <div key={m.id} className={`kc-rdv${moi ? " is-mine" : ""}`}>
                      <span className="kc-rdv-icon"><IconCalendar /></span>
                      <span className="kc-rdv-text">
                        <small>{moi ? "Vous proposez une visite" : `${nom} propose une visite`}</small>
                        <strong>{dateHeure(m.rdvDate) || m.message}</strong>
                      </span>
                      {aRepondre ? (
                        <span className="kc-rdv-actions">
                          <button type="button" className="kc-btn kc-btn-navy" onClick={() => respondRdv(m.id, "accepted")} disabled={sending}>Accepter</button>
                          <button type="button" className="kc-btn kc-btn-outline" onClick={() => respondRdv(m.id, "declined")} disabled={sending}>Refuser</button>
                        </span>
                      ) : null}
                    </div>
                  );
                }
                if (m.kind === "rdv_response") {
                  return (
                    <p key={m.id} className={`kc-chat-event ${m.rdvStatus === "accepted" ? "is-ok" : "is-no"}`}>
                      {m.rdvStatus === "accepted" ? "✓ Visite confirmée" : "Visite refusée"}{moi ? " par vous" : ` par ${nom}`}
                    </p>
                  );
                }
                if (m.kind === "photo_request" || m.kind === "photo_grant") {
                  return (
                    <p key={m.id} className="kc-chat-event">
                      {m.kind === "photo_request" ? `${nom} demande à voir vos photos` : "Vous avez débloqué vos photos"}
                    </p>
                  );
                }
                return (
                  <div key={m.id} className={`kc-bubble${moi ? " is-mine" : ""}`}>
                    <p>{m.message}</p>
                    <small>{heureMessage(m.createdAt)}</small>
                  </div>
                );
              })}
            </div>

            {offre.photos?.length > 0 && photosDemandees ? (
              <button type="button" className="kc-chat-action" onClick={grantPhotos} disabled={sending}>
                <IconImage /> Montrer mes photos à {nom}
              </button>
            ) : null}

            {showRdvForm ? (
              <form className="kc-rdv-form" onSubmit={proposeRdv}>
                <input type="datetime-local" value={rdvDate} onChange={(e) => setRdvDate(e.target.value)} required />
                <button type="submit" className="kc-btn kc-btn-navy" disabled={sending || !rdvDate}>Proposer</button>
                <button type="button" className="kc-btn kc-btn-ghost" onClick={() => setShowRdvForm(false)}>Annuler</button>
              </form>
            ) : (
              <button type="button" className="kc-chat-action" onClick={() => setShowRdvForm(true)}>
                <IconCalendar /> Proposer une date de visite
              </button>
            )}

            {error ? <p className="kc-error">{error}</p> : null}

            <form className="kc-chat-form" onSubmit={sendReply}>
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Écrire un message…" />
              <button type="submit" className="kc-chat-send" disabled={sending || !draft.trim()} aria-label="Envoyer">
                <IconSend />
              </button>
            </form>
          </section>
        </div>
      </main>
    );
  }

  // ---------- Demande et liste des artisans ----------
  const visuel = metierVisuel(offre?.metier);

  return (
    <main className="client-space">
      <ClientTopbar showBack backHref="/client/radar" />

      <div className="kc">
        {loading ? <div className="kc-empty">Chargement…</div> : null}
        {!loading && !offre ? <div className="kc-empty">{error || "Demande introuvable."}</div> : null}

        {!loading && offre ? (
          <>
            <section className="kc-demande-head">
              <div className="kc-demande-top">
                <span className="kc-thumb" style={{ background: visuel.color }}><Svg>{visuel.icon}</Svg></span>
                <span className="kc-demande-text">
                  <strong>{titreCourt(offre.description)}</strong>
                  <small>{[offre.metier, villeDe(offre), publieLe(offre.publishedAt || offre.createdAt)].filter(Boolean).join(" · ")}</small>
                </span>
              </div>

              {offre.priceRangeMin ? (
                <div className="kc-estimation">
                  <small>Estimation Koji</small>
                  <strong>{euro(offre.priceRangeMin)} – {euro(offre.priceRangeMax)}</strong>
                  {offre.delaiEstimeJours ? <small>Environ {offre.delaiEstimeJours} jour{offre.delaiEstimeJours > 1 ? "s" : ""} de travaux</small> : null}
                </div>
              ) : null}

              <button type="button" className={`kc-toggle${detailOuvert ? " open" : ""}`} onClick={() => setDetailOuvert((o) => !o)} aria-expanded={detailOuvert}>
                {detailOuvert ? "Masquer le détail" : "Voir le détail de ma demande"} <ChevronRight />
              </button>

              {detailOuvert ? (
                <div className="kc-detail">
                  <p className="kc-detail-desc">{offre.description || "—"}</p>
                  {offre.photos?.length > 0 ? (
                    <div className="kc-photos">
                      {offre.photos.map((photo, index) => (
                        <span className="kc-photo" key={index}><img src={photo} alt={`Photo ${index + 1}`} /></span>
                      ))}
                    </div>
                  ) : null}
                  {offre.ouvrages?.length > 0 ? (
                    <div className="kc-ouvrages">
                      {offre.ouvrages.map((lot) => (
                        <div key={lot.room}>
                          <strong>{lot.room}</strong>
                          <ul>{lot.postes.map((poste, index) => <li key={index}>{poste}</li>)}</ul>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <p className="kc-detail-address"><IconLock /> Adresse : {offre.address || "—"} (visible par vous seul)</p>
                </div>
              ) : null}
            </section>

            <section className="kc-block">
              <div className="kc-block-head">
                <h2 className="kc-block-title">
                  Artisans intéressés
                  {artisans.length ? <span className="kc-count">{artisans.length}</span> : null}
                </h2>
              </div>

              {messagesLoading ? (
                <div className="kc-empty">Chargement…</div>
              ) : artisans.length === 0 ? (
                <div className="kc-empty">
                  <strong>Votre demande est en ligne</strong>
                  <span>Les artisans de votre secteur la voient. Dès que l'un d'eux est intéressé, il apparaît ici et vous êtes prévenu.</span>
                </div>
              ) : (
                <ul className="kc-list">
                  {artisans.map((a) => {
                    const nom = a.snapshot?.raisonSociale || "Artisan";
                    const suivi = suiviArtisan(a.messages);
                    const cliquable = a.messages.length > 0;
                    const contenu = (
                      <>
                        <span className="kc-avatar">{initiale(nom)}</span>
                        <span className="kc-demande-text">
                          <strong>{nom}</strong>
                          <small className={`kc-suivi is-${suivi.ton}`}>{suivi.texte}</small>
                        </span>
                        {cliquable ? <span className="kc-chevron"><ChevronRight /></span> : null}
                      </>
                    );
                    return (
                      <li key={a.entrepriseUserId}>
                        {cliquable ? (
                          <button type="button" className="kc-artisan" onClick={() => ouvrir(a)}>{contenu}</button>
                        ) : (
                          <div className="kc-artisan is-waiting">{contenu}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
