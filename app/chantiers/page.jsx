"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiGet, apiSend, readStoredUser } from "../../lib/client-api";
import { LancerChantier } from "../../components/LancerChantier";
import { demarragePropose, joursOuvresEntre, lotsDuDevis } from "../../lib/planning-chantier";
import { LIBELLE_ETAT_PHOTOS, PHASES_RESERVE, horodatage, photosDuLot } from "../../lib/photos-chantier";
import { FILTRES_RESERVES, compterReserves, pourLe as pourLeReserve, sousTitreReserve, statutReserve } from "../../lib/reserves";
import { PvReception } from "../../components/PvReception";
import { bilanChantier, etapesCloture, factureDeRetenue, factureDeSolde, facturesDuChantier, garanties, montantsSolde, noteSolde, travauxReceptionnes } from "../../lib/cloture-chantier";
import { useLocale } from "../../lib/i18n";
import { euro, shortDate } from "../../lib/pricing";
import { useApi } from "../../lib/use-api";
import { ONGLETS_CHANTIERS, compterOnglets, lignesChantiers } from "../../lib/chantiers-liste";

function TaskMessageThread({ task, projectDocuments, workers }) {
  const { L } = useLocale();
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replyFile, setReplyFile] = useState(null);
  const [replyUrl, setReplyUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [localDocs, setLocalDocs] = useState(null);
  const fileRef = useRef(null);

  const [noteText, setNoteText] = useState("");
  const [noteAudience, setNoteAudience] = useState("both");
  const [noteWorkerIds, setNoteWorkerIds] = useState(() => task.workerIds || []);
  const [sendingNote, setSendingNote] = useState(false);

  const assignedWorkers = (workers || []).filter((worker) => (task.workerIds || []).includes(worker.id));

  function toggleNoteWorker(workerId) {
    setNoteWorkerIds((current) => current.includes(workerId)
      ? current.filter((id) => id !== workerId)
      : [...current, workerId]);
  }

  const allDocs = localDocs || projectDocuments.filter(
    (d) => ["client", "company"].includes(d.source) && d.taskId === task.id
  );

  const clientNotes = allDocs.filter((d) => d.source === "client");
  const companyNotes = allDocs.filter((d) => d.source === "company" && !d.replyToId);

  function readCurrentUserId() {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem("koji-user") : null;
    return raw ? (JSON.parse(raw).id || "") : "";
  }

  async function sendNote() {
    if (!noteText.trim()) return;
    setSendingNote(true);
    try {
      const r = await fetch("/api/task-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: readCurrentUserId(), taskId: task.id, message: noteText, audience: noteAudience, workerIds: noteWorkerIds })
      });
      if (r.ok) {
        const data = await r.json();
        setLocalDocs([data.document, ...allDocs]);
        setNoteText("");
      }
    } finally { setSendingNote(false); }
  }

  async function onFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setReplyUrl(String(reader.result || "")); setReplyFile(file.name); };
    reader.readAsDataURL(file);
  }

  async function sendReply(noteId) {
    if (!replyText.trim() && !replyUrl) return;
    setSending(true);
    try {
      const r = await fetch("/api/task-replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: readCurrentUserId(),
          taskId: task.id,
          replyToId: noteId,
          message: replyText,
          fileName: replyFile || "",
          fileUrl: replyUrl
        })
      });
      if (r.ok) {
        const data = await r.json();
        setLocalDocs([data.reply, ...allDocs]);
        setReplyText(""); setReplyFile(null); setReplyUrl("");
        setReplyingTo(null);
        if (fileRef.current) fileRef.current.value = "";
      }
    } finally { setSending(false); }
  }

  const audiences = [
    { id: "client", label: L.chantiers.audienceClient },
    { id: "workers", label: L.chantiers.audienceWorkers },
    { id: "both", label: L.chantiers.audienceBoth }
  ];

  return (
    <div className="notes">
      {clientNotes.length > 0 ? <div className="notes-l">{L.chantiers.clientMessages}</div> : null}
      {clientNotes.map((note) => {
        const replies = allDocs.filter((d) => d.source === "company" && d.replyToId === note.id);
        const isReplying = replyingTo === note.id;
        return (
          <div className="note" key={note.id}>
            <div className="note-h">
              <strong>{note.clientName || "Client"}</strong>
              <span className="tag tag-o">{note.type}</span>
              <small>{note.createdAt ? shortDate(note.createdAt) : ""}</small>
            </div>
            {note.notes ? <p>{note.notes}</p> : null}
            <div className="note-act">
              {note.url ? <a className="link" href={note.url} download={note.fileName || note.title} target="_blank" rel="noreferrer">{L.chantiers.downloadFile}</a> : null}
              <button type="button" className="link" onClick={() => { setReplyingTo(isReplying ? null : note.id); setReplyText(""); }}>
                {isReplying ? L.common.cancel : L.chantiers.reply}
              </button>
            </div>

            {replies.map((rep) => (
              <div key={rep.id} className="note note-reply">
                <div className="note-h">
                  <strong>{rep.senderName || "Entreprise"}</strong>
                  <span className="tag tag-e">{L.chantiers.replyLabel}</span>
                  <small>{rep.createdAt ? shortDate(rep.createdAt) : ""}</small>
                </div>
                {rep.notes ? <p>{rep.notes}</p> : null}
                {rep.url ? <div className="note-act"><a className="link" href={rep.url} download={rep.fileName || rep.title} target="_blank" rel="noreferrer">{L.common.download}</a></div> : null}
              </div>
            ))}

            {isReplying ? (
              <div className="note-form">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={L.chantiers.replyPlaceholder}
                  aria-label={L.chantiers.replyPlaceholder}
                  rows={2}
                />
                <div className="note-act">
                  <input ref={fileRef} type="file" accept="image/*,.pdf" hidden onChange={onFileChange} />
                  <button type="button" className="btn btn-sec" onClick={() => fileRef.current?.click()}>
                    {replyFile ? `Pièce jointe : ${replyFile}` : L.chantiers.attach}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sec"
                    disabled={sending || (!replyText.trim() && !replyUrl)}
                    onClick={() => sendReply(note.id)}
                  >
                    {sending ? L.chantiers.sending : L.common.send}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}

      {companyNotes.map((note) => (
        <div className="note" key={note.id}>
          <div className="note-h">
            <strong>{note.senderName || "Entreprise"}</strong>
            <span className="tag tag-e">{L.chantiers.noteSentTo(note.audience)}</span>
            <small>{note.createdAt ? shortDate(note.createdAt) : ""}</small>
          </div>
          {note.notes ? <p>{note.notes}</p> : null}
        </div>
      ))}

      <div className="note-form">
        <div className="notes-l">{L.chantiers.noteComposer}</div>
        <textarea
          id="ouvrage-note-composer"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder={L.chantiers.notePlaceholder}
          aria-label={L.chantiers.noteComposer}
          rows={2}
        />
        <div className="kp-seg" role="group" aria-label="Destinataires">
          {audiences.map((audience) => (
            <button
              type="button"
              key={audience.id}
              className={noteAudience === audience.id ? "on" : ""}
              aria-pressed={noteAudience === audience.id}
              onClick={() => setNoteAudience(audience.id)}
            >
              {audience.label}
            </button>
          ))}
        </div>
        {(noteAudience === "workers" || noteAudience === "both") ? (
          <>
            <div className="notes-l">{L.chantiers.noteWorkersLabel}</div>
            {assignedWorkers.length === 0 ? <p className="muted">{L.chantiers.noteNoWorkers}</p> : (
              <div className="chips">
                {assignedWorkers.map((worker) => {
                  const on = noteWorkerIds.includes(worker.id);
                  return (
                    <button type="button" key={worker.id} className={`chip${on ? " on" : ""}`} aria-pressed={on} onClick={() => toggleNoteWorker(worker.id)}>
                      <b>{worker.name}</b>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : null}
        <div>
          <button type="button" className="btn btn-sec" disabled={sendingNote || !noteText.trim()} onClick={sendNote}>
            {sendingNote ? L.chantiers.sending : L.chantiers.sendNote}
          </button>
        </div>
      </div>
    </div>
  );
}

function quoteItemId(item, index) {
  return `${item.roomId || item.room || "chantier"}-${item.taskId || item.code || index}`;
}

function quoteDocumentUrl(quoteId) {
  return `/api/quotes/${quoteId}/documents?type=quote&format=pdf`;
}

function isArchived(project) {
  return String(project.status || "").toLowerCase().includes("archive");
}

function isReadyForTracking(project) {
  const status = String(project.status || "").toLowerCase();
  return status.includes("cours") || status.includes("signe") || status.includes("accept") || status.includes("planifier");
}

function formatDate(value) {
  if (!value) return "-";
  try {
    return shortDate(value);
  } catch {
    return value;
  }
}

// « 17 novembre » (phrases : pas de point d'abréviation en fin de phrase).
function jourEtMois(iso) {
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(d) : "";
}

// Étiquette de la liste (lib/chantiers-liste.js) → classes de la DA.
function classeEtiquette({ ton }) {
  return { b: "tag tag-b", o: "tag tag-o", e: "tag tag-e", w: "tag tag-e tag-w", dim: "tag tag-o dim" }[ton] || "tag";
}


const emptyPlan = {
  startDate: "",
  endDate: "",
  workerIds: [],
  rdvType: "",
  rdvReason: "",
  rdvDate: "",
  rdvTime: "",
  supplyId: "",
  supplyQuantity: "",
  supplyNote: ""
};

const emptyTaskForm = { label: "", dueDate: "", location: "" };
const emptyRdvForm = { title: "", date: "", time: "", contact: "", address: "" };
const emptyDocumentForm = { title: "", type: "Document", amount: "", category: "", location: "", url: "" };
const emptyExpenseForm = { label: "", category: "Fournitures", amount: "", location: "", notes: "" };

function defaultBudgetRows(project) {
  const budget = Number(project?.budgetHt || 0);
  return [
    { id: "labor", label: "Main d'oeuvre", estimated: budget, real: 0 },
    { id: "supplies", label: "Fournitures", estimated: 0, real: 0 },
    { id: "global", label: "Budget global", estimated: budget, real: 0 }
  ];
}

function dateTimeFromEvent(event) {
  const start = String(event?.startAt || "");
  return start ? `${formatDate(start)} ${start.slice(11, 16)}`.trim() : "-";
}

export default function ProjectsTrackingPage() {
  const router = useRouter();
  const { L } = useLocale();
  const { data: projects, setData: setProjects } = useApi("/api/projects", "projects");
  const { data: quotes } = useApi("/api/quotes", "quotes");
  const { data: tasks, setData: setTasks } = useApi("/api/tasks", "tasks");
  const { data: workers } = useApi("/api/workers", "workers");
  const { data: supplies } = useApi("/api/supplies", "supplies");
  const { data: calendarEvents, setData: setCalendarEvents } = useApi("/api/calendar-events", "calendarEvents");
  const { data: invoices } = useApi("/api/invoices", "invoices");
  const { data: projectDocuments, setData: setProjectDocuments } = useApi("/api/project-documents", "projectDocuments");
  const { data: projectArchives } = useApi("/api/project-archives", "projectArchives");
  const { data: history } = useApi("/api/history", "history");
  const { data: expenses, setData: setExpenses } = useApi("/api/expenses", "expenses");
  const { data: urgentAlerts } = useApi("/api/urgent-alerts", "alerts");

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [startChoiceMade, setStartChoiceMade] = useState(false);
  const [trackingTarget, setTrackingTarget] = useState(null);
  const [planForm, setPlanForm] = useState(emptyPlan);
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [rdvForm, setRdvForm] = useState(emptyRdvForm);
  const [documentForm, setDocumentForm] = useState(emptyDocumentForm);
  const [expenseForm, setExpenseForm] = useState(emptyExpenseForm);
  const [budgetDraft, setBudgetDraft] = useState(null);
  const [message, setMessage] = useState("");
  const [ficheTab, setFicheTab] = useState("lots");
  const [openLineKey, setOpenLineKey] = useState(null);
  const [chantierTab, setChantierTab] = useState(null);
  const [chantierQuery, setChantierQuery] = useState("");
  const [clientPortalAccess, setClientPortalAccess] = useState(null);
  const [clientAccessForm, setClientAccessForm] = useState({ email: "", phone: "" });
  const [clientAccessCreating, setClientAccessCreating] = useState(false);
  const [clientAccessError, setClientAccessError] = useState("");
  const [ouvrageExpenseForm, setOuvrageExpenseForm] = useState(emptyExpenseForm);
  const [ouvrageAddOpen, setOuvrageAddOpen] = useState(false);
  const [ouvrageAddTab, setOuvrageAddTab] = useState("team");
  const [quickAddWorkerIds, setQuickAddWorkerIds] = useState([]);
  const [lancerOuvert, setLancerOuvert] = useState(false);
  const [lotOuvert, setLotOuvert] = useState(null);
  const [photosChantier, setPhotosChantier] = useState([]);
  const [filtrePhotos, setFiltrePhotos] = useState("tous");
  const [reserves, setReserves] = useState([]);
  const [filtreReserves, setFiltreReserves] = useState("toutes");
  const [reserveOuverte, setReserveOuverte] = useState(null);
  const [nouvelleReserve, setNouvelleReserve] = useState({ titre: "", lieu: "", attribueeA: "", pourLe: "" });
  const [reserveEnvoi, setReserveEnvoi] = useState(false);
  const [cloture, setCloture] = useState(null);
  const [avenantsDevis, setAvenantsDevis] = useState([]);
  const [pvOuvert, setPvOuvert] = useState(false);
  const [clotureEnvoi, setClotureEnvoi] = useState(false);


  // Restores exactly where the user was (chantier / ouvrage / past the "start
  // choice" screen) after a page refresh, since that state only ever lived in
  // memory before. Runs once on mount; the sync effect below keeps the URL
  // up to date afterwards so a refresh always has something to restore from.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get("project");
    const lineKey = params.get("line");
    if (projectId) setSelectedProjectId(projectId);
    if (lineKey) setOpenLineKey(lineKey);
    if (params.get("started") === "1") setStartChoiceMade(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (selectedProjectId) params.set("project", selectedProjectId);
    if (openLineKey) params.set("line", openLineKey);
    if (startChoiceMade) params.set("started", "1");
    const query = params.toString();
    window.history.replaceState(null, "", query ? `/chantiers?${query}` : "/chantiers");
  }, [selectedProjectId, openLineKey, startChoiceMade]);

  function selectProject(projectId) {
    setStartChoiceMade(false);
    setOpenLineKey(null);
    setSelectedProjectId(projectId);
  }

  function backToList() {
    setSelectedProjectId("");
    setOpenLineKey(null);
    setStartChoiceMade(false);
  }

  // Photos avant / après du chantier (PRO-02.2).
  useEffect(() => {
    if (!selectedProjectId) { setPhotosChantier([]); return; }
    apiGet(`/api/chantier-photos?projectId=${encodeURIComponent(selectedProjectId)}`)
      .then((data) => setPhotosChantier(Array.isArray(data.photos) ? data.photos : []))
      .catch(() => setPhotosChantier([]));
  }, [selectedProjectId]);

  // Réserves du chantier (PRO-02.3).
  useEffect(() => {
    setReserveOuverte(null);
    if (!selectedProjectId) { setReserves([]); return; }
    apiGet(`/api/reserves?projectId=${encodeURIComponent(selectedProjectId)}`)
      .then((data) => setReserves(Array.isArray(data.reserves) ? data.reserves : []))
      .catch(() => setReserves([]));
  }, [selectedProjectId]);

  // Clôture du chantier (PRO-02.4) : PV, retenue, avis.
  useEffect(() => {
    setPvOuvert(false);
    if (!selectedProjectId) { setCloture(null); return; }
    apiGet(`/api/cloture?projectId=${encodeURIComponent(selectedProjectId)}`)
      .then((data) => setCloture(data.cloture || null))
      .catch(() => setCloture(null));
  }, [selectedProjectId]);

  async function majCloture(action, extra = {}) {
    setClotureEnvoi(true);
    try {
      const data = await apiSend("/api/cloture", { projectId: selectedProjectId, action, ...extra }, "PATCH");
      setCloture(data.cloture);
      setMessage(action === "rappel" ? "Rappel ajouté au calendrier." : action === "avis" ? (extra.programme ? "Demande d'avis programmée avec la facture de solde." : "Demande d'avis retirée.") : "Retenue de garantie mise à jour.");
    } catch (error) {
      setMessage(error.message || "La clôture n'a pas pu être mise à jour.");
    } finally {
      setClotureEnvoi(false);
    }
  }

  async function actionReserve(id, action, extra = {}) {
    setReserveEnvoi(true);
    try {
      const { reserve } = await apiSend("/api/reserves", { id, action, ...extra }, "PATCH");
      setReserves((liste) => liste.map((r) => (r.id === reserve.id ? reserve : r)));
      setMessage(action === "valider" ? `${reserve.numero} levée.` : action === "refuser" ? `${reserve.numero} repasse à faire.` : "Réserve mise à jour.");
    } catch (error) {
      setMessage(error.message || "La réserve n'a pas pu être mise à jour.");
    } finally {
      setReserveEnvoi(false);
    }
  }

  async function creerReserve(event) {
    event.preventDefault();
    if (!nouvelleReserve.titre.trim() || !selectedProjectId) return;
    setReserveEnvoi(true);
    try {
      const worker = workers.find((w) => w.id === nouvelleReserve.attribueeA);
      const { reserve } = await apiSend("/api/reserves", {
        projectId: selectedProjectId,
        titre: nouvelleReserve.titre,
        lieu: nouvelleReserve.lieu,
        attribueeA: nouvelleReserve.attribueeA,
        attribueeNom: nouvelleReserve.attribueeA === "moi" ? "Vous" : worker ? `${worker.name}${worker.type === "Sous-traitant" ? " · sous-traitant" : ""}` : "",
        pourLe: nouvelleReserve.pourLe
      });
      setReserves((liste) => [...liste, reserve]);
      setNouvelleReserve({ titre: "", lieu: "", attribueeA: "", pourLe: "" });
      setMessage(`${reserve.numero} créée. La photo se prend dans l'app Koji Pro.`);
    } catch (error) {
      setMessage(error.message || "La réserve n'a pas pu être créée.");
    } finally {
      setReserveEnvoi(false);
    }
  }

  useEffect(() => {
    if (!selectedProjectId) { setClientPortalAccess(null); return; }
    setClientAccessForm({ email: "", phone: "" });
    setClientAccessError("");
    apiGet(`/api/client-portal-info?projectId=${encodeURIComponent(selectedProjectId)}`)
      .then((data) => setClientPortalAccess(data.access || null))
      .catch(() => setClientPortalAccess(null));
  }, [selectedProjectId]);

  async function createClientAccessManually() {
    if (!selectedProjectId) return;
    const email = clientAccessForm.email.trim();
    const phone = clientAccessForm.phone.trim();
    if (!email && !phone) {
      setClientAccessError("Renseignez un email ou un téléphone.");
      return;
    }
    setClientAccessCreating(true);
    setClientAccessError("");
    try {
      const data = await apiSend("/api/client-portal-info", { projectId: selectedProjectId, email, phone });
      setClientPortalAccess(data.access || null);
    } catch (error) {
      setClientAccessError(error.message || "Impossible de créer l'accès client.");
    } finally {
      setClientAccessCreating(false);
    }
  }

  useEffect(() => {
    if (!selectedProjectId) return;
    setFicheTab("lots");
  }, [selectedProjectId]);

  // All non-archived chantiers, regardless of quote/signature status — used to
  // resolve which chantier is open, so a chantier can be viewed/edited before
  // its devis is signed (not just for the signed-only tracking list below).
  const nonArchivedProjects = useMemo(() => projects.filter((project) => !isArchived(project)), [projects]);
  // Liste (maquette PRO-02) : lib/chantiers-liste.js, le même calcul que
  // l'app Koji Pro — lots du devis faits, prochain jalon, ce qui demande une
  // action (Bloquant, À relancer, En retard, Échéance).
  const lignesListe = useMemo(
    () => lignesChantiers({ projects, quotes, tasks, calendarEvents, invoices, alerts: urgentAlerts }),
    [projects, quotes, tasks, calendarEvents, invoices, urgentAlerts]
  );
  const chantierCounts = useMemo(() => compterOnglets(lignesListe), [lignesListe]);
  // Onglet "En cours" par defaut comme la maquette, sauf s'il est vide.
  const activeChantierTab = chantierTab ?? (chantierCounts.en_cours > 0 ? "en_cours" : "tous");
  const chantierRows = useMemo(() => {
    const needle = chantierQuery.trim().toLowerCase();
    return lignesListe
      .filter((l) => activeChantierTab === "tous" || l.onglet === activeChantierTab)
      .filter((l) => !needle || l.recherche.includes(needle));
  }, [lignesListe, activeChantierTab, chantierQuery]);

  const selectedProject = nonArchivedProjects.find((project) => project.id === selectedProjectId) || null;
  const selectedQuote = useMemo(() => {
    if (!selectedProject) return null;
    return quotes.find((quote) => quote.projectId === selectedProject.id)
      || quotes.find((quote) => quote.project === selectedProject.title)
      || null;
  }, [quotes, selectedProject]);

  // Avenants du devis : signés, ils s'ajoutent aux travaux de la facture de
  // solde (PRO-02.4).
  const selectedQuoteId = selectedQuote?.id || "";
  useEffect(() => {
    if (!selectedQuoteId) { setAvenantsDevis([]); return; }
    apiGet(`/api/avenants?quoteId=${encodeURIComponent(selectedQuoteId)}`)
      .then((data) => setAvenantsDevis(Array.isArray(data.avenants) ? data.avenants : []))
      .catch(() => setAvenantsDevis([]));
  }, [selectedQuoteId]);

  const projectTasks = useMemo(() => {
    if (!selectedProject) return [];
    return tasks.filter((task) => task.projectId === selectedProject.id || task.project === selectedProject.title);
  }, [selectedProject, tasks]);

  const upcomingTasks = useMemo(() => {
    return projectTasks
      .filter((task) => !task.done)
      .sort((a, b) => String(a.dueDate || a.startDate || "").localeCompare(String(b.dueDate || b.startDate || "")));
  }, [projectTasks]);

  const completedTasks = useMemo(() => {
    return projectTasks
      .filter((task) => task.done)
      .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
  }, [projectTasks]);

  const projectEvents = useMemo(() => {
    if (!selectedProject) return [];
    return calendarEvents
      .filter((event) => event.projectId === selectedProject.id || event.projectTitle === selectedProject.title)
      .sort((a, b) => String(a.startAt || "").localeCompare(String(b.startAt || "")));
  }, [calendarEvents, selectedProject]);

  const nextRdv = useMemo(() => {
    const now = new Date().toISOString();
    return projectEvents.find((event) => String(event.startAt || "") >= now) || null;
  }, [projectEvents]);

  const linkedInvoices = useMemo(() => {
    if (!selectedProject) return [];
    return invoices.filter((invoice) => invoice.projectId === selectedProject.id || invoice.projectTitle === selectedProject.title);
  }, [invoices, selectedProject]);

  const linkedDocuments = useMemo(() => {
    if (!selectedProject) return [];
    return projectDocuments.filter((document) => document.projectId === selectedProject.id);
  }, [projectDocuments, selectedProject]);

  const linkedExpenses = useMemo(() => {
    if (!selectedProject) return [];
    return expenses.filter((expense) => expense.projectId === selectedProject.id);
  }, [expenses, selectedProject]);

  const chantierSpentAuto = useMemo(
    () => linkedExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
    [linkedExpenses]
  );
  const chantierMarginAuto = useMemo(() => {
    const total = Number(selectedQuote?.totalHt || selectedQuote?.totalTtc || selectedProject?.budgetHt || 0);
    return total - chantierSpentAuto;
  }, [selectedQuote, selectedProject, chantierSpentAuto]);

  const linkedHistory = useMemo(() => {
    if (!selectedProject) return [];
    return history.filter((item) => item.meta?.projectId === selectedProject.id || item.entityId === selectedProject.id).slice(0, 8);
  }, [history, selectedProject]);

  const linkedArchive = useMemo(() => {
    if (!selectedProject) return null;
    return projectArchives.find((archive) => archive.projectId === selectedProject.id) || null;
  }, [projectArchives, selectedProject]);

  const budgetRows = useMemo(() => {
    if (!selectedProject) return [];
    if (budgetDraft?.projectId === selectedProject.id) return budgetDraft.items;
    return Array.isArray(selectedProject.budgetItems) && selectedProject.budgetItems.length > 0
      ? selectedProject.budgetItems
      : defaultBudgetRows(selectedProject);
  }, [budgetDraft, selectedProject]);

  const budgetTotal = useMemo(() => {
    return budgetRows.reduce((acc, row) => ({
      estimated: acc.estimated + Number(row.estimated || 0),
      real: acc.real + Number(row.real || 0)
    }), { estimated: 0, real: 0 });
  }, [budgetRows]);

  const trackingLines = useMemo(() => {
    if (!selectedProject) return [];
    const matchedTaskIds = new Set();
    const quoteLines = (selectedQuote?.items || []).map((item, index) => {
      const key = quoteItemId(item, index);
      const task = projectTasks.find((candidate) => candidate.quoteItemId === key)
        || projectTasks.find((candidate) => candidate.label === item.label && candidate.room === item.room);
      if (task) matchedTaskIds.add(task.id);
      return { key, quoteLine: item, task };
    });
    const extraTasks = projectTasks
      .filter((task) => !matchedTaskIds.has(task.id))
      .map((task) => ({ key: task.quoteItemId || task.id, quoteLine: null, task }));
    return [...quoteLines, ...extraTasks];
  }, [projectTasks, selectedProject, selectedQuote]);

  // Reopens the "Planifier l'ouvrage" modal on the exact same line after a
  // round trip to Équipe (see goToTeamAndReturn / koji-team-return).
  const reopenLineHandledRef = useRef(false);
  useEffect(() => {
    if (reopenLineHandledRef.current || typeof window === "undefined") return;
    const lineKey = new URLSearchParams(window.location.search).get("reopenLine");
    if (!lineKey || !trackingLines.length) return;
    const line = trackingLines.find((item) => item.key === lineKey);
    if (!line) return;
    reopenLineHandledRef.current = true;
    openPlanner(line);
  }, [trackingLines]); // eslint-disable-line react-hooks/exhaustive-deps

  const openLine = trackingLines.find((line) => line.key === openLineKey) || null;

  // Notes, status and expenses all key off a real task record. Rather than
  // gating those features behind clicking "Planifier" first, silently create
  // a bare task the moment the ouvrage fiche is opened, so they're usable
  // right away — "Planifier" still works the same, it just updates it.
  const ensuringTaskRef = useRef(new Set());
  useEffect(() => {
    if (!openLine || openLine.task || !selectedProject) return;
    if (ensuringTaskRef.current.has(openLine.key)) return;
    ensuringTaskRef.current.add(openLine.key);
    const quoteLine = openLine.quoteLine || {};
    apiSend("/api/tasks", {
      label: quoteLine.label || "Ouvrage",
      project: selectedProject.title,
      projectId: selectedProject.id,
      quoteId: selectedQuote?.id || "",
      quoteItemId: openLine.key,
      code: quoteLine.code || "",
      room: quoteLine.room || "Chantier",
      unit: quoteLine.unit || "",
      quantity: Number(quoteLine.quantity || 0),
      durationHours: Number(quoteLine.correctedTimeHours || quoteLine.normativeTime || 1),
      workerIds: [],
      assignedTo: "",
      participantType: "Ouvriers",
      status: "À faire"
    }).then(({ task }) => {
      setTasks((current) => [task, ...current]);
    }).catch(() => {
      ensuringTaskRef.current.delete(openLine.key);
    });
  }, [openLine, selectedProject, selectedQuote]); // eslint-disable-line react-hooks/exhaustive-deps

  const supplyNeeds = useMemo(() => {
    return projectTasks.flatMap((task) => (task.supplyNeeds || []).map((need) => ({ ...need, taskLabel: task.label })));
  }, [projectTasks]);

  const doneCount = projectTasks.filter((task) => task.done).length;
  const progress = projectTasks.length === 0 ? Number(selectedProject?.progress || 0) : Math.round((doneCount / projectTasks.length) * 100);
  const projectReady = selectedProject ? isReadyForTracking(selectedProject) : false;
  const quoteSigned = selectedQuote ? (selectedQuote.status === "Signe" || selectedQuote.signatureStatus === "Signe") : false;

  function openPlanner(line) {
    const need = line.task?.supplyNeeds?.[0] || {};
    setTrackingTarget(line);
    setPlanForm({
      startDate: line.task?.startDate || "",
      endDate: line.task?.endDate || line.task?.dueDate || "",
      workerIds: line.task?.workerIds || [],
      rdvType: "",
      rdvReason: "",
      rdvDate: "",
      rdvTime: "",
      supplyId: need.supplyId || "",
      supplyQuantity: need.quantity || "",
      supplyNote: need.note || ""
    });
    setMessage("");
  }

  function goToTeamAndReturn() {
    if (!trackingTarget || !selectedProjectId) return;
    window.sessionStorage.setItem("koji-team-return", JSON.stringify({
      projectId: selectedProjectId,
      lineKey: trackingTarget.key
    }));
    router.push("/equipe");
  }

  function toggleWorker(workerId) {
    setPlanForm((current) => ({
      ...current,
      workerIds: current.workerIds.includes(workerId)
        ? current.workerIds.filter((id) => id !== workerId)
        : [...current.workerIds, workerId]
    }));
  }

  function buildSupplyNeeds() {
    if (!planForm.supplyId) return [];
    const supply = supplies.find((item) => item.id === planForm.supplyId);
    return [{
      supplyId: planForm.supplyId,
      name: supply?.name || "Fourniture",
      quantity: Number(planForm.supplyQuantity || 1),
      unit: supply?.unit || "",
      note: planForm.supplyNote || "",
      status: "A commander"
    }];
  }

  // Lancer le chantier (PRO-02.1) : les tâches créées remplacent les
  // anciennes, puis l'avancement et l'accès client sont relus.
  async function apresLancement({ taches, planning, partiel }) {
    const ids = new Set(taches.map((t) => t.id));
    const nextTasks = [...taches, ...tasks.filter((t) => !ids.has(t.id))];
    setTasks(nextTasks);
    await refreshProjectProgress(nextTasks).catch(() => null);
    apiGet(`/api/client-portal-info?projectId=${encodeURIComponent(selectedProjectId)}`)
      .then((data) => setClientPortalAccess(data.access || null))
      .catch(() => null);
    if (!partiel) setLancerOuvert(false);
    const fmt = jourEtMois;
    setMessage(partiel
      ? `${taches.length} ligne${taches.length > 1 ? "s" : ""} planifiée${taches.length > 1 ? "s" : ""} : relancez pour finir.`
      : `Chantier lancé : ${planning.lots.length} lot${planning.lots.length > 1 ? "s" : ""} planifié${planning.lots.length > 1 ? "s" : ""} du ${fmt(planning.debut)} au ${fmt(planning.fin)}.`);
  }

  async function refreshProjectProgress(nextTasks) {
    if (!selectedProject) return;
    const linked = nextTasks.filter((task) => task.projectId === selectedProject.id || task.project === selectedProject.title);
    const nextProgress = linked.length === 0 ? 0 : Math.round((linked.filter((task) => task.done).length / linked.length) * 100);
    const patch = {
      id: selectedProject.id,
      status: selectedProject.status === "En attente signature" ? "En cours" : selectedProject.status,
      progress: nextProgress,
      startDate: linked.map((task) => task.startDate).filter(Boolean).sort()[0] || selectedProject.startDate || "",
      endDate: linked.map((task) => task.endDate || task.dueDate).filter(Boolean).sort().at(-1) || selectedProject.endDate || ""
    };
    const { project } = await apiSend("/api/projects", patch, "PATCH");
    setProjects(projects.map((item) => item.id === project.id ? project : item));
  }

  async function savePlanning() {
    if (!trackingTarget || !selectedProject) return;
    const quoteLine = trackingTarget.quoteLine || {};
    const selectedWorkers = workers.filter((worker) => planForm.workerIds.includes(worker.id));
    const payload = {
      label: trackingTarget.task?.label || quoteLine.label || "Ouvrage",
      project: selectedProject.title,
      projectId: selectedProject.id,
      quoteId: selectedQuote?.id || trackingTarget.task?.quoteId || "",
      quoteItemId: trackingTarget.key,
      code: quoteLine.code || trackingTarget.task?.code || "",
      room: quoteLine.room || trackingTarget.task?.room || "Chantier",
      unit: quoteLine.unit || trackingTarget.task?.unit || "",
      quantity: Number(quoteLine.quantity || trackingTarget.task?.quantity || 0),
      dueDate: planForm.endDate || planForm.startDate || trackingTarget.task?.dueDate || "",
      startDate: planForm.startDate,
      endDate: planForm.endDate,
      durationHours: Number(quoteLine.correctedTimeHours || quoteLine.normativeTime || trackingTarget.task?.durationHours || 1),
      workerIds: planForm.workerIds,
      assignedTo: selectedWorkers.map((worker) => worker.name).join(", ") || "Equipe",
      participantType: selectedWorkers.some((worker) => worker.type === "Sous-traitant") ? "Sous-traitants" : "Ouvriers",
      supplyNeeds: buildSupplyNeeds(),
      status: "Planifiee"
    };

    let savedTask;
    if (trackingTarget.task) {
      const { task } = await apiSend("/api/tasks", { id: trackingTarget.task.id, ...payload }, "PATCH");
      savedTask = task;
      const nextTasks = tasks.map((item) => item.id === task.id ? task : item);
      setTasks(nextTasks);
      await refreshProjectProgress(nextTasks);
    } else {
      const { task } = await apiSend("/api/tasks", payload);
      savedTask = task;
      const nextTasks = [task, ...tasks];
      setTasks(nextTasks);
      await refreshProjectProgress(nextTasks);
    }

    if (planForm.rdvType && planForm.rdvDate) {
      const startAt = `${planForm.rdvDate}T${planForm.rdvTime || "09:00"}:00`;
      const rdvTitle = planForm.rdvType === "devis" ? L.chantiers.rdvReasonQuote : (planForm.rdvReason || L.chantiers.rdvReasonOther);
      const { calendarEvent } = await apiSend("/api/calendar-events", {
        title: `${rdvTitle} - ${savedTask.label}`,
        eventType: planForm.rdvType === "devis" ? "Devis" : "Chantier",
        projectId: selectedProject.id,
        projectTitle: selectedProject.title,
        clientName: selectedProject.client || "",
        address: selectedProject.address || "",
        startAt,
        endAt: startAt,
        status: "Planifie"
      });
      setCalendarEvents([calendarEvent, ...calendarEvents]);
    }

    setTrackingTarget(null);
    setPlanForm(emptyPlan);
    setMessage("Suivi de l'ouvrage enregistre.");
  }

  async function toggleDone(task) {
    const { task: updatedTask } = await apiSend("/api/tasks", { id: task.id, action: "toggle" }, "PATCH");
    const nextTasks = tasks.map((item) => item.id === updatedTask.id ? updatedTask : item);
    setTasks(nextTasks);
    await refreshProjectProgress(nextTasks);
  }

  async function validateTask(task) {
    const { task: updatedTask } = await apiSend("/api/tasks", { id: task.id, action: "validate" }, "PATCH");
    const nextTasks = tasks.map((item) => item.id === updatedTask.id ? updatedTask : item);
    setTasks(nextTasks);
    await refreshProjectProgress(nextTasks);
    setMessage(`Ouvrage "${updatedTask.label}" valide.`);
  }

  function ouvrageStatusKey(task) {
    if (!task) return "debut";
    if (task.done) return "valide";
    if (task.pendingValidation) return "termine";
    if (String(task.status || "").toLowerCase().includes("cours")) return "encours";
    return "debut";
  }

  async function setOuvrageStatus(task, key) {
    if (!task) return;
    if (key === "valide") return validateTask(task);
    const patch = key === "encours"
      ? { status: "En cours", done: false, pendingValidation: false }
      : key === "termine"
        ? { status: "Terminee (a valider)", done: false, pendingValidation: true }
        : { status: "À faire", done: false, pendingValidation: false };
    const { task: updatedTask } = await apiSend("/api/tasks", { id: task.id, ...patch }, "PATCH");
    const nextTasks = tasks.map((item) => item.id === updatedTask.id ? updatedTask : item);
    setTasks(nextTasks);
    await refreshProjectProgress(nextTasks);
  }

  function setBudgetValue(rowId, field, value) {
    if (!selectedProject) return;
    const source = budgetDraft?.projectId === selectedProject.id ? budgetDraft.items : budgetRows;
    setBudgetDraft({
      projectId: selectedProject.id,
      items: source.map((row) => row.id === rowId ? { ...row, [field]: Number(value || 0) } : row)
    });
  }

  async function saveBudgetRows() {
    if (!selectedProject) return;
    const { project } = await apiSend("/api/projects", {
      id: selectedProject.id,
      budgetItems: budgetRows
    }, "PATCH");
    setProjects(projects.map((item) => item.id === project.id ? project : item));
    setBudgetDraft(null);
    setMessage("Budget enregistre. Une alerte est creee si le reel depasse l'estime.");
  }

  async function addProjectTask(event) {
    event.preventDefault();
    if (!selectedProject || !taskForm.label.trim()) return;
    const { task } = await apiSend("/api/tasks", {
      label: taskForm.label,
      project: selectedProject.title,
      projectId: selectedProject.id,
      room: "Chantier",
      dueDate: taskForm.dueDate || new Date().toISOString().slice(0, 10),
      startDate: taskForm.dueDate || "",
      assignedTo: "Equipe",
      status: "À faire",
      location: taskForm.location
    });
    setTasks([task, ...tasks]);
    setTaskForm(emptyTaskForm);
    setMessage("Tache ajoutee au chantier.");
  }

  async function addRdv(event) {
    event.preventDefault();
    if (!selectedProject) return;
    const date = rdvForm.date || new Date().toISOString().slice(0, 10);
    const time = rdvForm.time || "09:00";
    const startAt = `${date}T${time}:00`;
    const { calendarEvent } = await apiSend("/api/calendar-events", {
      title: rdvForm.title || "Rendez-vous chantier",
      eventType: "RDV",
      clientName: rdvForm.contact || selectedProject.client || "",
      projectId: selectedProject.id,
      projectTitle: selectedProject.title,
      address: rdvForm.address || selectedProject.address || "",
      startAt,
      endAt: startAt,
      status: "Planifie"
    });
    setCalendarEvents([calendarEvent, ...calendarEvents]);
    setRdvForm(emptyRdvForm);
    setMessage("Rendez-vous ajoute.");
  }

  async function addDocument(event, typeForce = "") {
    event.preventDefault();
    if (!selectedProject || !documentForm.title.trim()) return;
    const { projectDocument } = await apiSend("/api/project-documents", {
      projectId: selectedProject.id,
      quoteId: selectedQuote?.id || "",
      title: documentForm.title,
      type: typeForce || documentForm.type,
      amount: documentForm.amount,
      category: documentForm.category,
      location: documentForm.location,
      url: documentForm.url,
      source: "manuel"
    });
    setProjectDocuments([projectDocument, ...projectDocuments]);
    setDocumentForm(emptyDocumentForm);
    setMessage("Document ajoute au chantier.");
  }

  async function addExpense(event) {
    event.preventDefault();
    if (!selectedProject || !expenseForm.label.trim() || Number(expenseForm.amount || 0) <= 0) return;
    const { expense } = await apiSend("/api/expenses", {
      projectId: selectedProject.id,
      quoteId: selectedQuote?.id || "",
      label: expenseForm.label,
      category: expenseForm.category,
      amount: expenseForm.amount,
      location: expenseForm.location,
      notes: expenseForm.notes
    });
    setExpenses([expense, ...expenses]);
    setExpenseForm(emptyExpenseForm);
    setMessage("Depense reelle ajoutee au chantier.");
  }

  function openQuickAdd() {
    setQuickAddWorkerIds(openLine?.task?.workerIds || []);
    setOuvrageAddTab("team");
    setOuvrageAddOpen(true);
  }

  function toggleQuickAddWorker(workerId) {
    setQuickAddWorkerIds((current) => current.includes(workerId)
      ? current.filter((id) => id !== workerId)
      : [...current, workerId]);
  }

  async function saveQuickAddTeam() {
    const task = openLine?.task;
    if (!task) return;
    const selectedWorkers = workers.filter((worker) => quickAddWorkerIds.includes(worker.id));
    const { task: updatedTask } = await apiSend("/api/tasks", {
      id: task.id,
      workerIds: quickAddWorkerIds,
      assignedTo: selectedWorkers.map((worker) => worker.name).join(", ") || "Equipe",
      participantType: selectedWorkers.some((worker) => worker.type === "Sous-traitant") ? "Sous-traitants" : "Ouvriers"
    }, "PATCH");
    setTasks((current) => current.map((item) => item.id === updatedTask.id ? updatedTask : item));
    setMessage("Equipe mise a jour sur l'ouvrage.");
    setOuvrageAddOpen(false);
  }

  async function addOuvrageExpense(event) {
    event.preventDefault();
    const task = openLine?.task;
    if (!selectedProject || !task || !ouvrageExpenseForm.label.trim() || Number(ouvrageExpenseForm.amount || 0) <= 0) return;
    const { expense } = await apiSend("/api/expenses", {
      projectId: selectedProject.id,
      quoteId: selectedQuote?.id || "",
      taskId: task.id,
      label: ouvrageExpenseForm.label,
      category: ouvrageExpenseForm.category,
      amount: ouvrageExpenseForm.amount,
      location: ouvrageExpenseForm.location,
      notes: ouvrageExpenseForm.notes
    });
    setExpenses([expense, ...expenses]);
    setOuvrageExpenseForm(emptyExpenseForm);
    setMessage("Depense ajoutee a l'ouvrage.");
    setOuvrageAddOpen(false);
  }

  function goToNoteComposer() {
    setOuvrageAddOpen(false);
    requestAnimationFrame(() => {
      const el = document.getElementById("ouvrage-note-composer");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus();
      }
    });
  }

  async function closeProject(action) {
    if (!selectedProject) return;
    const { project } = await apiSend("/api/projects", { id: selectedProject.id, action }, "PATCH");
    setProjects(projects.map((item) => item.id === project.id ? project : item));
    setMessage(action === "finish" ? "Chantier termine et archive creee." : "Chantier archive avec son historique.");
  }

  const planningModal = trackingTarget ? (
    <div className="pmodal-bg" onClick={() => setTrackingTarget(null)}>
      <div className="pmodal" role="dialog" aria-modal="true" aria-label={L.chantiers.planModal} onClick={(event) => event.stopPropagation()}>
        <div className="card-h">
          <h2>{L.chantiers.planModal}</h2>
          <button type="button" className="link" onClick={() => setTrackingTarget(null)}>{L.chantiers.close}</button>
        </div>

        <div className="pm-sec">
          <div className="pm-h">
            <h3>{L.chantiers.team}</h3>
            <button type="button" className="link" onClick={goToTeamAndReturn}>{L.chantiers.goToTeam}</button>
          </div>
          {workers.length === 0 ? <p className="muted">{L.chantiers.addWorkers}</p> : (
            <div className="chips">
              {workers.map((worker) => {
                const on = planForm.workerIds.includes(worker.id);
                return (
                  <button type="button" key={worker.id} className={`chip${on ? " on" : ""}`} aria-pressed={on} onClick={() => toggleWorker(worker.id)}>
                    <b>{worker.name}</b>
                    <small>{worker.type || "Ouvrier"} · {worker.profession || worker.role}</small>
                    {worker.loginId ? <small>ID : {worker.loginId}</small> : null}
                  </button>
                );
              })}
            </div>
          )}
          <div className="fgrid">
            <label>{L.chantiers.startDate}<input type="date" value={planForm.startDate} onChange={(event) => setPlanForm((current) => ({ ...current, startDate: event.target.value }))} /></label>
            <label>{L.chantiers.endDate}<input type="date" value={planForm.endDate} onChange={(event) => setPlanForm((current) => ({ ...current, endDate: event.target.value }))} /></label>
          </div>
        </div>

        <div className="pm-sec">
          <h3>{L.chantiers.rdvOptional}</h3>
          <div className="fgrid">
            <label>{L.chantiers.rdvType}
              <select value={planForm.rdvType} onChange={(event) => setPlanForm((current) => ({ ...current, rdvType: event.target.value }))}>
                <option value="">{L.chantiers.noRdv}</option>
                <option value="devis">{L.chantiers.rdvReasonQuote}</option>
                <option value="autres">{L.chantiers.rdvReasonOther}</option>
              </select>
            </label>
            {planForm.rdvType === "autres" ? (
              <label>{L.chantiers.rdvReasonOther}<input value={planForm.rdvReason} onChange={(event) => setPlanForm((current) => ({ ...current, rdvReason: event.target.value }))} placeholder={L.chantiers.rdvReasonPlaceholder} /></label>
            ) : null}
            {planForm.rdvType ? (
              <label className="full">{L.chantiers.rdvWhen}
                <span className="pair">
                  <input type="date" value={planForm.rdvDate} onChange={(event) => setPlanForm((current) => ({ ...current, rdvDate: event.target.value }))} />
                  <input type="time" value={planForm.rdvTime} onChange={(event) => setPlanForm((current) => ({ ...current, rdvTime: event.target.value }))} />
                </span>
              </label>
            ) : null}
          </div>
        </div>

        <div className="pm-sec">
          <h3>{L.chantiers.missingSupply}</h3>
          <div className="fgrid">
            <label>{L.chantiers.supply}
              <select value={planForm.supplyId} onChange={(event) => setPlanForm((current) => ({ ...current, supplyId: event.target.value }))}>
                <option value="">{L.chantiers.noShortage}</option>
                {supplies.map((supply) => <option value={supply.id} key={supply.id}>{supply.name}</option>)}
              </select>
            </label>
            <label>{L.chantiers.quantity}<input value={planForm.supplyQuantity} onChange={(event) => setPlanForm((current) => ({ ...current, supplyQuantity: event.target.value }))} placeholder="Ex : 2" /></label>
            <label className="full">{L.chantiers.note}<input value={planForm.supplyNote} onChange={(event) => setPlanForm((current) => ({ ...current, supplyNote: event.target.value }))} placeholder="Ex : à commander" /></label>
          </div>
        </div>

        <div className="pm-act">
          <button type="button" className="btn btn-sec" onClick={() => setTrackingTarget(null)}>{L.common.cancel}</button>
          <button type="button" className="btn btn-main" onClick={savePlanning}>{L.chantiers.savePlanning}</button>
        </div>
      </div>
    </div>
  ) : null;

  // Fil d'Ariane commun aux écrans du chantier (fiche, ouvrage, démarrage).
  const chantierCrumb = selectedProject ? (
    <span className="eyebrow">
      <button type="button" className="link" onClick={backToList}>Chantiers</button>
      {" · "}
      {openLine ? <button type="button" className="link" onClick={() => setOpenLineKey(null)}>{selectedProject.title}</button> : selectedProject.title}
    </span>
  ) : null;

  if (selectedProject && openLine) {
    const item = openLine.quoteLine || openLine.task || {};
    const task = openLine.task;
    const statusKey = ouvrageStatusKey(task);
    const statusSteps = [
      { key: "debut", label: L.chantiers.statusStart },
      { key: "encours", label: L.chantiers.statusInProgress },
      { key: "termine", label: L.chantiers.statusFinished },
      { key: "valide", label: L.chantiers.statusValidated }
    ];
    const statusIndex = statusSteps.findIndex((step) => step.key === statusKey);
    const ouvragePriceHt = Number(item.totalHt || item.totalTtc || 0);
    const taskExpenses = task ? expenses.filter((expense) => expense.taskId === task.id) : [];
    const ouvrageSpentTotal = taskExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const ouvrageProfit = ouvragePriceHt - ouvrageSpentTotal;
    const quantityLabel = `${item.quantity || task?.quantity || 1} ${item.unit || task?.unit || ""}`.trim();

    return (
      <Shell variant="pro">
        <div className="head">
          <div className="stack">
            {chantierCrumb}
            <h1>{item.label || task?.label}</h1>
            <span className="muted">{[item.room || task?.room || "Chantier", item.code || task?.code, quantityLabel].filter(Boolean).join(" · ")}</span>
          </div>
          <div className="hact">
            {task ? <button type="button" className="btn btn-sec" onClick={openQuickAdd}>{L.chantiers.quickAddBtn}</button> : null}
            <button type="button" className="btn btn-main" onClick={() => openPlanner(openLine)}>{L.chantiers.plan}</button>
          </div>
        </div>

        {task ? (
          <div className="steps">
            <span className="eyebrow">Avancement de l'ouvrage</span>
            <div className="kp-seg" role="group" aria-label="Avancement de l'ouvrage">
              {statusSteps.map((step, index) => (
                <button
                  type="button"
                  key={step.key}
                  className={step.key === statusKey ? "on" : ""}
                  aria-pressed={step.key === statusKey}
                  onClick={() => setOuvrageStatus(task, step.key)}
                >
                  {index < statusIndex ? "✓ " : ""}{step.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="notice">{L.chantiers.notPlannedYet}</p>
        )}

        {task?.pendingValidation && task.completedByName ? (
          <p className="notice">
            Terminé par {task.completedByName} ({task.completedByType?.toLowerCase()}) le {formatDate(task.finishedAt)}
          </p>
        ) : null}

        <div className="fiche-grid">
          <div className="card">
            <div className="card-h"><h2>Messages et notes</h2></div>
            {task ? (
              <TaskMessageThread task={task} projectDocuments={projectDocuments} workers={workers} />
            ) : (
              <p className="empty">{L.chantiers.notPlannedYet}</p>
            )}
          </div>

          <div className="fiche-side">
            <div className="card">
              <div className="card-h">
                <h2>Ouvrage</h2>
                {selectedQuote?.id ? <Link href={`/devis?id=${selectedQuote.id}`} className="link">Voir le devis</Link> : null}
              </div>
              <div className="kv"><span>{L.chantiers.team}</span><b>{task?.assignedTo || L.chantiers.notAssigned}</b></div>
              <div className="kv"><span>{L.chantiers.startDate} → {L.chantiers.endDate}</span><b>{formatDate(task?.startDate)} → {formatDate(task?.endDate || task?.dueDate)}</b></div>
              {ouvragePriceHt > 0 ? <div className="kv"><span>{L.chantiers.validatedPrice}</span><b>{euro(ouvragePriceHt)}</b></div> : null}
              {task && ouvragePriceHt > 0 ? (
                <>
                  <div className="kv"><span>{L.chantiers.ouvrageSpent}</span><b>{euro(ouvrageSpentTotal)}</b></div>
                  <div className="kv"><span>{L.chantiers.ouvrageEarned}</span><b>{euro(ouvrageProfit)}</b></div>
                </>
              ) : null}
            </div>

            {task && taskExpenses.length > 0 ? (
              <div className="card">
                <div className="card-h"><h2>{L.chantiers.ouvrageExpenses}</h2></div>
                {taskExpenses.map((expense) => (
                  <div className="kv" key={expense.id}><span>{expense.category} · {expense.label}</span><b>{euro(expense.amount)}</b></div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {planningModal}

        {ouvrageAddOpen ? (
          <div className="legacy">
            <div className="qa-overlay" onClick={() => setOuvrageAddOpen(false)}>
              <div className="qa-modal" onClick={(event) => event.stopPropagation()}>
                <div className="qa-header">
                  <strong>{L.chantiers.quickAddTitle}</strong>
                  <button type="button" className="qa-close" onClick={() => setOuvrageAddOpen(false)} aria-label={L.common.close}>✕</button>
                </div>
                <div className="qa-tabs">
                  <button type="button" className={`qa-tab${ouvrageAddTab === "team" ? " active" : ""}`} onClick={() => setOuvrageAddTab("team")}>
                    <span>👷</span><span>{L.chantiers.quickAddTeam}</span>
                  </button>
                  <button type="button" className={`qa-tab${ouvrageAddTab === "expense" ? " active" : ""}`} onClick={() => setOuvrageAddTab("expense")}>
                    <span>💶</span><span>{L.chantiers.quickAddExpense}</span>
                  </button>
                  <button type="button" className={`qa-tab${ouvrageAddTab === "note" ? " active" : ""}`} onClick={() => setOuvrageAddTab("note")}>
                    <span>💬</span><span>{L.chantiers.quickAddNote}</span>
                  </button>
                </div>

                {ouvrageAddTab === "team" ? (
                  <div className="qa-form">
                    <p className="tool-muted">{L.chantiers.quickAddTeamHint}</p>
                    <div className="worker-chip-grid">
                      {workers.length === 0 ? <p className="tool-muted">{L.chantiers.addWorkers}</p> : null}
                      {workers.map((worker) => (
                        <button
                          type="button"
                          key={worker.id}
                          className={quickAddWorkerIds.includes(worker.id) ? "active" : ""}
                          onClick={() => toggleQuickAddWorker(worker.id)}
                        >
                          <span>{worker.name}</span>
                          <small>{worker.type || "Ouvrier"} - {worker.profession || worker.role}</small>
                        </button>
                      ))}
                    </div>
                    <div className="qa-actions">
                      <button type="button" className="qa-cancel" onClick={() => setOuvrageAddOpen(false)}>{L.common.cancel}</button>
                      <button type="button" className="qa-submit" onClick={saveQuickAddTeam}>{L.chantiers.quickAddSaveTeam}</button>
                    </div>
                  </div>
                ) : null}

                {ouvrageAddTab === "expense" ? (
                  <form className="qa-form" onSubmit={addOuvrageExpense}>
                    <div className="qa-field">
                      <label className="qa-label">{L.chantiers.realExpense}</label>
                      <input className="qa-input" value={ouvrageExpenseForm.label} onChange={(event) => setOuvrageExpenseForm((current) => ({ ...current, label: event.target.value }))} placeholder={L.chantiers.realExpense} />
                    </div>
                    <div className="qa-row">
                      <div className="qa-field">
                        <label className="qa-label">{L.chantiers.amount}</label>
                        <input className="qa-input" type="number" step="0.01" min="0.01" value={ouvrageExpenseForm.amount} onChange={(event) => setOuvrageExpenseForm((current) => ({ ...current, amount: event.target.value }))} placeholder="0,00" />
                      </div>
                      <div className="qa-field">
                        <label className="qa-label">{L.chantiers.category}</label>
                        <select className="qa-input" value={ouvrageExpenseForm.category} onChange={(event) => setOuvrageExpenseForm((current) => ({ ...current, category: event.target.value }))}>
                          {["Fournitures", "Main d'oeuvre", "Sous-traitance", "Tickets", "Autres frais"].map((category) => <option key={category}>{category}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="qa-field">
                      <label className="qa-label">{L.chantiers.location}</label>
                      <input className="qa-input" value={ouvrageExpenseForm.location} onChange={(event) => setOuvrageExpenseForm((current) => ({ ...current, location: event.target.value }))} placeholder={L.chantiers.location} />
                    </div>
                    <div className="qa-field">
                      <label className="qa-label">{L.facturation.note}</label>
                      <textarea className="qa-input qa-textarea" rows={2} value={ouvrageExpenseForm.notes} onChange={(event) => setOuvrageExpenseForm((current) => ({ ...current, notes: event.target.value }))} />
                    </div>
                    <div className="qa-actions">
                      <button type="button" className="qa-cancel" onClick={() => setOuvrageAddOpen(false)}>{L.common.cancel}</button>
                      <button type="submit" className="qa-submit">{L.chantiers.addExpense}</button>
                    </div>
                  </form>
                ) : null}

                {ouvrageAddTab === "note" ? (
                  <div className="qa-form">
                    <p className="tool-muted">{L.chantiers.quickAddNoteHint}</p>
                    <div className="qa-actions">
                      <button type="button" className="qa-cancel" onClick={() => setOuvrageAddOpen(false)}>{L.common.cancel}</button>
                      <button type="button" className="qa-submit" onClick={goToNoteComposer}>{L.chantiers.quickAddGoToNote}</button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </Shell>
    );
  }

  if (selectedProject && selectedQuote && !quoteSigned && !startChoiceMade) {
    return (
      <Shell variant="pro">
        <div className="head">
          <div className="stack">
            {chantierCrumb}
            <h1>{selectedProject.title}</h1>
            <span className="muted">{selectedQuote.client || selectedProject.client || L.chantiers.contact} · devis {selectedQuote.quoteNumber} non signé</span>
          </div>
        </div>
        <div className="card start-card">
          <div className="card-h"><h2>Le devis n'est pas encore signé</h2></div>
          <p>{L.chantiers.startChoiceIntro}</p>
          <div className="hact">
            <button type="button" className="btn btn-sec" onClick={() => setStartChoiceMade(true)}>{L.chantiers.startChoiceBeginSite}</button>
            <button type="button" className="btn btn-main" onClick={() => router.push(`/devis?id=${selectedQuote.id}`)}>{L.chantiers.startChoiceEditQuote}</button>
          </div>
        </div>
      </Shell>
    );
  }

  if (selectedProject) {
    const today = new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();
    const clientName = selectedQuote?.client || selectedProject.client || L.chantiers.contact;
    const portalId = clientPortalAccess?.portalIdentifier || selectedQuote?.clientPortalAccess?.portalIdentifier || "";
    const portalPassword = clientPortalAccess?.password || selectedQuote?.clientPortalAccess?.password || "";
    const issuedInvoices = linkedInvoices.filter((invoice) => invoice.status !== "Brouillon");
    const invoicedTtc = issuedInvoices.reduce((sum, invoice) => sum + Number(invoice.amountTtc || 0), 0);
    const unpaidTtc = issuedInvoices.filter((invoice) => invoice.status !== "Payee").reduce((sum, invoice) => sum + Number(invoice.amountTtc || 0), 0);
    const quoteTtc = Number(selectedQuote?.totalTtc || 0);
    const endDates = projectTasks.map((task) => task.endDate || task.dueDate).filter(Boolean).sort();
    const startDates = projectTasks.map((task) => task.startDate).filter(Boolean).sort();
    const plannedEnd = endDates.at(-1) || selectedProject.endDate || selectedProject.dueDate || "";
    const plannedStart = startDates[0] || selectedProject.startDate || "";
    const upcomingEvents = projectEvents.filter((event) => String(event.startAt || "") >= nowIso);
    const unplannedCount = trackingLines.filter((line) => !line.task || (!line.task.startDate && !line.task.endDate && !line.task.dueDate)).length;
    // Rien de planifié sur un devis signé : la fiche propose de lancer le
    // chantier (planning par lot, maquette PRO-02.1).
    const lotsLancer = lotsDuDevis(selectedQuote).length;
    const lancerPossible = lotsLancer > 0 && trackingLines.length > 0 && unplannedCount === trackingLines.length;

    // Lots de la fiche (maquette PRO-02.1) : les lignes du devis regroupées
    // par pièce / lot, dans l'ordre du devis ; les tâches hors devis à part.
    const lotsFiche = [];
    for (const line of trackingLines) {
      const nom = String((line.quoteLine || line.task || {}).room || "Chantier").trim() || "Chantier";
      let lot = lotsFiche.find((l) => l.nom === nom);
      if (!lot) { lot = { nom, lignes: [] }; lotsFiche.push(lot); }
      lot.lignes.push(line);
    }
    lotsFiche.forEach((lot, index) => {
      const taches = lot.lignes.map((l) => l.task).filter(Boolean);
      const debuts = taches.map((t) => t.startDate).filter(Boolean).sort();
      const fins = taches.map((t) => t.endDate || t.dueDate).filter(Boolean).sort();
      const equipes = [...new Set(taches
        .filter((t) => t.assignedTo && t.assignedTo !== "Equipe")
        .map((t) => `${t.assignedTo}${t.participantType === "Sous-traitants" ? " · sous-traitant" : ""}`))];
      const faites = lot.lignes.filter((l) => l.task?.done).length;
      const aCommander = supplyNeeds.filter((need) => need.status === "A commander" && lot.lignes.some((l) => (l.task?.label || l.quoteLine?.label) === need.taskLabel));
      lot.numero = String(index + 1).padStart(2, "0");
      lot.montant = lot.lignes.reduce((n, l) => n + Number(l.quoteLine?.totalHt || 0), 0);
      lot.debut = debuts[0] || "";
      lot.fin = fins.at(-1) || "";
      lot.equipe = equipes.join(", ") || (taches.length ? "Équipe" : L.chantiers.notAssigned);
      lot.pourcent = lot.lignes.length ? Math.round((faites / lot.lignes.length) * 100) : 0;
      lot.etat = faites === lot.lignes.length && faites > 0
        ? "Terminé"
        : taches.some((t) => ouvrageStatusKey(t) === "encours" || t.done)
          ? `En cours · ${faites} / ${lot.lignes.length} ouvrage${lot.lignes.length > 1 ? "s" : ""} fait${faites > 1 ? "s" : ""}`
          : lot.debut ? `À démarrer le ${formatDate(lot.debut)}` : "Pas encore planifié";
      lot.fournitures = aCommander.length
        ? `Fournitures à commander : ${aCommander.map((n) => `${n.name} ${n.quantity} ${n.unit || ""}`.trim()).join(", ")}`
        : "";
    });

    // Photos par lot : avant, après, ce qui manque (lib/photos-chantier.js).
    lotsFiche.forEach((lot) => {
      lot.photos = photosDuLot(photosChantier, lot.nom, { faites: lot.lignes.filter((l) => l.task?.done).length, total: lot.lignes.length });
      if (lot.photos.etat === "apres_manquante") lot.etat = "Ouvrages faits · photo après manquante, le lot ne peut pas être clôturé";
    });
    const photosPendant = photosChantier.filter((p) => !PHASES_RESERVE.includes(p.phase) && (!p.lot || p.phase === "pendant"));
    const comptesReserves = compterReserves(reserves);
    const reservesVisibles = reserves.filter((r) => filtreReserves === "toutes" || r.statut === filtreReserves);
    const reserveChoisie = reserves.find((r) => r.id === reserveOuverte) || null;
    const photoReserve = (r, phase) => photosChantier.filter((p) => p.reserveId === r?.id && p.phase === phase).at(-1) || null;

    // Clôture (maquette PRO-02.4, lib/cloture-chantier.js).
    const idsCloture = { projectId: selectedProject.id, quoteId: selectedQuote?.id };
    const facturesCloture = facturesDuChantier(invoices, idsCloture);
    const factureSolde = factureDeSolde(invoices, idsCloture);
    const factureRetenue = factureDeRetenue(invoices, idsCloture);
    const solde = montantsSolde({ devis: selectedQuote, avenants: avenantsDevis, factures: facturesCloture, tauxRetenue: cloture?.retenue?.taux || 0 });
    const etapes = etapesCloture({ cloture, reserves, solde, factureSolde, factureRetenue, aujourdhui: today });
    const bilan = bilanChantier({ solde, depenses: linkedExpenses, budgetEstime: budgetTotal.estimated, taches: projectTasks, devis: selectedQuote, receptionLe: cloture?.pv?.signeLe || "", aujourdhui: today });
    const garantiesChantier = garanties(cloture?.pv?.signeLe || "");

    const demarre = projectTasks.some((t) => t.done || ouvrageStatusKey(t) === "encours");
    const lotsFaits = lotsFiche.filter((l) => l.pourcent === 100).length;
    const sousTitreAvancement = !demarre && plannedStart
      ? `démarrage le ${formatDate(plannedStart)}`
      : lotsFiche.length
        ? `${lotsFaits} lot${lotsFaits > 1 ? "s" : ""} terminé${lotsFaits > 1 ? "s" : ""} sur ${lotsFiche.length}`
        : "aucune tâche planifiée";
    const acomptes = issuedInvoices.filter((f) => f.kind === "acompte" || /acompte/i.test(f.type || ""));
    const sousTitreFacture = issuedInvoices.length === 0
      ? "aucune facture envoyée"
      : acomptes.length === issuedInvoices.length && quoteTtc > 0
        ? `acompte ${Math.round((invoicedTtc / quoteTtc) * 100)} %, ${unpaidTtc > 0 ? "non réglé" : "réglé"}`
        : unpaidTtc > 0 ? `${euro(unpaidTtc)} non réglé` : "tout est réglé";
    const photos = linkedDocuments.filter((d) => d.type === "Photo");
    const nbPhotos = photosChantier.length + photos.length;
    const autresDocuments = linkedDocuments.filter((d) => d.type !== "Photo");
    const lineProgress = (task) => ({ debut: 0, encours: 50, termine: 100, valide: 100 })[ouvrageStatusKey(task)];
    const archived = Boolean(selectedProject.archiveId || linkedArchive);
    const archiveSummary = selectedProject.archiveSummary || linkedArchive?.summary || null;

    const aTraiterPhotos = lotsFiche
      .filter((lot) => lot.photos?.etat === "apres_manquante")
      .map((lot) => ({ id: `photo-${lot.nom}`, title: `Lot ${lot.numero} : photo après manquante`, meta: "à prendre dans l'app Koji Pro avant la clôture", tag: "À faire", tone: "tag tag-e tag-w", tab: "photos" }));
    const aTraiter = [
      ...aTraiterPhotos,
      ...upcomingTasks
        .filter((task) => !task.pendingValidation && (task.endDate || task.dueDate || "") && (task.endDate || task.dueDate) < today)
        .map((task) => ({ id: `late-${task.id}`, title: task.label, meta: `prévu le ${formatDate(task.endDate || task.dueDate)} · ${task.assignedTo || "équipe non assignée"}`, tag: "En retard", tone: "tag tag-b", lineKey: task.quoteItemId || task.id })),
      ...projectTasks
        .filter((task) => task.pendingValidation && !task.done)
        .map((task) => ({ id: `val-${task.id}`, title: task.label, meta: task.completedByName ? `terminé par ${task.completedByName}` : "terminé, à valider", tag: "À valider", tone: "tag tag-o", lineKey: task.quoteItemId || task.id })),
      ...issuedInvoices
        .filter((invoice) => invoice.kind !== "avoir" && invoice.status === "Emise" && invoice.dueDate && invoice.dueDate < today)
        .map((invoice) => ({ id: `inv-${invoice.id}`, title: `Facture ${invoice.invoiceNumber}`, meta: `${euro(invoice.amountTtc)} TTC · échéance le ${formatDate(invoice.dueDate)}`, tag: "À relancer", tone: "tag tag-o", href: "/facturation" })),
      ...supplyNeeds
        .filter((need) => need.status === "A commander")
        .map((need, index) => ({ id: `sup-${index}`, title: need.name, meta: `${need.quantity} ${need.unit} · ${need.taskLabel}`, tag: "À commander", tone: "tag tag-e", tab: "fournitures" })),
      ...(quoteSigned && !portalId ? [{ id: "portal", title: "Accès client à créer", meta: "le client ne peut pas encore suivre son chantier", tag: "Client", tone: "tag tag-e" }] : []),
      ...(unplannedCount > 0 ? [{ id: "unplanned", title: `${unplannedCount} ouvrage${unplannedCount > 1 ? "s" : ""} à planifier`, meta: "sans date ni équipe", tag: "À planifier", tone: "tag tag-o", tab: "lots" }] : [])
    ];

    // Onglets de la maquette PRO-02.1 (Messages : pas encore sur le site),
    // plus « Coût » (budget et dépenses du chantier).
    const ficheTabs = [
      { id: "lots", label: "Lots", count: lotsFiche.length },
      { id: "planning", label: "Planning", count: upcomingTasks.length + upcomingEvents.length },
      { id: "fournitures", label: "Fournitures", count: supplyNeeds.length },
      { id: "situations", label: "Situations", count: linkedInvoices.length },
      { id: "documents", label: "Documents", count: autresDocuments.length + (selectedQuote ? 1 : 0) },
      { id: "photos", label: "Photos", count: nbPhotos },
      { id: "reserves", label: "Réserves", count: comptesReserves.badge },
      { id: "cloture", label: "Clôture" },
      { id: "cout", label: "Coût" }
    ];

    function ouvrirFacture(invoice) {
      if (invoice.sourceType === "quote-transform" && invoice.quoteId) window.open(`/api/quotes/${invoice.quoteId}/documents?type=facture&format=pdf`, "_blank");
      else window.open(`/api/invoices/pdf?id=${encodeURIComponent(invoice.id)}&userId=${encodeURIComponent(readStoredUser()?.id || "")}`, "_blank");
    }

    function actionCloture(action) {
      switch (action?.id) {
        case "signer_pv": setPvOuvert(true); break;
        case "voir_pv": window.open(`/api/cloture?projectId=${encodeURIComponent(selectedProject.id)}&pdf=1`, "_blank"); break;
        case "reserves": setFicheTab("reserves"); break;
        case "emettre_solde":
          router.push(`/facturation?quoteId=${encodeURIComponent(selectedQuote?.id || "")}&type=solde&montant=${solde.soldeTtc}&note=${encodeURIComponent(noteSolde(solde, cloture?.pv?.signeLe))}`);
          break;
        case "facture": if (factureSolde) ouvrirFacture(factureSolde); break;
        case "facture_retenue": if (factureRetenue) ouvrirFacture(factureRetenue); break;
        case "facturer_retenue": router.push(`/facturation?quoteId=${encodeURIComponent(selectedQuote?.id || "")}&type=retenue`); break;
        case "dossier": setFicheTab("documents"); break;
        case "avis_on": majCloture("avis", { programme: true }); break;
        case "avis_off": majCloture("avis", { programme: false }); break;
        case "retenue_on": majCloture("retenue", { taux: 5 }); break;
        case "retenue_off": majCloture("retenue", { taux: 0 }); break;
        case "rappel": majCloture("rappel"); break;
        default: break;
      }
    }

    function openTraiter(entry) {
      if (entry.lineKey) setOpenLineKey(entry.lineKey);
      else if (entry.href) router.push(entry.href);
      else if (entry.tab) setFicheTab(entry.tab);
    }

    function invoiceTag(invoice) {
      if (invoice.kind === "avoir") return <span className="tag tag-o">Avoir</span>;
      if (invoice.status === "Payee") return <span className="tag tag-o dim">Payée</span>;
      if (invoice.status === "Emise") return <span className="tag tag-e">Envoyée</span>;
      return <span className="tag tag-o">{invoice.status || "Brouillon"}</span>;
    }

    return (
      <Shell variant="pro">
        <div className="head">
          <div className="stack">
            {chantierCrumb}
            <h1>{selectedProject.title}</h1>
            <span className="muted">
              {[
                clientName,
                selectedProject.address,
                selectedQuote ? `devis ${selectedQuote.quoteNumber} ${quoteSigned ? "signé" : "non signé"}` : "",
                selectedQuote?.totalHt ? `${euro(selectedQuote.totalHt)} HT` : ""
              ].filter(Boolean).join(" · ")}
            </span>
          </div>
          <div className="hact">
            <Link href="/planning" className="btn btn-sec">Planning</Link>
            {selectedQuote ? <Link href={`/avenant?quoteId=${selectedQuote.id}`} className="btn btn-sec">Avenant</Link> : null}
            {selectedQuote && quoteSigned ? (
              <Link href={`/facturation?quoteId=${selectedQuote.id}&type=situation`} className="btn btn-main">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                Situation de travaux
              </Link>
            ) : null}
          </div>
        </div>

        {!projectReady ? <p className="notice">{L.chantiers.trackingActive}</p> : null}
        {message ? <p className="notice" role="status">{message}</p> : null}

        {quoteSigned && lancerPossible ? (
          <section className="lancer-card" aria-label="Lancer le chantier">
            <div>
              <strong>Lancer le chantier</strong>
              <p>
                Koji crée le chantier avec {lotsLancer} lot{lotsLancer > 1 ? "s" : ""} du devis{clientPortalAccess ? "" : ", le client en suivi"},
                {" "}et propose un planning à partir du {jourEtMois(demarragePropose(today))} : vous pourrez ajuster avant de confirmer.
              </p>
            </div>
            <button type="button" className="btn btn-main" onClick={() => setLancerOuvert(true)}>Lancer le chantier</button>
          </section>
        ) : null}

        {lancerOuvert && selectedQuote ? (
          <LancerChantier
            project={selectedProject}
            quote={selectedQuote}
            tasks={projectTasks}
            workers={workers}
            hoursPerDay={Number(readStoredUser()?.business?.hoursPerDay) || 7}
            clientPortalAccess={clientPortalAccess}
            invoices={linkedInvoices}
            onClose={() => setLancerOuvert(false)}
            onDone={apresLancement}
          />
        ) : null}

        <div className="kpis">
          <div>
            <div className="l">Avancement</div>
            <div className="v">{progress} %</div>
            <div className="s">{sousTitreAvancement}</div>
          </div>
          <div>
            <div className="l">Facturé</div>
            <div className="v">{euro(invoicedTtc)}</div>
            <div className="s">{sousTitreFacture}</div>
          </div>
          <div>
            <div className="l">Reste à facturer</div>
            <div className="v">{quoteTtc ? euro(Math.max(0, quoteTtc - invoicedTtc)) : "—"}</div>
            <div className="s">TTC, par situations</div>
          </div>
          <div>
            <div className="l">Fin prévue</div>
            <div className="v">{plannedEnd ? formatDate(plannedEnd) : "—"}</div>
            <div className="s">{plannedStart && plannedEnd ? `${joursOuvresEntre(plannedStart, plannedEnd)} jours ouvrés` : "pas encore planifié"}</div>
          </div>
        </div>

        <div className="wtabs" role="tablist" aria-label="Sections du chantier">
          {ficheTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={ficheTab === tab.id}
              className={ficheTab === tab.id ? "on" : ""}
              onClick={() => setFicheTab(tab.id)}
            >
              {tab.label}{tab.count ? <span>{tab.count}</span> : null}
            </button>
          ))}
        </div>

        <div className="fiche-grid">
          <div className="fiche-main">
            {ficheTab === "lots" ? (
              <div className="card">
                <div className="card-h">
                  <h2>Lots</h2>
                  {quoteSigned && lotsLancer > 0 ? (
                    <button type="button" className="link" onClick={() => setLancerOuvert(true)}>Modifier</button>
                  ) : selectedQuote?.id ? <Link href={`/devis?id=${selectedQuote.id}`} className="link">Modifier le devis</Link> : null}
                </div>
                {lotsFiche.length === 0 ? (
                  <p className="empty">{L.chantiers.noQuoteLines}</p>
                ) : lotsFiche.map((lot) => {
                  const ouvert = lotOuvert === lot.nom;
                  return (
                    <div key={lot.nom} className={`lot-f${ouvert ? " open" : ""}`}>
                      <div
                        className="lf"
                        role="button"
                        tabIndex={0}
                        aria-expanded={ouvert}
                        onClick={() => setLotOuvert(ouvert ? null : lot.nom)}
                        onKeyDown={(event) => { if (event.key === "Enter") setLotOuvert(ouvert ? null : lot.nom); }}
                      >
                        <div className="lf-h">
                          <span className="lc">Lot {lot.numero}</span>
                          <strong>{lot.nom}</strong>
                          <span className="lf-w">{lot.equipe}</span>
                          <span className="lf-d">{lot.debut && lot.fin ? `${formatDate(lot.debut)} → ${formatDate(lot.fin)}` : "Non planifié"}</span>
                          <span className="lf-a">{lot.montant > 0 ? euro(lot.montant) : ""}</span>
                        </div>
                        <div className="bar"><i style={{ width: `${lot.pourcent}%` }} /></div>
                        <div className="lf-s">
                          <span>{lot.fournitures || lot.etat}</span>
                          <span className="lf-n">{lot.lignes.length} ouvrage{lot.lignes.length > 1 ? "s" : ""} {ouvert ? "▴" : "▾"}</span>
                        </div>
                      </div>
                      {ouvert ? (
                        <div className="lot-l">
                          {lot.lignes.map((line) => {
                  const lineItem = line.quoteLine || line.task || {};
                  const task = line.task;
                  const amount = Number(line.quoteLine?.totalHt || 0);
                  const end = task?.endDate || task?.dueDate;
                  let dates = "Non planifié";
                  if (task?.startDate && end) dates = `${formatDate(task.startDate)} → ${formatDate(end)}`;
                  else if (end) dates = `avant le ${formatDate(end)}`;
                  else if (task?.startDate) dates = `à partir du ${formatDate(task.startDate)}`;
                  const statusKey = ouvrageStatusKey(task);
                  let statusText = "Pas encore planifié";
                  if (task?.done) statusText = "Terminé et validé";
                  else if (task?.pendingValidation) statusText = "Terminé, à valider";
                  else if (statusKey === "encours") statusText = "En cours";
                  else if (task?.startDate) statusText = `À démarrer le ${formatDate(task.startDate)}`;
                  else if (task) statusText = "À démarrer";
                  return (
                    <div
                      className="lf"
                      key={line.key}
                      role="button"
                      tabIndex={0}
                      onClick={() => setOpenLineKey(line.key)}
                      onKeyDown={(event) => { if (event.key === "Enter") setOpenLineKey(line.key); }}
                    >
                      <div className="lf-h">
                        <span className="lc">{lineItem.room || task?.room || "Chantier"}</span>
                        <strong>{lineItem.label || task?.label}</strong>
                        <span className="lf-w">{task?.assignedTo || L.chantiers.notAssigned}</span>
                        <span className="lf-d">{dates}</span>
                        <span className="lf-a">{amount > 0 ? euro(amount) : ""}</span>
                      </div>
                      <div className="bar"><i style={{ width: `${lineProgress(task)}%` }} /></div>
                      <div className="lf-s">
                        <span>{statusText}</span>
                        <span className="lf-act">
                          {task ? (
                            <button type="button" className="btn btn-sec" onClick={(event) => { event.stopPropagation(); toggleDone(task); }}>
                              {task.done ? "Rouvrir" : "Marquer fait"}
                            </button>
                          ) : null}
                          <button type="button" className="btn btn-sec" onClick={(event) => { event.stopPropagation(); openPlanner(line); }}>{L.chantiers.plan}</button>
                        </span>
                      </div>
                    </div>
                  );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}

            {ficheTab === "planning" ? (
              <>
                <div className="card">
                  <div className="card-h">
                    <h2>Tâches</h2>
                    <span className="muted">{L.chantiers.upcoming(upcomingTasks.length)}</span>
                  </div>
                  <form className="pform" onSubmit={addProjectTask}>
                    <input value={taskForm.label} onChange={(event) => setTaskForm((current) => ({ ...current, label: event.target.value }))} placeholder={L.chantiers.newTask} aria-label={L.chantiers.newTask} />
                    <input type="date" value={taskForm.dueDate} onChange={(event) => setTaskForm((current) => ({ ...current, dueDate: event.target.value }))} aria-label="Date" />
                    <input value={taskForm.location} onChange={(event) => setTaskForm((current) => ({ ...current, location: event.target.value }))} placeholder={L.chantiers.location} aria-label={L.chantiers.location} />
                    <button type="submit" className="btn btn-sec">{L.chantiers.add}</button>
                  </form>
                  {upcomingTasks.length === 0 ? <p className="empty">{L.chantiers.noTasks}</p> : upcomingTasks.map((task) => (
                    <div className="row" key={task.id}>
                      <div className="t">
                        <strong>{task.label}</strong>
                        <small>{formatDate(task.dueDate || task.startDate)} · {task.assignedTo || "Équipe"}</small>
                      </div>
                      <button type="button" className="btn btn-sec" onClick={() => toggleDone(task)}>Marquer fait</button>
                    </div>
                  ))}
                  {completedTasks.length > 0 ? (
                    <details className="hist">
                      <summary>{L.chantiers.taskHistory}</summary>
                      {completedTasks.slice(0, 6).map((task) => <p key={task.id}>{task.label} · {formatDate(task.updatedAt || task.createdAt)}</p>)}
                    </details>
                  ) : null}
                </div>

                <div className="card">
                  <div className="card-h">
                    <h2>{L.chantiers.rdv}</h2>
                    <span className="muted">{projectEvents.length} RDV</span>
                  </div>
                  {upcomingEvents.length === 0 ? <p className="empty">{L.chantiers.noRdvPlanned}</p> : upcomingEvents.map((event) => (
                    <div className="row" key={event.id}>
                      <div className="t">
                        <strong>{event.title}</strong>
                        <small>{[dateTimeFromEvent(event), event.clientName, event.address].filter(Boolean).join(" · ")}</small>
                      </div>
                      {event.id === nextRdv?.id ? <span className="tag tag-e">Prochain</span> : null}
                    </div>
                  ))}
                  <form className="pform" onSubmit={addRdv}>
                    <input value={rdvForm.title} onChange={(event) => setRdvForm((current) => ({ ...current, title: event.target.value }))} placeholder={L.chantiers.rdvObject} aria-label={L.chantiers.rdvObject} />
                    <input type="date" value={rdvForm.date} onChange={(event) => setRdvForm((current) => ({ ...current, date: event.target.value }))} aria-label="Date" />
                    <input type="time" value={rdvForm.time} onChange={(event) => setRdvForm((current) => ({ ...current, time: event.target.value }))} aria-label="Heure" />
                    <input value={rdvForm.contact} onChange={(event) => setRdvForm((current) => ({ ...current, contact: event.target.value }))} placeholder={L.chantiers.contact} aria-label={L.chantiers.contact} />
                    <input value={rdvForm.address} onChange={(event) => setRdvForm((current) => ({ ...current, address: event.target.value }))} placeholder={L.chantiers.address} aria-label={L.chantiers.address} />
                    <button type="submit" className="btn btn-sec">{L.chantiers.add}</button>
                  </form>
                </div>
              </>
            ) : null}

            {ficheTab === "fournitures" ? (
              <div className="card">
                <div className="card-h">
                  <h2>{L.chantiers.supplies}</h2>
                  <Link href="/fournitures/catalogue" className="link">{L.chantiers.manageSupplies}</Link>
                </div>
                {supplyNeeds.length === 0 ? <p className="empty">{L.chantiers.noSupplies}</p> : supplyNeeds.map((need, index) => (
                  <div className="row" key={`${need.supplyId}-${index}`}>
                    <div className="t">
                      <strong>{need.name}</strong>
                      <small>{[`${need.quantity} ${need.unit || ""}`.trim(), need.taskLabel, need.note].filter(Boolean).join(" · ")}</small>
                    </div>
                    <span className={need.status === "A commander" ? "tag tag-e" : "tag tag-o"}>{need.status === "A commander" ? "À commander" : need.status}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {ficheTab === "situations" ? (
              <div className="card">
                <div className="card-h">
                  <h2>Situations et factures</h2>
                  {selectedQuote && quoteSigned ? <Link href={`/facturation?quoteId=${selectedQuote.id}&type=situation`} className="link">Situation de travaux</Link> : null}
                </div>
                {linkedInvoices.length === 0 ? (
                  <p className="empty">Aucune facture pour ce chantier. L'acompte et les situations de travaux apparaissent ici.</p>
                ) : linkedInvoices.map((invoice) => (
                  <Link className="row" key={invoice.id} href="/facturation">
                    <div className="t"><strong>{invoice.invoiceNumber || "Facture"}</strong><small>{[invoice.type || "Facture", `${euro(invoice.amountTtc)} TTC`, invoice.dueDate ? `échéance ${formatDate(invoice.dueDate)}` : ""].filter(Boolean).join(" · ")}</small></div>
                    {invoiceTag(invoice)}
                  </Link>
                ))}
              </div>
            ) : null}

            {ficheTab === "photos" ? (
              <>
                <div className="ph-note">
                  <strong>Chaque lot commence par une photo avant et se termine par une photo après, prises dans l'application.</strong>
                  <small>Date, heure et auteur enregistrés par Koji au moment de la prise · non modifiables</small>
                </div>
                <div className="card">
                  <div className="card-h">
                    <h2>Avant et après, par lot</h2>
                    <div className="kp-seg" role="group" aria-label="Filtrer les photos">
                      {[["tous", "Tous"], ["avap", "Avant / après"], ["pendant", "Pendant"]].map(([id, label]) => (
                        <button key={id} type="button" className={filtrePhotos === id ? "on" : ""} aria-pressed={filtrePhotos === id} onClick={() => setFiltrePhotos(id)}>{label}</button>
                      ))}
                    </div>
                  </div>
                  {filtrePhotos !== "pendant" ? (lotsFiche.length === 0 ? <p className="empty">Pas encore de lots : les photos se rangent par lot du devis.</p> : lotsFiche.map((lot) => {
                    const ph = lot.photos;
                    const vignette = (photo, libelle) => (
                      <figure className="ph-v">
                        {photo?.url ? <a href={photo.url} target="_blank" rel="noreferrer"><img src={photo.url} alt={`${libelle}, lot ${lot.numero}`} loading="lazy" /></a> : <span className="ph-vide">{libelle === "Après" ? (ph.etat === "apres_manquante" ? "Photo après manquante" : "Pas encore de photo après") : "Pas encore de photo avant"}</span>}
                        <figcaption>
                          <b>{libelle}</b>
                          {photo ? <small>{horodatage(photo.takenAt)} · {photo.author}</small> : libelle === "Après" && ph.etat === "apres_manquante" ? <small>le lot ne peut pas être clôturé sans elle</small> : <small>à prendre dans l'app Koji Pro</small>}
                        </figcaption>
                      </figure>
                    );
                    return (
                      <div className="ph-lot" key={lot.nom}>
                        <div className="ph-lot-h">
                          <strong>Lot {lot.numero} · {lot.nom}</strong>
                          <span>{lot.equipe}</span>
                          <span className={`ph-etat ${ph.etat}`}>{LIBELLE_ETAT_PHOTOS[ph.etat]}</span>
                        </div>
                        <div className="ph-paire">
                          {vignette(ph.avant, "Avant")}
                          {vignette(ph.apres, "Après")}
                        </div>
                      </div>
                    );
                  })) : null}
                  {filtrePhotos !== "avap" && (photosPendant.length || photos.length) ? (
                    <div className="ph-lot">
                      <div className="ph-lot-h"><strong>Pendant les travaux</strong><span>{photosPendant.length + photos.length} photo{photosPendant.length + photos.length > 1 ? "s" : ""}</span></div>
                      <div className="ph-grille">
                        {photosPendant.map((photo) => (
                          <figure className="ph-v" key={photo.id}>
                            {photo.url ? <a href={photo.url} target="_blank" rel="noreferrer"><img src={photo.url} alt={photo.caption || photo.taskTitle || "Photo du chantier"} loading="lazy" /></a> : <span className="ph-vide">Photo</span>}
                            <figcaption><b>{photo.caption || photo.taskTitle || "Pendant"}</b><small>{horodatage(photo.takenAt)} · {photo.author}</small></figcaption>
                          </figure>
                        ))}
                        {photos.map((document) => (
                          <figure className="ph-v" key={document.id}>
                            {document.url ? <a href={document.url} target="_blank" rel="noreferrer"><span className="ph-vide">Ouvrir le lien</span></a> : <span className="ph-vide">Photo</span>}
                            <figcaption><b>{document.title}</b><small>lien ajouté à la main</small></figcaption>
                          </figure>
                        ))}
                      </div>
                    </div>
                  ) : filtrePhotos === "pendant" ? <p className="empty">Aucune photo prise pendant les travaux.</p> : null}
                </div>
                <div className="card">
                  <div className="card-h"><h2>Partage avec la cliente</h2></div>
                  <div className="kv"><span>Photos après de chaque lot</span><b>à partager avec la situation (Koji Client, à venir)</b></div>
                  <div className="kv"><span>Photos avant et pendant</span><b>gardées pour vous, preuve en cas de litige</b></div>
                </div>
              </>
            ) : null}

            {ficheTab === "reserves" ? (
              <div className="card rs-t">
                <div className="card-h">
                  <h2>Réserves</h2>
                  <div className="kp-seg" role="group" aria-label="Filtrer les réserves">
                    {FILTRES_RESERVES.map((f) => (
                      <button key={f.id} type="button" className={filtreReserves === f.id ? "on" : ""} aria-pressed={filtreReserves === f.id} onClick={() => setFiltreReserves(f.id)}>
                        {f.label} <b>{comptesReserves[f.id]}</b>
                      </button>
                    ))}
                  </div>
                </div>
                {reservesVisibles.length === 0 ? (
                  <p className="empty">{reserves.length ? "Aucune réserve dans ce filtre." : "Aucune réserve. Prenez-les en photo dans l'app Koji Pro, ou ajoutez-les ci-dessous."}</p>
                ) : (
                  <table className="rs-tab">
                    <thead><tr><th aria-label="Numéro" /><th>Réserve</th><th>Attribuée à</th><th>Pour le</th><th>Statut</th></tr></thead>
                    <tbody>
                      {reservesVisibles.map((r) => {
                        const st = statutReserve(r, today);
                        return (
                          <tr key={r.id} className={reserveOuverte === r.id ? "on" : ""} tabIndex={0} onClick={() => setReserveOuverte(r.id)} onKeyDown={(event) => { if (event.key === "Enter") setReserveOuverte(r.id); }}>
                            <td className="rs-n">{r.numero}</td>
                            <td><div className="rs-ti">{r.titre}</div><div className="rs-sm">{sousTitreReserve(r)}</div></td>
                            <td>{r.attribueeNom || <span className="rs-sm">à attribuer</span>}</td>
                            <td className="rs-sm">{pourLeReserve(r)}</td>
                            <td>
                              {st.ton === "ok" ? <span className="rs-ok"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>{st.label}</span>
                                : st.ton === "pr" ? <span className="rs-pr">{st.label}</span>
                                : <span className={st.ton === "b" ? "tag tag-b" : st.ton === "e" ? "tag tag-e" : "tag tag-o"}>{st.label}</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
                <p className="rs-pv">À la réception, Koji inscrit les réserves non levées au procès-verbal.</p>
                <form className="pform" onSubmit={creerReserve}>
                  <input value={nouvelleReserve.titre} onChange={(event) => setNouvelleReserve((r) => ({ ...r, titre: event.target.value }))} placeholder="Nouvelle réserve : carreau fêlé derrière le WC" aria-label="Réserve" maxLength={200} />
                  <input value={nouvelleReserve.lieu} onChange={(event) => setNouvelleReserve((r) => ({ ...r, lieu: event.target.value }))} placeholder="Où : mur WC" aria-label="Lieu" maxLength={120} />
                  <select value={nouvelleReserve.attribueeA} onChange={(event) => setNouvelleReserve((r) => ({ ...r, attribueeA: event.target.value }))} aria-label="Attribuée à">
                    <option value="">À attribuer</option>
                    <option value="moi">Vous</option>
                    {workers.map((w) => <option key={w.id} value={w.id}>{w.name}{w.type === "Sous-traitant" ? " · sous-traitant" : ""}</option>)}
                  </select>
                  <input type="date" value={nouvelleReserve.pourLe} onChange={(event) => setNouvelleReserve((r) => ({ ...r, pourLe: event.target.value }))} aria-label="Pour le" />
                  <button type="submit" className="btn btn-sec" disabled={reserveEnvoi || !nouvelleReserve.titre.trim()}>Ajouter la réserve</button>
                </form>
              </div>
            ) : null}

            {ficheTab === "cloture" ? (
              <div className="card cl-steps">
                <div className="card-h">
                  <h2>Clôturer le chantier</h2>
                  <span className="sm2">Koji prépare chaque étape</span>
                </div>
                {etapes.map((e, index) => (
                  <div className={`cl-st ${e.etat}`} key={e.id}>
                    <span className="cl-n">{e.etat === "ok" ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg> : e.etat === "cur" ? index + 1 : null}</span>
                    <div>
                      <strong>{e.titre}</strong>
                      <small>{e.detail}</small>
                    </div>
                    {e.action ? (
                      e.action.id === null
                        ? <span className="cl-lab">{e.action.label}</span>
                        : e.action.principal && e.etat === "cur"
                          ? <button type="button" className="btn btn-main" disabled={clotureEnvoi} onClick={() => actionCloture(e.action)}>{e.action.label}</button>
                          : <button type="button" className="link" disabled={clotureEnvoi} onClick={() => actionCloture(e.action)}>{e.action.label}</button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {pvOuvert ? (
              <PvReception
                project={selectedProject}
                quote={selectedQuote}
                reserves={reserves}
                solde={solde}
                travaux={travauxReceptionnes(selectedQuote, lotsFiche.length, solde.avenants)}
                onClose={() => setPvOuvert(false)}
                onSigned={(c) => { setCloture(c); setPvOuvert(false); setMessage(`Procès-verbal ${c.pv?.numero || ""} signé. Les garanties partent d'aujourd'hui.`); }}
              />
            ) : null}

            {ficheTab === "documents" ? (
              <div className="card">
                <div className="card-h"><h2>{L.chantiers.documents}</h2></div>
                {selectedQuote ? (
                  <a className="row" href={quoteDocumentUrl(selectedQuote.id)} target="_blank" rel="noreferrer">
                    <div className="t"><strong>Devis {selectedQuote.quoteNumber}</strong><small>PDF</small></div>
                    <span className="tag tag-o">Devis</span>
                  </a>
                ) : null}
                {autresDocuments.map((document) => (
                  <div className="row" key={document.id}>
                    <div className="t">
                      <strong>{document.title}</strong>
                      <small>{[document.type, document.category, document.amount ? euro(document.amount) : "", document.location].filter(Boolean).join(" · ")}</small>
                    </div>
                    {document.url ? <a className="link" href={document.url} target="_blank" rel="noreferrer">Ouvrir</a> : null}
                  </div>
                ))}
                {!selectedQuote && autresDocuments.length === 0 ? <p className="empty">Aucun document pour le moment.</p> : null}
                <form className="pform" onSubmit={addDocument}>
                  <input value={documentForm.title} onChange={(event) => setDocumentForm((current) => ({ ...current, title: event.target.value }))} placeholder={L.chantiers.docNameOrPhoto} aria-label={L.chantiers.docNameOrPhoto} />
                  <select value={documentForm.type} onChange={(event) => setDocumentForm((current) => ({ ...current, type: event.target.value }))} aria-label="Type">
                    {["Document", "Photo", "Facture", "Ticket", "Bon de commande", "Justificatif"].map((type) => <option key={type}>{type}</option>)}
                  </select>
                  <input value={documentForm.category} onChange={(event) => setDocumentForm((current) => ({ ...current, category: event.target.value }))} placeholder={L.chantiers.category} aria-label={L.chantiers.category} />
                  <input type="number" value={documentForm.amount} onChange={(event) => setDocumentForm((current) => ({ ...current, amount: event.target.value }))} placeholder={L.chantiers.amount} aria-label={L.chantiers.amount} />
                  <input value={documentForm.location} onChange={(event) => setDocumentForm((current) => ({ ...current, location: event.target.value }))} placeholder={L.chantiers.location} aria-label={L.chantiers.location} />
                  <input value={documentForm.url} onChange={(event) => setDocumentForm((current) => ({ ...current, url: event.target.value }))} placeholder={L.chantiers.fileLink} aria-label={L.chantiers.fileLink} />
                  <button type="submit" className="btn btn-sec">{L.chantiers.linkToProject}</button>
                </form>
              </div>
            ) : null}

            {ficheTab === "cout" ? (
              <>
                <div className="card">
                  <div className="card-h">
                    <h2>{L.chantiers.budget}</h2>
                    <span className="muted">{L.chantiers.total} : {euro(budgetTotal.real)} / {euro(budgetTotal.estimated)}</span>
                  </div>
                  <div className="kv"><span>{L.chantiers.autoSpentChantier}</span><b>{euro(chantierSpentAuto)}</b></div>
                  <div className="kv"><span>{L.chantiers.autoMarginChantier}</span><b>{euro(chantierMarginAuto)}</b></div>
                  <table className="btable">
                    <thead>
                      <tr><th>Poste</th><th>{L.chantiers.estimated}</th><th>{L.chantiers.real}</th><th aria-label="État" /></tr>
                    </thead>
                    <tbody>
                      {budgetRows.map((row) => {
                        const overBudget = Number(row.real || 0) > Number(row.estimated || 0);
                        return (
                          <tr key={row.id}>
                            <td>{row.label}</td>
                            <td><input type="number" value={row.estimated} onChange={(event) => setBudgetValue(row.id, "estimated", event.target.value)} aria-label={`${row.label} ${L.chantiers.estimated}`} /></td>
                            <td><input type="number" value={row.real} onChange={(event) => setBudgetValue(row.id, "real", event.target.value)} aria-label={`${row.label} ${L.chantiers.real}`} /></td>
                            <td>{overBudget ? <span className="tag tag-b">{L.chantiers.overBudget}</span> : <span className="tag tag-o">{L.chantiers.ok}</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div><button type="button" className="btn btn-sec" onClick={saveBudgetRows}>{L.chantiers.saveBudget}</button></div>
                </div>

                <div className="card">
                  <div className="card-h">
                    <h2>Dépenses</h2>
                    <span className="muted">{euro(chantierSpentAuto)}</span>
                  </div>
                  <form className="pform" onSubmit={addExpense}>
                    <input value={expenseForm.label} onChange={(event) => setExpenseForm((current) => ({ ...current, label: event.target.value }))} placeholder={L.chantiers.realExpense} aria-label={L.chantiers.realExpense} />
                    <select value={expenseForm.category} onChange={(event) => setExpenseForm((current) => ({ ...current, category: event.target.value }))} aria-label={L.chantiers.category}>
                      {["Fournitures", "Main d'oeuvre", "Sous-traitance", "Tickets", "Autres frais"].map((category) => <option key={category}>{category}</option>)}
                    </select>
                    <input type="number" value={expenseForm.amount} onChange={(event) => setExpenseForm((current) => ({ ...current, amount: event.target.value }))} placeholder={L.chantiers.amount} aria-label={L.chantiers.amount} />
                    <input value={expenseForm.location} onChange={(event) => setExpenseForm((current) => ({ ...current, location: event.target.value }))} placeholder={L.chantiers.location} aria-label={L.chantiers.location} />
                    <input value={expenseForm.notes} onChange={(event) => setExpenseForm((current) => ({ ...current, notes: event.target.value }))} placeholder={L.facturation.note} aria-label={L.facturation.note} />
                    <button type="submit" className="btn btn-sec">{L.chantiers.addExpense}</button>
                  </form>
                  {linkedExpenses.length === 0 ? <p className="empty">Aucune dépense enregistrée.</p> : linkedExpenses.map((expense) => (
                    <div className="row" key={expense.id}>
                      <div className="t"><strong>{expense.label}</strong><small>{[expense.category, expense.location].filter(Boolean).join(" · ")}</small></div>
                      <b>{euro(expense.amount)}</b>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>

          <div className="fiche-side">
            {ficheTab === "cloture" ? (
              <>
                <div className="card">
                  <div className="card-h"><h2>Bilan</h2></div>
                  {bilan.lignes.map((l) => <div className="kv" key={l.id}><span>{l.label}</span><b>{l.valeur}</b></div>)}
                  {bilan.appris ? (
                    <div className="cl-kj">
                      <span className="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z" /></svg></span>
                      <div>
                        <strong>Ce que Koji a appris</strong>
                        <small>{bilan.appris}</small>
                      </div>
                      <Link className="link" href="/bibliotheque-ouvrages/mes-prix">Voir</Link>
                    </div>
                  ) : null}
                </div>
                <div className="card">
                  <div className="card-h">
                    <h2>Garanties</h2>
                    <span className="sm2">à partir de la réception</span>
                  </div>
                  <div className="cl-gs">
                    {garantiesChantier.map((g) => (
                      <div className="cl-g" key={g.id}>
                        <b>{g.titre}</b>
                        <span>{g.duree}</span>
                        <small>{g.jusqua}<br />{g.objet}</small>
                      </div>
                    ))}
                  </div>
                  <small className="sm2 cl-gn">Si la cliente signale un désordre dans Koji Client, il arrive ici comme une réserve.</small>
                </div>
              </>
            ) : null}
            {ficheTab === "reserves" && reserveChoisie ? (
              <aside className="card rs-pan" aria-label={`Réserve ${reserveChoisie.numero}`}>
                <div className="rs-ph">
                  <div>
                    <span className="eyebrow">{[reserveChoisie.numero, reserveChoisie.lieu, reserveChoisie.attribueeNom ? `attribuée à ${reserveChoisie.attribueeNom}` : "à attribuer"].filter(Boolean).join(" · ")}</span>
                    <h2>{reserveChoisie.titre}</h2>
                  </div>
                  <button type="button" className="link" onClick={() => setReserveOuverte(null)}>Fermer</button>
                </div>
                <div className="rs-ab">
                  {[["reserve", "Réserve"], ["levee", "Levée"]].map(([phase, libelle]) => {
                    const photo = photoReserve(reserveChoisie, phase);
                    return (
                      <figure className="ph-v" key={phase}>
                        {photo?.url ? <a href={photo.url} target="_blank" rel="noreferrer"><img src={photo.url} alt={`${libelle} ${reserveChoisie.numero}`} /></a> : <span className="ph-vide">{phase === "reserve" ? "Pas de photo" : "Pas encore de photo de levée"}</span>}
                        <figcaption><b>{libelle}</b><small>{photo ? `${horodatage(photo.takenAt)} · ${photo.author}` : phase === "levee" ? "prise dans l'app par l'intervenant" : ""}</small></figcaption>
                      </figure>
                    );
                  })}
                </div>
                {reserveChoisie.note ? (
                  <div className="rs-note"><span className="lab">Note de l'intervenant</span><p>« {reserveChoisie.note} »</p></div>
                ) : null}
                {reserveChoisie.statut === "faite" ? (
                  <div className="rs-act">
                    <button type="button" className="link" disabled={reserveEnvoi} onClick={() => actionReserve(reserveChoisie.id, "refuser")}>Refuser, à refaire</button>
                    <button type="button" className="btn btn-main" disabled={reserveEnvoi} onClick={() => actionReserve(reserveChoisie.id, "valider")}>Valider la levée</button>
                  </div>
                ) : reserveChoisie.statut === "levee" ? (
                  <p className="muted">{statutReserve(reserveChoisie).label}.</p>
                ) : (
                  <p className="muted">La levée se photographie dans l'app Koji Pro ; vous la validez ensuite ici.</p>
                )}
              </aside>
            ) : null}
            <div className="card">
              <div className="card-h">
                <h2>À traiter{aTraiter.length ? <span className="kcnt">{aTraiter.length}</span> : null}</h2>
              </div>
              {aTraiter.length === 0 ? <p className="empty">Rien à traiter pour ce chantier.</p> : aTraiter.slice(0, 6).map((entry) => {
                const clickable = Boolean(entry.lineKey || entry.href || entry.tab);
                const content = (
                  <>
                    <div className="t"><strong>{entry.title}</strong><small>{entry.meta}</small></div>
                    <span className={entry.tone}>{entry.tag}</span>
                  </>
                );
                return clickable
                  ? <button type="button" className="row" key={entry.id} onClick={() => openTraiter(entry)}>{content}</button>
                  : <div className="row" key={entry.id}>{content}</div>;
              })}
              {aTraiter.length > 6 ? <p className="muted">et {aTraiter.length - 6} autre{aTraiter.length - 6 > 1 ? "s" : ""}</p> : null}
            </div>

            <div className="card">
              <div className="card-h">
                <h2>Client</h2>
                {selectedQuote ? <a className="link" href={quoteDocumentUrl(selectedQuote.id)} target="_blank" rel="noreferrer">PDF du devis</a> : null}
              </div>
              <div className="kv"><span>Client</span><b>{clientName}</b></div>
              <div className="kv"><span>Suivi Koji Client</span><b>{portalId ? "Activé" : "Non activé"}</b></div>
              {clientPortalAccess?.email ? <div className="kv"><span>Email</span><b>{clientPortalAccess.email}</b></div> : null}
              {portalId ? (
                <>
                  <div className="kv"><span>Identifiant espace client</span><b>{portalId}</b></div>
                  {portalPassword ? <div className="kv"><span>Mot de passe</span><b>{portalPassword}</b></div> : null}
                </>
              ) : quoteSigned ? (
                <div className="kv-block">
                  <p className="muted">Ce client n'a pas d'accès (devis signé sans email ni téléphone). Ajoutez-en un pour créer son identifiant.</p>
                  <div className="pform">
                    <input type="email" placeholder="Email du client" aria-label="Email du client" value={clientAccessForm.email} onChange={(event) => setClientAccessForm((current) => ({ ...current, email: event.target.value }))} />
                    <input type="tel" placeholder="Téléphone du client" aria-label="Téléphone du client" value={clientAccessForm.phone} onChange={(event) => setClientAccessForm((current) => ({ ...current, phone: event.target.value }))} />
                    <button type="button" className="btn btn-sec" onClick={createClientAccessManually} disabled={clientAccessCreating}>
                      {clientAccessCreating ? "Création…" : "Créer l'accès client"}
                    </button>
                  </div>
                  {clientAccessError ? <p className="err">{clientAccessError}</p> : null}
                </div>
              ) : (
                <div className="kv"><span>Espace client</span><b>après signature du devis</b></div>
              )}
              {selectedQuote ? (
                <>
                  <div className="kv"><span>{L.chantiers.quoteCreated}</span><b>{formatDate(selectedQuote.quoteDate || selectedQuote.createdAt)}</b></div>
                  <div className="kv"><span>{L.chantiers.quoteSent}</span><b>{formatDate(selectedQuote.sentAt)}</b></div>
                  <div className="kv"><span>{L.chantiers.quoteSigned}</span><b>{formatDate(selectedQuote.signedAt)}</b></div>
                  {selectedQuote.signaturePlace ? <div className="kv"><span>{L.chantiers.quoteSignPlace}</span><b>{selectedQuote.signaturePlace}</b></div> : null}
                  {selectedQuote.signerMessage ? <div className="kv"><span>{L.chantiers.clientMessage}</span><b>« {selectedQuote.signerMessage} »</b></div> : null}
                </>
              ) : null}
            </div>

            <div className="card">
              <div className="card-h">
                <h2>{L.chantiers.archive}</h2>
                <span className="muted">{archived ? L.chantiers.archiveCreated : L.chantiers.archivePending}</span>
              </div>
              <p className="muted">{L.chantiers.archiveDesc}</p>
              <div>
                {String(selectedProject.status || "").toLowerCase().includes("termine") ? (
                  <button type="button" className="btn btn-sec" onClick={() => closeProject("archive")}>{L.chantiers.archiveProject}</button>
                ) : (
                  <button type="button" className="btn btn-sec" onClick={() => closeProject("finish")}>{L.chantiers.markFinished}</button>
                )}
              </div>
              {archiveSummary ? Object.entries(archiveSummary).filter(([, value]) => typeof value === "number").map(([key, value]) => (
                <div className="kv" key={key}><span>{key}</span><b>{euro(value)}</b></div>
              )) : null}
              {linkedHistory.length > 0 ? (
                <details className="hist">
                  <summary>{L.chantiers.projectHistory}</summary>
                  {linkedHistory.map((entry) => <p key={entry.id}>{entry.label} · {formatDate(entry.createdAt)}</p>)}
                </details>
              ) : null}
            </div>
          </div>
        </div>

        {planningModal}
      </Shell>
    );
  }

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow">Chantiers en cours et à venir</span>
          <h1>Chantiers</h1>
        </div>
        <div className="acts">
          <Link href="/chantier/new" className="btn btn-main">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            Nouveau chantier
          </Link>
        </div>
      </div>

      <div className="tbar">
        <div className="wtabs" role="tablist" aria-label="Filtrer les chantiers">
          {ONGLETS_CHANTIERS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeChantierTab === tab.id}
              className={activeChantierTab === tab.id ? "on" : ""}
              onClick={() => setChantierTab(tab.id)}
            >
              {tab.label} <span>{chantierCounts[tab.id]}</span>
            </button>
          ))}
        </div>
        <label className="search search-wide">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4.5-4.5" /></svg>
          <input
            type="search"
            value={chantierQuery}
            onChange={(event) => setChantierQuery(event.target.value)}
            placeholder="Rechercher un chantier"
            aria-label="Rechercher un chantier"
          />
        </label>
      </div>

      {chantierRows.length === 0 ? (
        <div className="tbl">
          <div className="empty">
            {chantierQuery.trim()
              ? "Aucun chantier ne correspond à cette recherche."
              : lignesListe.length === 0
                ? "Aucun chantier pour le moment. Créez-en un avec « Nouveau chantier » ou depuis un devis."
                : "Aucun chantier dans cet onglet."}
          </div>
        </div>
      ) : (
        <>
        <div className="tbl has-cards">
          <table>
            <thead>
              <tr>
                <th>Chantier</th>
                <th>Client</th>
                <th>Lots</th>
                <th>Prochain jalon</th>
                <th className="r">Montant HT</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {chantierRows.map((ligne) => (
                <tr
                  key={ligne.id}
                  tabIndex={0}
                  onClick={() => selectProject(ligne.id)}
                  onKeyDown={(event) => { if (event.key === "Enter") selectProject(ligne.id); }}
                >
                  <td>
                    <div className="n">{ligne.titre}</div>
                    {ligne.ville ? <div className="sm">{ligne.ville}</div> : null}
                  </td>
                  <td>{ligne.client || "—"}</td>
                  <td className="lots">
                    {ligne.avancement ? (
                      <>
                        <b>{ligne.avancement.faits} / {ligne.avancement.total} {ligne.avancement.unite}</b>
                        <div className="bar"><i style={{ width: `${ligne.avancement.pourcent}%` }} /></div>
                      </>
                    ) : (
                      <span className="sm2">Pas encore de devis</span>
                    )}
                  </td>
                  <td>
                    {ligne.jalon ? <div>{ligne.jalon}</div> : <div className="sm2">Rien de prévu</div>}
                    {ligne.detail ? <div className="blk">{ligne.detail}</div> : null}
                  </td>
                  <td className="r">{ligne.montant.texte || "—"}</td>
                  <td><span className={classeEtiquette(ligne.etiquette)}>{ligne.etiquette.label}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mlist">
          {chantierRows.map((ligne) => (
            <button type="button" className="m-card" key={ligne.id} onClick={() => selectProject(ligne.id)}>
              <div className="top2">
                <div>
                  <div className="nm">{ligne.titre}</div>
                  <div className="meta">{ligne.client || ligne.ville}</div>
                </div>
                <span className={classeEtiquette(ligne.etiquette)}>{ligne.etiquette.label}</span>
              </div>
              <div className="m-f">
                <b>{ligne.avancement ? `${ligne.avancement.faits} / ${ligne.avancement.total} ${ligne.avancement.unite}` : "Pas encore de devis"}</b>
                <b>{ligne.montant.texte}</b>
              </div>
              {ligne.avancement ? <div className="bar"><i style={{ width: `${ligne.avancement.pourcent}%` }} /></div> : null}
              <div className="line">{ligne.jalon || "Rien de prévu"}</div>
              {ligne.detail ? <div className="meta">{ligne.detail}</div> : null}
            </button>
          ))}
        </div>
        </>
      )}

      <p className="foot-note">
        {chantierRows.length} chantier{chantierRows.length > 1 ? "s" : ""} affiché{chantierRows.length > 1 ? "s" : ""} sur {lignesListe.length}
      </p>
    </Shell>
  );
}
