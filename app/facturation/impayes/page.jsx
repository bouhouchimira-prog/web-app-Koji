"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Shell } from "../../../components/Shell";
import { apiGet, apiSend, readStoredUser } from "../../../lib/client-api";
import { useApi } from "../../../lib/use-api";
import { fixText } from "../../../lib/text";
import { PALIERS, actionImpaye, aujourdhuiParis, etapeRelance, joursRetard, resumeImpayes, texteRelance } from "../../../lib/relances";

// Relances et mise en demeure (maquette PRO-06.2) : factures échues au même
// endroit, relances automatiques en trois temps, mise en demeure préparée
// par Koji et envoyée par l'entrepreneur (recommandé en ligne ou PDF).
const euro = (n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n) || 0);
const court = (iso) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(iso));
const Coche = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>;
const LA_POSTE_RECOMMANDE = "https://www.laposte.fr/lettre-recommandee-en-ligne";
const INJONCTION = "https://www.service-public.fr/particuliers/vosdroits/F1746";
const PALIER_TEXTE = {
  aimable: "rappel aimable, message et e-mail",
  ferme: "relance ferme, avec la facture jointe",
  demeure: "mise en demeure préparée, envoyée par vous"
};

function typeCourt(invoice) {
  const t = fixText(invoice.type || "");
  if (/acompte/i.test(t)) return "Acompte";
  if (/situation/i.test(t)) return t.replace(/^situation/i, "Situation");
  return "Facture";
}

function imprimerCourrier({ texte, entreprise, client, invoice }) {
  const w = window.open("", "_blank");
  if (!w) return false;
  const esc = (s) => String(s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  const date = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date());
  w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Mise en demeure ${esc(invoice.invoiceNumber)}</title>
<style>body{font:14px/1.6 Georgia,serif;color:#111;max-width:680px;margin:48px auto;padding:0 24px}.ent{font-weight:bold}.dest{margin:32px 0 32px auto;width:280px}.ar{font-weight:bold;text-transform:uppercase;letter-spacing:.04em;margin:24px 0}p{white-space:pre-wrap}@media print{body{margin:0 auto}}</style></head>
<body><div class="ent">${esc(entreprise)}</div><div class="dest">${esc(client)}</div><div>Le ${esc(date)}</div>
<div class="ar">Lettre recommandée avec accusé de réception</div><p>${esc(texte)}</p></body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
  return true;
}

function Impayes() {
  const params = useSearchParams();
  const { data: invoices, setData: setInvoices } = useApi("/api/invoices", "invoices");
  const { data: quotes } = useApi("/api/quotes", "quotes");
  const [auto, setAuto] = useState(null);
  const [demeure, setDemeure] = useState(null);
  const [texte, setTexte] = useState("");
  const [edition, setEdition] = useState(false);
  const [envoi, setEnvoi] = useState("en-ligne");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");
  const aujourdhui = aujourdhuiParis();
  const entreprise = fixText(readStoredUser()?.business?.raisonSociale || "");

  useEffect(() => {
    apiGet("/api/relances").then((d) => setAuto(Boolean(d.actif))).catch(() => setAuto(false));
  }, []);

  const credits = useMemo(() => {
    const map = new Map();
    for (const a of invoices || []) if (a.kind === "avoir" && a.status !== "Annulee") map.set(a.refInvoiceId, (map.get(a.refInvoiceId) || 0) - Number(a.amountTtc || 0));
    return map;
  }, [invoices]);
  const { liste, total } = useMemo(() => resumeImpayes(invoices || [], aujourdhui, (f) => credits.get(f.id) || 0), [invoices, aujourdhui, credits]);
  const societe = (invoice) => (quotes || []).find((q) => q.id === invoice.quoteId)?.clientType === "societe";

  function ouvrirDemeure(invoice) {
    setErreur("");
    setEdition(false);
    setTexte(texteRelance("demeure", invoice, { entreprise, societe: societe(invoice), aujourdhui }));
    setDemeure(invoice);
  }

  // Notification « Mise en demeure prête » : ouvre directement le courrier.
  useEffect(() => {
    const id = params.get("demeure");
    if (!id || demeure || !invoices) return;
    const cible = invoices.find((f) => f.id === id);
    if (cible) ouvrirDemeure(cible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, invoices]);

  async function basculerAuto() {
    const actif = !auto;
    setAuto(actif);
    try {
      const d = await apiSend("/api/relances", { actif });
      setAuto(Boolean(d.actif));
      setMessage(d.actif ? "Relances automatiques activées : Koji relance à J+3 et J+15, et prépare la mise en demeure à J+30." : "Relances automatiques désactivées.");
    } catch (e) {
      setAuto(!actif);
      setMessage(e.message || "Le réglage n'a pas pu être enregistré.");
    }
  }

  async function envoyerDemeure() {
    setBusy(true);
    setErreur("");
    const ouvert = imprimerCourrier({ texte, entreprise, client: fixText(demeure.client || ""), invoice: demeure });
    if (!ouvert) {
      setBusy(false);
      setErreur("Autorisez l'ouverture de la fenêtre pour obtenir le PDF du courrier.");
      return;
    }
    if (envoi === "en-ligne") window.open(LA_POSTE_RECOMMANDE, "_blank", "noopener");
    try {
      const { invoice } = await apiSend("/api/invoices", { id: demeure.id, action: "remind", level: "demeure", channel: "recommande", text: texte }, "PATCH");
      setInvoices((cur) => (cur || []).map((f) => (f.id === invoice.id ? invoice : f)));
      setMessage(`Mise en demeure ${demeure.invoiceNumber} notée comme envoyée. ${envoi === "en-ligne" ? "Déposez le PDF sur le service de recommandé en ligne de La Poste." : "Imprimez-la et envoyez-la en recommandé avec accusé de réception."}`);
      setDemeure(null);
    } catch (e) {
      setErreur(e.message || "L'envoi n'a pas pu être noté.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow"><a className="link" href="/facturation">Factures</a></span>
          <h1>Relances et impayés</h1>
        </div>
      </div>
      {message ? <p className="notice" role="status">{message}</p> : null}

      <div className="imp-grid">
        <section className="card">
          <div className="card-h">
            <h2>Factures échues <span className="cnt">{liste.length}</span></h2>
            <span className="sm2"><b>{euro(total)}</b> à encaisser</span>
          </div>
          {!invoices ? <p className="muted">Chargement…</p> : liste.length === 0 ? (
            <div className="empty">Aucune facture échue. Les factures en retard apparaîtront ici.</div>
          ) : (
            <div className="tbl">
              <table>
                <thead><tr><th>Facture</th><th className="r">TTC</th><th className="r">Retard</th><th>Étape</th><th aria-label="Action" /></tr></thead>
                <tbody>
                  {liste.map((f) => {
                    const action = actionImpaye(f, aujourdhui);
                    return (
                      <tr key={f.id}>
                        <td className="n">{typeCourt(f)} {f.invoiceNumber}<div className="sm">{fixText(f.client || "Client")} · {societe(f) ? "société" : "particulière"}</div></td>
                        <td className="r">{euro(Number(f.amountTtc || 0) - (credits.get(f.id) || 0))}</td>
                        <td className="r"><b>{joursRetard(f, aujourdhui)} j</b></td>
                        <td className="sm2">{etapeRelance(f, aujourdhui)}</td>
                        <td className="r">
                          {action === "demeure" ? <button type="button" className="btn btn-main" onClick={() => ouvrirDemeure(f)}>Préparer la mise en demeure</button>
                            : action === "relancer" ? <a className="btn btn-sec" href={`/facturation?relancer=${f.id}`}>Relancer</a>
                              : <a className="btn btn-sec" href={`/facturation?relancer=${f.id}`}>Voir</a>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-h"><h2>Relances automatiques</h2></div>
          <ul className="imp-paliers">
            {PALIERS.map((p) => <li key={p.level}><b>J+{p.jours}</b><span>{PALIER_TEXTE[p.level]}</span></li>)}
          </ul>
          <button type="button" className={`ck${auto ? " on" : ""}`} aria-pressed={Boolean(auto)} disabled={auto === null} onClick={basculerAuto}>
            <Coche />Relances automatiques {auto ? "activées" : "désactivées"}
          </button>
          <p className="sm2">Désactivables facture par facture (client fidèle, accord de paiement). Jamais sur une facture contestée ou couverte par un avoir.</p>
        </section>
      </div>

      {demeure ? (
        <>
          <div className="env-scrim" onClick={busy ? undefined : () => setDemeure(null)} />
          <section className="env-panel" role="dialog" aria-modal="true" aria-label="Mise en demeure">
            <div className="env-h"><h2>Mise en demeure · {fixText(demeure.client || "client")}</h2><button type="button" className="link" onClick={() => setDemeure(null)}>Fermer</button></div>
            {edition ? (
              <textarea className="rd-ta" rows={14} value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={4000} aria-label="Texte de la mise en demeure" />
            ) : (
              <div className="imp-lettre">{texte.split("\n\n").map((para, i) => <p key={i}>{para}</p>)}</div>
            )}
            <p className="sm2">Les montants, dates et mentions sont remplis par Koji ; texte à faire valider.</p>
            <div className="env-ch">
              <span className="lab">Envoi</span>
              <button type="button" className={`ck${envoi === "en-ligne" ? " on" : ""}`} aria-pressed={envoi === "en-ligne"} onClick={() => setEnvoi("en-ligne")}><Coche />Lettre recommandée en ligne</button>
              <button type="button" className={`ck${envoi === "pdf" ? " on" : ""}`} aria-pressed={envoi === "pdf"} onClick={() => setEnvoi("pdf")}><Coche />PDF à imprimer</button>
            </div>
            <p className="sm2">Sans paiement : demande d'injonction de payer sur le <a className="link" href={INJONCTION} target="_blank" rel="noopener noreferrer">site officiel</a> (facture, devis signé, relances et mise en demeure en pièces).</p>
            {erreur ? <p className="err" role="alert">{erreur}</p> : null}
            <div className="env-act">
              <button type="button" className="btn btn-sec" onClick={() => setEdition((v) => !v)}>{edition ? "Aperçu" : "Modifier le texte"}</button>
              <button type="button" className="btn btn-main" disabled={busy || !texte.trim()} onClick={envoyerDemeure}>{busy ? "…" : envoi === "en-ligne" ? "Envoyer en recommandé" : "Imprimer le PDF"}</button>
            </div>
          </section>
        </>
      ) : null}
    </Shell>
  );
}

export default function ImpayesPage() {
  return <Suspense fallback={null}><Impayes /></Suspense>;
}
