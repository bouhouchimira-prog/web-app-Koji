"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, fetchWithAuthRetry } from "../../lib/client-api";
import "./profil-sections.css";
import { JOURS, REGIMES_TVA, conditionsDefaut, disponibilitesDe, libelleDisponibilite, masquerSiren, mentionsObligatoires, qualificationsDe, regimeTva, sirenDe } from "../../lib/compte-pro";

// Sections du profil (maquettes PRO-15 et PRO-15.2) : étapes qui disent ce
// qu'elles débloquent, qualifications, disponibilités, réglages des devis et
// factures. Les champs s'enregistrent avec le reste du profil.
const dateFr = (j) => (j ? j.split("-").reverse().join("/") : "");

export function EtapesProfil({ rafraichir }) {
  const [e, setE] = useState(null);
  useEffect(() => { apiGet("/api/compte").then((d) => setE(d.etapes)).catch(() => null); }, [rafraichir]);
  if (!e) return null;
  return (
    <div className="pf-done2 pf-etapes">
      <div className="t">
        <strong>{e.faites} étapes sur {e.total}</strong>
        <small>{e.reste}</small>
        <div className="bar"><i style={{ width: `${e.pct}%` }} /></div>
      </div>
      <div className="pf-sts">
        {e.etapes.map((x) => (
          <span key={x.id} className={`pf-st${x.fait ? " ok" : ""}`}>
            {x.fait ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l4 4 10-10" /></svg> : null}
            <b>{x.label}</b>
            <small>{x.sous}</small>
          </span>
        ))}
      </div>
      {e.suivante ? <div><Link className="btn btn-sec" href={e.suivante.lien}>Continuer</Link></div> : null}
    </div>
  );
}

export function IdentiteResume({ business }) {
  const siren = sirenDe(business);
  if (!siren) return null;
  return <p className="sm2">SIREN {masquerSiren(siren)}{business.formeJuridique ? ` · ${business.formeJuridique}` : ""} · rempli depuis l'annuaire public à l'inscription, modifiable ci-dessous.</p>;
}

export function QualificationsCard({ business, setField }) {
  const liste = qualificationsDe(business);
  const rge = liste.filter((q) => q.type === "rge");
  const maj = (id, champs) => setField("qualifications", liste.map((q) => (q.id === id ? { ...q, ...champs } : q)));
  const ajouter = (type) => setField("qualifications", [...liste, { id: `q-${Date.now()}`, type, nom: type === "rge" ? "RGE" : "Qualification", numero: "", jusqua: "" }]);
  return (
    <section className="card">
      <div className="card-h"><h2>Qualifications et labels</h2><span className="sm2">affichés sur votre KojiPage</span></div>
      {liste.map((q) => (
        <div className="fgrid fgrid3 pf-qual" key={q.id}>
          <label>{q.type === "rge" ? "Qualification RGE" : "Qualification ou label"}<input value={q.nom} onChange={(e) => maj(q.id, { nom: e.target.value })} placeholder={q.type === "rge" ? "RGE Qualibat" : "Qualibat, Handibat, label de fabricant…"} /></label>
          <label>Numéro<input value={q.numero} onChange={(e) => maj(q.id, { numero: e.target.value })} /></label>
          <label>Valable jusqu'au<span className="pair"><input type="date" value={q.jusqua} onChange={(e) => maj(q.id, { jusqua: e.target.value })} /><button type="button" className="link" onClick={() => setField("qualifications", liste.filter((x) => x.id !== q.id))}>Retirer</button></span></label>
        </div>
      ))}
      {!rge.length ? <div className="row"><div className="t"><strong>RGE</strong><small>non renseigné · sans RGE, vos clients n'ont pas accès à certaines aides</small></div><button type="button" className="btn btn-sec" onClick={() => ajouter("rge")}>Ajouter</button></div> : null}
      <div className="row"><div className="t"><strong>Autre qualification ou label</strong><small>Qualibat, Handibat, label de fabricant…</small></div><button type="button" className="btn btn-sec" onClick={() => ajouter("autre")}>Ajouter</button></div>
    </section>
  );
}

export function DisponibilitesCard({ business, setField }) {
  const d = disponibilitesDe(business);
  const maj = (bloc, champs) => setField("disponibilites", { ...d, [bloc]: { ...d[bloc], ...champs } });
  const Jours = ({ bloc }) => (
    <div className="pf-jours" role="group" aria-label="Jours">
      {JOURS.map(([id, l]) => <button type="button" key={id} aria-pressed={d[bloc].jours.includes(id)} className={d[bloc].jours.includes(id) ? "on" : ""} onClick={() => maj(bloc, { jours: d[bloc].jours.includes(id) ? d[bloc].jours.filter((x) => x !== id) : [...d[bloc].jours, id] })}>{l}</button>)}
    </div>
  );
  return (
    <section className="card">
      <div className="card-h"><h2>Disponibilités</h2><span className="sm2">planning et créneaux de visite</span></div>
      {[["chantiers", "Chantiers"], ["visites", "Visites clients"]].map(([bloc, titre]) => (
        <div className="pf-dispo" key={bloc}>
          <div className="t"><strong>{titre}</strong><small>{libelleDisponibilite(d[bloc])}</small></div>
          <Jours bloc={bloc} />
          <span className="pair"><input type="time" value={d[bloc].de} onChange={(e) => maj(bloc, { de: e.target.value })} aria-label={`${titre}, début`} /><input type="time" value={d[bloc].a} onChange={(e) => maj(bloc, { a: e.target.value })} aria-label={`${titre}, fin`} /></span>
        </div>
      ))}
      <div className="pf-dispo">
        <div className="t"><strong>Fermeture</strong><small>{d.fermeture.du && d.fermeture.au ? `du ${dateFr(d.fermeture.du)} au ${dateFr(d.fermeture.au)}` : "aucune période de fermeture"}</small></div>
        <span className="pair"><input type="date" value={d.fermeture.du} onChange={(e) => maj("fermeture", { du: e.target.value })} aria-label="Fermeture, du" /><input type="date" value={d.fermeture.au} min={d.fermeture.du || undefined} onChange={(e) => maj("fermeture", { au: e.target.value })} aria-label="Fermeture, au" /></span>
      </div>
      <p className="sm2">Les créneaux de visite proposés aux clients du Radar suivent ces jours.</p>
    </section>
  );
}

// Onglet Devis et factures (maquette PRO-15.2).
export function DevisFactures({ business, setField, labels }) {
  const [compte, setCompte] = useState(null);
  const [cgv, setCgv] = useState(business.cgv || null);
  const [erreur, setErreur] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { apiGet("/api/compte").then((d) => setCompte(d)).catch(() => null); }, []);
  const regime = regimeTva(business);
  const c = conditionsDefaut(business);
  const majC = (champs) => setField("devisDefauts", { ...c, ...champs });
  const med = business.mediateur || {};
  const mentions = mentionsObligatoires(business);
  async function deposerCgv(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy(true); setErreur("");
    try {
      const fd = new FormData();
      fd.append("cgv", f);
      const r = await fetchWithAuthRetry(() => fetch("/api/compte/cgv", { method: "POST", body: fd }));
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Dépôt impossible.");
      setCgv(d.cgv);
    } catch (er) { setErreur(er.message); }
    setBusy(false);
  }
  async function retirerCgv() {
    setBusy(true);
    try { await fetchWithAuthRetry(() => fetch("/api/compte/cgv", { method: "DELETE" })); setCgv(null); } catch (er) { setErreur(er.message); }
    setBusy(false);
  }
  return (
    <>
      <div className="pf-done2 pf-prix">
        <div className="t"><strong>Vos prix sont dans la Bibliothèque</strong><small>{compte ? `${compte.devis.tauxRegles} métier${compte.devis.tauxRegles > 1 ? "s" : ""} réglé${compte.devis.tauxRegles > 1 ? "s" : ""} · ` : ""}taux, fournitures, majorations</small></div>
        <div><Link href="/bibliotheque-ouvrages/mes-prix" className="btn btn-sec">Ouvrir Mes prix</Link></div>
      </div>

      <section className="card">
        <div className="card-h"><h2>TVA</h2></div>
        <div className="pf-regimes" role="radiogroup" aria-label="Régime de TVA">
          {Object.entries(REGIMES_TVA).map(([id, r]) => (
            <button type="button" key={id} role="radio" aria-checked={regime === id} className={regime === id ? "on" : ""} onClick={() => { setField("regimeTva", id); if (id === "franchise") setField("defaultVatRate", 0); else if (Number(business.defaultVatRate) === 0) setField("defaultVatRate", 20); }}>
              <strong>{r.label}</strong><small>{r.detail}</small>
            </button>
          ))}
        </div>
        {regime !== "franchise" ? <div className="fgrid"><label>N° de TVA intracommunautaire<input value={business.tva || ""} onChange={(e) => setField("tva", e.target.value)} placeholder="FR 12 345678901" /></label></div> : <p className="sm2">Vos devis et factures sont établis sans TVA, avec la mention « TVA non applicable, art. 293 B du CGI ».</p>}
      </section>

      <section className="card">
        <div className="card-h"><h2>Conditions par défaut</h2><span className="sm2">modifiables sur chaque devis</span></div>
        <div className="fgrid fgrid3">
          <label>Validité d'un devis (jours)<input type="number" min="1" max="365" value={c.validiteJours} onChange={(e) => majC({ validiteJours: Number(e.target.value) })} /></label>
          <label>Acompte à la signature (%)<input type="number" min="0" max="100" value={c.acomptePct} onChange={(e) => majC({ acomptePct: Number(e.target.value) })} /></label>
          <label>Paiement des factures (jours)<input type="number" min="0" max="120" value={c.paiementJours} onChange={(e) => majC({ paiementJours: Number(e.target.value) })} /></label>
        </div>
        {compte ? <div className="kv"><span>Prochaine facture</span><b>{compte.devis.prochaineFacture}</b></div> : null}
        <div className="fgrid"><label className="full">{labels.paymentTermsLabel}<textarea rows={3} value={business.paymentTerms || ""} onChange={(e) => setField("paymentTerms", e.target.value)} placeholder="Précisions imprimées sous les conditions de paiement" /></label></div>
      </section>

      <section className="card">
        <div className="card-h"><h2>Encaissement</h2></div>
        <div className="fgrid">
          <label className="full">IBAN imprimé sur les factures<input value={business.iban || ""} onChange={(e) => setField("iban", e.target.value)} placeholder="FR76 3000 6000 0112 3456 7890 189" /></label>
          <label>{labels.bic}<input value={business.bic || ""} onChange={(e) => setField("bic", e.target.value)} placeholder="BNPAFRPP" /></label>
          <label>{labels.bankHolder}<input value={business.bankHolder || ""} onChange={(e) => setField("bankHolder", e.target.value)} /></label>
        </div>
        <div className="row"><div className="t"><strong>Paiement en ligne par carte et virement</strong><small>bientôt · prestataire et frais par paiement à fixer</small></div><span className="tag tag-o">Bientôt</span></div>
      </section>

      <section className="card">
        <div className="card-h"><h2>Documents joints</h2></div>
        <div className="row">
          <div className="t"><strong>Conditions générales de vente</strong><small>{cgv?.nom ? `${cgv.nom} · déposées le ${dateFr(String(cgv.le || "").slice(0, 10))} · jointes à chaque devis envoyé par e-mail` : "déposez vos CGV en PDF : elles seront jointes à chaque devis envoyé par e-mail"}</small></div>
          {cgv?.nom ? <><a className="btn btn-sec" href="/api/compte/cgv" target="_blank" rel="noreferrer">Relire</a><button type="button" className="link" disabled={busy} onClick={retirerCgv}>Retirer</button></> : <label className="btn btn-sec">{busy ? "Envoi…" : "Déposer un PDF"}<input type="file" accept="application/pdf" hidden disabled={busy} onChange={deposerCgv} /></label>}
        </div>
        <div className="row"><div className="t"><strong>Mention TVA à taux réduit</strong><small>certifiée par le client particulier sur le devis, à la signature</small></div><span className="tag">Koji l'ajoute seul</span></div>
        {erreur ? <p className="notice" role="alert">{erreur}</p> : null}
        <p className="sm2">Koji ne fournit pas encore de modèle de CGV : il doit d'abord être validé par un avocat.</p>
      </section>

      <section className="card">
        <div className="card-h"><h2>Mentions obligatoires</h2><span className="sm2">Koji les ajoute seul</span></div>
        {mentions.map((m) => (
          <div className={`row pf-mention${m.ok ? " ok" : ""}`} key={m.id}><span className="pf-coche" aria-hidden="true">{m.ok ? "✓" : "—"}</span><div className="t"><strong>{m.label}</strong><small>{m.ok ? m.detail : m.manque}</small></div></div>
        ))}
        <div className={`pf-med${med.nom ? "" : " alerte"}`}>
          <strong>{med.nom ? "Médiateur de la consommation" : "Médiateur à désigner"}</strong>
          <small>{med.nom ? "Imprimé sur vos devis et factures aux particuliers." : "Obligatoire pour les clients particuliers : sans médiateur, vos devis partent sans cette mention."}</small>
          <div className="fgrid">
            <label>Nom du médiateur<input value={med.nom || ""} onChange={(e) => setField("mediateur", { ...med, nom: e.target.value })} placeholder="Nom de l'organisme auquel vous avez adhéré" /></label>
            <label>Site ou adresse<input value={med.site || ""} onChange={(e) => setField("mediateur", { ...med, site: e.target.value })} placeholder="www.…" /></label>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-h"><h2>{labels.signatures}</h2></div>
        <p className="muted">{labels.signaturesSub}</p>
        <div><Link href="/signature" className="btn btn-sec">{labels.openSignatures}</Link></div>
      </section>
    </>
  );
}
