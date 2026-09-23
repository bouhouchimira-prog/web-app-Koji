"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ClientTopbar } from "../../../../components/ClientTopbar";
import { RadarAddressAutocomplete } from "../../../../components/RadarAddressAutocomplete";

// Creer une offre — refonte du 23 septembre (v3) : une seule page avec deux
// onglets ("Offre IA" / "Saisie libre") — habillage inspire d'une maquette
// fournie par Amira (bandeau navy, carte blanche, bouton degrade), sans les
// fonctionnalites qui n'existent nulle part ailleurs dans Koji (dictee
// vocale, compteurs de quota, chargement de modele — hors perimetre).
//
// v3 (meme jour) : l'onglet "Offre IA" ne saute plus directement de
// description+photos au prix — Amira a demande qu'on pose d'abord les
// questions necessaires (adresse, surface, fournitures, etage/ascenseur,
// stationnement, nettoyage, etat de la piece) avant de chiffrer, comme le
// parcours "Saisie libre" recueille deja tout ca via son formulaire direct.
// Reutilise tel quel /api/radar-assistant (liste de questions fixe et
// garde-fou, desormais etendue avec etage/stationnement/nettoyage) puis
// /api/expertise-koji pour la fourchette de prix, /api/chantier-offres pour
// la publication — jamais de budget demande au client, jamais de devis
// interne montre, jamais d'estimation avant que le client ne la demande.

function SparkleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function PencilIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21l4-1 11-11-3-3L4 17l-1 4zM14 6l3 3" />
    </svg>
  );
}
function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
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

function readAsDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

export default function NewRadarOffrePage() {
  const router = useRouter();
  const [mode, setMode] = useState("ia"); // ia | manuel
  const [phase, setPhase] = useState("form"); // form | chat | loading | result
  const [photos, setPhotos] = useState([]);
  const [description, setDescription] = useState("");
  const [surface, setSurface] = useState("");
  const [address, setAddress] = useState({ address: "", city: "", postalCode: "", lat: null, lon: null });
  const [addressDraft, setAddressDraft] = useState("");
  const [expertise, setExpertise] = useState(null);
  const [selectedConseils, setSelectedConseils] = useState(new Set());
  const [error, setError] = useState("");
  const [publishing, setPublishing] = useState(false);

  // Etat du chat de questions (onglet "Offre IA" uniquement) — meme
  // mecanique que /api/radar-assistant utilisait deja dans le precedent
  // parcours en etapes : liste fixe, une question a la fois, jamais
  // d'improvisation IA sur le contenu des questions.
  const [turns, setTurns] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [currentOptions, setCurrentOptions] = useState(null);
  const [currentInputType, setCurrentInputType] = useState("text");
  const [readyMessage, setReadyMessage] = useState("");
  const [slotKey, setSlotKey] = useState(null);
  const [expertiseAnswers, setExpertiseAnswers] = useState({});
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, sending]);

  function switchMode(next) {
    if (phase !== "form") return;
    setMode(next);
    setError("");
  }

  function onPhotosChange(event) {
    const files = Array.from(event.target.files || []).slice(0, 8 - photos.length);
    if (!files.length) return;
    Promise.all(files.map(readAsDataUrl)).then((dataUrls) => setPhotos((p) => [...p, ...dataUrls]));
    event.target.value = "";
  }
  function removePhoto(index) {
    setPhotos((p) => p.filter((_, i) => i !== index));
  }

  async function sendTurn(nextTurns) {
    setSending(true);
    setError("");
    setCurrentOptions(null);
    try {
      const response = await fetch("/api/radar-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turns: nextTurns.map(({ role, text }) => ({ role, text })),
          photos: nextTurns.filter((t) => t.role === "user").length === 1 ? photos : undefined,
          currentSlotKey: slotKey,
          answers: expertiseAnswers
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur de l'assistant.");
      setTurns([...nextTurns, { role: "assistant", text: data.message }]);
      if (data.answers) setExpertiseAnswers(data.answers);
      if (data.type === "ready_for_expertise") {
        setReadyMessage(data.message);
        setCurrentOptions(null);
        setCurrentInputType("text");
        setSlotKey(null);
      } else {
        setReadyMessage("");
        setCurrentOptions(data.options || null);
        setCurrentInputType(data.inputType || "text");
        setSlotKey(data.slotKey || null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  // Soumission du formulaire d'intro (description + photos) : bascule sur
  // le chat de questions au lieu d'aller directement au prix.
  function startChat() {
    if (!description.trim()) { setError("Décrivez les travaux à réaliser."); return; }
    setError("");
    setPhase("chat");
    const firstTurns = [{ role: "user", text: description.trim() }];
    setTurns(firstTurns);
    sendTurn(firstTurns);
  }

  function answerText(text) {
    if (!text.trim() || sending || readyMessage) return;
    const nextTurns = [...turns, { role: "user", text: text.trim() }];
    setTurns(nextTurns);
    setDraft("");
    sendTurn(nextTurns);
  }

  function handleChatSubmit(event) {
    event.preventDefault();
    answerText(draft);
  }

  function selectAddress(feature) {
    const [lon, lat] = feature.geometry.coordinates;
    const label = feature.properties.label;
    setAddress({
      address: label,
      city: feature.properties.city || "",
      postalCode: feature.properties.postcode || "",
      lat, lon
    });
    setAddressDraft("");
    if (phase === "chat") answerText(label);
  }

  function submitManualAddress(text) {
    setAddress({ address: text, city: "", postalCode: "", lat: null, lon: null });
    setAddressDraft("");
    if (phase === "chat") answerText(text);
  }

  async function launchExpertise() {
    const answers = mode === "ia"
      ? expertiseAnswers
      : { intro: description.trim(), adresse: address.address, cotes: surface.trim() };
    if (mode === "manuel") {
      if (!description.trim()) { setError("Décrivez les travaux à réaliser."); return; }
      if (!address.address.trim()) { setError("L'adresse du chantier est obligatoire."); return; }
    }
    setPhase("loading");
    setError("");
    try {
      const response = await fetch("/api/expertise-koji", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, photos })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "L'expertise n'a pas pu se terminer.");
      setExpertise(data);
      setSelectedConseils(new Set());
      setPhase("result");
    } catch (err) {
      setError(err.message);
      setPhase(mode === "ia" ? "chat" : "form");
    }
  }

  function toggleConseil(id) {
    setSelectedConseils((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function adjustedRange() {
    if (!expertise) return { min: 0, max: 0 };
    const discount = (expertise.conseils || [])
      .filter((c) => selectedConseils.has(c.id))
      .reduce((sum, c) => sum + Number(c.discountPercent || 0), 0);
    const factor = Math.max(0, 1 - discount / 100);
    return {
      min: Math.round(expertise.priceRangeMin * factor),
      max: Math.round(expertise.priceRangeMax * factor)
    };
  }

  async function publish() {
    if (!address.address.trim()) { setError("L'adresse du chantier est obligatoire."); return; }
    setPublishing(true);
    setError("");
    try {
      const response = await fetch("/api/chantier-offres", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expertiseId: expertise.expertiseId,
          conseilsSelectionnes: Array.from(selectedConseils),
          photos,
          description: expertise.description,
          metier: expertise.metier,
          address: address.address,
          city: address.city,
          postalCode: address.postalCode,
          lat: address.lat,
          lon: address.lon
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur lors de la publication.");
      router.push("/client/radar");
    } catch (err) {
      setError(err.message);
    } finally {
      setPublishing(false);
    }
  }

  function restart() {
    setPhase("form");
    setExpertise(null);
    setSelectedConseils(new Set());
    setError("");
    setTurns([]);
    setReadyMessage("");
    setCurrentOptions(null);
    setSlotKey(null);
    setExpertiseAnswers({});
  }

  const range = phase === "result" ? adjustedRange() : null;

  return (
    <main className="client-space">
      <ClientTopbar showBack backHref="/client/radar" />

      <div className="ct-welcome">
        <strong>Créer une offre</strong>
        <small>Saisie manuelle ou assistée par IA.</small>
      </div>

      {phase === "form" ? (
        <section className="radar-mode-tabs">
          <button type="button" className={`radar-mode-tab ${mode === "ia" ? "active" : ""}`} onClick={() => switchMode("ia")}>
            <span className="radar-mode-tab-icon ia"><SparkleIcon /></span>
            <div>
              <strong>Offre IA</strong>
              <small>Description + photos, puis quelques questions</small>
            </div>
          </button>
          <button type="button" className={`radar-mode-tab ${mode === "manuel" ? "active" : ""}`} onClick={() => switchMode("manuel")}>
            <span className="radar-mode-tab-icon manuel"><PencilIcon /></span>
            <div>
              <strong>Saisie libre</strong>
              <small>Tous les champs vous-même</small>
            </div>
          </button>
        </section>
      ) : null}

      <section className="radar-form-card radar-form-card-flush">
        {phase === "form" && mode === "ia" ? (
          <>
            <div className="radar-hero-banner">
              <span className="radar-hero-icon"><SparkleIcon /></span>
              <div>
                <strong>Décris ton chantier</strong>
                <p>Texte et/ou photos : l'assistant koji pose ensuite quelques questions puis estime votre projet.</p>
              </div>
            </div>
            <div className="radar-field radar-form-card-pad">
              <div className="radar-hint-callout">
                Décrivez vos travaux et ajoutez des photos si vous en avez. L'assistant koji vous posera ensuite quelques questions (adresse, surface, fournitures, accès, nettoyage...) pour affiner l'estimation.
              </div>

              <span className="radar-field-label">Description des travaux</span>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Décris le chantier en langage naturel… Ex : Remplacement tableau électrique 13 circuits dans appartement T3, pose de 8 prises et 4 interrupteurs, mise aux normes."
              />

              <span className="radar-field-label">Photos du chantier (optionnel)</span>
              <label className="radar-dropzone">
                <input type="file" accept="image/*" multiple onChange={onPhotosChange} />
                <UploadIcon />
                <strong>Ajouter des photos du chantier</strong>
                <span>Une photo par pièce, jusqu'à 8 · JPEG, PNG ou WebP</span>
              </label>
              {photos.length > 0 ? (
                <div className="radar-photo-grid">
                  {photos.map((photo, index) => (
                    <div className="radar-photo-thumb" key={index}>
                      <img src={photo} alt={`Photo ${index + 1}`} />
                      <button type="button" onClick={() => removePhoto(index)}>×</button>
                    </div>
                  ))}
                </div>
              ) : null}

              {error ? <p className="profile-message error">{error}</p> : null}

              <button type="button" className="radar-generate-btn" onClick={startChat}>
                <SparkleIcon />
                Continuer avec l'assistant koji
              </button>
              <p className="radar-generate-hint">Quelques questions, puis une estimation chiffrée prête à publier.</p>
            </div>
          </>
        ) : null}

        {phase === "chat" ? (
          <div className="radar-field radar-form-card-pad">
            <div className="radar-chat-header">
              <span className="radar-chat-header-icon"><SparkleIcon /></span>
              <div>
                <strong>Assistant koji</strong>
                <small>Répondez à ses questions pour préparer l'estimation</small>
              </div>
            </div>

            <div className="radar-chat-messages">
              {turns.map((t, index) => (
                <div key={index} className={`radar-chat-bubble ${t.role === "user" ? "user" : "assistant"}`}>
                  <p>{t.text}</p>
                </div>
              ))}
              {sending ? <p className="radar-chat-empty">L'assistant réfléchit…</p> : null}
              <div ref={messagesEndRef} />
            </div>

            {error ? <p className="profile-message error">{error}</p> : null}

            {readyMessage ? (
              <button type="button" className="radar-generate-btn" onClick={launchExpertise}>
                <SparkleIcon />
                Lancer l'estimation
              </button>
            ) : currentInputType === "address" ? (
              <RadarAddressAutocomplete value={addressDraft} onChange={setAddressDraft} onSelect={selectAddress} onManualSubmit={submitManualAddress} />
            ) : currentOptions && currentOptions.length > 0 ? (
              <div className="radar-quick-options">
                {currentOptions.map((option) => (
                  <button key={option} type="button" className="radar-quick-option-btn" disabled={sending} onClick={() => answerText(option)}>
                    {option}
                  </button>
                ))}
              </div>
            ) : (
              <form className="radar-chat-form" onSubmit={handleChatSubmit}>
                <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Votre réponse…" disabled={sending} />
                <button type="submit" className="radar-chat-send" disabled={sending || !draft.trim()} aria-label="Envoyer">
                  <SendIcon />
                </button>
              </form>
            )}

            <button type="button" className="button secondary" onClick={restart} disabled={sending}>
              Recommencer
            </button>
          </div>
        ) : null}

        {phase === "form" && mode === "manuel" ? (
          <div className="radar-field radar-form-card-pad">
            <label className="radar-dropzone">
              <input type="file" accept="image/*" multiple onChange={onPhotosChange} />
              <UploadIcon />
              <strong>Ajouter des photos</strong>
              <span>Cliquez ou glissez vos fichiers ici · 8 max</span>
            </label>
            {photos.length > 0 ? (
              <div className="radar-photo-grid">
                {photos.map((photo, index) => (
                  <div className="radar-photo-thumb" key={index}>
                    <img src={photo} alt={`Photo ${index + 1}`} />
                    <button type="button" onClick={() => removePhoto(index)}>×</button>
                  </div>
                ))}
              </div>
            ) : null}

            <span className="radar-field-label">Description des travaux</span>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex : Je veux refaire la plomberie de ma salle de bain, remplacer la baignoire par une douche…"
            />

            <span className="radar-field-label">Adresse du chantier</span>
            {!address.address ? (
              <RadarAddressAutocomplete value={addressDraft} onChange={setAddressDraft} onSelect={selectAddress} onManualSubmit={submitManualAddress} />
            ) : (
              <label className="radar-field">
                <input type="text" value={address.address} onChange={(e) => setAddress((c) => ({ ...c, address: e.target.value }))} />
              </label>
            )}

            <span className="radar-field-label">Surface approximative (facultatif)</span>
            <input type="text" value={surface} onChange={(e) => setSurface(e.target.value)} placeholder="Ex : environ 5 m²" />

            {error ? <p className="profile-message error">{error}</p> : null}

            <button type="button" className="radar-generate-btn" onClick={launchExpertise}>
              <SparkleIcon />
              Estimer et continuer
            </button>
          </div>
        ) : null}

        {phase === "loading" ? (
          <div className="radar-expertise-loading">
            <div className="radar-expertise-spinner" />
            <strong>Un architecte koji analyse votre projet…</strong>
            <p>Chiffrage à partir de la bibliothèque de prix koji, ça ne prend que quelques instants.</p>
          </div>
        ) : null}

        {phase === "result" && expertise ? (
          <div className="radar-field radar-form-card-pad">
            <div className="radar-price-range-card">
              <span className="radar-price-range-label">Fourchette de prix estimée</span>
              <span className="radar-price-range-value">{range.min.toLocaleString("fr-FR")} € – {range.max.toLocaleString("fr-FR")} €</span>
              {expertise.delaiEstimeJours ? <span className="radar-delay-badge">Délai estimé : {expertise.delaiEstimeJours} jour{expertise.delaiEstimeJours > 1 ? "s" : ""}</span> : null}
            </div>

            {expertise.conseils && expertise.conseils.length > 0 ? (
              <>
                <span className="radar-field-label">Conseils pour réduire le coût</span>
                <div className="radar-conseil-list">
                  {expertise.conseils.map((c) => (
                    <label key={c.id} className={`radar-conseil-item${selectedConseils.has(c.id) ? " checked" : ""}`}>
                      <input type="checkbox" checked={selectedConseils.has(c.id)} onChange={() => toggleConseil(c.id)} />
                      <span className="radar-conseil-label">{c.label}</span>
                      <span className="radar-conseil-discount">-{c.discountPercent}%</span>
                    </label>
                  ))}
                </div>
              </>
            ) : null}

            {!address.address ? (
              <>
                <span className="radar-field-label">Adresse du chantier</span>
                <RadarAddressAutocomplete value={addressDraft} onChange={setAddressDraft} onSelect={selectAddress} onManualSubmit={submitManualAddress} />
              </>
            ) : (
              <label className="radar-field">
                <span>Adresse du chantier</span>
                <input type="text" value={address.address} onChange={(e) => setAddress((c) => ({ ...c, address: e.target.value }))} />
              </label>
            )}

            <p className="radar-recap-note">Vous pouvez relancer l'estimation autant de fois que vous voulez pour comparer. La publication reste gratuite et illimitée.</p>

            {error ? <p className="profile-message error">{error}</p> : null}

            <button type="button" className="button secondary" style={{ width: "100%" }} onClick={launchExpertise}>
              <SparkleIcon />
              Relancer l'estimation
            </button>
            <button type="button" className="button secondary" style={{ width: "100%" }} onClick={restart}>
              Modifier ma demande
            </button>
            <button type="button" className="button blue" style={{ width: "100%" }} onClick={publish} disabled={publishing}>
              {publishing ? "Publication…" : "Publier l'offre"}
              {!publishing ? <CheckIcon /> : null}
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
