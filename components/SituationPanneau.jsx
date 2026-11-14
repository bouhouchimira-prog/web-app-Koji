"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet, apiSend } from "../lib/client-api";
import { computeQuoteItem } from "../lib/quote-calculations";
import { avancementLot, calculerSituation, echeance, messageSituation } from "../lib/situation-travaux";

// Situation de travaux depuis la fiche du chantier (maquette PRO-06) :
// avancement cumulé par lot, prérempli depuis le suivi des lots ; Koji
// déduit le déjà facturé et la retenue de garantie. Le site recalcule tout
// à l'enregistrement, depuis le devis signé.
const euro = (n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n) || 0).replace(/ | /g, " ");
const jour = (iso) => (iso ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(`${iso.slice(0, 10)}T12:00:00Z`)) : "");
const Coche = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>;
const ECHEANCES = [[0, "À réception"], [15, "15 jours"], [30, "30 jours"], [45, "45 jours"]];

export function SituationPanneau({ quote, project, taches = [], factures = [], finPrevue = "", debut = "", onClose, onDone }) {
  const [avenantsHt, setAvenantsHt] = useState(0);
  const tva = Number(quote?.vatRate ?? 20);
  const lotsDevis = useMemo(() => {
    const par = new Map();
    for (const item of quote?.items || []) {
      const lot = item.room || "Travaux";
      par.set(lot, (par.get(lot) || 0) + Number(computeQuoteItem(item, quote).totalHt || 0));
    }
    if (avenantsHt) par.set("Avenants signés", avenantsHt);
    return [...par].map(([nom, ht]) => ({ nom, ht: Math.round(ht * 100) / 100 }));
  }, [quote, avenantsHt]);
  const precedentes = factures.filter((f) => f.quoteId === quote?.id && f.kind !== "avoir" && ["Brouillon", "Emise", "Payee"].includes(f.status) && !f.archived);
  const dejaFactureHt = Math.round((precedentes.reduce((s, f) => s + Number(f.amountTtc || 0), 0) / (1 + tva / 100)) * 100) / 100;
  const numero = precedentes.filter((f) => f.situation).length + 1;

  const [pcts, setPcts] = useState({});
  const [retenue, setRetenue] = useState(false);
  const [delai, setDelai] = useState(30);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(Boolean(quote?.clientEmail));
  const [envoi, setEnvoi] = useState("");
  const [erreur, setErreur] = useState("");
  const [fait, setFait] = useState(null);

  useEffect(() => {
    if (quote?.id) apiGet(`/api/avenants?quoteId=${quote.id}`).then((d) => setAvenantsHt((d.avenants || []).filter((a) => a.status === "Signe").reduce((s, a) => s + Number(a.totalHtDelta || 0), 0))).catch(() => {});
  }, [quote?.id]);
  useEffect(() => {
    setPcts((p) => Object.fromEntries(lotsDevis.map((l) => [l.nom, p[l.nom] ?? avancementLot(l.nom, taches)])));
  }, [lotsDevis, taches]);

  const sit = calculerSituation({ lots: lotsDevis.map((l) => ({ ...l, pct: pcts[l.nom] ?? 0 })), dejaFactureHt, tauxRetenue: retenue ? 5 : 0, tauxTva: tva });
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const echue = echeance(aujourdhui, delai);
  useEffect(() => {
    if (!Object.keys(pcts).length) return;
    setMessage((m) => m || messageSituation({ client: quote?.client, lignes: sit.lignes, numero, finPrevue }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lotsDevis.length, Object.keys(pcts).length]);
  const premiere = precedentes[0];

  async function valider(envoyer) {
    setEnvoi(envoyer ? "envoi" : "brouillon");
    setErreur("");
    try {
      const { invoice } = await apiSend("/api/invoices", {
        quoteId: quote.id, projectId: project.id, amountMode: "situation",
        lots: lotsDevis.map((l) => ({ nom: l.nom, pct: pcts[l.nom] ?? 0 })), tauxRetenue: retenue ? 5 : 0,
        periodeDu: debut && debut.slice(0, 10) < aujourdhui ? debut : "", periodeAu: aujourdhui, dueDate: echue, notes: message, message
      });
      let final = invoice;
      if (envoyer) final = (await apiSend("/api/invoices", { id: invoice.id, action: "send", email, to: quote.clientEmail || "", message }, "PATCH")).invoice || invoice;
      setFait(final);
      onDone?.(final);
    } catch (e) {
      setErreur(e.message || "La situation n'a pas pu être enregistrée.");
    } finally {
      setEnvoi("");
    }
  }

  return (
    <>
      <div className="env-scrim" onClick={envoi ? undefined : onClose} />
      <section className="env-panel wide" role="dialog" aria-modal="true" aria-label="Situation de travaux">
        <div className="env-h"><h2>Situation de travaux</h2><button type="button" className="link" onClick={onClose}>Fermer</button></div>
        {fait ? (
          <div className="avk"><div>
            <strong>Situation n° {numero} {fait.status === "Emise" ? "envoyée" : "enregistrée en brouillon"} · {fait.invoiceNumber}</strong>
            <small>{euro(fait.amountTtc)} TTC · échéance {jour(fait.dueDate)}</small>
          </div></div>
        ) : (
          <>
            <div className="env-sum">
              <div><span className="lab">Chantier</span><strong>{project?.title || quote.project}</strong><span className="muted">{[quote.client, `devis ${quote.quoteNumber}`, `${euro(quote.totalHt)} HT`].filter(Boolean).join(" · ")}</span></div>
              <div><span className="lab">Situation n° {numero}</span><strong>{debut && debut.slice(0, 10) < aujourdhui ? `Période ${jour(debut)} → ${jour(aujourdhui)}` : `Au ${jour(aujourdhui)}`}</strong><span className="muted">numéro attribué à l'enregistrement</span></div>
            </div>
            <div className="lots">
              <div className="lots-h"><span className="lab">Avancement cumulé par lot</span><span className="sm2">Koji pré-remplit depuis le suivi des lots</span></div>
              {sit.lignes.map((l, i) => (
                <div className="avr" key={l.nom} style={{ gridTemplateColumns: "1fr 90px 110px" }}>
                  <div className="avt"><strong>{l.nom === "Avenants signés" ? l.nom : `Lot ${String(i + 1).padStart(2, "0")} · ${l.nom}`}</strong><small>{euro(l.ht)} au devis</small></div>
                  <label className="sm2" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <input type="number" min="0" max="100" step="5" value={pcts[l.nom] ?? 0} aria-label={`Avancement ${l.nom}`} onChange={(e) => setPcts((p) => ({ ...p, [l.nom]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }))} style={{ width: 60 }} /> %
                  </label>
                  <span className="ava">{euro(l.montant)}</span>
                </div>
              ))}
            </div>
            <div className="ac-amt">
              <div><span>Travaux réalisés cumulés HT</span><b>{euro(sit.cumuleHt)}</b></div>
              <div><span>Déjà facturé{premiere ? ` · ${(premiere.type || "").toLowerCase().includes("acompte") ? "acompte " : ""}${premiere.invoiceNumber}${precedentes.length > 1 ? ` + ${precedentes.length - 1}` : ""}` : ""}</span><b>− {euro(sit.dejaFactureHt)} HT</b></div>
              <div>
                <span><label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={retenue} onChange={(e) => setRetenue(e.target.checked)} /> Retenue de garantie 5 %</label></span>
                <b>{retenue ? `− ${euro(sit.retenueHt)}` : "—"}</b>
              </div>
              <div className="big"><span>Montant de la situation</span><b>{euro(sit.ttc)} TTC</b><small>{euro(sit.ht)} HT · TVA {String(tva).replace(".", ",")} % {euro(sit.tva)}</small></div>
            </div>
            <div className="env-sum">
              <div>
                <span className="lab">Échéance</span>
                <select value={delai} onChange={(e) => setDelai(Number(e.target.value))} aria-label="Échéance">{ECHEANCES.map(([j, l]) => <option key={j} value={j}>{l}</option>)}</select>
                <span className="muted">{jour(echue)}</span>
              </div>
              <div><span className="lab">Règlement</span><strong>Virement</strong><span className="muted">coordonnées bancaires sur la facture</span></div>
            </div>
            <div className="env-ch"><span className="lab">Message au client</span><textarea className="rd-ta" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} /></div>
            <div className="env-ch">
              <span className="lab">Envoi</span>
              <button type="button" className={`ck${email ? " on" : ""}`} aria-pressed={email} disabled={!quote.clientEmail} onClick={() => setEmail((v) => !v)}><Coche />E-mail avec le PDF{quote.clientEmail ? "" : " (pas d'e-mail sur le devis)"}</button>
            </div>
            {erreur ? <p className="err" role="alert">{erreur}</p> : null}
            <div className="env-act">
              <button type="button" className="btn btn-sec" onClick={() => valider(false)} disabled={Boolean(envoi) || sit.ht <= 0}>{envoi === "brouillon" ? "Enregistrement…" : "Enregistrer en brouillon"}</button>
              <button type="button" className="btn btn-main" onClick={() => valider(true)} disabled={Boolean(envoi) || sit.ht <= 0}>{envoi === "envoi" ? "Envoi…" : "Envoyer la situation"}</button>
            </div>
            {sit.ht <= 0 ? <p className="sm2">L'avancement ne dépasse pas encore ce qui est déjà facturé.</p> : null}
          </>
        )}
      </section>
    </>
  );
}
