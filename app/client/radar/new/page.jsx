"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ClientTopbar } from "../../../../components/ClientTopbar";
import { RadarAddressAutocomplete } from "../../../../components/RadarAddressAutocomplete";
import { normesFor } from "../../../../lib/renovation-question-bank";
import ChoiceList from "../../../../components/ChoiceList";

// Creer une offre — deux onglets ("Offre IA" / "Saisie libre").
//
// v4 (12 oct) : l'onglet "Offre IA" ne passe plus par un parcours en etapes
// (questions fixes puis 6 ecrans de formulaire separes — equipements, style,
// etat general, travaux, precisions, recap). Le chat (app/api/radar-chat,
// moteur 100% IA avec tool use, meme moteur que app/client/radar/new-chat/
// page.jsx) pose lui-meme toutes les questions necessaires — y compris
// celles que les anciens ecrans posaient — puis enchaine DIRECTEMENT sur le
// recapitulatif existant, inchange, une fois terminer_collecte appelee.
// Toujours /api/expertise-koji pour la fourchette de prix, /api/chantier-
// offres pour la publication — jamais de budget demande au client, jamais de
// devis interne montre, jamais d'estimation avant que le client ne la demande.

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
function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8a2 2 0 012-2h1l1.5-2h7L17 6h1a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V8z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}
function GalleryIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="M21 16l-5.5-5.5L5 21" />
    </svg>
  );
}

function nowTime() {
  return new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// Avant un evenement "choice"/"photo-request", le texte deja diffuse en
// direct (liveText) peut soit redire la meme question (redondant, a
// supprimer), soit etre un vrai accuse de reception/une vraie proposition de
// l'IA (ex: "je vous propose du grès cérame") — a GARDER dans la discussion.
// Remplace l'ancienne regle "supprime tout ce qui finit par un ?" (12 oct,
// bug remonte par Amira : une vraie proposition finissant par une question
// disparaissait completement) par une comparaison de mots partages avec la
// question/le sujet de l'outil — ne supprime que si c'est vraiment la meme
// chose reformulee.
function looksRedundantWithPrompt(ack, prompt) {
  if (!ack || !prompt) return false;
  const words = (s) => s
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);
  const ackWords = new Set(words(ack));
  const promptWords = new Set(words(prompt));
  if (ackWords.size === 0 || promptWords.size === 0) return false;
  let shared = 0;
  for (const w of ackWords) if (promptWords.has(w)) shared += 1;
  return shared / Math.min(ackWords.size, promptWords.size) >= 0.6;
}

// Marge de la fourchette de prix (1er oct) — doit rester identique a
// PRICE_RANGE_SPREAD cote serveur (lib/ai-devis-shape.js), utilisee ici
// uniquement pour recalculer la fourchette par lot (expertise.breakdown
// ne renvoie qu'un total par lot, pas deja une fourchette).
const PRICE_RANGE_SPREAD_CLIENT = 0.15;

function readAsDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

// Ordre des phases de l'onglet "Offre IA", pour l'indicateur de
// progression (points) — la maquette d'Amira numerote chaque etape.
const IA_PHASES = ["hero", "chat", "recap", "result"];

function getStoredUser() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("koji-user") || "null"); } catch { return null; }
}

export default function NewRadarOffrePage() {
  const router = useRouter();
  const [mode, setMode] = useState("ia"); // ia | manuel
  const [phase, setPhase] = useState("hero"); // hero | chat | recap | loading | result
  const [metier, setMetier] = useState("");
  const [photos, setPhotos] = useState([]);
  // Agrandissement d'une photo au clic (8 oct, demande d'Amira) — une seule
  // photo a la fois, affichee en grand dans une carte ouvrable par-dessus la
  // conversation ; null = fermee.
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  useEffect(() => {
    if (!lightboxPhoto) return;
    const onKeyDown = (e) => { if (e.key === "Escape") setLightboxPhoto(null); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxPhoto]);
  // Menu "prendre une photo / depuis la galerie" du trombone (12 oct,
  // demande d'Amira) — ferme au clic en dehors, meme principe que la
  // lightbox ci-dessus.
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const attachMenuRef = useRef(null);
  useEffect(() => {
    if (!attachMenuOpen) return;
    const onClickOutside = (e) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target)) setAttachMenuOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [attachMenuOpen]);
  const [description, setDescription] = useState("");
  const [surface, setSurface] = useState("");
  const [address, setAddress] = useState({ address: "", city: "", postalCode: "", lat: null, lon: null });
  const [addressDraft, setAddressDraft] = useState("");
  const [expertise, setExpertise] = useState(null);
  const [selectedConseils, setSelectedConseils] = useState(new Set());
  const [error, setError] = useState("");
  const [publishing, setPublishing] = useState(false);
  // Prix manquants (1er oct, demande d'Amira) : des que l'IA ne fait plus
  // confiance a son propre prix pour un poste hors catalogue, le particulier
  // peut en proposer un ici, directement sur l'ecran de resultat.
  const [missingPriceDrafts, setMissingPriceDrafts] = useState({});
  const [submittingPrices, setSubmittingPrices] = useState(false);
  // Detail de la fourchette par lot (1er oct, demande d'Amira : "le prix
  // soit cliquable et detaille, le total de chaque metier").
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Etat du nouveau chat 100% IA (12 oct, meme moteur que app/client/radar/
  // new-chat/page.jsx — voir sendToEngine plus bas) — plus de liste de
  // questions fixe cote client, Claude pilote la conversation lui-meme via
  // ses outils (lib/radar-assistant-tools.js) et le brouillon structure
  // (radar_offer_drafts) cote serveur.
  const [turns, setTurns] = useState([]);
  // Identifiant stable pour toute la conversation (2 oct, demande d'Amira :
  // enregistrer la conversation "en cas ou on rencontre un probleme",
  // consultable cote admin). Regenere a chaque nouvelle conversation
  // (openChat/restart) — voir logConversation plus bas.
  const [conversationId, setConversationId] = useState(() => `radarconv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [expertiseAnswers, setExpertiseAnswers] = useState({});
  // Question a choix en attente de reponse (10 oct, outil proposer_choix) —
  // affichee via <ChoiceList />, EN PLUS du champ de texte libre habituel,
  // jamais a sa place (le client garde toujours la possibilite de repondre
  // en texte).
  const [pendingChoice, setPendingChoice] = useState(null);
  // Demande de photo en attente (10 oct, outil demander_photo) — simple
  // bandeau au-dessus du formulaire, le trombone reste le seul moyen
  // d'envoyer une photo.
  const [pendingPhotoRequest, setPendingPhotoRequest] = useState(null);
  const draftIdRef = useRef("");
  const messagesEndRef = useRef(null);
  const bottomAnchorRef = useRef(null);

  // Scrolle vers le bas a chaque reponse — pas seulement la liste de bulles
  // (messagesEndRef, a l'interieur du conteneur a hauteur fixe), mais aussi
  // la page entiere jusqu'au bas du bloc interactif (bottomAnchorRef, APRES
  // la nouvelle question a choix / le composeur) (12 oct, bug remonte par
  // Amira : sans ca, la nouvelle question + ses options apparaissaient sous
  // la ligne de flottaison et la page semblait "remonter" a chaque reponse).
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    bottomAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, sending, pendingChoice, pendingPhotoRequest, streamingText]);

  // Pont avec un lien ?draftId= direct (ex: reprise d'une conversation) —
  // charge l'etat structure depuis radar_offer_drafts et saute directement
  // au recap. Meme chargeur que la fin de la conversation normale (voir
  // loadDraftIntoRecap plus bas, defini apres sendToEngine mais accessible
  // ici par hoisting de la declaration de fonction).
  const [loadingDraft, setLoadingDraft] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const draftId = new URLSearchParams(window.location.search).get("draftId");
    if (!draftId) return;
    setLoadingDraft(true);
    loadDraftIntoRecap(draftId)
      .catch(() => setError("Impossible de charger votre projet. Réessayez depuis le chat."))
      .finally(() => setLoadingDraft(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Enregistrement de la conversation (2 oct, demande d'Amira) — tache de
  // fond, jamais bloquant, erreurs ignorees : n'interfere jamais avec la
  // conversation garde-fou elle-meme si l'enregistrement echoue.
  function logConversation(allTurns, metier) {
    fetch("/api/radar-assistant/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId,
        turns: allTurns.map(({ role, text }) => ({ role, text })),
        metier: metier || expertiseAnswers.metier || ""
      })
    }).catch(() => {});
  }

  // Ouvre directement la discussion : l'assistant koji ouvre lui-meme la
  // conversation (accueil personnalise par prenom, voir isFirstMessage dans
  // lib/radar-chat-prompt.js), via un message "Bonjour" synthetique jamais
  // affiche cote client — seule la reponse de l'IA apparait. Les photos
  // restent attachables a tout moment via le trombone de la barre de saisie.
  function openChat() {
    setError("");
    setPhotos([]);
    setConversationId(`radarconv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    draftIdRef.current = "";
    setExpertiseAnswers({});
    setPendingChoice(null);
    setPendingPhotoRequest(null);
    setPhase("chat");
    setTurns([]);
    sendToEngine([{ role: "user", text: "Bonjour" }], []);
  }

  // Charge un brouillon termine (radar_offer_drafts) et saute directement au
  // recap — reutilise a la fois par le pont ?draftId= (lien direct) et par
  // la fin normale de la conversation (sendToEngine, evenement "done" avec
  // finished=true une fois terminer_collecte appelee cote serveur).
  async function loadDraftIntoRecap(id) {
    const response = await fetch(`/api/radar-chat/draft/${encodeURIComponent(id)}`);
    const body = await response.json();
    const data = body.draft?.data || {};
    setMetier(data.metier || "Tout corps d'état");
    setMode("ia");
    setExpertiseAnswers({ ...data, _needsRoomBreakdown: Array.isArray(data.rooms) && data.rooms.length > 0, _freeformSummary: true });
    if (Array.isArray(data.photos)) setPhotos(data.photos);
    setPhase("recap");
  }

  // Un tour de conversation avec le nouveau moteur 100% IA (app/api/radar-
  // chat — streaming SSE + tool use cote serveur, meme moteur que app/client/
  // radar/new-chat/page.jsx). Claude pose lui-meme la question suivante et
  // appelle ses outils (enregistrer_info/proposer_choix/demander_photo/
  // consulter_bibliotheque_prix/terminer_collecte) au fil de l'eau — plus
  // aucune liste de questions fixe ni garde-fou cote code ici.
  async function sendToEngine(nextTurns, photosForThisTurn) {
    setSending(true);
    setError("");
    setStreamingText("");
    setPendingPhotoRequest(null);
    const user = getStoredUser();
    const prenom = (user?.name || "").trim().split(/\s+/)[0] || "";

    try {
      const response = await fetch("/api/radar-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turns: nextTurns.map(({ role, text }) => ({ role, text })),
          conversationId,
          draftId: draftIdRef.current || undefined,
          photos: photosForThisTurn,
          prenom
        })
      });
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "L'assistant n'a pas pu répondre.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let liveText = "";
      let uiHandled = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() || "";
        for (const frame of frames) {
          const eventMatch = /event: (\w+)/.exec(frame);
          const dataMatch = /data: (.+)/.exec(frame);
          if (!eventMatch || !dataMatch) continue;
          const eventType = eventMatch[1];
          let data;
          try { data = JSON.parse(dataMatch[1]); } catch { continue; }

          if (eventType === "delta") {
            liveText += data.text;
            setStreamingText(liveText);
          } else if (eventType === "choice") {
            // Accuse de reception deja diffuse (s'il n'est pas une pure
            // redite de la question de l'outil) devient sa propre bulle
            // D'ABORD — jamais supprime pour la seule raison qu'il finit par
            // un "?" (bug remonte par Amira : une vraie proposition de l'IA
            // disparaissait) — puis la question de l'outil devient la
            // sienne ; les options s'affichent a part sous le composeur
            // habituel. Purge liveText pour ne pas le reafficher au "done".
            const ack = liveText.trim();
            const redundant = looksRedundantWithPrompt(ack, data.question || "");
            setTurns((current) => {
              const withAck = ack && !redundant ? [...current, { role: "assistant", text: ack, time: nowTime() }] : current;
              return data.question ? [...withAck, { role: "assistant", text: data.question, time: nowTime() }] : withAck;
            });
            liveText = "";
            uiHandled = true;
            setStreamingText("");
            setPendingChoice(data);
          } else if (eventType === "photo-request") {
            const ack = liveText.trim();
            if (ack && !looksRedundantWithPrompt(ack, data.sujet || "")) {
              setTurns((current) => [...current, { role: "assistant", text: ack, time: nowTime() }]);
            }
            liveText = "";
            uiHandled = true;
            setStreamingText("");
            setPendingPhotoRequest(data);
          } else if (eventType === "done") {
            draftIdRef.current = data.draftId;
            const finalMessage = uiHandled ? "" : (data.message || liveText || "").trim();
            // setTurns part d'un update FONCTIONNEL (current), jamais de
            // nextTurns ici — nextTurns contient le "Bonjour" synthetique du
            // demarrage automatique (jamais pousse dans l'etat visible par
            // openChat), le reintroduire via nextTurns l'aurait fait
            // apparaitre comme une vraie bulle (bug remonte par Amira,
            // visible uniquement sur le tout premier message).
            if (finalMessage) setTurns((current) => [...current, { role: "assistant", text: finalMessage, time: nowTime() }]);
            setStreamingText("");
            logConversation([...nextTurns, ...(finalMessage ? [{ role: "assistant", text: finalMessage }] : [])], expertiseAnswers.metier);
            if (data.finished) {
              loadDraftIntoRecap(data.draftId).catch(() => setError("Impossible de charger le récapitulatif. Réessayez."));
            }
          } else if (eventType === "error") {
            setError(data.message || "L'assistant n'a pas pu répondre.");
          }
        }
      }
    } catch (err) {
      setError(err.message || "L'assistant n'a pas pu répondre. Réessayez.");
    } finally {
      setSending(false);
    }
  }

  function answerText(text) {
    const trimmed = text.trim();
    if ((!trimmed && photos.length === 0) || sending) return;
    // Les photos jointes partent DANS la bulle du message envoye (8 oct,
    // demande d'Amira), jamais dans une liste a part.
    const userTurn = { role: "user", text: trimmed, time: nowTime() };
    if (photos.length > 0) userTurn.photos = photos;
    const nextTurns = [...turns, userTurn];
    setTurns(nextTurns);
    setDraft("");
    setPendingChoice(null);
    const photosForThisTurn = photos;
    setPhotos([]);
    sendToEngine(nextTurns, photosForThisTurn);
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
  }

  function submitManualAddress(text) {
    setAddress({ address: text, city: "", postalCode: "", lat: null, lon: null });
    setAddressDraft("");
  }

  // Geocode une adresse en texte libre (BAN, meme API que
  // RadarAddressAutocomplete) — le nouveau moteur de chat n'ayant plus de
  // garde-fou cote serveur dedie a l'adresse, c'est ici qu'on retrouve
  // ville/code postal/latitude-longitude, necessaires au matching
  // geographique des entreprises (/api/chantier-offres). Meme repli que la
  // saisie manuelle si rien ne correspond : l'adresse texte seule suffit a
  // continuer, juste sans coordonnees precises.
  async function geocodeAddressText(text) {
    const query = text.trim();
    const fallback = { address: text, city: "", postalCode: "", lat: null, lon: null };
    if (!query) return fallback;
    try {
      const response = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=1`);
      const data = await response.json();
      const feature = data.features?.[0];
      if (!feature) return fallback;
      const [lon, lat] = feature.geometry.coordinates;
      return {
        address: feature.properties.label,
        city: feature.properties.city || "",
        postalCode: feature.properties.postcode || "",
        lat, lon
      };
    } catch {
      return fallback;
    }
  }

  // Edition directement sur l'ecran recapitulatif (30 sept, demande d'Amira :
  // "modifier quelque chose" ne doit plus quitter cette page) — met a jour
  // un champ texte issu de la conversation garde-fou (adresse, surface...).
  function setAnswerField(key, value) {
    setExpertiseAnswers((current) => ({ ...current, [key]: value }));
  }

  // Edition d'un ajout de derniere minute (1er oct, demande d'Amira :
  // plusieurs ajouts possibles, un par un — voir app/api/radar-assistant) —
  // expertiseAnswers.complements est une liste de {item, precision}.
  function setComplementField(index, field, value) {
    setExpertiseAnswers((current) => {
      const complements = Array.isArray(current.complements) ? [...current.complements] : [];
      complements[index] = { ...complements[index], [field]: value };
      return { ...current, complements };
    });
  }

  function removeComplement(index) {
    setExpertiseAnswers((current) => {
      const complements = Array.isArray(current.complements) ? current.complements.filter((_, i) => i !== index) : [];
      return { ...current, complements };
    });
  }

  // Edition d'une piece sur le recapitulatif (1er oct, decoupage par piece)
  // — expertiseAnswers.rooms est la liste structuree construite cote serveur
  // (app/api/radar-assistant), modifiable ici comme tout le reste.
  function setRoomField(index, field, value) {
    setExpertiseAnswers((current) => {
      const rooms = Array.isArray(current.rooms) ? [...current.rooms] : [];
      rooms[index] = { ...rooms[index], [field]: value };
      return { ...current, rooms };
    });
  }

  function removeRoom(index) {
    setExpertiseAnswers((current) => {
      const rooms = Array.isArray(current.rooms) ? current.rooms.filter((_, i) => i !== index) : [];
      return { ...current, rooms };
    });
  }

  // Valide le recapitulatif : geocode l'adresse texte (ville/code postal/
  // lat/lon necessaires au matching geographique des entreprises, voir
  // geocodeAddressText) puis lance l'expertise — passe l'objet directement a
  // launchExpertise plutot que de compter sur expertiseAnswers (setState
  // est asynchrone, la valeur en state ne serait pas encore a jour).
  async function confirmRecap() {
    const normes = normesFor(metier);
    const enriched = { ...expertiseAnswers, metier, normes };
    setExpertiseAnswers(enriched);
    const geocoded = await geocodeAddressText(enriched.adresse || "");
    setAddress(geocoded);
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
      setMissingPriceDrafts({});
      setShowBreakdown(false);
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

  function conseilsDiscountFactor() {
    if (!expertise) return 1;
    const discount = (expertise.conseils || [])
      .filter((c) => selectedConseils.has(c.id))
      .reduce((sum, c) => sum + Number(c.discountPercent || 0), 0);
    return Math.max(0, 1 - discount / 100);
  }

  function adjustedRange() {
    if (!expertise) return { min: 0, max: 0 };
    const factor = conseilsDiscountFactor();
    return {
      min: Math.round(expertise.priceRangeMin * factor),
      max: Math.round(expertise.priceRangeMax * factor)
    };
  }

  async function submitMissingPrices() {
    const prices = Object.entries(missingPriceDrafts)
      .filter(([, v]) => v !== "" && Number.isFinite(Number(v)))
      .map(([itemId, v]) => ({ itemId, amountHt: Number(v) }));
    if (prices.length === 0) return;
    setSubmittingPrices(true);
    setError("");
    try {
      const response = await fetch(`/api/expertise-koji/${expertise.expertiseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prices })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Mise à jour impossible.");
      setExpertise((current) => ({
        ...current,
        priceRangeMin: data.priceRangeMin,
        priceRangeMax: data.priceRangeMax,
        missingPriceItems: data.missingPriceItems
      }));
      setMissingPriceDrafts({});
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingPrices(false);
    }
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
          lon: address.lon,
          conversationId
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
    setConversationId(`radarconv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    draftIdRef.current = "";
    setPendingChoice(null);
    setPendingPhotoRequest(null);
    setStreamingText("");
    setExpertiseAnswers({});
    setMetier("");
    setPhotos([]);
  }

  const range = phase === "result" ? adjustedRange() : null;
  const iaStepIndex = IA_PHASES.indexOf(phase);

  if (loadingDraft) {
    return (
      <main className="client-space">
        <ClientTopbar showBack backHref="/client/radar" />
        <div className="radar-expertise-loading">
          <div className="radar-expertise-spinner" />
          <strong>Chargement de votre projet…</strong>
        </div>
      </main>
    );
  }

  return (
    <main className="client-space">
      <ClientTopbar showBack backHref="/client/radar" />

      <div className="ct-welcome">
        <strong>Publier un chantier</strong>
        <small>Avec l'assistant Koji, ou en remplissant vous-même.</small>
      </div>

      {phase === "form" || phase === "hero" ? (
        <section className="radar-mode-tabs">
          <button type="button" className={`radar-mode-tab ${mode === "ia" ? "active" : ""}`} onClick={() => switchMode("ia")}>
            {mode === "ia" ? <span className="radar-mode-tab-check"><CheckIcon /></span> : null}
            <span className="radar-mode-tab-icon ia"><SparkleIcon /></span>
            <div>
              <strong>Avec l'assistant Koji</strong>
              <small>Description + photos, puis quelques questions</small>
            </div>
          </button>
          <button type="button" className={`radar-mode-tab ${mode === "manuel" ? "active" : ""}`} onClick={() => switchMode("manuel")}>
            {mode === "manuel" ? <span className="radar-mode-tab-check"><CheckIcon /></span> : null}
            <span className="radar-mode-tab-icon manuel"><PencilIcon /></span>
            <div>
              <strong>Je remplis moi-même</strong>
              <small>Un formulaire à remplir vous-même</small>
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
            <h1>Votre projet, <em>simplement.</em></h1>
            <p className="radar-hero-screen-sub">
              Décrivez vos travaux, l'assistant Koji vous pose quelques questions, puis votre demande part aux artisans près de chez vous.
            </p>
            <button type="button" className="radar-hero-screen-btn" onClick={openChat}>
              Démarrer mon projet <span aria-hidden="true">→</span>
            </button>
            <p className="radar-hero-screen-trust">C'est gratuit, et c'est vous qui choisissez votre artisan.</p>
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
              <button type="button" className="radar-chat-restart-top" onClick={restart} disabled={sending}>
                Recommencer
              </button>
            </div>

            <div className="radar-chat-messages">
              {turns.map((t, index) => (
                <div key={index} className={`radar-chat-row ${t.role === "user" ? "user" : "assistant"}`}>
                  {t.role === "assistant" ? <span className="radar-chat-avatar"><img src="/koji-logo.svg" alt="" /></span> : null}
                  <div className="radar-chat-bubble-wrap">
                    <div className={`radar-chat-bubble ${t.role === "user" ? "user" : "assistant"}`}>
                      {t.photos && t.photos.length > 0 ? (
                        <div className="radar-chat-bubble-photos">
                          {t.photos.map((photo, photoIndex) => (
                            <img key={photoIndex} src={photo} alt={`Photo ${photoIndex + 1}`} onClick={() => setLightboxPhoto(photo)} />
                          ))}
                        </div>
                      ) : null}
                      {t.text ? <p>{t.text}</p> : null}
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
                    <div className="radar-chat-bubble assistant">
                      {streamingText ? <p>{streamingText}</p> : (
                        <div className="radar-chat-typing">
                          <span className="radar-chat-dot" /><span className="radar-chat-dot" /><span className="radar-chat-dot" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
              <div ref={messagesEndRef} />
            </div>

            {error ? <p className="profile-message error">{error}</p> : null}

            {pendingPhotoRequest && photos.length === 0 ? (
              <>
                <p className="radar-hint-callout">
                  📷 Une photo aiderait : {pendingPhotoRequest.sujet || "l'état actuel"} — utilisez le trombone ci-dessous, ou répondez en texte si vous n'en avez pas.
                </p>
                <button
                  type="button"
                  className="button secondary"
                  disabled={sending}
                  onClick={() => answerText("Je n'ai pas de photo pour l'instant, continuons.")}
                >
                  Continuer <span aria-hidden="true">→</span>
                </button>
              </>
            ) : null}

            {photos.length > 0 ? (
              <div className="radar-photo-grid">
                {photos.map((photo, index) => (
                  <div className="radar-photo-thumb" key={index}>
                    <img src={photo} alt={`Photo ${index + 1}`} onClick={() => setLightboxPhoto(photo)} />
                    <button type="button" onClick={() => removePhoto(index)} aria-label="Retirer la photo">×</button>
                  </div>
                ))}
              </div>
            ) : null}

            {pendingChoice ? (
              <ChoiceList
                options={pendingChoice.options}
                multiple={pendingChoice.multiple}
                allowUnknown={pendingChoice.allowUnknown}
                allowOther={pendingChoice.allowOther}
                onSubmit={answerText}
                onRestart={restart}
                disabled={sending}
              />
            ) : null}

            <form className="radar-chat-form" onSubmit={handleChatSubmit}>
              <div className="radar-attach-wrap" ref={attachMenuRef}>
                <button type="button" className="radar-chat-attach" title="Ajouter une photo" onClick={() => setAttachMenuOpen((o) => !o)}>
                  <PaperclipIcon />
                </button>
                {attachMenuOpen ? (
                  <div className="radar-attach-menu">
                    <label className="radar-attach-menu-item">
                      <input type="file" accept="image/*" capture="environment" onChange={(e) => { onPhotosChange(e); setAttachMenuOpen(false); }} hidden />
                      <CameraIcon /> Prendre une photo
                    </label>
                    <label className="radar-attach-menu-item">
                      <input type="file" accept="image/*" multiple onChange={(e) => { onPhotosChange(e); setAttachMenuOpen(false); }} hidden />
                      <GalleryIcon /> Depuis la galerie
                    </label>
                  </div>
                ) : null}
              </div>
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Écrivez votre réponse…" disabled={sending} />
              <button type="submit" className="radar-chat-send" disabled={sending || (!draft.trim() && photos.length === 0)} aria-label="Envoyer">
                <SendIcon />
              </button>
            </form>
            <div ref={bottomAnchorRef} />
          </div>
        ) : null}

        {phase === "recap" ? (
          <div className="radar-field radar-form-card-pad">
            <div className="radar-step-header">
              <span className="radar-step-icon"><SparkleIcon /></span>
              <div>
                <h3>Voici le récapitulatif de votre projet</h3>
                <p>Modifiez directement ce qui ne convient pas avant l'estimation.</p>
              </div>
            </div>

            <div className="radar-recap-card">
              <label className="radar-field">
                <span className="radar-field-label">📝 Description</span>
                <textarea rows={3} value={expertiseAnswers.intro || ""} onChange={(e) => setAnswerField("intro", e.target.value)} />
              </label>
              <div className="radar-recap-row"><span>🔧 Métier</span><strong>{metier}</strong></div>
              {expertiseAnswers.cadragePrecisions ? (
                <div className="radar-recap-row">
                  <span>❓ Précisions sur les travaux</span>
                  <ul className="radar-recap-list">
                    {expertiseAnswers.cadragePrecisions.split(" ; ").map((reponse, index) => <li key={index}>{reponse}</li>)}
                  </ul>
                </div>
              ) : null}
              <label className="radar-field">
                <span className="radar-field-label">📍 Adresse</span>
                <input type="text" value={expertiseAnswers.adresse || ""} onChange={(e) => setAnswerField("adresse", e.target.value)} />
              </label>
              <label className="radar-field">
                <span className="radar-field-label">📐 Surface</span>
                <input type="text" value={expertiseAnswers.cotes || ""} onChange={(e) => setAnswerField("cotes", e.target.value)} />
              </label>
              <label className="radar-field">
                <span className="radar-field-label">🔀 Disposition</span>
                <input type="text" value={expertiseAnswers.disposition || ""} onChange={(e) => setAnswerField("disposition", e.target.value)} />
              </label>
              <label className="radar-field">
                <span className="radar-field-label">🏢 Étage</span>
                <input type="text" value={expertiseAnswers.etage || ""} onChange={(e) => setAnswerField("etage", e.target.value)} />
              </label>
              <label className="radar-field">
                <span className="radar-field-label">🛗 Ascenseur</span>
                <input type="text" value={expertiseAnswers.ascenseur || ""} onChange={(e) => setAnswerField("ascenseur", e.target.value)} />
              </label>
              <label className="radar-field">
                <span className="radar-field-label">🚪 Accès</span>
                <input type="text" value={expertiseAnswers.acces || ""} onChange={(e) => setAnswerField("acces", e.target.value)} />
              </label>
              <label className="radar-field">
                <span className="radar-field-label">🅿️ Stationnement</span>
                <input type="text" value={expertiseAnswers.stationnement || ""} onChange={(e) => setAnswerField("stationnement", e.target.value)} />
              </label>
            </div>

            {Array.isArray(expertiseAnswers.complements) && expertiseAnswers.complements.length > 0 ? (
              <div className="radar-recap-card">
                <span className="radar-field-label">➕ Ajouts de dernière minute</span>
                {expertiseAnswers.complements.map((c, index) => (
                  <div key={index} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                    <input
                      type="text"
                      value={c.item || ""}
                      onChange={(e) => setComplementField(index, "item", e.target.value)}
                      style={{ flex: "1 1 50%" }}
                    />
                    <input
                      type="text"
                      value={c.precision || ""}
                      onChange={(e) => setComplementField(index, "precision", e.target.value)}
                      placeholder="Précision (surface, quantité...)"
                      style={{ flex: "1 1 50%" }}
                    />
                    <button type="button" className="button secondary" onClick={() => removeComplement(index)}>×</button>
                  </div>
                ))}
              </div>
            ) : null}

            {expertiseAnswers._needsRoomBreakdown ? (
              <div className="radar-recap-card">
                <span className="radar-field-label">🚪 Pièces détaillées</span>
                {(expertiseAnswers.rooms || []).map((room, index) => (
                  <div key={room.id || index} style={{ marginTop: 10, paddingTop: 10, borderTop: index > 0 ? "1px solid var(--border, #eee)" : "none" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="text"
                        value={room.label || ""}
                        onChange={(e) => setRoomField(index, "label", e.target.value)}
                        style={{ flex: "1 1 60%", fontWeight: 600 }}
                      />
                      <button type="button" className="button secondary" onClick={() => removeRoom(index)}>×</button>
                    </div>
                    <small style={{ color: "var(--muted)" }}>
                      {Array.isArray(room.metiers) && room.metiers.length > 0 ? room.metiers.join(", ") : "Métier non détecté"}
                    </small>
                    <textarea
                      rows={2}
                      value={room.summary || ""}
                      onChange={(e) => setRoomField(index, "summary", e.target.value)}
                      style={{ width: "100%", marginTop: 6 }}
                      placeholder="Résumé des travaux pour cette pièce"
                    />
                  </div>
                ))}
              </div>
            ) : expertiseAnswers._freeformSummary ? (
              // L'IA decrit ces champs en texte libre au fil de la
              // conversation — champs texte simples, modifiables, plutot que
              // des cases a cocher.
              <div className="radar-recap-card">
                <label className="radar-field">
                  <span className="radar-field-label">🏠 État actuel</span>
                  <textarea rows={2} value={expertiseAnswers.etatGeneral || ""} onChange={(e) => setAnswerField("etatGeneral", e.target.value)} />
                </label>
                <label className="radar-field">
                  <span className="radar-field-label">🛁 Équipements souhaités</span>
                  <textarea rows={2} value={expertiseAnswers.equipements || ""} onChange={(e) => setAnswerField("equipements", e.target.value)} />
                </label>
                <label className="radar-field">
                  <span className="radar-field-label">🎨 Style / gamme</span>
                  <input type="text" value={expertiseAnswers.style || ""} onChange={(e) => setAnswerField("style", e.target.value)} />
                </label>
                <label className="radar-field">
                  <span className="radar-field-label">🔨 Travaux</span>
                  <textarea rows={3} value={expertiseAnswers.travauxDetail || ""} onChange={(e) => setAnswerField("travauxDetail", e.target.value)} />
                </label>
                <label className="radar-field">
                  <span className="radar-field-label">📏 Précisions chiffrées</span>
                  <textarea rows={2} value={expertiseAnswers.travauxPrecisions || ""} onChange={(e) => setAnswerField("travauxPrecisions", e.target.value)} />
                </label>
              </div>
            ) : null}

            <div className="radar-recap-card">
              <div className="radar-recap-row"><span>📷 Photos</span><strong>{photos.length > 0 ? `${photos.length} photo${photos.length > 1 ? "s" : ""} ajoutée${photos.length > 1 ? "s" : ""}` : "Aucune"}</strong></div>
            </div>

            {error ? <p className="profile-message error">{error}</p> : null}
            <div className="radar-wizard-nav">
              <button type="button" className="radar-generate-btn" style={{ width: "100%" }} onClick={confirmRecap}>
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
                    <img src={photo} alt={`Photo ${index + 1}`} onClick={() => setLightboxPhoto(photo)} />
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
            <button
              type="button"
              className="radar-price-range-card"
              style={{ width: "100%", border: "none", font: "inherit", color: "inherit", cursor: expertise.breakdown?.length > 0 ? "pointer" : "default" }}
              onClick={() => expertise.breakdown?.length > 0 && setShowBreakdown((v) => !v)}
            >
              <span className="radar-price-range-label">
                Fourchette de prix estimée
                {expertise.breakdown && expertise.breakdown.length > 0 ? (showBreakdown ? " ▲" : " ▼ (voir le détail)") : ""}
              </span>
              <span className="radar-price-range-value">{range.min.toLocaleString("fr-FR")} € – {range.max.toLocaleString("fr-FR")} €</span>
              {expertise.delaiEstimeJours ? <span className="radar-delay-badge">Délai estimé : {expertise.delaiEstimeJours} jour{expertise.delaiEstimeJours > 1 ? "s" : ""}</span> : null}
            </button>

            {showBreakdown && expertise.breakdown && expertise.breakdown.length > 0 ? (
              <div className="radar-recap-card">
                <span className="radar-field-label">Détail par lot</span>
                {expertise.breakdown.map((lot) => {
                  const factor = conseilsDiscountFactor();
                  const adjustedMin = Math.round(lot.totalTtc * (1 - PRICE_RANGE_SPREAD_CLIENT) * factor);
                  const adjustedMax = Math.round(lot.totalTtc * (1 + PRICE_RANGE_SPREAD_CLIENT) * factor);
                  return (
                    <div key={lot.room} className="radar-recap-row">
                      <span>{lot.room}</span>
                      <strong>{adjustedMin.toLocaleString("fr-FR")} € – {adjustedMax.toLocaleString("fr-FR")} €</strong>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {expertise.missingPriceItems && expertise.missingPriceItems.length > 0 ? (
              <div className="radar-recap-card">
                <span className="radar-field-label">⚠️ Prix manquants dans notre base</span>
                <p className="radar-recap-note" style={{ margin: "4px 0 10px" }}>
                  Nous n'avons pas encore ces prix dans la base de Koji — la fourchette ci-dessus ne les inclut pas. Vous pouvez en proposer un, sinon ils resteront à 0€.
                </p>
                {expertise.missingPriceItems.map((item) => (
                  <div key={item.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                    <span style={{ flex: "1 1 60%", fontSize: 13 }}>{item.room} — {item.label} ({item.quantity} {item.unit})</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Prix € HT"
                      value={missingPriceDrafts[item.id] || ""}
                      onChange={(e) => setMissingPriceDrafts((current) => ({ ...current, [item.id]: e.target.value }))}
                      style={{ width: 110 }}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  className="button secondary"
                  style={{ width: "100%", marginTop: 4 }}
                  onClick={submitMissingPrices}
                  disabled={submittingPrices}
                >
                  {submittingPrices ? "Mise à jour…" : "Mettre à jour l'estimation avec vos prix"}
                </button>
              </div>
            ) : null}

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

      {lightboxPhoto ? (
        <div className="modal-overlay photo-lightbox-overlay" role="dialog" aria-modal="true" onClick={() => setLightboxPhoto(null)}>
          <button type="button" className="photo-lightbox-close" onClick={() => setLightboxPhoto(null)} aria-label="Fermer">×</button>
          <img className="photo-lightbox-img" src={lightboxPhoto} alt="Photo agrandie" onClick={(e) => e.stopPropagation()} />
        </div>
      ) : null}
    </main>
  );
}
