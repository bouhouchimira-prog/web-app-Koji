"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ClientTopbar } from "../../../../components/ClientTopbar";

// Parcours de creation d'offre — refonte du 4 septembre : le formulaire en 6
// etapes a disparu. Le client depose photos + un texte libre, puis
// l'assistant koji (app/api/radar-assistant) prend le relais en chat, une
// question a la fois. Quand il a assez d'elements, le client lance
// l'expertise (app/api/expertise-koji) qui fixe une fourchette de prix —
// jamais de budget demande au client, jamais de devis interne montre.

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
function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s7-6.6 7-11.5A7 7 0 105 9.5C5 14.4 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
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
function SparkleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" />
      <circle cx="12" cy="12" r="3" />
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
function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
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

function AddressAutocomplete({ value, onChange, onSelect }) {
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 3) { setSuggestions([]); return; }
    const handle = setTimeout(() => {
      fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5`)
        .then((r) => r.json())
        .then((data) => setSuggestions(data.features || []))
        .catch(() => setSuggestions([]));
    }, 350);
    return () => clearTimeout(handle);
  }, [value]);

  return (
    <label className="radar-field radar-address-field">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Numéro, rue, ville, code postal"
        autoComplete="off"
        autoFocus
      />
      {suggestions.length > 0 ? (
        <ul className="radar-address-suggestions">
          {suggestions.map((feature) => (
            <li key={feature.properties.id}>
              <button type="button" onClick={() => { onSelect(feature); setSuggestions([]); }}>
                <PinIcon />
                {feature.properties.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </label>
  );
}

export default function NewRadarOffrePage() {
  const router = useRouter();
  const [phase, setPhase] = useState("intro"); // intro | chat | expertise-loading | expertise-result
  const [photos, setPhotos] = useState([]);
  const [introText, setIntroText] = useState("");
  const [turns, setTurns] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [currentOptions, setCurrentOptions] = useState(null);
  const [currentInputType, setCurrentInputType] = useState("text");
  const [readyMessage, setReadyMessage] = useState("");
  const [slotKey, setSlotKey] = useState(null);
  const [expertiseAnswers, setExpertiseAnswers] = useState({});
  const [address, setAddress] = useState({ address: "", city: "", postalCode: "", lat: null, lon: null });
  const [addressDraft, setAddressDraft] = useState("");
  const [expertise, setExpertise] = useState(null);
  const [selectedConseils, setSelectedConseils] = useState(new Set());
  const [publishing, setPublishing] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, phase, sending]);

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

  function startChat() {
    const text = introText.trim();
    if (!text || sending) return;
    setPhase("chat");
    const firstTurns = [{ role: "user", text }];
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
    answerText(label);
  }

  async function launchExpertise() {
    setPhase("expertise-loading");
    setError("");
    try {
      const response = await fetch("/api/expertise-koji", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: expertiseAnswers, photos })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "L'expertise n'a pas pu se terminer.");
      setExpertise(data);
      setSelectedConseils(new Set());
      setPhase("expertise-result");
    } catch (err) {
      setError(err.message);
      setPhase("chat");
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

  function backFromChat() {
    if (sending) return;
    setPhase("intro");
    setTurns([]);
    setError("");
    setCurrentOptions(null);
    setReadyMessage("");
    setSlotKey(null);
    setExpertiseAnswers({});
  }

  const range = phase === "expertise-result" ? adjustedRange() : null;

  return (
    <main className="client-space">
      <ClientTopbar showBack backHref="/client/radar" />

      <div className="ct-welcome">
        <strong>Publier une offre</strong>
      </div>

      <section className="ct-section radar-form-card">
        {phase === "intro" ? (
          <div className="radar-field">
            <div className="radar-step-header">
              <span className="radar-step-icon"><SparkleIcon /></span>
              <div>
                <h3>Décrivez vos travaux</h3>
                <p>Ajoutez des photos si vous en avez, et dites-nous ce que vous voulez faire. L'assistant koji s'occupe du reste.</p>
              </div>
            </div>

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

            <textarea
              rows={4}
              value={introText}
              onChange={(e) => setIntroText(e.target.value)}
              placeholder="Ex : Je veux refaire la plomberie de ma salle de bain, remplacer la baignoire par une douche…"
            />

            {error ? <p className="profile-message error">{error}</p> : null}

            <button type="button" className="button blue" style={{ width: "100%" }} onClick={startChat} disabled={!introText.trim()}>
              Discuter avec l'assistant koji
              <SendIcon />
            </button>
          </div>
        ) : null}

        {phase === "chat" ? (
          <div className="radar-assistant-card">
            <div className="radar-chat-header">
              <span className="radar-chat-header-icon"><ChatIcon /></span>
              <div>
                <strong>Assistant koji</strong>
                <small>Répondez à ses questions pour préparer l'expertise</small>
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
              <button type="button" className="button blue" style={{ width: "100%" }} onClick={launchExpertise}>
                <SparkleIcon />
                Lancer l'expertise
              </button>
            ) : currentInputType === "address" ? (
              <AddressAutocomplete value={addressDraft} onChange={setAddressDraft} onSelect={selectAddress} />
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

            <button type="button" className="button secondary" onClick={backFromChat} disabled={sending}>
              <ArrowLeftIcon />
              Recommencer
            </button>
          </div>
        ) : null}

        {phase === "expertise-loading" ? (
          <div className="radar-expertise-loading">
            <div className="radar-expertise-spinner" />
            <strong>Un architecte koji analyse votre projet…</strong>
            <p>Chiffrage à partir de la bibliothèque de prix koji, ça ne prend que quelques instants.</p>
          </div>
        ) : null}

        {phase === "expertise-result" && expertise ? (
          <div className="radar-field">
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
                <AddressAutocomplete value={addressDraft} onChange={setAddressDraft} onSelect={(f) => selectAddress(f)} />
              </>
            ) : (
              <label className="radar-field">
                <span>Adresse du chantier</span>
                <input type="text" value={address.address} onChange={(e) => setAddress((c) => ({ ...c, address: e.target.value }))} />
              </label>
            )}

            <p className="radar-recap-note">Vous pouvez relancer l'expertise autant de fois que vous voulez pour comparer. La publication reste gratuite et illimitée.</p>

            {error ? <p className="profile-message error">{error}</p> : null}

            <button type="button" className="button secondary" style={{ width: "100%" }} onClick={launchExpertise}>
              <SparkleIcon />
              Relancer l'expertise
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
