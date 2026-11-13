"use client";

import { useEffect, useRef, useState } from "react";
import { ecartTotal, koji, premierMessage, texteReponses, toutesRepondues } from "../lib/devis-guide";

// Chat "Avec l'IA" du devis (16 oct, maquette Artifact DevisCreerIA) —
// lecture du flux SSE calquee sur app/client/radar/new-chat/page.jsx (meme
// boucle de lecture par trames). Maquette PRO-03.1 (13 nov) : questions
// oubliées en oui / non d'un clic (outil poser_questions), « Koji
// travaille » en direct, photo du chantier et dictée. Chaque evenement "action" recu est applique IMMEDIATEMENT sur le devis
// ouvert via les callbacks passes en props (memes fonctions que les
// boutons "Ajouter" manuels de DevisEditor.jsx) — ce chat ne stocke rien
// lui-meme, le devis reste la seule source de verite.
//
// Protocole de confirmation (22 oct, cahier des charges recu d'Amira) :
// l'assistant ne doit jamais ANNONCER un changement avant une preuve reelle
// qu'il a ete enregistre. Comme ce chat n'ecrit jamais lui-meme en base
// (voir plus haut), la preuve ne peut venir que du navigateur, une fois
// l'auto-enregistrement (onAutoSave, déjà branche) termine — donc APRES la
// reponse du modele qui a declenche l'action. On boucle : chaque action
// appliquee dans un tour est capturee (onAdd.../onUpdate... renvoient
// desormais {id}/{lotName}/{client} — voir DevisEditor.jsx), puis une fois
// onAutoSave resolu (succes ou echec reel), un tour synthetique
// "[RESULTAT_ECRITURE] [...]" est renvoye AUTOMATIQUEMENT au serveur (sans
// saisie de l'entreprise) avec les valeurs reellement enregistrees — c'est
// SEULEMENT la reponse du modele a CE tour qui a le droit de dire "c'est
// fait". Ce tour synthetique ne s'affiche jamais dans la conversation
// visible (flag `hidden`), mais reste dans l'historique envoye au serveur.
function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12l16-8-6 16-2-7z" />
    </svg>
  );
}

function CamIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

function Think() {
  return <span className="think" aria-label="Koji travaille"><i /><i /><i /></span>;
}

// Photo du chantier : réduite dans le navigateur (1568 px au plus, la
// taille utile pour Claude) avant l'envoi, en JPEG.
const PHOTO_COTE_MAX = 1568;

function lirePhoto(fichier) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(fichier);
    const img = new Image();
    img.onload = () => {
      const echelle = Math.min(1, PHOTO_COTE_MAX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * echelle);
      canvas.height = Math.round(img.height * echelle);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Photo illisible."));
    };
    img.src = url;
  });
}

// Ce qui part au serveur : texte, questions affichées, et la photo du
// dernier message seulement (les anciennes sont déjà décrites par Koji).
function pourLeServeur(turns) {
  return turns.map(({ role, text, hidden, questions, photo }, index) => ({
    role,
    text,
    ...(hidden ? { hidden } : {}),
    ...(questions?.length ? { questions } : {}),
    ...(photo && index === turns.length - 1 ? { photo } : photo ? { photo: true } : {})
  }));
}

function euros(n) {
  return Number(n || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

const REFLEXION = { phrase: "Koji réfléchit…", lab: "Koji travaille", texte: "" };

export function DevisChatPanel({ quoteSnapshot, onAddLot, onAddOuvrage, onUpdateOuvrage, onRemoveOuvrage, onSetPrice, onSetClient, onFinish, onAutoSave, onOpenDevis }) {
  const [turns, setTurns] = useState(() => [{ role: "assistant", text: premierMessage(quoteSnapshot) }]);
  const [draft, setDraft] = useState("");
  const [photo, setPhoto] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [sending, setSending] = useState(false);
  const [travail, setTravail] = useState(null);
  // Bandeau du téléphone : total HT au début du dernier échange, pour
  // l'écart « + 203,00 » pendant que Koji ajoute.
  const totalDebutRef = useRef(null);
  const toucheRef = useRef(null);
  const [error, setError] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  const [dictee, setDictee] = useState(false);
  const [ecoute, setEcoute] = useState(false);
  const recoRef = useRef(null);
  const photoInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const snapshotRef = useRef(quoteSnapshot);
  snapshotRef.current = quoteSnapshot;
  // Identifiant stable pour toute la duree de vie de ce panneau (25 oct,
  // journal admin) — meme motif que le conversationId deja genere cote
  // client pour le Radar des Chantiers (app/client/radar/new-chat/page.jsx).
  const conversationIdRef = useRef(null);
  if (!conversationIdRef.current) {
    conversationIdRef.current = typeof crypto !== "undefined" && crypto.randomUUID
      ? `devischat-${crypto.randomUUID()}`
      : `devischat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, streamingText, travail]);

  // Le devis se charge après l'ouverture du panneau : tant que personne n'a
  // parlé, le premier message suit son contenu (résumé ou invitation).
  useEffect(() => {
    const texte = premierMessage(quoteSnapshot);
    setTurns((current) => (current.length === 1 && current[0].role === "assistant" && current[0].text !== texte
      ? [{ role: "assistant", text: texte }]
      : current));
  }, [quoteSnapshot]);

  // Dictée (bouton micro) : seulement si le navigateur sait reconnaître la
  // voix ; ailleurs le bouton n'apparaît pas.
  useEffect(() => {
    setDictee(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
    return () => recoRef.current?.abort?.();
  }, []);

  // Cherche une ligne par id dans le snapshot LE PLUS RECENT (snapshotRef,
  // tenu a jour a chaque rendu) — jamais dans une valeur capturee avant
  // l'appel de l'action, pour toujours lire ce que le devis contient
  // vraiment au moment ou onAutoSave vient de confirmer l'ecriture.
  function findLigne(id) {
    for (const lot of snapshotRef.current?.lots || []) {
      const found = (lot.lignes || []).find((l) => l.id === id);
      if (found) return { ...found, lot: lot.nom };
    }
    return null;
  }

  // Applique l'action sur le devis (comme avant) et renvoie un descripteur
  // minimal ({id}/{lotName}/{client}) pour que la boucle de confirmation
  // sache quoi re-verifier une fois l'enregistrement reel termine — les
  // callbacks DevisEditor.jsx (onAdd.../onUpdate.../onRemove...) renvoient
  // maintenant cette valeur au lieu de rien.
  function applyAction(action) {
    if (!action) return null;
    // « Koji travaille » : la phrase suit ce que Koji est en train de faire.
    const enCours = koji(action, snapshotRef.current?.lots);
    if (enCours) setTravail(enCours);
    if (action.subAction === "addLot") {
      const result = onAddLot?.(action.lotName);
      return { tool: "ajouter_lot", lotName: result?.lotName || action.lotName };
    }
    if (action.subAction === "addOuvrage") {
      const result = onAddOuvrage?.(action.ouvrage, action.room, action.quantity);
      return { tool: "ajouter_ouvrage", lineId: result?.id || null };
    }
    if (action.subAction === "updateOuvrage") {
      const result = onUpdateOuvrage?.(action.id, { quantite: action.quantite, prixUnitaireHt: action.prixUnitaireHt });
      return { tool: "modifier_ouvrage", lineId: result?.id || null };
    }
    if (action.subAction === "removeOuvrage") {
      const result = onRemoveOuvrage?.(action.id);
      return { tool: "supprimer_ouvrage", lineId: result?.id || action.id, removed: true };
    }
    if (action.subAction === "setManualPrice") {
      const result = onSetPrice?.(action.amountHt);
      return { tool: "proposer_prix", lineId: result?.id || null };
    }
    if (action.subAction === "setClientInfo") {
      const result = onSetClient?.(action.client);
      return { tool: "definir_client", client: result?.client || action.client };
    }
    return null;
  }

  // Construit, pour un descripteur d'action, l'objet de resultat REEL
  // envoye au modele dans le tour "[RESULTAT_ECRITURE]" — toujours apres
  // que saveOutcome.success est connu (donc apres onAutoSave), jamais avant.
  function buildResultat(captured, saveOutcome) {
    const base = { action: captured.tool, devisId: saveOutcome.devisId, enregistreLe: saveOutcome.enregistreLe };
    if (!saveOutcome.success) return { ...base, success: false, error: saveOutcome.error || "Enregistrement impossible." };
    if (captured.tool === "definir_client") return { ...base, success: true, client: captured.client };
    if (captured.tool === "ajouter_lot") return { ...base, success: true, lotName: captured.lotName };
    if (captured.tool === "supprimer_ouvrage") return { ...base, success: true, id: captured.lineId, supprime: true };
    const ligne = captured.lineId ? findLigne(captured.lineId) : null;
    if (!ligne) return { ...base, success: false, error: "Ligne introuvable après enregistrement — relisez le devis avant de réessayer." };
    return {
      ...base,
      success: true,
      id: ligne.id,
      lot: ligne.lot,
      designation: ligne.designation,
      quantite: ligne.quantite,
      unite: ligne.unite,
      prixUnitaireHt: ligne.prixUnitaireHt,
      totalHt: ligne.totalHt,
      prixManquant: ligne.prixManquant
    };
  }

  // Un seul tour HTTP/SSE vers /api/devis-chat — ne gere ni l'etat
  // "sending" (partage entre plusieurs tours enchaines, voir sendToEngine)
  // ni l'auto-enregistrement : juste l'echange et la collecte des actions
  // appliquees dans CE tour.
  async function runTurn(turnsForThisCall) {
    const captured = [];
    let questions = [];
    let assistantTurn = null;
    const response = await fetch("/api/devis-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // `hidden` est transmis (pas juste role/text) pour que le serveur
        // puisse l'exclure du journal admin (lib/ai-chat-logs.js) — sans
        // ca les tours synthetiques "[RESULTAT_ECRITURE]" s'y retrouveraient.
        turns: pourLeServeur(turnsForThisCall),
        quoteSnapshot: snapshotRef.current,
        conversationId: conversationIdRef.current
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
        } else if (eventType === "action") {
          if (data?.subAction === "askQuestions") {
            questions = Array.isArray(data.questions) ? data.questions : [];
            continue;
          }
          const result = applyAction(data);
          if (result) captured.push(result);
        } else if (eventType === "done") {
          const assistantText = (data.message || liveText || "").trim();
          if (assistantText || questions.length) {
            // Questions oui / non (maquette PRO-03.1) : affichées sous le
            // message, avec les boutons Oui / Non.
            assistantTurn = { role: "assistant", text: assistantText, ...(questions.length ? { questions, reponses: [] } : {}) };
            setTurns((current) => [...current, assistantTurn]);
          }
          setStreamingText("");
          liveText = "";
          if (data.finished) onFinish?.();
        } else if (eventType === "error") {
          setError(data.message || "L'assistant n'a pas pu répondre.");
        }
      }
    }

    return { captured, assistantTurn };
  }

  async function sendToEngine(nextTurns) {
    setSending(true);
    setTravail(REFLEXION);
    totalDebutRef.current = Number(snapshotRef.current?.totaux?.totalHt || 0);
    setError("");
    setStreamingText("");
    setSaveNotice("");

    try {
      const { captured, assistantTurn } = await runTurn(nextTurns);

      // Protocole de confirmation (voir commentaire d'en-tete) : rien
      // d'ecrit dans ce tour -> rien a confirmer, on s'arrete la (c'est
      // aussi ce qui arrive apres le tour "[RESULTAT_ECRITURE]" lui-meme,
      // puisque le modele n'a pas le droit de rappeler un outil en reponse
      // a celui-ci).
      if (!captured.length || !onAutoSave) return;

      let saveOutcome;
      try {
        const quote = await onAutoSave();
        saveOutcome = { success: true, devisId: quote?.id || "", enregistreLe: quote?.updatedAt || "" };
        setSaveNotice("Devis enregistré.");
      } catch (err) {
        saveOutcome = { success: false, error: err?.message || "Enregistrement impossible." };
        setSaveNotice("Modifications appliquées, mais l'enregistrement automatique a échoué — pensez à cliquer sur Enregistrer.");
      }

      const resultats = captured.map((item) => buildResultat(item, saveOutcome));
      const resultTurn = { role: "user", text: `[RESULTAT_ECRITURE] ${JSON.stringify(resultats)}`, hidden: true };
      // Reconstruit l'historique EXACT envoye au serveur a partir de
      // nextTurns + la reponse d'intention du modele (pas de la state React
      // `turns`, mise a jour de façon asynchrone par runTurn — lire le
      // retour direct de runTurn evite toute course avec ces mises a jour).
      const turnsWithAssistant = assistantTurn ? [...nextTurns, assistantTurn] : nextTurns;
      const turnsWithResult = [...turnsWithAssistant, resultTurn];
      setTurns((current) => [...current, resultTurn]);

      // Relance automatique (jamais initiee par l'entreprise) : c'est la
      // reponse du modele a CE tour qui peut enfin confirmer "c'est fait",
      // avec les vraies valeurs de `resultats` — jamais les siennes.
      await runTurn(turnsWithResult);
    } catch (err) {
      setError(err.message || "L'assistant n'a pas pu répondre. Réessayez.");
    } finally {
      setSending(false);
      setTravail(null);
    }
  }

  function handleSubmit(event) {
    event?.preventDefault?.();
    const trimmed = draft.trim();
    if ((!trimmed && !photo) || sending) return;
    recoRef.current?.stop?.();
    const nextTurns = [...turns, { role: "user", text: trimmed, ...(photo ? { photo } : {}) }];
    setTurns(nextTurns);
    setDraft("");
    setPhoto("");
    sendToEngine(nextTurns);
  }

  // Oui / Non d'un clic : la réponse part dès que toutes les questions du
  // message ont la leur ; elle se lit sur les boutons, pas dans une bulle.
  function repondre(index, numero, valeur) {
    const turn = turns[index];
    if (sending || !turn?.questions || turns.slice(index + 1).some((t) => t.role === "user")) return;
    const reponses = [...(turn.reponses || [])];
    reponses[numero] = valeur;
    const updated = turns.map((t, i) => (i === index ? { ...t, reponses } : t));
    if (!toutesRepondues(turn.questions, reponses)) {
      setTurns(updated);
      return;
    }
    const nextTurns = [...updated, { role: "user", text: texteReponses(turn.questions, reponses), chips: true }];
    setTurns(nextTurns);
    sendToEngine(nextTurns);
  }

  function basculerDictee() {
    if (ecoute) {
      recoRef.current?.stop?.();
      return;
    }
    const Reconnaissance = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Reconnaissance) return;
    const reco = new Reconnaissance();
    reco.lang = "fr-FR";
    reco.interimResults = true;
    reco.continuous = false;
    const debut = draft.trim() ? `${draft.trim()} ` : "";
    reco.onresult = (event) => {
      const texte = Array.from(event.results).map((r) => r[0]?.transcript || "").join("");
      setDraft(debut + texte);
    };
    reco.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") setError("Le navigateur refuse l'accès au micro.");
    };
    reco.onend = () => setEcoute(false);
    recoRef.current = reco;
    setError("");
    setEcoute(true);
    reco.start();
  }

  async function choisirPhoto(event) {
    const fichier = event.target.files?.[0];
    event.target.value = "";
    if (!fichier) return;
    try {
      setPhoto(await lirePhoto(fichier));
    } catch (err) {
      setError(err.message || "Photo illisible.");
    }
  }

  // Maquette PRO-03.1 : colonne « Devis guidé » de l'éditeur.
  const peutEnvoyer = !sending && (draft.trim() || photo);
  const totalHt = Number(quoteSnapshot?.totaux?.totalHt || 0);
  const ecart = totalDebutRef.current == null ? "" : ecartTotal(totalDebutRef.current, totalHt);
  const lignesDuDevis = (quoteSnapshot?.lots || []).reduce((n, lot) => n + (lot.lignes || []).length, 0);
  const resumeLignes = lignesDuDevis ? `${lignesDuDevis} ligne${lignesDuDevis > 1 ? "s" : ""} · voir le devis` : "Aucune ligne pour l'instant";
  return (
    <section className="dv-chat" aria-label="Devis guidé avec Koji">
      <div className="dv-chat-h">
        <strong>Devis guidé</strong>
        <span className="muted">Koji chiffre avec toi</span>
      </div>

      <div className="msgs" aria-live="polite">
        {turns.map((turn, index) => {
          if (turn.hidden || turn.chips) return null;
          if (turn.role === "user") {
            return (
              <div key={index} className="msg u">
                {turn.photo ? <img className="msg-photo" src={turn.photo} alt="Photo envoyée à Koji" /> : null}
                {turn.text}
              </div>
            );
          }
          const verrou = sending || turns.slice(index + 1).some((t) => t.role === "user");
          return (
            <div key={index} className="msg-k">
              {turn.text ? <div className="msg k">{turn.text}</div> : null}
              {turn.questions?.length ? (
                <div className="msg k">
                  <div className="qs">
                    {turn.questions.map((question, numero) => {
                      const choix = turn.reponses?.[numero];
                      return (
                        <div className="qrow" key={question}>
                          <span>{question}</span>
                          <span className="qa" role="group" aria-label={question}>
                            {[["Oui", true], ["Non", false]].map(([libelle, valeur]) => (
                              <button
                                key={libelle}
                                type="button"
                                className={`chip${choix === valeur ? " on" : ""}`}
                                aria-pressed={choix === valeur}
                                disabled={verrou}
                                onClick={() => repondre(index, numero, valeur)}
                              >
                                {libelle}
                              </button>
                            ))}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
        {streamingText ? <div className="msg k">{streamingText}</div> : null}
        {sending && !streamingText && travail ? (
          <div className="msg k thinking"><Think />{travail.phrase}</div>
        ) : null}
        <div ref={messagesEndRef} />
      </div>

      {error ? <p className="dv-chat-note err" role="alert">{error}</p> : null}
      {!error && saveNotice ? <p className="dv-chat-note">{saveNotice}</p> : null}

      {photo ? (
        <div className="dv-chat-photo">
          <img src={photo} alt="Photo à envoyer" />
          <span className="muted">Photo jointe au prochain message</span>
          <button type="button" className="dx" onClick={() => setPhoto("")} aria-label="Retirer la photo">×</button>
        </div>
      ) : null}

      {/* <div>, pas <form> : ce panneau est rendu a l'interieur du grand
          <form> de DevisEditor.jsx — un <form> imbrique est invalide en
          HTML (avertissement React, risque de double-soumission). */}
      <div className="composer">
        <button type="button" className="cam" onClick={() => photoInputRef.current?.click()} disabled={sending} aria-label="Joindre une photo du chantier">
          <CamIcon />
        </button>
        <input ref={photoInputRef} type="file" accept="image/*" capture="environment" hidden onChange={choisirPhoto} />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(e); }}
          placeholder="Dis-moi ce qui change, ajoute un ouvrage, pose une question…"
          aria-label="Message pour Koji"
          disabled={sending}
        />
        {dictee ? (
          <button type="button" className={`mic${ecoute ? " on" : ""}`} onClick={basculerDictee} disabled={sending} aria-pressed={ecoute} aria-label={ecoute ? "Arrêter la dictée" : "Dicter un message"}>
            <MicIcon />
          </button>
        ) : null}
        <button type="button" className="send" onClick={handleSubmit} disabled={!peutEnvoyer} aria-label="Envoyer">
          <SendIcon />
        </button>
      </div>

      {/* Téléphone (maquette PRO-03.1) : bandeau du total en bas ; le
          toucher ou le glisser vers le haut ouvre le devis. */}
      <button
        type="button"
        className={`dvm-band${sending && travail ? " live" : ""}`}
        onClick={() => onOpenDevis?.()}
        onTouchStart={(e) => { toucheRef.current = e.touches[0]?.clientY ?? null; }}
        onTouchEnd={(e) => {
          const debut = toucheRef.current;
          toucheRef.current = null;
          if (debut != null && debut - (e.changedTouches[0]?.clientY ?? debut) > 30) onOpenDevis?.();
        }}
        aria-label="Ouvrir le devis"
      >
        {sending && travail ? <Think /> : null}
        <span className="bl">
          <span className="lab">{sending && travail ? travail.lab : "Le devis"}</span>
          <b>{sending && travail ? (travail.texte || "…") : resumeLignes}</b>
        </span>
        <span className="br">
          <span className="lab">Total HT</span>
          <b>{euros(totalHt)}{ecart ? <small>{ecart}</small> : null}</b>
        </span>
        <span className="grab" aria-hidden="true" />
      </button>
    </section>
  );
}
