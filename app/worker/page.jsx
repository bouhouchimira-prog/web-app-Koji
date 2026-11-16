"use client";

import { useEffect, useRef, useState } from "react";
import "./worker.css";
import { heuresMinutes, jourCourt } from "../../lib/equipe-pro";
import { LANGUES } from "../../lib/compte-pro";

// Vue compagnon sur ordinateur (maquette PRO-16.5) et sur téléphone par le
// lien reçu par SMS : ma journée, ma semaine, mes heures, mes documents ;
// « Je suis arrivé » / « Je pars » (une seule source avec l'app). Ni prix,
// ni devis, ni nom de client. Données : /api/compagnon.
const Check = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>;
const Horloge = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2" /></svg>;
const Danger = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l9 16H3zM12 10v4M12 17h.01" /></svg>;
const ONGLETS = [["journee", "Ma journée"], ["semaine", "Ma semaine"], ["heures", "Mes heures"], ["documents", "Mes documents"]];
const dateLongue = (jour) => new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${jour}T12:00:00Z`)).replace(/^./, (c) => c.toUpperCase());
const dateCourte = (jour) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${jour}T12:00:00Z`));
const heure = (hhmm = "") => String(hhmm).replace(/^0(?=\d)/, "").replace(":", " h ");
const hm = (min) => (min ? heuresMinutes(min) : "—");

async function api(path, options = {}) {
  const r = await fetch(path, { credentials: "same-origin", ...options });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(data.error || `Erreur ${r.status}`); e.status = r.status; throw e; }
  return data;
}
const poster = (corps) => api("/api/compagnon", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) });

function Connexion({ onConnecte }) {
  const [code, setCode] = useState("");
  const [ancien, setAncien] = useState(false);
  const [id, setId] = useState("");
  const [mdp, setMdp] = useState("");
  const [erreur, setErreur] = useState("");
  const [busy, setBusy] = useState(false);
  const expiree = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("invitation") === "expiree";
  async function envoyer(e) {
    e.preventDefault();
    setBusy(true);
    setErreur("");
    try {
      if (ancien) await api("/api/worker-auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: id, password: mdp }) });
      else await api("/api/compagnon/connexion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      onConnecte();
    } catch (er) { setErreur(er.message); }
    setBusy(false);
  }
  return (
    <div className="wk-login">
      <form className="card" onSubmit={envoyer}>
        <h1>Koji · compagnon</h1>
        {expiree ? <p className="wk-err">Ce lien a expiré. Demandez à votre entreprise de vous renvoyer l'invitation.</p> : null}
        {ancien ? (
          <>
            <p>Identifiant et mot de passe donnés par votre entreprise.</p>
            <input type="text" aria-label="Identifiant" placeholder="Identifiant" value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" />
            <input type="password" aria-label="Mot de passe" placeholder="Mot de passe" value={mdp} onChange={(e) => setMdp(e.target.value)} autoComplete="current-password" style={{ width: "100%", border: "1px solid #D9D9D4", borderRadius: 2, padding: "8px 10px", font: "inherit" }} />
          </>
        ) : (
          <>
            <p>Ouvrez le lien reçu par SMS, ou entrez le code de 8 caractères qu'il contient.</p>
            <input type="text" className="wk-code" aria-label="Code d'invitation" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} autoComplete="one-time-code" />
          </>
        )}
        {erreur ? <p className="wk-err">{erreur}</p> : null}
        <button type="submit" className="btn btn-main" disabled={busy || (ancien ? !id || !mdp : code.length !== 8)}>{busy ? "Connexion…" : "Ouvrir ma journée"}</button>
        <button type="button" className="link" onClick={() => setAncien(!ancien)}>{ancien ? "J'ai un code d'invitation" : "J'ai un identifiant et un mot de passe"}</button>
      </form>
    </div>
  );
}

function Tache({ t, onRetour, onPhoto, busy }) {
  const [coches, setCoches] = useState([]);
  return (
    <div className="card">
      <div className="card-h"><h2>{t.label}</h2><button type="button" className="link" onClick={onRetour}>Retour</button></div>
      <p className="sm2" style={{ marginTop: -6 }}>{t.chantier}{t.lot ? ` · ${t.lot}` : ""}</p>
      <div className="wk-desc">
        <span className="wk-lab">Ce qu'il faut faire</span>
        <p>{t.consigne || t.label}{t.quantite ? ` · ${String(t.quantite).replace(".", ",")} ${t.unite}` : ""}</p>
      </div>
      {t.aPrendre.length ? (
        <div className="wk-desc">
          <span className="wk-lab">À prendre au dépôt</span>
          {t.aPrendre.map((a, i) => (
            <div key={i} className={`tk-r ${coches.includes(i) ? "ok" : ""}`}>
              <button type="button" className={`kj-cb ${coches.includes(i) ? "on" : ""}`} aria-label={a.label} onClick={() => setCoches((c) => (c.includes(i) ? c.filter((x) => x !== i) : [...c, i]))}>{coches.includes(i) ? <Check /> : null}</button>
              <div className="tk-b"><b>{a.label}</b>{a.quantite ? <small>{String(a.quantite).replace(".", ",")} {a.unite}</small> : null}</div>
            </div>
          ))}
        </div>
      ) : null}
      <button type="button" className="btn btn-main" disabled={busy} onClick={() => onPhoto(t)}>{busy ? "Envoi…" : "Photo de fin"}</button>
      <p className="sm2">Envoyée à votre chef et au chantier ; jamais au client sans son accord. La date et l'heure sont ajoutées.</p>
    </div>
  );
}

export default function WorkerPage() {
  const [d, setD] = useState(null);
  const [connecte, setConnecte] = useState(null);
  const [onglet, setOnglet] = useState("journee");
  const [tache, setTache] = useState(null);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [probleme, setProbleme] = useState("");
  const fichier = useRef(null);
  const cible = useRef({ mode: "fin", taskId: "" });

  const charger = () => api("/api/compagnon").then((r) => { setD(r); setConnecte(true); }).catch((e) => { if (e.status === 401 || e.status === 403) setConnecte(false); else setErreur(e.message); });
  useEffect(() => { charger(); }, []);
  useEffect(() => {
    if (!d?.journee?.pointage?.ouvert) return undefined;
    const t = setInterval(charger, 60000);
    return () => clearInterval(t);
  }, [d?.journee?.pointage?.ouvert]);

  if (connecte === false) return <div className="wkp"><Connexion onConnecte={() => { window.history.replaceState(null, "", "/worker"); charger(); }} /></div>;
  if (!d) return <div className="wkp"><div className="wk-login"><p className="sm2">{erreur || "Chargement…"}</p></div></div>;

  const j = d.journee;
  const p = j.pointage;
  async function pointer() {
    setBusy("pointer");
    setErreur("");
    try { setD(await poster({ action: p.ouvert ? "pars" : "arrive", depuis: "ordinateur" })); } catch (e) { setErreur(e.message); }
    setBusy("");
  }
  async function cocher(t) {
    try { await poster({ action: "tache", taskId: t.id, fait: !t.fait }); await charger(); } catch (e) { setErreur(e.message); }
  }
  function photo(mode, t) {
    cible.current = { mode, taskId: t?.id || "" };
    fichier.current?.click();
  }
  async function envoyerPhoto(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy("photo");
    setErreur("");
    try {
      const form = new FormData();
      form.append("file", f);
      form.append("mode", cible.current.mode);
      form.append("taskId", cible.current.taskId);
      form.append("projectId", j.projectId || "");
      if (cible.current.mode === "probleme") form.append("message", probleme);
      await api("/api/compagnon", { method: "POST", body: form });
      setMessage(cible.current.mode === "probleme" ? "Problème envoyé avec la photo." : "Photo de fin envoyée.");
      if (cible.current.mode === "probleme") setProbleme("");
    } catch (er) { setErreur(er.message); }
    setBusy("");
  }
  async function envoyerProbleme() {
    setBusy("probleme");
    try { await poster({ action: "probleme", message: probleme }); setProbleme(""); setMessage("Message envoyé."); } catch (e) { setErreur(e.message); }
    setBusy("");
  }
  async function langue(l) {
    try { await poster({ action: "langue", langue: l }); await charger(); } catch (e) { setErreur(e.message); }
  }
  async function deconnecter() {
    await api("/api/compagnon/connexion", { method: "DELETE" }).catch(() => null);
    setD(null);
    setConnecte(false);
  }

  const semaine = (
    <div className="card">
      <div className="card-h"><h2>Ma semaine</h2><span className="sm2">{hm(d.semaine.minutes)} pointées</span></div>
      <div className="wk-l">
        {d.semaine.jours.map((s) => (
          <div key={s.jour} className={`wk-d ${s.aujourdhui ? "on" : ""} ${s.chantier === "Repos" || s.chantier === "Congé" ? "off" : ""}`}>
            <span className="wk-dd">{jourCourt(s.jour)}</span>
            <div><strong>{s.chantier || "—"}{s.avec.length ? ` · avec ${s.avec.join(", ")}` : ""}</strong>{onglet === "semaine" && s.horaire ? <small>{s.horaire}</small> : null}</div>
            <em>{s.minutes ? hm(s.minutes) : s.jour > j.jour ? "" : "—"}</em>
          </div>
        ))}
      </div>
    </div>
  );
  const documents = (
    <div className="card">
      <div className="card-h"><h2>Mes documents</h2></div>
      {d.documents.length ? d.documents.map((x) => <div key={x.id} className="st-row"><div><b>{x.nom}</b><small>{x.jusqua ? `valable jusqu'au ${dateCourte(x.jusqua)}` : ""}</small></div></div>) : <p className="sm2">Aucun document enregistré par votre entreprise.</p>}
      <p className="sm2">Contrat, attestation, fiche de paie : demandez-les à {d.entreprise || "votre entreprise"}. La paie est faite hors de Koji.</p>
    </div>
  );

  return (
    <div className="wkp">
      <header className="wk-top">
        <span className="brand">KOJI</span>
        <nav aria-label="Compagnon">{ONGLETS.map(([id, l]) => <button key={id} type="button" className={onglet === id ? "on" : ""} onClick={() => { setOnglet(id); setTache(null); }}>{l}</button>)}</nav>
        <label className="wk-lang"><span className="fr">FR · </span><select aria-label="Langue des messages" value={d.compagnon.langue} onChange={(e) => langue(e.target.value)}>{LANGUES.map((l) => <option key={l.id} value={l.id}>{l.id.toUpperCase()}</option>)}</select></label>
        <span className="wk-user">{d.compagnon.nom}<button type="button" onClick={deconnecter}>Se déconnecter</button></span>
      </header>
      <input ref={fichier} type="file" accept="image/*" capture="environment" hidden onChange={envoyerPhoto} />
      <main className={`wk-main ${onglet === "journee" ? "" : "one"}`}>
        {onglet === "journee" ? (
          <>
            <div className="wk-l2">
              {erreur ? <p className="wk-err" role="alert">{erreur}</p> : null}
              {message ? <p className="wk-msg" role="status">{message}</p> : null}
              {d.messages.map((m) => <p key={m.id} className="wk-msg"><b>{m.titre}</b> · {m.message}</p>)}
              {tache ? <Tache t={tache} busy={busy === "photo"} onRetour={() => setTache(null)} onPhoto={(t) => photo("fin", t)} /> : (
                <div className="card">
                  <div className="card-h"><h2>{dateLongue(j.jour)}</h2>{p.arriveA ? <span className="tag-val"><Check />arrivé à {heure(p.arriveA)}</span> : null}</div>
                  {j.conge ? <p className="sm2">Congé aujourd'hui.</p> : j.chantier ? (
                    <div className="wk-adr"><b>{j.chantier}</b><small>{[j.adresse, j.horaire, j.avec.length ? `avec ${j.avec.join(", ")}` : ""].filter(Boolean).join(" · ")}</small></div>
                  ) : <p className="sm2">Pas de chantier prévu pour vous aujourd'hui dans le planning.</p>}
                  {j.taches.map((t) => (
                    <div key={t.id} className={`tk-r ${t.fait ? "ok" : ""}`}>
                      <button type="button" className={`kj-cb ${t.fait ? "on" : ""}`} aria-label={`${t.label} : ${t.fait ? "fait" : "à faire"}`} onClick={() => cocher(t)}>{t.fait ? <Check /> : null}</button>
                      <div className="tk-b"><b>{t.label}</b><small>{t.chantier}{t.lot ? ` · ${t.lot}` : ""}</small></div>
                      <button type="button" className="link" onClick={() => setTache(t)}>Ouvrir</button>
                    </div>
                  ))}
                  {j.taches.length ? (
                    <div className="tk-r">
                      <span className="kj-cb" aria-hidden="true" />
                      <div className="tk-b"><b>Photo de fin</b><small>{j.chantier}</small></div>
                      <button type="button" className="link" disabled={busy === "photo"} onClick={() => photo("fin", j.taches[0])}>Ouvrir</button>
                    </div>
                  ) : null}
                  {j.consignes.map((c) => <div key={c} className="eq-warn"><Danger /><span>{c}</span></div>)}
                </div>
              )}
              {semaine}
            </div>
            <div className="wk-r2">
              <div className="card wk-big2">
                <span>Aujourd'hui</span>
                <b>{p.minutes ? heuresMinutes(p.minutes) : "0 h 00"}</b>
                {j.conge ? null : p.parti && !p.ouvert ? <small className="sm2">Journée terminée. Vous pouvez pointer à nouveau si vous reprenez.</small> : null}
                {j.conge ? null : <button type="button" className="btn btn-main" disabled={busy === "pointer"} onClick={pointer}><Horloge />{busy === "pointer" ? "…" : p.ouvert ? "Je pars" : "Je suis arrivé"}</button>}
                <small className="sm2">Le pointage se fait aussi depuis le téléphone ; une seule source.</small>
              </div>
              <div className="card">
                <div className="card-h"><h2>Un problème ?</h2></div>
                <p className="sm2" style={{ margin: "0 0 10px" }}>Photo ou message : votre chef le reçoit.</p>
                <textarea aria-label="Le problème" placeholder="Décrivez le problème en quelques mots" value={probleme} onChange={(e) => setProbleme(e.target.value)} />
                <div className="wk-acts">
                  <button type="button" className="btn btn-sec" disabled={busy === "photo" || !j.projectId} onClick={() => photo("probleme")}>Envoyer une photo</button>
                  <button type="button" className="btn btn-sec" disabled={busy === "probleme" || !probleme.trim()} onClick={envoyerProbleme}>Envoyer le message</button>
                </div>
              </div>
              {documents}
            </div>
          </>
        ) : onglet === "semaine" ? (
          <div className="wk-l2">{semaine}<div className="wk-tot"><span>Cette semaine</span><b>{hm(d.semaine.minutes)}</b><small>{d.semaine.validation ? `validées le ${dateCourte(d.semaine.validation.valideLe.slice(0, 10))}` : "pointées · validation par votre entreprise en fin de semaine"}</small></div></div>
        ) : onglet === "heures" ? (
          <div className="wk-l2">
            <div className="card">
              <div className="card-h"><h2>Mes heures</h2><span className="sm2">{hm(d.semaine.minutes)}</span></div>
              <div className="wk-l">
                {d.semaine.jours.filter((s) => s.jour <= j.jour).map((s) => (
                  <div key={s.jour} className="wk-d">
                    <span className="wk-dd">{jourCourt(s.jour)}</span>
                    <div><strong>{hm(s.minutes)}</strong><small>{s.chantier}</small></div>
                    <span className={`wk-st ${s.valide ? "ok" : "wait"}`}>{s.minutes ? (s.valide ? "validé" : "à valider") : ""}</span>
                  </div>
                ))}
              </div>
              <div className="wk-tot">
                <span>Semaine précédente</span><b>{hm(d.semainePrecedente.minutes)}</b>
                <small>{d.semainePrecedente.validation ? `validée le ${dateCourte(d.semainePrecedente.validation.valideLe.slice(0, 10))}` : "pas encore validée"}{d.semainePrecedente.minutes > d.semainePrecedente.contrat * 60 ? ` · ${hm(d.semainePrecedente.minutes - d.semainePrecedente.contrat * 60)} en plus de ${d.semainePrecedente.contrat} h` : ""}</small>
              </div>
              <p className="sm2">Les heures servent au planning et au coût des chantiers. La paie est faite ailleurs, par l'entreprise. Une erreur ? Signalez-la à votre chef : il la corrige, la correction est gardée.</p>
            </div>
          </div>
        ) : (
          <div className="wk-l2">{documents}</div>
        )}
      </main>
    </div>
  );
}
