"use client";

import { useEffect, useRef, useState } from "react";

// Chat "Avec l'IA" du devis (16 oct, maquette Artifact DevisCreerIA) —
// lecture du flux SSE calquee sur app/client/radar/new-chat/page.jsx (meme
// boucle de lecture par trames), simplifiee : pas de choix a cocher ni de
// demande de photo pour cette premiere version (texte libre uniquement).
// Chaque evenement "action" recu est applique IMMEDIATEMENT sur le devis
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

const FIRST_MESSAGE = "Bonjour, décrivez-moi le chantier du client en quelques mots. Je prépare le devis pendant que vous parlez.";

export function DevisChatPanel({ quoteSnapshot, onAddLot, onAddOuvrage, onUpdateOuvrage, onRemoveOuvrage, onSetPrice, onSetClient, onFinish, onAutoSave }) {
  const [turns, setTurns] = useState(() => [{ role: "assistant", text: FIRST_MESSAGE }]);
  const [draft, setDraft] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
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
  }, [turns, streamingText]);

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
    let assistantText = "";
    const response = await fetch("/api/devis-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // `hidden` est transmis (pas juste role/text) pour que le serveur
        // puisse l'exclure du journal admin (lib/ai-chat-logs.js) — sans
        // ca les tours synthetiques "[RESULTAT_ECRITURE]" s'y retrouveraient.
        turns: turnsForThisCall.map(({ role, text, hidden }) => (hidden ? { role, text, hidden } : { role, text })),
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
          const result = applyAction(data);
          if (result) captured.push(result);
        } else if (eventType === "done") {
          assistantText = (data.message || liveText || "").trim();
          if (assistantText) setTurns((current) => [...current, { role: "assistant", text: assistantText }]);
          setStreamingText("");
          if (data.finished) onFinish?.();
        } else if (eventType === "error") {
          setError(data.message || "L'assistant n'a pas pu répondre.");
        }
      }
    }

    return { captured, assistantText };
  }

  async function sendToEngine(nextTurns) {
    setSending(true);
    setError("");
    setStreamingText("");
    setSaveNotice("");

    try {
      const { captured, assistantText } = await runTurn(nextTurns);

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
      const turnsWithAssistant = assistantText ? [...nextTurns, { role: "assistant", text: assistantText }] : nextTurns;
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
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || sending) return;
    const nextTurns = [...turns, { role: "user", text: trimmed }];
    setTurns(nextTurns);
    setDraft("");
    sendToEngine(nextTurns);
  }

  // Maquette PRO-03.1 : colonne « Devis guidé » de l'éditeur.
  return (
    <section className="dv-chat" aria-label="Devis guidé avec Koji">
      <div className="dv-chat-h">
        <strong>Devis guidé</strong>
        <span className="muted">Koji chiffre avec vous</span>
        <span className={`tag ${sending ? "tag-b" : "tag-o"}`}>{sending ? "En cours" : "Prêt"}</span>
      </div>

      <div className="msgs" aria-live="polite">
        {turns.filter((turn) => !turn.hidden).map((turn, index) => (
          <div key={index} className={`msg ${turn.role === "user" ? "u" : "k"}`}>{turn.text}</div>
        ))}
        {streamingText ? <div className="msg k">{streamingText}</div> : null}
        <div ref={messagesEndRef} />
      </div>

      {error ? <p className="dv-chat-note err" role="alert">{error}</p> : null}
      {!error && saveNotice ? <p className="dv-chat-note">{saveNotice}</p> : null}

      {/* <div>, pas <form> : ce panneau est rendu a l'interieur du grand
          <form> de DevisEditor.jsx — un <form> imbrique est invalide en
          HTML (avertissement React, risque de double-soumission). */}
      <div className="composer">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(e); }}
          placeholder="Dites ce qui change, ajoutez un ouvrage, posez une question…"
          aria-label="Message pour Koji"
          disabled={sending}
        />
        <button type="button" className="send" onClick={handleSubmit} disabled={sending || !draft.trim()} aria-label="Envoyer">
          <SendIcon />
        </button>
      </div>
    </section>
  );
}
