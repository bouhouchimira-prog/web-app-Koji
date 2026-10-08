"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ClientTopbar } from "../../../../components/ClientTopbar";
import { RadarAddressAutocomplete } from "../../../../components/RadarAddressAutocomplete";
import { questionBankFor, ETAT_GENERAL_OPTIONS, normesFor } from "../../../../lib/renovation-question-bank";

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

// Separateur de selection multiple sur les cartes du cadrage (30 sept) —
// doit rester identique cote serveur (app/api/radar-assistant/route.js,
// MULTI_SELECT_SEPARATOR) pour que le court-circuit sans IA fonctionne.
const MULTI_SELECT_SEPARATOR = " • ";

// Selection des propositions de travaux apres analyse d'une photo (6 oct,
// demande d'Amira) — purement cote client, jamais envoyee au serveur (voir
// answerText) : /api/radar-assistant ne connait pas cette etape. Prefixe
// "cadrage:" repris uniquement pour activer l'affichage en cartes cochables
// deja existant (isCadrageMultiStep ci-dessous), jamais transmis tel quel.
const PHOTO_PROPOSITIONS_SLOT_KEY = "cadrage:photos:propositions";
const PHOTO_PROPOSITIONS_NONE = "Aucune modification pour l'instant";

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
const IA_PHASES = ["hero", "chat", "equipements", "styles", "etat-general", "travaux", "travaux-detail", "recap", "result"];

export default function NewRadarOffrePage() {
  const router = useRouter();
  const [mode, setMode] = useState("ia"); // ia | manuel
  const [phase, setPhase] = useState("hero"); // hero | chat | metier-loading | equipements | styles | etat-general | travaux | recap | loading | result
  const [metier, setMetier] = useState("");
  const [selectedEquipements, setSelectedEquipements] = useState(new Set());
  const [selectedStyle, setSelectedStyle] = useState("");
  const [selectedEtatGeneral, setSelectedEtatGeneral] = useState("");
  const [travauxToggles, setTravauxToggles] = useState({});
  const [travauxDetailAnswers, setTravauxDetailAnswers] = useState({});
  const [photos, setPhotos] = useState([]);
  // Combien de photos (sur `photos`) ont deja ete envoyees a l'analyse (4
  // oct, demande d'Amira) — evite de reanalyser/recommenter les memes
  // photos a chaque tour. Un ref plutot qu'un state : jamais besoin de
  // redeclencher un rendu, seulement lu/mis a jour dans sendTurn.
  const photosAnalyzedCountRef = useRef(0);
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

  // Etat du chat de questions (onglet "Offre IA" uniquement) — meme
  // mecanique que /api/radar-assistant utilisait deja dans le precedent
  // parcours en etapes : liste fixe, une question a la fois, jamais
  // d'improvisation IA sur le contenu des questions.
  const [turns, setTurns] = useState([]);
  // Identifiant stable pour toute la conversation (2 oct, demande d'Amira :
  // enregistrer la conversation "en cas ou on rencontre un probleme",
  // consultable cote admin). Regenere a chaque nouvelle conversation
  // (openChat/restart) — voir logConversation plus bas.
  const [conversationId, setConversationId] = useState(() => `radarconv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
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
  // Suite de la conversation mise en attente le temps de la selection des
  // propositions de travaux issues d'une photo (4 oct, etendu 6 oct) — meme
  // principe que pendingFirstQuestion, mais generalise a n'importe quelle
  // etape (cadrage, choix de metier, ecran photos, question fixe...),
  // puisque le commentaire de photo peut survenir a n'importe quel moment
  // de la conversation.
  const [pendingPhotoStep, setPendingPhotoStep] = useState(null);
  // Vrai une fois que le tout premier message decrit reellement un projet
  // (jamais juste apres l'ouverture du chat) — distinct de `slotKey` car le
  // garde-fou "intro:clarify" peut redemander plusieurs fois avant d'y
  // arriver ; l'ecran "Visuels et photos" ne doit s'intercaler qu'une seule
  // fois, juste apres cette confirmation, jamais avant.
  const [introConfirmed, setIntroConfirmed] = useState(false);
  // Selection multiple sur les cartes du cadrage (30 sept, demande d'Amira) :
  // seule etape ou plusieurs reponses a la fois ont du sens (ex: "type de
  // travaux") — les 11 questions fixes restent un clic = reponse immediate.
  const [multiSelectChoices, setMultiSelectChoices] = useState(new Set());
  // "Autre, précisez" en selection multiple (30 sept, demande d'Amira) :
  // n'efface plus les cartes ni les cases deja cochees — ajoute juste une
  // ligne de texte libre en bas, combinee aux choix coches au moment de
  // valider.
  const [showMultiSelectOther, setShowMultiSelectOther] = useState(false);
  const [multiSelectOtherText, setMultiSelectOtherText] = useState("");
  const isCadrageMultiStep = Boolean(slotKey) && slotKey.startsWith("cadrage:") && !slotKey.endsWith(":confirm");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    setMultiSelectChoices(new Set());
    setShowMultiSelectOther(false);
    setMultiSelectOtherText("");
  }, [slotKey]);

  function toggleMultiSelectChoice(option) {
    setMultiSelectChoices((current) => {
      const next = new Set(current);
      if (next.has(option)) next.delete(option); else next.add(option);
      return next;
    });
  }

  function submitMultiSelectChoices() {
    const parts = [...multiSelectChoices, multiSelectOtherText.trim()].filter(Boolean);
    if (parts.length === 0) return;
    answerText(parts.join(MULTI_SELECT_SEPARATOR));
  }

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

  // Commente les photos pas encore analysees (4 oct, demande d'Amira) —
  // appelee a la fois depuis sendTurn() (photos deja jointes au moment ou
  // l'intro/le metier sont connus, ex. attachees des le tout premier
  // message) et depuis continueAfterPhotos() (photos ajoutees sur l'ecran
  // dedie "Visuels et photos"), pour ne jamais dependre d'un seul point
  // d'entree — les photos peuvent etre attachees a tout moment via le
  // trombone. `photosAnalyzedCountRef` evite de reanalyser deux fois les
  // memes photos. Ne fait rien tant que l'intro n'est pas encore connue
  // (pas de contexte projet a donner a l'IA) ; jamais bloquant, toujours
  // silencieuse en cas d'echec.
  async function analyzeNewPhotos(metier, intro) {
    const empty = { description: "", elements: [] };
    if (!intro) return empty;
    const unanalyzed = photos.slice(photosAnalyzedCountRef.current);
    if (unanalyzed.length === 0) return empty;
    photosAnalyzedCountRef.current = photos.length;
    try {
      const response = await fetch("/api/radar-assistant/analyze-photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metier, intro, photos: unanalyzed })
      });
      const body = await response.json().catch(() => ({}));
      return {
        description: body.description || "",
        elements: Array.isArray(body.elements) ? body.elements : []
      };
    } catch {
      return empty;
    }
  }

  // Construit les cartes a cocher "<Élément> — <proposition>" a partir des
  // elements renvoyes par analyzeNewPhotos (6 oct, demande d'Amira) — une
  // carte par combinaison, plus une carte pour ne rien choisir.
  function photoPropositionCards(elements) {
    const cards = [];
    for (const e of elements) {
      for (const p of e.propositions) cards.push(`${e.element} — ${p}`);
    }
    cards.push(PHOTO_PROPOSITIONS_NONE);
    return cards;
  }

  // Revele une etape mise en attente (cadrage, choix de metier, ecran
  // photos, question fixe, ou fin du parcours) — factorise car la meme
  // logique doit s'executer, que l'etape ait ete revelee tout de suite ou
  // apres la selection des propositions de travaux issues d'une photo (4
  // oct, etendu 6 oct).
  function revealPendingStep(pending, baseTurns) {
    const { data, stepMessage, isIntroStep, isPhotoInterstitial } = pending;
    const finalTurns = [...baseTurns, { role: "assistant", text: stepMessage, time: nowTime() }];
    setTurns(finalTurns);
    logConversation(finalTurns, data.answers?.metier);
    if (isIntroStep) {
      setReadyMessage("");
      setCurrentOptions(data.options || null);
      setCurrentInputType("text");
      setSlotKey(data.slotKey || null);
    } else if (isPhotoInterstitial) {
      setIntroConfirmed(true);
      setPendingFirstQuestion(data);
      setAwaitingPhotoStep(true);
      setReadyMessage("");
      setCurrentOptions(null);
      setCurrentInputType("text");
    } else if (data.type === "ready_for_expertise") {
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
  }

  // Reponse a la selection des propositions de travaux issues d'une photo
  // (6 oct, demande d'Amira — remplace l'ancienne confirmation "proposition
  // visuelle" Replicate) — purement cote client, n'appelle jamais
  // /api/radar-assistant. Les choix sont enregistres dans
  // expertiseAnswers.photoPropositions, repris par le chiffrage final
  // (app/api/expertise-koji/route.js), puis la conversation reprend
  // normalement.
  function handlePhotoPropositionsSubmit(text) {
    const pending = pendingPhotoStep;
    setPendingPhotoStep(null);
    const afterTurns = [...turns, { role: "user", text, time: nowTime() }];
    setTurns(afterTurns);
    setDraft("");

    const selected = text.split(MULTI_SELECT_SEPARATOR).map((s) => s.trim()).filter((s) => s && s !== PHOTO_PROPOSITIONS_NONE);
    if (selected.length > 0) {
      setExpertiseAnswers((current) => ({
        ...current,
        photoPropositions: [current.photoPropositions, selected.join(" ; ")].filter(Boolean).join(" ; ")
      }));
    }
    if (pending) revealPendingStep(pending, afterTurns);
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
      if (data.answers) setExpertiseAnswers(data.answers);
      // Adresse validee et geocodee cote serveur (meme si tapee a la main
      // sans cliquer de suggestion) — aligne l'etat `address` (utilise plus
      // tard pour publier l'offre) sur ce que le chat vient d'accepter.
      if (data.geocode) {
        setAddress({
          address: data.geocode.label,
          city: data.geocode.city,
          postalCode: data.geocode.postalCode,
          lat: data.geocode.lat,
          lon: data.geocode.lon
        });
      }
      // Commente les photos des qu'un intro/metier est connu, meme si elles
      // ont ete jointes des le tout premier message (4 oct, demande
      // d'Amira) — jamais a l'ecran "Visuels et photos" uniquement, puisque
      // ce dernier est saute pour la plupart des projets reels (cadrage,
      // choix de metier, decoupage par piece...).
      const photoResult = await analyzeNewPhotos(data.answers?.metier || expertiseAnswers.metier, data.answers?.intro || expertiseAnswers.intro);
      const isIntroStep = data.type === "intro_clarify" || data.type === "cadrage" || data.type === "cadrage_confirm" || data.type === "metier_choice";
      const isPhotoInterstitial = !isIntroStep && !introConfirmed && data.type !== "ready_for_expertise";
      const stepMessage = isPhotoInterstitial
        ? "Parfait ! Pouvez-vous m'envoyer quelques photos ? Cela m'aide à mieux comprendre l'existant et à vous proposer une estimation plus fiable."
        : data.message;
      const pending = { data, stepMessage, isIntroStep, isPhotoInterstitial };
      if (photoResult.elements.length > 0) {
        // De vrais elements viennent d'etre identifies sur une photo (6
        // oct, demande d'Amira) : propose les travaux possibles a cocher
        // avant d'enchainer sur la suite, mise en attente le temps de la
        // selection (meme principe que pendingFirstQuestion pour l'ecran
        // "Visuels et photos").
        const extraTurns = photoResult.description
          ? [{ role: "assistant", text: photoResult.description, time: nowTime() }]
          : [];
        extraTurns.push({ role: "assistant", text: "Voici ce que je propose pour cette photo :", time: nowTime() });
        const finalTurns = [...nextTurns, ...extraTurns];
        setTurns(finalTurns);
        logConversation(finalTurns, data.answers?.metier);
        setPendingPhotoStep(pending);
        setReadyMessage("");
        setCurrentOptions(photoPropositionCards(photoResult.elements));
        setCurrentInputType("text");
        setSlotKey(PHOTO_PROPOSITIONS_SLOT_KEY);
        return;
      }
      if (photoResult.description) {
        const finalTurns = [...nextTurns, { role: "assistant", text: photoResult.description, time: nowTime() }];
        setTurns(finalTurns);
        logConversation(finalTurns, data.answers?.metier);
        revealPendingStep(pending, finalTurns);
        return;
      }
      revealPendingStep(pending, nextTurns);
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
    setConversationId(`radarconv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
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
    setIntroConfirmed(false);
  }

  // Revele la vraie premiere question du garde-fou, mise en attente par
  // sendTurn() le temps de l'ecran "Visuels et photos" — les photos deja
  // ajoutees (ou non) restent dans `photos`, lues telles quelles plus tard.
  // S'il y a des photos (4 oct, demande d'Amira), koji les commente d'abord
  // dans la conversation avant d'enchainer sur la question suivante — jamais
  // bloquant : un echec de l'analyse (reseau, cle API...) n'empeche jamais
  // de continuer, voir /api/radar-assistant/analyze-photos qui renvoie
  // toujours un message vide plutot qu'une erreur.
  async function continueAfterPhotos() {
    if (!pendingFirstQuestion) return;
    const data = pendingFirstQuestion;
    setPendingFirstQuestion(null);
    setAwaitingPhotoStep(false);
    setSending(true);
    const photoResult = await analyzeNewPhotos(expertiseAnswers.metier, expertiseAnswers.intro);
    setSending(false);
    const pending = { data, stepMessage: data.message, isIntroStep: false, isPhotoInterstitial: false };
    if (photoResult.elements.length > 0) {
      const extraTurns = photoResult.description
        ? [{ role: "assistant", text: photoResult.description, time: nowTime() }]
        : [];
      extraTurns.push({ role: "assistant", text: "Voici ce que je propose pour cette photo :", time: nowTime() });
      const finalTurns = [...turns, ...extraTurns];
      setTurns(finalTurns);
      logConversation(finalTurns, expertiseAnswers.metier);
      setPendingPhotoStep(pending);
      setCurrentOptions(photoPropositionCards(photoResult.elements));
      setCurrentInputType("text");
      setSlotKey(PHOTO_PROPOSITIONS_SLOT_KEY);
      return;
    }
    if (photoResult.description) {
      const finalTurns = [...turns, { role: "assistant", text: photoResult.description, time: nowTime() }];
      setTurns(finalTurns);
      logConversation(finalTurns, expertiseAnswers.metier);
      revealPendingStep(pending, finalTurns);
      return;
    }
    revealPendingStep(pending, turns);
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
    if (slotKey === PHOTO_PROPOSITIONS_SLOT_KEY) {
      handlePhotoPropositionsSubmit(text.trim());
      return;
    }
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
    // Le metier est deja determine cote serveur, tot dans la conversation
    // (pour piloter le cadrage specifique — voir /api/radar-assistant),
    // et renvoye dans expertiseAnswers.metier : pas besoin de reclassifier.
    // Le second appel n'est qu'un filet de securite si jamais il manquait.
    let detectedMetier = expertiseAnswers.metier;
    if (!detectedMetier) {
      try {
        const response = await fetch("/api/classify-metier", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: expertiseAnswers.intro || description })
        });
        const data = await response.json();
        detectedMetier = data.metier || "Tout corps d'état";
      } catch {
        detectedMetier = "Tout corps d'état";
      }
    }
    setMetier(detectedMetier);
    // Decoupage par piece (1er oct, cahier des charges d'Amira) : le
    // mini-cadrage par piece (app/api/radar-assistant) a deja couvert
    // equipements/style/etat/travaux au niveau de chaque piece — reposer les
    // memes questions globalement ici serait redondant (meme principe que
    // le retrait de l'ecran "Gamme" plus tot ce soir), donc pas la peine de
    // pre-remplir ces listes dans ce mode. Va direct au recapitulatif, qui
    // affiche la liste des pieces a la place.
    if (expertiseAnswers._needsRoomBreakdown) {
      setPhase("recap");
      return;
    }
    const bank = questionBankFor(detectedMetier);
    setTravauxToggles(Object.fromEntries(bank.travaux.map((t) => [t.id, true])));
    setSelectedEquipements(new Set());
    setSelectedStyle("");
    setSelectedEtatGeneral("");
    setTravauxDetailAnswers({});
    setPhase("equipements");
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

  function setTravauxDetail(key, value) {
    setTravauxDetailAnswers((current) => ({ ...current, [key]: value }));
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

  // Apres la liste des travaux : s'il n'y a aucune sous-question a poser
  // (aucun travail coche parmi ceux qui portent un `detail`), on saute
  // directement au recapitulatif plutot que d'afficher un ecran vide.
  function goAfterTravaux() {
    const bank = questionBankFor(metier);
    const hasDetail = bank.travaux.some((t) => travauxToggles[t.id] && t.detail);
    setPhase(hasDetail ? "travaux-detail" : "recap");
  }

  // Valide le recapitulatif : fusionne equipements/style/travaux dans les
  // reponses avant de lancer l'expertise — passe l'objet directement a
  // launchExpertise plutot que de compter sur expertiseAnswers (setState
  // est asynchrone, la valeur en state ne serait pas encore a jour).
  function confirmRecap() {
    const bank = questionBankFor(metier);
    const equipements = bank.equipements.filter((e) => selectedEquipements.has(e.id)).map((e) => e.label).join(", ");
    const style = bank.styles.find((s) => s.id === selectedStyle)?.label || "";
    const etatGeneral = ETAT_GENERAL_OPTIONS.find((e) => e.id === selectedEtatGeneral)?.label || "";
    const travauxDetail = bank.travaux.filter((t) => travauxToggles[t.id]).map((t) => t.label).join(", ");
    const travauxPrecisions = bank.travaux
      .filter((t) => travauxToggles[t.id] && t.detail && travauxDetailAnswers[t.detail.key]?.trim())
      .map((t) => `${t.label} : ${travauxDetailAnswers[t.detail.key].trim()}`)
      .join(", ");
    const normes = normesFor(metier);
    const enriched = { ...expertiseAnswers, metier, equipements, style, etatGeneral, travauxDetail, travauxPrecisions, normes };
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
    setReadyMessage("");
    setCurrentOptions(null);
    setSlotKey(null);
    setExpertiseAnswers({});
    setMetier("");
    setSelectedEquipements(new Set());
    setSelectedStyle("");
    setSelectedEtatGeneral("");
    setTravauxToggles({});
    setTravauxDetailAnswers({});
    setPhotos([]);
    setAwaitingPhotoStep(false);
    setPendingFirstQuestion(null);
    setIntroConfirmed(false);
  }

  const range = phase === "result" ? adjustedRange() : null;
  const bank = metier ? questionBankFor(metier) : null;
  const iaStepIndex = IA_PHASES.indexOf(phase);

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
                <button type="button" className="button secondary" onClick={continueAfterPhotos} disabled={sending}>
                  Continuer sans note <span aria-hidden="true">→</span>
                </button>
              </div>
            ) : currentInputType === "address" ? (
              <RadarAddressAutocomplete value={addressDraft} onChange={setAddressDraft} onSelect={selectAddress} onManualSubmit={submitManualAddress} />
            ) : currentOptions && currentOptions.length > 0 && isCadrageMultiStep ? (
              <>
                <div className="radar-choice-grid">
                  {currentOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`radar-choice-card ${(option === "Autre, précisez" ? showMultiSelectOther : multiSelectChoices.has(option)) ? "selected" : ""}`}
                      disabled={sending}
                      // "Autre, précisez" : jamais une vraie reponse, garde
                      // les cases deja cochees — revele juste une ligne de
                      // texte libre en plus, combinee au moment de valider.
                      onClick={() => (option === "Autre, précisez" ? setShowMultiSelectOther(true) : toggleMultiSelectChoice(option))}
                    >
                      {(option === "Autre, précisez" ? showMultiSelectOther : multiSelectChoices.has(option)) ? <span className="radar-choice-card-check"><CheckIcon /></span> : null}
                      <span className="radar-choice-card-label">{option}</span>
                    </button>
                  ))}
                </div>
                {showMultiSelectOther ? (
                  <label className="radar-field">
                    <span className="radar-field-label">Précisez</span>
                    <input
                      type="text"
                      value={multiSelectOtherText}
                      onChange={(e) => setMultiSelectOtherText(e.target.value)}
                      placeholder="Ajoutez ce qui manque…"
                      disabled={sending}
                    />
                  </label>
                ) : null}
                <button
                  type="button"
                  className="radar-generate-btn"
                  onClick={submitMultiSelectChoices}
                  disabled={sending || (multiSelectChoices.size === 0 && !multiSelectOtherText.trim())}
                >
                  Valider ma sélection <span aria-hidden="true">→</span>
                </button>
              </>
            ) : currentOptions && currentOptions.length > 0 ? (
              <div className="radar-choice-grid">
                {currentOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className="radar-choice-card"
                    disabled={sending}
                    // "Autre, précisez" (cadrage métier) : jamais envoyée telle
                    // quelle au serveur, révèle juste le champ de saisie libre.
                    onClick={() => (option === "Autre, précisez" ? setCurrentOptions(null) : answerText(option))}
                  >
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
              <button type="button" className="button secondary" onClick={() => setPhase("styles")}>Retour</button>
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
            <p className="radar-hint-callout radar-normes-callout">
              🛡️ Normes applicables (information) — {normesFor(metier)}
            </p>
            <div className="radar-wizard-nav">
              <button type="button" className="button secondary" onClick={() => setPhase("etat-general")}>Retour</button>
              <button type="button" className="radar-generate-btn" onClick={goAfterTravaux}>
                Continuer <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        ) : null}

        {phase === "travaux-detail" && bank ? (
          <div className="radar-field radar-form-card-pad">
            <div className="radar-step-header">
              <span className="radar-step-icon"><SparkleIcon /></span>
              <div>
                <h3>Quelques précisions sur les travaux</h3>
                <p>Surfaces et quantités approximatives — ça affine l'estimation.</p>
              </div>
            </div>
            <div className="radar-detail-list">
              {bank.travaux
                .filter((item) => travauxToggles[item.id] && item.detail)
                .map((item) => (
                  <label key={item.id} className="radar-field">
                    <span className="radar-field-label">{item.detail.question}</span>
                    <input
                      type="text"
                      value={travauxDetailAnswers[item.detail.key] || ""}
                      onChange={(e) => setTravauxDetail(item.detail.key, e.target.value)}
                      placeholder={item.detail.placeholder}
                    />
                  </label>
                ))}
            </div>
            <div className="radar-wizard-nav">
              <button type="button" className="button secondary" onClick={() => setPhase("travaux")}>Retour</button>
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
                <span className="radar-field-label">🔷 Configuration</span>
                <input type="text" value={expertiseAnswers.configuration || ""} onChange={(e) => setAnswerField("configuration", e.target.value)} />
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
            ) : (
              <>
                <span className="radar-field-label">🏠 État actuel</span>
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

                <span className="radar-field-label">🛁 Équipements</span>
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

                <span className="radar-field-label">🎨 Style</span>
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

                <span className="radar-field-label">🔨 Travaux</span>
                <div className="radar-toggle-list">
                  {bank.travaux.map((item) => (
                    <label key={item.id} className="radar-toggle-row">
                      <span>{item.label}</span>
                      <input type="checkbox" checked={Boolean(travauxToggles[item.id])} onChange={() => toggleTravail(item.id)} className="radar-toggle-switch" />
                    </label>
                  ))}
                </div>
                {bank.travaux.some((t) => travauxToggles[t.id] && t.detail) ? (
                  <div className="radar-detail-list">
                    {bank.travaux
                      .filter((item) => travauxToggles[item.id] && item.detail)
                      .map((item) => (
                        <label key={item.id} className="radar-field">
                          <span className="radar-field-label">{item.detail.question}</span>
                          <input
                            type="text"
                            value={travauxDetailAnswers[item.detail.key] || ""}
                            onChange={(e) => setTravauxDetail(item.detail.key, e.target.value)}
                            placeholder={item.detail.placeholder}
                          />
                        </label>
                      ))}
                  </div>
                ) : null}
              </>
            )}

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
    </main>
  );
}
