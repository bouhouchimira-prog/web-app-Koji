"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet, apiSend } from "../lib/client-api";
import { fixText } from "../lib/text";
import { chiffresEncaissements, etatPaiement, lireReleveCsv, rapprocher, resteDu } from "../lib/encaissements";
import { creditsSur } from "./PaiementPanneau";
import { PaiementEnLigneEncaissements } from "./PaiementEnLigne";

// Onglet Encaissements de Factures (maquette PRO-06.3) : trois chiffres,
// état de paiement de chaque facture, rapprochement d'un relevé bancaire
// (Koji propose, l'entrepreneur confirme), paiement en ligne.
const euro = (n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n) || 0);
const court = (iso) => (iso ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(`${String(iso).slice(0, 10)}T12:00:00Z`)) : "");
const ETAT_TON = { "À encaisser": "", "En retard": "late", Payée: "ok", Annulée: "off", Brouillon: "off" };

function objet(f) {
  const t = fixText(f.type || "Facture");
  const court = /acompte/i.test(t) ? "Acompte" : /finale|solde/i.test(t) ? "Solde" : t;
  return [court, fixText(f.projectTitle || "")].filter(Boolean).join(" · ");
}

export function EncaissementsOnglet({ invoices = [], onMarquer, onVoir, onInvoicesChange }) {
  const aujourdhui = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  const credits = (f) => creditsSur(f, invoices);
  const c = useMemo(() => chiffresEncaissements(invoices, { aujourdhui, credits }), [invoices, aujourdhui]); // eslint-disable-line react-hooks/exhaustive-deps
  const mois = new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(new Date());
  const lignes = useMemo(() => {
    const dues = [];
    const autres = [];
    for (const f of invoices) {
      if (f.kind === "avoir" || f.archived || f.status === "Brouillon") continue;
      (f.status === "Emise" && resteDu(f, credits(f)) > 0.01 ? dues : autres).push(f);
    }
    dues.sort((a, b) => String(a.dueDate || "9").localeCompare(String(b.dueDate || "9")));
    autres.sort((a, b) => String(b.paidAt || b.updatedAt || "").localeCompare(String(a.paidAt || a.updatedAt || "")));
    return [...dues, ...autres];
  }, [invoices]); // eslint-disable-line react-hooks/exhaustive-deps

  const [releve, setReleve] = useState(null);
  const [propositions, setPropositions] = useState(null);
  const [traitement, setTraitement] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => { apiGet("/api/encaissements/releve").then((d) => setReleve(d.releve)).catch(() => {}); }, []);

  async function deposer(event) {
    const fichier = event.target.files?.[0];
    event.target.value = "";
    if (!fichier) return;
    setNote("");
    if (!/\.csv$/i.test(fichier.name) && fichier.type !== "text/csv") {
      setNote("Koji lit les relevés CSV : exportez le relevé au format CSV depuis votre banque.");
      return;
    }
    const { lignes: entrees, total } = lireReleveCsv(await fichier.text());
    if (!total) { setNote("Ce fichier ne ressemble pas à un relevé (colonnes date, libellé, montant attendues)."); return; }
    const r = rapprocher(entrees, invoices, credits).map((l, i) => ({ ...l, cle: i, choix: l.invoiceId, fait: false }));
    setPropositions({ total, lignes: r, dernierJour: entrees.map((e) => e.date).filter(Boolean).sort().pop() || "" });
  }

  async function confirmer(ligne) {
    if (!ligne.choix) return;
    setTraitement(String(ligne.cle));
    try {
      const { invoice } = await apiSend("/api/invoices", { id: ligne.choix, action: "payment", amount: ligne.montant, date: ligne.date || aujourdhui, moyen: "virement", reference: ligne.libelle }, "PATCH");
      onInvoicesChange?.(invoice);
      setPropositions((p) => ({ ...p, lignes: p.lignes.map((l) => (l.cle === ligne.cle ? { ...l, fait: true } : l)) }));
    } catch (e) {
      setNote(e.message || "Le paiement n'a pas pu être enregistré.");
    } finally {
      setTraitement("");
    }
  }

  async function terminer() {
    const faites = propositions.lignes.filter((l) => l.fait).length;
    const sansFacture = propositions.lignes.filter((l) => !l.fait).map(({ date, libelle, montant }) => ({ date, libelle, montant }));
    try {
      const d = await apiSend("/api/encaissements/releve", { dernierJour: propositions.dernierJour, lignes: propositions.total, rapprochees: faites, sansFacture });
      setReleve(d.releve);
    } catch { /* le résumé n'est qu'un repère */ }
    setPropositions(null);
  }

  const dues = invoices.filter((f) => f.kind !== "avoir" && f.status === "Emise" && resteDu(f, credits(f)) > 0.01);

  return (
    <>
      <div className="kpis enc-kpis">
        <div>
          <div className="l">Encaissé en {mois}</div>
          <div className="v">{euro(c.encaisseMois)}</div>
          <div className="s">{c.paiementsMois.length ? `${c.paiementsMois.length} paiement${c.paiementsMois.length > 1 ? "s" : ""}` : "aucun paiement"}</div>
        </div>
        <div>
          <div className="l">À encaisser</div>
          <div className="v">{euro(c.aEncaisser)}</div>
          <div className="s">{c.duesCount ? `${c.duesCount} facture${c.duesCount > 1 ? "s" : ""}${c.retardCount ? ` · ${c.retardCount} en retard` : ""}` : "rien en attente"}</div>
        </div>
        <div>
          <div className="l">Prochaine échéance</div>
          <div className="v">{c.prochaine ? court(c.prochaine.dueDate) : "—"}</div>
          <div className="s">{c.prochaine ? `${c.prochaine.invoiceNumber} · ${euro(resteDu(c.prochaine, credits(c.prochaine)))}` : "aucune"}</div>
        </div>
      </div>

      <div className="tbl">
        {lignes.length === 0 ? <div className="empty">Aucune facture envoyée pour l'instant.</div> : (
          <table>
            <thead><tr><th>Facture</th><th>Objet</th><th>Client</th><th className="r">TTC</th><th>Paiement</th><th>État</th><th aria-label="Action" /></tr></thead>
            <tbody>
              {lignes.map((f) => {
                const e = etatPaiement(f, { aujourdhui, avoirs: invoices.filter((a) => a.kind === "avoir" && a.refInvoiceId === f.id && a.status !== "Annulee" && Math.abs(Number(a.amountTtc) + Number(f.amountTtc)) < 0.01) });
                const due = e.etat === "À encaisser" || e.etat === "En retard";
                return (
                  <tr key={f.id}>
                    <td className="n">{f.invoiceNumber}</td>
                    <td>{objet(f)}</td>
                    <td>{fixText(f.client || "Client")}</td>
                    <td className="r">{euro(f.amountTtc)}</td>
                    <td className="sm2">{e.texte}</td>
                    <td><span className={`enc-etat ${ETAT_TON[e.etat] || ""}`}>{e.etat}</span></td>
                    <td className="r">{due ? <button type="button" className="btn btn-sec" onClick={() => onMarquer(f)}>Marquer payée</button> : <button type="button" className="btn btn-sec" onClick={() => onVoir(f)}>Voir</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="enc-grid">
        <section className="card">
          <div className="card-h"><h2>Rapprochement</h2></div>
          <p className="sm2">Relevé bancaire CSV de votre banque · Koji retrouve les factures par montant et référence.</p>
          {releve ? (
            <p className="sm2"><b>Dernier relevé {court(releve.dernierJour)}</b> · {releve.lignes} ligne{releve.lignes > 1 ? "s" : ""} · {releve.rapprochees} rapprochée{releve.rapprochees > 1 ? "s" : ""}</p>
          ) : null}
          {releve?.sansFacture?.length && !propositions ? (
            <div className="avk"><div><strong>{releve.sansFacture.length} virement{releve.sansFacture.length > 1 ? "s" : ""} sans facture</strong><small>{releve.sansFacture.slice(0, 3).map((l) => `${euro(l.montant)} · « ${l.libelle} »`).join(" ; ")} · à rattacher en déposant à nouveau le relevé</small></div></div>
          ) : null}
          {propositions ? (
            <div className="enc-props">
              {propositions.lignes.length === 0 ? <p className="sm2">Aucune entrée d'argent dans ce relevé.</p> : propositions.lignes.map((l) => (
                <div className="enc-prop" key={l.cle}>
                  <div><strong>{euro(l.montant)}</strong><small>{court(l.date)} · « {l.libelle} »</small></div>
                  {l.fait ? <span className="enc-etat ok">Rapprochée</span> : (
                    <>
                      <select value={l.choix} aria-label={`Facture pour ${l.libelle}`} onChange={(e) => setPropositions((p) => ({ ...p, lignes: p.lignes.map((x) => (x.cle === l.cle ? { ...x, choix: e.target.value } : x)) }))}>
                        <option value="">{l.invoiceId ? "Aucune" : "Sans facture · à rattacher"}</option>
                        {dues.map((f) => <option key={f.id} value={f.id}>{f.invoiceNumber} · {fixText(f.client || "")} · {euro(resteDu(f, credits(f)))}</option>)}
                      </select>
                      <button type="button" className="btn btn-main" disabled={!l.choix || traitement === String(l.cle)} onClick={() => confirmer(l)}>{traitement === String(l.cle) ? "…" : "Confirmer"}</button>
                    </>
                  )}
                </div>
              ))}
              <button type="button" className="btn btn-sec" onClick={terminer}>Terminer</button>
            </div>
          ) : (
            <label className="btn btn-sec enc-depot">Déposer un relevé<input type="file" accept=".csv,text/csv" onChange={deposer} hidden /></label>
          )}
          {note ? <p className="notice" role="status">{note}</p> : null}
          <p className="sm2">Koji n'est pas relié à votre banque : vous déposez le relevé, il propose, vous confirmez.</p>
        </section>
        <PaiementEnLigneEncaissements />
      </div>
    </>
  );
}
