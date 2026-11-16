"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProAccountNav } from "../../components/ProAccountNav";
import { Shell } from "../../components/Shell";
import { SettingsPanel } from "../../components/SettingsPanel";
import { apiGet, apiSend } from "../../lib/client-api";
import "./parametres.css";

// Paramètres (maquettes PRO-15.1, 15.4 et 15.6) : Mon profil, Langue et
// traduction, Notifications et sécurité, Mes données. Les autres sections
// (Mon entreprise, Devis et factures, Abonnement, Éléments supprimés) sont
// leurs propres pages, dans la même navigation.
const SECTIONS = { profil: "Mon profil", langue: "Langue et traduction", notifications: "Notifications et sécurité", donnees: "Mes données" };
const dateLongue = (iso) => (iso ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso)) : "");

function Bascule({ on, onChange, label, disabled }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className={`pm-sw${on ? " on" : ""}`} onClick={() => onChange(!on)}><i /></button>;
}

function MonProfil({ d, setMessage, setErreur }) {
  const [f, setF] = useState({ prenom: d.profil.prenom, nom: d.profil.nom, telephone: d.profil.telephone });
  const [busy, setBusy] = useState("");
  async function enregistrer(e) {
    e.preventDefault();
    setBusy("profil");
    try { await apiSend("/api/compte", { profil: f }, "PATCH"); setMessage("Profil enregistré."); } catch (er) { setErreur(er.message); }
    setBusy("");
  }
  async function partout() {
    if (!window.confirm("Se déconnecter de tous les appareils, celui-ci compris ?")) return;
    setBusy("partout");
    try { await apiSend("/api/compte", { action: "deconnecter-partout" }); window.location.href = "/login?type=entreprise"; } catch (er) { setErreur(er.message); setBusy(""); }
  }
  return (
    <>
      <form className="card" onSubmit={enregistrer}>
        <div className="card-h"><h2>Mon profil</h2></div>
        <div className="fgrid">
          <label>Prénom<input value={f.prenom} onChange={(e) => setF({ ...f, prenom: e.target.value })} autoComplete="given-name" /></label>
          <label>Nom<input value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} autoComplete="family-name" /></label>
          <label>Téléphone<input value={f.telephone} onChange={(e) => setF({ ...f, telephone: e.target.value })} autoComplete="tel" inputMode="tel" /></label>
          <label>E-mail de connexion<input value={d.profil.email} readOnly /></label>
        </div>
        <div className="kv"><span>Rôle</span><b>{d.profil.role}</b></div>
        <div className="pm-act"><button type="submit" className="btn btn-main" disabled={busy === "profil"}>{busy === "profil" ? "Enregistrement…" : "Enregistrer"}</button></div>
      </form>
      <section className="card">
        <div className="card-h"><h2>Connexion</h2></div>
        <div className="row"><div className="t"><strong>Mot de passe</strong><small>{d.profil.motDePasse ? "changer le mot de passe déconnecte vos autres appareils" : "connexion par Google uniquement : vous pouvez créer un mot de passe"}</small></div><Link className="btn btn-sec" href={d.profil.motDePasse ? "/profil?tab=securite" : "/forgot-password?type=entreprise"}>{d.profil.motDePasse ? "Changer" : "Créer"}</Link></div>
        <div className="row"><div className="t"><strong>Connexion avec Google</strong><small>{d.profil.google ? `liée · ${d.profil.email}` : "non liée"}</small></div>{d.profil.google ? <span className="tag">Liée</span> : null}</div>
        <div className="row"><div className="t"><strong>Double vérification</strong><small>code par SMS sur un nouvel appareil · bientôt (fournisseur SMS à choisir)</small></div><span className="tag tag-o">Bientôt</span></div>
        <div className="row"><div className="t"><strong>Appareils connectés</strong><small>{d.profil.derniereConnexion ? `dernière connexion le ${dateLongue(d.profil.derniereConnexion)}` : "téléphones et ordinateurs connectés à ce compte"}</small></div><button type="button" className="btn btn-sec" disabled={busy === "partout"} onClick={partout}>{busy === "partout" ? "…" : "Déconnecter partout"}</button></div>
      </section>
    </>
  );
}

function Langue({ d, setD, setErreur }) {
  const r = d.langue;
  async function maj(champs) {
    const suivant = { ...r, ...champs };
    setD((x) => ({ ...x, langue: suivant }));
    try { const x = await apiSend("/api/compte", { langue: suivant }, "PATCH"); setD((y) => ({ ...y, langue: x.langue })); } catch (er) { setErreur(er.message); }
  }
  const choisie = d.langues.find((l) => l.id === r.langue) || d.langues[0];
  const fr = r.langue === "fr";
  return (
    <>
      <section className="card">
        <div className="card-h"><h2>Ma langue</h2><small className="muted">messages, Devis guidé, dictée</small></div>
        <div className="pm-langues" role="radiogroup" aria-label="Ma langue">
          {d.langues.filter((l) => !l.autre).map((l) => <button type="button" key={l.id} role="radio" aria-checked={r.langue === l.id} className={r.langue === l.id ? "on" : ""} onClick={() => maj({ langue: l.id })}><b lang={l.id} dir={l.rtl ? "rtl" : "ltr"}>{l.nom}</b><small>{l.fr}</small></button>)}
          <label className="pm-autre">Autres langues<select value={d.langues.some((l) => l.autre && l.id === r.langue) ? r.langue : ""} onChange={(e) => e.target.value && maj({ langue: e.target.value })}><option value="">Choisir…</option>{d.langues.filter((l) => l.autre).map((l) => <option key={l.id} value={l.id}>{l.nom} · {l.fr}</option>)}</select></label>
        </div>
        <p className="muted">L'interface de Koji Pro reste en français pour l'instant ; la langue choisie sert aux messages et à la lecture des devis.</p>
      </section>
      <section className="card">
        <div className="card-h"><h2>Traduction automatique</h2>{fr ? <small className="muted">choisissez une autre langue pour l'activer</small> : null}</div>
        {[["entrant", `Traduire les messages reçus en ${choisie.fr === "par défaut" ? "français" : choisie.fr}`], ["sortant", "Traduire mes messages dans la langue du client (français)"], ["apercu", "Montrer ce que le client va lire avant l'envoi"], ["original", "Toujours afficher le texte d'origine"]].map(([id, l]) => (
          <div className="kj-opt pm-opt" key={id}><span>{l}</span><Bascule on={Boolean(r[id])} disabled={fr} label={l} onChange={(v) => maj({ [id]: v })} /></div>
        ))}
        {choisie.rtl ? <div className="kj-opt pm-opt"><span>Chiffres</span><div className="kp-seg">{[["latins", "0123 latins"], ["indiens", "٠١٢٣ arabo-indiens"]].map(([id, l]) => <button type="button" key={id} className={r.chiffres === id ? "on" : ""} onClick={() => maj({ chiffres: id })}>{l}</button>)}</div></div> : null}
      </section>
      <section className="card">
        <div className="card-h"><h2>Documents officiels</h2></div>
        <p>Devis, factures, avenants et contrats sont toujours émis en français, comme la loi l'exige pour un client en France.</p>
        <div className="row"><span className="kcnt">✓</span><div className="t"><strong>Montants, dates, quantités</strong><small>jamais traduits, recopiés tels quels : une traduction qui change un chiffre est refusée</small></div></div>
      </section>
    </>
  );
}

function Notifications({ d, setD, setErreur }) {
  const n = d.notifications;
  async function maj(suivant) {
    setD((x) => ({ ...x, notifications: suivant }));
    try { const x = await apiSend("/api/compte", { notifications: suivant }, "PATCH"); setD((y) => ({ ...y, notifications: x.notifications })); } catch (er) { setErreur(er.message); }
  }
  return (
    <>
      <section className="card">
        <div className="card-h"><h2>Me prévenir quand</h2></div>
        <div className="pm-notifs" role="table" aria-label="Alertes">
          <div className="pm-nh" role="row"><span role="columnheader">Événement</span>{d.canaux.map((c) => <span key={c.id} role="columnheader">{c.label}</span>)}</div>
          {d.evenements.map((e) => (
            <div className="pm-nr" role="row" key={e.id}>
              <span role="cell">{e.label}</span>
              {d.canaux.map((c) => (
                <span role="cell" key={c.id}>
                  <input type="checkbox" aria-label={`${e.label} · ${c.label}`} disabled={c.id === "sms"} checked={Boolean(n.evenements[e.id]?.[c.id])} onChange={(x) => maj({ ...n, evenements: { ...n.evenements, [e.id]: { ...n.evenements[e.id], [c.id]: x.target.checked } } })} />
                </span>
              ))}
            </div>
          ))}
        </div>
        <div className="kj-opt pm-opt"><span>Silence le soir après 20 h et le dimanche<small className="muted"> · les e-mails partent le lendemain à 8 h</small></span><Bascule on={n.silence} label="Silence" onChange={(v) => maj({ ...n, silence: v })} /></div>
        <p className="muted">Téléphone : notifications de l'app Koji Pro. SMS : bientôt (fournisseur à choisir).</p>
      </section>
      <section className="card">
        <div className="card-h"><h2>Sécurité</h2></div>
        <div className="row"><div className="t"><strong>Mot de passe, appareils, connexion Google</strong><small>dans Mon profil</small></div><Link className="btn btn-sec" href="/parametres?section=profil">Ouvrir</Link></div>
      </section>
    </>
  );
}

function MesDonnees() {
  return (
    <>
      <section className="card">
        <div className="card-h"><h2>Importer mes données</h2></div>
        <div className="row"><div className="t"><strong>Clients et contacts</strong><small>depuis un fichier CSV (Excel : Enregistrer sous › CSV) · doublons signalés</small></div><Link className="btn btn-sec" href="/contacts?ajouter=1">Importer</Link></div>
        <div className="row"><div className="t"><strong>Vos prix</strong><small>depuis 3 à 10 factures (PDF, photo ou CSV)</small></div><Link className="btn btn-sec" href="/bibliotheque-ouvrages/factures">Importer</Link></div>
        <div className="row"><div className="t"><strong>Tarifs fournisseurs</strong><small>depuis un fichier CSV</small></div><Link className="btn btn-sec" href="/fournitures">Importer</Link></div>
        <p className="muted">Import des devis d'un autre logiciel : pas encore ; envoyez-nous le fichier à contact@getkoji.io.</p>
      </section>
      <SettingsPanel accountType="entreprise" variant="pro" sansLangue />
      <p className="muted">Après la suppression du compte, vos factures restent conservées 10 ans, comme la loi l'exige.</p>
    </>
  );
}

export default function ParametresPage() {
  const [section, setSection] = useState("profil");
  const [d, setD] = useState(null);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("section");
    if (SECTIONS[s]) setSection(s);
    apiGet("/api/compte").then(setD).catch((e) => setErreur(e.message));
  }, []);
  useEffect(() => { if (message) { const t = setTimeout(() => setMessage(""), 4000); return () => clearTimeout(t); } return undefined; }, [message]);
  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow">Paramètres{d?.entreprise?.nom ? ` · ${d.entreprise.nom}` : ""}</span>
          <h1>{SECTIONS[section]}</h1>
        </div>
      </div>
      {erreur ? <p className="notice notice-err" role="alert">{erreur}</p> : null}
      {message ? <p className="notice" role="status">{message}</p> : null}
      <div className="pf-g">
        <ProAccountNav current={section} />
        <div className="pf-c">
          {!d ? <p className="muted">Chargement…</p> : section === "profil" ? <MonProfil d={d} setMessage={setMessage} setErreur={setErreur} />
            : section === "langue" ? <Langue d={d} setD={setD} setErreur={setErreur} />
              : section === "notifications" ? <Notifications d={d} setD={setD} setErreur={setErreur} />
                : <MesDonnees />}
        </div>
      </div>
    </Shell>
  );
}
