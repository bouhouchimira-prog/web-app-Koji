"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiGet, apiSend } from "../lib/client-api";
import { detailLigne, finDecalee, numeroCourt, recapAvenant, signeMontant, totalLigne } from "../lib/avenant-koji";

// Avenant depuis la fiche du chantier (maquette PRO-05) : vous dictez ce
// qui change, Koji prépare les lignes (ajout, modification, suppression)
// avec les prix du devis et de votre bibliothèque, puis l'avenant part en
// signature en ligne, comme le devis.
const euro = (n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n) || 0).replace(/ | /g, " ");
const jour = (iso) => (iso ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(`${iso.slice(0, 10)}T12:00:00Z`)) : "");
const ICONES = { ajout: ["add", "+"], modification: ["mod", "~"], suppression: ["del", "−"] };
const Coche = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>;

export function AvenantPanneau({ quote, finPrevue = "", onClose, onDone }) {
  const lots = useMemo(() => [...new Set((quote?.items || []).map((i) => i.room).filter(Boolean))], [quote]);
  const [avenants, setAvenants] = useState([]);
  const [notes, setNotes] = useState("");
  const [prepa, setPrepa] = useState(false);
  const [prepare, setPrepare] = useState(false);
  const [lignes, setLignes] = useState([]);
  const [impact, setImpact] = useState(0);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(Boolean(quote?.clientEmail));
  const [ajout, setAjout] = useState(null);
  const [envoi, setEnvoi] = useState("");
  const [erreur, setErreur] = useState("");
  const [fait, setFait] = useState(null);

  useEffect(() => {
    if (quote?.id) apiGet(`/api/avenants?quoteId=${quote.id}`).then((d) => setAvenants(d.avenants || [])).catch(() => {});
  }, [quote?.id]);

  const numero = `A${avenants.length + 1}`;
  const signesHt = avenants.filter((a) => a.status === "Signe").reduce((s, a) => s + Number(a.totalHtDelta || 0), 0);
  const recap = recapAvenant({ devisHt: Number(quote?.totalHt) || 0, lignes, tauxTva: Number(quote?.vatRate ?? 20), avenantsSignesHt: signesHt });
  const aChiffrer = lignes.some((l) => l.aChiffrer && !(Number(l.unitPriceHt) > 0));
  const nouvelleFin = finPrevue && impact ? finDecalee(finPrevue, impact) : "";

  async function preparer() {
    setPrepa(true);
    setErreur("");
    try {
      const r = await apiSend("/api/avenants/preparer", { quoteId: quote.id, notes });
      setLignes(r.lignes || []);
      setImpact(Number(r.impactJours) || 0);
      setMessage(r.message || "");
      setPrepare(true);
    } catch (e) {
      setErreur(e.message || "Koji n'a pas pu préparer l'avenant.");
    } finally {
      setPrepa(false);
    }
  }

  function prix(i, valeur) {
    setLignes((ls) => ls.map((l, j) => (j === i ? { ...l, unitPriceHt: Number(String(valeur).replace(",", ".")) || 0 } : l)));
  }

  async function valider(envoyer) {
    setEnvoi(envoyer ? "envoi" : "brouillon");
    setErreur("");
    try {
      const { avenant } = await apiSend("/api/avenants", { quoteId: quote.id, lignes, impactJours: impact, message, notes, motif: lignes.map((l) => l.label).slice(0, 3).join(", "), motifCategory: "imprevu_chantier" });
      let final = avenant;
      if (envoyer) final = (await apiSend("/api/avenants", { id: avenant.id, action: "send", email }, "PATCH")).avenant;
      setFait(final);
      onDone?.(final);
    } catch (e) {
      setErreur(e.message || "L'avenant n'a pas pu être enregistré.");
    } finally {
      setEnvoi("");
    }
  }

  return (
    <>
      <div className="env-scrim" onClick={envoi ? undefined : onClose} />
      <section className="env-panel wide" role="dialog" aria-modal="true" aria-label="Avenant">
        <div className="env-h"><h2>Avenant</h2><button type="button" className="link" onClick={onClose}>Fermer</button></div>

        {fait ? (
          <div className="avk">
            <div>
              <strong>Avenant {numeroCourt(fait.numero)} {fait.status === "Envoye" ? "envoyé pour signature" : "enregistré en brouillon"}.</strong>
              <small>{fait.status === "Envoye" ? `${fait.emailEnvoye ? "E-mail parti avec le PDF. " : ""}Le client signe en ligne ; vous êtes prévenu à la signature.` : "Vous pourrez l'envoyer depuis la liste des avenants."}</small>
              <small><Link className="link" href={`/avenant?id=${fait.id}`}>Ouvrir l'avenant</Link></small>
            </div>
          </div>
        ) : !prepare ? (
          <>
            <div className="env-ch">
              <span className="lab">Ce qui change sur le chantier</span>
              <textarea className="rd-ta" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="« sol pas droit, vanne HS, la cliente veut la faïence sur le retour, enlève la 2e prise »" />
              <small className="sm2">Dictez ou écrivez vos notes. Koji retrouve les lignes du devis et les ouvrages de votre bibliothèque ; il n'invente aucun prix.</small>
            </div>
            {prepa ? <div className="avk"><span className="think"><i /><i /><i /></span><div><strong>Koji prépare l'avenant…</strong><small>« {notes} »</small></div></div> : null}
            {erreur ? <p className="err" role="alert">{erreur}</p> : null}
            <div className="env-act">
              <button type="button" className="btn btn-sec" onClick={() => { setLignes([]); setPrepare(true); setMessage(""); }}>Sans Koji</button>
              <button type="button" className="btn btn-main" onClick={preparer} disabled={prepa || !notes.trim()}>{prepa ? "Préparation…" : "Préparer avec Koji"}</button>
            </div>
          </>
        ) : (
          <>
            {notes ? <div className="avk"><span className="think"><i /><i /><i /></span><div><strong>Koji a préparé l'avenant depuis tes notes de chantier.</strong><small>« {notes} »</small></div></div> : null}
            <div className="env-sum">
              <div><span className="lab">Avenant n° {numero.slice(1)}</span><strong>au devis {quote.quoteNumber}</strong><span className="muted">{[quote.project, quote.client].filter(Boolean).join(" · ")}</span></div>
              <div>
                <span className="lab">Impact planning</span>
                <strong>
                  <button type="button" className="link" aria-label="Un jour de moins" onClick={() => setImpact((v) => v - 1)}>−</button>{" "}
                  {impact ? `${impact > 0 ? "+ " : "− "}${Math.abs(impact)} jour${Math.abs(impact) > 1 ? "s" : ""}` : "aucun"}{" "}
                  <button type="button" className="link" aria-label="Un jour de plus" onClick={() => setImpact((v) => v + 1)}>+</button>
                </strong>
                <span className="muted">{nouvelleFin ? `Fin prévue ${jour(nouvelleFin)} au lieu du ${jour(finPrevue)}` : finPrevue ? `Fin prévue ${jour(finPrevue)}` : "planning inchangé"}</span>
              </div>
            </div>

            <div className="lots">
              <div className="lots-h"><span className="lab">Modifications</span><button type="button" className="link" onClick={() => setAjout({ type: "ajout", label: "", room: lots[0] || "", quantity: 1, unit: "u", unitPriceHt: "" })}>+ Ajouter une ligne</button></div>
              {lignes.map((l, i) => (
                <div className={`avr ${ICONES[l.type][0]}`} key={l.id || i}>
                  <span className="avs">{ICONES[l.type][1]}</span>
                  <div className="avt">
                    <strong>{l.label}</strong>
                    <small>{detailLigne(l, lots)}</small>
                    {l.aChiffrer && !(Number(l.unitPriceHt) > 0) ? (
                      <label className="sm2">Prix unitaire HT <input type="number" min="0" step="0.01" onChange={(e) => prix(i, e.target.value)} style={{ width: 90 }} /> €</label>
                    ) : null}
                  </div>
                  <span className="ava">{signeMontant(totalLigne(l))} <button type="button" className="link" aria-label={`Retirer ${l.label}`} onClick={() => setLignes((ls) => ls.filter((_, j) => j !== i))}>×</button></span>
                </div>
              ))}
              {!lignes.length ? <p className="sm2">Aucune ligne. Ajoutez-en une.</p> : null}
              {ajout ? (
                <div className="avr add">
                  <select value={ajout.type} onChange={(e) => setAjout({ ...ajout, type: e.target.value })} aria-label="Type"><option value="ajout">+</option><option value="suppression">−</option></select>
                  <div className="avt" style={{ display: "grid", gap: 6, gridTemplateColumns: "2fr 1fr 70px 60px 90px" }}>
                    <input placeholder="Intitulé" value={ajout.label} onChange={(e) => setAjout({ ...ajout, label: e.target.value })} />
                    <select value={ajout.room} onChange={(e) => setAjout({ ...ajout, room: e.target.value })}>{lots.map((lot) => <option key={lot}>{lot}</option>)}</select>
                    <input type="number" min="0" step="0.01" value={ajout.quantity} onChange={(e) => setAjout({ ...ajout, quantity: e.target.value })} aria-label="Quantité" />
                    <input value={ajout.unit} onChange={(e) => setAjout({ ...ajout, unit: e.target.value })} aria-label="Unité" />
                    <input type="number" min="0" step="0.01" placeholder="€ HT" value={ajout.unitPriceHt} onChange={(e) => setAjout({ ...ajout, unitPriceHt: e.target.value })} aria-label="Prix unitaire HT" />
                  </div>
                  <button type="button" className="btn btn-sec" disabled={!ajout.label.trim() || !(Number(ajout.unitPriceHt) > 0)} onClick={() => { setLignes((ls) => [...ls, { ...ajout, id: `m-${Date.now()}`, quantity: Number(ajout.quantity) || 1, unitPriceHt: Number(ajout.unitPriceHt) || 0 }]); setAjout(null); }}>Ajouter</button>
                </div>
              ) : null}
            </div>

            <div className="ac-amt">
              <div><span>Devis initial HT</span><b>{euro(recap.devisHt)}</b></div>
              {signesHt ? <div><span>Avenants signés HT</span><b>{signeMontant(signesHt)}</b></div> : null}
              <div><span>Avenant n° {numero.slice(1)} HT</span><b>{signeMontant(recap.avenantHt)}</b></div>
              <div className="big"><span>Nouveau total du marché</span><b>{euro(recap.totalHt)} HT</b><small>{euro(recap.totalTtc)} TTC · TVA {String(quote.vatRate ?? 20).replace(".", ",")} % · reste à facturer ajusté sur les situations</small></div>
            </div>

            <div className="env-ch">
              <span className="lab">Message au client</span>
              <textarea className="rd-ta" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
            <div className="env-ch">
              <span className="lab">Envoi</span>
              <span className="ck on"><Coche />Lien de signature en ligne</span>
              <button type="button" className={`ck${email ? " on" : ""}`} aria-pressed={email} disabled={!quote.clientEmail} onClick={() => setEmail((v) => !v)}><Coche />E-mail avec le PDF{quote.clientEmail ? "" : " (pas d'e-mail sur le devis)"}</button>
            </div>
            {aChiffrer ? <p className="sm2">Une ligne est à chiffrer : donnez-lui un prix avant d'envoyer.</p> : null}
            {erreur ? <p className="err" role="alert">{erreur}</p> : null}
            <div className="env-act">
              <button type="button" className="btn btn-sec" onClick={() => valider(false)} disabled={Boolean(envoi) || !lignes.length}>{envoi === "brouillon" ? "Enregistrement…" : "Enregistrer"}</button>
              <button type="button" className="btn btn-main" onClick={() => valider(true)} disabled={Boolean(envoi) || !lignes.length || aChiffrer}>{envoi === "envoi" ? "Envoi…" : "Envoyer pour signature"}</button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
