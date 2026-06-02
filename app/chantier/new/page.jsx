"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Shell } from "../../../components/Shell";
import { apiSend } from "../../../lib/client-api";
import { pricingProfile } from "../../../lib/data";
import { calculateTaskPrice, euro } from "../../../lib/pricing";
import { useApi } from "../../../lib/use-api";
import catalog from "../../../data/catalog-ouvrages.json";

const roomOptions = [
  { id: "salon", label: "Salon", icon: "SA" },
  { id: "cuisine", label: "Cuisine", icon: "CU" },
  { id: "chambre", label: "Chambre", icon: "CH" },
  { id: "salle_de_bain", label: "Salle de bain", icon: "SB" },
  { id: "bureau", label: "Bureau", icon: "BU" },
  { id: "exterieur", label: "Exterieur", icon: "EX" }
];

const initialProject = {
  title: "",
  street: "",
  postalCode: "",
  city: "",
  client: "",
  clientEmail: "",
  propertyType: "Maison"
};

function normalizeRoomId(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function makeTask(source, timeOverride) {
  return {
    id: source.id,
    code: source.code,
    label: source.label,
    unit: source.unit || "u",
    normativeTime: Number(timeOverride ?? source.normativeTime ?? 0),
    isFixedTime: source.unit === "u",
    materialRequirements: (source.materialCategories || []).map((category) => ({
      productCategory: category,
      yield: 1,
      defaultPricePerUnit: 0,
      isFixedQuantity: false
    }))
  };
}

function topFamily(items) {
  return Array.from(new Set(items.map((item) => item.family).filter(Boolean))).slice(0, 8);
}

export default function ProjectsPage() {
  const { data: projects, setData: setProjects } = useApi("/api/projects", "projects");
  const { data: quotes, setData: setQuotes } = useApi("/api/quotes", "quotes");
  const { data: supplies } = useApi("/api/supplies", "supplies");
  const { data: ouvrages } = useApi("/api/ouvrages", "ouvrages", catalog);

  const postes = useMemo(() => ouvrages.filter((item) => item.type === "POSTE"), [ouvrages]);
  const families = useMemo(() => ["Tout corps d'etat", ...topFamily(postes)], [postes]);

  const [step, setStep] = useState(1);
  const [projectForm, setProjectForm] = useState(initialProject);
  const [rooms, setRooms] = useState([]);
  const [customRoom, setCustomRoom] = useState("");
  const [selectedRoom, setSelectedRoom] = useState("salon");
  const [selectedFamily, setSelectedFamily] = useState("Tout corps d'etat");
  const [search, setSearch] = useState("");
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [factors, setFactors] = useState({ access: 1, support: 1, complexity: 1 });
  const [createdProject, setCreatedProject] = useState(null);
  const [createdQuote, setCreatedQuote] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const stepTitle = step === 1
    ? "Nouveau chantier"
    : step === 2
      ? "Creer votre chantier"
      : step === 3
        ? "Creer vos ouvrages"
        : step === 4
          ? "Recapitulatif de votre devis"
          : "Details de la Piece(s)";

  const selectedRoomLabel = rooms.find((room) => room.id === selectedRoom)?.label || roomOptions.find((room) => room.id === selectedRoom)?.label || "Salon";
  const visibleRooms = rooms.length > 0 ? rooms : roomOptions.filter((room) => room.id === selectedRoom);

  const filteredPostes = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return postes.filter((item) => {
      if (selectedFamily !== "Tout corps d'etat" && item.family !== selectedFamily) return false;
      if (!needle) return true;
      return [item.code, item.label, item.family, item.category].join(" ").toLowerCase().includes(needle);
    });
  }, [postes, search, selectedFamily]);

  const groupedPostes = useMemo(() => {
    const grouped = {};
    filteredPostes.slice(0, 24).forEach((item) => {
      const key = item.family || "Ouvrages";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });
    return grouped;
  }, [filteredPostes]);

  const quoteLines = useMemo(() => {
    return selectedTasks.map((line) => {
      const source = postes.find((item) => item.id === line.taskId);
      if (!source) return null;
      const task = makeTask(source, line.normativeTime);
      const estimate = calculateTaskPrice({
        task,
        quantity: Number(line.quantity || 0),
        realityFactors: factors,
        pricingProfile,
        selectedProducts: supplies
      });
      return {
        ...line,
        code: source.code,
        label: source.label,
        family: source.family,
        unit: source.unit || "u",
        normativeTime: task.normativeTime,
        laborCost: estimate.laborCost,
        materialCost: estimate.materialCost,
        totalHt: estimate.totalHt,
        totalTtc: estimate.totalTtc,
        correctedTimeHours: estimate.correctedTimeHours
      };
    }).filter(Boolean);
  }, [factors, postes, selectedTasks, supplies]);

  const totalHt = quoteLines.reduce((sum, line) => sum + Number(line.totalHt || 0), 0);
  const totalTtc = quoteLines.reduce((sum, line) => sum + Number(line.totalTtc || 0), 0);
  const totalLabor = quoteLines.reduce((sum, line) => sum + Number(line.laborCost || 0), 0);
  const totalSupplies = quoteLines.reduce((sum, line) => sum + Number(line.materialCost || 0), 0);

  function setProjectField(field, value) {
    setProjectForm((current) => ({ ...current, [field]: value }));
  }

  function toggleRoom(room) {
    setRooms((current) => {
      const exists = current.some((item) => item.id === room.id);
      const next = exists ? current.filter((item) => item.id !== room.id) : [...current, room];
      if (!exists) setSelectedRoom(room.id);
      if (exists && selectedRoom === room.id && next[0]) setSelectedRoom(next[0].id);
      return next;
    });
  }

  function addCustomRoom() {
    const label = customRoom.trim();
    const id = normalizeRoomId(label);
    if (!id) return;
    const room = { id, label, icon: "PI" };
    setRooms((current) => current.some((item) => item.id === id) ? current : [...current, room]);
    setSelectedRoom(id);
    setCustomRoom("");
  }

  function toggleTask(item) {
    setSelectedTasks((current) => {
      const exists = current.some((line) => line.roomId === selectedRoom && line.taskId === item.id);
      if (exists) return current.filter((line) => !(line.roomId === selectedRoom && line.taskId === item.id));
      return [
        ...current,
        {
          roomId: selectedRoom,
          room: selectedRoomLabel,
          taskId: item.id,
          quantity: 1,
          normativeTime: Number(item.normativeTime || 0)
        }
      ];
    });
  }

  function updateLine(index, patch) {
    setSelectedTasks((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line));
  }

  async function generateQuote() {
    if (!quoteLines.length) return;
    setSaving(true);
    setMessage("");
    const address = [projectForm.street, `${projectForm.postalCode} ${projectForm.city}`.trim()].filter(Boolean).join(", ");
    const title = projectForm.title || "Nouveau chantier";
    const client = projectForm.client || title;
    const { project } = await apiSend("/api/projects", {
      title,
      client,
      clientEmail: projectForm.clientEmail,
      address,
      budgetHt: totalHt,
      dueDate: new Date().toISOString().slice(0, 10),
      status: "Devis genere"
    });
    const { quote } = await apiSend("/api/quotes", {
      client,
      clientEmail: projectForm.clientEmail,
      project: project.title,
      projectId: project.id,
      projectReference: project.reference,
      rooms: rooms.map((room) => room.label),
      items: quoteLines,
      totalHt,
      totalTtc
    });
    setCreatedProject({ ...project, quoteId: quote.id, budgetHt: totalHt, status: "Devis genere" });
    setCreatedQuote(quote);
    setProjects([{ ...project, quoteId: quote.id, budgetHt: totalHt, status: "Devis genere" }, ...projects]);
    setQuotes([quote, ...quotes]);
    setStep(5);
    setSaving(false);
  }

  async function sendSignature() {
    if (!createdQuote) return;
    const { quote } = await apiSend("/api/quotes", { id: createdQuote.id, action: "send" }, "PATCH");
    setCreatedQuote(quote);
    setQuotes(quotes.map((item) => item.id === quote.id ? quote : item));
    setMessage(`Lien de signature cree: ${quote.signatureUrl}`);
  }

  function resetWizard() {
    setStep(1);
    setProjectForm(initialProject);
    setRooms([]);
    setSelectedRoom("salon");
    setSelectedTasks([]);
    setCreatedProject(null);
    setCreatedQuote(null);
    setMessage("");
  }

  return (
    <Shell>
      <div className="koji-wizard">
        <header className="wizard-top">
          <button type="button" className="wizard-back" onClick={() => step > 1 ? setStep(step - 1) : window.history.back()}>{"<"}</button>
          <div>
            <h1>{stepTitle}</h1>
            {step > 1 && step < 5 ? <p>Etape {step}/5</p> : null}
          </div>
          <span />
        </header>

        {step === 1 && (
          <section className="wizard-form-card">
            <div className="wizard-form-grid">
              <label className="wizard-field full">Reference du chantier<input value={projectForm.title} onChange={(event) => setProjectField("title", event.target.value)} placeholder="Loft Durand - Cuisine ..." /></label>
              <label className="wizard-field full">Numero / Rue<input value={projectForm.street} onChange={(event) => setProjectField("street", event.target.value)} placeholder="Rajouter votre texte..." /></label>
              <label className="wizard-field">Code postale<input value={projectForm.postalCode} onChange={(event) => setProjectField("postalCode", event.target.value)} placeholder="Rajouter votre texte..." /></label>
              <label className="wizard-field">Ville<input value={projectForm.city} onChange={(event) => setProjectField("city", event.target.value)} placeholder="Rajouter votre texte..." /></label>
              <label className="wizard-field">Client<input value={projectForm.client} onChange={(event) => setProjectField("client", event.target.value)} placeholder="Nom client" /></label>
              <label className="wizard-field">Adresse e-mail du client<input type="email" value={projectForm.clientEmail} onChange={(event) => setProjectField("clientEmail", event.target.value)} placeholder="client@exemple.com" /></label>
              <label className="wizard-field full">Type du bien<select value={projectForm.propertyType} onChange={(event) => setProjectField("propertyType", event.target.value)}>
                <option>Maison</option>
                <option>Appartement</option>
                <option>Local</option>
                <option>Autre</option>
              </select></label>
            </div>
            <button className="wizard-primary" onClick={() => setStep(2)} disabled={!projectForm.title.trim()}>Suivant <span>{">"}</span></button>
          </section>
        )}

        {step === 2 && (
          <section className="wizard-step">
            <div className="room-add-card">
              <h2>Ajouter une piece</h2>
              <div className="room-add-row">
                <input value={customRoom} onChange={(event) => setCustomRoom(event.target.value)} placeholder="Ex: Buanderie, Garage..." />
                <button type="button" onClick={addCustomRoom}>+</button>
              </div>
            </div>
            <div className="section-divider"><span />Suggestions Rapides<span /></div>
            <div className="room-grid">
              {roomOptions.map((room) => {
                const active = rooms.some((item) => item.id === room.id);
                return (
                  <button type="button" className={`room-option ${active ? "active" : ""}`} key={room.id} onClick={() => toggleRoom(room)}>
                    <span className="room-icon">{room.icon}</span>
                    <strong>{room.label}</strong>
                    <i />
                  </button>
                );
              })}
            </div>
            <button className="wizard-primary" onClick={() => setStep(3)} disabled={rooms.length === 0}>Continuer ({rooms.length} selectionnes) <span>{">"}</span></button>
          </section>
        )}

        {step === 3 && (
          <section className="wizard-step no-pad">
            <div className="works-room-tabs">
              {visibleRooms.map((room) => (
                <button key={room.id} className={selectedRoom === room.id ? "active" : ""} onClick={() => setSelectedRoom(room.id)}>{room.label}</button>
              ))}
            </div>
            <div className="works-body">
              <div className="trade-pills">
                {families.map((family) => (
                  <button key={family} className={selectedFamily === family ? "active" : ""} onClick={() => setSelectedFamily(family)}>{family}</button>
                ))}
              </div>
              <h2>Ajouter des ouvrages</h2>
              <div className="factor-chip">Parametres du chantier (Coeff: {(factors.access * factors.support * factors.complexity).toFixed(2)})</div>
              <div className="factor-grid">
                <label>Acces<input type="number" step="0.05" value={factors.access} onChange={(event) => setFactors((current) => ({ ...current, access: Number(event.target.value || 1) }))} /></label>
                <label>Support<input type="number" step="0.05" value={factors.support} onChange={(event) => setFactors((current) => ({ ...current, support: Number(event.target.value || 1) }))} /></label>
                <label>Complexite<input type="number" step="0.05" value={factors.complexity} onChange={(event) => setFactors((current) => ({ ...current, complexity: Number(event.target.value || 1) }))} /></label>
              </div>
              <input className="works-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher par code ou nom" />
              <div className="works-actions">
                <Link href="/bibliotheque-ouvrages">Bibliotheque d'ouvrages</Link>
                <Link href="/fournitures">Ajouter fourniture</Link>
              </div>
              {Object.entries(groupedPostes).map(([family, items]) => (
                <div className="works-group" key={family}>
                  <h3>{family}</h3>
                  {items.map((item) => {
                    const checked = selectedTasks.some((line) => line.roomId === selectedRoom && line.taskId === item.id);
                    return (
                      <article className="ouvrage-card" key={item.id}>
                        <button type="button" className={checked ? "checked" : ""} onClick={() => toggleTask(item)}>{checked ? "OK" : ""}</button>
                        <div>
                          <span>{item.code}</span>
                          <small>{item.family}</small>
                          <strong>{item.label}</strong>
                          <em>{Number(item.normativeTime || 0).toLocaleString("fr-FR", { maximumFractionDigits: 3 })} h/{item.unit}</em>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ))}
            </div>
            <button className="wizard-primary sticky" onClick={() => setStep(4)} disabled={selectedTasks.length === 0}>Continuer</button>
          </section>
        )}

        {step === 4 && (
          <section className="wizard-step">
            <div className="quote-info-banner">
              Methode de calcul: quantite x banque de temps x coefficients chantier, puis main d'oeuvre + fournitures. <strong>{pricingProfile.hourlyRate.toFixed(2)} EUR/h</strong>
            </div>
            <div className="quote-preview-head">
              <img src="/koji-logo.svg" alt="Koji" />
              <div>
                <strong>BOUHOUCHI</strong>
                <span>98 Quai de la Loire<br />75019 Paris</span>
              </div>
              <aside>
                <small>DEVIS N</small>
                <b>{createdQuote?.quoteNumber || "DEVIS-2026"}</b>
              </aside>
            </div>
            <div className="quote-work-card">
              <small>TRAVAUX</small>
              <p>Lieu d'execution : {[projectForm.street, projectForm.city].filter(Boolean).join(", ") || "-"}</p>
              <div>
                <input placeholder="Date de debut" />
                <input placeholder="Duree des travaux" />
              </div>
            </div>
            <div className="quote-room-card">
              <header><strong>{rooms[0]?.label || "Piece"}</strong><span>{euro(totalTtc)}</span></header>
              {quoteLines.map((line, index) => (
                <article className="quote-line-editor" key={`${line.roomId}-${line.taskId}`}>
                  <div className="quote-line-title">
                    <span>{line.code}</span>
                    <strong>{line.label}</strong>
                    <b>{euro(line.totalTtc)}</b>
                  </div>
                  <div className="quote-line-inputs">
                    <label>Qte<input type="number" value={line.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.target.value || 0) })} /></label>
                    <label>Temps h/{line.unit}<input type="number" step="0.001" value={line.normativeTime} onChange={(event) => updateLine(index, { normativeTime: Number(event.target.value || 0) })} /></label>
                  </div>
                </article>
              ))}
            </div>
            <button className="wizard-primary" onClick={generateQuote} disabled={saving}>{saving ? "Generation..." : "Generer le Devis"}</button>
          </section>
        )}

        {step === 5 && (
          <section className="wizard-step">
            <div className="success-card">
              <div className="success-check">OK</div>
              <h2>Devis pret !</h2>
              <p>Le devis #{createdQuote?.quoteNumber} a ete genere avec succes.</p>
              <div className="success-progress"><span>PROGRESSION</span><strong>100%</strong><i /></div>
            </div>
            <div className="document-card">
              <span>PDF</span>
              <div><strong>Devis_Final_{createdQuote?.quoteNumber}.pdf</strong><small>PDF Devis (A4)</small></div>
              <button>Voir</button>
            </div>
            <div className="doc-actions">
              <button>PDF</button>
              <button>Word</button>
            </div>
            <div className="share-actions">
              <button>Partager PDF</button>
              <button>Partager Word</button>
            </div>
            <div className="document-card">
              <span>MAT</span>
              <div><strong>Fournitures_{createdQuote?.quoteNumber}.pdf</strong><small>Liste de Materiaux (A4)</small></div>
              <button>Voir</button>
            </div>
            <button className="wizard-primary" onClick={sendSignature} disabled={!createdQuote || createdQuote.status === "Envoye"}>{createdQuote?.status === "Envoye" ? "Lien de signature pret" : "Envoyer au client pour signature"}</button>
            {createdQuote?.signatureUrl ? <Link className="wizard-secondary-link" href={createdQuote.signatureUrl}>Ouvrir le lien client</Link> : null}
            {message ? <p className="wizard-message">{message}</p> : null}
            <button className="wizard-text-button" onClick={resetWizard}>Creer un autre chantier</button>
          </section>
        )}

        {projects.length > 0 && step === 1 ? (
          <section className="existing-projects">
            <h2>Chantiers</h2>
            <div className="home-section-card">
              {projects.slice(0, 4).map((project) => (
                <article className="home-list-item" key={project.id}>
                  <span className="home-list-icon">X</span>
                  <div className="home-list-main">
                    <strong>{project.title}</strong>
                    <small>{project.client}</small>
                  </div>
                  <span className="home-list-meta">{project.status}</span>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </Shell>
  );
}
