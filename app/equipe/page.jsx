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
    return (
      <Shell>
        <section className="mobile-tool">
          <header className="tool-topline compact">
            <button type="button" className="plain-back" onClick={() => (planningWorker ? setPlanningWorkerId("") : setPlanningOpen(false))}>{"<"}</button>
            <div className="follow-title">
              <h1>{planningWorker ? planningWorker.name : L.equipe.planningTitle}</h1>
              <p>{planningWorker ? (planningWorker.profession || planningWorker.role) : L.equipe.planningIntro}</p>
            </div>
            <span />
          </header>

          {!planningWorker ? (
            <>
              <div className="search-pill">
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={L.equipe.search} />
              </div>
              <div className="people-list">
                {workers
                  .filter((worker) => !search.trim() || (worker.name || "").toLowerCase().includes(search.trim().toLowerCase()))
                  .map((worker) => {
                    const badge = workerWeekBadge(worker);
                    const status = Math.abs(badge.diff) < 15 ? "ok" : badge.diff > 0 ? "over" : "under";
                    return (
                      <article
                        className="person-row clickable"
                        key={worker.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setPlanningWorkerId(worker.id)}
                        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setPlanningWorkerId(worker.id); } }}
                      >
                        <div className="avatar">
                          {worker.photoDataUrl ? <img src={worker.photoDataUrl} alt={worker.name} /> : (worker.name || "AB").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <strong>{worker.name}</strong>
                          <small>{worker.profession || worker.role}</small>
                        </div>
                        <span className={`planning-week-badge planning-badge-${status}`}>
                          {minutesLabel(badge.worked)} / {minutesLabel(badge.contract)}
                        </span>
                      </article>
                    );
                  })}
                {!workers.length ? <div className="tool-empty">{L.equipe.noWorkers}</div> : null}
              </div>
            </>
          ) : (
            <>
              <div className="planning-week-nav">
                <button type="button" className="mini-outline" onClick={() => shiftWeek(-7)}>‹</button>
                <strong>{L.equipe.weekOf(shortDate(weekInfo.start), shortDate(weekInfo.end))}</strong>
                <button type="button" className="mini-outline" onClick={() => shiftWeek(7)}>›</button>
              </div>

              <div className="ouvrage-finance-card">
                <div><span>{L.equipe.workedLabel}</span><strong>{minutesLabel(weekWorkedMinutes)}</strong></div>
                <div><span>{L.equipe.contractLabel}</span><strong>{minutesLabel(weekContractMinutes)}</strong></div>
                <div>
                  <span>{L.equipe.diffLabel}</span>
                  <strong className={Math.abs(weekDiff) < 15 ? "" : weekDiff > 0 ? "positive" : "negative"}>
                    {weekDiff > 0 ? "+" : weekDiff < 0 ? "-" : ""}{minutesLabel(Math.abs(weekDiff))}
                  </strong>
                </div>
                <div><span>{L.equipe.amountTotalLabel}</span><strong>{euro(weekAmountTotal)}</strong></div>
              </div>

              {weekEntriesForWorker.length ? (
                <div className="planning-entry-list">
                  {weekEntriesForWorker.map((entry) => {
                    const entryType = entry.type || "heures";
                    return (
                      <div className="planning-entry-row" key={entry.id}>
                        <span className="planning-entry-source" title={entry.source === "worker" ? L.equipe.sourceWorker : L.equipe.sourceCompany}>
                          {entry.source === "worker" ? "👤" : "🏢"}
                        </span>
                        <span className="planning-entry-type" title={L.equipe.attendanceTypes[entryType]}>{ATTENDANCE_TYPE_ICONS[entryType]}</span>
                        <strong>{shortDate(entry.date)}</strong>
                        {entryType === "heures" ? (
                          <>
                            <span>{entry.startTime} → {entry.endTime || "…"}</span>
                            <small>{minutesLabel(entry.durationMinutes)}</small>
                          </>
                        ) : (
                          <>
                            <span>{entry.label || L.equipe.attendanceTypes[entryType]}</span>
                            <small>{euro(entry.amount)}</small>
                          </>
                        )}
                        <button type="button" className="mini-danger" onClick={() => deleteAttendanceEntry(entry)}>{L.common.remove}</button>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="tool-muted">{L.equipe.noAttendanceWeek}</p>}

              <div className="planning-type-chips">
                {ATTENDANCE_TYPES.map((type) => (
                  <button
                    type="button"
                    key={type}
                    className={`planning-type-chip${attForm.type === type ? " active" : ""}`}
                    onClick={() => setAttForm((current) => ({ ...current, type }))}
                  >
                    <span>{ATTENDANCE_TYPE_ICONS[type]}</span>
                    <span>{L.equipe.attendanceTypes[type]}</span>
                  </button>
                ))}
              </div>

              <form className="project-mini-form" onSubmit={addAttendanceEntry}>
                <input type="date" value={attForm.date} onChange={(event) => setAttForm((current) => ({ ...current, date: event.target.value }))} />
                {attForm.type === "heures" ? (
                  <>
                    <input type="time" value={attForm.startTime} onChange={(event) => setAttForm((current) => ({ ...current, startTime: event.target.value }))} />
                    <input type="time" value={attForm.endTime} onChange={(event) => setAttForm((current) => ({ ...current, endTime: event.target.value }))} />
                  </>
                ) : (
                  <input type="number" step="0.01" min="0.01" value={attForm.amount} onChange={(event) => setAttForm((current) => ({ ...current, amount: event.target.value }))} placeholder={L.equipe.amountPlaceholder} />
                )}
                {attForm.type === "ouvrage" ? (
                  <select value={attForm.ouvrageValue} onChange={(event) => setAttForm((current) => ({ ...current, ouvrageValue: event.target.value }))}>
                    <option value="">{L.equipe.linkedToItemPh}</option>
                    {ouvrageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                ) : null}
                {attForm.type !== "heures" && attForm.type !== "ouvrage" ? (
                  <input value={attForm.label} onChange={(event) => setAttForm((current) => ({ ...current, label: event.target.value }))} placeholder={L.equipe.labelPlaceholder} />
                ) : null}
                <input value={attForm.note} onChange={(event) => setAttForm((current) => ({ ...current, note: event.target.value }))} placeholder={L.facturation.note} />
                <button type="submit">{L.equipe.addAttendance}</button>
              </form>

              <div className="planning-pdf-row">
                <input type="month" value={pdfMonth} onChange={(event) => setPdfMonth(event.target.value)} />
                <button type="button" className="mini-outline" onClick={downloadWorkerHoursPdf}>{L.equipe.downloadPdf}</button>
              </div>
            </>
          )}
        </section>
      </Shell>
    );
  }

  if (formOpen) {
    return (
      <Shell>
        <section className="mobile-tool tool-form-view">
          <header className="tool-topline">
            <button type="button" className="plain-back" onClick={closeForm}>{"<"}</button>
            <h1>{editingId ? L.equipe.editWorker : (activeTab === "Ouvrier" ? L.equipe.addWorker : L.equipe.addSub)}</h1>
            <span />
          </header>

          {returnTo ? (
            <button type="button" className="return-to-site-banner" onClick={goBackToChantier}>
              {L.equipe.returnToSite}
            </button>
          ) : null}

          <form className="mobile-form" onSubmit={submitWorker}>
            <section className="follow-section">
              <button type="button" className="follow-section-head follow-section-head-toggle" onClick={() => setInfoOpen((current) => !current)}>
                <h2>{L.equipe.informationsCard}</h2>
                <CardChevron collapsed={!infoOpen} />
              </button>
              {infoOpen ? (
                <div className="mobile-form">
                  <div className="worker-photo-box">
                    <div className="worker-photo-frame">
                      {form.photoDataUrl ? <img src={form.photoDataUrl} alt="Photo" /> : null}
                      <button type="button" className="worker-photo-upload" onClick={() => photoInputRef.current?.click()} aria-label="Ajouter une photo">+</button>
                    </div>
                    <small>Photo</small>
                    <input ref={photoInputRef} type="file" accept="image/*" onChange={onPhotoChange} style={{ display: "none" }} />
                  </div>
                  <label className="mobile-input full">
                    <span>{L.equipe.name}</span>
                    <input value={form.name} onChange={(event) => setField("name", event.target.value)} required />
                  </label>
                  <label className="mobile-input full">
                    <span>{L.equipe.phone}</span>
                    <input value={form.phone} onChange={(event) => setField("phone", event.target.value)} placeholder="06 12 34 56 78" />
                  </label>
                  <label className="mobile-input full">
                    <span>{L.equipe.email}</span>
                    <input type="email" value={form.email} onChange={(event) => setField("email", event.target.value)} />
                  </label>
                  <label className="mobile-input full">
                    <span>{L.equipe.address}</span>
                    <input value={form.address} onChange={(event) => setField("address", event.target.value)} />
                  </label>
                  <label className="mobile-input full">
                    <span>{L.equipe.profession}</span>
                    <select value={form.profession} onChange={(event) => setField("profession", event.target.value)}>
                      {professions.map((profession) => <option key={profession}>{profession}</option>)}
                    </select>
                  </label>
                  <label className="mobile-input full">
                    <span>{L.equipe.availability}</span>
                    <select value={form.availability} onChange={(event) => setField("availability", event.target.value)}>
                      <option value="Disponible">{L.equipe.available}</option>
                      <option value="Occupe">{L.equipe.unavailable}</option>
                      <option value="Absent">{L.equipe.onLeave}</option>
                    </select>
                  </label>
                  <label className="mobile-input full">
                    <span>{L.equipe.hourlyRate}</span>
                    <input type="number" step="0.01" value={form.hourlyRate} onChange={(event) => setField("hourlyRate", event.target.value)} placeholder="0.00" />
                  </label>
                  <label className="mobile-input full">
                    <span>{L.equipe.weeklyContractHours}</span>
                    <input type="number" step="0.5" min="0" value={form.weeklyContractHours} onChange={(event) => setField("weeklyContractHours", event.target.value)} placeholder="35" />
                  </label>
                  <label className="mobile-input full">
                    <span>{L.equipe.notes}</span>
                    <input value={form.notes} onChange={(event) => setField("notes", event.target.value)} />
                  </label>

                  {activeTab === "Sous-traitant" ? (
                    <>
                      <label className="mobile-checkbox full">
                        <input type="checkbox" checked={Boolean(form.isCompany)} onChange={(event) => setField("isCompany", event.target.checked)} />
                        <span>{L.equipe.isCompany}</span>
                      </label>
                      {form.isCompany ? (
                        <label className="mobile-input full">
                          <span>{L.equipe.companyRegNumber}</span>
                          <input value={form.companyRegNumber} onChange={(event) => setField("companyRegNumber", event.target.value)} placeholder="123 456 789 00012" />
                        </label>
                      ) : null}
                      <label className="mobile-input full">
                        <span>{L.equipe.linkedTo}</span>
                        <select value={linkDraftType} onChange={(event) => { setLinkDraftType(event.target.value); setLinkDraftValue(""); }}>
                          <option value="">{L.equipe.linkedToNone}</option>
                          <option value="chantier">{L.equipe.linkedToChantier}</option>
                          <option value="devis">{L.equipe.linkedToDevis}</option>
                          <option value="ouvrage">{L.equipe.linkedToOuvrage}</option>
                          <option value="sous-ouvrage">{L.equipe.linkedToSubwork}</option>
                        </select>
                      </label>
                      {linkDraftType ? (
                        <label className="mobile-input full">
                          <span>{L.equipe.linkedToItem}</span>
                          <div className="url-fetch-row">
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
                            <button type="button" className="mini-button" onClick={addLinkDraft} disabled={!linkDraftValue}>{L.common.add}</button>
                          </div>
                        </label>
                      ) : null}
                      {(form.links || []).length ? (
                        <div className="mobile-input full">
                          <span>{L.equipe.linkedItemsList}</span>
                          <div className="link-chip-list">
                            {form.links.map((link, index) => (
                              <span className="link-chip" key={linkKey(link) + index}>
                                {link.label}
                                <button type="button" onClick={() => removeLink(index)} aria-label={L.common.remove}>×</button>
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : null}
            </section>

            {editingId ? (
              <section className="follow-section">
                <button type="button" className="follow-section-head follow-section-head-toggle" onClick={() => setAccessOpen((current) => !current)}>
                  <h2>{L.equipe.accessCard}</h2>
                  <CardChevron collapsed={!accessOpen} />
                </button>
                {accessOpen ? (
                  <div className="mobile-form">
                    <label className="mobile-input full">
                      <span>{L.equipe.loginId}</span>
                      <input value={form.loginId || ""} readOnly onFocus={(event) => event.target.select()} />
                    </label>
                    {revealedPassword ? (
                      <label className="mobile-input full">
                        <span>{L.equipe.loginPassword}</span>
                        <input value={revealedPassword} readOnly onFocus={(event) => event.target.select()} />
                      </label>
                    ) : (
                      <p className="tool-muted">{L.equipe.accessPasswordHidden}</p>
                    )}
                    <label className="mobile-input full">
                      <span>{L.equipe.credentialsLoginUrl}</span>
                      <input value={typeof window !== "undefined" ? `${window.location.origin}/login?type=ouvrier` : "/login?type=ouvrier"} readOnly onFocus={(event) => event.target.select()} />
                    </label>
                    <button type="button" className="mini-button" onClick={regenerateCredentials}>{L.equipe.regenerateCredentials}</button>

                    <label className="mobile-input full">
                      <span>{L.equipe.accessStatus}</span>
                      <div className="segmented large">
                        <button type="button" className={form.active !== false ? "active" : ""} onClick={() => setWorkerActive(true)}>{L.equipe.accessActive}</button>
                        <button type="button" className={form.active === false ? "active" : ""} onClick={() => setWorkerActive(false)}>{L.equipe.accessInactive}</button>
                      </div>
                    </label>
                  </div>
                ) : null}
              </section>
            ) : null}

            <button className="mobile-primary">{L.equipe.save}</button>
          </form>
        </section>
      </Shell>
    );
  }

  return (
    <Shell>
      <section className="mobile-tool">
        <header className="tool-topline">
          <button type="button" className="plain-back" onClick={() => (window.history.length > 1 ? window.history.back() : window.location.assign("/"))}>{"<"}</button>
          <h1>{L.equipe.title}</h1>
          <span />
        </header>

        {returnTo ? (
          <button type="button" className="return-to-site-banner" onClick={goBackToChantier}>
            {L.equipe.returnToSite}
          </button>
        ) : null}

        <div className="search-pill">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={L.equipe.search} />
        </div>

        <div className="segmented large segmented-beige">
          <button type="button" className={activeTab === "Ouvrier" ? "active" : ""} onClick={() => setActiveTab("Ouvrier")}>{L.equipe.workers}</button>
          <button type="button" className={activeTab === "Sous-traitant" ? "active" : ""} onClick={() => setActiveTab("Sous-traitant")}>{L.equipe.subcontractors}</button>
        </div>

        {message ? <p className="tool-message">{message}</p> : null}

        <div className="people-list">
          {filteredWorkers.length === 0 ? <div className="tool-empty">{activeTab === "Ouvrier" ? L.equipe.noWorkers : L.equipe.noSubs}</div> : null}
          {filteredWorkers.map((worker) => (
            <article
              className="person-row clickable"
              key={worker.id}
              role="button"
              tabIndex={0}
              onClick={() => openEdit(worker)}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openEdit(worker); } }}
            >
              <div className="avatar">
                {worker.photoDataUrl ? (
                  <img src={worker.photoDataUrl} alt={worker.name} />
                ) : (
                  (worker.name || "AB").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()
                )}
                <i className={worker.availability === "Disponible" ? "online" : ""} />
              </div>
              <div>
                <strong>{worker.name}{worker.isCompany ? ` (${worker.companyRegNumber || L.equipe.isCompany})` : ""}</strong>
                <small>{worker.profession || worker.role} - {worker.availability || "Disponible"}{worker.hourlyRate ? ` - ${worker.hourlyRate} EUR/h` : ""}</small>
                {worker.phone || worker.email ? <small>{[worker.phone, worker.email].filter(Boolean).join(" - ")}</small> : null}
                {(worker.links || []).length ? (
                  <small>{L.equipe.linkedTo}: {worker.links.map((link) => link.label).filter(Boolean).join(", ")}</small>
                ) : (worker.linkLabel ? <small>{L.equipe.linkedTo}: {worker.linkLabel}</small> : null)}
              </div>
              <button type="button" className={worker.favorite ? "select-dot selected" : "select-dot"} onClick={(event) => { event.stopPropagation(); updateWorker(worker, { favorite: !worker.favorite }); }} aria-label="Favori" />
              <button type="button" className="mini-danger" onClick={(event) => { event.stopPropagation(); deleteWorker(worker); }}>{L.equipe.delete}</button>
            </article>
          ))}
        </div>

        <button type="button" className="team-fab" onClick={() => setQuickAddOpen(true)} aria-label={L.equipe.addPersonnel}>
          <span>+</span>
        </button>

        {quickAddOpen ? (
          <div className="team-quickadd-overlay" onClick={() => setQuickAddOpen(false)}>
            <div className="team-quickadd-card" onClick={(event) => event.stopPropagation()}>
              <div className="team-quickadd-head">
                <h2>{L.equipe.quickAddTitle}</h2>
                <button type="button" className="qa-close" onClick={() => setQuickAddOpen(false)} aria-label={L.common.close}>✕</button>
              </div>
              <button type="button" className="team-quickadd-tile tile-worker" onClick={() => { setQuickAddOpen(false); openCreate("Ouvrier"); }}>
                <span className="team-tile-icon">👷</span>
                <span className="team-tile-text"><strong>{L.equipe.addWorker}</strong><small>{L.equipe.quickAddWorkerHint}</small></span>
                <span className="team-tile-arrow">→</span>
              </button>
              <button type="button" className="team-quickadd-tile tile-sub" onClick={() => { setQuickAddOpen(false); openCreate("Sous-traitant"); }}>
                <span className="team-tile-icon">🧰</span>
                <span className="team-tile-text"><strong>{L.equipe.addSub}</strong><small>{L.equipe.quickAddSubHint}</small></span>
                <span className="team-tile-arrow">→</span>
              </button>
              <button type="button" className="team-quickadd-tile tile-planning" onClick={() => { setQuickAddOpen(false); openPlanning(); }}>
                <span className="team-tile-icon">📊</span>
                <span className="team-tile-text"><strong>{L.equipe.planningTitle}</strong><small>{L.equipe.quickAddPlanningHint}</small></span>
                <span className="team-tile-arrow">→</span>
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </Shell>
  );
}
