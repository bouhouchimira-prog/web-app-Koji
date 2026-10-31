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
      <div className="head">
        <div className="stack">
          <button type="button" className="link" onClick={() => (phase === "form" ? router.back() : setPhase("form"))}>← Retour</button>
          <span className="eyebrow">Création rapide</span>
          <h1>Devis 100% IA</h1>
        </div>
      </div>

      {phase === "form" ? (
        <section className="card">
          <form onSubmit={submitForm}>
            <div className="fgrid">
              <label className="full">
                <span>Métier concerné</span>
                <select value={form.metier} onChange={(e) => setField("metier", e.target.value)}>
                  {METIERS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>

              <label className="full">
                <span>Nom du client</span>
                <input value={form.clientName} onChange={(e) => setField("clientName", e.target.value)} required />
              </label>

              <label className="full">
                <span>Adresse du chantier</span>
                <input value={form.address} onChange={(e) => setField("address", e.target.value)} />
              </label>

              <label className="full">
                <span>Surface ou pièce concernée</span>
                <input
                  value={form.surface}
                  onChange={(e) => setField("surface", e.target.value)}
                  placeholder="Ex : Salle de bain, 6 m²"
                />
              </label>

              <label className="full">
                <span>Description des travaux</span>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                  placeholder="Ex : Refaire la plomberie de la salle de bain, remplacer la baignoire par une douche…"
                  required
                />
              </label>

              <fieldset className="full" style={{ border: "none", margin: 0, padding: 0 }}>
                <legend className="flab">Niveau de finition</legend>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  {FINITIONS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      className={`btn btn-sm${form.finition === f ? " btn-main" : " btn-sec"}`}
                      onClick={() => setField("finition", f)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="full" style={{ border: "none", margin: 0, padding: 0 }}>
                <legend className="flab">Photo(s) du chantier</legend>
                <label style={{
                  border: "2px dashed var(--line)",
                  borderRadius: 6,
                  padding: 24,
                  textAlign: "center",
                  cursor: "pointer",
                  display: "block",
                  marginTop: 8,
                  marginBottom: 12
                }}>
                  <input type="file" accept="image/*" multiple onChange={onPhotosChange} style={{ display: "none" }} />
                  <strong>Ajouter des photos</strong>
                  <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Cliquez ou glissez vos fichiers ici · 8 max</p>
                </label>
                {form.photos.length > 0 ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 8 }}>
                    {form.photos.map((photo, index) => (
                      <div key={index} style={{ position: "relative", aspectRatio: "1", borderRadius: 6, overflow: "hidden" }}>
                        <img src={photo} alt={`Photo ${index + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <button type="button" onClick={() => removePhoto(index)} style={{
                          position: "absolute",
                          top: 4,
                          right: 4,
                          background: "rgba(0,0,0,0.5)",
                          color: "white",
                          border: "none",
                          borderRadius: "50%",
                          width: 24,
                          height: 24,
                          cursor: "pointer",
                          fontSize: 16,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}>×</button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </fieldset>
            </div>

            {error ? <p className="notice notice-err" role="alert" style={{ marginTop: 16 }}>{error}</p> : null}

            <div className="ed-act" style={{ marginTop: 24 }}>
              <button type="submit" className="btn btn-main">✨ Continuer</button>
            </div>
          </form>
        </section>
      ) : null}

      {phase === "lots-loading" ? (
        <section className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <div style={{ width: 40, height: 40, border: "3px solid var(--line)", borderTopColor: "var(--accent)", borderRadius: "50%", margin: "0 auto 16px", animation: "spin 1s linear infinite" }} />
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>Identification des lots en cours…</h2>
          <p className="muted">L'IA repère les pièces concernées par les travaux.</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </section>
      ) : null}

      {phase === "lots-questions" && currentLot ? (
        <section className="card">
          <p className="muted" style={{ marginBottom: 16 }}>Lot {lotIndex + 1} / {lots.length}</p>

          <h2 style={{ fontSize: 16, marginBottom: 16 }}>{currentLot.nom}</h2>

          <div style={{ marginBottom: 20 }}>
            <p className="flab" style={{ marginBottom: 8 }}>Quel niveau de main d'oeuvre pour ce lot ?</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {LABOR_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`btn btn-sm${currentLaborLevel === level ? " btn-main" : " btn-sec"}`}
                  onClick={() => setCurrentLaborLevel(level)}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label className="flab" style={{ display: "block", marginBottom: 8 }}>
              Nombre de jours estimé pour ce lot
            </label>
            <input
              type="number"
              min="1"
              value={currentDaysDraft}
              onChange={(e) => setCurrentDaysDraft(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 4, fontSize: 14 }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <p className="flab" style={{ marginBottom: 8 }}>Fournitures pour ce lot</p>
            <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>Si "Sans fournitures", le devis listera une estimation des matériaux à acheter, sans les facturer.</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {FOURNITURES_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`btn btn-sm${currentFournitures === option.value ? " btn-main" : " btn-sec"}`}
                  onClick={() => setCurrentFournitures(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {error ? <p className="notice notice-err" role="alert" style={{ marginBottom: 16 }}>{error}</p> : null}

          <div className="ed-act">
            <button type="button" className="btn btn-main" onClick={confirmLot} disabled={!currentLaborLevel || !currentFournitures}>
              {lotIndex + 1 < lots.length ? "Lot suivant" : "✨ Générer le devis avec l'IA"}
            </button>
          </div>
        </section>
      ) : null}

      {phase === "generating" ? (
        <section className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <div style={{ width: 40, height: 40, border: "3px solid var(--line)", borderTopColor: "var(--accent)", borderRadius: "50%", margin: "0 auto 16px", animation: "spin 1s linear infinite" }} />
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>Génération du devis en cours…</h2>
          <p className="muted">L'IA chiffre chaque lot à partir de la bibliothèque de prix.</p>
        </section>
      ) : null}
    </Shell>
  );
}
