"use client";

import { useState } from "react";
import { CRITERES } from "../lib/avis";

// Koji Client après la réception (maquette PRO-02.6, téléphone « chantier
// terminé ») : dossier de fin de chantier, garanties, « Signaler un
// problème » (arrive à l'entreprise comme une réserve pendant la garantie
// de parfait achèvement) et « Donner votre avis ».

function dateLongue(jour) {
  const d = new Date(`${String(jour).slice(0, 10)}T12:00:00Z`);
  return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(d) : "";
}

function Notes({ valeur, onChange, label, grand = false }) {
  return (
    <span className={`cfc-stars${grand ? " big" : ""}`} role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" role="radio" aria-checked={valeur === i} aria-label={`${i} sur 5`} className={i <= valeur ? "on" : ""} onClick={() => onChange(i)}>★</button>
      ))}
    </span>
  );
}

export function ClientFinChantier({ quote, entreprise }) {
  const fin = quote.finChantier || {};
  const [vue, setVue] = useState("");
  const [avis, setAvis] = useState({ note: 0, criteres: {}, texte: "", accordPhotos: false });
  const [probleme, setProbleme] = useState({ texte: "", lieu: "", file: null });
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState("");
  const [avisLe, setAvisLe] = useState(fin.avisLe || "");
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const garantieEnCours = Boolean(fin.receptionLe && fin.parfaitJusqua >= aujourdhui);

  if (!fin.receptionLe && !fin.avisPossible) return null;

  async function envoyerAvis() {
    setEnvoi(true);
    setMessage("");
    try {
      const res = await fetch("/api/client/avis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quoteId: quote.id, ...avis }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Votre avis n'a pas pu être publié.");
      setAvisLe(data.avis?.creeLe || new Date().toISOString());
      setVue("");
      setMessage("Merci : votre avis est publié sur la page de l'entreprise.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setEnvoi(false);
    }
  }

  async function envoyerProbleme() {
    setEnvoi(true);
    setMessage("");
    try {
      const form = new FormData();
      form.append("quoteId", quote.id);
      form.append("texte", probleme.texte);
      form.append("lieu", probleme.lieu);
      if (probleme.file) form.append("file", probleme.file);
      const res = await fetch("/api/client/reserves", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Le signalement n'a pas pu partir.");
      setProbleme({ texte: "", lieu: "", file: null });
      setVue("");
      setMessage(`${entreprise || "L'entreprise"} le reçoit comme une réserve et vous répond dans Koji Client.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <section className="ccd-section cfc" id="avis">
      <h2 className="ccd-section-title">{fin.receptionLe ? `Votre chantier, terminé le ${dateLongue(fin.receptionLe)}` : "Votre chantier est terminé"}</h2>
      <div className="cfc-list">
        {fin.dossierFinLe ? (
          <a className="cfc-row" href={`/api/client/quotes/${quote.id}/dossier`} target="_blank" rel="noreferrer">
            <span><b>Dossier de fin de chantier</b><small>PV, factures, photos, notices, garanties</small></span><i aria-hidden="true">›</i>
          </a>
        ) : null}
        {fin.receptionLe ? (
          <div className="cfc-row">
            <span><b>Vos garanties</b><small>parfait achèvement jusqu'au {dateLongue(fin.parfaitJusqua)} · décennale 10 ans</small></span>
          </div>
        ) : null}
        {garantieEnCours ? (
          <button type="button" className="cfc-row" onClick={() => setVue(vue === "probleme" ? "" : "probleme")} aria-expanded={vue === "probleme"}>
            <span><b>Signaler un problème</b><small>avec une photo · {entreprise || "l'entreprise"} est prévenu</small></span><i aria-hidden="true">›</i>
          </button>
        ) : null}
      </div>

      {vue === "probleme" ? (
        <div className="cfc-form">
          <label>Ce qui ne va pas<textarea rows={3} maxLength={200} value={probleme.texte} onChange={(e) => setProbleme({ ...probleme, texte: e.target.value })} placeholder="Le joint en bas de la douche se décolle dans l'angle." /></label>
          <label>Où<input maxLength={120} value={probleme.lieu} onChange={(e) => setProbleme({ ...probleme, lieu: e.target.value })} placeholder="Douche, angle du receveur" /></label>
          <label>Photo<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(e) => setProbleme({ ...probleme, file: e.target.files?.[0] || null })} /></label>
          <p className="cfc-note">{entreprise || "L'entreprise"} le reçoit comme une réserve et vous répond dans Koji Client.</p>
          <button type="button" className="cfc-send" disabled={envoi || !probleme.texte.trim()} onClick={envoyerProbleme}>{envoi ? "Envoi…" : "Envoyer"}</button>
        </div>
      ) : null}

      {fin.avisPossible && !avisLe ? (
        vue === "avis" ? (
          <div className="cfc-form">
            <p className="cfc-q">Comment s'est passé votre chantier ?</p>
            <Notes valeur={avis.note} onChange={(note) => setAvis({ ...avis, note })} label="Note globale" grand />
            <div className="cfc-crit">
              {CRITERES.map((c) => (
                <div key={c.id}><span>{c.label}</span><Notes valeur={avis.criteres[c.id] || 0} onChange={(n) => setAvis({ ...avis, criteres: { ...avis.criteres, [c.id]: n } })} label={c.label} /></div>
              ))}
            </div>
            <textarea rows={4} maxLength={1500} value={avis.texte} onChange={(e) => setAvis({ ...avis, texte: e.target.value })} placeholder="Équipe ponctuelle et propre, chantier tenu dans les temps…" aria-label="Votre avis" />
            <label className="cfc-check"><input type="checkbox" checked={avis.accordPhotos} onChange={(e) => setAvis({ ...avis, accordPhotos: e.target.checked })} /> J'accepte que les photos avant / après soient publiées, sans adresse ni visage</label>
            <p className="cfc-note">Votre avis est publié tel quel sur la page de l'entreprise, avec votre prénom et l'initiale de votre nom. Aucune contrepartie n'est proposée en échange.</p>
            <button type="button" className="cfc-send" disabled={envoi || !avis.note} onClick={envoyerAvis}>{envoi ? "Publication…" : "Publier mon avis"}</button>
          </div>
        ) : (
          <button type="button" className="cfc-cta" onClick={() => setVue("avis")}>Donner votre avis</button>
        )
      ) : null}
      {avisLe ? <p className="cfc-note">Votre avis est publié depuis le {dateLongue(avisLe)}. Merci !</p> : null}
      {message ? <p className="cfc-msg" role="status">{message}</p> : null}
    </section>
  );
}
