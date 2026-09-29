"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "../../../components/Shell";
import { apiSend } from "../../../lib/client-api";
import { RENOVATION_METIERS } from "../../../lib/renovation-question-bank";

// Devis "100% IA" — deuxieme chemin de creation de devis, en parallele du
// chemin manuel (/devis?new=1). Formulaire court, puis (11 septembre)
// l'IA identifie les lots probables et pose deux questions courtes par lot
// (niveau de main d'oeuvre + duree estimee) avant de generer le devis
// complet en un appel (app/api/devis-ia) — le niveau de main d'oeuvre
// choisi applique un coefficient de prix deterministe, jamais decide par
// l'IA elle-meme. On atterrit ensuite dans l'editeur existant
// (/devis?id=...) pour la relecture, les ajustements et l'envoi.
// Reprend la meme liste que le dictionnaire de metiers (lib/renovation-question-bank.js)
// — cette liste etait restee figee au 6 metiers d'origine (Maçon/Chauffagiste/
// Climaticien avaient ete ajoutes ailleurs sans etre repercutes ici, 29 sept).
const METIERS = RENOVATION_METIERS;
const FINITIONS = ["Standard", "Milieu de gamme", "Haut de gamme"];
const LABOR_LEVELS = ["Standard", "Qualifié", "Expert"];
const FOURNITURES_OPTIONS = [
  { value: "avec", label: "Avec fournitures" },
  { value: "sans", label: "Sans fournitures" }
];

function readAsDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

const initialForm = {
  metier: METIERS[0],
  clientName: "",
  address: "",
  description: "",
  surface: "",
  finition: "Standard",
  photos: []
};

export default function DevisIaNewPage() {
  const router = useRouter();
  const [phase, setPhase] = useState("form"); // form | lots-loading | lots-questions | generating
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [lots, setLots] = useState([]);
  const [lotIndex, setLotIndex] = useState(0);
  const [lotAnswers, setLotAnswers] = useState([]);
  const [currentLaborLevel, setCurrentLaborLevel] = useState("");
  const [currentDaysDraft, setCurrentDaysDraft] = useState("1");
  const [currentFournitures, setCurrentFournitures] = useState("");

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function onPhotosChange(event) {
    const files = Array.from(event.target.files || []).slice(0, 8 - form.photos.length);
    if (!files.length) return;
    const dataUrls = await Promise.all(files.map(readAsDataUrl));
    setField("photos", [...form.photos, ...dataUrls]);
    event.target.value = "";
  }

  function removePhoto(index) {
    setField("photos", form.photos.filter((_, i) => i !== index));
  }

  async function submitForm(event) {
    event.preventDefault();
    if (!form.clientName.trim()) { setError("Le nom du client est obligatoire."); return; }
    if (!form.description.trim()) { setError("Décrivez les travaux à réaliser."); return; }
    setError("");
    setPhase("lots-loading");
    try {
      const { lots: identifiedLots } = await apiSend("/api/devis-ia/lots", {
        metier: form.metier,
        description: form.description,
        surface: form.surface,
        photos: form.photos
      });
      setLots(identifiedLots);
      setLotAnswers([]);
      setLotIndex(0);
      setCurrentLaborLevel("");
      setCurrentFournitures("");
      setCurrentDaysDraft(String(identifiedLots[0]?.joursEstimes || 1));
      setPhase("lots-questions");
    } catch (err) {
      setError(err.message);
      setPhase("form");
    }
  }

  async function confirmLot() {
    if (!currentLaborLevel || !currentFournitures) return;
    const lot = lots[lotIndex];
    const nextAnswers = [...lotAnswers, {
      nom: lot.nom,
      laborLevel: currentLaborLevel,
      joursEstimes: Math.max(1, Number(currentDaysDraft) || 1),
      fournitures: currentFournitures
    }];

    if (lotIndex + 1 < lots.length) {
      setLotAnswers(nextAnswers);
      setLotIndex(lotIndex + 1);
      setCurrentLaborLevel("");
      setCurrentFournitures("");
      setCurrentDaysDraft(String(lots[lotIndex + 1]?.joursEstimes || 1));
      return;
    }

    setPhase("generating");
    setError("");
    try {
      const { quote } = await apiSend("/api/devis-ia", { ...form, lotDetails: nextAnswers });
      router.push(`/devis?id=${quote.id}`);
    } catch (err) {
      setError(err.message);
      setPhase("lots-questions");
      setLotAnswers(lotAnswers);
    }
  }

  const currentLot = lots[lotIndex];

  return (
    <Shell>
      <section className="mobile-tool tool-form-view">
        <header className="tool-topline">
          <button type="button" className="plain-back" onClick={() => (phase === "form" ? router.back() : setPhase("form"))}>{"<"}</button>
          <h1>Devis 100% IA</h1>
          <span />
        </header>

        {phase === "form" ? (
          <form className="mobile-form" onSubmit={submitForm}>
            <label className="mobile-input full">
              <span>Métier concerné</span>
              <select value={form.metier} onChange={(e) => setField("metier", e.target.value)}>
                {METIERS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>

            <label className="mobile-input full">
              <span>Nom du client</span>
              <input value={form.clientName} onChange={(e) => setField("clientName", e.target.value)} required />
            </label>

            <label className="mobile-input full">
              <span>Adresse du chantier</span>
              <input value={form.address} onChange={(e) => setField("address", e.target.value)} />
            </label>

            <div className="mobile-input full">
              <span>Photo(s) du chantier</span>
              <label className="radar-dropzone">
                <input type="file" accept="image/*" multiple onChange={onPhotosChange} />
                <strong>Ajouter des photos</strong>
                <span>Cliquez ou glissez vos fichiers ici · 8 max</span>
              </label>
              {form.photos.length > 0 ? (
                <div className="radar-photo-grid">
                  {form.photos.map((photo, index) => (
                    <div className="radar-photo-thumb" key={index}>
                      <img src={photo} alt={`Photo ${index + 1}`} />
                      <button type="button" onClick={() => removePhoto(index)}>×</button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <label className="mobile-input full">
              <span>Description des travaux</span>
              <textarea
                rows={4}
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                placeholder="Ex : Refaire la plomberie de la salle de bain, remplacer la baignoire par une douche…"
                required
              />
            </label>

            <label className="mobile-input full">
              <span>Surface ou pièce concernée</span>
              <input
                value={form.surface}
                onChange={(e) => setField("surface", e.target.value)}
                placeholder="Ex : Salle de bain, 6 m²"
              />
            </label>

            <div className="mobile-input full">
              <span>Niveau de finition</span>
              <div className="radar-quick-options">
                {FINITIONS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`radar-quick-option-btn${form.finition === f ? " active" : ""}`}
                    onClick={() => setField("finition", f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {error ? <p className="tool-message">{error}</p> : null}

            <button className="mobile-primary">
              ✨ Continuer
            </button>
          </form>
        ) : null}

        {phase === "lots-loading" ? (
          <div className="radar-expertise-loading">
            <div className="radar-expertise-spinner" />
            <strong>Identification des lots en cours…</strong>
            <p>L'IA repère les pièces concernées par les travaux.</p>
          </div>
        ) : null}

        {phase === "lots-questions" && currentLot ? (
          <div className="mobile-form">
            <p className="tool-message" style={{ background: "none", padding: 0 }}>
              Lot {lotIndex + 1} / {lots.length}
            </p>
            <div className="mobile-input full">
              <span>{currentLot.nom}</span>
              <p className="muted" style={{ margin: "4px 0 12px" }}>Quel niveau de main d'oeuvre pour ce lot ?</p>
              <div className="radar-quick-options">
                {LABOR_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={`radar-quick-option-btn${currentLaborLevel === level ? " active" : ""}`}
                    onClick={() => setCurrentLaborLevel(level)}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <label className="mobile-input full">
              <span>Nombre de jours estimé pour ce lot</span>
              <input
                type="number"
                min="1"
                value={currentDaysDraft}
                onChange={(e) => setCurrentDaysDraft(e.target.value)}
              />
            </label>

            <div className="mobile-input full">
              <span>Fournitures pour ce lot</span>
              <p className="muted" style={{ margin: "4px 0 12px" }}>Si "Sans fournitures", le devis listera une estimation des matériaux à acheter, sans les facturer.</p>
              <div className="radar-quick-options">
                {FOURNITURES_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`radar-quick-option-btn${currentFournitures === option.value ? " active" : ""}`}
                    onClick={() => setCurrentFournitures(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {error ? <p className="tool-message">{error}</p> : null}

            <button type="button" className="mobile-primary" onClick={confirmLot} disabled={!currentLaborLevel || !currentFournitures}>
              {lotIndex + 1 < lots.length ? "Lot suivant" : "✨ Générer le devis avec l'IA"}
            </button>
          </div>
        ) : null}

        {phase === "generating" ? (
          <div className="radar-expertise-loading">
            <div className="radar-expertise-spinner" />
            <strong>Génération du devis en cours…</strong>
            <p>L'IA chiffre chaque lot à partir de la bibliothèque de prix.</p>
          </div>
        ) : null}
      </section>
    </Shell>
  );
}
