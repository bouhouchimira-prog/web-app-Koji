"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiGet, apiSend, readStoredUser } from "../../lib/client-api";
import { useLocale } from "../../lib/i18n";
import { useApi } from "../../lib/use-api";
import { euro } from "../../lib/pricing";

function emptyForm() {
  return {
    client: "",
    site: "",
    date: new Date().toISOString().slice(0, 10),
    entreprise: "",
    equipement: "",
    constat: "",
    analyse: "",
    preconisations: "",
    signature: "",
    signatureImageDataUrl: "",
    companyName: "",
    companyAddressLine1: "",
    companyPostalCode: "",
    companyCity: "",
    companyEmail: "",
    companyPhone: "",
    companySiret: "",
    companyLogoDataUrl: ""
  };
}

function companyFieldsFromProfile(business = {}) {
  return {
    companyName: business.raisonSociale || "",
    companyAddressLine1: business.addressLine1 || "",
    companyPostalCode: business.postalCode || "",
    companyCity: business.city || "",
    companyEmail: business.emailPro || "",
    companyPhone: business.phone || "",
    companySiret: business.siret || "",
    companyLogoDataUrl: business.logoDataUrl || ""
  };
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

const WORK_STATUS_CLASS = { a_faire: "status-neutral", en_cours: "status-blue", terminee: "status-green" };

// The date-driven workflow status (à faire / en cours / terminée) is derived,
// never stored — it flips to "en cours" automatically once the report's date
// arrives, and to "terminée" only when explicitly marked done.
function interventionWorkStatus(item) {
  if (item.completedAt) return "terminee";
  const today = new Date().toISOString().slice(0, 10);
  return item.date && item.date <= today ? "en_cours" : "a_faire";
}

function displayStatus(item, L) {
  if (item.status === "archivee") return { label: L.interventions.statusLabels.archivee, className: "status-muted" };
  if (item.status === "facturee") return { label: L.interventions.statusLabels.facturee, className: "status-green" };
  const work = interventionWorkStatus(item);
  return { label: L.interventions.workStatusLabels[work], className: WORK_STATUS_CLASS[work] };
}

function ReportCard({ data, company, L }) {
  const name = data.companyName || company?.raisonSociale || "";
  const logo = data.companyLogoDataUrl || company?.logoDataUrl || "";
  const addressLine1 = data.companyAddressLine1 || company?.addressLine1 || "";
  const postalCity = [data.companyPostalCode || company?.postalCode, data.companyCity || company?.city].filter(Boolean).join(" ");
  const email = data.companyEmail || company?.emailPro || "";
  const phone = data.companyPhone || company?.phone || "";
  const siret = data.companySiret || company?.siret || "";
  return (
    <div className="intervention-report-card">
      <div className="intervention-report-top">
        <div className="intervention-letterhead">
          {logo ? <img src={logo} alt={name} /> : <strong>{name}</strong>}
          <small>{[addressLine1, postalCity].filter(Boolean).join(" ")}</small>
          <small>{[email, phone].filter(Boolean).join(" · ")}</small>
          {siret ? <small>SIRET : {siret}</small> : null}
        </div>
        <div className="intervention-report-badge">
          <span>{L.interventions.reportTitle}</span>
          <strong>{L.interventions.referenceShort} {data.reference || "—"}</strong>
          <small>{L.interventions.createdOn(formatDate(data.createdAt || new Date()))}</small>
        </div>
      </div>
      <div className="intervention-report-meta">
        <div><span>{L.interventions.client}</span><strong>{data.client || "-"}</strong></div>
        <div><span>{L.interventions.site}</span><strong>{data.site || "-"}</strong></div>
        <div><span>{L.interventions.date}</span><strong>{formatDate(data.date)}</strong></div>
        <div><span>{L.interventions.entreprise}</span><strong>{data.entreprise || "-"}</strong></div>
        {data.equipement ? <div><span>{L.interventions.equipement}</span><strong>{data.equipement}</strong></div> : null}
      </div>
      {data.constat ? (
        <div className="intervention-report-section"><h3>{L.interventions.constat}</h3><p>{data.constat}</p></div>
      ) : null}
      {data.analyse ? (
        <div className="intervention-report-section"><h3>{L.interventions.analyse}</h3><p>{data.analyse}</p></div>
      ) : null}
      {data.preconisations ? (
        <div className="intervention-report-section"><h3>{L.interventions.preconisations}</h3><p>{data.preconisations}</p></div>
      ) : null}
      <div className="intervention-report-signature">
        <span>{L.interventions.signature}</span>
        {data.signatureImageDataUrl ? (
          <img src={data.signatureImageDataUrl} alt={L.interventions.signature} />
        ) : (
          <strong>{data.signature || "-"}</strong>
        )}
      </div>
    </div>
  );
}

export default function InterventionsPage() {
  const { L } = useLocale();
  const { data: interventions, setData: setInterventions } = useApi("/api/interventions", "interventions");
  const { data: projects } = useApi("/api/projects", "projects");
  const { data: invoices } = useApi("/api/invoices", "invoices");
  const [mode, setMode] = useState("list"); // list | form | preview | detail
  const [statusFilter, setStatusFilter] = useState("toutes");
  const [form, setForm] = useState(emptyForm);
  const [company, setCompany] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [linkProjectId, setLinkProjectId] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedSignatureDataUrl, setSavedSignatureDataUrl] = useState("");
  const logoInputRef = useRef(null);

  const selected = interventions.find((item) => item.id === selectedId) || null;
  const linkedProject = useMemo(
    () => (selected?.projectId ? projects.find((project) => project.id === selected.projectId) : null),
    [selected, projects]
  );
  const linkedInvoice = useMemo(
    () => (selected?.invoiceId ? invoices.find((invoice) => invoice.id === selected.invoiceId) : null),
    [selected, invoices]
  );

  useEffect(() => {
    apiGet("/api/auth/profile")
      .then((payload) => {
        const business = payload?.user?.business || {};
        setCompany(business);
        const profileFields = companyFieldsFromProfile(business);
        setForm((current) => ({
          ...current,
          entreprise: current.entreprise || business.raisonSociale || "",
          signature: current.signature || business.raisonSociale || "",
          ...Object.fromEntries(Object.entries(profileFields).map(([key, value]) => [key, current[key] || value]))
        }));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    apiGet("/api/signature-settings")
      .then((payload) => {
        setSavedSignatureDataUrl(payload?.signatureSettings?.[0]?.signatureDataUrl || "");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "1") setMode("form");
    const openId = params.get("open");
    if (openId) {
      setSelectedId(openId);
      setInvoiceAmount("");
      setMode("detail");
    }
  }, []);

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function downloadPdf(intervention) {
    const userId = readStoredUser()?.id || "";
    window.open(`/api/interventions/pdf?id=${encodeURIComponent(intervention.id)}&userId=${encodeURIComponent(userId)}`, "_blank");
  }

  function downloadInvoicePdf(invoice) {
    const userId = readStoredUser()?.id || "";
    window.open(`/api/invoices/pdf?id=${encodeURIComponent(invoice.id)}&userId=${encodeURIComponent(userId)}`, "_blank");
  }

  function openCreate() {
    setForm({
      ...emptyForm(),
      entreprise: company?.raisonSociale || "",
      signature: company?.raisonSociale || "",
      ...companyFieldsFromProfile(company || {})
    });
    setMode("form");
  }

  function importSavedSignature() {
    if (!savedSignatureDataUrl) return;
    setField("signatureImageDataUrl", savedSignatureDataUrl);
  }

  function clearSignatureImage() {
    setField("signatureImageDataUrl", "");
  }

  function onLogoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setField("companyLogoDataUrl", String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  function openDetail(intervention) {
    setSelectedId(intervention.id);
    setLinkProjectId(intervention.projectId || "");
    setInvoiceAmount("");
    setMode("detail");
  }

  function goToPreview(event) {
    event.preventDefault();
    if (!form.client.trim()) return;
    setMode("preview");
  }

  async function confirmAndSave() {
    setSaving(true);
    try {
      const { intervention } = await apiSend("/api/interventions", form);
      setInterventions([intervention, ...interventions]);
      downloadPdf(intervention);
      setMessage(L.interventions.created);
      openDetail(intervention);
    } finally {
      setSaving(false);
    }
  }

  async function deleteIntervention(intervention) {
    await apiSend("/api/interventions", { id: intervention.id, action: "delete" }, "PATCH");
    setInterventions(interventions.filter((item) => item.id !== intervention.id));
    if (selectedId === intervention.id) setMode("list");
  }

  async function updateSelected(patch) {
    if (!selected) return;
    setBusy(true);
    try {
      const { intervention } = await apiSend("/api/interventions", { id: selected.id, ...patch }, "PATCH");
      setInterventions(interventions.map((item) => (item.id === intervention.id ? intervention : item)));
    } finally {
      setBusy(false);
    }
  }

  async function linkToProject() {
    if (!linkProjectId) return;
    await updateSelected({ projectId: linkProjectId, status: "liee_chantier" });
  }

  async function deferForQuote() {
    await updateSelected({ status: "en_attente_devis" });
  }

  async function archiveIntervention() {
    await updateSelected({ status: "archivee" });
  }

  async function markCompleted() {
    await updateSelected({ completedAt: new Date().toISOString() });
  }

  async function reopenIntervention() {
    await updateSelected({ completedAt: "" });
  }

  async function moveToToday() {
    if (!selected || selected.taskId) return;
    setBusy(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { task } = await apiSend("/api/tasks", {
        label: `${L.interventions.title} — ${selected.client}`,
        project: selected.site || "",
        room: "Chantier",
        startDate: today,
        dueDate: today,
        assignedTo: "Equipe",
        notes: selected.equipement || ""
      });
      const { intervention } = await apiSend("/api/interventions", { id: selected.id, taskId: task.id }, "PATCH");
      setInterventions(interventions.map((item) => (item.id === intervention.id ? intervention : item)));
    } finally {
      setBusy(false);
    }
  }

  async function createInvoiceFromIntervention() {
    if (!selected || Number(invoiceAmount || 0) <= 0) return;
    setBusy(true);
    try {
      const { invoice } = await apiSend("/api/invoices", {
        interventionId: selected.id,
        amountTtc: invoiceAmount
      });
      setInterventions(interventions.map((item) => (
        item.id === selected.id ? { ...item, status: "facturee", invoiceId: invoice.id } : item
      )));
      setInvoiceAmount("");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "form") {
    return (
      <Shell>
        <section className="mobile-tool tool-form-view">
          <header className="tool-topline">
            <button type="button" className="plain-back" onClick={() => setMode("list")}>{"<"}</button>
            <h1>{L.interventions.newTitle}</h1>
            <span />
          </header>

          <div className="intervention-letterhead intervention-letterhead-edit">
            <div className="intervention-logo-box">
              {form.companyLogoDataUrl ? (
                <img src={form.companyLogoDataUrl} alt="" />
              ) : (
                <span className="intervention-logo-placeholder">{L.interventions.noLogo}</span>
              )}
              <button type="button" className="mini-outline" onClick={() => logoInputRef.current?.click()}>{L.interventions.changeLogo}</button>
              <input ref={logoInputRef} type="file" accept="image/*" onChange={onLogoChange} style={{ display: "none" }} />
            </div>
            <div className="intervention-letterhead-fields">
              <input value={form.companyName} onChange={(event) => setField("companyName", event.target.value)} placeholder={L.interventions.companyName} />
              <input value={form.companyAddressLine1} onChange={(event) => setField("companyAddressLine1", event.target.value)} placeholder={L.interventions.companyAddress} />
              <div className="intervention-letterhead-row">
                <input value={form.companyPostalCode} onChange={(event) => setField("companyPostalCode", event.target.value)} placeholder={L.interventions.companyPostalCode} />
                <input value={form.companyCity} onChange={(event) => setField("companyCity", event.target.value)} placeholder={L.interventions.companyCity} />
              </div>
              <div className="intervention-letterhead-row">
                <input value={form.companyEmail} onChange={(event) => setField("companyEmail", event.target.value)} placeholder={L.interventions.companyEmail} />
                <input value={form.companyPhone} onChange={(event) => setField("companyPhone", event.target.value)} placeholder={L.interventions.companyPhone} />
              </div>
              <input value={form.companySiret} onChange={(event) => setField("companySiret", event.target.value)} placeholder={L.interventions.companySiret} />
            </div>
          </div>

          <form className="mobile-form" onSubmit={goToPreview}>
            <label className="mobile-input full">
              <span>{L.interventions.client}</span>
              <input value={form.client} onChange={(event) => setField("client", event.target.value)} required />
            </label>
            <label className="mobile-input full">
              <span>{L.interventions.site}</span>
              <input value={form.site} onChange={(event) => setField("site", event.target.value)} />
            </label>
            <label className="mobile-input full">
              <span>{L.interventions.date}</span>
              <input type="date" value={form.date} onChange={(event) => setField("date", event.target.value)} />
            </label>
            <label className="mobile-input full">
              <span>{L.interventions.entreprise}</span>
              <input value={form.entreprise} onChange={(event) => setField("entreprise", event.target.value)} />
            </label>
            <label className="mobile-input full">
              <span>{L.interventions.equipement}</span>
              <input value={form.equipement} onChange={(event) => setField("equipement", event.target.value)} placeholder={L.interventions.equipementPlaceholder} />
            </label>
            <label className="mobile-input full">
              <span>{L.interventions.constat}</span>
              <textarea rows={6} value={form.constat} onChange={(event) => setField("constat", event.target.value)} placeholder={L.interventions.constatPlaceholder} />
            </label>
            <label className="mobile-input full">
              <span>{L.interventions.analyse}</span>
              <textarea rows={3} value={form.analyse} onChange={(event) => setField("analyse", event.target.value)} />
            </label>
            <label className="mobile-input full">
              <span>{L.interventions.preconisations}</span>
              <textarea rows={4} value={form.preconisations} onChange={(event) => setField("preconisations", event.target.value)} placeholder={L.interventions.preconisationsPlaceholder} />
            </label>
            <label className="mobile-input full">
              <span>{L.interventions.signature}</span>
              <input value={form.signature} onChange={(event) => setField("signature", event.target.value)} />
            </label>
            <div className="intervention-signature-import">
              {form.signatureImageDataUrl ? (
                <>
                  <img src={form.signatureImageDataUrl} alt={L.interventions.signature} className="intervention-signature-preview" />
                  <button type="button" className="mini-outline" onClick={clearSignatureImage}>{L.interventions.removeSignatureImage}</button>
                </>
              ) : (
                <button type="button" className="mini-outline" disabled={!savedSignatureDataUrl} onClick={importSavedSignature}>
                  {savedSignatureDataUrl ? L.interventions.importSignature : L.interventions.noSavedSignature}
                </button>
              )}
            </div>
            <button className="mobile-primary" disabled={!form.client.trim()}>
              {L.interventions.preview}
            </button>
          </form>
        </section>
      </Shell>
    );
  }

  if (mode === "preview") {
    return (
      <Shell>
        <section className="mobile-tool">
          <header className="tool-topline">
            <button type="button" className="plain-back" onClick={() => setMode("form")}>{"<"}</button>
            <h1>{L.interventions.previewTitle}</h1>
            <span />
          </header>

          <ReportCard data={form} company={company} L={L} />

          <div className="intervention-preview-actions">
            <button type="button" className="mini-outline" onClick={() => setMode("form")}>{L.interventions.edit}</button>
            <button type="button" className="mobile-primary" disabled={saving} onClick={confirmAndSave}>
              {saving ? L.interventions.generating : L.interventions.generate}
            </button>
          </div>
        </section>
      </Shell>
    );
  }

  if (mode === "detail" && selected) {
    const status = displayStatus(selected, L);
    const work = interventionWorkStatus(selected);
    return (
      <Shell>
        <section className="mobile-tool">
          <header className="tool-topline">
            <button type="button" className="plain-back" onClick={() => setMode("list")}>{"<"}</button>
            <h1>{selected.client}</h1>
            <span />
          </header>

          <span className={`intervention-status-badge ${status.className}`}>{status.label}</span>

          <ReportCard data={selected} company={company} L={L} />

          <div className="intervention-actions-card">
            <div className="intervention-action-row">
              {selected.completedAt ? (
                <>
                  <p className="tool-muted">{L.interventions.completedOn(formatDate(selected.completedAt))}</p>
                  <button type="button" className="mini-outline" disabled={busy} onClick={reopenIntervention}>{L.interventions.reopen}</button>
                </>
              ) : (
                <button type="button" className="mini-outline" disabled={busy} onClick={markCompleted}>{L.interventions.markCompleted}</button>
              )}
            </div>

            {!selected.completedAt && work === "en_cours" ? (
              <div className="intervention-action-row">
                {selected.taskId ? (
                  <p className="tool-muted">{L.interventions.movedToToday}</p>
                ) : (
                  <button type="button" className="mini-outline" disabled={busy} onClick={moveToToday}>{L.interventions.moveToToday}</button>
                )}
              </div>
            ) : null}

            <h3>{L.interventions.whatNext}</h3>

            <div className="intervention-action-row">
              <select value={linkProjectId} onChange={(event) => setLinkProjectId(event.target.value)}>
                <option value="">{L.interventions.pickProject}</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.title || project.reference || "Chantier"}</option>
                ))}
              </select>
              <button type="button" className="mini-outline" disabled={busy || !linkProjectId} onClick={linkToProject}>{L.interventions.link}</button>
            </div>
            {linkedProject ? <p className="tool-muted">{L.interventions.linkedTo}: {linkedProject.title || linkedProject.reference}</p> : null}

            <div className="intervention-action-row">
              <button type="button" className="mini-outline" disabled={busy} onClick={deferForQuote}>{L.interventions.deferQuote}</button>
              <button type="button" className="mini-outline" disabled={busy} onClick={archiveIntervention}>{L.interventions.archive}</button>
            </div>

            {selected.status === "facturee" ? (
              <div className="intervention-action-row">
                <p className="tool-muted">{L.interventions.invoiceCreated}{linkedInvoice ? ` — ${euro(linkedInvoice.amountTtc)}` : ""}</p>
                {linkedInvoice ? (
                  <button type="button" className="mini-outline" onClick={() => downloadInvoicePdf(linkedInvoice)}>{L.interventions.downloadInvoicePdf}</button>
                ) : null}
              </div>
            ) : (
              <div className="intervention-action-row">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={invoiceAmount}
                  onChange={(event) => setInvoiceAmount(event.target.value)}
                  placeholder={L.interventions.invoiceAmountPlaceholder}
                />
                <button type="button" className="mini-outline" disabled={busy || Number(invoiceAmount || 0) <= 0} onClick={createInvoiceFromIntervention}>
                  {L.interventions.createInvoice}
                </button>
              </div>
            )}
          </div>

          <div className="intervention-preview-actions">
            <button type="button" className="mini-outline" onClick={() => downloadPdf(selected)}>{L.interventions.downloadPdf}</button>
            <button type="button" className="mini-danger" onClick={() => deleteIntervention(selected)}>{L.equipe.delete}</button>
          </div>
        </section>
      </Shell>
    );
  }

  const withWorkStatus = interventions.map((item) => ({ ...item, workStatus: item.status === "facturee" || item.status === "archivee" ? item.status : interventionWorkStatus(item) }));
  const dashboardStats = {
    total: interventions.length,
    aFaire: withWorkStatus.filter((i) => i.workStatus === "a_faire").length,
    enCours: withWorkStatus.filter((i) => i.workStatus === "en_cours").length,
    facturees: withWorkStatus.filter((i) => i.status === "facturee").length
  };
  const filteredInterventions = statusFilter === "toutes" ? withWorkStatus : withWorkStatus.filter((i) => i.workStatus === statusFilter);
  const nonFacturees = withWorkStatus
    .filter((i) => i.status !== "facturee" && i.status !== "archivee")
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))
    .slice(0, 6);

  return (
    <Shell>
      <section className="fournitures-dashboard">
        <header className="fournitures-dashboard-head">
          <div>
            <h1><span className="title-chip">{L.interventions.title}</span></h1>
            <p>Vos rapports d'intervention, du constat à la facturation.</p>
          </div>
          <div className="fournitures-dashboard-head-actions">
            <button type="button" className="button blue" onClick={openCreate}>+ {L.interventions.newTitle}</button>
          </div>
        </header>

        {message ? <p className="tool-message">{message}</p> : null}

        <div className="fournitures-kpi-row">
          <button type="button" className={`fournitures-kpi-card clickable ${statusFilter === "toutes" ? "kpi-active" : ""}`} onClick={() => setStatusFilter("toutes")}>
            <div className="fournitures-kpi-card-head">
              <span className="fournitures-kpi-icon fournitures-kpi-icon-blue">🛠️</span>
              <span className="title-chip">Interventions</span>
            </div>
            <strong>{dashboardStats.total}</strong>
            <small>au total</small>
          </button>
          <button type="button" className={`fournitures-kpi-card clickable ${statusFilter === "a_faire" ? "kpi-active" : ""}`} onClick={() => setStatusFilter("a_faire")}>
            <div className="fournitures-kpi-card-head">
              <span className="fournitures-kpi-icon fournitures-kpi-icon-amber">⏳</span>
              <span className="title-chip">À faire</span>
            </div>
            <strong>{dashboardStats.aFaire}</strong>
            <small>à planifier</small>
          </button>
          <button type="button" className={`fournitures-kpi-card clickable ${statusFilter === "en_cours" ? "kpi-active" : ""}`} onClick={() => setStatusFilter("en_cours")}>
            <div className="fournitures-kpi-card-head">
              <span className="fournitures-kpi-icon fournitures-kpi-icon-purple">🔧</span>
              <span className="title-chip">En cours</span>
            </div>
            <strong>{dashboardStats.enCours}</strong>
            <small>en traitement</small>
          </button>
          <button type="button" className={`fournitures-kpi-card clickable ${statusFilter === "facturee" ? "kpi-active" : ""}`} onClick={() => setStatusFilter("facturee")}>
            <div className="fournitures-kpi-card-head">
              <span className="fournitures-kpi-icon fournitures-kpi-icon-green">✅</span>
              <span className="title-chip">Facturées</span>
            </div>
            <strong>{dashboardStats.facturees}</strong>
            <small>clôturées</small>
          </button>
        </div>

        <div className="fournitures-dashboard-body">
          <div className="fournitures-main-card">
            <div className="fournitures-main-card-head">
              <strong className="title-chip">Interventions</strong>
              {statusFilter !== "toutes" ? <button type="button" className="mini-button" onClick={() => setStatusFilter("toutes")}>Réinitialiser le filtre</button> : null}
            </div>
            <div className="people-list">
              {filteredInterventions.length === 0 ? <div className="tool-empty">{L.interventions.empty}</div> : null}
              {filteredInterventions.map((item) => {
                const status = displayStatus(item, L);
                return (
                  <article
                    className="person-row clickable"
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openDetail(item)}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openDetail(item); } }}
                  >
                    <div>
                      <strong>{item.client}</strong>
                      <small>{[item.site, formatDate(item.date)].filter(Boolean).join(" — ")}</small>
                    </div>
                    <span className={`intervention-status-badge ${status.className}`}>{status.label}</span>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="fournitures-sidebar-card">
            <strong className="title-chip">Non facturées</strong>
            {nonFacturees.length === 0 ? (
              <div className="tool-empty">Rien en attente de facturation.</div>
            ) : (
              nonFacturees.map((item) => (
                <div className="divers-purchase-row" key={item.id} onClick={() => openDetail(item)}>
                  <div className="divers-purchase-main">
                    <strong>{item.client}</strong>
                    <small>{[item.site, formatDate(item.date)].filter(Boolean).join(" · ")}</small>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </Shell>
  );
}
