"use client";

import { useEffect, useState } from "react";
import { apiGet } from "../lib/client-api";

// Petite fenetre "Envoyer a un contact deja engage via la Marketplace"
// (23 oct, page Recapitulatif du devis) — charge
// /api/marketplace/mes-chantiers (nouveau, voir ce fichier) : uniquement
// les chantiers ou l'entreprise est positionnee ET le RDV est confirme
// (coordonnees reelles disponibles). Au clic, `onPick` renvoie
// {clientName, clientEmail, clientPhone} pour pre-remplir le devis.
export function MarketplaceContactPicker({ onClose, onPick }) {
  const [chantiers, setChantiers] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    apiGet("/api/marketplace/mes-chantiers")
      .then((data) => { if (!cancelled) setChantiers(data.chantiers || []); })
      .catch((err) => { if (!cancelled) setError(err.message || "Impossible de charger vos chantiers Marketplace."); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="mini-modal" onClick={(event) => event.stopPropagation()}>
        <h2>Contact déjà engagé via la Marketplace</h2>
        <p className="muted">Seuls les chantiers avec un RDV confirmé apparaissent ici — ce sont les seuls dont vous avez les vraies coordonnées.</p>

        {error ? <p className="auth-error">{error}</p> : null}
        {!error && chantiers === null ? <p className="muted">Chargement…</p> : null}
        {!error && chantiers && chantiers.length === 0 ? (
          <p className="muted">Aucun chantier avec un RDV confirmé pour l'instant.</p>
        ) : null}

        {chantiers && chantiers.length > 0 ? (
          <div className="marketplace-picker-list">
            {chantiers.map((chantier) => (
              <button
                type="button"
                key={chantier.offerId}
                className="marketplace-picker-row"
                onClick={() => onPick(chantier)}
              >
                <strong>{chantier.clientName}</strong>
                <small>{chantier.description || chantier.address}</small>
                <small>{[chantier.clientPhone, chantier.clientEmail].filter(Boolean).join(" · ")}</small>
              </button>
            ))}
          </div>
        ) : null}

        <div className="supply-modal-actions">
          <button type="button" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}
