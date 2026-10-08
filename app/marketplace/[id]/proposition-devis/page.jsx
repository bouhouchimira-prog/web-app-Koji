"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Shell } from "../../../../components/Shell";
import { apiGet, apiSend } from "../../../../lib/client-api";
import { euro } from "../../../../lib/pricing";

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function blankOuvrage() {
  return { id: uid("ouv"), label: "", quantity: 1, unit: "u", price: 0, needsPrice: false, subOuvrages: [] };
}

function blankSubOuvrage() {
  return { id: uid("sub"), label: "", quantity: 1, unit: "u", price: 0 };
}

function ouvrageTotal(ouvrage) {
  const own = Number(ouvrage.price) || 0;
  const subTotal = (ouvrage.subOuvrages || []).reduce((sum, sub) => sum + (Number(sub.price) || 0), 0);
  return own + subTotal;
}

function lotTotal(lot) {
  if (lot.mode === "resume") return Number(lot.summaryPrice) || 0;
  return (lot.ouvrages || []).reduce((sum, ouvrage) => sum + ouvrageTotal(ouvrage), 0);
}

// Ecran de revue modifiable avant creation reelle du devis (30 sept, demande
// d'Amira) : la fiche de l'offre n'appelle plus /api/estimer-devis
// directement — l'entreprise passe d'abord ici pour renommer/reorganiser les
// lots et ajuster chaque prix (souvent l'IA genere plus de lignes que
// necessaire pour une description courte). "Continuer" envoie la version
// finale a /api/estimer-devis, qui cree le devis reel.
//
// Refonte du 8 octobre (demande d'Amira) : structure a trois niveaux
// Lot -> Ouvrages -> Sous-ouvrages (chaque sous-ouvrage reste independant,
// ajoute/modifie/supprime sans toucher a son ouvrage parent), et un mode
// "resume" par lot qui remplace le detail des ouvrages par un seul texte +
// un prix forfaitaire modifiables — utile quand le detail ligne par ligne
// n'apporte rien pour un lot simple. Le mode est une bascule d'affichage
// uniquement : passer un lot en resume ne supprime jamais ses ouvrages, qui
// reapparaissent intacts si on repasse en detail. C'est le mode choisi au
// moment d'appuyer sur "Continuer" qui determine ce qui est reellement
// envoye a /api/estimer-devis pour ce lot (lignes detaillees, ou une seule
// ligne forfait avec le texte du resume comme intitule).
export default function PropositionDevisPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lots, setLots] = useState([]);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    apiGet(`/api/marketplace/offres/${params.id}/devis-preview`)
      .then((data) => {
        const byRoom = new Map();
        for (const item of data.items || []) {
          const room = item.room || "Général";
          if (!byRoom.has(room)) byRoom.set(room, { id: uid("lot"), name: room, mode: "detail", summary: "", summaryPrice: 0, ouvrages: [] });
          byRoom.get(room).ouvrages.push({
            id: item.id,
            label: item.label,
            quantity: item.quantity,
            unit: item.unit,
            price: item.previewPriceHt,
            needsPrice: item.needsPrice,
            subOuvrages: []
          });
        }
        setLots(Array.from(byRoom.values()));
        setDescription(data.description || "");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const lotNames = useMemo(() => lots.map((l) => l.name), [lots]);

  function updateLot(lotId, patch) {
    setLots((prev) => prev.map((l) => (l.id === lotId ? { ...l, ...(typeof patch === "function" ? patch(l) : patch) } : l)));
  }

  function renameLot(lotId, newName) {
    updateLot(lotId, { name: newName });
  }

  function addLot() {
    setLots((prev) => [...prev, { id: uid("lot"), name: "Nouveau lot", mode: "detail", summary: "", summaryPrice: 0, ouvrages: [] }]);
  }

  function removeLot(lotId) {
    setLots((prev) => prev.filter((l) => l.id !== lotId));
  }

  function setLotMode(lotId, mode) {
    updateLot(lotId, (lot) => {
      if (mode === "resume" && !lot.summary && !lot.summaryPrice) {
        return { mode, summary: lot.name, summaryPrice: lotTotal(lot) };
      }
      return { mode };
    });
  }

  function addOuvrage(lotId) {
    updateLot(lotId, (lot) => ({ ouvrages: [...lot.ouvrages, blankOuvrage()] }));
  }

  function editOuvrage(lotId, ouvrageId, field, value) {
    updateLot(lotId, (lot) => ({
      ouvrages: lot.ouvrages.map((o) => (o.id === ouvrageId ? { ...o, [field]: value } : o))
    }));
  }

  function deleteOuvrage(lotId, ouvrageId) {
    updateLot(lotId, (lot) => ({ ouvrages: lot.ouvrages.filter((o) => o.id !== ouvrageId) }));
  }

  function moveOuvrage(fromLotId, ouvrageId, toLotName) {
    setLots((prev) => {
      const fromLot = prev.find((l) => l.id === fromLotId);
      const ouvrage = fromLot?.ouvrages.find((o) => o.id === ouvrageId);
      if (!ouvrage) return prev;
      let next = prev.map((l) => (l.id === fromLotId ? { ...l, ouvrages: l.ouvrages.filter((o) => o.id !== ouvrageId) } : l));
      const targetExists = next.some((l) => l.name === toLotName);
      if (targetExists) {
        next = next.map((l) => (l.name === toLotName ? { ...l, ouvrages: [...l.ouvrages, ouvrage] } : l));
      } else {
        next = [...next, { id: uid("lot"), name: toLotName, mode: "detail", summary: "", summaryPrice: 0, ouvrages: [ouvrage] }];
      }
      return next;
    });
  }

  function addSubOuvrage(lotId, ouvrageId) {
    updateLot(lotId, (lot) => ({
      ouvrages: lot.ouvrages.map((o) => (o.id === ouvrageId ? { ...o, subOuvrages: [...o.subOuvrages, blankSubOuvrage()] } : o))
    }));
  }

  function editSubOuvrage(lotId, ouvrageId, subId, field, value) {
    updateLot(lotId, (lot) => ({
      ouvrages: lot.ouvrages.map((o) =>
        o.id !== ouvrageId
          ? o
          : { ...o, subOuvrages: o.subOuvrages.map((s) => (s.id === subId ? { ...s, [field]: value } : s)) }
      )
    }));
  }

  function deleteSubOuvrage(lotId, ouvrageId, subId) {
    updateLot(lotId, (lot) => ({
      ouvrages: lot.ouvrages.map((o) =>
        o.id !== ouvrageId ? o : { ...o, subOuvrages: o.subOuvrages.filter((s) => s.id !== subId) }
      )
    }));
  }

  async function handleContinue() {
    setSubmitting(true);
    setSubmitError("");
    try {
      const items = [];
      for (const lot of lots) {
        if (lot.mode === "resume") {
          const label = (lot.summary || "").trim() || lot.name;
          const price = Math.max(0, Number(lot.summaryPrice) || 0);
          if (!label && !price) continue;
          items.push({
            id: uid("item"),
            label,
            room: lot.name,
            quantity: 1,
            unit: "forfait",
            billingMode: "fixed",
            fixedAmountHt: price,
            priceSource: "manuel",
            needsPrice: false
          });
          continue;
        }
        for (const ouvrage of lot.ouvrages) {
          if (!ouvrage.label.trim()) continue;
          items.push({
            id: ouvrage.id,
            label: ouvrage.label,
            room: lot.name,
            quantity: Math.max(0, Number(ouvrage.quantity) || 0),
            unit: ouvrage.unit || "u",
            billingMode: "fixed",
            fixedAmountHt: Math.max(0, Number(ouvrage.price) || 0),
            priceSource: "manuel",
            needsPrice: false
          });
          for (const sub of ouvrage.subOuvrages) {
            if (!sub.label.trim()) continue;
            items.push({
              id: sub.id,
              label: sub.label,
              room: lot.name,
              quantity: Math.max(0, Number(sub.quantity) || 0),
              unit: sub.unit || "u",
              billingMode: "fixed",
              fixedAmountHt: Math.max(0, Number(sub.price) || 0),
              priceSource: "manuel",
              needsPrice: false
            });
          }
        }
      }
      if (items.length === 0) {
        setSubmitError("Ajoutez au moins une ligne avant de continuer.");
        setSubmitting(false);
        return;
      }
      const rooms = Array.from(new Set(items.map((it) => it.room)));
      const data = await apiSend("/api/estimer-devis", { chantierOffreId: params.id, rooms, items });
      router.push(`/devis?id=${data.quote.id}`);
    } catch (err) {
      setSubmitError(err.message);
      setSubmitting(false);
    }
  }

  const total = lots.reduce((sum, l) => sum + lotTotal(l), 0);

  return (
    <Shell>
      <section className="mobile-tool">
        <header className="tool-topline">
          <button type="button" className="plain-back" onClick={() => router.push(`/marketplace/${params.id}`)}>{"<"}</button>
          <h1>Proposition de devis</h1>
          <span />
        </header>

        {loading ? <div className="tool-empty">Chargement…</div> : null}
        {!loading && error ? <div className="tool-empty">{error}</div> : null}

        {!loading && !error ? (
          <>
            <p className="radar-recap-note" style={{ margin: "0 0 14px" }}>
              Ajustez les lots et les prix avant de créer le devis. {description ? description.slice(0, 140) : ""}
            </p>

            {lots.map((lot) => (
              <div className="devis-lot-card" key={lot.id}>
                <div className="devis-lot-header">
                  <input
                    className="devis-lot-name"
                    value={lot.name}
                    onChange={(e) => renameLot(lot.id, e.target.value)}
                  />
                  <span className="devis-lot-total">{euro(lotTotal(lot))}</span>
                  <button
                    type="button"
                    className="devis-lot-delete"
                    onClick={() => removeLot(lot.id)}
                    disabled={lot.ouvrages.length > 0}
                    aria-label="Supprimer le lot"
                    title={lot.ouvrages.length > 0 ? "Videz d'abord le lot pour le supprimer" : "Supprimer le lot"}
                  >
                    ×
                  </button>
                </div>

                <div className="devis-mode-switch" role="tablist" aria-label="Affichage du lot">
                  <button type="button" className={lot.mode !== "resume" ? "active" : ""} onClick={() => setLotMode(lot.id, "detail")}>
                    Détail
                  </button>
                  <button type="button" className={lot.mode === "resume" ? "active" : ""} onClick={() => setLotMode(lot.id, "resume")}>
                    Résumé
                  </button>
                </div>

                {lot.mode === "resume" ? (
                  <div className="devis-summary-block">
                    <textarea
                      className="devis-summary-textarea"
                      value={lot.summary}
                      onChange={(e) => updateLot(lot.id, { summary: e.target.value })}
                      placeholder="Décrivez ce lot en une phrase…"
                    />
                    <div className="devis-summary-price-row">
                      <label htmlFor={`summary-price-${lot.id}`}>Prix forfaitaire</label>
                      <input
                        id={`summary-price-${lot.id}`}
                        className="devis-field devis-field-price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={lot.summaryPrice}
                        onChange={(e) => updateLot(lot.id, { summaryPrice: e.target.value })}
                      />
                      <span className="devis-currency">€ HT</span>
                    </div>
                  </div>
                ) : (
                  <>
                    {lot.ouvrages.length === 0 ? <p className="devis-lot-empty">Aucun ouvrage dans ce lot.</p> : null}

                    {lot.ouvrages.map((ouvrage) => (
                      <div className="devis-ouvrage" key={ouvrage.id}>
                        <div className="devis-ouvrage-row">
                          <input
                            className="devis-field devis-field-label"
                            value={ouvrage.label}
                            onChange={(e) => editOuvrage(lot.id, ouvrage.id, "label", e.target.value)}
                            placeholder="Intitulé de l'ouvrage"
                          />
                          <input
                            className="devis-field devis-field-qty"
                            type="number"
                            min="0"
                            step="1"
                            value={ouvrage.quantity}
                            onChange={(e) => editOuvrage(lot.id, ouvrage.id, "quantity", e.target.value)}
                            aria-label="Quantité"
                          />
                          <input
                            className="devis-field devis-field-unit"
                            value={ouvrage.unit}
                            onChange={(e) => editOuvrage(lot.id, ouvrage.id, "unit", e.target.value)}
                            aria-label="Unité"
                          />
                          <input
                            className={`devis-field devis-field-price ${ouvrage.needsPrice ? "devis-field-needs-price" : ""}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={ouvrage.price}
                            onChange={(e) => editOuvrage(lot.id, ouvrage.id, "price", e.target.value)}
                            aria-label="Prix HT"
                          />
                          <span className="devis-currency">€ HT</span>
                          <select
                            className="devis-move-select"
                            value={lot.name}
                            onChange={(e) => moveOuvrage(lot.id, ouvrage.id, e.target.value)}
                            aria-label="Déplacer vers un autre lot"
                          >
                            {lotNames.map((name) => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="devis-icon-btn"
                            onClick={() => deleteOuvrage(lot.id, ouvrage.id)}
                            aria-label="Supprimer l'ouvrage"
                          >
                            ×
                          </button>
                          {ouvrage.needsPrice ? <small className="devis-needs-price-note">Prix manquant dans notre base — à compléter.</small> : null}
                        </div>

                        {ouvrage.subOuvrages.length > 0 ? (
                          <div className="devis-subouvrages">
                            {ouvrage.subOuvrages.map((sub) => (
                              <div className="devis-subouvrage-row" key={sub.id}>
                                <input
                                  className="devis-field devis-field-label"
                                  value={sub.label}
                                  onChange={(e) => editSubOuvrage(lot.id, ouvrage.id, sub.id, "label", e.target.value)}
                                  placeholder="Intitulé du sous-ouvrage"
                                />
                                <input
                                  className="devis-field devis-field-qty"
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={sub.quantity}
                                  onChange={(e) => editSubOuvrage(lot.id, ouvrage.id, sub.id, "quantity", e.target.value)}
                                  aria-label="Quantité"
                                />
                                <input
                                  className="devis-field devis-field-unit"
                                  value={sub.unit}
                                  onChange={(e) => editSubOuvrage(lot.id, ouvrage.id, sub.id, "unit", e.target.value)}
                                  aria-label="Unité"
                                />
                                <input
                                  className="devis-field devis-field-price"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={sub.price}
                                  onChange={(e) => editSubOuvrage(lot.id, ouvrage.id, sub.id, "price", e.target.value)}
                                  aria-label="Prix HT"
                                />
                                <span className="devis-currency">€ HT</span>
                                <button
                                  type="button"
                                  className="devis-icon-btn"
                                  onClick={() => deleteSubOuvrage(lot.id, ouvrage.id, sub.id)}
                                  aria-label="Supprimer le sous-ouvrage"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        <button type="button" className="devis-add-sub-btn" onClick={() => addSubOuvrage(lot.id, ouvrage.id)}>
                          + Sous-ouvrage
                        </button>
                      </div>
                    ))}

                    <button type="button" className="devis-add-ouvrage-btn" onClick={() => addOuvrage(lot.id)}>
                      + Nouvel ouvrage
                    </button>
                  </>
                )}
              </div>
            ))}

            <button type="button" className="button secondary" style={{ marginBottom: 14 }} onClick={addLot}>
              + Nouveau lot
            </button>

            <div className="radar-recap-card" style={{ marginBottom: 14 }}>
              <div className="radar-recap-row"><span>Total HT</span><strong>{euro(total)}</strong></div>
            </div>

            {submitError ? <p className="profile-message error" style={{ marginBottom: 14 }}>{submitError}</p> : null}

            <button
              type="button"
              className="radar-contact-btn radar-contact-btn-primary"
              style={{ width: "100%" }}
              onClick={handleContinue}
              disabled={submitting}
            >
              <span>
                <strong>{submitting ? "Création du devis…" : "Continuer vers le devis"}</strong>
                <small>Le devis final reste modifiable dans l'éditeur</small>
              </span>
            </button>
          </>
        ) : null}
      </section>
    </Shell>
  );
}
