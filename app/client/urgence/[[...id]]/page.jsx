"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ClientTopbar, CHARTE_CLIENT } from "../../../../components/ClientTopbar";
import { fichierPourEnvoi } from "../../../../lib/fichier-client";
import { euros2 } from "../../../../lib/intervention-rapide";
import "../../../urgences/urgences.css";

// Koji Client · commander une urgence (maquette PRO-17, écrans A à D) :
// /client/urgence (A, choisir), /client/urgence/nouvelle/{type} (B, deux
// questions, photo, adresse, prix des artisans disponibles),
// /client/urgence/{id} (C, confirmer l'artisan ; D, suivre son arrivée,
// puis devis avant travaux et facture). Données : /api/client/urgences.
// Aucun prix Koji : la fourchette vient des prix des artisans disponibles,
// puis le prix exact de celui qui accepte, avant de confirmer.
const Trace = ({ d }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;
const ETOILE = "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z";
const TEL = "M5 4h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z";
const MSG = "M4 5h16v11H9l-5 4z";
const GAZ = "M12 3l9 16H3zM12 10v4M12 17v.5";
const numero = (t) => String(t || "").replace(/[^\d+]/g, "");
const FINIS = new Set(["terminee", "annulee"]);

function lire(url, options) {
  return fetch(url, { credentials: "same-origin", ...options }).then(async (r) => {
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || "Erreur."); e.status = r.status; throw e; }
    return j;
  });
}

function Cadre({ titre, sousTitre, backHref = "/client", h, children }) {
  return (
    <div className={`${CHARTE_CLIENT} kc sans-barre`}>
      <ClientTopbar titre={titre} sousTitre={sousTitre} backHref={backHref} sansBarre />
      <main className="kc-m">
        <div className="kc-body ur-cw">
          {h ? <h1 className="kc-h kc-d">{h}</h1> : null}
          {children}
        </div>
      </main>
    </div>
  );
}

function Deconnecte() {
  return (
    <Cadre titre="Urgence" sousTitre="connexion nécessaire">
      <p className="kc-p">Connectez-vous à votre espace Koji pour commander une urgence : l'artisan qui accepte reçoit votre adresse et votre téléphone quand vous confirmez.</p>
      <Link className="kc-btn" href="/login?type=particulier">Se connecter</Link>
    </Cadre>
  );
}

// A · Choisir l'urgence
function Choisir({ d }) {
  const enCours = d.urgences.find((u) => u.enCours);
  return (
    <Cadre titre="Urgence" sousTitre="un artisan chez vous rapidement" h="Urgence">
      {enCours ? <Link className="kc-ppj" href={`/client/urgence/${enCours.id}`}><div><b>{enCours.titre}</b><small>urgence en cours</small></div><span className="kc-st">Suivre</span></Link> : null}
      <h3 className="kc-ph">Que se passe-t-il ?</h3>
      <div className="ur-tiles">
        {d.categories.map((c) => <Link key={c.id} className="ur-tile" href={`/client/urgence/nouvelle/${c.id}`}><span className="ic"><Trace d={c.icone} /></span><b>{c.label}</b></Link>)}
      </div>
      <div className="ur-gas" role="note"><span><Trace d={GAZ} /></span><div><b>Odeur de gaz ?</b><small>{d.gaz.texte.split(d.gaz.numero)[0]}<span className="nw">{d.gaz.numero}</span>{d.gaz.texte.split(d.gaz.numero)[1] || ""}</small></div></div>
      <small className="ur-cf">Prix affiché avant de commander · artisans vérifiés par Koji</small>
    </Cadre>
  );
}

function Adresse({ valeur, onChange }) {
  const [suggestions, setSuggestions] = useState([]);
  useEffect(() => {
    const q = valeur.trim();
    if (q.length < 4) { setSuggestions([]); return undefined; }
    const t = setTimeout(() => {
      fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=4`).then((r) => r.json()).then((j) => setSuggestions((j.features || []).map((f) => f.properties.label).filter((l) => l !== q))).catch(() => setSuggestions([]));
    }, 350);
    return () => clearTimeout(t);
  }, [valeur]);
  return (
    <div className="ur-adr-c">
      <label htmlFor="ur-adr">Adresse</label>
      <input id="ur-adr" value={valeur} onChange={(e) => onChange(e.target.value)} placeholder="Numéro, rue, ville" autoComplete="street-address" />
      {suggestions.length ? <ul>{suggestions.map((s) => <li key={s}><button type="button" onClick={() => { onChange(s); setSuggestions([]); }}>{s}</button></li>)}</ul> : null}
    </div>
  );
}

// B · 2 questions et le prix
function Questions({ d, categorie }) {
  const router = useRouter();
  const c = d.categories.find((x) => x.id === categorie);
  const [reponses, setReponses] = useState({});
  const [adresse, setAdresse] = useState(d.adresse || "");
  const [complement, setComplement] = useState("");
  const [telephone, setTelephone] = useState(d.telephone || "");
  const [photo, setPhoto] = useState("");
  const [prix, setPrix] = useState(null); // { quartier, disponibles, prix } | { erreur }
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState("");
  const fichier = useRef(null);

  useEffect(() => {
    const q = adresse.trim();
    if (q.length < 6) { setPrix(null); return undefined; }
    const t = setTimeout(() => {
      lire(`/api/client/urgences?prix=1&categorie=${encodeURIComponent(categorie)}&adresse=${encodeURIComponent(q)}`).then(setPrix).catch((e) => setPrix({ erreur: e.message }));
    }, 700);
    return () => clearTimeout(t);
  }, [adresse, categorie]);

  if (!c) return <Choisir d={d} />;
  const complet = c.questions.every((q) => reponses[q.id]);
  const telOk = telephone.replace(/\D/g, "").length >= 10;
  const possible = complet && telOk && prix?.prix && !busy;

  async function choisirPhoto(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try { setPhoto(await fichierPourEnvoi(f, { cote: 1600, qualite: 0.8 })); } catch (er) { setErreur(er.message); }
  }
  async function commander() {
    setBusy(true);
    setErreur("");
    try {
      const r = await lire("/api/client/urgences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "commander", categorie, reponses, adresse, complement, telephone, photo }) });
      router.replace(`/client/urgence/${r.urgence.id}`);
    } catch (er) { setErreur(er.message); setBusy(false); }
  }

  return (
    <Cadre titre={c.label} sousTitre="2 questions et c'est parti" backHref="/client/urgence" h={c.label}>
      {c.questions.map((q) => (
        <div key={q.id} className="ur-q" role="radiogroup" aria-label={q.label}>
          <span>{q.label}</span>
          <div className="ur-ch">{q.options.map((o) => <button key={o} type="button" role="radio" aria-checked={reponses[q.id] === o} className={reponses[q.id] === o ? "on" : ""} onClick={() => setReponses({ ...reponses, [q.id]: o })}>{o}</button>)}</div>
        </div>
      ))}
      <div className="ur-cph">
        <input ref={fichier} type="file" accept="image/*" capture="environment" hidden onChange={choisirPhoto} />
        <button type="button" className="ph-i ur-phb" onClick={() => fichier.current?.click()} aria-label={photo ? "Changer la photo" : "Ajouter une photo (facultatif)"}>
          {photo ? <img src={photo} alt="" /> : <span className="ur-phv">+</span>}
          <span className="ph-k">Photo</span>
        </button>
        <Adresse valeur={adresse} onChange={setAdresse} />
      </div>
      <div className="kc-fld"><label htmlFor="ur-cpl">Étage, code, accès (facultatif)</label><input id="ur-cpl" value={complement} onChange={(e) => setComplement(e.target.value)} placeholder="3e gauche · code 4521B" /></div>
      {!d.telephone ? <div className="kc-fld"><label htmlFor="ur-tel">Téléphone</label><input id="ur-tel" type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} autoComplete="tel" /></div> : null}
      <small className="kc-s">Votre adresse exacte, l'accès et votre téléphone ne sont donnés à l'artisan qu'après votre confirmation ; avant, il ne voit que le quartier.</small>
      {prix?.prix ? (
        <div className="ur-price"><span>Prix d'intervention</span><b>{prix.prix.montant}</b><small>{prix.prix.detail}</small>{prix.prix.note ? <small>{prix.prix.note}</small> : null}</div>
      ) : prix?.erreur ? <p className="kc-alerte">{prix.erreur}</p> : prix ? (
        <div className="ur-price"><span>Prix d'intervention</span><small>Aucun artisan n'est disponible près de chez vous pour cette urgence en ce moment. <Link className="kc-lien" href="/client/radar/new">Décrire mon besoin pour un rendez-vous</Link></small></div>
      ) : <small className="kc-s">Indiquez votre adresse pour voir le prix des artisans disponibles.</small>}
      {erreur ? <p className="kc-alerte" role="alert">{erreur}</p> : null}
      <button type="button" className="kc-btn" disabled={!possible} onClick={commander}>{busy ? "Envoi…" : "Trouver un artisan"}</button>
    </Cadre>
  );
}

function Etoiles({ moyenne }) {
  const n = Math.round(Number(String(moyenne).replace(",", ".")) || 0);
  return <span className="av-st">{[0, 1, 2, 3, 4].map((k) => <i key={k} className={k < n ? "on" : ""}><Trace d={ETOILE} /></i>)}</span>;
}

// C et D · une urgence
function Suivi({ id }) {
  const router = useRouter();
  const [u, setU] = useState(null);
  const [erreur, setErreur] = useState("");
  const [deconnecte, setDeconnecte] = useState(false);
  const [busy, setBusy] = useState("");
  const charger = useCallback(() => lire(`/api/client/urgences?id=${encodeURIComponent(id)}`).then((r) => { setU(r.urgence); }).catch((e) => { if (e.status === 401) setDeconnecte(true); else setErreur(e.message); }), [id]);
  useEffect(() => { charger(); }, [charger]);
  const etat = u?.etat;
  useEffect(() => {
    if (!etat || FINIS.has(etat)) return undefined;
    const t = setInterval(charger, ["recherche", "acceptee"].includes(etat) ? 4000 : 15000);
    return () => clearInterval(t);
  }, [etat, charger]);

  async function agir(action) {
    if (action === "annuler" && !window.confirm("Annuler cette urgence ? C'est sans frais.")) return;
    setBusy(action);
    setErreur("");
    try { const r = await lire("/api/client/urgences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, id }) }); setU(r.urgence); } catch (e) { setErreur(e.message); }
    setBusy("");
  }

  if (deconnecte) return <Deconnecte />;
  if (!u) return <Cadre titre="Urgence" h="Urgence">{erreur ? <p className="kc-alerte">{erreur}</p> : <p className="kc-s">Chargement…</p>}</Cadre>;
  const a = u.artisan;
  const annuler = u.actions.annuler ? <button type="button" className="ur-cancel" disabled={Boolean(busy)} onClick={() => agir("annuler")}>Annuler sans frais</button> : null;
  const erreurs = erreur ? <p className="kc-alerte" role="alert">{erreur}</p> : null;

  if (u.etat === "acceptee" && a) {
    return (
      <Cadre titre="Un artisan a accepté" sousTitre="confirmez pour qu'il parte" h="Un artisan a accepté">
        <div className="ur-pro"><span className="ur-av">{a.initiales}</span><div><b>{a.nom}</b><small>{a.avis ? <><Etoiles moyenne={a.avis.moyenne} /> {a.avis.moyenne}</> : null}{a.avis && a.urgences ? " · " : ""}{a.urgences ? `${a.urgences} urgence${a.urgences > 1 ? "s" : ""}` : a.avis ? "" : "nouveau sur Koji Urgences"}</small></div></div>
        {a.verifie ? <div className="ur-ver"><Trace d="M4 12l5 5L20 6" /><span>Identité, SIREN et assurance vérifiés par Koji</span></div> : null}
        <div className="kc-cr"><span>Arrivée</span><b>{a.arrivee}</b></div>
        <div className="kc-cr"><span>Prix</span><b>{a.prix}</b></div>
        <div className="kc-cr"><span>Pièces</span><b>{a.pieces}</b></div>
        <div className="kc-info">{a.info}</div>
        {erreurs}
        <button type="button" className="kc-btn" disabled={Boolean(busy)} onClick={() => agir("confirmer")}>{busy === "confirmer" ? "Confirmation…" : "Confirmer"}</button>
        {annuler}
      </Cadre>
    );
  }

  if (u.suivi && a) {
    return (
      <Cadre titre={u.titre} sousTitre={a.entreprise} h={u.suivi.titre}>
        <div className="ur-csheet">
          <h3 className="kc-ph kc-t">{u.suivi.titre}</h3>
          {u.suivi.sousTitre ? <small className="ur-cs">{u.suivi.sousTitre}</small> : null}
          <div className="ur-cst">{u.suivi.etapes.map((e) => <span key={e.libelle} className="ur-cse"><i className={e.fait ? "ok" : ""} /><span>{e.libelle}</span></span>)}</div>
          {a.telephone ? <div className="ur-c2"><a className="ur-ob" href={`tel:${numero(a.telephone)}`}><Trace d={TEL} />Appeler</a><a className="ur-ob" href={`sms:${numero(a.telephone)}`}><Trace d={MSG} />Message</a></div> : null}
          {u.suivi.note ? <div className="kc-info">{u.suivi.note}</div> : null}
          {u.devis ? (
            <div className="ur-dvc"><span className="lab">Devis avant travaux signé</span>{u.devis.lignes.map((l, k) => <div key={k} className="kc-cr"><span>{l.label}</span><b>{euros2(l.montant)}</b></div>)}<div className="kc-cr"><span>Total TTC</span><b>{euros2(u.devis.total)}</b></div></div>
          ) : null}
          {u.facture ? <a className="kc-sec" href={u.facture.pdf}>Facture {u.facture.numero} · {euros2(u.facture.montant)}{u.facture.payee ? " · payée" : ""}</a> : null}
          <div className="kc-cr"><span>Adresse</span><b>{u.adresse}</b></div>
          <div className="kc-cr"><span>Prix annoncé</span><b>{a.prix}</b></div>
          {erreurs}
          {annuler}
        </div>
      </Cadre>
    );
  }

  const titres = { recherche: ["Recherche d'un artisan", "les plus proches sont prévenus"], sans_artisan: ["Aucun artisan disponible", "pour l'instant"], expiree: ["Délai dépassé", "l'artisan a été libéré"], annulee: ["Urgence annulée", "sans frais"], terminee: ["Intervention terminée", ""] };
  const [t, st] = titres[u.etat] || ["Urgence", ""];
  return (
    <Cadre titre={t} sousTitre={st} h={t}>
      <p className="kc-p">{u.message}</p>
      {u.etat === "recherche" ? <div className="ur-wait" aria-live="polite"><i /><span>Un artisan accepte en général en quelques minutes.</span></div> : null}
      <div className="kc-cr"><span>Urgence</span><b>{u.titre}</b></div>
      <div className="kc-cr"><span>Adresse</span><b>{u.adresse}</b></div>
      {u.prix ? <div className="ur-price"><span>Prix d'intervention</span><b>{u.prix.montant}</b><small>{u.prix.detail}</small></div> : null}
      {erreurs}
      {u.actions.relancer ? <button type="button" className="kc-btn" disabled={Boolean(busy)} onClick={() => agir("relancer")}>Relancer la recherche</button> : null}
      {u.etat === "sans_artisan" ? <Link className="kc-sec" href="/client/radar/new">Décrire mon besoin pour un rendez-vous</Link> : null}
      {u.etat === "annulee" || u.etat === "terminee" ? <button type="button" className="kc-btn" onClick={() => router.push("/client/urgence")}>Commander une autre urgence</button> : null}
      {annuler}
    </Cadre>
  );
}

export default function UrgenceClient() {
  const params = useParams();
  const morceaux = Array.isArray(params?.id) ? params.id : [];
  const [d, setD] = useState(null);
  const [etat, setEtat] = useState("chargement");
  const id = morceaux[0] && morceaux[0] !== "nouvelle" ? morceaux[0] : "";

  useEffect(() => {
    if (id) return;
    lire("/api/client/urgences").then((r) => { setD(r); setEtat("pret"); }).catch((e) => setEtat(e.status === 401 ? "deconnecte" : "erreur"));
  }, [id]);

  if (id) return <Suivi id={id} />;
  if (etat === "deconnecte") return <Deconnecte />;
  if (etat === "erreur") return <Cadre titre="Urgence" h="Urgence"><p className="kc-alerte">La page n'a pas pu être chargée.</p></Cadre>;
  if (!d) return <Cadre titre="Urgence" sousTitre="un artisan chez vous rapidement" h="Urgence"><p className="kc-s">Chargement…</p></Cadre>;
  return morceaux[0] === "nouvelle" ? <Questions d={d} categorie={morceaux[1] || ""} /> : <Choisir d={d} />;
}
