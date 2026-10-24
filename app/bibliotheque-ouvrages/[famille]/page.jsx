"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Shell } from "../../../components/Shell";
import { BibliothequeOuvrageTable } from "../../../components/BibliothequeOuvrageTable";
import { BibliothequeTariffModal } from "../../../components/BibliothequeTariffModal";
import { apiGet, apiSend } from "../../../lib/client-api";
import { useLocale } from "../../../lib/i18n";
import { useApi } from "../../../lib/use-api";
import catalog from "../../../data/catalog-ouvrages.json";
import { METIER_ICONS, formatMoney, matchMetier, nextPersoCode } from "../../../lib/bibliotheque-pricing";

const SELECTION_KEY = "koji-devis-ouvrages";

export default function BibliothequeFamillePage() {
  const { L } = useLocale();
  const router = useRouter();
  const params = useParams();
  const familyName = decodeURIComponent(params.famille || "");
  const { data: ouvrages, setData: setOuvrages } = useApi("/api/ouvrages", "ouvrages", catalog);
  const [tab, setTab] = useState("koji");
  const [subfamily, setSubfamily] = useState("");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [companyHourlyRate, setCompanyHourlyRate] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitial, setModalInitial] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    apiGet("/api/auth/profile")
      .then((payload) => {
        const business = payload?.user?.business || {};
        const daily = Number(business.dailyRate || 0);
        const hpd = Number(business.hoursPerDay || 7);
        setCompanyHourlyRate(daily > 0 ? Math.round((daily / hpd) * 100) / 100 : 0);
        setIsAdmin(Boolean(payload?.user?.isAdmin));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(SELECTION_KEY) || "[]");
      if (Array.isArray(stored)) setSelectedIds(stored.filter(Boolean));
    } catch {
      window.localStorage.removeItem(SELECTION_KEY);
    }
  }, []);

  function toggleSelected(id) {
    setSelectedIds((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      window.localStorage.setItem(SELECTION_KEY, JSON.stringify(next));
      return next;
    });
  }

  const familyOuvrages = useMemo(() => ouvrages.filter((item) => (item.family || "Autre") === familyName), [ouvrages, familyName]);
  const kojiOuvrages = useMemo(() => familyOuvrages.filter((item) => !item.userId), [familyOuvrages]);
  const persoOuvrages = useMemo(() => familyOuvrages.filter((item) => item.userId), [familyOuvrages]);

  const metier = matchMetier(familyName);
  const icon = (metier && METIER_ICONS[metier.key]) || "🛠️";

  const subfamilies = useMemo(
    () => Array.from(new Set(familyOuvrages.map((item) => item.category).filter(Boolean))).sort(),
    [familyOuvrages]
  );

  const families = useMemo(() => Array.from(new Set(ouvrages.map((item) => item.family || "Autre"))).sort(), [ouvrages]);
  const categoriesForFamily = (fam) => Array.from(new Set(
    ouvrages.filter((item) => !fam || item.family === fam).map((item) => item.category).filter(Boolean)
  )).sort();

  const normalizedQuery = query.trim().toLowerCase();

  function applyFilters(items) {
    return items.filter((item) => {
      if (subfamily && item.category !== subfamily) return false;
      if (!normalizedQuery) return true;
      return [item.code, item.label, item.category, item.description].join(" ").toLowerCase().includes(normalizedQuery);
    });
  }

  function groupBySubfamily(items) {
    const byCategory = {};
    items.forEach((item) => {
      const key = item.category || "Autre";
      if (!byCategory[key]) byCategory[key] = [];
      byCategory[key].push(item);
    });
    return Object.entries(byCategory).map(([title, groupItems]) => ({ title, items: groupItems }));
  }

  const visibleKoji = groupBySubfamily(applyFilters(kojiOuvrages));
  const visiblePerso = groupBySubfamily(applyFilters(persoOuvrages));

  function openCreateModal() {
    setModalInitial(null);
    setModalOpen(true);
  }

  function openEditModal(item) {
    setModalInitial(item);
    setModalOpen(true);
  }

  async function copyToPerso(item) {
    const code = nextPersoCode(ouvrages);
    const payload = {
      code,
      label: item.label,
      family: item.family,
      category: item.category,
      unit: item.unit,
      billingMode: item.billingMode === "fixed" ? "fixed" : "time",
      normativeTime: item.normativeTime,
      hourlyRate: 0,
      suppliesCost: item.suppliesCost,
      fixedAmountHt: item.fixedAmountHt,
      copiedFromCode: item.code,
      copiedFromKojiPriceHt: item.billingMode === "fixed" ? Number(item.fixedAmountHt || 0) : null
    };
    const { ouvrages: next } = await apiSend("/api/ouvrages", payload, "POST");
    setOuvrages(next);
    setTab("perso");
    setMessage(L.bibliotheque.createdMsg);
  }

  async function saveTariff(payload) {
    const method = payload.id ? "PATCH" : "POST";
    // Code auto-genere pour tout tarif perso cree via ce modal (voir
    // BibliothequeTariffModal : le champ Code n'est visible que lorsque
    // l'admin l'ajoute au catalogue koji) — sans ca la creation echouerait
    // cote API (code obligatoire).
    const finalPayload = !payload.id && !payload.code ? { ...payload, code: nextPersoCode(ouvrages) } : payload;
    const { ouvrages: next } = await apiSend("/api/ouvrages", finalPayload, method);
    setOuvrages(next);
    setModalOpen(false);
    setMessage(payload.id ? L.bibliotheque.savedMsg : L.bibliotheque.createdMsg);
  }

  async function removeOuvrage(item) {
    if (!window.confirm(L.bibliotheque.confirmDelete(item.code))) return;
    const response = await fetch(`/api/ouvrages?id=${encodeURIComponent(item.id)}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) { setMessage(payload.error || L.bibliotheque.deleteError); return; }
    setOuvrages(payload.ouvrages);
    setMessage(L.bibliotheque.deletedMsg);
  }

  async function hideOuvrage(item) {
    if (!window.confirm(L.bibliotheque.confirmHide(item.code))) return;
    const response = await fetch(`/api/ouvrages?id=${encodeURIComponent(item.id)}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) { setMessage(payload.error || L.bibliotheque.deleteError); return; }
    setOuvrages(payload.ouvrages);
  }

  function addSelectionToQuote() {
    window.location.href = "/devis?selection=ouvrages";
  }

  const selectedInFamilyKojiCount = selectedIds.filter((id) => kojiOuvrages.some((item) => item.id === id)).length;

  async function copySelectionToPerso() {
    const items = selectedIds.map((id) => ouvrages.find((o) => o.id === id)).filter((item) => item && !item.userId);
    for (const item of items) await copyToPerso(item);
  }

  return (
    <Shell>
      <main className="biblio-family-page">
        <div className="biblio-family-head">
          <button type="button" className="biblio-back" aria-label="Retour" onClick={() => router.push("/bibliotheque-ouvrages")}>{"<"}</button>
          <span className="biblio-family-icon-lg">{icon}</span>
          <div className="biblio-family-title">
            <div className="biblio-breadcrumb">{L.bibliotheque.title} <span>›</span> <span>{L.bibliotheque.familiesTab}</span></div>
            <h1>{familyName}</h1>
          </div>
          <div className="fournitures-dashboard-head-actions">
            <button type="button" className="button gold" onClick={openCreateModal}>+ {L.bibliotheque.createTariff}</button>
          </div>
        </div>

        {message ? <p className="library-message">{message}</p> : null}

        <div className="biblio-kpi-row">
          <div className="fournitures-kpi-card">
            <small>{L.bibliotheque.hourlyRateCardLabel(metier?.label || familyName)}</small>
            <strong>{formatMoney(companyHourlyRate)} / h</strong>
            <small>{L.bibliotheque.kojiOuvragesDesc}</small>
            <a className="mini-button" href="/profil">{L.bibliotheque.editRateBtn}</a>
          </div>
          <div className="fournitures-kpi-card">
            <small>{L.bibliotheque.kojiTab}</small>
            <strong>{kojiOuvrages.length}</strong>
            <small>{L.bibliotheque.kojiOuvragesDesc}</small>
          </div>
          <div className="fournitures-kpi-card biblio-perso-card">
            <small>{L.bibliotheque.myPricesTab}</small>
            <strong>{persoOuvrages.length}</strong>
            <small>{L.bibliotheque.myPricesDesc}</small>
          </div>
        </div>

        <div className="biblio-info-banner">{tab === "koji" ? L.bibliotheque.kojiInfoBanner : L.bibliotheque.persoInfoBanner}</div>

        <div className="biblio-tabs-row">
          <div className="biblio-tabs">
            <button type="button" className={tab === "koji" ? "active" : ""} onClick={() => setTab("koji")}>
              {L.bibliotheque.kojiTab}<span className="biblio-tab-badge">{kojiOuvrages.length}</span>
            </button>
            <button type="button" className={tab === "perso" ? "active" : ""} onClick={() => setTab("perso")}>
              {L.bibliotheque.myPricesTab}<span className="biblio-tab-badge perso">{persoOuvrages.length}</span>
            </button>
          </div>
          <input
            className="supplier-search-input biblio-search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={L.bibliotheque.searchInFamily(familyName)}
          />
        </div>

        <div className="biblio-chips">
          <button type="button" className={!subfamily ? "active" : ""} onClick={() => setSubfamily("")}>{L.bibliotheque.allSubfamilies}</button>
          {subfamilies.map((item) => (
            <button type="button" key={item} className={subfamily === item ? "active" : ""} onClick={() => setSubfamily(item)}>{item}</button>
          ))}
        </div>

        {tab === "koji" ? (
          <BibliothequeOuvrageTable
            L={L}
            mode="koji"
            groups={visibleKoji}
            companyHourlyRate={companyHourlyRate}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelected}
            onCopyToPerso={copyToPerso}
            onEdit={openEditModal}
            onDelete={removeOuvrage}
            onHide={hideOuvrage}
            isAdmin={isAdmin}
            emptyLabel={L.bibliotheque.noFamilyOuvrages}
          />
        ) : (
          <>
            <BibliothequeOuvrageTable
              L={L}
              mode="perso"
              groups={visiblePerso}
              companyHourlyRate={companyHourlyRate}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelected}
              onEdit={openEditModal}
              onDelete={removeOuvrage}
              isAdmin={isAdmin}
              emptyLabel={L.bibliotheque.noPersoYet}
            />
            <button type="button" className="biblio-create-in-family" onClick={openCreateModal}>
              + {L.bibliotheque.createTariffInFamily(familyName)}
            </button>
          </>
        )}

        {selectedIds.length > 0 ? (
          <div className="library-selection-bar">
            <span>{L.bibliotheque.selected(selectedIds.length)}</span>
            {tab === "koji" && selectedInFamilyKojiCount > 0 ? <button type="button" onClick={copySelectionToPerso}>{L.bibliotheque.copyToPerso}</button> : null}
            <button type="button" onClick={addSelectionToQuote}>{L.bibliotheque.addToQuote(selectedIds.length)}</button>
          </div>
        ) : null}
      </main>

      <BibliothequeTariffModal
        L={L}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={saveTariff}
        initial={modalInitial}
        defaultFamily={familyName}
        families={families}
        categoriesForFamily={categoriesForFamily}
        isAdmin={isAdmin}
        companyHourlyRate={companyHourlyRate}
      />
    </Shell>
  );
}
