"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Shell } from "../../../../components/Shell";
import { apiGet, apiSend } from "../../../../lib/client-api";
import {
  VISITE_METIERS,
  METRE_FIELDS_BY_METIER,
  ETAT_CONSTATE_OPTIONS,
  FINITION_DEMANDEE_OPTIONS,
  ACCES_OPTIONS,
  metierByKey,
  timestampedAnswer
} from "../../../../lib/visite-tree";
import { matchMetierFromVocabulaire } from "../../../../lib/renovation-question-bank";

// Assistant de visite guidee (12 septembre) — remplace le bouton "Creer mon
// devis" instantane a l'etape ou l'entreprise positionnee visite le
// chantier. Arbre de questions FIXE par metier (lib/visite-tree.js), pas
// improvise par une IA (comme app/api/radar-assistant/route.js) : chaque
// piece passe par la meme sous-sequence (photos -> metre -> etat constate
// -> finitions demandees -> acces -> remarques). Tout reste en etat local
// jusqu'a la generation finale, un seul appel serveur
// (app/api/marketplace/offres/[id]/visite/route.js) qui chiffre de facon
// deterministe (temps x taux horaire de la personne, bibliotheque de prix)
// et cree le devis dans l'editeur existant.
const PIECE_STEPS = ["photos", "metre", "etat", "finitions", "acces", "remarques"];

function readAsDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

// Meme dictionnaire de vocabulaire que le reste de l'app (29 sept) — reprend
// directement le metier deja identifie par l'offre (offre.metier, un des 10
// metiers de RENOVATION_METIERS) quand il correspond a une entree de
// VISITE_METIERS, sinon retente une reconnaissance par mots-cles sur le
// libelle libre. Repli sur Plombier (ancien "plomberie_carrelage") faute de
// mieux, comme avant.
function guessMetier(offreMetier) {
  const direct = VISITE_METIERS.find((m) => m.key === offreMetier);
  if (direct) return direct.key;
  const vocabularyMatch = matchMetierFromVocabulaire(offreMetier);
  if (vocabularyMatch && VISITE_METIERS.find((m) => m.key === vocabularyMatch)) return vocabularyMatch;
  return "Plombier";
}

function emptyPieceDraft(id) {
  return {
    id,
    nom: "",
    metier: "",
    photos: [],
    metre: { fields: {} },
    etatConstate: null,
    finitionsDemandees: null,
    finitionsPrecision: null,
    acces: null,
    remarques: null
  };
}

function matchRulesLocally(remarque) {
  if (!remarque) return [];
  const text = String(remarque);
  const found = [];
  if (/infiltration|humidit[ée]/i.test(text)) found.push({ ruleId: "infiltration", label: "Traitement anti-humidité" });
  if (/fissure/i.test(text)) found.push({ ruleId: "fissure", label: "Reprise de fissures avant finition" });
  if (/amiante/i.test(text)) found.push({ ruleId: "amiante", label: "Diagnostic amiante avant travaux" });
  return found;
}

export default function VisiteGuideePage() {
  const params = useParams();
  const router = useRouter();
  const offerId = params.id;

  const [phase, setPhase] = useState("intro"); // intro | pieces | piece-questions | suggestions | generating
  const [error, setError] = useState("");
  const [offre, setOffre] = useState(null);
  const [metier, setMetier] = useState("");
  const [workers, setWorkers] = useState([]);
  const [workerId, setWorkerId] = useState("");
  const [pieces, setPieces] = useState([]);
  const [newPieceName, setNewPieceName] = useState("");
  const [currentPiece, setCurrentPiece] = useState(null);
  const [pieceStepIndex, setPieceStepIndex] = useState(0);
  const [suggestions, setSuggestions] = useState([]);
  const [acceptedSuggestionIds, setAcceptedSuggestionIds] = useState(new Set());

  useEffect(() => {
    apiGet(`/api/marketplace/offres/${offerId}`)
      .then((data) => {
        const o = data.offre || data;
        setOffre(o);
        setMetier(guessMetier(o?.metier));
      })
      .catch(() => {});
    apiGet("/api/workers")
      .then((data) => setWorkers(data.workers || []))
      .catch(() => {});
  }, [offerId]);

  function startVisite() {
    if (!metier || !workerId) { setError("Choisissez le métier et la personne qui réalise la visite."); return; }
    setError("");
    setPhase("pieces");
  }

  function addPiece() {
    const nom = newPieceName.trim();
    if (!nom) return;
    const piece = { ...emptyPieceDraft(`piece-${Date.now()}`), nom, metier };
    setCurrentPiece(piece);
    setPieceStepIndex(0);
    setNewPieceName("");
    setPhase("piece-questions");
  }

  async function onPhotosChange(event) {
    const files = Array.from(event.target.files || []).slice(0, 8 - currentPiece.photos.length);
    if (!files.length) return;
    const dataUrls = await Promise.all(files.map(readAsDataUrl));
    setCurrentPiece((p) => ({ ...p, photos: [...p.photos, ...dataUrls] }));
    event.target.value = "";
  }
  function removePhoto(index) {
    setCurrentPiece((p) => ({ ...p, photos: p.photos.filter((_, i) => i !== index) }));
  }

  function setMetreField(fieldKey, value) {
    setCurrentPiece((p) => ({ ...p, metre: { fields: { ...p.metre.fields, [fieldKey]: timestampedAnswer(value) } } }));
  }
  function setMetreCounterField(fieldKey, sousType, value) {
    setCurrentPiece((p) => {
      const existing = p.metre.fields[fieldKey]?.value || {};
      return { ...p, metre: { fields: { ...p.metre.fields, [fieldKey]: timestampedAnswer({ ...existing, [sousType]: value }) } } };
    });
  }

  function nextPieceStep() {
    if (pieceStepIndex + 1 < PIECE_STEPS.length) {
      setPieceStepIndex(pieceStepIndex + 1);
      return;
    }
    // Piece terminee
    setPieces((prev) => [...prev, currentPiece]);
    setCurrentPiece(null);
    setPhase("pieces");
  }

  function finishVisite() {
    if (pieces.length === 0) { setError("Ajoutez au moins une pièce avant de continuer."); return; }
    const allSuggestions = pieces.flatMap((piece) =>
      matchRulesLocally(piece.remarques?.value).map((s) => ({ ...s, id: `${s.ruleId}-${piece.id}`, pieceId: piece.id, pieceNom: piece.nom }))
    );
    setSuggestions(allSuggestions);
    setAcceptedSuggestionIds(new Set(allSuggestions.map((s) => s.id)));
    setPhase("suggestions");
  }

  function toggleSuggestion(id) {
    setAcceptedSuggestionIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function generateDevis() {
    setPhase("generating");
    setError("");
    try {
      const { quote } = await apiSend(`/api/marketplace/offres/${offerId}/visite`, {
        workerId,
        pieces,
        acceptedSuggestionIds: Array.from(acceptedSuggestionIds)
      });
      router.push(`/devis?id=${quote.id}`);
    } catch (err) {
      setError(err.message);
      setPhase("suggestions");
    }
  }

  const metreFields = METRE_FIELDS_BY_METIER[metier] || [];
  const pieceStep = PIECE_STEPS[pieceStepIndex];

  return (
    <Shell>
      <section className="mobile-tool tool-form-view">
        <header className="tool-topline">
          <button type="button" className="plain-back" onClick={() => router.back()}>{"<"}</button>
          <h1>Visite guidée</h1>
          <span />
        </header>

        {phase === "intro" ? (
          <div className="mobile-form">
            <label className="mobile-input full">
              <span>Métier concerné</span>
              <select value={metier} onChange={(e) => setMetier(e.target.value)}>
                {VISITE_METIERS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </label>

            <label className="mobile-input full">
              <span>Qui réalise la visite ?</span>
              <select value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
                <option value="">Sélectionner…</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}{w.hourlyRate ? ` — ${w.hourlyRate}€/h` : ""}</option>
                ))}
              </select>
            </label>

            {error ? <p className="tool-message">{error}</p> : null}

            <button type="button" className="mobile-primary" onClick={startVisite}>
              Commencer la visite
            </button>
          </div>
        ) : null}

        {phase === "pieces" ? (
          <div className="mobile-form">
            <div className="mobile-input full">
              <span>Pièces déjà visitées</span>
              {pieces.length === 0 ? <p className="muted">Aucune pièce ajoutée pour l'instant.</p> : (
                <ul className="radar-address-suggestions" style={{ position: "static", boxShadow: "none", border: "1px solid var(--line)" }}>
                  {pieces.map((p) => <li key={p.id}><span style={{ padding: "9px 10px", display: "block" }}>{p.nom}</span></li>)}
                </ul>
              )}
            </div>

            <label className="mobile-input full">
              <span>Nom de la pièce à ajouter</span>
              <input value={newPieceName} onChange={(e) => setNewPieceName(e.target.value)} placeholder="Ex : Salle de bain" />
            </label>

            {error ? <p className="tool-message">{error}</p> : null}

            <button type="button" className="mobile-primary" onClick={addPiece} disabled={!newPieceName.trim()}>
              Ajouter cette pièce
            </button>
            <button type="button" className="button secondary" style={{ width: "100%" }} onClick={finishVisite} disabled={pieces.length === 0}>
              Terminer la visite ({pieces.length} pièce{pieces.length > 1 ? "s" : ""})
            </button>
          </div>
        ) : null}

        {phase === "piece-questions" && currentPiece ? (
          <div className="mobile-form">
            <p className="tool-message" style={{ background: "none", padding: 0 }}>
              {currentPiece.nom} — étape {pieceStepIndex + 1} / {PIECE_STEPS.length}
            </p>

            {pieceStep === "photos" ? (
              <div className="mobile-input full">
                <span>Photos de la pièce</span>
                <label className="radar-dropzone">
                  <input type="file" accept="image/*" multiple onChange={onPhotosChange} />
                  <strong>Ajouter des photos</strong>
                  <span>Cliquez ou glissez vos fichiers ici · 8 max</span>
                </label>
                {currentPiece.photos.length > 0 ? (
                  <div className="radar-photo-grid">
                    {currentPiece.photos.map((photo, index) => (
                      <div className="radar-photo-thumb" key={index}>
                        <img src={photo} alt={`Photo ${index + 1}`} />
                        <button type="button" onClick={() => removePhoto(index)}>×</button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {pieceStep === "metre" ? (
              <>
                {metreFields.map((field) => (
                  <div className="mobile-input full" key={field.key}>
                    <span>{field.label}</span>
                    {field.type === "nombre" ? (
                      <input
                        type="number"
                        min="0"
                        value={currentPiece.metre.fields[field.key]?.value ?? ""}
                        onChange={(e) => setMetreField(field.key, e.target.value)}
                        placeholder={field.unit}
                      />
                    ) : null}
                    {field.type === "oui_non" ? (
                      <div className="radar-quick-options">
                        {["oui", "non"].map((v) => (
                          <button
                            key={v}
                            type="button"
                            className={`radar-quick-option-btn${currentPiece.metre.fields[field.key]?.value === v ? " active" : ""}`}
                            onClick={() => setMetreField(field.key, v)}
                          >
                            {v === "oui" ? "Oui" : "Non"}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {field.type === "compteur" ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {["lavabo", "douche/baignoire", "wc", "autre"].map((sousType) => (
                          <label key={sousType} className="mobile-input full">
                            <span style={{ fontWeight: 400, fontSize: 13 }}>{sousType}</span>
                            <input
                              type="number"
                              min="0"
                              value={currentPiece.metre.fields[field.key]?.value?.[sousType] ?? ""}
                              onChange={(e) => setMetreCounterField(field.key, sousType, e.target.value)}
                            />
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </>
            ) : null}

            {pieceStep === "etat" ? (
              <div className="mobile-input full">
                <span>État des supports constaté par l'artisan</span>
                <div className="radar-quick-options">
                  {ETAT_CONSTATE_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`radar-quick-option-btn${currentPiece.etatConstate?.value === option ? " active" : ""}`}
                      onClick={() => setCurrentPiece((p) => ({ ...p, etatConstate: timestampedAnswer(option) }))}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {pieceStep === "finitions" ? (
              <>
                <div className="mobile-input full">
                  <span>Finitions souhaitées par le client</span>
                  <div className="radar-quick-options">
                    {FINITION_DEMANDEE_OPTIONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={`radar-quick-option-btn${currentPiece.finitionsDemandees?.value === option ? " active" : ""}`}
                        onClick={() => setCurrentPiece((p) => ({ ...p, finitionsDemandees: timestampedAnswer(option) }))}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="mobile-input full">
                  <span>Précision du client (optionnel)</span>
                  <input
                    value={currentPiece.finitionsPrecision?.value || ""}
                    onChange={(e) => setCurrentPiece((p) => ({ ...p, finitionsPrecision: timestampedAnswer(e.target.value) }))}
                    placeholder="Ex : carrelage gris clair, couleur RAL..."
                  />
                </label>
              </>
            ) : null}

            {pieceStep === "acces" ? (
              <div className="mobile-input full">
                <span>Accès à cette pièce</span>
                <div className="radar-quick-options">
                  {ACCES_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`radar-quick-option-btn${currentPiece.acces?.value === option ? " active" : ""}`}
                      onClick={() => setCurrentPiece((p) => ({ ...p, acces: timestampedAnswer(option) }))}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {pieceStep === "remarques" ? (
              <label className="mobile-input full">
                <span>Remarques libres</span>
                <textarea
                  rows={4}
                  value={currentPiece.remarques?.value || ""}
                  onChange={(e) => setCurrentPiece((p) => ({ ...p, remarques: timestampedAnswer(e.target.value) }))}
                  placeholder="Ex : trace d'infiltration au plafond, fissure au mur nord..."
                />
              </label>
            ) : null}

            <button type="button" className="mobile-primary" onClick={nextPieceStep}>
              {pieceStepIndex + 1 < PIECE_STEPS.length ? "Suivant" : "Valider cette pièce"}
            </button>
          </div>
        ) : null}

        {phase === "suggestions" ? (
          <div className="mobile-form">
            <div className="mobile-input full">
              <span>Suggestions à partir des remarques</span>
              {suggestions.length === 0 ? (
                <p className="muted">Aucune suggestion détectée dans les remarques.</p>
              ) : (
                <div className="radar-conseil-list">
                  {suggestions.map((s) => (
                    <label key={s.id} className={`radar-conseil-item${acceptedSuggestionIds.has(s.id) ? " checked" : ""}`}>
                      <input type="checkbox" checked={acceptedSuggestionIds.has(s.id)} onChange={() => toggleSuggestion(s.id)} />
                      <span className="radar-conseil-label">{s.label} ({s.pieceNom})</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {error ? <p className="tool-message">{error}</p> : null}

            <button type="button" className="mobile-primary" onClick={generateDevis}>
              ✨ Générer le devis
            </button>
          </div>
        ) : null}

        {phase === "generating" ? (
          <div className="radar-expertise-loading">
            <div className="radar-expertise-spinner" />
            <strong>Génération du devis en cours…</strong>
            <p>Calcul des lignes à partir de la bibliothèque de prix et du taux horaire choisi.</p>
          </div>
        ) : null}
      </section>
    </Shell>
  );
}
