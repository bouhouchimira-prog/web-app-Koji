"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Shell } from "../../../../components/Shell";
import { apiGet, apiSend } from "../../../../lib/client-api";
import { euro } from "../../../../lib/pricing";

function uid() {
  return `lot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Ecran de revue modifiable avant creation reelle du devis (30 sept, demande
// d'Amira) : la fiche de l'offre n'appelle plus /api/estimer-devis
// directement — l'entreprise passe d'abord ici pour renommer/reorganiser les
// lots et ajuster chaque prix (souvent l'IA genere plus de lignes que
// necessaire pour une description courte). "Continuer" envoie la version
// finale a /api/estimer-devis, qui cree le devis reel.
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
          if (!byRoom.has(room)) byRoom.set(room, { id: uid(), name: room, items: [] });
          byRoom.get(room).items.push({
            id: item.id,
            label: item.label,
            quantity: item.quantity,
            unit: item.unit,
            price: item.previewPriceHt,
            needsPrice: item.needsPrice
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

  function renameLot(lotId, newName) {
    setLots((prev) => prev.map((l) => (l.id === lotId ? { ...l, name: newName } : l)));
  }

  function addLot() {
    setLots((prev) => [...prev, { id: uid(), name: "Nouveau lot", items: [] }]);
  }

  function removeLot(lotId) {
    setLots((prev) => prev.filter((l) => l.id !== lotId));
  }

  function editLine(lotId, itemId, field, value) {
    setLots((prev) =>
      prev.map((l) =>
        l.id !== lotId
          ? l
          : { ...l, items: l.items.map((it) => (it.id === itemId ? { ...it, [field]: value } : it)) }
      )
    );
  }

  function deleteLine(lotId, itemId) {
    setLots((prev) => prev.map((l) => (l.id === lotId ? { ...l, items: l.items.filter((it) => it.id !== itemId) } : l)));
  }

  function moveLine(fromLotId, itemId, toLotName) {
    setLots((prev) => {
      const fromLot = prev.find((l) => l.id === fromLotId);
      const item = fromLot?.items.find((it) => it.id === itemId);
      if (!item) return prev;
      let next = prev.map((l) => (l.id === fromLotId ? { ...l, items: l.items.filter((it) => it.id !== itemId) } : l));
      const targetExists = next.some((l) => l.name === toLotName);
      if (targetExists) {
        next = next.map((l) => (l.name === toLotName ? { ...l, items: [...l.items, item] } : l));
      } else {
        next = [...next, { id: uid(), name: toLotName, items: [item] }];
      }
      return next;
    });
  }

  async function handleContinue() {
    setSubmitting(true);
    setSubmitError("");
    try {
      const nonEmptyLots = lots.filter((l) => l.items.length > 0);
      if (nonEmptyLots.length === 0) {
        setSubmitError("Ajoutez au moins une ligne avant de continuer.");
        setSubmitting(false);
        return;
      }
      const rooms = nonEmptyLots.map((l) => l.name);
      const items = nonEmptyLots.flatMap((l) =>
        l.items.map((it) => ({
          id: it.id,
          label: it.label,
          room: l.name,
          quantity: Math.max(0, Number(it.quantity) || 0),
          unit: it.unit || "u",
          billingMode: "fixed",
          fixedAmountHt: Math.max(0, Number(it.price) || 0),
          priceSource: "manuel",
          needsPrice: false
        }))
      );
      const data = await apiSend("/api/estimer-devis", { chantierOffreId: params.id, rooms, items });
      router.push(`/devis?id=${data.quote.id}`);
    } catch (err) {
      setSubmitError(err.message);
      setSubmitting(false);
    }
  }

  const total = lots.reduce((sum, l) => sum + l.items.reduce((s, it) => s + (Number(it.price) || 0), 0), 0);

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
              <div className="radar-recap-card" key={lot.id} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <input
                    value={lot.name}
                    onChange={(e) => renameLot(lot.id, e.target.value)}
                    style={{ flex: 1, fontWeight: 600, fontSize: 15, border: "1px solid var(--border, #ddd)", borderRadius: 8, padding: "6px 10px" }}
                  />
                  <button type="button" className="button secondary" onClick={() => removeLot(lot.id)} disabled={lot.items.length > 0}>
                    Supprimer le lot
                  </button>
                </div>

                {lot.items.length === 0 ? (
                  <p className="radar-chat-empty" style={{ margin: 0 }}>Aucune ligne dans ce lot.</p>
                ) : null}

                {lot.items.map((item) => (
                  <div
                    key={item.id}
                    style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "8px 0", borderTop: "1px solid var(--border, #eee)" }}
                  >
                    <input
                      value={item.label}
                      onChange={(e) => editLine(lot.id, item.id, "label", e.target.value)}
                      style={{ flex: "1 1 220px", border: "1px solid var(--border, #ddd)", borderRadius: 8, padding: "6px 10px" }}
                    />
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={item.quantity}
                      onChange={(e) => editLine(lot.id, item.id, "quantity", e.target.value)}
                      style={{ width: 64, border: "1px solid var(--border, #ddd)", borderRadius: 8, padding: "6px 8px" }}
                      aria-label="Quantité"
                    />
                    <input
                      value={item.unit}
                      onChange={(e) => editLine(lot.id, item.id, "unit", e.target.value)}
                      style={{ width: 56, border: "1px solid var(--border, #ddd)", borderRadius: 8, padding: "6px 8px" }}
                      aria-label="Unité"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.price}
                      onChange={(e) => editLine(lot.id, item.id, "price", e.target.value)}
                      style={{ width: 100, border: item.needsPrice ? "1px solid #e07a2f" : "1px solid var(--border, #ddd)", borderRadius: 8, padding: "6px 8px" }}
                      aria-label="Prix HT"
                    />
                    <span style={{ fontSize: 13 }}>€ HT</span>
                    <select
                      value={lot.name}
                      onChange={(e) => moveLine(lot.id, item.id, e.target.value)}
                      style={{ border: "1px solid var(--border, #ddd)", borderRadius: 8, padding: "6px 8px" }}
                      aria-label="Déplacer vers un autre lot"
                    >
                      {lotNames.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                    <button type="button" className="button secondary" onClick={() => deleteLine(lot.id, item.id)} aria-label="Supprimer la ligne">
                      ×
                    </button>
                    {item.needsPrice ? <small style={{ color: "#e07a2f", width: "100%" }}>Prix manquant dans notre base — à compléter.</small> : null}
                  </div>
                ))}
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
