"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClientTopbar } from "../../../../components/ClientTopbar";
import { RadarAiAssistant } from "../../../../components/RadarAiAssistant";

const METIERS = [
  "Plomberie", "Électricité", "Maçonnerie", "Peinture", "Menuiserie",
  "Carrelage", "Toiture", "Isolation", "Cuisine", "Salle de bain", "Autre"
];

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h3l2-2h6l2 2h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}
function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h4l10-10-4-4L4 16v4z" />
      <path d="M13 7l4 4" />
    </svg>
  );
}
function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s7-6.6 7-11.5A7 7 0 105 9.5C5 14.4 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}
function EuroIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 6.5a6 6 0 100 11" />
      <path d="M4 10h9M4 14h8" />
    </svg>
  );
}
function BoxIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8l-9-5-9 5 9 5 9-5z" />
      <path d="M3 8v8l9 5 9-5V8M12 13v8" />
    </svg>
  );
}
function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 5-5.5" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}
function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
    </svg>
  );
}

// Ordre impose par le cahier des charges Radar des Chantiers (section 3.1) :
// "un parcours en plusieurs etapes, une information par ecran : photo(s) du
// chantier, description des travaux, adresse, budget souhaite, puis choix
// avec ou sans fournitures."
const STEP_META = [
  { label: "Photos", icon: CameraIcon, title: "Photo(s) du chantier", subtitle: "Optionnel, mais ça aide les entreprises à mieux comprendre les travaux." },
  { label: "Description", icon: EditIcon, title: "Décrivez les travaux", subtitle: "Expliquez ce qu'il faut faire, avec le plus de détails possible." },
  { label: "Adresse", icon: PinIcon, title: "Adresse du chantier", subtitle: "Elle sert à trouver les entreprises qui travaillent près de chez vous." },
  { label: "Budget", icon: EuroIcon, title: "Budget souhaité", subtitle: "Une fourchette suffit — elle aide les entreprises à vous répondre." },
  { label: "Fournitures", icon: BoxIcon, title: "Fournitures", subtitle: "Précisez si le matériel est déjà prévu ou à la charge de l'entreprise." },
  { label: "Validation", icon: CheckCircleIcon, title: "Vérifiez votre offre", subtitle: "Dernière étape avant publication — gratuite et illimitée." },
];

function readAsDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

export default function NewRadarOffrePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    photos: [],
    description: "",
    metier: "",
    address: "",
    lat: null,
    lon: null,
    budget: "",
    withSupplies: false,
    priceVisible: true
  });
  const [addressTouched, setAddressTouched] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  // Autocompletion d'adresse (cahier des charges 4.1 + 5.2) via la Base
  // Adresse Nationale (api-adresse.data.gouv.fr) : gratuite, sans cle, CORS
  // ouvert. On recupere aussi lat/lon pour la future geolocalisation cote
  // matching par zone (PostGIS).
  useEffect(() => {
    if (!addressTouched) return;
    const query = form.address.trim();
    if (query.length < 3) { setSuggestions([]); return; }
    const handle = setTimeout(() => {
      fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5`)
        .then((r) => r.json())
        .then((data) => setSuggestions(data.features || []))
        .catch(() => setSuggestions([]));
    }, 350);
    return () => clearTimeout(handle);
  }, [form.address, addressTouched]);

  function onAddressChange(value) {
    setField("address", value);
    setField("lat", null);
    setField("lon", null);
    setAddressTouched(true);
  }

  function selectAddress(feature) {
    const [lon, lat] = feature.geometry.coordinates;
    setForm((current) => ({ ...current, address: feature.properties.label, lat, lon }));
    setAddressTouched(false);
    setSuggestions([]);
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

  function applyAiEstimate(estimate) {
    setForm((current) => ({
      ...current,
      description: estimate.description || current.description,
      metier: METIERS.includes(estimate.metier) ? estimate.metier : current.metier,
      budget: Number.isFinite(estimate.budgetMin) && Number.isFinite(estimate.budgetMax)
        ? String(Math.round((estimate.budgetMin + estimate.budgetMax) / 2))
        : current.budget,
      withSupplies: Boolean(estimate.withSupplies)
    }));
  }

  function next() {
    setError("");
    if (step === 1 && !form.description.trim()) {
      setError("Décrivez les travaux à réaliser.");
      return;
    }
    if (step === 2 && !form.address.trim()) {
      setError("L'adresse du chantier est obligatoire.");
      return;
    }
    setStep((s) => Math.min(s + 1, STEP_META.length - 1));
  }

  function back() {
    setError("");
    if (step === 0) { router.push("/client/radar"); return; }
    setStep((s) => s - 1);
  }

  async function publish() {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/chantier-offres", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photos: form.photos,
          description: form.description,
          metier: form.metier,
          address: form.address,
          lat: form.lat,
          lon: form.lon,
          budget: Number(form.budget || 0),
          withSupplies: form.withSupplies,
          priceVisible: form.priceVisible
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur lors de la publication.");
      router.push("/client/radar");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const meta = STEP_META[step];
  const StepIcon = meta.icon;

  return (
    <main className="client-space">
      <ClientTopbar showBack backHref="/client/radar" />

      <div className="ct-welcome">
        <strong>Publier une offre</strong>
      </div>

      <div className="radar-progress">
        {STEP_META.map((s, index) => (
          <div key={s.label} className={`radar-progress-step${index < step ? " done" : ""}${index === step ? " current" : ""}`}>
            <i>{index < step ? <CheckIcon /> : index + 1}</i>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      <section className="ct-section radar-form-card">
        <div className="radar-step-header">
          <span className="radar-step-icon"><StepIcon /></span>
          <div>
            <h3>{meta.title}</h3>
            <p>{meta.subtitle}</p>
          </div>
        </div>

        {step === 0 ? (
          <div className="radar-field">
            <label className="radar-dropzone">
              <input type="file" accept="image/*" multiple onChange={onPhotosChange} />
              <UploadIcon />
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

            <RadarAiAssistant photos={form.photos} metiers={METIERS} onApply={applyAiEstimate} />
          </div>
        ) : null}

        {step === 1 ? (
          <>
            <label className="radar-field">
              <span>Décrivez les travaux à réaliser</span>
              <textarea
                rows={5}
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                placeholder="Ex : Refaire la plomberie de la salle de bain, remplacer la baignoire par une douche…"
                autoFocus
              />
            </label>
            <label className="radar-field">
              <span>Métier concerné</span>
              <select value={form.metier} onChange={(e) => setField("metier", e.target.value)}>
                <option value="">Sélectionner…</option>
                {METIERS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
          </>
        ) : null}

        {step === 2 ? (
          <label className="radar-field radar-address-field">
            <span>Adresse du chantier</span>
            <input
              type="text"
              value={form.address}
              onChange={(e) => onAddressChange(e.target.value)}
              placeholder="Numéro, rue, ville, code postal"
              autoComplete="off"
              autoFocus
            />
            {suggestions.length > 0 ? (
              <ul className="radar-address-suggestions">
                {suggestions.map((feature) => (
                  <li key={feature.properties.id}>
                    <button type="button" onClick={() => selectAddress(feature)}>
                      <PinIcon />
                      {feature.properties.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </label>
        ) : null}

        {step === 3 ? (
          <label className="radar-field">
            <span>Budget souhaité (€)</span>
            <input
              type="number"
              value={form.budget}
              onChange={(e) => setField("budget", e.target.value)}
              placeholder="Ex : 3000"
              autoFocus
            />
          </label>
        ) : null}

        {step === 4 ? (
          <>
            <span className="radar-field-label">Fournitures</span>
            <div className="radar-choice-row">
              <button
                type="button"
                className={`radar-choice-btn${!form.withSupplies ? " active" : ""}`}
                onClick={() => setField("withSupplies", false)}
              >
                Sans fournitures
              </button>
              <button
                type="button"
                className={`radar-choice-btn${form.withSupplies ? " active" : ""}`}
                onClick={() => setField("withSupplies", true)}
              >
                Avec fournitures
              </button>
            </div>
            <label className="radar-checkbox">
              <input type="checkbox" checked={form.priceVisible} onChange={(e) => setField("priceVisible", e.target.checked)} />
              <span>Afficher mon budget aux entreprises</span>
            </label>
          </>
        ) : null}

        {step === 5 ? (
          <div className="radar-recap">
            <div className="radar-recap-row"><span>Photos</span><strong>{form.photos.length ? `${form.photos.length} photo(s)` : "Aucune"}</strong></div>
            <div className="radar-recap-row"><span>Travaux</span><strong>{form.description || "—"}</strong></div>
            <div className="radar-recap-row"><span>Métier</span><strong>{form.metier || "Non précisé"}</strong></div>
            <div className="radar-recap-row"><span>Adresse</span><strong>{form.address || "—"}</strong></div>
            <div className="radar-recap-row"><span>Budget</span><strong>{form.budget ? `${form.budget} €` : "Non précisé"}</strong></div>
            <div className="radar-recap-row"><span>Fournitures</span><strong>{form.withSupplies ? "Incluses" : "Non incluses"}</strong></div>
            <div className="radar-recap-row"><span>Prix visible</span><strong>{form.priceVisible ? "Oui" : "Masqué"}</strong></div>
            <p className="radar-recap-note">Publication gratuite et illimitée. Une entreprise dont la zone couvre votre adresse pourra se positionner et vous envoyer un devis pré-rempli.</p>
          </div>
        ) : null}

        {error ? <p className="profile-message error">{error}</p> : null}

        <div className="radar-nav-row">
          <button type="button" className="button secondary" onClick={back}>
            <ArrowLeftIcon />
            {step === 0 ? "Annuler" : "Retour"}
          </button>
          {step < STEP_META.length - 1 ? (
            <button type="button" className="button blue" onClick={next}>
              Suivant
              <ArrowRightIcon />
            </button>
          ) : (
            <button type="button" className="button blue" onClick={publish} disabled={submitting}>
              {submitting ? "Publication…" : "Publier l'offre"}
              {!submitting ? <CheckIcon /> : null}
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
