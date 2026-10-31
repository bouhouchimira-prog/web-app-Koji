"use client";

import Link from "next/link";
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
import { titreCourt } from "../../../../lib/radar-display";

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
const STEP_LABELS = { photos: "Photos", metre: "Métré", etat: "État des supports", finitions: "Finitions", acces: "Accès", remarques: "Remarques" };
const COUNTER_LABELS = { lavabo: "Lavabo", "douche/baignoire": "Douche ou baignoire", wc: "WC", autre: "Autre" };

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
  const offerTitle = offre ? titreCourt(offre.description) : "Chantier";
  const phaseIndex = { intro: 0, pieces: 1, "piece-questions": 1, suggestions: 2, generating: 3 }[phase] ?? 0;

  function renderChoices(options, value, onPick, label) {
    return (
      <div className="chips" role="group" aria-label={label}>
        {options.map((option) => (
          <button type="button" key={option} className={`chip chip-s${value === option ? " on" : ""}`} aria-pressed={value === option} onClick={() => onPick(option)}>
            {option}
          </button>
        ))}
      </div>
    );
  }

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow">
            <Link href="/marketplace" className="link">Radar des chantiers</Link>
            {" · "}
            <Link href={`/marketplace/${offerId}`} className="link">{offerTitle}</Link>
          </span>
          <h1>Visite guidée</h1>
          <span className="muted">Métré pièce par pièce, puis devis chiffré au taux horaire de la personne qui visite.</span>
        </div>
      </div>

      <ol className="vg-steps" aria-label="Étapes de la visite">
        {["Préparer", "Pièces", "Suggestions", "Devis"].map((label, i) => (
          <li key={label} className={i < phaseIndex ? "done" : i === phaseIndex ? "on" : ""} aria-current={i === phaseIndex ? "step" : undefined}>{label}</li>
        ))}
      </ol>

      {phase === "intro" ? (
        <section className="card vg-card">
          <div className="card-h"><h2>Préparer la visite</h2></div>
          <div className="fgrid">
            <label>Métier concerné
              <select value={metier} onChange={(e) => setMetier(e.target.value)}>
                {VISITE_METIERS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </label>
            <label>Qui réalise la visite ?
              <select value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
                <option value="">Sélectionner…</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}{w.hourlyRate ? ` — ${w.hourlyRate} €/h` : ""}</option>
                ))}
              </select>
            </label>
          </div>
          {error ? <p className="err" role="alert">{error}</p> : null}
          <div className="ed-act">
            <button type="button" className="btn btn-main" onClick={startVisite}>Commencer la visite</button>
          </div>
        </section>
      ) : null}

      {phase === "pieces" ? (
        <section className="card vg-card">
          <div className="card-h">
            <h2>Pièces visitées{pieces.length ? <span className="kcnt">{pieces.length}</span> : null}</h2>
          </div>
          {pieces.length === 0 ? <p className="empty">Aucune pièce ajoutée pour l'instant.</p> : pieces.map((p) => (
            <div className="row" key={p.id}>
              <div className="t">
                <strong>{p.nom}</strong>
                <small>{p.photos.length} photo{p.photos.length > 1 ? "s" : ""}{p.remarques?.value ? " · remarques" : ""}</small>
              </div>
              <span className="tag tag-e">Visitée</span>
            </div>
          ))}
          <div className="pform">
            <input
              value={newPieceName}
              onChange={(e) => setNewPieceName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPiece(); } }}
              placeholder="Nom de la pièce, ex : Salle de bain"
              aria-label="Nom de la pièce à ajouter"
            />
            <button type="button" className="btn btn-sec" onClick={addPiece} disabled={!newPieceName.trim()}>Ajouter cette pièce</button>
          </div>
          {error ? <p className="err" role="alert">{error}</p> : null}
          <div className="ed-act">
            <button type="button" className="btn btn-main" onClick={finishVisite} disabled={pieces.length === 0}>
              Terminer la visite ({pieces.length} pièce{pieces.length > 1 ? "s" : ""})
            </button>
          </div>
        </section>
      ) : null}

      {phase === "piece-questions" && currentPiece ? (
        <section className="card vg-card">
          <div className="card-h">
            <h2>{currentPiece.nom}</h2>
            <span className="muted">étape {pieceStepIndex + 1} / {PIECE_STEPS.length} · {STEP_LABELS[pieceStep]}</span>
          </div>
          <div className="bar vg-bar"><i style={{ width: `${((pieceStepIndex + 1) / PIECE_STEPS.length) * 100}%` }} /></div>

          {pieceStep === "photos" ? (
            <div className="vg-field">
              <span className="flab">Photos de la pièce</span>
              <label className="vg-drop">
                <input type="file" accept="image/*" multiple onChange={onPhotosChange} aria-label="Ajouter des photos de la pièce" />
                <strong>Ajouter des photos</strong>
                <span>Cliquez ou glissez vos fichiers ici · 8 max</span>
              </label>
              {currentPiece.photos.length > 0 ? (
                <div className="rd-ph">
                  {currentPiece.photos.map((photo, index) => (
                    <div className="vg-thumb" key={index}>
                      <img src={photo} alt={`Photo ${index + 1}`} />
                      <button type="button" className="dx" onClick={() => removePhoto(index)} aria-label={`Retirer la photo ${index + 1}`}>×</button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {pieceStep === "metre" ? (
            <div className="fgrid">
              {metreFields.length === 0 ? <p className="full muted">Pas de métré prévu pour ce métier.</p> : null}
              {metreFields.map((field) => {
                if (field.type === "nombre") {
                  return (
                    <label key={field.key}>{field.label}
                      <input
                        type="number"
                        min="0"
                        value={currentPiece.metre.fields[field.key]?.value ?? ""}
                        onChange={(e) => setMetreField(field.key, e.target.value)}
                        placeholder={field.unit}
                      />
                    </label>
                  );
                }
                if (field.type === "oui_non") {
                  const current = currentPiece.metre.fields[field.key]?.value;
                  return (
                    <div className="full" key={field.key}>
                      <span className="flab">{field.label}</span>
                      <div className="kp-seg" role="group" aria-label={field.label}>
                        {["oui", "non"].map((v) => (
                          <button type="button" key={v} className={current === v ? "on" : ""} aria-pressed={current === v} onClick={() => setMetreField(field.key, v)}>
                            {v === "oui" ? "Oui" : "Non"}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                }
                if (field.type === "compteur") {
                  return (
                    <div className="full" key={field.key}>
                      <span className="flab">{field.label}</span>
                      <div className="fgrid fgrid4">
                        {["lavabo", "douche/baignoire", "wc", "autre"].map((sousType) => (
                          <label key={sousType}>{COUNTER_LABELS[sousType]}
                            <input
                              type="number"
                              min="0"
                              value={currentPiece.metre.fields[field.key]?.value?.[sousType] ?? ""}
                              onChange={(e) => setMetreCounterField(field.key, sousType, e.target.value)}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          ) : null}

          {pieceStep === "etat" ? (
            <div className="vg-field">
              <span className="flab">État des supports constaté</span>
              {renderChoices(ETAT_CONSTATE_OPTIONS, currentPiece.etatConstate?.value, (option) => setCurrentPiece((p) => ({ ...p, etatConstate: timestampedAnswer(option) })), "État des supports")}
            </div>
          ) : null}

          {pieceStep === "finitions" ? (
            <>
              <div className="vg-field">
                <span className="flab">Finitions souhaitées par le client</span>
                {renderChoices(FINITION_DEMANDEE_OPTIONS, currentPiece.finitionsDemandees?.value, (option) => setCurrentPiece((p) => ({ ...p, finitionsDemandees: timestampedAnswer(option) })), "Finitions souhaitées")}
              </div>
              <div className="fgrid">
                <label className="full">Précision du client (optionnel)
                  <input
                    value={currentPiece.finitionsPrecision?.value || ""}
                    onChange={(e) => setCurrentPiece((p) => ({ ...p, finitionsPrecision: timestampedAnswer(e.target.value) }))}
                    placeholder="Ex : carrelage gris clair, couleur RAL..."
                  />
                </label>
              </div>
            </>
          ) : null}

          {pieceStep === "acces" ? (
            <div className="vg-field">
              <span className="flab">Accès à cette pièce</span>
              {renderChoices(ACCES_OPTIONS, currentPiece.acces?.value, (option) => setCurrentPiece((p) => ({ ...p, acces: timestampedAnswer(option) })), "Accès à la pièce")}
            </div>
          ) : null}

          {pieceStep === "remarques" ? (
            <div className="fgrid">
              <label className="full">Remarques libres
                <textarea
                  rows={4}
                  value={currentPiece.remarques?.value || ""}
                  onChange={(e) => setCurrentPiece((p) => ({ ...p, remarques: timestampedAnswer(e.target.value) }))}
                  placeholder="Ex : trace d'infiltration au plafond, fissure au mur nord..."
                />
              </label>
            </div>
          ) : null}

          <div className="ed-act">
            {pieceStepIndex > 0 ? <button type="button" className="btn btn-sec" onClick={() => setPieceStepIndex(pieceStepIndex - 1)}>Précédent</button> : null}
            <button type="button" className="btn btn-main" onClick={nextPieceStep}>
              {pieceStepIndex + 1 < PIECE_STEPS.length ? "Suivant" : "Valider cette pièce"}
            </button>
          </div>
        </section>
      ) : null}

      {phase === "suggestions" ? (
        <section className="card vg-card">
          <div className="card-h"><h2>Suggestions à partir des remarques</h2></div>
          {suggestions.length === 0 ? (
            <p className="empty">Aucune suggestion détectée dans les remarques.</p>
          ) : (
            <div className="sq-checks vg-sugg">
              {suggestions.map((s) => (
                <label key={s.id} className="chk">
                  <input type="checkbox" checked={acceptedSuggestionIds.has(s.id)} onChange={() => toggleSuggestion(s.id)} />
                  {s.label} ({s.pieceNom})
                </label>
              ))}
            </div>
          )}
          {error ? <p className="err" role="alert">{error}</p> : null}
          <div className="ed-act">
            <button type="button" className="btn btn-main" onClick={generateDevis}>Générer le devis</button>
          </div>
        </section>
      ) : null}

      {phase === "generating" ? (
        <section className="card vg-card vg-loading" aria-live="polite">
          <span className="vg-spin" aria-hidden="true" />
          <strong>Génération du devis en cours…</strong>
          <p className="muted">Calcul des lignes à partir de la bibliothèque de prix et du taux horaire choisi.</p>
        </section>
      ) : null}
    </Shell>
  );
}
