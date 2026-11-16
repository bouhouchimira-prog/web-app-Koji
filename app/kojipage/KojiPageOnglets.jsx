"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiSend } from "../../lib/client-api";
import { Bascule } from "./kojipage-outils";

// Onglets Demandes (PRO-13.1), Carte de visite (PRO-13.4) et Réglages
// (PRO-13.3) de la KojiPage.
const euros = (n) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n || 0)).replace(/ /g, " ");
function depuis(iso) {
  if (!iso) return "";
  const h = (Date.now() - Date.parse(iso)) / 3600000;
  if (h < 1) return "il y a moins d'une heure";
  if (h < 24) return `il y a ${Math.round(h)} h`;
  if (h < 48) return `hier, ${new Intl.DateTimeFormat("fr-FR", { hour: "numeric", timeZone: "Europe/Paris" }).format(new Date(iso)).replace(/s*h$/, "")} h`;
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(iso)).replace(".", "");
}
const MOTIFS = [["hors_metier", "Hors de mes métiers"], ["hors_zone", "Hors de ma zone"], ["indisponible", "Pas disponible"]];

export function OngletDemandes({ offre, setErreur, setMessage, onChange, router }) {
  const [liste, setListe] = useState(null);
  const [sel, setSel] = useState("");
  const [d, setD] = useState(null);
  const [vue, setVue] = useState("");
  const [texte, setTexte] = useState("");
  const [motif, setMotif] = useState("hors_metier");
  const [quand, setQuand] = useState("");
  const [busy, setBusy] = useState("");
  const chargerListe = () => apiGet("/api/kojipage/demandes").then((x) => { setListe(x.demandes); return x.demandes; });
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    chargerListe().then((l) => setSel(id || l[0]?.id || "")).catch((e) => setErreur(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!sel) return;
    setD(null); setVue(""); setTexte("");
    apiGet(`/api/kojipage/demandes?id=${encodeURIComponent(sel)}`).then((x) => setD(x.demande)).catch((e) => setErreur(e.message));
  }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps

  async function agir(corps, ok) {
    setBusy(corps.action);
    try {
      await apiSend("/api/kojipage/demandes", { id: sel, ...corps });
      const x = await apiGet(`/api/kojipage/demandes?id=${encodeURIComponent(sel)}`);
      setD(x.demande); setVue(""); setTexte("");
      await chargerListe(); onChange();
      if (ok) setMessage(ok);
    } catch (e) { setErreur(e.message); }
    setBusy("");
  }

  if (!liste) return <p className="muted">Chargement…</p>;
  if (!liste.length) return <div className="card"><p className="muted">{offre.demandes ? "Pas encore de demande. Partagez votre page et votre carte de visite : les demandes arrivent ici, réservées à votre entreprise, sans jeton." : "Les demandes directes par la KojiPage sont incluses dans les offres Pro et Business."}</p></div>;
  const b = d?.base;
  return (
    <div className="kj2-dem">
      <div className="kj2-dem-l">
        {liste.map((x) => (
          <button type="button" key={x.id} className={`kj2-dem-i${sel === x.id ? " on" : ""}`} onClick={() => setSel(x.id)}>
            <span className="kj2-dem-t"><b>{x.titre}</b><span className={`tag${x.etat === "a_repondre" ? "" : " tag-o"}${x.etat === "declinee" ? " dim" : ""}`}>{x.etatTexte}</span></span>
            <small>{[x.client, x.ville, depuis(x.createdAt)].filter(Boolean).join(" · ")}</small>
            <small>{x.etat === "declinee" ? `déclinée · ${x.declinMotif}` : x.etat === "devis_envoye" ? `devis ${x.quoteNumber} envoyé` : [x.sourceTexte, x.budget].filter(Boolean).join(" · ")}</small>
          </button>
        ))}
      </div>
      <div className="card kj2-dem-d">
        {!d ? <p className="muted">Chargement…</p> : (
          <>
            <small className="muted">{[d.sourceTexte.replace(/^via/, "Venue par"), depuis(d.createdAt), d.projet ? "décrite avec l'assistant Koji" : ""].filter(Boolean).join(" · ")}</small>
            <div className="kj2-dem-h"><h2>{d.titre}</h2><span className="tag">{d.etatTexte}</span></div>
            <p className="muted">{[d.client.nom, d.ville, d.client.masque ? "coordonnées complètes après votre réponse" : [d.client.telephone, d.client.email].filter(Boolean).join(" · ")].filter(Boolean).join(" · ")}</p>
            {d.message ? <blockquote className="kj2-q">« {d.message} »</blockquote> : null}
            {d.projet ? (
              <div className="kj2-projet">
                <span className="kj2-lab">Projet décrit par le client avec Koji</span>
                <div className="kj2-chips">{[d.projet.piece, ...(d.projet.travaux || [])].filter(Boolean).map((t) => <span key={t} className="kj2-chip">{t}</span>)}</div>
                <dl className="kj2-dl">
                  {d.projet.surface ? <><dt>Surface</dt><dd>{d.projet.surface} m²</dd></> : null}
                  {d.projet.acces ? <><dt>Accès</dt><dd>{d.projet.acces}</dd></> : null}
                  {d.projet.quand ? <><dt>Quand</dt><dd>{d.projet.quand}</dd></> : null}
                  {d.budgetDetail ? <><dt>Budget</dt><dd>{d.budgetDetail.compatible ? "compatible" : `${euros(d.budgetDetail.budget)} € · ${euros(d.budgetDetail.ecart)} € sous votre prix`}</dd></> : null}
                </dl>
                {d.projet.precisions ? <p>{d.projet.precisions}</p> : null}
              </div>
            ) : null}
            {d.photos.length ? <div className="kj2-dem-ph">{d.photos.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="Photo du client" /></a>)}</div> : null}
            <div className="kj2-koji">
              <b>Koji</b>
              {b ? (
                <div>
                  <p>Base de devis prête : {b.lots.length} lot{b.lots.length > 1 ? "s" : ""}, {b.lignes} ligne{b.lignes > 1 ? "s" : ""}{b.ttc ? `, ${euros(b.ttc)} € TTC à vos prix` : ""}{b.manquants ? ` (${b.manquants} ligne${b.manquants > 1 ? "s" : ""} sans prix dans votre bibliothèque)` : ""}.</p>
                  {b.tauxManquant ? <p className="muted">Réglez vos taux horaires dans Mes prix pour chiffrer la main-d'œuvre.</p> : null}
                  {b.lots.map((l) => <p key={l.nom} className="muted"><b>{l.nom}</b> · {l.lignes.map((x) => `${x.libelle} ${x.quantite} ${x.unite}`).join(", ")}</p>)}
                  {b.hypotheses.length ? <p>Hypothèses à confirmer : {b.hypotheses.join(" ; ")}.</p> : null}
                  {b.nonCompris.length ? <p>Non compris à annoncer : {b.nonCompris.join(" ; ")}.</p> : null}
                  {b.questions.length ? <p>Questions à poser : {b.questions.join(" ; ")}</p> : null}
                  {d.budgetDetail && !d.budgetDetail.compatible ? <p>Budget inférieur à votre prix : proposez des variantes dans le devis, le client choisira. Koji ne propose jamais de réduire la préparation des supports ni l'étanchéité.</p> : null}
                </div>
              ) : <div><p className="muted">Koji prépare une base de devis à partir de la demande : lots probables, prix à vos prix, hypothèses et questions.</p><button type="button" className="btn btn-sec" disabled={busy === "preparer" || !offre.demandes} onClick={() => agir({ action: "preparer" })}>{busy === "preparer" ? "Koji prépare…" : "Préparer la base"}</button></div>}
            </div>
            {d.messages.length ? <div className="kj2-msgs">{d.messages.map((m) => <p key={m.le}><small className="muted">{depuis(m.le)}</small> {m.texte}</p>)}</div> : null}
            {vue === "repondre" ? (
              <div className="kj2-rep"><textarea rows={4} value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Bonjour, merci pour votre demande…" aria-label="Votre réponse" />
                <div className="kj2-acts"><button type="button" className="btn btn-main" disabled={busy || !texte.trim()} onClick={() => agir({ action: "repondre", texte }, "Réponse envoyée par e-mail.")}>Envoyer</button><button type="button" className="link" onClick={() => agir({ action: "appele" }, "Noté : client appelé.")}>J'ai appelé le client</button><button type="button" className="link" onClick={() => setVue("")}>Annuler</button></div></div>
            ) : vue === "decliner" ? (
              <div className="kj2-rep"><div className="kj2-seg">{MOTIFS.map(([id, l]) => <button type="button" key={id} className={motif === id ? "on" : ""} onClick={() => setMotif(id)}>{l}</button>)}</div>
                <textarea rows={2} value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Un mot pour le client (facultatif)" aria-label="Message" />
                <p className="muted">Le client est prévenu et peut décrire son projet sur Koji pour trouver une autre entreprise.</p>
                <div className="kj2-acts"><button type="button" className="btn btn-main" disabled={Boolean(busy)} onClick={() => agir({ action: "decliner", motif, texte }, "Demande déclinée, client prévenu.")}>Décliner</button><button type="button" className="link" onClick={() => setVue("")}>Annuler</button></div></div>
            ) : vue === "visite" ? (
              <div className="kj2-rep"><label className="kj2-lab">Date et heure<input type="datetime-local" value={quand} onChange={(e) => setQuand(e.target.value)} /></label>
                <textarea rows={2} value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Un mot pour le client (facultatif)" aria-label="Message" />
                <div className="kj2-acts"><button type="button" className="btn btn-main" disabled={Boolean(busy) || !quand} onClick={() => agir({ action: "visite", date: new Date(quand).toISOString(), texte }, "Visite proposée et ajoutée au calendrier.")}>Proposer</button><button type="button" className="link" onClick={() => setVue("")}>Annuler</button></div></div>
            ) : d.etat !== "declinee" ? (
              <div className="kj2-acts kj2-dem-a">
                <button type="button" className="btn btn-sec" onClick={() => setVue("decliner")}>Décliner avec un motif</button>
                <button type="button" className="btn btn-sec" onClick={() => setVue("visite")}>Proposer une visite</button>
                <button type="button" className="btn btn-sec" onClick={() => setVue("repondre")}>Répondre</button>
                {d.quoteId ? <Link className="btn btn-main" href={`/devis?id=${d.quoteId}`}>Ouvrir le devis</Link> : <button type="button" className="btn btn-main" onClick={() => router.push(`/devis?new=1&mode=ia&demande=${d.id}`)}>{d.budgetDetail && !d.budgetDetail.compatible ? "Démarrer un devis guidé avec variantes" : "Démarrer un devis guidé"}</button>}
              </div>
            ) : null}
            <p className="muted">Aucun jeton débité. La demande vous reste réservée : elle n'est jamais proposée à d'autres entreprises. Votre délai moyen de réponse est affiché sur votre page.</p>
          </>
        )}
      </div>
    </div>
  );
}

export function OngletCarte({ d, site, maj, couleurHex, setMessage }) {
  const k = { nom: site.title || "", personne: site.contactName || d.dirigeant || "", fonction: "Dirigeant", telephone: site.contactPhone || d.entreprise.telephone, email: site.contactEmail || d.entreprise.email, metiers: (site.specialties || []).slice(0, 4), logo: true, photo: false, adresse: false, qr: true, ...(site.carte || {}) };
  const [qrPlein, setQrPlein] = useState(false);
  const [qr, setQr] = useState("");
  const lien = `${d.url}/carte`;
  const texteCarte = `${k.personne ? `${k.personne}, ` : ""}${k.nom} : nos réalisations, nos avis et votre demande de devis sur ${lien}`;
  useEffect(() => { import("qrcode").then((Q) => Q.toDataURL(lien, { margin: 1, width: 480 })).then(setQr).catch(() => null); }, [lien]);
  const majC = (champs) => maj({ carte: { ...k, ...champs } });
  if (!d.offre.carte) return <div className="card"><p className="muted">La carte de visite est incluse dans les offres Pro et Business.</p><Link className="link" href="/parametres/abonnement">Voir les offres</Link></div>;
  const metiersDispo = [...new Set([...(site.specialties || []), ...k.metiers])];
  return (
    <div className="kj2-grid">
      <div className="kj2-col">
        <div className="card">
          <div className="card-h"><h2>Contenu de la carte</h2><small className="muted">repris de votre profil, modifiable ici</small></div>
          <div className="fgrid">
            <label className="full">Nom affiché<input value={k.nom} onChange={(e) => majC({ nom: e.target.value })} /></label>
            <label>Personne<input value={k.personne} onChange={(e) => majC({ personne: e.target.value })} /></label>
            <label>Fonction<input value={k.fonction} onChange={(e) => majC({ fonction: e.target.value })} /></label>
            <label>Téléphone<input value={k.telephone} onChange={(e) => majC({ telephone: e.target.value })} /></label>
            <label>E-mail<input value={k.email} onChange={(e) => majC({ email: e.target.value })} /></label>
            <div className="full"><span className="kj2-lab">Métiers · 4 au maximum</span>
              <div className="kj2-chips">{metiersDispo.map((m) => <button type="button" key={m} className={`kj2-chip${k.metiers.includes(m) ? " on" : ""}`} aria-pressed={k.metiers.includes(m)} onClick={() => majC({ metiers: k.metiers.includes(m) ? k.metiers.filter((x) => x !== m) : [...k.metiers, m].slice(0, 4) })}>{m}</button>)}</div>
            </div>
          </div>
          {[["logo", "Afficher le logo"], ["photo", "Afficher la photo du dirigeant au lieu du logo"], ["adresse", "Afficher l'adresse de l'entreprise"], ["qr", "QR code vers la KojiPage"]].map(([id, l]) => <div key={id} className="kj2-opt"><span>{l}</span><Bascule on={Boolean(k[id])} label={l} onChange={(v) => majC({ [id]: v })} /></div>)}
          <p className="muted">Modèle Koji unique. La couleur du bandeau suit celle de votre KojiPage.</p>
        </div>
        <div className="card">
          <div className="card-h"><h2>Partager</h2><small className="muted">lien personnel : {lien.replace(/^https?:\/\//, "")}</small></div>
          <div className="kj2-acts">
            <a className="btn btn-sec" href={`sms:?&body=${encodeURIComponent(texteCarte)}`}>SMS</a>
            <a className="btn btn-sec" href={`https://wa.me/?text=${encodeURIComponent(texteCarte)}`} target="_blank" rel="noreferrer">WhatsApp</a>
            <a className="btn btn-sec" href={`mailto:?subject=${encodeURIComponent(`Carte de visite ${k.nom}`)}&body=${encodeURIComponent(texteCarte)}`}>E-mail</a>
            <button type="button" className="btn btn-sec" onClick={() => { navigator.clipboard?.writeText(lien); setMessage("Lien copié."); }}>Copier le lien</button>
            <a className="btn btn-sec" href={`/api/site/${site.slug}/vcf`}>Fiche contact (.vcf)</a>
            <button type="button" className="btn btn-sec" disabled={!qr} onClick={() => setQrPlein(true)}>QR code plein écran</button>
          </div>
          <div className="kj2-stats"><div><b>{d.carte.ouvertures}</b><small>Ouvertures de la carte · 30 jours</small></div><div><b>{d.carte.contacts}</b><small>Contacts enregistrés</small></div><div><b>{d.carte.demandes}</b><small>Demandes venues de la carte</small></div></div>
          {!d.enLigne ? <p className="kj2-alerte">Votre KojiPage n'est pas encore en ligne : le lien et le QR code mènent à une page vide tant que vous ne l'avez pas publiée.</p> : null}
        </div>
        <div className="card">
          <div className="card-h"><h2>Imprimer</h2></div>
          <div className="row"><div className="t"><strong>Planche A4 à imprimer</strong><small>10 cartes recto, traits de coupe · imprimante de bureau</small></div><a className="btn btn-sec" href="/api/kojipage/carte?format=planche">PDF</a></div>
          <div className="row"><div className="t"><strong>Fichier pour imprimeur</strong><small>85 × 55 mm, fonds perdus 3 mm, recto verso</small></div><a className="btn btn-sec" href="/api/kojipage/carte?format=imprimeur">PDF</a></div>
          <div className="row"><div className="t"><strong>Carte recto verso</strong><small>Papier conseillé : 300 à 350 g, mat.</small></div><a className="btn btn-sec" href="/api/kojipage/carte?format=carte">Télécharger le PDF</a></div>
        </div>
      </div>
      <aside className="kj2-side">
        <div className="kj2-side-h"><b>Aperçu · 85 × 55 mm</b></div>
        <div className="kj2-carte" style={{ "--bandeau": couleurHex }}>
          <div className="kj2-carte-r">
            <div className="kj2-carte-top"><span className="kj2-pv-lg">{k.logo && d.logo && !k.photo ? <img src={d.logo} alt="" /> : (k.nom || "K").split(/\s+/).slice(0, 2).map((m) => m[0]).join("").toUpperCase()}</span><small>{site.tagline}</small></div>
            <b>{k.nom}</b><span>{[k.personne, k.fonction].filter(Boolean).join(" · ")}</span>
            <small>{k.metiers.join(" · ")}</small>
            <span>Tél. {k.telephone}</span><span>E-mail {k.email}</span>
            {k.adresse && d.entreprise.adresse ? <small>{d.entreprise.adresse}</small> : null}
          </div>
          <div className="kj2-carte-v">
            <div><b>{k.nom}</b><p>Nos réalisations, nos avis, votre demande de devis</p><small>{d.url.replace(/^https?:\/\//, "")}</small>{d.verifications.sceau ? <em>Vérifié par Koji · assurance décennale vérifiée</em> : null}</div>
            {k.qr && qr ? <img src={qr} alt="QR code vers la KojiPage" /> : null}
          </div>
        </div>
      </aside>
      {qrPlein ? (
        <div className="kj2-qr-plein" role="dialog" aria-label="QR code plein écran" onClick={() => setQrPlein(false)}>
          <div><img src={qr} alt="QR code vers la KojiPage" /><b>{k.nom}</b><small>{d.url.replace(/^https?:\/\//, "")}</small><button type="button" className="btn btn-sec">Fermer</button></div>
        </div>
      ) : null}
    </div>
  );
}

export function OngletReglages({ d, site, maj, setErreur, setMessage, recharger }) {
  const [slug, setSlug] = useState(site.slug);
  const sections = { realisations: true, prestations: true, avis: true, formulaire: true, horaires: true, ...(site.sections || {}) };
  async function changerAdresse() {
    try { await apiSend("/api/kojipage", { action: "adresse", slug }); await recharger(); setMessage("Adresse modifiée : l'ancienne redirige vers la nouvelle."); } catch (e) { setErreur(e.message); }
  }
  return (
    <div className="kj2-col">
      <div className="card">
        <div className="card-h"><h2>Adresse de la page</h2></div>
        <div className="kj2-adr"><span>{d.url.replace(/^https?:\/\//, "").replace(site.slug, "")}</span><input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} aria-label="Adresse" /><button type="button" className="btn btn-sec" disabled={slug === site.slug || !d.slugModifiable.ok} onClick={changerAdresse}>Modifier</button></div>
        <dl className="kj2-dl">
          <dt>Hébergement</dt><dd>Koji, inclus dans l'offre</dd>
          <dt>Référencement</dt><dd><span className="kj2-opt-in">{site.indexable === false ? "page non indexée" : `indexée par les moteurs de recherche · titre « ${site.title || ""}${site.tagline ? `, ${site.tagline.charAt(0).toLowerCase()}${site.tagline.slice(1)}` : ""} »`}<Bascule on={site.indexable !== false} label="Référencement" onChange={(v) => maj({ indexable: v })} /></span></dd>
        </dl>
        <p className="muted">L'adresse se modifie une fois par an ; l'ancienne redirige vers la nouvelle.{!d.slugModifiable.ok ? ` Prochaine modification possible le ${d.slugModifiable.apres.split("-").reverse().join("/")}.` : ""}</p>
      </div>
      <div className="card">
        <div className="card-h"><h2>Couleur du bandeau</h2><span className="tag tag-o">Business</span></div>
        <p className="muted">Une couleur pour le bandeau de votre page. Le reste suit le modèle Koji, identique pour toutes les entreprises.</p>
        <div className="kj2-couleurs">
          {d.couleurs.map((c) => (
            <button type="button" key={c.id} className={`kj2-coul${(site.couleur || "marine") === c.id ? " on" : ""}`} disabled={!d.offre.couleur && c.id !== "marine"} onClick={() => maj({ couleur: c.id })} aria-pressed={(site.couleur || "marine") === c.id}>
              <i style={{ background: c.hex }} /><span>{c.nom}</span><small>{c.id === "marine" ? "par défaut" : `contraste ${String(contraste(c.hex)).replace(".", ",")} : 1`}</small>
            </button>
          ))}
        </div>
        {!d.offre.couleur ? <p className="muted">Réservé à l'offre Business. <Link className="link" href="/parametres/abonnement">Voir les offres</Link></p> : null}
      </div>
      <div className="card">
        <div className="card-h"><h2>Sections affichées</h2></div>
        {d.sections.map((s) => <div key={s.id} className="kj2-opt"><span>{s.label}{s.id === "formulaire" && !d.offre.demandes ? " · offres Pro et Business" : s.id === "avis" && !d.offre.avis ? " · offres Pro et Business" : ""}</span><Bascule on={sections[s.id] !== false} label={s.label} onChange={(v) => maj({ sections: { ...sections, [s.id]: v } })} /></div>)}
        <p className="muted">L'ordre des sections est fixe : présentation, réalisations, prestations, avis, demande.</p>
      </div>
      <div className="card">
        <div className="card-h"><h2>Page en ligne</h2></div>
        <p className="muted">{d.enLigne ? "Votre page est visible par tous." : "Votre page n'est pas encore en ligne."}</p>
        {d.enLigne ? <button type="button" className="btn btn-sec" onClick={async () => { try { await apiSend("/api/kojipage", { action: "retirer" }); await recharger(); setMessage("Page retirée : elle n'est plus visible."); } catch (e) { setErreur(e.message); } }}>Retirer la page</button> : null}
      </div>
    </div>
  );
}

function contraste(hex) {
  const v = String(hex).replace("#", "");
  const c = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return Math.round((1.05 / (l + 0.05)) * 10) / 10;
}
