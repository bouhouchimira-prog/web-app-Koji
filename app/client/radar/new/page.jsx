"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ClientTopbar } from "../../../../components/ClientTopbar";

// Parcours de creation d'offre — refonte du 23 septembre : meme moteur que
// depuis le 4 septembre (photos + texte libre, puis l'assistant koji en chat
// une question a la fois via /api/radar-assistant, puis /api/expertise-koji
// fixe une fourchette de prix — jamais de budget demande au client, jamais
// de devis interne montre, jamais d'estimation affichee avant la fin), mais
// habille en deroule d'etapes (gauche) + assistant koji permanent (droite),
// au lieu d'un ecran qui remplace tout son contenu a chaque phase. Le fil de
// discussion est desormais toujours monte des l'arrivee sur la page — la
// question "quel type de travaux ?" (ancien <textarea> separe) est devenue
// le tout premier message affiche par l'assistant dans ce meme panneau.

const STEPS = ["Photos du chantier", "Adresse", "Dimensions", "Fournitures", "Accès & état", "Estimation"];

const GREETING = "Quel type de travaux souhaitez-vous réaliser ? Décrivez-les en quelques mots — vous pouvez aussi ajouter des photos à gauche.";

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

// Peut etre confirmee de deux facons : cliquer une suggestion BAN (adresse
// geocodee, avec lat/lon pour le matching geographique des entreprises), ou
// taper l'adresse a la main et valider avec Entree/le bouton d'envoi si
// aucune suggestion ne correspond — sans ca, un client qui tape une adresse
// precise sans jamais cliquer de suggestion reste bloque sans aucun moyen de
// continuer (bug remonte le 7 septembre).
function AddressAutocomplete({ value, onChange, onSelect, onManualSubmit }) {
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

  function handleSubmit(event) {
    event.preventDefault();
    if (!value.trim()) return;
    onManualSubmit(value.trim());
    setSuggestions([]);
  }

  return (
    <label className="radar-field radar-address-field">
      <form className="address-autocomplete-row" onSubmit={handleSubmit}>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Numéro, rue, ville, code postal"
          autoComplete="off"
          autoFocus
        />
        <button type="submit" className="radar-chat-send" disabled={!value.trim()} aria-label="Valider cette adresse">
          <SendIcon />
        </button>
      </form>
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
  const [phase, setPhase] = useState("gathering"); // gathering | expertise-loading | expertise-result
  const [stepIndex, setStepIndex] = useState(0);
  const [photos, setPhotos] = useState([]);
  const [turns, setTurns] = useState([{ role: "assistant", text: GREETING, local: true }]);
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

  const hasStarted = turns.some((t) => t.role === "user");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, sending]);

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
    // Le message d'accueil (GREETING) est purement local/affichage — jamais
    // envoye a /api/radar-assistant, qui ne l'a jamais connu et reste
    // stateless sur la vraie conversation (meme contrat qu'avant le 23
    // septembre, ou le premier appel n'envoyait jamais qu'un seul tour
    // "user").
    const apiTurns = nextTurns.filter((t) => !t.local);
    try {
      const response = await fetch("/api/radar-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turns: apiTurns.map(({ role, text }) => ({ role, text })),
          photos: apiTurns.filter((t) => t.role === "user").length === 1 ? photos : undefined,
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
        setStepIndex(5);
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

  // Adresse tapee a la main, validee sans avoir clique de suggestion BAN —
  // pas de lat/lon dans ce cas (le matching geographique par zone sera
  // moins precis pour cette offre), mais au moins le client n'est jamais
  // bloque.
  function submitManualAddress(text) {
    setAddress({ address: text, city: "", postalCode: "", lat: null, lon: null });
    setAddressDraft("");
    answerText(text);
  }

  async function launchExpertise() {
    setPhase("expertise-loading");
    setStepIndex(5);
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
      setPhase("gathering");
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

  // "Recommencer" reste une action a part, clairement distincte de
  // Retour/Continuer (qui ne font eux que naviguer entre les etapes sans
  // rien effacer) — repart a zero comme avant.
  function restart() {
    if (sending) return;
    setPhase("gathering");
    setStepIndex(0);
    setTurns([{ role: "assistant", text: GREETING, local: true }]);
    setError("");
    setCurrentOptions(null);
    setReadyMessage("");
    setSlotKey(null);
    setExpertiseAnswers({});
    setPhotos([]);
    setAddress({ address: "", city: "", postalCode: "", lat: null, lon: null });
    setAddressDraft("");
    setExpertise(null);
  }

  const range = phase === "expertise-result" ? adjustedRange() : null;
  const introTypeText = turns.find((t) => t.role === "user")?.text || "";

  function goToStep(index) {
    setStepIndex(Math.max(0, Math.min(STEPS.length - 1, index)));
  }

  return (
    <main className="client-space">
      <ClientTopbar showBack backHref="/client/radar" />

      <div className="ct-welcome">
        <strong>Publier une offre</strong>
      </div>

      <div className="radar-wizard">
        <section className="radar-form-card radar-wizard-main">
          <div className="radar-wizard-steps-header">
            <div className="radar-wizard-steps-title">
              <strong>Publier une offre</strong>
              <span>Étape {stepIndex + 1} sur {STEPS.length}</span>
            </div>
            <div className="radar-wizard-progress">
              {STEPS.map((label, index) => (
                <span key={label} className={`radar-wizard-progress-seg ${index <= stepIndex ? "done" : ""} ${index === stepIndex ? "active" : ""}`} />
              ))}
            </div>
          </div>

          <div className="radar-wizard-step-body">
            {stepIndex === 0 ? (
              <div className="radar-field">
                <div className="radar-step-header">
                  <span className="radar-step-icon"><UploadIcon /></span>
                  <div>
                    <h3>Photos du chantier</h3>
                    <p>Ajoutez une ou plusieurs photos de la pièce ou de la zone concernée.</p>
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
                <p className="radar-wizard-step-hint">Facultatif — vous pouvez continuer et discuter avec l'assistant koji à droite.</p>
              </div>
            ) : null}

            {stepIndex === 1 ? (
              <div className="radar-field radar-wizard-recap-step">
                <div className="radar-step-header">
                  <span className="radar-step-icon"><PinIcon /></span>
                  <div><h3>Adresse du chantier</h3><p>Renseignée via l'assistant koji, à droite.</p></div>
                </div>
                {address.address ? (
                  <p className="radar-wizard-recap-value">{address.address}</p>
                ) : (
                  <p className="radar-wizard-recap-empty">En attente — répondez à l'assistant koji →</p>
                )}
              </div>
            ) : null}

            {stepIndex === 2 ? (
              <div className="radar-field radar-wizard-recap-step">
                <div className="radar-step-header">
                  <span className="radar-step-icon"><SparkleIcon /></span>
                  <div><h3>Dimensions</h3><p>Renseignées via l'assistant koji, à droite.</p></div>
                </div>
                {expertiseAnswers.cotes ? (
                  <p className="radar-wizard-recap-value">{expertiseAnswers.cotes}</p>
                ) : (
                  <p className="radar-wizard-recap-empty">En attente — répondez à l'assistant koji →</p>
                )}
              </div>
            ) : null}

            {stepIndex === 3 ? (
              <div className="radar-field radar-wizard-recap-step">
                <div className="radar-step-header">
                  <span className="radar-step-icon"><SparkleIcon /></span>
                  <div><h3>Fournitures</h3><p>Renseignées via l'assistant koji, à droite.</p></div>
                </div>
                {expertiseAnswers.fournitures ? (
                  <p className="radar-wizard-recap-value">{expertiseAnswers.fournitures}</p>
                ) : (
                  <p className="radar-wizard-recap-empty">En attente — répondez à l'assistant koji →</p>
                )}
              </div>
            ) : null}

            {stepIndex === 4 ? (
              <div className="radar-field radar-wizard-recap-step">
                <div className="radar-step-header">
                  <span className="radar-step-icon"><SparkleIcon /></span>
                  <div><h3>Accès & état</h3><p>Renseignés via l'assistant koji, à droite.</p></div>
                </div>
                {expertiseAnswers.acces ? <p className="radar-wizard-recap-value">Accès : {expertiseAnswers.acces}</p> : <p className="radar-wizard-recap-empty">En attente — répondez à l'assistant koji →</p>}
                {expertiseAnswers.etat ? <p className="radar-wizard-recap-value">État : {expertiseAnswers.etat}</p> : null}
              </div>
            ) : null}

            {stepIndex === 5 ? (
              <div className="radar-field">
                {phase === "expertise-loading" ? (
                  <div className="radar-expertise-loading">
                    <div className="radar-expertise-spinner" />
                    <strong>Un architecte koji analyse votre projet…</strong>
                    <p>Chiffrage à partir de la bibliothèque de prix koji, ça ne prend que quelques instants.</p>
                  </div>
                ) : null}

                {phase === "expertise-result" && expertise ? (
                  <>
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
                        <AddressAutocomplete value={addressDraft} onChange={setAddressDraft} onSelect={selectAddress} onManualSubmit={submitManualAddress} />
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
                  </>
                ) : null}

                {phase === "gathering" ? (
                  readyMessage ? (
                    <button type="button" className="button blue" style={{ width: "100%" }} onClick={launchExpertise}>
                      <SparkleIcon />
                      Lancer l'expertise
                    </button>
                  ) : (
                    <p className="radar-wizard-recap-empty">Terminez la discussion avec l'assistant koji pour lancer l'estimation.</p>
                  )
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="radar-wizard-nav">
            <button type="button" className="button secondary" onClick={() => goToStep(stepIndex - 1)} disabled={stepIndex === 0}>
              <ArrowLeftIcon />
              Retour
            </button>
            <button type="button" className="button blue" onClick={() => goToStep(stepIndex + 1)} disabled={stepIndex === STEPS.length - 1}>
              Continuer
            </button>
          </div>
        </section>

        <aside className="radar-assistant-card radar-wizard-assistant">
          <div className="radar-chat-header">
            <span className="radar-chat-header-icon"><ChatIcon /></span>
            <div>
              <strong>Assistant koji</strong>
              <small>Vous guide en quelques questions</small>
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

          {(address.address || expertiseAnswers.cotes || introTypeText || expertise) ? (
            <div className="radar-wizard-summary-card">
              <span className="radar-wizard-summary-title">Voici un résumé — vous pouvez tout modifier :</span>
              <dl className="radar-wizard-summary-fields">
                {introTypeText ? (<><dt>Type</dt><dd>{introTypeText}</dd></>) : null}
                {expertiseAnswers.cotes ? (<><dt>Dimensions</dt><dd>{expertiseAnswers.cotes}</dd></>) : null}
                {address.address ? (<><dt>Adresse</dt><dd>{address.address}</dd></>) : null}
                {phase === "expertise-loading" ? (<><dt>Estimation</dt><dd>En cours d'analyse…</dd></>) : null}
                {phase === "expertise-result" && expertise && range ? (<><dt>Estimation</dt><dd>{range.min.toLocaleString("fr-FR")} € – {range.max.toLocaleString("fr-FR")} €</dd></>) : null}
              </dl>
              {phase === "expertise-result" ? <span className="radar-wizard-summary-disclaimer">Estimation indicative, non engageante.</span> : null}
            </div>
          ) : null}

          {error ? <p className="profile-message error">{error}</p> : null}

          {phase !== "gathering" ? null : readyMessage ? null : currentInputType === "address" ? (
            <AddressAutocomplete value={addressDraft} onChange={setAddressDraft} onSelect={selectAddress} onManualSubmit={submitManualAddress} />
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

          {hasStarted ? (
            <button type="button" className="button secondary radar-wizard-restart" onClick={restart} disabled={sending}>
              <ArrowLeftIcon />
              Recommencer
            </button>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
