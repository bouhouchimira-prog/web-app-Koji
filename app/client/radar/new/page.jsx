"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ClientTopbar } from "../../../../components/ClientTopbar";
import { RadarAddressAutocomplete } from "../../../../components/RadarAddressAutocomplete";
import { questionBankFor, GAMME_OPTIONS, ETAT_GENERAL_OPTIONS } from "../../../../lib/renovation-question-bank";

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

function PaperclipIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a5 5 0 01-7.07-7.07l9.19-9.19a3.5 3.5 0 014.95 4.95l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function nowTime() {
  return new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// Icones purement decoratives pour les choix rapides du chat (memes options
// que SLOTS dans app/api/radar-assistant/route.js, jamais modifiees ici) —
// habillage visuel seulement, aucune influence sur les reponses acceptees.
const OPTION_ICON = {
  "Avec fournitures": "📦",
  "Sans fournitures": "🚫",
  "Rez-de-chaussée": "🏠",
  "1er étage": "🏢",
  "2ème étage": "🏢",
  "3ème étage": "🏢",
  "4ème étage et plus": "🏙️",
  "Oui": "✅",
  "Non": "❌",
  "Facile": "🟢",
  "Escalier étroit": "🪜",
  "Accès compliqué": "🚧",
  "Stationnement facile": "🅿️",
  "Stationnement difficile": "🚧",
  "Moins de 3 m²": "📐",
  "3 à 5 m²": "📐",
  "5 à 10 m²": "📐",
  "Plus de 10 m²": "📐",
  "Rectangulaire": "▭",
  "Carrée": "⬜",
  "En longueur": "▬",
  "Forme atypique": "🔷",
  "Modifier la disposition": "🔀",
  "Garder la même disposition": "↔️",
  "À la charge de l'entreprise": "🧹",
  "Je m'en occupe moi-même": "🧼",
  "Déjà vide": "📭",
  "À vider avant travaux": "📦",
  "À protéger seulement": "🛡️",
  "Je ne sais pas": "🤷"
};
function optionIcon(option) {
  return OPTION_ICON[option] || "💬";
}

function readAsDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

// Ordre des phases de l'onglet "Offre IA", pour l'indicateur de
// progression (points) — la maquette d'Amira numerote chaque etape.
const IA_PHASES = ["hero", "chat", "equipements", "styles", "gamme", "etat-general", "travaux", "recap", "result"];

export default function NewRadarOffrePage() {
  const router = useRouter();
  const [mode, setMode] = useState("ia"); // ia | manuel
  const [phase, setPhase] = useState("hero"); // hero | chat | metier-loading | equipements | styles | gamme | etat-general | travaux | recap | loading | result
  const [metier, setMetier] = useState("");
  const [selectedEquipements, setSelectedEquipements] = useState(new Set());
  const [selectedStyle, setSelectedStyle] = useState("");
  const [selectedGamme, setSelectedGamme] = useState("");
  const [selectedEtatGeneral, setSelectedEtatGeneral] = useState("");
  const [travauxToggles, setTravauxToggles] = useState({});
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
  // Ecran "Visuels et photos" de la maquette : juste apres l'intro, avant la
  // toute premiere vraie question du garde-fou — purement cote client, la
  // vraie question (pendingFirstQuestion) est simplement mise en attente
  // puis revelee via continueAfterPhotos(), sans toucher a /api/radar-assistant.
  const [awaitingPhotoStep, setAwaitingPhotoStep] = useState(false);
  const [pendingFirstQuestion, setPendingFirstQuestion] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, sending]);

  function switchMode(next) {
    if (phase !== "form" && phase !== "hero") return;
    setMode(next);
    // "Saisie libre" n'a pas d'ecran d'accueil dedie — va directement au
    // formulaire ; "Offre IA" repasse par l'accueil si on y revient.
    setPhase(next === "manuel" ? "form" : "hero");
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
    const isIntroCall = !slotKey;
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
      if (data.answers) setExpertiseAnswers(data.answers);
      if (isIntroCall && data.type !== "ready_for_expertise") {
        // Ecran "Visuels et photos" de la maquette : la vraie premiere
        // question (data) est mise en attente, revelee par
        // continueAfterPhotos() une fois les photos ajoutees ou ignorees.
        setTurns([...nextTurns, {
          role: "assistant",
          text: "Parfait ! Pouvez-vous m'envoyer quelques photos ? Cela m'aide à mieux comprendre l'existant et à vous proposer une estimation plus fiable.",
          time: nowTime()
        }]);
        setPendingFirstQuestion(data);
        setAwaitingPhotoStep(true);
        setReadyMessage("");
        setCurrentOptions(null);
        setCurrentInputType("text");
        return;
      }
      setTurns([...nextTurns, { role: "assistant", text: data.message, time: nowTime() }]);
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

  // Ouvre directement la discussion (maquette d'Amira, ecran "Discussion
  // naturelle") : plus de formulaire description+photos intermediaire —
  // l'assistant koji ouvre la conversation, et la description du projet
  // devient le tout premier message du client, comme un vrai chat. Les
  // photos restent attachables a tout moment via le trombone de la barre
  // de saisie (etat `photos` deja lu telle quelle par /api/expertise-koji
  // et /api/chantier-offres, peu importe quand elles ont ete ajoutees).
  function openChat() {
    setError("");
    setPhotos([]);
    setPhase("chat");
    setTurns([{
      role: "assistant",
      text: "Bonjour ! 👋 Je suis koji, votre conseiller rénovation. Dites-moi, quel est votre projet ?",
      time: nowTime()
    }]);
    setCurrentOptions(null);
    setCurrentInputType("text");
    setReadyMessage("");
    setSlotKey(null);
    setExpertiseAnswers({});
    setAwaitingPhotoStep(false);
    setPendingFirstQuestion(null);
  }

  // Revele la vraie premiere question du garde-fou, mise en attente par
  // sendTurn() le temps de l'ecran "Visuels et photos" — les photos deja
  // ajoutees (ou non) restent dans `photos`, lues telles quelles plus tard.
  function continueAfterPhotos() {
    if (!pendingFirstQuestion) return;
    const data = pendingFirstQuestion;
    setTurns((current) => [...current, { role: "assistant", text: data.message, time: nowTime() }]);
    setCurrentOptions(data.options || null);
    setCurrentInputType(data.inputType || "text");
    setSlotKey(data.slotKey || null);
    setAwaitingPhotoStep(false);
    setPendingFirstQuestion(null);
  }

  // Permet de repondre par texte a l'ecran "Visuels et photos" (ex: "je n'ai
  // pas de photos") au lieu d'y rester bloque avec seulement un depot de
  // fichiers — accuse reception puis enchaine sur la vraie question mise en
  // attente, comme un tour de chat normal. La note est gardee (photoNote)
  // et transmise a l'expertise, au cas ou elle contienne une precision utile.
  function submitPhotoNote(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setTurns((current) => [
      ...current,
      { role: "user", text, time: nowTime() },
      { role: "assistant", text: "Pas de problème, on continue !", time: nowTime() }
    ]);
    setExpertiseAnswers((current) => ({ ...current, photoNote: text }));
    continueAfterPhotos();
  }

  function answerText(text) {
    if (!text.trim() || sending || readyMessage) return;
    const nextTurns = [...turns, { role: "user", text: text.trim(), time: nowTime() }];
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

  // Une fois la conversation /api/radar-assistant terminee (onglet "Offre
  // IA"), determine le metier principal (petite classification dediee,
  // /api/classify-metier — jamais utilisee pour inventer un prix, juste
  // pour choisir le bon jeu de cartes equipements/styles/travaux) puis
  // enchaine sur les nouvelles etapes visuelles avant l'estimation.
  async function startEnrichment() {
    setPhase("metier-loading");
    setError("");
    try {
      const response = await fetch("/api/classify-metier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: expertiseAnswers.intro || description })
      });
      const data = await response.json();
      const detectedMetier = data.metier || "Tout corps d'état";
      setMetier(detectedMetier);
      const bank = questionBankFor(detectedMetier);
      setTravauxToggles(Object.fromEntries(bank.travaux.map((t) => [t.id, true])));
      setSelectedEquipements(new Set());
      setSelectedStyle("");
      setSelectedGamme("");
      setSelectedEtatGeneral("");
      setPhase("equipements");
    } catch {
      // Jamais bloquant : sans metier detecte, on part sur le jeu generique
      // et on continue quand meme.
      setMetier("Tout corps d'état");
      const bank = questionBankFor("Tout corps d'état");
      setTravauxToggles(Object.fromEntries(bank.travaux.map((t) => [t.id, true])));
      setPhase("equipements");
    }
  }

  function toggleEquipement(id) {
    setSelectedEquipements((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleTravail(id) {
    setTravauxToggles((current) => ({ ...current, [id]: !current[id] }));
  }

  // Valide le recapitulatif : fusionne equipements/style/travaux dans les
  // reponses avant de lancer l'expertise — passe l'objet directement a
  // launchExpertise plutot que de compter sur expertiseAnswers (setState
  // est asynchrone, la valeur en state ne serait pas encore a jour).
  function confirmRecap() {
    const bank = questionBankFor(metier);
    const equipements = bank.equipements.filter((e) => selectedEquipements.has(e.id)).map((e) => e.label).join(", ");
    const style = bank.styles.find((s) => s.id === selectedStyle)?.label || "";
    const gamme = GAMME_OPTIONS.find((g) => g.id === selectedGamme)?.label || "";
    const etatGeneral = ETAT_GENERAL_OPTIONS.find((e) => e.id === selectedEtatGeneral)?.label || "";
    const travauxDetail = bank.travaux.filter((t) => travauxToggles[t.id]).map((t) => t.label).join(", ");
    const enriched = { ...expertiseAnswers, metier, equipements, style, gamme, etatGeneral, travauxDetail };
    setExpertiseAnswers(enriched);
    launchExpertise(enriched);
  }

  async function launchExpertise(overrideAnswers) {
    const answers = mode === "ia"
      ? (overrideAnswers || expertiseAnswers)
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
      setPhase(mode === "ia" ? "recap" : "form");
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
    setPhase(mode === "ia" ? "hero" : "form");
    setExpertise(null);
    setSelectedConseils(new Set());
    setError("");
    setTurns([]);
    setReadyMessage("");
    setCurrentOptions(null);
    setSlotKey(null);
    setExpertiseAnswers({});
    setMetier("");
    setSelectedEquipements(new Set());
    setSelectedStyle("");
    setSelectedGamme("");
    setSelectedEtatGeneral("");
    setTravauxToggles({});
    setPhotos([]);
    setAwaitingPhotoStep(false);
    setPendingFirstQuestion(null);
  }

  const range = phase === "result" ? adjustedRange() : null;
  const bank = metier ? questionBankFor(metier) : null;
  const iaStepIndex = IA_PHASES.indexOf(phase);

  return (
    <main className="client-space">
      <ClientTopbar showBack backHref="/client/radar" />

      <div className="ct-welcome">
        <strong>Créer une offre</strong>
        <small>Saisie manuelle ou assistée par IA.</small>
      </div>

      {phase === "form" || phase === "hero" ? (
        <section className="radar-mode-tabs">
          <button type="button" className={`radar-mode-tab ${mode === "ia" ? "active" : ""}`} onClick={() => switchMode("ia")}>
            {mode === "ia" ? <span className="radar-mode-tab-check"><CheckIcon /></span> : null}
            <span className="radar-mode-tab-icon ia"><SparkleIcon /></span>
            <div>
              <strong>Offre IA</strong>
              <small>Description + photos, puis quelques questions</small>
            </div>
          </button>
          <button type="button" className={`radar-mode-tab ${mode === "manuel" ? "active" : ""}`} onClick={() => switchMode("manuel")}>
            {mode === "manuel" ? <span className="radar-mode-tab-check"><CheckIcon /></span> : null}
            <span className="radar-mode-tab-icon manuel"><PencilIcon /></span>
            <div>
              <strong>Saisie libre</strong>
              <small>Tous les champs vous-même</small>
            </div>
          </button>
        </section>
      ) : null}

      {mode === "ia" && iaStepIndex > 0 && phase !== "loading" && phase !== "result" ? (
        <div className="radar-progress-dots" aria-hidden="true">
          {IA_PHASES.slice(1, -1).map((step) => (
            <span key={step} className={`radar-progress-dot ${IA_PHASES.indexOf(step) <= iaStepIndex ? "done" : ""}`} />
          ))}
        </div>
      ) : null}

      <section className="radar-form-card radar-form-card-flush">
        {phase === "hero" && mode === "ia" ? (
          <div className="radar-hero-screen">
            <span className="radar-hero-screen-badge" aria-hidden="true"><SparkleIcon /></span>
            <p className="radar-hero-screen-eyebrow">MARKETPLACE BTP</p>
            <h1>Votre projet, <em>simplement.</em></h1>
            <p className="radar-hero-screen-sub">
              Décrivez votre projet à l'assistant koji, ajoutez des photos, répondez à quelques questions — votre offre est ensuite publiée aux entreprises du BTP près de chez vous.
            </p>
            <button type="button" className="radar-hero-screen-btn" onClick={openChat}>
              Démarrer mon projet <span aria-hidden="true">→</span>
            </button>
            <div className="radar-hero-screen-trust">
              <span>✓ 100% gratuit</span>
              <span>✓ Sans engagement</span>
              <span>✓ Entreprises du BTP vérifiées</span>
            </div>
          </div>
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
                <div key={index} className={`radar-chat-row ${t.role === "user" ? "user" : "assistant"}`}>
                  {t.role === "assistant" ? <span className="radar-chat-avatar"><img src="/koji-logo.svg" alt="" /></span> : null}
                  <div className="radar-chat-bubble-wrap">
                    <div className={`radar-chat-bubble ${t.role === "user" ? "user" : "assistant"}`}>
                      <p>{t.text}</p>
                    </div>
                    <span className="radar-chat-meta">
                      {t.time}
                      {t.role === "user" ? <CheckIcon /> : null}
                    </span>
                  </div>
                </div>
              ))}
              {sending ? (
                <div className="radar-chat-row assistant">
                  <span className="radar-chat-avatar"><img src="/koji-logo.svg" alt="" /></span>
                  <div className="radar-chat-bubble-wrap">
                    <div className="radar-chat-bubble assistant radar-chat-typing">
                      <span className="radar-chat-dot" /><span className="radar-chat-dot" /><span className="radar-chat-dot" />
                    </div>
                  </div>
                </div>
              ) : null}
              <div ref={messagesEndRef} />
            </div>

            {error ? <p className="profile-message error">{error}</p> : null}

            {photos.length > 0 ? (
              <div className="radar-photo-grid">
                {photos.map((photo, index) => (
                  <div className="radar-photo-thumb" key={index}>
                    <img src={photo} alt={`Photo ${index + 1}`} />
                    <button type="button" onClick={() => removePhoto(index)} aria-label="Retirer la photo">×</button>
                  </div>
                ))}
              </div>
            ) : null}

            {readyMessage ? (
              <button type="button" className="radar-generate-btn" onClick={startEnrichment}>
                <SparkleIcon />
                Continuer
              </button>
            ) : awaitingPhotoStep ? (
              <div className="radar-photo-step">
                <label className="radar-dropzone radar-dropzone-compact">
                  <input type="file" accept="image/*" multiple onChange={onPhotosChange} hidden />
                  <UploadIcon />
                  <strong>Ajouter des photos</strong>
                  <span>Optionnel — jusqu'à 8 photos, ça aide à affiner l'estimation</span>
                </label>
                <form className="radar-chat-form" onSubmit={submitPhotoNote}>
                  <label className="radar-chat-attach" title="Ajouter une photo">
                    <input type="file" accept="image/*" multiple onChange={onPhotosChange} hidden />
                    <PaperclipIcon />
                  </label>
                  <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Pas de photo ? Dites-le-moi, ou ajoutez une note…" />
                  <button type="submit" className="radar-chat-send" disabled={!draft.trim()} aria-label="Envoyer">
                    <SendIcon />
                  </button>
                </form>
                <button type="button" className="button secondary" onClick={continueAfterPhotos}>
                  Continuer sans note <span aria-hidden="true">→</span>
                </button>
              </div>
            ) : currentInputType === "address" ? (
              <RadarAddressAutocomplete value={addressDraft} onChange={setAddressDraft} onSelect={selectAddress} onManualSubmit={submitManualAddress} />
            ) : currentOptions && currentOptions.length > 0 ? (
              <div className="radar-choice-grid">
                {currentOptions.map((option) => (
                  <button key={option} type="button" className="radar-choice-card" disabled={sending} onClick={() => answerText(option)}>
                    <span className="radar-choice-card-icon">{optionIcon(option)}</span>
                    <span className="radar-choice-card-label">{option}</span>
                  </button>
                ))}
              </div>
            ) : (
              <form className="radar-chat-form" onSubmit={handleChatSubmit}>
                <label className="radar-chat-attach" title="Ajouter une photo">
                  <input type="file" accept="image/*" multiple onChange={onPhotosChange} hidden />
                  <PaperclipIcon />
                </label>
                <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Écrivez votre réponse…" disabled={sending} />
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

        {phase === "metier-loading" ? (
          <div className="radar-expertise-loading">
            <div className="radar-expertise-spinner" />
            <strong>Identification du métier concerné…</strong>
            <p>Pour vous proposer les bons choix d'équipements et de finitions.</p>
          </div>
        ) : null}

        {phase === "equipements" && bank ? (
          <div className="radar-field radar-form-card-pad">
            <div className="radar-step-header">
              <span className="radar-step-icon"><SparkleIcon /></span>
              <div>
                <h3>Quels équipements souhaitez-vous ?</h3>
                <p>Plusieurs choix possibles — {metier}.</p>
              </div>
            </div>
            <div className="radar-choice-grid">
              {bank.equipements.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`radar-choice-card ${selectedEquipements.has(item.id) ? "selected" : ""}`}
                  onClick={() => toggleEquipement(item.id)}
                >
                  {selectedEquipements.has(item.id) ? <span className="radar-choice-card-check"><CheckIcon /></span> : null}
                  <span className="radar-choice-card-icon">{item.icon}</span>
                  <span className="radar-choice-card-label">{item.label}</span>
                </button>
              ))}
            </div>
            <button type="button" className="radar-generate-btn" onClick={() => setPhase("styles")}>
              Continuer <span aria-hidden="true">→</span>
            </button>
          </div>
        ) : null}

        {phase === "styles" && bank ? (
          <div className="radar-field radar-form-card-pad">
            <div className="radar-step-header">
              <span className="radar-step-icon"><SparkleIcon /></span>
              <div>
                <h3>Quel style vous plaît le plus ?</h3>
                <p>Un seul choix — {metier}.</p>
              </div>
            </div>
            <div className="radar-choice-grid">
              {bank.styles.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`radar-choice-card ${selectedStyle === item.id ? "selected" : ""}`}
                  onClick={() => setSelectedStyle(item.id)}
                >
                  {selectedStyle === item.id ? <span className="radar-choice-card-check"><CheckIcon /></span> : null}
                  <span className="radar-choice-card-icon">{item.icon}</span>
                  <span className="radar-choice-card-label">{item.label}</span>
                </button>
              ))}
            </div>
            <div className="radar-wizard-nav">
              <button type="button" className="button secondary" onClick={() => setPhase("equipements")}>Retour</button>
              <button type="button" className="radar-generate-btn" onClick={() => setPhase("gamme")}>
                Continuer <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        ) : null}

        {phase === "gamme" ? (
          <div className="radar-field radar-form-card-pad">
            <div className="radar-step-header">
              <span className="radar-step-icon"><SparkleIcon /></span>
              <div>
                <h3>Quel niveau de gamme souhaitez-vous ?</h3>
                <p>Cela influence les matériaux et équipements retenus pour l'estimation.</p>
              </div>
            </div>
            <div className="radar-choice-grid">
              {GAMME_OPTIONS.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`radar-choice-card ${selectedGamme === item.id ? "selected" : ""}`}
                  onClick={() => setSelectedGamme(item.id)}
                >
                  {selectedGamme === item.id ? <span className="radar-choice-card-check"><CheckIcon /></span> : null}
                  <span className="radar-choice-card-icon">{item.icon}</span>
                  <span className="radar-choice-card-label">{item.label}</span>
                </button>
              ))}
            </div>
            <div className="radar-wizard-nav">
              <button type="button" className="button secondary" onClick={() => setPhase("styles")}>Retour</button>
              <button type="button" className="radar-generate-btn" onClick={() => setPhase("etat-general")}>
                Continuer <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        ) : null}

        {phase === "etat-general" ? (
          <div className="radar-field radar-form-card-pad">
            <div className="radar-step-header">
              <span className="radar-step-icon"><SparkleIcon /></span>
              <div>
                <h3>Quel est l'état actuel de la pièce ?</h3>
                <p>Cela détermine l'ampleur des travaux à prévoir.</p>
              </div>
            </div>
            <div className="radar-choice-grid">
              {ETAT_GENERAL_OPTIONS.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`radar-choice-card ${selectedEtatGeneral === item.id ? "selected" : ""}`}
                  onClick={() => setSelectedEtatGeneral(item.id)}
                >
                  {selectedEtatGeneral === item.id ? <span className="radar-choice-card-check"><CheckIcon /></span> : null}
                  <span className="radar-choice-card-icon">{item.icon}</span>
                  <span className="radar-choice-card-label">{item.label}</span>
                  <span className="radar-choice-card-hint">{item.hint}</span>
                </button>
              ))}
            </div>
            <div className="radar-wizard-nav">
              <button type="button" className="button secondary" onClick={() => setPhase("gamme")}>Retour</button>
              <button type="button" className="radar-generate-btn" onClick={() => setPhase("travaux")}>
                Continuer <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        ) : null}

        {phase === "travaux" && bank ? (
          <div className="radar-field radar-form-card-pad">
            <div className="radar-step-header">
              <span className="radar-step-icon"><SparkleIcon /></span>
              <div>
                <h3>Quels travaux souhaitez-vous réaliser ?</h3>
                <p>Décochez ce qui ne s'applique pas à votre projet.</p>
              </div>
            </div>
            <div className="radar-toggle-list">
              {bank.travaux.map((item) => (
                <label key={item.id} className="radar-toggle-row">
                  <span>{item.label}</span>
                  <input type="checkbox" checked={Boolean(travauxToggles[item.id])} onChange={() => toggleTravail(item.id)} className="radar-toggle-switch" />
                </label>
              ))}
            </div>
            <div className="radar-wizard-nav">
              <button type="button" className="button secondary" onClick={() => setPhase("etat-general")}>Retour</button>
              <button type="button" className="radar-generate-btn" onClick={() => setPhase("recap")}>
                Continuer <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        ) : null}

        {phase === "recap" && bank ? (
          <div className="radar-field radar-form-card-pad">
            <div className="radar-step-header">
              <span className="radar-step-icon"><SparkleIcon /></span>
              <div>
                <h3>Voici le récapitulatif de votre projet</h3>
                <p>Vérifiez que tout est correct avant l'estimation.</p>
              </div>
            </div>
            <div className="radar-recap-card">
              <div className="radar-recap-row"><span>📝 Description</span><strong>{expertiseAnswers.intro}</strong></div>
              <div className="radar-recap-row"><span>🔧 Métier</span><strong>{metier}</strong></div>
              {expertiseAnswers.adresse ? <div className="radar-recap-row"><span>📍 Adresse</span><strong>{expertiseAnswers.adresse}</strong></div> : null}
              {expertiseAnswers.cotes ? <div className="radar-recap-row"><span>📐 Surface</span><strong>{expertiseAnswers.cotes}</strong></div> : null}
              {expertiseAnswers.configuration ? <div className="radar-recap-row"><span>🔷 Configuration</span><strong>{expertiseAnswers.configuration}</strong></div> : null}
              {expertiseAnswers.disposition ? <div className="radar-recap-row"><span>🔀 Disposition</span><strong>{expertiseAnswers.disposition}</strong></div> : null}
              {expertiseAnswers.etage ? <div className="radar-recap-row"><span>🏢 Étage</span><strong>{expertiseAnswers.etage}{expertiseAnswers.ascenseur ? ` · Ascenseur : ${expertiseAnswers.ascenseur}` : ""}</strong></div> : null}
              {expertiseAnswers.acces ? <div className="radar-recap-row"><span>🚪 Accès</span><strong>{expertiseAnswers.acces}</strong></div> : null}
              {expertiseAnswers.stationnement ? <div className="radar-recap-row"><span>🅿️ Stationnement</span><strong>{expertiseAnswers.stationnement}</strong></div> : null}
              {selectedEtatGeneral ? (
                <div className="radar-recap-row"><span>🏠 État actuel</span><strong>{ETAT_GENERAL_OPTIONS.find((e) => e.id === selectedEtatGeneral)?.label}</strong></div>
              ) : null}
              {selectedEquipements.size > 0 ? (
                <div className="radar-recap-row"><span>🛁 Équipements</span><strong>{bank.equipements.filter((e) => selectedEquipements.has(e.id)).map((e) => e.label).join(", ")}</strong></div>
              ) : null}
              {selectedStyle ? (
                <div className="radar-recap-row"><span>🎨 Style</span><strong>{bank.styles.find((s) => s.id === selectedStyle)?.label}</strong></div>
              ) : null}
              {selectedGamme ? (
                <div className="radar-recap-row"><span>💳 Gamme</span><strong>{GAMME_OPTIONS.find((g) => g.id === selectedGamme)?.label}</strong></div>
              ) : null}
              <div className="radar-recap-row"><span>🔨 Travaux</span><strong>{bank.travaux.filter((t) => travauxToggles[t.id]).map((t) => t.label).join(", ") || "—"}</strong></div>
              <div className="radar-recap-row"><span>📷 Photos</span><strong>{photos.length > 0 ? `${photos.length} photo${photos.length > 1 ? "s" : ""} ajoutée${photos.length > 1 ? "s" : ""}` : "Aucune"}</strong></div>
            </div>
            {error ? <p className="profile-message error">{error}</p> : null}
            <div className="radar-wizard-nav">
              <button type="button" className="button secondary" onClick={() => setPhase("equipements")}>Modifier quelque chose</button>
              <button type="button" className="radar-generate-btn" onClick={confirmRecap}>
                C'est correct <span aria-hidden="true">→</span>
              </button>
            </div>
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

            <button type="button" className="radar-generate-btn" onClick={() => launchExpertise()}>
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

            <button type="button" className="button secondary" style={{ width: "100%" }} onClick={() => launchExpertise()}>
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

            <div className="radar-next-steps">
              <span className="radar-next-steps-title">Prochaines étapes</span>
              <ol>
                <li>Votre devis estimatif est prêt</li>
                <li>Publiez-le sur le Marketplace Koji</li>
                <li>Les entreprises du BTP près de chez vous répondent</li>
                <li>Vous choisissez l'entreprise qui vous convient</li>
              </ol>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
