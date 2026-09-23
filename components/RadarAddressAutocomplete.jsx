"use client";

import { useEffect, useState } from "react";

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

// Extrait de app/client/radar/new/page.jsx (23 septembre) pour etre reutilise
// par le parcours "Creer une offre rapide" — peut etre confirmee de deux
// facons : cliquer une suggestion BAN (adresse geocodee, avec lat/lon pour
// le matching geographique des entreprises), ou taper l'adresse a la main et
// valider avec Entree/le bouton d'envoi si aucune suggestion ne correspond
// — sans ca, un client qui tape une adresse precise sans jamais cliquer de
// suggestion reste bloque sans aucun moyen de continuer (bug remonte le 7
// septembre).
export function RadarAddressAutocomplete({ value, onChange, onSelect, onManualSubmit }) {
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
