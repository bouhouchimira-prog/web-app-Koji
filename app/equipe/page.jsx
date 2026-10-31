"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiSend, readStoredUser } from "../../lib/client-api";
import { useLocale } from "../../lib/i18n";
import { useApi } from "../../lib/use-api";
import { euro, shortDate } from "../../lib/pricing";

const professions = ["Peintre", "Carreleur", "Electricien", "Plombier", "Menuisier", "Tout corps d'etat"];

const ATTENDANCE_TYPES = ["heures", "jour", "forfait", "ouvrage", "passage", "deplacement"];
const ATTENDANCE_TYPE_ICONS = { heures: "⏱️", jour: "📅", forfait: "💰", ouvrage: "🛠️", passage: "🚪", deplacement: "🚗" };

// Client-safe duplicate of lib/worker-portal.js's isoWeekInfo (that module
// pulls in node:fs/node:path via lib/db.js, so it can't be imported here).
function isoWeekInfo(dateStr) {
  const date = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`);
  const dayIndex = (date.getDay() + 6) % 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - dayIndex);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const thursday = new Date(monday);
  thursday.setDate(monday.getDate() + 3);
  const isoYear = thursday.getFullYear();
  const firstThursday = new Date(isoYear, 0, 1);
  while (firstThursday.getDay() !== 4) firstThursday.setDate(firstThursday.getDate() + 1);
  const week = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 86400000));
  const iso = (d) => d.toISOString().slice(0, 10);
  return { key: `${isoYear}-W${String(week).padStart(2, "0")}`, start: iso(monday), end: iso(sunday) };
}

function minutesLabel(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`;
}

function CardChevron({ collapsed }) {
  return (
    <svg className="card-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

const initialWorker = {
  type: "Ouvrier",
  name: "",
  profession: "Peintre",
  phone: "",
  email: "",
  address: "",
  photoDataUrl: "",
  hourlyRate: "",
  weeklyContractHours: 35,
  notes: "",
  availability: "Disponible",
  favorite: true,
  isCompany: false,
  companyRegNumber: "",
  links: []
};

export default function TeamPage() {
  const { L } = useLocale();
  const { data: workers, setData: setWorkers } = useApi("/api/workers", "workers");
  const { data: projects } = useApi("/api/projects", "projects");
  const { data: quotes } = useApi("/api/quotes", "quotes");
  const { data: attendanceEntries, setData: setAttendanceEntries } = useApi("/api/attendance", "entries");
  const [activeTab, setActiveTab] = useState("Ouvrier");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(initialWorker);
  const [editingId, setEditingId] = useState(null);
  const [linkDraftType, setLinkDraftType] = useState("");
  const [linkDraftValue, setLinkDraftValue] = useState("");
  const [message, setMessage] = useState("");
  const [revealedPassword, setRevealedPassword] = useState("");
  const [infoOpen, setInfoOpen] = useState(true);
  const [linkCopied, setLinkCopied] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const photoInputRef = useRef(null);
  const [returnTo, setReturnTo] = useState(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [planningOpen, setPlanningOpen] = useState(false);
  const [planningWorkerId, setPlanningWorkerId] = useState("");
  const [planningWeekDate, setPlanningWeekDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [attForm, setAttForm] = useState(() => ({
    type: "heures",
    date: new Date().toISOString().slice(0, 10),
    startTime: "",
    endTime: "",
    amount: "",
    label: "",
    ouvrageValue: "",
    note: ""
  }));
  const [pdfMonth, setPdfMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const planningWorker = workers.find((worker) => worker.id === planningWorkerId) || null;
  const weekInfo = useMemo(() => isoWeekInfo(planningWeekDate), [planningWeekDate]);
  const weekEntriesForWorker = useMemo(() => {
    if (!planningWorkerId) return [];
    return attendanceEntries
      .filter((entry) => entry.workerId === planningWorkerId && isoWeekInfo(entry.date).key === weekInfo.key)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [attendanceEntries, planningWorkerId, weekInfo]);
  const weekWorkedMinutes = weekEntriesForWorker.reduce((sum, entry) => sum + Number(entry.durationMinutes || 0), 0);
  const weekContractMinutes = Math.round(Number(planningWorker?.weeklyContractHours || 35) * 60);
  const weekDiff = weekWorkedMinutes - weekContractMinutes;
  const weekAmountTotal = weekEntriesForWorker.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

  function workerWeekBadge(worker) {
    const currentWeek = isoWeekInfo(new Date().toISOString().slice(0, 10));
    const entries = attendanceEntries.filter((entry) => entry.workerId === worker.id && isoWeekInfo(entry.date).key === currentWeek.key);
    const worked = entries.reduce((sum, entry) => sum + Number(entry.durationMinutes || 0), 0);
    const contract = Math.round(Number(worker.weeklyContractHours || 35) * 60);
    return { worked, contract, diff: worked - contract };
  }

  function openPlanning() {
    setPlanningWorkerId("");
    setPlanningWeekDate(new Date().toISOString().slice(0, 10));
    setPlanningOpen(true);
  }

  function shiftWeek(days) {
    const next = new Date(`${planningWeekDate}T00:00:00`);
    next.setDate(next.getDate() + days);
    setPlanningWeekDate(next.toISOString().slice(0, 10));
  }

  async function addAttendanceEntry(event) {
    event.preventDefault();
    if (!planningWorkerId || !attForm.date) return;
    const payload = { workerId: planningWorkerId, type: attForm.type, date: attForm.date, note: attForm.note };
    if (attForm.type === "heures") {
      if (!attForm.startTime || !attForm.endTime) return;
      payload.startTime = attForm.startTime;
      payload.endTime = attForm.endTime;
    } else {
      if (Number(attForm.amount || 0) <= 0) return;
      payload.amount = attForm.amount;
      if (attForm.type === "ouvrage") {
        const option = ouvrageOptions.find((item) => item.value === attForm.ouvrageValue);
        payload.label = option?.label || attForm.label;
      } else {
        payload.label = attForm.label;
      }
    }
    const { entry } = await apiSend("/api/attendance", payload);
    setAttendanceEntries([entry, ...attendanceEntries]);
    setAttForm((current) => ({ ...current, startTime: "", endTime: "", amount: "", label: "", ouvrageValue: "", note: "" }));
  }

  async function deleteAttendanceEntry(entry) {
    await apiSend("/api/attendance", { id: entry.id, action: "delete" }, "PATCH");
    setAttendanceEntries(attendanceEntries.filter((item) => item.id !== entry.id));
  }

  function downloadWorkerHoursPdf() {
    if (!planningWorkerId) return;
    const userId = readStoredUser()?.id || "";
    window.open(`/api/attendance/pdf?workerId=${encodeURIComponent(planningWorkerId)}&month=${encodeURIComponent(pdfMonth)}&userId=${encodeURIComponent(userId)}`, "_blank");
  }

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem("koji-team-return");
      if (raw) setReturnTo(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  function goBackToChantier() {
    if (!returnTo) return;
    window.sessionStorage.removeItem("koji-team-return");
    window.location.assign(`/chantiers?project=${returnTo.projectId}&reopenLine=${encodeURIComponent(returnTo.lineKey)}`);
  }

  const filteredWorkers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return workers.filter((worker) => {
      const type = worker.type || "Ouvrier";
      if (type !== activeTab) return false;
      if (!needle) return true;
      return [worker.name, worker.profession, worker.role, worker.email, worker.phone].join(" ").toLowerCase().includes(needle);
    });
  }, [activeTab, search, workers]);

  const ouvrageOptions = useMemo(() => (quotes || []).flatMap((quote) =>
    (quote.items || []).map((item) => ({
      value: `${quote.id}::${item.id}`,
      label: `${quote.quoteNumber ? `${quote.quoteNumber} - ` : ""}${item.label || "Ouvrage"}`
    }))
  ), [quotes]);

  const subworkOptions = useMemo(() => (quotes || []).flatMap((quote) =>
    (quote.items || []).flatMap((item) => (item.subItems || []).map((subItem) => ({
      value: `${quote.id}::${item.id}::${subItem.id}`,
      label: `${quote.quoteNumber ? `${quote.quoteNumber} - ` : ""}${item.label || "Ouvrage"} > ${subItem.label || "Sous-ouvrage"}`
    })))
  ), [quotes]);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resolveLink(type, value) {
    if (!type || !value) return null;
    if (type === "chantier") {
      const project = (projects || []).find((item) => item.id === value);
      return { type, projectId: value, label: project?.title || project?.reference || "Chantier" };
    }
    if (type === "devis") {
      const quote = (quotes || []).find((item) => item.id === value);
      return { type, quoteId: value, label: quote ? `${quote.quoteNumber || "Devis"}${quote.client ? ` - ${quote.client}` : ""}` : "Devis" };
    }
    if (type === "ouvrage") {
      const [quoteId, itemId] = value.split("::");
      const option = ouvrageOptions.find((entry) => entry.value === value);
      return { type, quoteId, itemId, label: option?.label || "Ouvrage" };
    }
    if (type === "sous-ouvrage") {
      const [quoteId, itemId, subItemId] = value.split("::");
      const option = subworkOptions.find((entry) => entry.value === value);
      return { type, quoteId, itemId, subItemId, label: option?.label || "Sous-ouvrage" };
    }
    return null;
  }

  function linkKey(link) {
    return `${link.type}:${link.projectId || ""}:${link.quoteId || ""}:${link.itemId || ""}:${link.subItemId || ""}`;
  }

  function addLinkDraft() {
    const resolved = resolveLink(linkDraftType, linkDraftValue);
    if (!resolved) return;
    setForm((current) => {
      const links = current.links || [];
      if (links.some((link) => linkKey(link) === linkKey(resolved))) return current;
      return { ...current, links: [...links, resolved] };
    });
    setLinkDraftType("");
    setLinkDraftValue("");
  }

  function removeLink(index) {
    setForm((current) => ({ ...current, links: current.links.filter((_, i) => i !== index) }));
  }

  function onPhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setField("photoDataUrl", String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setLinkDraftType("");
    setLinkDraftValue("");
    setRevealedPassword("");
    setAccessOpen(false);
  }

  function openCreate(type) {
    const resolvedType = type || activeTab;
    setForm({ ...initialWorker, type: resolvedType });
    setActiveTab(resolvedType);
    setEditingId(null);
    setLinkDraftType("");
    setLinkDraftValue("");
    setRevealedPassword("");
    setInfoOpen(true);
    setAccessOpen(false);
    setFormOpen(true);
  }

  function openEdit(worker, { revealPassword } = {}) {
    const links = Array.isArray(worker.links) && worker.links.length
      ? worker.links
      : (worker.linkType ? [{
          type: worker.linkType,
          projectId: worker.linkProjectId || "",
          quoteId: worker.linkQuoteId || "",
          itemId: worker.linkItemId || "",
          subItemId: worker.linkSubItemId || "",
          label: worker.linkLabel || ""
        }] : []);

    setForm({
      ...initialWorker,
      ...worker,
      profession: worker.profession || worker.role || initialWorker.profession,
      availability: worker.availability || worker.status || initialWorker.availability,
      hourlyRate: worker.hourlyRate || "",
      isCompany: Boolean(worker.isCompany),
      companyRegNumber: worker.companyRegNumber || "",
      active: worker.active !== false,
      links
    });
    setEditingId(worker.id);
    setLinkDraftType("");
    setLinkDraftValue("");
    if (!revealPassword) setRevealedPassword("");
    setInfoOpen(!revealPassword);
    setAccessOpen(Boolean(revealPassword));
    setFormOpen(true);
  }

  async function submitWorker(event) {
    event.preventDefault();
    const isSub = activeTab === "Sous-traitant";
    const {
      id: _id, userId: _userId, loginId: _loginId, identifier: _identifier, portalRole: _portalRole,
      createdAt: _createdAt, updatedAt: _updatedAt, passwordSetupRequired: _passwordSetupRequired,
      credentialsIssuedAt: _credentialsIssuedAt, ...formFields
    } = form;
    const payload = {
      ...formFields,
      type: activeTab,
      role: form.profession,
      status: form.availability,
      isCompany: isSub ? Boolean(form.isCompany) : false,
      companyRegNumber: isSub && form.isCompany ? form.companyRegNumber : "",
      links: isSub ? (form.links || []) : []
    };

    if (editingId) {
      const { worker } = await apiSend("/api/workers", { id: editingId, ...payload }, "PATCH");
      setWorkers(workers.map((item) => (item.id === worker.id ? worker : item)));
      setMessage(`${activeTab} mis a jour: ${worker.name}`);
      closeForm();
    } else {
      const { worker, credentials } = await apiSend("/api/workers", payload);
      setWorkers([worker, ...workers]);
      setMessage(`${activeTab} ajoute: ${worker.name}`);
      if (credentials) setRevealedPassword(credentials.temporaryPassword);
      openEdit(worker, { revealPassword: Boolean(credentials) });
    }
  }

  async function regenerateCredentials() {
    if (!editingId) return;
    const { worker: updated, credentials } = await apiSend("/api/workers", { id: editingId, action: "resetCredentials" }, "PATCH");
    setWorkers(workers.map((item) => (item.id === updated.id ? updated : item)));
    if (credentials) setRevealedPassword(credentials.temporaryPassword);
    setForm((current) => ({ ...current, loginId: updated.loginId }));
    setAccessOpen(true);
  }

  // Bouton rapide en haut de liste (12 oct, demande d'Amira) — meme lien que
  // dans la fiche d'un ouvrier (L.equipe.credentialsLoginUrl), mais
  // accessible sans ouvrir un profil precis, pour l'envoyer rapidement.
  async function copyLoginLink() {
    const loginUrl = `${window.location.origin}/login?type=ouvrier`;
    try {
      await navigator.clipboard.writeText(loginUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      setMessage("Impossible de copier le lien — copiez-le manuellement : " + loginUrl);
    }
  }

  async function setWorkerActive(active) {
    if (!editingId) return;
    const { worker: updated } = await apiSend("/api/workers", { id: editingId, active }, "PATCH");
    setWorkers(workers.map((item) => (item.id === updated.id ? updated : item)));
    setForm((current) => ({ ...current, active: updated.active !== false }));
  }

  async function updateWorker(worker, patch) {
    const { worker: updated } = await apiSend("/api/workers", { id: worker.id, ...patch }, "PATCH");
    setWorkers(workers.map((item) => (item.id === updated.id ? updated : item)));
  }

  async function deleteWorker(worker) {
    const { worker: deleted } = await apiSend("/api/workers", { id: worker.id, action: "delete" }, "PATCH");
    if (deleted?.deleted) setWorkers(workers.filter((item) => item.id !== worker.id));
  }

  if (planningOpen) {
    const selectedWorkerName = planningWorker ? planningWorker.name : "";
    return (
      <Shell variant="pro">
        <div className="head">
          <div className="stack">
            <button type="button" className="link" onClick={() => (planningWorker ? setPlanningWorkerId("") : setPlanningOpen(false))}>← Retour</button>
            <span className="eyebrow">{planningWorker ? (planningWorker.profession || planningWorker.role || "Équipe") : L.equipe.planningIntro}</span>
            <h1>{planningWorker ? selectedWorkerName : L.equipe.planningTitle}</h1>
          </div>
          {planningWorker ? (
            <div className="hact">
              <button type="button" className="btn btn-sec" onClick={() => shiftWeek(-7)}>‹ Semaine précédente</button>
              <button type="button" className="btn btn-sec" onClick={() => shiftWeek(7)}>Semaine suivante ›</button>
            </div>
          ) : null}
        </div>

        {!planningWorker ? (
          <>
            <div className="tbar">
              <label className="search search-wide">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4.5-4.5" /></svg>
                <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={L.equipe.search} />
              </label>
            </div>
            <div className="tbl has-cards">
              <table>
                <thead><tr><th>Nom</th><th>Métier</th><th>Semaine</th></tr></thead>
                <tbody>
                  {workers
                    .filter((worker) => !search.trim() || (worker.name || "").toLowerCase().includes(search.trim().toLowerCase()))
                    .map((worker) => {
                      const badge = workerWeekBadge(worker);
                      const status = Math.abs(badge.diff) < 15 ? "ok" : badge.diff > 0 ? "over" : "under";
                      return (
                        <tr key={worker.id} className="clickable" onClick={() => setPlanningWorkerId(worker.id)}>
                          <td><strong>{worker.name}</strong></td>
                          <td>{worker.profession || worker.role || "—"}</td>
                          <td><span className={`tag ${status === "ok" ? "tag-b" : status === "over" ? "tag-o" : "dim"}`}>{minutesLabel(badge.worked)} / {minutesLabel(badge.contract)}</span></td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            {!workers.length ? <p className="empty">{L.equipe.noWorkers}</p> : null}
          </>
        ) : (
          <>
            <div className="kpis">
              <div><div className="l">{L.equipe.workedLabel}</div><div className="v">{minutesLabel(weekWorkedMinutes)}</div></div>
              <div><div className="l">{L.equipe.contractLabel}</div><div className="v">{minutesLabel(weekContractMinutes)}</div></div>
              <div>
                <div className="l">{L.equipe.diffLabel}</div>
                <div className="v">{weekDiff > 0 ? "+" : weekDiff < 0 ? "-" : ""}{minutesLabel(Math.abs(weekDiff))}</div>
              </div>
              <div><div className="l">{L.equipe.amountTotalLabel}</div><div className="v">{euro(weekAmountTotal)}</div></div>
            </div>

            <section className="card">
              <div className="card-h"><h2>{L.equipe.weekOf(shortDate(weekInfo.start), shortDate(weekInfo.end))}</h2></div>
              {weekEntriesForWorker.length ? (
                <div className="tbl has-cards">
                  <table>
                    <thead><tr><th>Date</th><th>Type</th><th>Détail</th><th>Montant</th><th /></tr></thead>
                    <tbody>
                      {weekEntriesForWorker.map((entry) => {
                        const entryType = entry.type || "heures";
                        return (
                          <tr key={entry.id}>
                            <td>{shortDate(entry.date)}</td>
                            <td><span title={entry.source === "worker" ? L.equipe.sourceWorker : L.equipe.sourceCompany}>{ATTENDANCE_TYPE_ICONS[entryType]} {L.equipe.attendanceTypes[entryType]}</span></td>
                            <td>{entryType === "heures" ? `${entry.startTime} → ${entry.endTime || "…"}` : (entry.label || L.equipe.attendanceTypes[entryType])}</td>
                            <td>{entryType === "heures" ? minutesLabel(entry.durationMinutes) : euro(entry.amount)}</td>
                            <td><button type="button" className="link" onClick={() => deleteAttendanceEntry(entry)}>{L.common.remove}</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : <p className="muted">{L.equipe.noAttendanceWeek}</p>}
            </section>

            <section className="card">
              <div className="card-h"><h2>{L.equipe.addAttendance}</h2></div>
              <div className="kp-seg" role="group" aria-label={L.equipe.addAttendance}>
                {ATTENDANCE_TYPES.map((type) => (
                  <button
                    type="button"
                    key={type}
                    className={attForm.type === type ? "on" : ""}
                    aria-pressed={attForm.type === type}
                    onClick={() => setAttForm((current) => ({ ...current, type }))}
                  >
                    {ATTENDANCE_TYPE_ICONS[type]} {L.equipe.attendanceTypes[type]}
                  </button>
                ))}
              </div>
              <form className="fgrid" style={{ marginTop: 16 }} onSubmit={addAttendanceEntry}>
                <label>
                  Date
                  <input type="date" value={attForm.date} onChange={(event) => setAttForm((current) => ({ ...current, date: event.target.value }))} />
                </label>
                {attForm.type === "heures" ? (
                  <div className="pair">
                    <label>Début<input type="time" value={attForm.startTime} onChange={(event) => setAttForm((current) => ({ ...current, startTime: event.target.value }))} /></label>
                    <label>Fin<input type="time" value={attForm.endTime} onChange={(event) => setAttForm((current) => ({ ...current, endTime: event.target.value }))} /></label>
                  </div>
                ) : (
                  <label>
                    Montant
                    <input type="number" step="0.01" min="0.01" value={attForm.amount} onChange={(event) => setAttForm((current) => ({ ...current, amount: event.target.value }))} placeholder={L.equipe.amountPlaceholder} />
                  </label>
                )}
                {attForm.type === "ouvrage" ? (
                  <label>
                    {L.equipe.linkedToItem}
                    <select value={attForm.ouvrageValue} onChange={(event) => setAttForm((current) => ({ ...current, ouvrageValue: event.target.value }))}>
                      <option value="">{L.equipe.linkedToItemPh}</option>
                      {ouvrageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                ) : null}
                {attForm.type !== "heures" && attForm.type !== "ouvrage" ? (
                  <label>
                    Libellé
                    <input value={attForm.label} onChange={(event) => setAttForm((current) => ({ ...current, label: event.target.value }))} placeholder={L.equipe.labelPlaceholder} />
                  </label>
                ) : null}
                <label className="full">
                  {L.facturation.note}
                  <input value={attForm.note} onChange={(event) => setAttForm((current) => ({ ...current, note: event.target.value }))} />
                </label>
                <div className="ed-act full">
                  <button type="submit" className="btn btn-main">{L.equipe.addAttendance}</button>
                </div>
              </form>
            </section>

            <section className="card">
              <div className="card-h"><h2>{L.equipe.downloadPdf}</h2></div>
              <div className="fgrid">
                <label>
                  Mois
                  <input type="month" value={pdfMonth} onChange={(event) => setPdfMonth(event.target.value)} />
                </label>
              </div>
              <div className="ed-act" style={{ marginTop: 12 }}>
                <button type="button" className="btn btn-sec" onClick={downloadWorkerHoursPdf}>{L.equipe.downloadPdf}</button>
              </div>
            </section>
          </>
        )}
      </Shell>
    );
  }

  if (formOpen) {
    const isEditing = Boolean(editingId);
    return (
      <Shell variant="pro">
        <div className="head">
          <div className="stack">
            <button type="button" className="link" onClick={closeForm}>← Retour</button>
            <span className="eyebrow">{activeTab === "Ouvrier" ? "Compagnon" : "Sous-traitant"}</span>
            <h1>{isEditing ? L.equipe.editWorker : (activeTab === "Ouvrier" ? L.equipe.addWorker : L.equipe.addSub)}</h1>
          </div>
          <div className="hact">
            <button type="submit" form="equipe-form" className="btn btn-main">{L.equipe.save}</button>
          </div>
        </div>

        {returnTo ? (
          <div className="notice" role="status">
            <button type="button" className="link" onClick={goBackToChantier}>{L.equipe.returnToSite}</button>
          </div>
        ) : null}

        <form id="equipe-form" className="pf-g2" onSubmit={submitWorker}>
          <div className="kj-col">
            <section className="card">
              <div className="card-h"><h2>{L.equipe.informationsCard}</h2></div>
              <div className="kj-phi" style={{ marginBottom: 16, position: "relative" }}>
                {form.photoDataUrl ? <img src={form.photoDataUrl} alt="Photo" /> : null}
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  aria-label="Ajouter une photo"
                  style={{ position: "absolute", inset: 0, background: "transparent", border: 0, cursor: "pointer" }}
                />
                <input ref={photoInputRef} type="file" accept="image/*" onChange={onPhotoChange} style={{ display: "none" }} />
              </div>
              <div className="fgrid">
                <label className="full">{L.equipe.name}<input value={form.name} onChange={(event) => setField("name", event.target.value)} required /></label>
                <label>{L.equipe.phone}<input value={form.phone} onChange={(event) => setField("phone", event.target.value)} placeholder="06 12 34 56 78" /></label>
                <label>{L.equipe.email}<input type="email" value={form.email} onChange={(event) => setField("email", event.target.value)} /></label>
                <label className="full">{L.equipe.address}<input value={form.address} onChange={(event) => setField("address", event.target.value)} /></label>
                <label>
                  {L.equipe.profession}
                  <select value={form.profession} onChange={(event) => setField("profession", event.target.value)}>
                    {professions.map((profession) => <option key={profession}>{profession}</option>)}
                  </select>
                </label>
                <label>
                  {L.equipe.availability}
                  <select value={form.availability} onChange={(event) => setField("availability", event.target.value)}>
                    <option value="Disponible">{L.equipe.available}</option>
                    <option value="Occupe">{L.equipe.unavailable}</option>
                    <option value="Absent">{L.equipe.onLeave}</option>
                  </select>
                </label>
                <label>{L.equipe.hourlyRate}<input type="number" step="0.01" value={form.hourlyRate} onChange={(event) => setField("hourlyRate", event.target.value)} placeholder="0.00" /></label>
                <label>{L.equipe.weeklyContractHours}<input type="number" step="0.5" min="0" value={form.weeklyContractHours} onChange={(event) => setField("weeklyContractHours", event.target.value)} placeholder="35" /></label>
                <label className="full">{L.equipe.notes}<input value={form.notes} onChange={(event) => setField("notes", event.target.value)} /></label>
              </div>
            </section>

            {activeTab === "Sous-traitant" ? (
              <section className="card">
                <div className="card-h"><h2>{L.equipe.linkedTo}</h2></div>
                <label className="st-row" style={{ display: "flex", gap: 10, alignItems: "center", padding: "12px 0" }}>
                  <input type="checkbox" checked={Boolean(form.isCompany)} onChange={(event) => setField("isCompany", event.target.checked)} />
                  <span>{L.equipe.isCompany}</span>
                </label>
                {form.isCompany ? (
                  <div className="fgrid" style={{ marginTop: 8 }}>
                    <label className="full">{L.equipe.companyRegNumber}<input value={form.companyRegNumber} onChange={(event) => setField("companyRegNumber", event.target.value)} placeholder="123 456 789 00012" /></label>
                  </div>
                ) : null}
                <div className="fgrid" style={{ marginTop: 8 }}>
                  <label>
                    {L.equipe.linkedTo}
                    <select value={linkDraftType} onChange={(event) => { setLinkDraftType(event.target.value); setLinkDraftValue(""); }}>
                      <option value="">{L.equipe.linkedToNone}</option>
                      <option value="chantier">{L.equipe.linkedToChantier}</option>
                      <option value="devis">{L.equipe.linkedToDevis}</option>
                      <option value="ouvrage">{L.equipe.linkedToOuvrage}</option>
                      <option value="sous-ouvrage">{L.equipe.linkedToSubwork}</option>
                    </select>
                  </label>
                  {linkDraftType ? (
                    <label>
                      {L.equipe.linkedToItem}
                      <div className="pair">
                        <select value={linkDraftValue} onChange={(event) => setLinkDraftValue(event.target.value)}>
                          <option value="">{L.equipe.linkedToItemPh}</option>
                          {linkDraftType === "chantier" ? (projects || []).map((project) => (
                            <option key={project.id} value={project.id}>{project.title || project.reference || "Chantier"}</option>
                          )) : null}
                          {linkDraftType === "devis" ? (quotes || []).map((quote) => (
                            <option key={quote.id} value={quote.id}>{quote.quoteNumber ? `${quote.quoteNumber} - ${quote.client || ""}` : (quote.client || "Devis")}</option>
                          )) : null}
                          {linkDraftType === "ouvrage" ? ouvrageOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          )) : null}
                          {linkDraftType === "sous-ouvrage" ? subworkOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          )) : null}
                        </select>
                        <button type="button" className="btn btn-sec" onClick={addLinkDraft} disabled={!linkDraftValue}>{L.common.add}</button>
                      </div>
                    </label>
                  ) : null}
                </div>
                {(form.links || []).length ? (
                  <div className="kj-chips" style={{ marginTop: 12 }}>
                    {form.links.map((link, index) => (
                      <span className="kj-chip" key={linkKey(link) + index}>
                        {link.label}
                        <button type="button" onClick={() => removeLink(index)} aria-label={L.common.remove}>×</button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>

          <div className="kj-col">
            {isEditing ? (
              <section className="card">
                <div className="card-h"><h2>{L.equipe.accessCard}</h2></div>
                <div className="fgrid">
                  <label className="full">{L.equipe.loginId}<input value={form.loginId || ""} readOnly onFocus={(event) => event.target.select()} /></label>
                  {revealedPassword ? (
                    <label className="full">{L.equipe.loginPassword}<input value={revealedPassword} readOnly onFocus={(event) => event.target.select()} /></label>
                  ) : (
                    <p className="muted full">{L.equipe.accessPasswordHidden}</p>
                  )}
                  <label className="full">
                    {L.equipe.credentialsLoginUrl}
                    <input value={typeof window !== "undefined" ? `${window.location.origin}/login?type=ouvrier` : "/login?type=ouvrier"} readOnly onFocus={(event) => event.target.select()} />
                  </label>
                </div>
                <div className="ed-act" style={{ marginTop: 12 }}>
                  <button type="button" className="btn btn-sec" onClick={regenerateCredentials}>{L.equipe.regenerateCredentials}</button>
                </div>
                <div style={{ marginTop: 16 }}>
                  <span className="flab">{L.equipe.accessStatus}</span>
                  <div className="kp-seg" role="group" aria-label={L.equipe.accessStatus} style={{ marginTop: 8 }}>
                    <button type="button" className={form.active !== false ? "on" : ""} aria-pressed={form.active !== false} onClick={() => setWorkerActive(true)}>{L.equipe.accessActive}</button>
                    <button type="button" className={form.active === false ? "on" : ""} aria-pressed={form.active === false} onClick={() => setWorkerActive(false)}>{L.equipe.accessInactive}</button>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        </form>
      </Shell>
    );
  }

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow">{workers.length} {workers.length > 1 ? "personnes" : "personne"}</span>
          <h1>{L.equipe.title}</h1>
        </div>
        <div className="hact">
          <button type="button" className="btn btn-sec" onClick={copyLoginLink}>{linkCopied ? "Lien copié !" : "Copier le lien de connexion équipe"}</button>
          <button type="button" className="btn btn-main" onClick={() => setQuickAddOpen(true)}>{L.equipe.addPersonnel}</button>
        </div>
      </div>

      {returnTo ? (
        <div className="notice" role="status">
          <button type="button" className="link" onClick={goBackToChantier}>{L.equipe.returnToSite}</button>
        </div>
      ) : null}

      <div className="tbar">
        <div className="wtabs" role="tablist" aria-label={L.equipe.title}>
          <button type="button" role="tab" aria-selected={activeTab === "Ouvrier"} className={activeTab === "Ouvrier" ? "on" : ""} onClick={() => setActiveTab("Ouvrier")}>
            {L.equipe.workers} <span>{workers.filter((w) => (w.type || "Ouvrier") === "Ouvrier").length}</span>
          </button>
          <button type="button" role="tab" aria-selected={activeTab === "Sous-traitant"} className={activeTab === "Sous-traitant" ? "on" : ""} onClick={() => setActiveTab("Sous-traitant")}>
            {L.equipe.subcontractors}
          </button>
        </div>
        <label className="search search-wide">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4.5-4.5" /></svg>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={L.equipe.search} />
        </label>
      </div>

      {message ? <p className="notice" role="status">{message}</p> : null}

      {filteredWorkers.length === 0 ? (
        <div className="tbl"><p className="empty">{activeTab === "Ouvrier" ? L.equipe.noWorkers : L.equipe.noSubs}</p></div>
      ) : (
        <>
          <div className="tbl fit has-cards">
            <table>
              <thead>
                <tr><th>Nom</th><th>Métier</th><th>Disponibilité</th><th>Contact</th><th>Lié à</th><th /></tr>
              </thead>
              <tbody>
                {filteredWorkers.map((worker) => (
                  <tr key={worker.id} className="clickable" onClick={() => openEdit(worker)}>
                    <td>
                      <strong>{worker.name}{worker.isCompany ? ` (${worker.companyRegNumber || L.equipe.isCompany})` : ""}</strong>
                    </td>
                    <td>{worker.profession || worker.role || "—"}</td>
                    <td><span className={`tag ${worker.availability === "Disponible" || !worker.availability ? "tag-b" : "dim"}`}>{worker.availability || "Disponible"}</span></td>
                    <td>{[worker.phone, worker.email].filter(Boolean).join(" · ") || "—"}</td>
                    <td>{(worker.links || []).length ? worker.links.map((link) => link.label).filter(Boolean).join(", ") : (worker.linkLabel || "—")}</td>
                    <td>
                      <div className="ed-act">
                        <button type="button" className="dx" aria-label={worker.favorite ? "Retirer des favoris" : "Mettre en favori"} onClick={(event) => { event.stopPropagation(); updateWorker(worker, { favorite: !worker.favorite }); }}>{worker.favorite ? "★" : "☆"}</button>
                        <button type="button" className="link" onClick={(event) => { event.stopPropagation(); deleteWorker(worker); }}>{L.equipe.delete}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mlist">
            {filteredWorkers.map((worker) => (
              <div className="m-card" key={worker.id} role="button" tabIndex={0} onClick={() => openEdit(worker)}>
                <div className="top2">
                  <div>
                    <div className="nm">{worker.name}</div>
                    <div className="meta">{worker.profession || worker.role || "—"}</div>
                  </div>
                  <span className={`tag ${worker.availability === "Disponible" || !worker.availability ? "tag-b" : "dim"}`}>{worker.availability || "Disponible"}</span>
                </div>
                {worker.phone || worker.email ? <div className="line">{[worker.phone, worker.email].filter(Boolean).join(" · ")}</div> : null}
              </div>
            ))}
          </div>
        </>
      )}

      {quickAddOpen ? (
        <div className="pmodal-bg" onClick={() => setQuickAddOpen(false)}>
          <div className="pmodal" role="dialog" aria-modal="true" aria-label={L.equipe.quickAddTitle} onClick={(event) => event.stopPropagation()}>
            <div className="card-h">
              <h2>{L.equipe.quickAddTitle}</h2>
              <button type="button" className="link" onClick={() => setQuickAddOpen(false)}>Fermer</button>
            </div>
            <button type="button" className="row pf-go st-row" onClick={() => { setQuickAddOpen(false); openCreate("Ouvrier"); }}>
              <div className="t"><strong>{L.equipe.addWorker}</strong><small>{L.equipe.quickAddWorkerHint}</small></div>
              <span aria-hidden="true">›</span>
            </button>
            <button type="button" className="row pf-go st-row" onClick={() => { setQuickAddOpen(false); openCreate("Sous-traitant"); }}>
              <div className="t"><strong>{L.equipe.addSub}</strong><small>{L.equipe.quickAddSubHint}</small></div>
              <span aria-hidden="true">›</span>
            </button>
            <button type="button" className="row pf-go st-row" onClick={() => { setQuickAddOpen(false); openPlanning(); }}>
              <div className="t"><strong>{L.equipe.planningTitle}</strong><small>{L.equipe.quickAddPlanningHint}</small></div>
              <span aria-hidden="true">›</span>
            </button>
          </div>
        </div>
      ) : null}
    </Shell>
  );
}
