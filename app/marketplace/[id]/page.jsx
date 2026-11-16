"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Shell } from "../../../components/Shell";
import { RechargeJetons } from "../../../components/RechargeJetons";
import { apiGet, apiSend } from "../../../lib/client-api";
import { euro, shortDate } from "../../../lib/pricing";
import { estNouveau, notePrix, prixCourt, prixPartiel, publication, titreCourt, villeSeule } from "../../../lib/radar-display";

// Fiche d'un chantier du Radar (maquette PRO-04 v3) : projet du client à
// gauche, « Se positionner » à droite (places, jetons, solde), puis le
// positionnement dans un panneau (message, créneaux tirés du calendrier,
// devis estimatif). États : complet, solde insuffisant, retirée, expirée,
// pas intéressé, proposition envoyée, visite confirmée. Coordonnées du
// client masquées jusqu'au rendez-vous confirmé.

const STEP_LABEL = { acompte: "Acompte", avancement: "Avancement", solde: "Solde" };
const PAIEMENT_STATUS_LABEL = { pending: "En attente de paiement", paid_platform: "Payé, en attente de vos photos", released: "Débloqué" };
const PARIS = { timeZone: "Europe/Paris" };
const jourCreneau = (iso) => new Intl.DateTimeFormat("fr-FR", { ...PARIS, weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
const heureCreneau = (iso) => {
  const [h, m] = new Intl.DateTimeFormat("fr-FR", { ...PARIS, hour: "numeric", minute: "2-digit" }).format(new Date(iso)).split(":");
  return `${Number(h)} h${m !== "00" ? ` ${m}` : ""}`;
};
const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
const Check = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>;

function readAsDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

function Places({ places }) {
  const reste = Math.max(0, places.max - places.prises);
  return (
    <div className="rd-places">
      <span>Entreprises positionnées</span>
      <div className="rd-dots">{Array.from({ length: places.max }, (_, i) => <i key={i} className={i < places.prises ? "on" : ""} />)}</div>
      <b>{places.prises} / {places.max}{places.complet ? " · complet" : reste ? ` · il reste ${pluriel(reste, "place", "places")}` : ""}</b>
    </div>
  );
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
  const [paiements, setPaiements] = useState([]);
  const [paiementUploading, setPaiementUploading] = useState("");
  const [photoRequesting, setPhotoRequesting] = useState(false);
  // Positionnement (panneau), pas intéressé, recharge.
  const [panneau, setPanneau] = useState(false);
  const [message, setMessage] = useState("");
  const [creneaux, setCreneaux] = useState([]);
  const [joindreDevis, setJoindreDevis] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreurPos, setErreurPos] = useState("");
  const [manque, setManque] = useState(0);
  const [pasInteresse, setPasInteresse] = useState(false);
  const [raison, setRaison] = useState("");
  const [recharge, setRecharge] = useState(false);
  const messagesEndRef = useRef(null);

  function reload() {
    apiGet(`/api/marketplace/offres/${params.id}`)
      .then((data) => {
        setOffre(data.offre);
        setMessage((m) => m || data.offre?.messagePropose || "");
        setCreneaux((c) => (c.length ? c : (data.offre?.creneaux || []).slice(0, 2)));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    apiGet(`/api/marketplace/offres/${params.id}/messages`)
      .then((data) => setMessages(data.messages || []))
      .catch(() => {})
      .finally(() => setMessagesLoading(false));
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

  async function envoyerProposition() {
    setEnvoi(true);
    setErreurPos("");
    try {
      await apiSend(`/api/marketplace/offres/${params.id}/positionner`, { message, creneaux, joindreDevis: joindreDevis && Boolean(offre?.prixRecommande?.ttc) });
      setPanneau(false);
      setLoading(true);
      reload();
    } catch (err) {
      if (err.code === "solde" || /il vous en reste/.test(err.message || "")) {
        setManque(Number(err.manque) || Math.max(1, (offre?.jetons || 0) - (offre?.solde?.solde || 0)));
        setPanneau(false);
        reload();
      }
      setErreurPos(err.message || "La proposition n'est pas partie.");
    } finally {
      setEnvoi(false);
    }
  }

  async function retirer() {
    if (!window.confirm("Retirer votre position ? Vos jetons réservés vous sont rendus.")) return;
    await apiSend(`/api/marketplace/offres/${params.id}/positionner`, {}, "DELETE").catch((err) => setErreurPos(err.message));
    reload();
  }

  async function masquer() {
    await apiSend(`/api/marketplace/offres/${params.id}/masquer`, { raison }).catch(() => {});
    router.push("/marketplace");
  }

  const hasResponse = (proposalId) => messages.some((m) => m.respondsToId === proposalId);
  const [autreCreneau, setAutreCreneau] = useState("");

  async function respondRdv(proposalId, rdvStatus) {
    setSending(true);
    try {
      const data = await apiSend(`/api/marketplace/offres/${params.id}/messages`, { kind: "rdv_response", respondsToId: proposalId, rdvStatus });
      setMessages((prev) => [...prev, data.message]);
      if (rdvStatus === "accepted") reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function proposerCreneau(event) {
    event.preventDefault();
    if (!autreCreneau) return;
    setSending(true);
    try {
      const data = await apiSend(`/api/marketplace/offres/${params.id}/messages`, { kind: "rdv_proposal", rdvDate: new Date(autreCreneau).toISOString() });
      setMessages((prev) => [...prev, data.message]);
      setAutreCreneau("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
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
  const solde = offre?.solde?.solde ?? 0;
  const jetons = offre?.jetons || 0;
  const pos = offre?.maPosition;
  const insuffisant = offre && !pos && solde < jetons;
  const ville = offre ? villeSeule(offre.address) : "";
  const eyebrow = offre ? [ville, offre.distanceKm != null ? `à ${String(offre.distanceKm).replace(".", ",")} km` : "", publication(offre.publieLe || offre.createdAt), "décrit avec l'assistant Koji"].filter(Boolean).join(" · ") : "";

  // Panneau de droite selon l'état.
  function cote() {
    if (!offre) return null;
    if (pos?.etat === "rdv") {
      return (
        <section className="card rd-pos">
          <div className="rx-fh"><div><span className="eyebrow">Visite confirmée</span><h2>{pos.rdvDate ? `${jourCreneau(pos.rdvDate)}, ${heureCreneau(pos.rdvDate)}` : "Rendez-vous confirmé"}</h2></div><span className="tag tag-e">RDV confirmé</span></div>
          <p className="rx-p">{pos.jetons?.texte}. Les coordonnées du client sont visibles, la visite est dans votre calendrier.</p>
          <Link href={`/marketplace/${params.id}/visite`} className="btn btn-main rd-go">Préparer la visite</Link>
          <Link href={`/marketplace/${params.id}/proposition-devis`} className="link rd-no">Préparer le devis</Link>
        </section>
      );
    }
    if (pos?.etat === "attente") {
      return (
        <section className="card rd-pos">
          <div className="rx-fh"><div><span className="eyebrow">{ville} · {pos.etape}</span><h2>{title}</h2></div><span className="tag tag-e">Envoyé</span></div>
          <p className="rx-p">Le client reçoit votre message et vos créneaux. Il a 7 jours pour confirmer une visite.</p>
          <div className="kv"><span>Jetons</span><b>{pos.jetons?.n} réservé{pos.jetons?.n > 1 ? "s" : ""} · solde {solde}</b></div>
          <p className="rx-p">{pos.jetons?.texte}</p>
          <div className="rx-mf"><button type="button" className="link" onClick={retirer}>Retirer</button><Link className="btn btn-sec" href="/marketplace/positions">Mes positions</Link></div>
        </section>
      );
    }
    if (offre.retiree || pos?.etat === "retiree") {
      return (
        <section className="card rd-pos">
          <div className="rx-fh"><div><span className="eyebrow">{ville} · retirée</span><h2>{title}</h2></div><span className="tag tag-o dim">Retirée</span></div>
          <p className="rx-p">Le client a retiré sa demande.{pos ? ` Vos ${pluriel(pos.jetons?.n || 0, "jeton réservé vous est rendu", "jetons réservés vous sont rendus")}.` : ""}</p>
          <Link className="btn btn-sec" href="/marketplace">Retour au Radar</Link>
        </section>
      );
    }
    if (offre.expiree || pos?.etat === "expiree") {
      return (
        <section className="card rd-pos">
          <div className="rx-fh"><div><span className="eyebrow">{ville} · {publication(offre.publieLe || offre.createdAt)}</span><h2>{title}</h2></div><span className="tag tag-o dim">Expiré</span></div>
          <p className="rx-p">{pos?.etape === "Expirée · aucune réponse du client" ? `Le client n'a pas répondu dans les 7 jours. ${pos.jetons?.texte}.` : `Le client n'a confirmé aucun rendez-vous dans les 15 jours. Le chantier quitte le Radar${pos ? ` ; ${pos.jetons?.texte}` : ""}.`}</p>
          <Link className="btn btn-sec" href="/marketplace">Retour au Radar</Link>
        </section>
      );
    }
    if (pos?.termine) {
      return (
        <section className="card rd-pos">
          <div className="rx-fh"><div><span className="eyebrow">{ville}</span><h2>{title}</h2></div><span className="tag tag-o dim">{pos.libelle}</span></div>
          <p className="rx-p">{pos.etape}. {pos.jetons?.texte}.</p>
          <Link className="btn btn-sec" href="/marketplace">Retour au Radar</Link>
        </section>
      );
    }
    if (offre.places?.complet) {
      return (
        <section className="card rd-pos">
          <div className="rx-fh"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div></div>
          <Places places={offre.places} />
          <p className="rx-p">Trois entreprises sont positionnées. Si l'une se retire, la place se rouvre.</p>
          <div className="rx-mf"><button type="button" className="link" onClick={() => setPasInteresse(true)}>Masquer</button><Link className="btn btn-sec" href="/marketplace">Retour au Radar</Link></div>
        </section>
      );
    }
    if (pasInteresse) {
      return (
        <section className="card rd-pos">
          <div className="card-h"><h2>Pas intéressé</h2></div>
          <p className="rx-p">Pourquoi ce chantier ne vous intéresse pas ? Koji ajuste votre Radar.</p>
          <div className="rx-why">
            {(offre.raisonsPasInteresse || []).map((r) => <button key={r} type="button" className={raison === r ? "on" : ""} aria-pressed={raison === r} onClick={() => setRaison(raison === r ? "" : r)}>{r}</button>)}
          </div>
          <small className="sm2">Facultatif. Le client n'est jamais informé de votre choix.</small>
          <div className="rx-mf"><button type="button" className="link" onClick={() => setPasInteresse(false)}>Annuler</button><button type="button" className="btn btn-sec" onClick={masquer}>Retirer le chantier</button></div>
        </section>
      );
    }
    return (
      <>
        <section className="card rd-pos">
          <div className="card-h"><h2>Se positionner</h2></div>
          <div className="rd-price">
            <div>
              <span>Votre prix, d'après votre bibliothèque</span>
              <b>{offre.prixRecommande?.ttc ? `${prixCourt(offre.prixRecommande)}` : "À chiffrer"}</b>
              <small>{offre.prixRecommande?.ttc ? `TTC${prixPartiel(offre.prixRecommande) ? ", partiel" : ""} · ` : ""}{notePrix(offre.prixRecommande)}</small>
            </div>
          </div>
          <Places places={offre.places || { prises: 0, max: 3 }} />
          {insuffisant ? (
            <div className="rx-warn">
              <strong>Il faut {pluriel(jetons, "jeton", "jetons")}, il vous en reste {solde}</strong>
              <p>Rien n'est débité tant que le client n'a pas confirmé un rendez-vous. La recharge est immédiate.</p>
            </div>
          ) : (
            <div className="rd-tok">
              <span className="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M9 12h6M12 9v6" /></svg></span>
              <div><strong>{pluriel(jetons, "jeton", "jetons")}</strong><small>débités seulement si le client confirme un rendez-vous avec vous ; sinon rendus après 7 jours</small></div>
            </div>
          )}
          <div className="kv"><span>Votre solde</span><b>{pluriel(solde, "jeton", "jetons")} · <button type="button" className="link" onClick={() => setRecharge(true)}>Recharger</button></b></div>
          {insuffisant
            ? <button type="button" className="btn btn-main rd-go" onClick={() => setRecharge(true)}>Recharger</button>
            : <button type="button" className="btn btn-main rd-go" onClick={() => { setErreurPos(""); setPanneau(true); }}>Me positionner</button>}
          <button type="button" className="link rd-no" onClick={() => setPasInteresse(true)}>Pas intéressé</button>
          {erreurPos && !panneau ? <p className="err" role="alert">{erreurPos}</p> : null}
        </section>
        <section className="card">
          <div className="card-h"><h2>Avant de vous positionner</h2></div>
          <p className="rd-p">Le client voit votre KojiPage, votre message et vos créneaux. Il choisit avec qui prendre rendez-vous.</p>
        </section>
      </>
    );
  }

  return (
    <Shell variant="pro">
      <div className="rd-crumb"><Link href="/marketplace" className="link">Radar des chantiers</Link><span>·</span><span>{title}</span><span style={{ flex: 1 }} /><Link href="/marketplace/positions" className="link">Mes positions</Link></div>

      {loading && !offre ? <div className="tbl"><p className="empty">Chargement…</p></div> : null}
      {!loading && error && !offre ? <p className="notice" role="alert">{error}</p> : null}

      {offre ? (
        <div className="rd-grid">
          <div className="rd-col">
            <section className="card">
              <div className="rd-h">
                <div><span className="eyebrow">{eyebrow}</span><h1 className="rd-t">{title}</h1></div>
                {estNouveau(offre.createdAt) ? <span className="tag tag-e">Nouveau</span> : null}
              </div>
              <div className="rd-fit">
                {offre.metierCorrespond ? <span className="rd-chip ok"><Check />Correspond à vos métiers : {offre.metierCorrespond.toLowerCase()}</span> : offre.metier ? <span className="rd-chip">{offre.metier}</span> : null}
                {offre.dansZone ? <span className="rd-chip ok"><Check />Dans votre zone</span> : null}
                {offre.delaiEstimeJours ? <span className="rd-chip">Durée estimée : {pluriel(offre.delaiEstimeJours, "jour", "jours")}</span> : null}
              </div>
              <div className="rd-msg">« {offre.description} »</div>
              <div className="rd-sec">
                <span>Projet construit par le client</span>
                <ul className="rd-ul">
                  {(offre.ouvrages || []).flatMap((lot) => lot.postes || []).map((poste, i) => <li key={i}>{poste}</li>)}
                </ul>
              </div>
              {offre.photosUnlocked && offre.photos?.length > 0 ? (
                <div className="rd-ph">{offre.photos.map((photo, index) => <img key={index} src={photo} alt={`Photo ${index + 1} du chantier`} />)}</div>
              ) : offre.photosCount > 0 ? (
                <div className="rd-photo-ask">
                  <span className="muted">{pluriel(offre.photosCount, "photo jointe", "photos jointes")} par le client, visibles quand il vous en donne l'accès.</span>
                  <button type="button" className="btn btn-sec" onClick={requestPhotos} disabled={photoRequesting}>{photoRequesting ? "Demande envoyée…" : "Demander l'accès aux photos"}</button>
                </div>
              ) : null}
              <div className="rd-facts">
                <div><span>Métier</span><b>{offre.metier || "Non précisé"}</b></div>
                <div><span>Secteur</span><b>{offre.rdvConfirmed ? offre.address : ville || "—"}</b></div>
                <div><span>Photos</span><b>{offre.photosCount || 0}</b></div>
                <div><span>Publié le</span><b>{shortDate(offre.publieLe || offre.createdAt)}</b></div>
              </div>
            </section>

            <section className="card">
              <div className="card-h"><h2>À vérifier pendant la visite</h2><span className="sm2">préparé par Koji</span></div>
              {(offre.aVerifier || []).map((p) => <div className="kv" key={p}><span>{p}</span><b /></div>)}
              <small className="sm2" style={{ display: "block", marginTop: 8 }}>
                {offre.rdvConfirmed ? `${offre.clientName} · ${offre.clientPhone || offre.clientEmail || ""}` : "Adresse exacte, nom et téléphone du client visibles après la confirmation d'un rendez-vous."}
              </small>
            </section>

            {pos || messages.length ? (
              <section className="card rd-chat">
                <div className="card-h"><h2>Fil avec le client</h2><span className="muted">reste sur Koji jusqu'au rendez-vous</span></div>
                <div className="msgs" aria-live="polite">
                  {messagesLoading ? <p className="muted">Chargement…</p> : null}
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
                {pos && !pos.termine && pos.etat !== "rdv" ? (
                  <form className="pform rd-rdv" onSubmit={proposerCreneau}>
                    <input type="datetime-local" value={autreCreneau} onChange={(e) => setAutreCreneau(e.target.value)} aria-label="Proposer un autre créneau" />
                    <button type="submit" className="btn btn-sec" disabled={sending || !autreCreneau}>Proposer un autre créneau</button>
                  </form>
                ) : null}
                <form className="composer" onSubmit={sendMessage}>
                  <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Écrire au client…" aria-label="Message au client" />
                  <button type="submit" className="send" disabled={sending || !draft.trim()} aria-label="Envoyer">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 16-2-7z" /></svg>
                  </button>
                </form>
                {error ? <p className="err" role="alert">{error}</p> : null}
              </section>
            ) : null}
          </div>

          <aside className="rd-side">
            {cote()}
            {paiements.length > 0 ? (
              <section className="card">
                <div className="card-h"><h2>Paiement échelonné</h2></div>
                {paiements.map((p) => (
                  <div className="row" key={p.id}>
                    <div className="t"><strong>{STEP_LABEL[p.step] || p.step}</strong><small>{euro(p.amountTtc)} · {PAIEMENT_STATUS_LABEL[p.status] || p.status}</small></div>
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
          </aside>
        </div>
      ) : null}

      {panneau && offre ? (
        <>
          <div className="env-scrim" onClick={envoi ? undefined : () => setPanneau(false)} />
          <section className="env-panel wide rd-pan" role="dialog" aria-modal="true" aria-label="Me positionner">
            <div className="env-h"><h2>Me positionner</h2><button type="button" className="link" onClick={() => setPanneau(false)}>Fermer</button></div>
            <div className="env-ch">
              <span className="lab">Votre message au client</span>
              <textarea className="rd-ta" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} />
            </div>
            <div className="env-ch">
              <span className="lab">Créneaux de visite proposés · tirés de votre calendrier</span>
              <div className="rd-sls">
                {(offre.creneaux || []).map((c) => {
                  const on = creneaux.includes(c);
                  return (
                    <button key={c} type="button" className={`rd-sl${on ? " on" : ""}`} aria-pressed={on} onClick={() => setCreneaux((l) => (on ? l.filter((x) => x !== c) : [...l, c]))}>
                      <b>{jourCreneau(c)}</b><span>{heureCreneau(c)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {offre.prixRecommande?.ttc ? (
              <div className="env-ch">
                <span className="lab">Joindre une première proposition</span>
                <button type="button" className={`rd-at${joindreDevis ? " on" : ""}`} aria-pressed={joindreDevis} onClick={() => setJoindreDevis((v) => !v)}>
                  <span className="cb">{joindreDevis ? <Check /> : null}</span>
                  <div><strong>Devis estimatif à vos prix · {prixCourt(offre.prixRecommande)} TTC</strong><small>construit depuis le projet du client avec votre bibliothèque ; estimatif, à confirmer après visite</small></div>
                </button>
              </div>
            ) : null}
            <div className="rd-tok">
              <span className="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M9 12h6M12 9v6" /></svg></span>
              <div><strong>{pluriel(jetons, "jeton réservé", "jetons réservés")}</strong><small>débités si le client confirme une visite avec vous · rendus après 7 jours sans réponse ou si vous n'êtes pas retenu</small></div>
            </div>
            {erreurPos ? <p className="err" role="alert">{erreurPos}</p> : null}
            <div className="env-act">
              <button type="button" className="btn btn-sec" onClick={() => setPanneau(false)} disabled={envoi}>Annuler</button>
              <button type="button" className="btn btn-main" onClick={envoyerProposition} disabled={envoi || !message.trim() || !creneaux.length}>{envoi ? "Envoi…" : "Envoyer ma proposition"}</button>
            </div>
          </section>
        </>
      ) : null}

      {recharge && offre ? <RechargeJetons jetons={offre.solde ? { ...offre.solde, prixHt: offre.solde.prixHt } : null} manque={manque || Math.max(0, jetons - solde)} retour={`/marketplace/${params.id}`} onClose={() => setRecharge(false)} /> : null}
    </Shell>
  );
}
