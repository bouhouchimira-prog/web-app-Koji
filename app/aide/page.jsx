"use client";

import "../home-pro.css";
import "./aide.css";
import { useEffect, useState } from "react";
import { THEMES_AIDE } from "../../lib/aide-guides";
import { apiSend } from "../../lib/client-api";

// Aide et support (maquette PRO-22) : « Demander à Koji » en tête (même
// assistant que PRO-18), guides par thème, contact humain, état du service
// vérifié en direct. Page publique, sans <Shell> (déclarée dans le sitemap) :
// « Demander à Koji » ouvre l'assistant dans l'espace Pro (connexion requise).
const dateCourte = (j) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${j}T12:00:00Z`));

export default function AidePage() {
  const [theme, setTheme] = useState("");
  const [question, setQuestion] = useState("");
  const [etat, setEtat] = useState(null);
  const [ecrire, setEcrire] = useState(false);
  const [message, setMessage] = useState("");
  const [envoi, setEnvoi] = useState("");
  useEffect(() => { fetch("/api/etat").then((r) => r.json()).then(setEtat).catch(() => setEtat({ fonctionne: false, texte: "État indisponible", incidents: [] })); }, []);
  const demander = (q) => { const t = String(q || "").trim(); window.location.assign(`/?koji=1${t ? `&q=${encodeURIComponent(t)}` : ""}`); };
  const ouvert = THEMES_AIDE.find((t) => t.id === theme);

  async function envoyer() {
    setEnvoi("envoi");
    try { await apiSend("/api/support/report", { message, page: "/aide", accountType: "entreprise" }); setEnvoi("ok"); setMessage(""); }
    catch (e) { setEnvoi(e.message?.includes("Session") || e.message?.includes("401") ? "connexion" : e.message || "Envoi impossible."); }
  }

  return (
    <div className="pro public-pro wide ai">
      <div className="head">
        <div className="stack">
          <button type="button" className="link" onClick={() => (window.history.length > 1 ? window.history.back() : window.location.assign("/"))}>← Retour</button>
          <span className="eyebrow">Aide</span>
          <h1>Comment pouvons-nous vous aider ?</h1>
        </div>
      </div>

      <form className="ai-k" onSubmit={(e) => { e.preventDefault(); demander(question); }}>
        <span className="ai-s" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z" /></svg></span>
        <div>
          <label htmlFor="ai-q"><b>Demander à Koji</b></label>
          <input id="ai-q" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="« Comment faire un avoir ? » · « Pourquoi je ne peux pas envoyer l'acompte ? »" />
        </div>
        <button type="submit" className="btn btn-main">Demander</button>
      </form>

      <div className="ai-g">
        <div className="ai-themes">
          {THEMES_AIDE.map((t) => (
            <button key={t.id} type="button" className={`card ai-t ${theme === t.id ? "on" : ""}`} onClick={() => setTheme(theme === t.id ? "" : t.id)} aria-expanded={theme === t.id}>
              <b>{t.titre}</b><small>{t.sous}</small><span className="link">Voir les guides</span>
            </button>
          ))}
        </div>
        <aside className="ai-side">
          <section className="card">
            <div className="card-h"><h2>Parler à quelqu'un</h2></div>
            <div className="ai-c"><b>Message au support</b><small>réponse en moins de 4 h ouvrées</small></div>
            <div className="ai-c"><b>Téléphone</b><small>offre Business · du lundi au vendredi</small></div>
            {ecrire ? (
              envoi === "ok" ? <p className="ai-ok">Message envoyé au support. Nous vous répondons par e-mail.</p> : (
                <>
                  <textarea aria-label="Votre message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Décrivez votre question ou le problème" />
                  {envoi === "connexion" ? <p className="sm2">Connectez-vous pour écrire depuis Koji, ou écrivez à <a href="mailto:entreprise@getkoji.io">entreprise@getkoji.io</a>.</p> : envoi && envoi !== "envoi" ? <p className="err">{envoi}</p> : null}
                  <button type="button" className="btn btn-main" disabled={!message.trim() || envoi === "envoi"} onClick={envoyer}>{envoi === "envoi" ? "Envoi…" : "Envoyer"}</button>
                </>
              )
            ) : <button type="button" className="btn btn-main" onClick={() => setEcrire(true)}>Écrire au support</button>}
          </section>
          <section className="card">
            <div className="card-h"><h2>État du service</h2></div>
            {!etat ? <p className="sm2">Vérification…</p> : (
              <>
                <p className={`ai-e ${etat.fonctionne ? "ok" : "ko"}`}><i />{etat.texte}</p>
                <p className="sm2">{etat.incidents?.length ? `Dernier incident : ${dateCourte(etat.incidents[0].le)}, ${etat.incidents[0].texte}` : "Aucun incident récent."}</p>
              </>
            )}
          </section>
        </aside>
      </div>

      {ouvert ? (
        <section className="card ai-gd">
          <div className="card-h"><h2>{ouvert.titre}</h2><button type="button" className="link" onClick={() => setTheme("")}>Fermer</button></div>
          {ouvert.guides.map(([titre, texte]) => (
            <details key={titre} className="ai-q" open={ouvert.guides.length <= 2}>
              <summary>{titre}</summary>
              <p>{texte}</p>
            </details>
          ))}
          <button type="button" className="link" onClick={() => demander(`${ouvert.titre} : `)}>Une autre question ? Demander à Koji</button>
        </section>
      ) : null}
    </div>
  );
}
