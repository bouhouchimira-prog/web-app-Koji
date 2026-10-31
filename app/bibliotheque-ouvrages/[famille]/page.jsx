"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Shell } from "../../../components/Shell";
import { BibliothequeOuvrageTable } from "../../../components/BibliothequeOuvrageTable";
import { BibliothequeTariffModal } from "../../../components/BibliothequeTariffModal";
import { apiGet, apiSend } from "../../../lib/client-api";
import { useLocale } from "../../../lib/i18n";
import { useApi } from "../../../lib/use-api";
import catalog from "../../../data/catalog-ouvrages.json";
import { formatMoney, matchMetier, nextPersoCode } from "../../../lib/bibliotheque-pricing";

const SELECTION_KEY = "koji-devis-ouvrages";

export default function BibliothequeFamillePage() {
  const { L } = useLocale();
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

  const familyCounts = useMemo(() => {
    const counts = {};
    ouvrages.forEach((item) => {
      const name = item.family || "Autre";
      counts[name] = (counts[name] || 0) + 1;
    });
    return counts;
  }, [ouvrages]);

  const tableProps = {
    L,
    companyHourlyRate,
    selectedIds,
    onToggleSelect: toggleSelected,
    onEdit: openEditModal,
    onDelete: removeOuvrage,
    isAdmin
  };

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow">
            <Link href="/bibliotheque-ouvrages" className="link">{L.bibliotheque.title}</Link>
            {" · "}{metier?.label || "Famille d'ouvrages"}
          </span>
          <h1>{familyName}</h1>
        </div>
        <div className="acts">
          <button type="button" className="btn btn-main" onClick={openCreateModal}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            {L.bibliotheque.createTariff}
          </button>
        </div>
      </div>

      {message ? <p className="notice" role="status">{message}</p> : null}

      <div className="kpis k3">
        <div>
          <div className="l">{L.bibliotheque.hourlyRateCardLabel(metier?.label || familyName)}</div>
          <div className="v">{companyHourlyRate ? `${formatMoney(companyHourlyRate)} / h` : "—"}</div>
          <div className="s"><Link href="/profil" className="fp-web">{L.bibliotheque.editRateBtn}</Link></div>
        </div>
        <div>
          <div className="l">{L.bibliotheque.kojiTab}</div>
          <div className="v">{kojiOuvrages.length}</div>
          <div className="s">{L.bibliotheque.kojiOuvragesDesc}</div>
        </div>
        <div>
          <div className="l">{L.bibliotheque.myPricesTab}</div>
          <div className="v">{persoOuvrages.length}</div>
          <div className="s">{L.bibliotheque.myPricesDesc}</div>
        </div>
      </div>

      <div className="tbar">
        <div className="wtabs" role="tablist" aria-label={familyName}>
          <button type="button" role="tab" aria-selected={tab === "koji"} className={tab === "koji" ? "on" : ""} onClick={() => setTab("koji")}>
            {L.bibliotheque.kojiTab} <span>{kojiOuvrages.length}</span>
          </button>
          <button type="button" role="tab" aria-selected={tab === "perso"} className={tab === "perso" ? "on" : ""} onClick={() => setTab("perso")}>
            {L.bibliotheque.myPricesTab} <span>{persoOuvrages.length}</span>
          </button>
        </div>
        <label className="search search-wide">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4.5-4.5" /></svg>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={L.bibliotheque.searchInFamily(familyName)} aria-label={L.bibliotheque.searchInFamily(familyName)} />
        </label>
      </div>

      <div className="bib-layout">
        <nav className="bib-nav" aria-label="Familles">
          <span className="flab">Familles</span>
          {families.map((name) => (
            <Link key={name} href={`/bibliotheque-ouvrages/${encodeURIComponent(name)}`} className={name === familyName ? "on" : ""} aria-current={name === familyName ? "page" : undefined}>
              {name}<span>{familyCounts[name] || 0}</span>
            </Link>
          ))}
        </nav>

        <div className="fp-main">
          <p className="notice">{tab === "koji" ? L.bibliotheque.kojiInfoBanner : L.bibliotheque.persoInfoBanner}</p>

          {subfamilies.length > 1 ? (
            <div className="chips" role="group" aria-label="Sous-familles">
              <button type="button" className={`chip chip-s${!subfamily ? " on" : ""}`} aria-pressed={!subfamily} onClick={() => setSubfamily("")}>{L.bibliotheque.allSubfamilies}</button>
              {subfamilies.map((item) => (
                <button type="button" key={item} className={`chip chip-s${subfamily === item ? " on" : ""}`} aria-pressed={subfamily === item} onClick={() => setSubfamily(item)}>{item}</button>
              ))}
            </div>
          ) : null}

          {tab === "koji" ? (
            <BibliothequeOuvrageTable
              {...tableProps}
              mode="koji"
              groups={visibleKoji}
              onCopyToPerso={copyToPerso}
              onHide={hideOuvrage}
              emptyLabel={L.bibliotheque.noFamilyOuvrages}
            />
          ) : (
            <>
              <BibliothequeOuvrageTable
                {...tableProps}
                mode="perso"
                groups={visiblePerso}
                emptyLabel={L.bibliotheque.noPersoYet}
              />
              <div><button type="button" className="btn btn-sec" onClick={openCreateModal}>+ {L.bibliotheque.createTariffInFamily(familyName)}</button></div>
            </>
          )}
        </div>
      </div>

      {selectedIds.length > 0 ? (
        <div className="bib-selbar" role="region" aria-label="Sélection">
          <span>{L.bibliotheque.selected(selectedIds.length)}</span>
          {tab === "koji" && selectedInFamilyKojiCount > 0 ? <button type="button" className="btn btn-sec" onClick={copySelectionToPerso}>{L.bibliotheque.copyToPerso}</button> : null}
          <button type="button" className="btn btn-main" onClick={addSelectionToQuote}>{L.bibliotheque.addToQuote(selectedIds.length)}</button>
        </div>
      ) : null}

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
