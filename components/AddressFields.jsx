"use client";

import { useEffect, useState } from "react";

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s7-6.6 7-11.5A7 7 0 105 9.5C5 14.4 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

export const EMPTY_ADDRESS_FIELDS = {
  address: "",
  city: "",
  postalCode: "",
  floor: "",
  accessCode: "",
  complement: "",
  accessInstructions: ""
};

// Bloc adresse reutilisable (contact, profil entreprise...) : rue (avec
// autocompletion BAN, meme API que la zone de travail Radar des Chantiers)
// + ville + code postal toujours visibles, et une section repliable pour
// les infos complementaires (etage, digicode, complement, instructions
// d'acces) — repliee par defaut pour ne pas alourdir un formulaire qui n'en
// a pas toujours besoin.
export function AddressFields({ value, onChange }) {
  const v = { ...EMPTY_ADDRESS_FIELDS, ...value };
  const [suggestions, setSuggestions] = useState([]);
  const [expanded, setExpanded] = useState(
    Boolean(v.floor || v.accessCode || v.complement || v.accessInstructions)
  );

  function patch(fields) {
    onChange({ ...v, ...fields });
  }

  useEffect(() => {
    const query = (v.address || "").trim();
    if (query.length < 3) { setSuggestions([]); return; }
    const handle = setTimeout(() => {
      fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5`)
        .then((r) => r.json())
        .then((data) => setSuggestions(data.features || []))
        .catch(() => setSuggestions([]));
    }, 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.address]);

  function selectSuggestion(feature) {
    patch({
      address: feature.properties.name || feature.properties.label,
      city: feature.properties.city || v.city,
      postalCode: feature.properties.postcode || v.postalCode
    });
    setSuggestions([]);
  }

  return (
    <div className="address-fields">
      <label className="radar-field radar-address-field">
        <span>Adresse</span>
        <input
          type="text"
          value={v.address}
          onChange={(event) => patch({ address: event.target.value })}
          placeholder="Numéro et rue"
          autoComplete="off"
        />
        {suggestions.length > 0 ? (
          <ul className="radar-address-suggestions">
            {suggestions.map((feature) => (
              <li key={feature.properties.id}>
                <button type="button" onClick={() => selectSuggestion(feature)}>
                  <PinIcon />
                  {feature.properties.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </label>

      <div className="address-fields-row">
        <label className="radar-field">
          <span>Ville</span>
          <input type="text" value={v.city} onChange={(event) => patch({ city: event.target.value })} placeholder="Paris" />
        </label>
        <label className="radar-field address-fields-narrow">
          <span>Code postal</span>
          <input type="text" value={v.postalCode} onChange={(event) => patch({ postalCode: event.target.value })} placeholder="75010" />
        </label>
      </div>

      <button type="button" className="address-fields-toggle" onClick={() => setExpanded((current) => !current)}>
        {expanded ? "− Masquer les infos complémentaires" : "+ Étage, digicode, autres infos"}
      </button>

      {expanded ? (
        <div className="address-fields-extra">
          <div className="address-fields-row">
            <label className="radar-field">
              <span>Étage</span>
              <input type="text" value={v.floor} onChange={(event) => patch({ floor: event.target.value })} placeholder="3ème, RDC..." />
            </label>
            <label className="radar-field">
              <span>Digicode / interphone</span>
              <input type="text" value={v.accessCode} onChange={(event) => patch({ accessCode: event.target.value })} placeholder="A1234" />
            </label>
          </div>
          <label className="radar-field">
            <span>Complément d'adresse</span>
            <input type="text" value={v.complement} onChange={(event) => patch({ complement: event.target.value })} placeholder="Bâtiment, escalier, appartement..." />
          </label>
          <label className="radar-field">
            <span>Instructions d'accès</span>
            <textarea rows={2} value={v.accessInstructions} onChange={(event) => patch({ accessInstructions: event.target.value })} placeholder="Ex : sonner deux fois, portail bleu..." />
          </label>
        </div>
      ) : null}
    </div>
  );
}
