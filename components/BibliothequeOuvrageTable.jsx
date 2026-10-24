"use client";

import { useState } from "react";
import { formatHours, formatMoney, ouvragePriceHt } from "../lib/bibliotheque-pricing";

// Tableau partage par la page famille (2 onglets) et par l'onglet global
// "Mes prix perso" / les resultats de recherche de la page d'accueil
// (25 oct, refonte navigation par familles) — un seul composant, groupe
// par sous-famille (ou par famille quand showFamilyColumn est actif).
export function BibliothequeOuvrageTable({
  L,
  groups,
  mode, // "koji" | "perso"
  companyHourlyRate,
  selectedIds,
  onToggleSelect,
  onCopyToPerso,
  onEdit,
  onDelete,
  onHide,
  isAdmin,
  showFamilyColumn = false,
  emptyLabel
}) {
  const [openMenuId, setOpenMenuId] = useState("");

  const hasAnyItem = groups.some((group) => group.items.length > 0);
  if (!hasAnyItem) {
    return <div className="tool-empty">{emptyLabel || L.bibliotheque.noFound}</div>;
  }

  // Source (25 oct) : "IA" pour tout ouvrage koji, ou tout tarif perso issu
  // d'une copie (donnee de depart venant du catalogue IA, meme si le prix a
  // ete ajuste) ; "Moi" pour un tarif perso cree de zero par l'entreprise.
  function source(item) {
    if (mode === "koji" || item.copiedFromCode) return L.bibliotheque.sourceIa;
    return L.bibliotheque.sourceManual;
  }

  function subtitle(item) {
    if (mode === "koji") return item.category || "";
    if (item.billingMode === "fixed" && item.copiedFromCode) return L.bibliotheque.copiedFixedMode(item.copiedFromCode);
    if (item.billingMode === "fixed") return L.bibliotheque.forfaitPerso;
    if (item.copiedFromCode) return L.bibliotheque.copiedTimeMode(item.copiedFromCode);
    return item.category || "";
  }

  return (
    <div className="biblio-table">
      <div className="biblio-table-head">
        <span className="biblio-col-check" />
        <span className="biblio-col-code">{L.bibliotheque.colCode}</span>
        {showFamilyColumn ? <span className="biblio-col-family">{L.bibliotheque.familyColumn}</span> : null}
        <span className="biblio-col-source">{L.bibliotheque.colSource}</span>
        <span className="biblio-col-unit">{L.bibliotheque.colUnit}</span>
        <span className="biblio-col-num">{L.bibliotheque.colTime}</span>
        <span className="biblio-col-num">{L.bibliotheque.colLabor}</span>
        <span className="biblio-col-num">{L.bibliotheque.colSupplies}</span>
        <span className="biblio-col-num">{L.bibliotheque.colPrice}</span>
        <span className="biblio-col-actions" />
      </div>

      {groups.filter((group) => group.items.length > 0).map((group) => (
        <div key={group.title}>
          {group.title ? (
            <div className="biblio-group-head">
              <span>{group.title}</span>
              <span className="biblio-group-count">{group.items.length}</span>
            </div>
          ) : null}
          {group.items.map((item) => {
            const selected = selectedIds.includes(item.id);
            const isForfait = item.billingMode === "fixed";
            const price = ouvragePriceHt(item, companyHourlyRate);
            const laborCost = isForfait ? null : Math.max(0, Number(item.normativeTime || 0) * (Number(item.hourlyRate || 0) || companyHourlyRate));
            const showKojiRef = mode === "perso" && isForfait && item.copiedFromKojiPriceHt != null;
            return (
              <div className={`biblio-row${mode === "perso" ? " biblio-row-perso" : ""}`} key={item.id}>
                <button
                  type="button"
                  className={`biblio-checkbox${selected ? " checked" : ""}`}
                  aria-pressed={selected}
                  aria-label={item.label}
                  onClick={() => onToggleSelect(item.id)}
                >
                  {selected ? "✓" : ""}
                </button>
                <div className="biblio-col-code">
                  <span className={`biblio-code-badge${mode === "perso" ? " perso" : ""}`}>{item.code}</span>
                  <div className="biblio-code-text">
                    <div className="biblio-label">{item.label}</div>
                    <div className="biblio-subtitle">{subtitle(item)}</div>
                  </div>
                </div>
                {showFamilyColumn ? <span className="biblio-col-family">{item.family}</span> : null}
                <span className="biblio-col-source">{source(item)}</span>
                <span className="biblio-col-unit">{item.unit}</span>
                <span className="biblio-col-num">{isForfait ? "—" : `${formatHours(item.normativeTime)} h`}</span>
                <span className="biblio-col-num">{isForfait ? "—" : formatMoney(laborCost)}</span>
                <span className="biblio-col-num">{isForfait || item.suppliesCost == null ? "—" : formatMoney(item.suppliesCost)}</span>
                <span className="biblio-col-num biblio-price">
                  {formatMoney(price)}
                  {showKojiRef ? <small className="biblio-price-ref">{L.bibliotheque.kojiRefPrice(formatMoney(item.copiedFromKojiPriceHt))}</small> : null}
                </span>
                <div className="biblio-col-actions">
                  {mode === "koji" ? (
                    <>
                      <button type="button" className="mini-button" onClick={() => onCopyToPerso(item)}>{L.bibliotheque.copyToPerso}</button>
                      <div className="biblio-menu-wrap">
                        <button type="button" className="biblio-menu-btn" onClick={() => setOpenMenuId(openMenuId === item.id ? "" : item.id)} aria-label="Plus d'actions">···</button>
                        {openMenuId === item.id ? (
                          <div className="biblio-menu">
                            {isAdmin ? (
                              <>
                                <button type="button" onClick={() => { setOpenMenuId(""); onEdit(item); }}>{L.bibliotheque.modifyBtn}</button>
                                <button type="button" className="danger" onClick={() => { setOpenMenuId(""); onDelete(item); }}>{L.common.delete}</button>
                              </>
                            ) : (
                              <button type="button" onClick={() => { setOpenMenuId(""); onHide(item); }}>{L.bibliotheque.hideBtn}</button>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <>
                      <button type="button" className="mini-button" onClick={() => onEdit(item)}>{L.bibliotheque.modifyBtn}</button>
                      <button type="button" className="mini-danger" aria-label={L.common.delete} onClick={() => onDelete(item)}>✕</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
