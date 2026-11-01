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

const WORK_STATUS_CLASS = { a_faire: "tag tag-o", en_cours: "tag tag-e", terminee: "tag tag-o dim" };

const STATUS_TABS = [
  { id: "toutes", label: "Toutes" },
  { id: "a_faire", label: "À faire" },
  { id: "en_cours", label: "En cours" },
  { id: "facturee", label: "Facturées" }
];

function PlusIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;
}

// The date-driven workflow status (à faire / en cours / terminée) is derived,
// never stored — it flips to "en cours" automatically once the report's date
// arrives, and to "terminée" only when explicitly marked done.
function interventionWorkStatus(item) {
  if (item.completedAt) return "terminee";
  const today = new Date().toISOString().slice(0, 10);
  return item.date && item.date <= today ? "en_cours" : "a_faire";
}

function displayStatus(item, L) {
  if (item.status === "archivee") return { label: L.interventions.statusLabels.archivee, className: "tag tag-o dim" };
  if (item.status === "facturee") return { label: L.interventions.statusLabels.facturee, className: "tag tag-e" };
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
      <Shell variant="pro">
        <div className="head">
          <div className="stack">
            <button type="button" className="link" onClick={() => setMode("list")}>← {L.interventions.title}</button>
            <span className="eyebrow">Rapport d'intervention</span>
            <h1>{L.interventions.newTitle}</h1>
          </div>
        </div>

        <section className="card">
          <div className="card-h"><h2>En-tête du rapport</h2><span className="sm2">repris de votre profil, modifiable pour ce rapport</span></div>
          <div className="iv-head">
            <div className="iv-logo">
              {form.companyLogoDataUrl ? <img src={form.companyLogoDataUrl} alt="" /> : <span>{L.interventions.noLogo}</span>}
              <button type="button" className="btn btn-sec" onClick={() => logoInputRef.current?.click()}>{L.interventions.changeLogo}</button>
              <input ref={logoInputRef} type="file" accept="image/*" onChange={onLogoChange} style={{ display: "none" }} />
            </div>
            <div className="fgrid">
              <label className="full">{L.interventions.companyName}<input value={form.companyName} onChange={(event) => setField("companyName", event.target.value)} /></label>
              <label className="full">{L.interventions.companyAddress}<input value={form.companyAddressLine1} onChange={(event) => setField("companyAddressLine1", event.target.value)} /></label>
              <label>{L.interventions.companyPostalCode}<input value={form.companyPostalCode} onChange={(event) => setField("companyPostalCode", event.target.value)} /></label>
              <label>{L.interventions.companyCity}<input value={form.companyCity} onChange={(event) => setField("companyCity", event.target.value)} /></label>
              <label>{L.interventions.companyEmail}<input value={form.companyEmail} onChange={(event) => setField("companyEmail", event.target.value)} /></label>
              <label>{L.interventions.companyPhone}<input value={form.companyPhone} onChange={(event) => setField("companyPhone", event.target.value)} /></label>
              <label className="full">{L.interventions.companySiret}<input value={form.companySiret} onChange={(event) => setField("companySiret", event.target.value)} /></label>
            </div>
          </div>
        </section>

        <form className="card" onSubmit={goToPreview}>
          <div className="card-h"><h2>Intervention</h2></div>
          <div className="fgrid">
            <label>{L.interventions.client}<input value={form.client} onChange={(event) => setField("client", event.target.value)} required /></label>
            <label>{L.interventions.site}<input value={form.site} onChange={(event) => setField("site", event.target.value)} /></label>
            <label>{L.interventions.date}<input type="date" value={form.date} onChange={(event) => setField("date", event.target.value)} /></label>
            <label>{L.interventions.entreprise}<input value={form.entreprise} onChange={(event) => setField("entreprise", event.target.value)} /></label>
            <label className="full">{L.interventions.equipement}<input value={form.equipement} onChange={(event) => setField("equipement", event.target.value)} placeholder={L.interventions.equipementPlaceholder} /></label>
            <label className="full">{L.interventions.constat}<textarea rows={6} value={form.constat} onChange={(event) => setField("constat", event.target.value)} placeholder={L.interventions.constatPlaceholder} /></label>
            <label className="full">{L.interventions.analyse}<textarea rows={3} value={form.analyse} onChange={(event) => setField("analyse", event.target.value)} /></label>
            <label className="full">{L.interventions.preconisations}<textarea rows={4} value={form.preconisations} onChange={(event) => setField("preconisations", event.target.value)} placeholder={L.interventions.preconisationsPlaceholder} /></label>
            <label className="full">{L.interventions.signature}<input value={form.signature} onChange={(event) => setField("signature", event.target.value)} /></label>
          </div>
          <div className="iv-row">
            {form.signatureImageDataUrl ? (
              <>
                <img src={form.signatureImageDataUrl} alt={L.interventions.signature} className="iv-sig" />
                <button type="button" className="btn btn-sec" onClick={clearSignatureImage}>{L.interventions.removeSignatureImage}</button>
              </>
            ) : (
              <button type="button" className="btn btn-sec" disabled={!savedSignatureDataUrl} onClick={importSavedSignature}>
                {savedSignatureDataUrl ? L.interventions.importSignature : L.interventions.noSavedSignature}
              </button>
            )}
          </div>
          <div className="ed-act">
            <button type="button" className="btn btn-sec" onClick={() => setMode("list")}>Annuler</button>
            <button type="submit" className="btn btn-main" disabled={!form.client.trim()}>{L.interventions.preview}</button>
          </div>
        </form>
      </Shell>
    );
  }

  if (mode === "preview") {
    return (
      <Shell variant="pro">
        <div className="head">
          <div className="stack">
            <button type="button" className="link" onClick={() => setMode("form")}>← {L.interventions.edit}</button>
            <span className="eyebrow">Rapport d'intervention</span>
            <h1>{L.interventions.previewTitle}</h1>
          </div>
          <div className="acts">
            <button type="button" className="btn btn-sec" onClick={() => setMode("form")}>{L.interventions.edit}</button>
            <button type="button" className="btn btn-main" disabled={saving} onClick={confirmAndSave}>
              {saving ? L.interventions.generating : L.interventions.generate}
            </button>
          </div>
        </div>
        <div className="iv-doc">
          <ReportCard data={form} company={company} L={L} />
        </div>
      </Shell>
    );
  }

  if (mode === "detail" && selected) {
    const status = displayStatus(selected, L);
    const work = interventionWorkStatus(selected);
    return (
      <Shell variant="pro">
        <div className="head">
          <div className="stack">
            <button type="button" className="link" onClick={() => setMode("list")}>← {L.interventions.title}</button>
            <span className="eyebrow">{[selected.reference ? `Rapport ${selected.reference}` : "Rapport d'intervention", formatDate(selected.date), selected.site].filter(Boolean).join(" · ")}</span>
            <h1>{selected.client}</h1>
          </div>
          <div className="acts">
            <span className={status.className}>{status.label}</span>
            <button type="button" className="btn btn-sec" onClick={() => downloadPdf(selected)}>{L.interventions.downloadPdf}</button>
          </div>
        </div>

        {message ? <p className="notice" role="status">{message}</p> : null}

        <div className="iv-detail">
          <div className="iv-doc">
            <ReportCard data={selected} company={company} L={L} />
          </div>

          <aside className="iv-side">
            <section className="card">
              <div className="card-h"><h2>Avancement</h2></div>
              {selected.completedAt ? (
                <div className="iv-row">
                  <span className="muted">{L.interventions.completedOn(formatDate(selected.completedAt))}</span>
                  <button type="button" className="btn btn-sec" disabled={busy} onClick={reopenIntervention}>{L.interventions.reopen}</button>
                </div>
              ) : (
                <div className="iv-row">
                  <button type="button" className="btn btn-sec" disabled={busy} onClick={markCompleted}>{L.interventions.markCompleted}</button>
                  {work === "en_cours" ? (
                    selected.taskId
                      ? <span className="muted">{L.interventions.movedToToday}</span>
                      : <button type="button" className="btn btn-sec" disabled={busy} onClick={moveToToday}>{L.interventions.moveToToday}</button>
                  ) : null}
                </div>
              )}
            </section>

            <section className="card">
              <div className="card-h"><h2>{L.interventions.whatNext}</h2></div>
              <div className="iv-row">
                <select className="iv-select" value={linkProjectId} onChange={(event) => setLinkProjectId(event.target.value)} aria-label={L.interventions.pickProject}>
                  <option value="">{L.interventions.pickProject}</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.title || project.reference || "Chantier"}</option>
                  ))}
                </select>
                <button type="button" className="btn btn-sec" disabled={busy || !linkProjectId} onClick={linkToProject}>{L.interventions.link}</button>
              </div>
              {linkedProject ? <p className="muted">{L.interventions.linkedTo} : {linkedProject.title || linkedProject.reference}</p> : null}
              <div className="iv-row">
                <button type="button" className="btn btn-sec" disabled={busy} onClick={deferForQuote}>{L.interventions.deferQuote}</button>
                <button type="button" className="btn btn-sec" disabled={busy} onClick={archiveIntervention}>{L.interventions.archive}</button>
              </div>
            </section>

            <section className="card">
              <div className="card-h"><h2>Facturation</h2></div>
              {selected.status === "facturee" ? (
                <div className="iv-row">
                  <span className="muted">{L.interventions.invoiceCreated}{linkedInvoice ? ` · ${euro(linkedInvoice.amountTtc)}` : ""}</span>
                  {linkedInvoice ? <button type="button" className="btn btn-sec" onClick={() => downloadInvoicePdf(linkedInvoice)}>{L.interventions.downloadInvoicePdf}</button> : null}
                </div>
              ) : (
                <div className="iv-row">
                  <input
                    className="iv-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={invoiceAmount}
                    onChange={(event) => setInvoiceAmount(event.target.value)}
                    placeholder={L.interventions.invoiceAmountPlaceholder}
                    aria-label={L.interventions.invoiceAmountPlaceholder}
                  />
                  <button type="button" className="btn btn-sec" disabled={busy || Number(invoiceAmount || 0) <= 0} onClick={createInvoiceFromIntervention}>
                    {L.interventions.createInvoice}
                  </button>
                </div>
              )}
            </section>

            <div>
              <button type="button" className="btn btn-sec" onClick={() => deleteIntervention(selected)}>{L.equipe.delete}</button>
            </div>
          </aside>
        </div>
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

  const tabCounts = { toutes: dashboardStats.total, a_faire: dashboardStats.aFaire, en_cours: dashboardStats.enCours, facturee: dashboardStats.facturees };

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow">{[`${dashboardStats.total} rapport${dashboardStats.total > 1 ? "s" : ""}`, dashboardStats.aFaire ? `${dashboardStats.aFaire} à faire` : "", dashboardStats.enCours ? `${dashboardStats.enCours} en cours` : ""].filter(Boolean).join(" · ")}</span>
          <h1>{L.interventions.title}</h1>
          <span className="muted">Vos rapports d'intervention, du constat à la facturation.</span>
        </div>
        <div className="acts">
          <button type="button" className="btn btn-main" onClick={openCreate}><PlusIcon />{L.interventions.newTitle}</button>
        </div>
      </div>

      {message ? <p className="notice" role="status">{message}</p> : null}

      <div className="tbar">
        <div className="wtabs" role="tablist" aria-label="Filtrer les interventions">
          {STATUS_TABS.map((tab) => (
            <button key={tab.id} type="button" role="tab" aria-selected={statusFilter === tab.id} className={statusFilter === tab.id ? "on" : ""} onClick={() => setStatusFilter(tab.id)}>
              {tab.label} <span>{tabCounts[tab.id]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="iv-grid">
        <div>
          {filteredInterventions.length === 0 ? (
            <div className="tbl"><p className="empty">{L.interventions.empty}</p></div>
          ) : (
            <>
              <div className="tbl has-cards">
                <table>
                  <thead>
                    <tr><th>Client · lieu</th><th>Date</th><th>Équipement</th><th>Statut</th></tr>
                  </thead>
                  <tbody>
                    {filteredInterventions.map((item) => {
                      const status = displayStatus(item, L);
                      return (
                        <tr key={item.id} tabIndex={0} onClick={() => openDetail(item)} onKeyDown={(event) => { if (event.key === "Enter") openDetail(item); }}>
                          <td className="n">{item.client}<div className="sm">{item.site || "—"}</div></td>
                          <td>{formatDate(item.date)}</td>
                          <td className="sm2">{item.equipement || "—"}</td>
                          <td><span className={status.className}>{status.label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mlist">
                {filteredInterventions.map((item) => {
                  const status = displayStatus(item, L);
                  return (
                    <button type="button" className="m-card" key={item.id} onClick={() => openDetail(item)}>
                      <div className="top2">
                        <div>
                          <div className="nm">{item.client}</div>
                          <div className="meta">{[item.site, formatDate(item.date)].filter(Boolean).join(" · ")}</div>
                        </div>
                        <span className={status.className}>{status.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <aside className="card">
          <div className="card-h"><h2>Non facturées{nonFacturees.length ? <span className="kcnt">{nonFacturees.length}</span> : null}</h2></div>
          {nonFacturees.length === 0 ? (
            <p className="empty">Rien en attente de facturation.</p>
          ) : nonFacturees.map((item) => (
            <button type="button" className="row" key={item.id} onClick={() => openDetail(item)}>
              <div className="t"><strong>{item.client}</strong><small>{[item.site, formatDate(item.date)].filter(Boolean).join(" · ")}</small></div>
            </button>
          ))}
        </aside>
      </div>
    </Shell>
  );
}
