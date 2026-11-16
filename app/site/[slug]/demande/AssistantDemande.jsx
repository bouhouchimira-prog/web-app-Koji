"use client";

import { useEffect, useRef, useState } from "react";
import { DM_Sans, Shippori } from "../../../fonts";
import { fichierPourEnvoi } from "../../../../lib/fichier-client";
import { ACCES, BUDGETS, PIECES, QUAND, TRAVAUX_PAR_PIECE, etapesAssistant } from "../../../../lib/kojipage";
import { useSitePublic, Badges } from "../SitePublic";
import "../../../particulier/landing.css";
import "../site-public.css";

// Demande de devis avec l'assistant Koji (maquette PRO-13.5) : questions
// guidées avec réponses en un geste, « Votre projet » qui se remplit au fil
// des réponses, photos, coordonnées et consentement à l'envoi. Adressée à
// cette entreprise seulement. Pas de prix recommandé côté client (décision
// du 10 nov.) : le budget, facultatif, aide seulement l'entreprise à
// proposer des variantes.
const ETAPES = ["piece", "surface", "travaux", "budget", "photos", "acces", "quand", "contact"];
const initiales = (nom = "") => { const m = String(nom || "K").split(/\s+/).filter(Boolean); return (/^[A-Z]{2,}$/.test(m[0] || "") ? m[0].slice(0, 2) : m.slice(0, 2).map((x) => x[0]).join("")).toUpperCase(); };
const delaiTexte = (h) => (h == null ? "" : h < 1 ? "moins d'1 h" : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} jours`);

function Projet({ p, photos, nom }) {
  return (
    <div className="kpa-projet">
      <b>Votre projet</b><small>se remplit au fil de vos réponses</small>
      <dl>
        <dt>Pièce</dt><dd>{p.piece ? `${p.piece}${p.surface ? ` · ${p.surface} m²` : ""}` : "à préciser"}</dd>
        <dt>Travaux</dt><dd>{p.travaux.length ? p.travaux.map((t) => <span key={t}>{t}</span>) : "à préciser"}{p.precisions ? <span>{p.precisions}</span> : null}</dd>
        {p.budgetChoix ? <><dt>Votre budget</dt><dd>{p.budgetChoix}<small>Facultatif : il aide {nom} à vous proposer des variantes.</small></dd></> : null}
        <dt>Photos</dt><dd>{photos.length ? `${photos.length} ajoutée${photos.length > 1 ? "s" : ""}` : "aucune"}</dd>
        <dt>Accès</dt><dd>{p.acces || "à préciser"}</dd>
        <dt>Quand</dt><dd>{p.quand || "à préciser"}</dd>
      </dl>
      <p className="kps-mut">Le devis de {nom} fixera le prix. Votre adresse exacte n'est demandée qu'au moment d'accepter un devis.</p>
    </div>
  );
}

export function AssistantDemande({ slug }) {
  const { site, erreur } = useSitePublic(slug);
  const [etape, setEtape] = useState(0);
  const [p, setP] = useState({ piece: "", surface: "", travaux: [], precisions: "", budgetChoix: "", acces: "", quand: "" });
  const [photos, setPhotos] = useState([]);
  const [contact, setContact] = useState({ name: "", phone: "", email: "", city: "" });
  const [consentement, setConsentement] = useState(false);
  const [libre, setLibre] = useState("");
  const [busy, setBusy] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [err, setErr] = useState("");
  const [voirProjet, setVoirProjet] = useState(false);
  const fin = useRef(null);
  const [source, setSource] = useState("assistant");
  useEffect(() => {
    try {
      const p0 = new URLSearchParams(window.location.search);
      if (p0.get("src") === "carte") sessionStorage.setItem(`koji-src-${slug}`, "carte");
      if (sessionStorage.getItem(`koji-src-${slug}`) === "carte") setSource("carte");
      const brouillon = JSON.parse(localStorage.getItem(`koji-demande-${slug}`) || "null");
      if (brouillon?.p) { setP(brouillon.p); setEtape(brouillon.etape || 0); }
    } catch { /* stockage indisponible */ }
  }, [slug]);
  useEffect(() => {
    try { localStorage.setItem(`koji-demande-${slug}`, JSON.stringify({ p, etape })); } catch { /* stockage indisponible */ }
    fin.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [p, etape, slug]);

  if (erreur) return <div className={`lc kps ${DM_Sans.variable} ${Shippori.variable}`}><main className="kps-vide"><h1>Page introuvable</h1><p>{erreur}</p></main></div>;
  if (!site) return <div className={`lc kps ${DM_Sans.variable} ${Shippori.variable}`}><main className="kps-vide"><p>Chargement…</p></main></div>;
  const nom = site.title || site.name;
  if (!site.sections.formulaire) return <div className={`lc kps ${DM_Sans.variable} ${Shippori.variable}`}><main className="kps-vide"><h1>{nom}</h1><p>Cette entreprise ne reçoit pas encore de demandes par sa page.{site.phone ? ` Appelez-la au ${site.phone}.` : ""}</p><a className="kps-btn" href={`/site/${slug}`}>Retour à la page</a></main></div>;
  const cle = ETAPES[etape];
  const suivant = () => setEtape((e) => Math.min(ETAPES.length - 1, e + 1));
  const prog = etapesAssistant({ ...p, photosVues: etape > 4 });
  async function ajouterPhotos(e) {
    const files = [...(e.target.files || [])].slice(0, 3 - photos.length);
    e.target.value = "";
    try { const urls = await Promise.all(files.map((x) => fichierPourEnvoi(x, { cote: 1200, qualite: 0.8 }))); setPhotos((ph) => [...ph, ...urls].slice(0, 3)); } catch (er) { setErr(er.message); }
  }
  async function envoyer() {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/site/${slug}/lead`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...contact, projet: p, budgetChoix: p.budgetChoix, photos, consentement, source }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Envoi impossible.");
      setEnvoye(true);
      try { localStorage.removeItem(`koji-demande-${slug}`); } catch { /* rien */ }
    } catch (er) { setErr(er.message); }
    setBusy(false);
  }
  const travauxProposes = TRAVAUX_PAR_PIECE[p.piece] || TRAVAUX_PAR_PIECE.Autre;
  const bulle = (texte) => <div className="kpa-k"><span>K</span><p>{texte}</p></div>;
  const reponse = (texte) => (texte ? <div className="kpa-moi"><p>{texte}</p></div> : null);
  const choix = (options, onPick, actif = []) => <div className="kpa-chips">{options.map((o) => <button type="button" key={o} className={actif.includes(o) ? "on" : ""} onClick={() => onPick(o)}>{o}</button>)}</div>;

  if (envoye) return (
    <div className={`lc kps ${DM_Sans.variable} ${Shippori.variable}`} style={{ "--bandeau": site.couleur }}>
      <main className="kps-vide"><h1>Demande envoyée</h1><p>{nom} a reçu votre projet et vous répond par e-mail ou par téléphone{site.delaiReponse != null ? `, en ${delaiTexte(site.delaiReponse)} en moyenne` : ""}.</p><a className="kps-btn" href={`/site/${slug}`}>Retour à la page de {nom}</a></main>
    </div>
  );

  return (
    <div className={`lc kps kpa ${DM_Sans.variable} ${Shippori.variable}`} style={{ "--bandeau": site.couleur }}>
      <header className="kps-h">
        <a className="kps-id" href={`/site/${slug}`}><span className="kps-lg">{site.logoDataUrl ? <img src={site.logoDataUrl} alt="" /> : initiales(nom)}</span><b>{nom}</b></a>
        <span className="kpa-t">Demande de devis avec l'assistant Koji</span>
        <a className="kps-lien" href={`/site/${slug}`}>Quitter</a>
      </header>
      <div className="kpa-grid">
        <main className="kpa-chat">
          <small className="kps-mut">Étape {Math.min(prog.faite + 1, prog.total)} sur {prog.total}</small>
          {bulle(<>Bonjour, je prépare votre demande de devis pour <b>{nom}</b>. Quelle pièce voulez-vous rénover ?</>)}
          {cle === "piece" ? choix(PIECES, (o) => { setP({ ...p, piece: o, travaux: [] }); suivant(); }) : reponse(p.piece)}
          {etape >= 1 ? <>{bulle("Quelle surface environ ? Une estimation suffit.")}
            {cle === "surface" ? <form className="kpa-in" onSubmit={(e) => { e.preventDefault(); suivant(); }}><input type="number" min="1" inputMode="decimal" value={p.surface} onChange={(e) => setP({ ...p, surface: e.target.value })} placeholder="5" aria-label="Surface en m²" /><span>m²</span><button type="submit" className="kps-btn">{p.surface ? "Continuer" : "Je ne sais pas"}</button></form> : reponse(p.surface ? `${p.surface} m²` : "Je ne sais pas")}</> : null}
          {etape >= 2 ? <>{bulle("Que souhaitez-vous faire ? Plusieurs choix possibles.")}
            {cle === "travaux" ? <>{choix(travauxProposes, (o) => setP({ ...p, travaux: p.travaux.includes(o) ? p.travaux.filter((x) => x !== o) : [...p.travaux, o] }), p.travaux)}
              <textarea className="kpa-libre" rows={2} value={p.precisions} onChange={(e) => setP({ ...p, precisions: e.target.value })} placeholder="Précisez si besoin : ce que vous gardez, ce qui vous gêne…" aria-label="Précisions" />
              <button type="button" className="kps-btn" disabled={!p.travaux.length && !p.precisions.trim()} onClick={suivant}>Continuer</button></> : reponse([p.travaux.join(", "), p.precisions].filter(Boolean).join(". "))}</> : null}
          {etape >= 3 ? <>{bulle(`Avez-vous un budget en tête ? C'est facultatif ; il aide ${nom} à vous proposer des variantes.`)}
            {cle === "budget" ? <>{choix(BUDGETS, (o) => { setP({ ...p, budgetChoix: o === "Je ne sais pas" ? "" : o }); suivant(); })}<form className="kpa-in" onSubmit={(e) => { e.preventDefault(); if (libre.trim()) { setP({ ...p, budgetChoix: `Autour de ${libre.trim()} €` }); setLibre(""); suivant(); } }}><input inputMode="numeric" value={libre} onChange={(e) => setLibre(e.target.value.replace(/[^\d ]/g, ""))} placeholder="ou un montant" aria-label="Budget en euros" /><span>€</span><button type="submit" className="kps-btn sec">OK</button></form></> : reponse(p.budgetChoix || "Je ne sais pas")}</> : null}
          {etape >= 4 ? <>{bulle(`Avez-vous des photos de la pièce ? Elles aident ${nom} à chiffrer sans visite.`)}
            {cle === "photos" ? <><div className="kps-photos">{photos.map((ph) => <button type="button" key={ph.slice(-24)} style={{ backgroundImage: `url(${ph})` }} onClick={() => setPhotos(photos.filter((x) => x !== ph))} aria-label="Retirer la photo">×</button>)}{photos.length < 3 ? <label className="kps-add">+ Photos<input type="file" accept="image/*" multiple hidden onChange={ajouterPhotos} /></label> : null}</div><button type="button" className="kps-btn" onClick={suivant}>{photos.length ? "Continuer" : "Pas de photo"}</button></> : reponse(photos.length ? `${photos.length} photo${photos.length > 1 ? "s" : ""}` : "Pas de photo")}</> : null}
          {etape >= 5 ? <>{bulle("Merci. À quel étage est le logement ?")}
            {cle === "acces" ? choix(ACCES, (o) => { setP({ ...p, acces: o }); suivant(); }) : reponse(p.acces)}</> : null}
          {etape >= 6 ? <>{bulle("Dernière question : quand souhaitez-vous faire les travaux ?")}
            {cle === "quand" ? choix(QUAND, (o) => { setP({ ...p, quand: o }); suivant(); }) : reponse(p.quand)}</> : null}
          {cle === "contact" ? (
            <div className="kpa-contact">
              {bulle(`Votre projet est prêt. Comment ${nom} peut-il vous répondre ?`)}
              <div className="kps-2">
                <label>Prénom et nom<input value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} autoComplete="name" /></label>
                <label>Ville<input value={contact.city} onChange={(e) => setContact({ ...contact, city: e.target.value })} autoComplete="address-level2" /></label>
                <label>Téléphone mobile<input value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} autoComplete="tel" inputMode="tel" /></label>
                <label>E-mail<input type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} autoComplete="email" /></label>
              </div>
              <label className="kps-check"><input type="checkbox" checked={consentement} onChange={(e) => setConsentement(e.target.checked)} /> J'accepte que mes coordonnées soient transmises à {nom} pour cette demande.</label>
              {err ? <p className="kps-err" role="alert">{err}</p> : null}
              <button type="button" className="kps-btn" disabled={busy || !consentement || !contact.name.trim() || !(contact.phone.trim() || contact.email.trim())} onClick={envoyer}>{busy ? "Envoi…" : `Envoyer ma demande à ${nom}`}</button>
              <small className="kps-mut">Adressée à cette entreprise seulement. Votre projet est gardé sur cet appareil si vous quittez.</small>
            </div>
          ) : null}
          {etape > 0 && cle !== "contact" ? <button type="button" className="kps-lien" onClick={() => setEtape((e) => Math.max(0, e - 1))}>Revenir à la question précédente</button> : null}
          <div ref={fin} />
        </main>
        <aside className={`kpa-side${voirProjet ? " ouvert" : ""}`}>
          <div className="kpa-dest"><span className="kps-lg">{site.logoDataUrl ? <img src={site.logoDataUrl} alt="" /> : initiales(nom)}</span><div><b>Votre demande sera envoyée à {nom}</b><Badges site={site} /></div></div>
          <Projet p={p} photos={photos} nom={nom} />
        </aside>
      </div>
      <button type="button" className="kpa-band" onClick={() => setVoirProjet(!voirProjet)}>{voirProjet ? "Retour au chat" : `Votre projet · ${p.travaux.length} travaux · ${photos.length} photo${photos.length > 1 ? "s" : ""}`}<span>{voirProjet ? "×" : "Voir"}</span></button>
    </div>
  );
}
