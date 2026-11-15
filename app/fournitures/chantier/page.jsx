"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Shell } from "../../../components/Shell";
import { apiGet, apiSend } from "../../../lib/client-api";
import { arrondiConditionnement, nombre, r2 } from "../../../lib/fournitures-pro";
import { FournituresTabs } from "../FournituresTabs";
import { Coche, aujourdhui, euro, jour, jourLong, nb, qte } from "../commun";
import { ClotureReste } from "../StockOnglet";
import "../fournitures.css";

// Fournitures du chantier (maquette PRO-07.1) : la liste découle des lignes
// du devis et des avenants signés, rangée par fournisseur ; « Préparer les
// commandes » prend d'abord le stock (PRO-07.4) puis crée un bon par
// fournisseur (PRO-07.6).
const paquetsTexte = (l) => (l.contenance && l.contenance !== 1 && !l.venteUnite ? `${l.paquets} ${l.uniteCond || "conditionnement"}${l.paquets > 1 && !/s$/.test(l.uniteCond || "") ? "s" : ""} · ${qte(l.quantiteCommande, l.unit)}` : qte(l.quantiteCommande, l.unit));

function Preparer({ chantier, stock, business, filtre, onClose }) {
  const router = useRouter();
  const lignesBase = chantier.besoins.filter((b) => !b.manques.length && b.reste > 0 && (!filtre || b.supplierId === filtre || b.supplierName === filtre));
  const [choix, setChoix] = useState(() => Object.fromEntries(lignesBase.map((b) => [b.cle, true])));
  const [prisStock, setPrisStock] = useState(() => Object.fromEntries((stock || []).map((s) => [s.cle, s.coche])));
  const [livraisonLe, setLivraisonLe] = useState(chantier.quote?.startDate && chantier.quote.startDate >= aujourdhui() ? chantier.quote.startDate : "");
  const [livraisonHeure, setLivraisonHeure] = useState("10 h");
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState("");

  const lignes = lignesBase.map((b) => {
    const s = (stock || []).find((x) => x.cle === b.cle);
    const pris = s && prisStock[b.cle] ? Math.min(s.utiliser, b.reste) : 0;
    const besoin = r2(Math.max(0, b.reste - pris));
    const arr = arrondiConditionnement(besoin, b.contenance, b.venteUnite);
    return { ...b, stock: s, pris, besoin, paquets: arr.paquets, quantiteCommande: arr.quantite, totalCommande: r2(arr.quantite * b.prixHt), prisHt: r2(pris * b.prixHt) };
  });
  const retenues = lignes.filter((l) => choix[l.cle]);
  const totalDevis = r2(retenues.reduce((s, l) => s + l.reste * l.prixHt, 0));
  const prisHt = r2(retenues.reduce((s, l) => s + l.prisHt, 0));
  const aCommander = r2(retenues.filter((l) => l.quantiteCommande > 0).reduce((s, l) => s + l.totalCommande, 0));

  async function creer(sansStock) {
    setBusy(true);
    setErreur("");
    const effectives = retenues.map((l) => (sansStock ? { ...l, pris: 0, quantiteCommande: arrondiConditionnement(l.reste, l.contenance, l.venteUnite).quantite, paquets: arrondiConditionnement(l.reste, l.contenance, l.venteUnite).paquets, besoin: l.reste } : l));
    const stockPris = sansStock ? [] : effectives.filter((l) => l.pris > 0).flatMap((l) => {
      let reste = l.pris;
      return (l.stock?.ids || []).map((s) => { const q = Math.min(reste, s.quantite); reste = r2(reste - q); return { id: s.id, quantite: q }; }).filter((s) => s.quantite > 0);
    });
    try {
      const { bons } = await apiSend("/api/fournitures/bons", {
        projectId: chantier.projectId,
        livraisonLe,
        livraisonHeure,
        livraisonAdresse: chantier.address,
        stock: stockPris,
        lignes: effectives.filter((l) => l.quantiteCommande > 0).map((l) => ({
          articleId: l.articleId, name: l.name, ref: l.ref, unit: l.unit, quantite: l.quantiteCommande, quantiteBesoin: l.besoin + l.pris,
          paquets: l.paquets, uniteCond: l.uniteCond, contenance: l.contenance, prixHt: l.prixHt, venteHt: l.vente, lot: l.lots[0], supplierId: l.supplierId
        }))
      });
      router.push(`/fournitures?tab=bons${bons.length === 1 ? `&bon=${bons[0].id}` : ""}`);
    } catch (e) { setErreur(e.message); setBusy(false); }
  }

  return (
    <>
      <div className="env-scrim" onClick={busy ? undefined : onClose} />
      <section className="env-panel wide" role="dialog" aria-modal="true" aria-label="Préparer les commandes">
        <div className="env-h"><h2>Préparer les commandes · {chantier.title}</h2><button type="button" className="link" onClick={onClose}>Fermer</button></div>
        {business && stock?.length ? (
          <div className="ob-sec">
            <div className="lab">Utiliser ton stock avant de commander</div>
            <p className="fx-note">Koji a trouvé {stock.length} article{stock.length > 1 ? "s" : ""} du devis dans ton stock. Coche ceux à utiliser : seul le reste sera commandé.</p>
            {lignes.filter((l) => l.stock).map((l) => (
              <div className="fx-row" key={l.cle}>
                <button type="button" className={`ck${prisStock[l.cle] ? " on" : ""}`} aria-pressed={Boolean(prisStock[l.cle])} onClick={() => setPrisStock((p) => ({ ...p, [l.cle]: !p[l.cle] }))}><Coche />{l.name}</button>
                <span className="t"><small>besoin {qte(l.reste, l.unit)} · en stock {qte(l.stock.enStock, l.unit)} ({(l.stock.lieux || []).join(", ").toLowerCase()}){l.stock.teinte ? " · lot de teinte à vérifier" : ""}</small></span>
                <b>commande : {paquetsTexte(l)}</b>
              </div>
            ))}
          </div>
        ) : null}
        <div className="ob-sec">
          <div className="lab">À commander · Koji a regroupé par fournisseur</div>
          {lignes.length === 0 ? <p className="fx-note">Tout est déjà commandé.</p> : lignes.map((l) => (
            <div className="fx-row" key={l.cle}>
              <button type="button" className={`ck${choix[l.cle] ? " on" : ""}`} aria-pressed={Boolean(choix[l.cle])} onClick={() => setChoix((c) => ({ ...c, [l.cle]: !c[l.cle] }))}><Coche />{l.name}</button>
              <span className="t"><small>{l.supplierName} · {l.lots.join(", ")}{l.dejaCommande ? ` · déjà commandé ${qte(l.dejaCommande, l.unit)}` : ""}</small></span>
              <b>{l.quantiteCommande > 0 ? `${paquetsTexte(l)} · ${euro(l.totalCommande)}` : "pris dans le stock"}</b>
            </div>
          ))}
        </div>
        <div className="fx-grid2">
          <label className="ed">Livraison sur chantier · le<input type="date" min={aujourdhui()} value={livraisonLe} onChange={(e) => setLivraisonLe(e.target.value)} /></label>
          <label className="ed">Avant<input value={livraisonHeure} onChange={(e) => setLivraisonHeure(e.target.value)} placeholder="10 h" /></label>
        </div>
        <div className="ac-amt">
          <div><span>Fournitures du devis, prix d'achat</span><b>{euro(totalDevis)}</b></div>
          {prisHt > 0 ? <div><span>Pris dans le stock</span><b>− {euro(prisHt)}</b></div> : null}
          <div><span>À commander</span><b>{euro(aCommander)} HT</b></div>
        </div>
        <p className="fx-note">le client paie les fournitures au prix du devis, stock compris. Les bons sont créés en brouillon : rien ne part au fournisseur avant votre envoi.</p>
        {erreur ? <p className="err" role="alert">{erreur}</p> : null}
        <div className="env-act">
          {prisHt > 0 ? <button type="button" className="btn btn-sec" disabled={busy || !retenues.length} onClick={() => creer(true)}>Tout commander</button> : <button type="button" className="btn btn-sec" onClick={onClose} disabled={busy}>Annuler</button>}
          <button type="button" className="btn btn-main" disabled={busy || !retenues.some((l) => l.quantiteCommande > 0)} onClick={() => creer(false)}>{busy ? "…" : "Continuer vers les bons de commande"}</button>
        </div>
      </section>
    </>
  );
}

function FournituresChantier() {
  const params = useSearchParams();
  const projet = params.get("projet") || "";
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState("");
  const [preparer, setPreparer] = useState(null);
  const [cloture, setCloture] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!projet) { setErreur("Chantier manquant."); return; }
    apiGet(`/api/fournitures/chantier?projet=${encodeURIComponent(projet)}`).then(setData).catch((e) => setErreur(e.message));
  }, [projet]);

  const c = data?.chantier;
  const enCours = useMemo(() => (c?.bons || []).filter((b) => b.etat === "envoye" || b.etat === "partiel" || b.etat === "livre"), [c]);

  function exporter() {
    const lignes = [["Fournisseur", "Article", "Référence", "Lot", "Quantité", "Unité", "Prix achat HT", "Total HT"]];
    for (const g of c.ranges.fournisseurs) for (const l of g.lignes) lignes.push([g.supplierName, l.name, l.ref, l.lots.join(" / "), String(l.quantite).replace(".", ","), l.unit, String(l.prixHt).replace(".", ","), String(l.totalHt).replace(".", ",")]);
    for (const l of c.ranges.aCompleter) lignes.push(["À compléter", l.name, l.ref, l.lots.join(" / "), String(l.quantite).replace(".", ","), l.unit, "", ""]);
    const csv = lignes.map((r) => r.map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `Fournitures_${(c.title || "chantier").replace(/[^A-Za-z0-9]+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow"><Link className="link" href="/chantiers">Chantiers</Link>{c ? ` · ${c.title}${c.quote?.numero ? ` · devis ${c.quote.numero}` : ""}${c.avenantsSignes?.length ? ` + avenant${c.avenantsSignes.length > 1 ? "s" : ""} n° ${c.avenantsSignes.join(", ")}` : ""}` : ""}</span>
          <h1>Fournitures du chantier</h1>
        </div>
        <div className="hact">
          {data?.business && c?.bons?.some((b) => b.etat === "livre" || b.etat === "partiel") ? <button type="button" className="btn btn-sec" onClick={() => setCloture(true)}>Ce qui reste</button> : null}
          <button type="button" className="btn btn-sec" disabled={!c?.besoins?.length} onClick={exporter}>Exporter la liste</button>
          <button type="button" className="btn btn-main" disabled={!c || !c.besoins.some((b) => !b.manques.length && b.reste > 0)} onClick={() => setPreparer({ filtre: "" })}>Préparer les commandes</button>
        </div>
      </div>
      <FournituresTabs current="chantiers" />
      {message ? <p className="notice" role="status">{message}</p> : null}
      {erreur ? <p className="err" role="alert">{erreur}</p> : null}
      {!c ? (!erreur ? <p className="muted">Chargement…</p> : null) : !c.quote ? (
        <div className="empty">Ce chantier n'a pas encore de devis : la liste des fournitures se calcule depuis ses lignes.</div>
      ) : (
        <>
          <div className="kp-seg" role="group" aria-label="État de la liste">
            <button type="button" className={!c.quote.signe ? "on" : ""} aria-pressed={!c.quote.signe} disabled>Estimation · devis non signé</button>
            <button type="button" className={c.quote.signe ? "on" : ""} aria-pressed={c.quote.signe} disabled>Définitive · devis signé{c.quote.signeLe ? ` le ${jour(c.quote.signeLe)}` : ""}</button>
          </div>
          <p className="fx-note">Quantités calculées depuis les lignes du devis{c.avenantsSignes?.length ? " et des avenants" : ""}, pertes incluses.{c.quote.startDate ? ` Livraison souhaitée avant le ${jour(c.quote.startDate)}.` : ""}</p>

          <div className="kpis">
            <div><div className="l">Total achat HT</div><div className="v">{euro(c.ranges.totalHt)}</div><div className="s">{c.ranges.fournisseurs.length} fournisseur{c.ranges.fournisseurs.length > 1 ? "s" : ""} · {c.ranges.articles} article{c.ranges.articles > 1 ? "s" : ""}</div></div>
            <div><div className="l">À compléter</div><div className="v">{c.ranges.aCompleter.length}</div><div className="s">fournisseur ou prix manquant</div></div>
            <div><div className="l">Commandé</div><div className="v">{enCours.length}</div><div className="s">{enCours.length ? enCours.map((b) => b.numero).join(", ") : "aucun bon envoyé"}</div></div>
            <div><div className="l">Livraison</div><div className="v">{c.quote.startDate ? jour(c.quote.startDate) : "—"}</div><div className="s">démarrage du chantier</div></div>
          </div>

          {c.ranges.aCompleter.length ? (
            <section className="card">
              <div className="card-h"><h2>À compléter avant commande</h2></div>
              <p className="fx-note">Ces articles ne sortent pas sur les bons tant qu'ils n'ont ni fournisseur ni prix.</p>
              {c.ranges.aCompleter.map((l) => (
                <div className="fx-row" key={l.cle}>
                  <span className="t"><b>{l.name}</b><small>{l.lots.join(", ")} · {l.manques.includes("fournisseur") && l.manques.includes("prix") ? "Prix et fournisseur manquants" : l.manques.includes("fournisseur") ? "Fournisseur à choisir" : "Prix manquant"}</small></span>
                  <span>{qte(l.quantite, l.unit)}</span>
                  <span>{l.prixHt > 0 ? euro(l.prixHt) : "—"}</span>
                  <Link className="link" href={l.articleId ? `/fournitures/nouveau?id=${l.articleId}` : `/fournitures/nouveau?nom=${encodeURIComponent(l.name)}`}>Compléter</Link>
                </div>
              ))}
            </section>
          ) : null}

          {c.ranges.fournisseurs.length === 0 && !c.ranges.aCompleter.length ? (
            <div className="empty">Aucune fourniture au devis. Ajoutez des fournitures aux lignes du devis ou liez des articles aux ouvrages (Nouvel article › Ouvrages liés).</div>
          ) : null}

          {c.ranges.fournisseurs.map((g) => (
            <section className="card fx-grp" key={g.supplierId || g.supplierName}>
              <div className="fx-grp-h">
                <div><h3>{g.supplierName}</h3><small>{g.lignes.length} article{g.lignes.length > 1 ? "s" : ""}</small></div>
                <div className="r"><b>{euro(g.totalHt)} HT</b><button type="button" className="btn btn-sec" disabled={!g.lignes.some((l) => l.reste > 0)} onClick={() => setPreparer({ filtre: g.supplierId || g.supplierName })}>Bon de commande</button></div>
              </div>
              <div className="tbl">
                <table>
                  <tbody>
                    {g.lignes.map((l) => (
                      <tr key={l.cle}>
                        <td><div className="n2">{l.name}</div><div className="sm">{[l.ref, l.lots.join(", "), l.detail, l.avenant ? `avenant${c.avenantsSignes?.length ? ` n° ${c.avenantsSignes.join(", ")}` : ""} inclus` : ""].filter(Boolean).join(" · ")}</div></td>
                        <td className="r">{qte(l.quantite, l.unit)}{l.dejaCommande ? <div className="sm">commandé {nb(l.dejaCommande)}</div> : null}</td>
                        <td className="r sm2">{euro(l.prixHt)}</td>
                        <td className="r b">{euro(l.totalHt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}

          {c.bons?.length ? (
            <section className="card">
              <div className="card-h"><h2>Bons de ce chantier</h2></div>
              {c.bons.map((b) => (
                <Link className="fx-row" key={b.id} href={`/fournitures?tab=bons&bon=${b.id}`}>
                  <span className="t"><b>{b.numero}</b><small>{b.supplierName}{b.livraisonLe ? ` · livraison ${jourLong(b.livraisonLe)}` : ""}</small></span>
                  <span className="fx-etat">{{ brouillon: "Brouillon", envoye: "Envoyé", partiel: "Livré en partie", livre: "Livré" }[b.etat] || b.etat}</span>
                </Link>
              ))}
            </section>
          ) : null}
        </>
      )}
      {cloture && c ? <ClotureReste projectId={c.projectId} onClose={() => setCloture(false)} onDone={(m) => { setCloture(false); setMessage(m); }} /> : null}
      {preparer && c ? <Preparer chantier={c} stock={data.stock} business={data.business} filtre={preparer.filtre} onClose={() => setPreparer(null)} /> : null}
    </Shell>
  );
}

export default function Page() {
  return <Suspense fallback={null}><FournituresChantier /></Suspense>;
}
