"use client";

import { useState } from "react";

// Presentation standard des questions a choix de l'assistant koji (10 oct,
// specification precise d'Amira) — liste verticale a selection multiple,
// jamais de grandes cartes cote a cote. Utilise par le nouveau chat 100%
// IA (app/client/radar/new-chat/page.jsx), appelee par l'outil
// proposer_choix (app/api/radar-chat/route.js, evenement SSE "choice").
// Styles dans app/globals.css (.choice-list-*) — ce bleu marine specifique
// du logo (#16233F) est distinct de --navy (#000b28) deja utilise ailleurs
// dans l'app, defini une seule fois dans ces classes plutot qu'en variable
// globale partagee.

const UNKNOWN_OPTION = "Je ne sais pas";
const OTHER_OPTION = "Autre, précisez";

function Row({ label, selected, onClick }) {
  return (
    <button type="button" className={`choice-list-row ${selected ? "selected" : ""}`} onClick={onClick}>
      <span className="choice-list-checkbox" aria-hidden="true">
        {selected ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : null}
      </span>
      <span className="choice-list-label">{label}</span>
    </button>
  );
}

// `onSubmit` recoit le texte final a envoyer dans le chat, exactement
// comme une reponse tapee par le client (ex: "Électricité, Peinture").
// `separator` : jointure des libelles selectionnes en choix multiple —
// ", " par defaut (nouveau chat), mais l'ancien parcours
// (app/client/radar/new/page.jsx) a besoin de " • " pour rester compatible
// avec le court-circuit sans IA cote serveur (MULTI_SELECT_SEPARATOR,
// app/api/radar-assistant/route.js) qui attend EXACTEMENT ce separateur.
export default function ChoiceList({ question, options, multiple, allowUnknown = true, allowOther = true, separator = ", ", onSubmit, onRestart, disabled }) {
  const [selected, setSelected] = useState(new Set());
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherText, setOtherText] = useState("");

  const allOptions = [...options, ...(allowUnknown ? [UNKNOWN_OPTION] : []), ...(allowOther ? [OTHER_OPTION] : [])];

  function submitWith(labels) {
    const text = labels.join(separator);
    if (!text.trim()) return;
    onSubmit(text);
  }

  function toggle(option) {
    if (disabled) return;
    if (option === OTHER_OPTION) {
      // Un second clic sur "Autre, précisez" referme le champ de saisie
      // (12 oct, bug remonte par Amira : impossible de se deselectionner).
      if (otherOpen) {
        setOtherOpen(false);
        setOtherText("");
      } else {
        setOtherOpen(true);
        setSelected(new Set());
      }
      return;
    }
    if (!multiple) {
      submitWith([option]);
      return;
    }
    if (option === UNKNOWN_OPTION) {
      setSelected((current) => (current.has(UNKNOWN_OPTION) ? new Set() : new Set([UNKNOWN_OPTION])));
      setOtherOpen(false);
      return;
    }
    setSelected((current) => {
      const next = new Set(current);
      next.delete(UNKNOWN_OPTION);
      if (next.has(option)) next.delete(option); else next.add(option);
      return next;
    });
  }

  function validate() {
    if (otherOpen && otherText.trim()) { submitWith([otherText.trim()]); return; }
    if (selected.size > 0) submitWith([...selected]);
  }

  const count = selected.size + (otherOpen && otherText.trim() ? 1 : 0);

  return (
    <div className="choice-list">
      {question ? <p className="choice-list-question">{question}</p> : null}
      <div className="choice-list-rows">
        {allOptions.map((option) => (
          <Row
            key={option}
            label={option}
            selected={option === OTHER_OPTION ? otherOpen : selected.has(option)}
            onClick={() => toggle(option)}
          />
        ))}
      </div>

      {otherOpen ? (
        <input
          type="text"
          className="choice-list-other-input"
          value={otherText}
          onChange={(e) => setOtherText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); validate(); } }}
          placeholder="Précisez…"
          disabled={disabled}
          autoFocus
        />
      ) : null}

      {multiple || otherOpen ? (
        <button type="button" className="choice-list-validate" onClick={validate} disabled={disabled || count === 0}>
          Valider ma sélection {multiple && count > 0 ? `(${count})` : ""} <span aria-hidden="true">→</span>
        </button>
      ) : null}

      {onRestart ? (
        <button type="button" className="choice-list-restart" onClick={onRestart} disabled={disabled}>
          Recommencer
        </button>
      ) : null}
    </div>
  );
}
