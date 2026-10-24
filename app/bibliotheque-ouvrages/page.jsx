"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "../../components/Shell";
import { BibliothequeOuvrageTable } from "../../components/BibliothequeOuvrageTable";
import { BibliothequeTariffModal } from "../../components/BibliothequeTariffModal";
import { apiGet, apiSend } from "../../lib/client-api";
import { useLocale } from "../../lib/i18n";
import { useApi } from "../../lib/use-api";
import catalog from "../../data/catalog-ouvrages.json";
import { VISITE_METIERS } from "../../lib/visite-tree";
import {
  FAMILY_SUBTITLE_OVERRIDES,
  METIER_ICONS,
  matchMetier,
  nextPersoCode
} from "../../lib/bibliotheque-pricing";

const SELECTION_KEY = "koji-devis-ouvrages";

// Catalogue Electricite recu le 19 septembre (KOJI_ouvrages_ELEC_Suchet.pdf,
// 21 lignes) — pre-rempli dans la zone d'import pour que cette demande se
// traite en un clic, reutilisable pour d'autres catalogues.
const DEFAULT_IMPORT_TEXT = [
  "ELEC-GEN-001\tInstallation de chantier, déplacements, protections, nettoyage\tÉlectricité\tGEN\tforfait\t4,00\t60\tchantier < 150 m²",
  "ELEC-GEN-002\tEssais, mise en service, étiquetage du tableau\tÉlectricité\tGEN\tforfait\t4,00\t60\t",
  "ELEC-DEP-001\tDépose point existant supprimé, mise en sécurité\tÉlectricité\tDEP\tu\t0,25\t60\tpoint non reposé",
  "ELEC-DEP-002\tDépose appareillage existant, neutralisation de la boîte, point neuf complet en goulotte\tÉlectricité\tDEP\tu\t1,00\t60\taucune boîte encastrée réutilisée",
  "ELEC-TAB-001\tRemplacement tableau 3 rangées, 2 ID 30 mA, 14 départs, repérage\tÉlectricité\tTAB\tu\t8,00\t60\t",
  "ELEC-TAB-002\tLiaison disjoncteur de branchement → tableau, 16 mm²\tÉlectricité\tTAB\tu\t3,00\t60\t",
  "ELEC-TAB-003\tMise à la terre / liaison équipotentielle pièces d'eau\tÉlectricité\tTAB\tforfait\t3,00\t60\t",
  "ELEC-CHE-001\tGoulotte PVC 2 compartiments, câbles compris\tÉlectricité\tCHE\tml\t0,30\t60\tcompté au périmètre hors portes",
  "ELEC-CHE-002\tDépose plinthe bois existante, évacuation\tÉlectricité\tCHE\tml\t0,10\t60\toption plinthe électrique",
  "ELEC-CHE-003\tPlinthe électrique 3 compartiments, câbles compris\tÉlectricité\tCHE\tml\t0,35\t60\tremplace ELEC-CHE-001",
  "ELEC-PT-001\tPrise 2P+T 16 A, point complet\tÉlectricité\tPT\tu\t0,75\t60\t",
  "ELEC-PT-002\tPrise dédiée 20 A, circuit spécialisé\tÉlectricité\tPT\tu\t0,90\t60\t",
  "ELEC-PT-003\tPrise RJ45 cat.6\tÉlectricité\tPT\tu\t1,00\t60\t",
  "ELEC-PT-004\tInterrupteur simple allumage\tÉlectricité\tPT\tu\t0,75\t60\t",
  "ELEC-PT-005\tVa-et-vient / double commande\tÉlectricité\tPT\tu\t1,10\t60\t",
  "ELEC-PT-006\tPoint lumineux plafond DCL\tÉlectricité\tPT\tu\t1,00\t60\t",
  "ELEC-PT-007\tSortie applique murale\tÉlectricité\tPT\tu\t0,90\t60\t",
  "ELEC-LUM-001\tSpot LED encastré, raccordement\tÉlectricité\tLUM\tu\t0,80\t60\t",
  "ELEC-LUM-002\tRail triphasé plafond, alimentation\tÉlectricité\tLUM\tml\t0,50\t60\t",
  "ELEC-LUM-003\tSpot LED sur rail\tÉlectricité\tLUM\tu\t0,25\t60\t",
  "ELEC-EQU-001\tAlimentation VMC, circuit dédié\tÉlectricité\tEQU\tu\t1,50\t60\t"
].join("\n");

function parseImportLine(line) {
  const parts = line.split("\t").map((p) => p.trim());
  if (parts.length < 7) return null;
  const [code, label, family, category, unit, normativeTime, hourlyRate, description = ""] = parts;
  if (!code || !label) return null;
  const comment = description ? `${description} — estimation KOJI, à vérifier (source PDF, sept. 2026)` : "Estimation KOJI, à vérifier (source PDF, sept. 2026)";
  return {
    code,
    label,
    family: family || "Autre",
    category: category || "General",
    unit: unit || "u",
    normativeTime: Number(String(normativeTime).replace(",", ".")) || 0,
    hourlyRate: Number(String(hourlyRate).replace(",", ".")) || 0,
    description: comment
  };
}

export default function BibliothequeAccueilPage() {
  const { L } = useLocale();
  const router = useRouter();
  const { data: ouvrages, setData: setOuvrages } = useApi("/api/ouvrages", "ouvrages", catalog);
  const [activeTab, setActiveTab] = useState("familles");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [companyHourlyRate, setCompanyHourlyRate] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState(DEFAULT_IMPORT_TEXT);
  const [importBusy, setImportBusy] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitial, setModalInitial] = useState(null);
  const [modalDefaultFamily, setModalDefaultFamily] = useState("");
  const [message, setMessage] = useState("");

  function openCreateModal(family) {
    setModalInitial(null);
    setModalDefaultFamily(family || "");
    setModalOpen(true);
  }

  function openEditModal(item) {
    setModalInitial(item);
    setModalDefaultFamily(item.family || "");
    setModalOpen(true);
  }

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
    const params = new URLSearchParams(window.location.search);
    const keepSelection = params.get("keepSelection") === "1";
    const resetSelection = params.get("resetSelection") === "1";
    if (resetSelection || !keepSelection) {
      window.localStorage.removeItem(SELECTION_KEY);
      setSelectedIds([]);
      return;
    }
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

  const families = useMemo(() => Array.from(new Set(ouvrages.map((item) => item.family || "Autre"))).sort(), [ouvrages]);

  const familyStats = useMemo(() => {
    const counts = {};
    const persoCounts = {};
    ouvrages.forEach((item) => {
      const name = item.family || "Autre";
      counts[name] = (counts[name] || 0) + 1;
      if (item.userId) persoCounts[name] = (persoCounts[name] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => {
        const metier = matchMetier(name);
        return {
          name,
          count,
          persoCount: persoCounts[name] || 0,
          metier,
          subtitle: FAMILY_SUBTITLE_OVERRIDES[name] || metier?.key || "Générique",
          icon: (metier && METIER_ICONS[metier.key]) || "🛠️"
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [ouvrages]);

  const metierCoverage = useMemo(() => {
    const covered = new Set(familyStats.map((f) => f.metier?.key).filter(Boolean));
    const missing = VISITE_METIERS.filter((m) => !covered.has(m.key));
    return { missing };
  }, [familyStats]);

  const myOuvrages = useMemo(() => ouvrages.filter((item) => item.userId), [ouvrages]);

  const categoriesForFamily = (familyName) => Array.from(new Set(
    ouvrages.filter((item) => !familyName || item.family === familyName).map((item) => item.category).filter(Boolean)
  )).sort();

  const normalizedQuery = query.trim().toLowerCase();
  const searching = normalizedQuery.length > 0;

  const searchMatches = useMemo(() => {
    if (!searching) return [];
    return ouvrages.filter((item) => [item.code, item.label, item.family, item.category, item.description].join(" ").toLowerCase().includes(normalizedQuery));
  }, [ouvrages, searching, normalizedQuery]);

  function groupByFamily(items) {
    const byFamily = {};
    items.forEach((item) => {
      const key = item.family || "Autre";
      if (!byFamily[key]) byFamily[key] = [];
      byFamily[key].push(item);
    });
    return Object.entries(byFamily).map(([title, groupItems]) => ({ title, items: groupItems }));
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
    setActiveTab("perso");
    setMessage(L.bibliotheque.createdMsg);
  }

  async function saveTariff(payload) {
    const method = payload.id ? "PATCH" : "POST";
    // Code auto-genere pour tout tarif perso cree via ce modal (le champ
    // Code n'est visible que lorsque l'admin l'ajoute au catalogue koji —
    // voir BibliothequeTariffModal) : sans ca, la creation echouerait cote
    // API (code obligatoire).
    const finalPayload = !payload.id && !payload.code ? { ...payload, code: nextPersoCode(ouvrages) } : payload;
    const { ouvrages: next } = await apiSend("/api/ouvrages", finalPayload, method);
    setOuvrages(next);
    setModalOpen(false);
    if (!payload.addToKojiCatalog) setActiveTab("perso");
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

  async function importCatalog() {
    const lines = importText.split("\n").map((line) => line.trim()).filter(Boolean);
    const rows = lines.map(parseImportLine).filter(Boolean);
    if (rows.length === 0) {
      setImportMessage("Aucune ligne valide à importer (code et désignation obligatoires).");
      return;
    }
    setImportBusy(true);
    setImportMessage("");
    let created = 0;
    let lastOuvrages = ouvrages;
    for (const row of rows) {
      try {
        const { ouvrages: nextOuvrages } = await apiSend("/api/ouvrages", row, "POST");
        lastOuvrages = nextOuvrages;
        created += 1;
      } catch {
        // une ligne en erreur ne bloque pas les suivantes
      }
    }
    setOuvrages(lastOuvrages);
    setImportBusy(false);
    setImportMessage(`${created}/${rows.length} ouvrage(s) importé(s).`);
    if (created === rows.length) {
      setImportText("");
      setImportOpen(false);
    }
  }

  function addSelectionToQuote() {
    window.location.href = "/devis?selection=ouvrages";
  }

  const selectedKojiCount = selectedIds.filter((id) => {
    const item = ouvrages.find((o) => o.id === id);
    return item && !item.userId;
  }).length;

  async function copySelectionToPerso() {
    const items = selectedIds.map((id) => ouvrages.find((o) => o.id === id)).filter((item) => item && !item.userId);
    for (const item of items) await copyToPerso(item);
  }

  return (
    <Shell>
      <section className="fournitures-dashboard">
        <header className="fournitures-dashboard-head">
          <div>
            <h1><span className="title-chip">{L.bibliotheque.title}</span></h1>
            <p>{L.bibliotheque.chooseFamilyHint}</p>
          </div>
          <div className="fournitures-dashboard-head-actions">
            <button type="button" className="button secondary" onClick={() => setImportOpen(true)}>{L.bibliotheque.importSpreadsheet}</button>
            <button type="button" className="button gold" onClick={() => openCreateModal("")}>+ {L.bibliotheque.createTariff}</button>
          </div>
        </header>

        {message ? <p className="library-message">{message}</p> : null}

        <div className="biblio-tabs-row">
          <div className="biblio-tabs">
            <button type="button" className={activeTab === "familles" ? "active" : ""} onClick={() => setActiveTab("familles")}>
              {L.bibliotheque.familiesTab}
            </button>
            <button type="button" className={activeTab === "perso" ? "active" : ""} onClick={() => setActiveTab("perso")}>
              {L.bibliotheque.myPricesTab}
              <span className="biblio-tab-badge perso">{myOuvrages.length}</span>
            </button>
          </div>
          <input
            className="supplier-search-input biblio-search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={L.bibliotheque.search}
          />
        </div>

        {searching ? (
          <>
            <BibliothequeOuvrageTable
              L={L}
              mode="koji"
              groups={groupByFamily(searchMatches.filter((item) => !item.userId))}
              companyHourlyRate={companyHourlyRate}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelected}
              onCopyToPerso={copyToPerso}
              onEdit={openEditModal}
              onDelete={removeOuvrage}
              onHide={hideOuvrage}
              isAdmin={isAdmin}
              showFamilyColumn
            />
            <BibliothequeOuvrageTable
              L={L}
              mode="perso"
              groups={groupByFamily(searchMatches.filter((item) => item.userId))}
              companyHourlyRate={companyHourlyRate}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelected}
              onEdit={openEditModal}
              onDelete={removeOuvrage}
              isAdmin={isAdmin}
              showFamilyColumn
              emptyLabel={L.bibliotheque.noPersoYet}
            />
          </>
        ) : activeTab === "perso" ? (
          <BibliothequeOuvrageTable
            L={L}
            mode="perso"
            groups={groupByFamily(myOuvrages)}
            companyHourlyRate={companyHourlyRate}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelected}
            onEdit={openEditModal}
            onDelete={removeOuvrage}
            isAdmin={isAdmin}
            showFamilyColumn
            emptyLabel={L.bibliotheque.noPersoYet}
          />
        ) : (
          <>
            {metierCoverage.missing.length > 0 ? (
              <div className="biblio-missing-banner">
                <span>{L.bibliotheque.missingMetiers(metierCoverage.missing.length)}</span>
                <div className="biblio-missing-list">
                  {metierCoverage.missing.map((metier) => (
                    <button type="button" key={metier.key} className="mini-button" onClick={() => openCreateModal(metier.label)}>
                      {metier.label} · {L.bibliotheque.completeBtn}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="library-family-grid">
              {familyStats.map((fam) => (
                <button
                  type="button"
                  key={fam.name}
                  className="library-family-card"
                  onClick={() => router.push(`/bibliotheque-ouvrages/${encodeURIComponent(fam.name)}`)}
                >
                  <div className="library-family-card-head">
                    <span className="library-family-icon">{fam.icon}</span>
                    <strong>{fam.count}</strong>
                  </div>
                  <strong className="library-family-name">{fam.name}</strong>
                  <small className="library-family-metier">{fam.subtitle}</small>
                  {fam.persoCount > 0 ? <span className="biblio-tab-badge perso biblio-family-perso-badge">+{fam.persoCount} perso</span> : null}
                </button>
              ))}
            </div>
          </>
        )}

        {selectedIds.length > 0 ? (
          <div className="library-selection-bar">
            <span>{L.bibliotheque.selected(selectedIds.length)}</span>
            {selectedKojiCount > 0 ? <button type="button" onClick={copySelectionToPerso}>{L.bibliotheque.copyToPerso}</button> : null}
            <button type="button" onClick={addSelectionToQuote}>{L.bibliotheque.addToQuote(selectedIds.length)}</button>
          </div>
        ) : null}
      </section>

      {importOpen ? (
        <div className="modal-overlay" onClick={() => setImportOpen(false)}>
          <div className="mini-modal" onClick={(event) => event.stopPropagation()}>
            <h2>{L.bibliotheque.importSpreadsheet}</h2>
            <p className="library-import-hint">
              Une ligne par ouvrage, colonnes séparées par une tabulation : code, désignation, famille, sous-famille, unité, temps (h/u), taux horaire (€/h), commentaire (optionnel).
            </p>
            <textarea className="library-import-textarea" value={importText} onChange={(event) => setImportText(event.target.value)} rows={8} />
            {importMessage ? <p className="library-message">{importMessage}</p> : null}
            <div>
              <button type="button" className="button secondary" onClick={() => setImportOpen(false)}>{L.bibliotheque.cancel}</button>
              <button type="button" className="button gold" onClick={importCatalog} disabled={importBusy}>
                {importBusy ? "…" : `Importer (${importText.split("\n").filter((l) => l.trim()).length})`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <BibliothequeTariffModal
        L={L}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={saveTariff}
        initial={modalInitial}
        defaultFamily={modalDefaultFamily}
        families={families}
        categoriesForFamily={categoriesForFamily}
        isAdmin={isAdmin}
        companyHourlyRate={companyHourlyRate}
      />
    </Shell>
  );
}
