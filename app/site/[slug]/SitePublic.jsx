"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DM_Sans, Shippori } from "../../fonts";
import { fichierPourEnvoi } from "../../../lib/fichier-client";
import "../../particulier/landing.css";
import "./site-public.css";

// KojiPage publique (maquette PRO-13.2, charte Koji Client) : l'identité de
// l'entreprise prime, Koji reste discret (sceau, pied de page). Deux façons
// de demander un devis : l'assistant Koji (recommandé) ou un message simple,
// adressés à cette entreprise seulement. Aucun prix calculé par Koji n'est
// montré au client.
const fmtNote = (n) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n || 0);
const moisAn = (iso) => (iso ? new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric" }).format(new Date(iso)) : "");
const initiales = (nom = "") => { const m = String(nom || "K").split(/\s+/).filter(Boolean); return (/^[A-Z]{2,}$/.test(m[0] || "") ? m[0].slice(0, 2) : m.slice(0, 2).map((x) => x[0]).join("")).toUpperCase(); };
const delaiTexte = (h) => (h == null ? "" : h < 1 ? "moins d'1 h" : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} jours`);
const dateFr = (j) => (j ? j.split("-").reverse().join("/") : "");

export function useSitePublic(slug, src = "") {
  const router = useRouter();
  const [site, setSite] = useState(null);
  const [erreur, setErreur] = useState("");
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const q = new URLSearchParams();
    if (p.get("apercu")) q.set("apercu", "1");
    if (src || p.get("src")) q.set("src", src || p.get("src"));
    fetch(`/api/site/${encodeURIComponent(slug)}${q.toString() ? `?${q}` : ""}`, { credentials: "same-origin" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Page introuvable.");
        if (d.redirect) { router.replace(window.location.pathname.replace(`/site/${slug}`, `/site/${d.redirect}`)); return; }
        setSite(d.site);
      })
      .catch((e) => setErreur(e.message));
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps
  return { site, erreur };
}

export function Entete({ site, lienDemande }) {
  return (
    <header className="kps-h" style={{ "--bandeau": site.couleur }}>
      <a className="kps-id" href={`/site/${site.slug}`}><span className="kps-lg">{site.logoDataUrl ? <img src={site.logoDataUrl} alt="" /> : initiales(site.name || site.title)}</span><b>{site.title || site.name}</b></a>
      <nav aria-label="Sections">
        {site.sections.realisations && site.realisations.length ? <a href={`/site/${site.slug}#realisations`}>Réalisations</a> : null}
        {site.sections.prestations && site.prestations.length ? <a href={`/site/${site.slug}#prestations`}>Prestations</a> : null}
        {site.sections.avis ? <a href={`/site/${site.slug}#avis`}>Avis</a> : null}
        <a href={`/site/${site.slug}#infos`}>Infos</a>
      </nav>
      {site.sections.formulaire ? <a className="kps-btn" href={lienDemande}>Demander un devis</a> : site.phone ? <a className="kps-btn" href={`tel:${site.phone.replace(/\s/g, "")}`}>Appeler</a> : null}
    </header>
  );
}

export function Badges({ site }) {
  return (
    <div className="kps-badges">
      {site.verifie ? <span>Vérifié par Koji</span> : null}
      {site.decennale ? <span>Décennale vérifiée</span> : null}
      {site.chantiersLivres ? <span>{site.chantiersLivres} chantier{site.chantiersLivres > 1 ? "s" : ""} livré{site.chantiersLivres > 1 ? "s" : ""} avec PV</span> : null}
      {site.avisStats?.nombre ? <span>{fmtNote(site.avisStats.moyenne)} · {site.avisStats.nombre} avis</span> : null}
      {site.sections.horaires && site.delaiReponse != null ? <span>Répond en {delaiTexte(site.delaiReponse)} en moyenne</span> : null}
    </div>
  );
}

export function Paire({ r }) {
  return (
    <div className="kps-paire">
      {r.avant[0] ? <span style={{ backgroundImage: `url(${r.avant[0]})` }}><i>Avant</i></span> : null}
      {r.apres[0] ? <span style={{ backgroundImage: `url(${r.apres[0]})` }}><i>Après</i></span> : null}
    </div>
  );
}

function MessageSimple({ site, prestation, source }) {
  const [f, setF] = useState({ name: "", phone: "", email: "", city: "", message: "" });
  const [photos, setPhotos] = useState([]);
  const [ok, setOk] = useState(false);
  const [consentement, setConsentement] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState("");
  async function ajouter(e) {
    const files = [...(e.target.files || [])].slice(0, 3 - photos.length);
    e.target.value = "";
    try { const urls = await Promise.all(files.map((x) => fichierPourEnvoi(x, { cote: 1200, qualite: 0.8 }))); setPhotos((p) => [...p, ...urls].slice(0, 3)); } catch (er) { setErreur(er.message); }
  }
  async function envoyer(e) {
    e.preventDefault();
    setBusy(true); setErreur("");
    try {
      const r = await fetch(`/api/site/${site.slug}/lead`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, prestation, photos, consentement, source }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Envoi impossible.");
      setOk(true);
    } catch (er) { setErreur(er.message); }
    setBusy(false);
  }
  if (ok) return <p className="kps-ok" role="status">Votre demande est envoyée à {site.title || site.name}. L'entreprise vous répond par e-mail ou par téléphone.</p>;
  return (
    <form className="kps-form" onSubmit={envoyer}>
      {prestation ? <p className="kps-mut">À propos de : <b>{prestation}</b></p> : null}
      <label>Votre message<textarea required rows={4} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} placeholder="Décrivez vos travaux en quelques mots." /></label>
      <div className="kps-2">
        <label>Prénom et nom<input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></label>
        <label>Ville<input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} autoComplete="address-level2" /></label>
        <label>Téléphone<input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} autoComplete="tel" inputMode="tel" /></label>
        <label>E-mail<input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" /></label>
      </div>
      <div className="kps-photos">{photos.map((p) => <button type="button" key={p.slice(-24)} style={{ backgroundImage: `url(${p})` }} onClick={() => setPhotos(photos.filter((x) => x !== p))} aria-label="Retirer la photo">×</button>)}{photos.length < 3 ? <label className="kps-add">+ Photos<input type="file" accept="image/*" multiple hidden onChange={ajouter} /></label> : null}</div>
      <label className="kps-check"><input type="checkbox" checked={consentement} onChange={(e) => setConsentement(e.target.checked)} /> J'accepte que mes coordonnées soient transmises à {site.title || site.name} pour cette demande.</label>
      {erreur ? <p className="kps-err" role="alert">{erreur}</p> : null}
      <button type="submit" className="kps-btn" disabled={busy || !consentement}>{busy ? "Envoi…" : "Envoyer ma demande"}</button>
    </form>
  );
}

export function PiedDePage({ site }) {
  return (
    <footer className="kps-f">
      <span>Page hébergée par Koji · {site.url.replace(/^https?:\/\//, "")}</span>
      <a href="/legal/mentions-legales">Mentions légales</a>
      <a href={`mailto:contact@getkoji.io?subject=${encodeURIComponent(`Signalement de la page ${site.slug}`)}`}>Signaler</a>
    </footer>
  );
}

export function SitePublic({ slug }) {
  const { site, erreur } = useSitePublic(slug);
  const [mode, setMode] = useState("");
  const [prestation, setPrestation] = useState("");
  const [tousAvis, setTousAvis] = useState(false);
  const [verif, setVerif] = useState(false);
  const [source, setSource] = useState("page");
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    try {
      if (p.get("src") === "carte") sessionStorage.setItem(`koji-src-${slug}`, "carte");
      if (sessionStorage.getItem(`koji-src-${slug}`) === "carte") setSource("carte");
    } catch { /* stockage indisponible */ }
  }, [slug]);
  if (erreur) return <div className={`lc kps ${DM_Sans.variable} ${Shippori.variable}`}><main className="kps-vide"><h1>Page introuvable</h1><p>{erreur}</p><a className="kps-btn" href="/particulier">Découvrir Koji</a></main></div>;
  if (!site) return <div className={`lc kps ${DM_Sans.variable} ${Shippori.variable}`}><main className="kps-vide"><p>Chargement…</p></main></div>;
  const nom = site.title || site.name;
  const lienDemande = `/site/${site.slug}/demande`;
  const avis = tousAvis ? site.avis : site.avis.slice(0, 3);
  return (
    <div className={`lc kps ${DM_Sans.variable} ${Shippori.variable}`} style={{ "--bandeau": site.couleur }}>
      {site.apercu ? <div className="kps-apercu">Aperçu de votre brouillon : les modifications ne sont pas encore publiées.</div> : null}
      <Entete site={site} lienDemande="#demande" />
      <section className="kps-hero">
        <div>
          {site.tagline ? <span className="lc-ey">{site.tagline}</span> : null}
          <h1>{nom}</h1>
          {site.presentationText ? <p>{site.presentationText}</p> : null}
          {site.dirigeant ? <div className="kps-who">{site.photoDirigeant ? <img src={site.photoDirigeant} alt={site.dirigeant} /> : <span>{initiales(site.dirigeant)}</span>}<p><b>{site.dirigeant}</b> dirigeant{site.sections.formulaire ? ", répond à vos demandes" : ""}</p></div> : null}
          <Badges site={site} />
          <div className="kps-acts">
            {site.sections.formulaire ? <a className="kps-btn" href="#demande">Demander un devis</a> : null}
            {site.sections.realisations && site.realisations.length ? <a className="kps-btn sec" href="#realisations">Voir les réalisations</a> : null}
          </div>
        </div>
      </section>

      {site.sections.realisations && site.realisations.length ? (
        <section id="realisations" className="kps-sec">
          <div className="lc-sh"><h2>Réalisations</h2><p>{site.realisations.length} chantier{site.realisations.length > 1 ? "s" : ""} · photos avant et après</p></div>
          <div className="kps-reals">
            {site.realisations.map((r) => (
              <article key={r.id} className="kps-real"><Paire r={r} /><h3>{r.name}</h3><small>{[r.lieu, r.duree].filter(Boolean).join(" · ")}</small>{r.texte ? <p>{r.texte}</p> : null}</article>
            ))}
          </div>
        </section>
      ) : null}

      {site.sections.prestations && site.prestations.length ? (
        <section id="prestations" className="kps-sec alt">
          <div className="lc-sh"><h2>Prestations</h2><p>Prix indicatifs, le devis précise le prix selon votre chantier.</p></div>
          <div className="kps-prs">
            {site.prestations.map((p) => (
              <div key={p.nom} className="kps-pr">
                <div><b>{p.nom}</b>{p.detail ? <small>{p.detail}</small> : null}</div>
                <span>{p.delai}</span><strong>{p.prix}</strong>
                {site.sections.formulaire ? <a className="kps-lien" href="#demande" onClick={() => { setPrestation(p.nom); setMode("message"); }}>Demander</a> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {site.sections.avis ? (
        <section id="avis" className="kps-sec">
          <div className="lc-sh"><h2>Avis</h2><p>{site.avisStats.nombre ? `${site.avisStats.nombre} avis vérifié${site.avisStats.nombre > 1 ? "s" : ""} · note moyenne ${fmtNote(site.avisStats.moyenne)}` : "Pas encore d'avis : ils arrivent après les chantiers réalisés avec Koji."}</p></div>
          <div className="kps-avis">
            {avis.map((a) => (
              <article key={a.id} className="kps-av">
                <div><span className="kps-st" aria-label={`${a.note} sur 5`}>{"★".repeat(a.note)}{"☆".repeat(5 - a.note)}</span><small>{moisAn(a.date)}</small></div>
                {a.texte ? <p>{a.texte}</p> : null}
                <small>{a.auteur}{a.verifie ? " · chantier réalisé avec Koji" : ""}</small>
                {a.reponse ? <div className="kps-rep"><b>Réponse de l'entreprise</b><p>{a.reponse}</p></div> : null}
              </article>
            ))}
          </div>
          <div className="kps-acts">
            {site.avis.length > 3 && !tousAvis ? <button type="button" className="kps-lien" onClick={() => setTousAvis(true)}>Voir les {site.avis.length} avis</button> : null}
            <button type="button" className="kps-lien" aria-expanded={verif} onClick={() => setVerif(!verif)}>Comment les avis sont vérifiés</button>
          </div>
          {verif ? <p className="kps-mut kps-verif">Seuls les clients d'un chantier réalisé et réceptionné avec Koji peuvent laisser un avis, un seul par chantier. « Vérifié » signifie que le chantier a été facturé dans Koji. Tous les avis sont publiés tels quels, positifs comme négatifs, du plus récent au plus ancien ; l'entreprise peut répondre mais ne peut ni les modifier ni les supprimer. Aucune contrepartie n'est proposée en échange d'un avis.</p> : null}
        </section>
      ) : null}

      {site.sections.formulaire ? (
        <section id="demande" className="kps-sec alt">
          <div className="lc-sh"><h2>Demander un devis</h2><p>Votre demande est adressée à {nom} seulement.</p></div>
          <div className="kps-choix">
            <a className={`kps-mode reco${mode === "assistant" ? " on" : ""}`} href={`${lienDemande}${source === "carte" ? "?src=carte" : ""}`}>
              <em>Recommandé</em><b>Décrire mon projet avec l'assistant Koji</b><small>3 minutes · quelques questions et vos photos</small><span className="kps-btn">Démarrer avec l'assistant Koji</span>
            </a>
            <div className={`kps-mode${mode === "message" ? " on" : ""}`}>
              <b>Écrire un message simple</b><small>1 minute · un message et des photos</small>
              {mode === "message" ? <MessageSimple site={site} prestation={prestation} source={source} /> : <button type="button" className="kps-btn sec" onClick={() => setMode("message")}>Écrire</button>}
            </div>
          </div>
        </section>
      ) : null}

      <section id="infos" className="kps-sec kps-infos">
        {site.zoneIntervention ? <div><b>Zone d'intervention</b><p>{site.zoneIntervention}</p></div> : null}
        {site.decennale ? <div><b>Assurance décennale</b><p>Attestation {site.decennale.assureur ? `${site.decennale.assureur} ` : ""}{site.decennale.jusqua ? `valable jusqu'au ${dateFr(site.decennale.jusqua)}` : "renseignée"}</p></div> : null}
        <div><b>Entreprise</b><p>{[site.entreprise.forme, site.entreprise.ville, site.entreprise.siret ? `SIRET ${site.entreprise.siret.replace(/(\d{3})(\d{3})(\d{3})(\d{5})/, "$1 $2 $3 $4")}` : ""].filter(Boolean).join(" · ") || nom}</p></div>
        {site.sections.horaires && site.horaires ? <div><b>Horaires</b><p>{site.horaires}</p></div> : null}
        {site.phone || site.email ? <div><b>Contact</b><p>{[site.phone, site.email].filter(Boolean).join(" · ")}</p></div> : null}
      </section>
      <PiedDePage site={site} />
    </div>
  );
}
