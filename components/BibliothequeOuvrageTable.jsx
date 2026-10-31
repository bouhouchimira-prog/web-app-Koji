"use client";

import { useState } from "react";
import { formatHours, formatMoney, ouvragePriceHt } from "../lib/bibliotheque-pricing";

// Tableau partage par la page famille (2 onglets) et par l'onglet global
// "Mes prix perso" / les resultats de recherche de la page d'accueil
// (25 oct, refonte navigation par familles) — un seul composant, groupe
// par sous-famille (ou par famille quand showFamilyColumn est actif).
// DA Koji Pro (maquette PRO-08) : tableau .tbl sur ordinateur, cartes
// .m-card sur telephone.
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
  emptyLabel,
  title
}) {
  const [openMenuId, setOpenMenuId] = useState("");

  const visibleGroups = groups.filter((group) => group.items.length > 0);
  if (visibleGroups.length === 0) {
    return (
      <div className="tbl">
        {title ? <div className="bib-tt">{title}</div> : null}
        <p className="empty">{emptyLabel || L.bibliotheque.noFound}</p>
      </div>
    );
  }

  // Source (25 oct) : "IA" pour tout ouvrage koji, ou tout tarif perso issu
  // d'une copie (donnee de depart venant du catalogue IA, meme si le prix a
  // ete ajuste) ; "Moi" pour un tarif perso cree de zero par l'entreprise.
  function isIaSource(item) {
    return mode === "koji" || Boolean(item.copiedFromCode);
  }

  function subtitle(item) {
    if (mode === "koji") return item.category || "";
    if (item.billingMode === "fixed" && item.copiedFromCode) return L.bibliotheque.copiedFixedMode(item.copiedFromCode);
    if (item.billingMode === "fixed") return L.bibliotheque.forfaitPerso;
    if (item.copiedFromCode) return L.bibliotheque.copiedTimeMode(item.copiedFromCode);
    return item.category || "";
  }

  function figures(item) {
    const isForfait = item.billingMode === "fixed";
    return {
      isForfait,
      price: ouvragePriceHt(item, companyHourlyRate),
      laborCost: isForfait ? null : Math.max(0, Number(item.normativeTime || 0) * (Number(item.hourlyRate || 0) || companyHourlyRate)),
      showKojiRef: mode === "perso" && isForfait && item.copiedFromKojiPriceHt != null
    };
  }

  function actions(item) {
    if (mode !== "koji") {
      return (
        <>
          <button type="button" className="link" onClick={() => onEdit(item)}>{L.bibliotheque.modifyBtn}</button>
          <button type="button" className="dx" aria-label={`${L.common.delete} ${item.code}`} onClick={() => onDelete(item)}>×</button>
        </>
      );
    }
    return (
      <>
        <button type="button" className="link" onClick={() => onCopyToPerso(item)}>{L.bibliotheque.copyToPerso}</button>
        <span className="bib-more">
          <button type="button" className="dx" onClick={() => setOpenMenuId(openMenuId === item.id ? "" : item.id)} aria-label="Plus d'actions" aria-expanded={openMenuId === item.id}>···</button>
          {openMenuId === item.id ? (
            <span className="pop bib-pop">
              {isAdmin ? (
                <>
                  <button type="button" onClick={() => { setOpenMenuId(""); onEdit(item); }}>{L.bibliotheque.modifyBtn}</button>
                  <button type="button" onClick={() => { setOpenMenuId(""); onDelete(item); }}>{L.common.delete}</button>
                </>
              ) : (
                <button type="button" onClick={() => { setOpenMenuId(""); onHide(item); }}>{L.bibliotheque.hideBtn}</button>
              )}
            </span>
          ) : null}
        </span>
      </>
    );
  }

  const columns = 9 + (showFamilyColumn ? 1 : 0);

  return (
    <>
      <div className="tbl has-cards bib-tbl">
        {title ? <div className="bib-tt">{title}</div> : null}
        <table>
          <thead>
            <tr>
              <th aria-label="Sélection" />
              <th>Code</th>
              <th>Ouvrage</th>
              {showFamilyColumn ? <th>{L.bibliotheque.familyColumn}</th> : null}
              <th className="bib-md">{L.bibliotheque.colSource}</th>
              <th>{L.bibliotheque.colUnit}</th>
              <th className="r bib-sm">Temps</th>
              <th className="r bib-sm">MO / u</th>
              <th className="r bib-md">Fourn.</th>
              <th className="r">{L.bibliotheque.colPrice}</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {visibleGroups.map((group) => [
              group.title ? (
                <tr key={`g-${group.title}`} className="bib-grp">
                  <td colSpan={columns + 1}>{group.title}<span>{group.items.length}</span></td>
                </tr>
              ) : null,
              ...group.items.map((item) => {
                const selected = selectedIds.includes(item.id);
                const f = figures(item);
                return (
                  <tr key={item.id} className={selected ? "sel" : ""}>
                    <td className="bib-ck">
                      <input type="checkbox" checked={selected} onChange={() => onToggleSelect(item.id)} aria-label={`Sélectionner ${item.label}`} />
                    </td>
                    <td className="bib-code">{item.code}</td>
                    <td className="bib-lb">{item.label}{subtitle(item) ? <div className="sm">{subtitle(item)}</div> : null}</td>
                    {showFamilyColumn ? <td className="sm2">{item.family}</td> : null}
                    <td className="bib-md"><span className={`tag${isIaSource(item) ? " tag-o" : " tag-e"}`}>{isIaSource(item) ? L.bibliotheque.sourceIa : L.bibliotheque.sourceManual}</span></td>
                    <td>{item.unit}</td>
                    <td className="r bib-sm">{f.isForfait ? "—" : `${formatHours(item.normativeTime)} h`}</td>
                    <td className="r bib-sm">{f.isForfait ? "—" : formatMoney(f.laborCost)}</td>
                    <td className="r bib-md">{f.isForfait || item.suppliesCost == null ? "—" : formatMoney(item.suppliesCost)}</td>
                    <td className="r bib-price">
                      {formatMoney(f.price)}
                      {f.showKojiRef ? <div className="sm">{L.bibliotheque.kojiRefPrice(formatMoney(item.copiedFromKojiPriceHt))}</div> : null}
                    </td>
                    <td className="bib-act">{actions(item)}</td>
                  </tr>
                );
              })
            ])}
          </tbody>
        </table>
      </div>

      <div className="mlist">
        {title ? <div className="bib-tt">{title}</div> : null}
        {visibleGroups.map((group) => (
          <div className="bib-mgrp" key={group.title || "all"}>
            {group.title ? <div className="flab">{group.title} · {group.items.length}</div> : null}
            {group.items.map((item) => {
              const selected = selectedIds.includes(item.id);
              const f = figures(item);
              return (
                <div className={`m-card${selected ? " sel" : ""}`} key={item.id}>
                  <div className="top2">
                    <label className="chk bib-mck">
                      <input type="checkbox" checked={selected} onChange={() => onToggleSelect(item.id)} />
                      <span>
                        <span className="nm">{item.label}</span>
                        <span className="meta">{[item.code, subtitle(item), showFamilyColumn ? item.family : ""].filter(Boolean).join(" · ")}</span>
                      </span>
                    </label>
                    <span className={`tag${isIaSource(item) ? " tag-o" : " tag-e"}`}>{isIaSource(item) ? L.bibliotheque.sourceIa : L.bibliotheque.sourceManual}</span>
                  </div>
                  <div className="dvc-f">
                    <b>{formatMoney(f.price)} / {item.unit}</b>
                    <span className="meta">{f.isForfait ? "forfait" : `${formatHours(item.normativeTime)} h · MO ${formatMoney(f.laborCost)}`}</span>
                  </div>
                  <div className="bib-act">{actions(item)}</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
