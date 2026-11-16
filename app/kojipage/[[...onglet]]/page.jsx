"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Shell } from "../../../components/Shell";
import { apiGet, apiSend } from "../../../lib/client-api";
import { Bascule, envoyerPhoto } from "../kojipage-outils";
import { Apercu, libellePrixCourt } from "../Apercu";
import { OngletDemandes, OngletCarte, OngletReglages } from "../KojiPageOnglets";
import "../kojipage.css";

// KojiPage (maquettes PRO-13 à 13.4) : vitrine de l'entreprise hébergée par
// Koji. En-tête (adresse, en ligne depuis, modifications non publiées),
// indicateurs, onglets Profil, Réalisations, Prestations, Avis, Demandes,
// Carte de visite, Réglages. Les modifications partent en ligne en une fois.
const ONGLETS = [
  ["profil", "Profil"], ["realisations", "Réalisations"], ["prestations", "Prestations"], ["avis", "Avis"],
  ["demandes", "Demandes"], ["carte", "Carte de visite"], ["reglages", "Réglages"]
];
const dateCourte = (iso) => (iso ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(iso)).replace(".", "") : "");
const dateLongue = (iso) => (iso ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso)) : "");
const fmtNote = (n) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n || 0);
const euros = (n) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n || 0)).replace(/ /g, " ");
const delaiTexte = (h) => (h == null ? "—" : h < 1 ? "< 1 h" : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} j`);

function Profil({ d, site, maj, urls, setUrls, setErreur }) {
  const [metier, setMetier] = useState("");
  const [busy, setBusy] = useState("");
  const photoRef = useRef(null);
  async function photo(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy("photo");
    try { const r = await envoyerPhoto(f); setUrls((u) => ({ ...u, [r.ref]: r.url })); maj({ contactPhotoDataUrl: r.ref }); } catch (er) { setErreur(er.message); }
    setBusy("");
  }
  async function ameliorer() {
    setBusy("ameliorer");
    try { const r = await apiSend("/api/kojipage", { action: "ameliorer", texte: site.presentationText }); maj({ presentationText: r.texte }); } catch (er) { setErreur(er.message); }
    setBusy("");
  }
  const c = d.completude;
  return (
    <div className="kj2-col">
      <div className="card kj2-jauge">
        <div className="kj2-jauge-h"><b>Page complète à {c.pct} %</b><small>une page complète reçoit en moyenne plus de demandes</small></div>
        <div className="bar"><i style={{ width: `${c.pct}%` }} /></div>
        <ul>{c.items.map((i) => <li key={i.id} className={i.fait ? "ok" : ""}><span>{i.label}</span>{i.fait ? null : <em>{i.action}</em>}</li>)}</ul>
      </div>
      <div className="card">
        <div className="card-h"><h2>Profil</h2></div>
        <div className="kj2-who">
          <button type="button" className="kj2-photo" onClick={() => photoRef.current?.click()} aria-label="Changer la photo">
            {urls[site.contactPhotoDataUrl] ? <img src={urls[site.contactPhotoDataUrl]} alt="" /> : <span>Photo</span>}
          </button>
          <div><button type="button" className="btn btn-sec" disabled={busy === "photo"} onClick={() => photoRef.current?.click()}>{busy === "photo" ? "Envoi…" : site.contactPhotoDataUrl ? "Changer la photo" : "Ajouter la photo"}</button><small className="muted">Photo de l'entrepreneur, obligatoire</small></div>
          <input ref={photoRef} type="file" accept="image/jpeg,image/png" hidden onChange={photo} />
          <span className="kj2-logo">{d.logo ? <img src={d.logo} alt="Logo" /> : "Logo"}</span>
          <Link className="link" href="/profil">{d.logo ? "Changer" : "Importer"}</Link>
        </div>
        <div className="fgrid">
          <label>Nom commercial<input value={site.title || ""} onChange={(e) => maj({ title: e.target.value })} /></label>
          <label>Dirigeant affiché<input value={site.contactName || ""} onChange={(e) => maj({ contactName: e.target.value })} placeholder={d.dirigeant || "Prénom et initiale"} /></label>
          <label className="full">Accroche<input value={site.tagline || ""} onChange={(e) => maj({ tagline: e.target.value })} placeholder="Rénovation intérieure · Paris et petite couronne" /></label>
          <label className="full">Zone d'intervention<input value={site.zoneIntervention || ""} onChange={(e) => maj({ zoneIntervention: e.target.value })} /></label>
          <label className="full">Horaires et délai de réponse<input value={site.horaires || ""} onChange={(e) => maj({ horaires: e.target.value })} placeholder="Du lundi au vendredi, 8 h - 18 h" /></label>
          <div className="full"><span className="kj2-lab">Métiers affichés</span>
            <div className="kj2-chips">
              {(site.specialties || []).map((m) => <button type="button" key={m} className="kj2-chip" onClick={() => maj({ specialties: site.specialties.filter((x) => x !== m) })} aria-label={`Retirer ${m}`}>{m} ×</button>)}
              <form onSubmit={(e) => { e.preventDefault(); if (metier.trim()) { maj({ specialties: [...(site.specialties || []), metier.trim()] }); setMetier(""); } }}><input value={metier} onChange={(e) => setMetier(e.target.value)} placeholder="Ajouter" aria-label="Ajouter un métier" /></form>
            </div>
          </div>
          <label className="full">Présentation<textarea rows={4} value={site.presentationText || ""} onChange={(e) => maj({ presentationText: e.target.value })} /></label>
        </div>
        <div className="kj2-acts"><button type="button" className="btn btn-sec" disabled={busy === "ameliorer" || !site.presentationText} onClick={ameliorer}>{busy === "ameliorer" ? "Koji écrit…" : "Améliorer avec Koji"}</button></div>
      </div>
      <div className="card">
        <div className="card-h"><h2>Vérifications</h2><small className="muted">issues de votre profil</small></div>
        <ul className="kj2-verif">{d.verifications.items.map((i) => <li key={i.id} className={i.ok ? "ok" : ""}>{i.label}</li>)}
          <li className={d.verifications.sceau ? "ok" : ""}>{d.verifications.sceau ? "Sceau « Vérifié par Koji » affiché" : "Sceau « Vérifié par Koji » masqué : SIRET et décennale à jour requis"}</li>
        </ul>
        <Link className="link" href="/profil">Mettre à jour mes documents</Link>
      </div>
    </div>
  );
}

function Realisations({ d, site, maj, urls, setUrls, setErreur, setMessage, recharger }) {
  const [filtre, setFiltre] = useState("toutes");
  const [ajout, setAjout] = useState(false);
  const [edit, setEdit] = useState(null);
  const [glisse, setGlisse] = useState("");
  const reals = site.realisations || [];
  const statut = (r) => r.statut || "publiee";
  const liste = reals.filter((r) => filtre === "toutes" || statut(r) === filtre);
  const k = { toutes: reals.length, publiee: reals.filter((r) => statut(r) === "publiee").length, accord_demande: reals.filter((r) => statut(r) === "accord_demande").length, brouillon: reals.filter((r) => statut(r) === "brouillon").length };
  const ph = (r, phase) => urls[(phase === "avant" ? (r.avant?.length ? r.avant : (r.photos || []).slice(0, 1)) : (r.apres?.length ? r.apres : (r.photos || []).slice(1)))[0]] || "";
  async function depuisChantier(projectId) {
    try { const r = await apiSend("/api/kojipage", { action: "realisation-chantier", projectId }); setUrls((u) => ({ ...u, ...r.urls })); setAjout(false); await recharger(); setEdit(r.realisation.id); } catch (e) { setErreur(e.message); }
  }
  async function publier(r) {
    try {
      const x = await apiSend("/api/kojipage", { action: r.statut === "accord_demande" ? "relancer-accord" : "publier-realisation", id: r.id });
      await recharger();
      setMessage(x.realisation.statut === "accord_demande" ? "Accord demandé au client dans Koji Client : publication dès son accord." : "Réalisation prête : publiez les modifications pour la mettre en ligne.");
    } catch (e) { setErreur(e.message); }
  }
  function deposer(cible) {
    if (!glisse || glisse === cible) return;
    const ids = reals.map((r) => r.id).filter((id) => id !== glisse);
    ids.splice(ids.indexOf(cible), 0, glisse);
    maj({ realisations: ids.map((id) => reals.find((r) => r.id === id)) });
    setGlisse("");
  }
  const enEdition = reals.find((r) => r.id === edit);
  return (
    <div className="kj2-col">
      <div className="kj2-bar">
        <div className="kj2-seg" role="tablist">{[["toutes", "Toutes"], ["publiee", "Publiées"], ["accord_demande", "En attente"], ["brouillon", "Brouillons"]].map(([id, l]) => <button type="button" key={id} role="tab" aria-selected={filtre === id} className={filtre === id ? "on" : ""} onClick={() => setFiltre(id)}>{l} <span>{k[id]}</span></button>)}</div>
        <button type="button" className="btn btn-main" onClick={() => setAjout(true)}>Ajouter une réalisation</button>
      </div>
      {ajout ? (
        <div className="card">
          <div className="card-h"><h2>Nouvelle réalisation</h2><button type="button" className="link" onClick={() => setAjout(false)}>Fermer</button></div>
          <p className="muted">Depuis un chantier terminé : Koji reprend les photos avant et après, le lieu arrondi à la ville, et demande l'accord du client dans Koji Client.</p>
          {d.chantiers.length ? d.chantiers.map((c) => (
            <div className="row" key={c.projectId}><div className="t"><strong>{c.titre}</strong><small>{[c.lieu, c.termineLe ? `terminé le ${dateCourte(c.termineLe)}` : "", `${c.avant} photo${c.avant > 1 ? "s" : ""} avant · ${c.apres} après`].filter(Boolean).join(" · ")}</small></div><button type="button" className="btn btn-sec" onClick={() => depuisChantier(c.projectId)}>Préparer</button></div>
          )) : <p className="muted">Pas encore de chantier terminé dans Koji.</p>}
          <button type="button" className="link" onClick={() => { const id = `real-${Date.now()}`; maj({ realisations: [{ id, name: "Nouvelle réalisation", avant: [], apres: [], statut: "brouillon" }, ...reals] }); setEdit(id); setAjout(false); }}>Ou créer une réalisation à la main</button>
        </div>
      ) : null}
      {enEdition ? <EditionRealisation r={enEdition} urls={urls} setUrls={setUrls} setErreur={setErreur} onChange={(x) => maj({ realisations: reals.map((r) => (r.id === x.id ? x : r)) })} onRetirer={() => { maj({ realisations: reals.filter((r) => r.id !== enEdition.id) }); setEdit(null); }} onFermer={() => setEdit(null)} /> : null}
      <div className="kj2-reals">
        {liste.map((r) => (
          <div key={r.id} className={`kj2-real${glisse === r.id ? " drag" : ""}`} draggable onDragStart={() => setGlisse(r.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => deposer(r.id)}>
            <div className="kj2-ph"><span style={ph(r, "avant") ? { backgroundImage: `url(${ph(r, "avant")})` } : null}><i>Avant</i></span><span style={ph(r, "apres") ? { backgroundImage: `url(${ph(r, "apres")})` } : null}><i>Après</i></span></div>
            <div className="kj2-real-b">
              <div className="kj2-real-t"><b>{r.name}</b><span className={`tag${statut(r) === "publiee" ? "" : " tag-o"}`}>{statut(r) === "publiee" ? "Publiée" : statut(r) === "accord_demande" ? "Accord client demandé" : "Brouillon"}</span></div>
              <small className="muted">{[r.lieu, r.duree].filter(Boolean).join(" · ")}{statut(r) === "accord_demande" && r.accordDemandeLe ? ` · demandé le ${dateCourte(r.accordDemandeLe)}${r.client ? ` à ${r.client}` : ""}` : ""}{statut(r) === "brouillon" && !(r.apres || []).length && !(r.photos || []).length ? " · photos après manquantes" : ""}</small>
              <div className="kj2-acts">
                <button type="button" className="link" onClick={() => setEdit(r.id)}>Modifier</button>
                {statut(r) === "accord_demande" ? <button type="button" className="link" onClick={() => publier(r)}>Relancer le client</button> : null}
                {statut(r) === "brouillon" ? <button type="button" className="link" onClick={() => publier(r)}>{r.projectId ? "Demander l'accord du client" : "Publier"}</button> : null}
              </div>
            </div>
          </div>
        ))}
        {!liste.length ? <p className="muted">Aucune réalisation ici.</p> : null}
      </div>
      <p className="muted">Glisser une réalisation pour changer l'ordre d'affichage. Les 3 premières apparaissent en tête de votre page. Pas de visage ni de document lisible sur les photos.</p>
    </div>
  );
}

function EditionRealisation({ r, urls, setUrls, setErreur, onChange, onRetirer, onFermer }) {
  const [busy, setBusy] = useState("");
  async function ajouter(phase, e) {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    setBusy(phase);
    try {
      const refs = [];
      for (const f of files.slice(0, 6)) { const x = await envoyerPhoto(f); refs.push(x.ref); setUrls((u) => ({ ...u, [x.ref]: x.url })); }
      onChange({ ...r, [phase]: [...(r[phase] || []), ...refs].slice(0, 10) });
    } catch (er) { setErreur(er.message); }
    setBusy("");
  }
  return (
    <div className="card">
      <div className="card-h"><h2>{r.name || "Réalisation"}</h2><button type="button" className="link" onClick={onFermer}>Fermer</button></div>
      <div className="fgrid">
        <label className="full">Titre<input value={r.name || ""} onChange={(e) => onChange({ ...r, name: e.target.value })} /></label>
        <label>Lieu<input value={r.lieu || ""} onChange={(e) => onChange({ ...r, lieu: e.target.value })} placeholder="Paris 18e" /></label>
        <label>Durée<input value={r.duree || ""} onChange={(e) => onChange({ ...r, duree: e.target.value })} placeholder="3 semaines" /></label>
        <label className="full">Ce qui a été fait<input value={r.texte || ""} onChange={(e) => onChange({ ...r, texte: e.target.value })} placeholder="Douche à l'italienne, faïence grand format" /></label>
      </div>
      <p className="muted">Lieu arrondi à la ville ou à l'arrondissement, jamais l'adresse.</p>
      {["avant", "apres"].map((phase) => (
        <div key={phase} className="kj2-phs">
          <span className="kj2-lab">Photos {phase === "avant" ? "avant" : "après"} · {(r[phase] || []).length}</span>
          <div>
            {(r[phase] || []).map((ref) => <button type="button" key={ref} className="kj2-th" style={urls[ref] ? { backgroundImage: `url(${urls[ref]})` } : null} onClick={() => onChange({ ...r, [phase]: r[phase].filter((x) => x !== ref) })} aria-label="Retirer la photo">×</button>)}
            <label className="kj2-th add">{busy === phase ? "…" : "+"}<input type="file" accept="image/jpeg,image/png" multiple hidden onChange={(e) => ajouter(phase, e)} /></label>
          </div>
        </div>
      ))}
      <div className="kj2-acts"><button type="button" className="link" onClick={onRetirer}>Retirer la réalisation</button></div>
    </div>
  );
}

function Prestations({ d, site, maj }) {
  const [edit, setEdit] = useState("");
  const controles = new Map((d.prestations || []).map((p) => [p.id, p.controle]));
  const prestations = site.prestations || [];
  const alerte = (d.prestations || []).find((p) => p.controle?.etat === "a_revoir");
  const majP = (id, champs) => maj({ prestations: prestations.map((p) => (p.id === id ? { ...p, ...champs } : p)) });
  const fourchette = (c, type) => (!c?.n ? "—" : `${c.min === c.max ? `${euros(c.min)}` : `${euros(c.min)} à ${euros(c.max)}`} €${type === "m2" ? " / m²" : ""}`);
  return (
    <div className="kj2-col">
      <div className="kj2-bar"><p className="muted">Prix TTC indicatifs affichés sur votre page. Le devis fixe le prix réel.</p><button type="button" className="btn btn-main" onClick={() => { const id = `pr-${Date.now()}`; maj({ prestations: [...prestations, { id, nom: "", detail: "", delai: "", prixType: "a_partir", prix: 0 }] }); setEdit(id); }}>Ajouter une prestation</button></div>
      <div className="tbl">
        <table>
          <thead><tr><th>Prestation</th><th>Délai</th><th>Prix affiché</th><th>Vos devis signés · 12 mois</th><th>Contrôle Koji</th></tr></thead>
          <tbody>
            {prestations.map((p) => {
              const c = controles.get(p.id);
              if (edit === p.id) return (
                <tr key={p.id} className="kj2-edit"><td colSpan={5}>
                  <div className="fgrid fgrid3">
                    <label>Prestation<input value={p.nom} onChange={(e) => majP(p.id, { nom: e.target.value })} placeholder="Rénovation de salle de bain" /></label>
                    <label>Ce qui est compris<input value={p.detail} onChange={(e) => majP(p.id, { detail: e.target.value })} placeholder="Dépose, plomberie, carrelage" /></label>
                    <label>Délai<input value={p.delai} onChange={(e) => majP(p.id, { delai: e.target.value })} placeholder="2 à 3 semaines" /></label>
                    <label>Prix<select value={p.prixType} onChange={(e) => majP(p.id, { prixType: e.target.value })}><option value="a_partir">à partir de (TTC)</option><option value="m2">au m² (TTC)</option><option value="devis">sur devis</option></select></label>
                    {p.prixType !== "devis" ? <label>Montant TTC<input type="number" min="0" value={p.prix || ""} onChange={(e) => majP(p.id, { prix: Number(e.target.value) || 0 })} /></label> : <span />}
                    <div className="kj2-acts"><button type="button" className="btn btn-sec" onClick={() => setEdit("")}>OK</button><button type="button" className="link" onClick={() => { maj({ prestations: prestations.filter((x) => x.id !== p.id) }); setEdit(""); }}>Retirer</button></div>
                  </div>
                </td></tr>
              );
              return (
                <tr key={p.id} onClick={() => setEdit(p.id)}>
                  <td><div className="n">{p.nom || "Sans nom"}</div>{p.detail ? <div className="sm">{p.detail}</div> : null}</td>
                  <td>{p.delai || "—"}</td>
                  <td>{libellePrixCourt(p).replace(" TTC", "")}</td>
                  <td>{fourchette(c, p.prixType)}{c?.n ? <div className="sm">{c.n} devis signé{c.n > 1 ? "s" : ""}</div> : null}</td>
                  <td><span className={`tag${c?.etat === "a_revoir" ? " tag-b" : c?.etat === "coherent" ? "" : " tag-o"}`}>{c ? c.label : "à enregistrer"}</span> <button type="button" className="link" onClick={(e) => { e.stopPropagation(); setEdit(p.id); }}>{c?.etat === "a_revoir" ? "Corriger" : c?.etat === "prix_a_ajouter" ? "Ajouter le prix" : "Modifier"}</button></td>
                </tr>
              );
            })}
            {!prestations.length ? <tr><td colSpan={5} className="muted">Ajoutez vos prestations courantes avec un prix « à partir de » : c'est la carte de votre entreprise.</td></tr> : null}
          </tbody>
        </table>
      </div>
      {alerte ? <p className="kj2-alerte">{alerte.controle.message} Koji compare avec vos devis signés et vous alerte si l'écart devient trompeur.</p> : null}
    </div>
  );
}

function Avis({ d, setErreur, setMessage, recharger }) {
  const [rep, setRep] = useState({});
  const max = Math.max(1, ...d.distribution.map((x) => x.nombre));
  async function action(corps, ok) {
    try { await apiSend("/api/kojipage", corps); await recharger(); if (ok) setMessage(ok); } catch (e) { setErreur(e.message); }
  }
  return (
    <div className="kj2-avis">
      <div className="card kj2-av-g">
        <div className="kj2-av-note"><b>{d.avisStats.nombre ? fmtNote(d.avisStats.moyenne) : "—"}</b><small>{d.avisStats.nombre} avis vérifié{d.avisStats.nombre > 1 ? "s" : ""}</small></div>
        {d.distribution.map((x) => <div key={x.note} className="kj2-av-l"><span>{x.note} ★</span><div className="bar"><i style={{ width: `${(x.nombre / max) * 100}%` }} /></div><span>{x.nombre}</span></div>)}
        <div className="kj2-opt"><span>Demande d'avis automatique, 3 jours après la réception</span><Bascule on={d.avisAuto} label="Demande d'avis automatique" onChange={(v) => action({ action: "avis-auto", actif: v })} /></div>
        {d.avisEnAttente ? <p className="muted">Avis en attente : {d.avisEnAttente} client{d.avisEnAttente > 1 ? "s" : ""} relancé{d.avisEnAttente > 1 ? "s" : ""}</p> : null}
        <p className="muted">Seuls les clients d'un chantier terminé dans Koji peuvent laisser un avis. Aucun avis ne peut être supprimé par l'entreprise ; un avis abusif se signale à Koji.</p>
      </div>
      <div className="kj2-col">
        {d.avis.length ? d.avis.map((a) => (
          <div key={a.id} className="card kj2-av">
            <div className="kj2-av-h"><span className="kj2-st">{"★".repeat(a.note)}{"☆".repeat(5 - a.note)}</span><small className="muted">{dateLongue(a.date)}</small>
              {a.signale ? <small className="muted">signalé à Koji</small> : <button type="button" className="link" onClick={() => { const motif = window.prompt("Pourquoi cet avis vous semble-t-il abusif ?"); if (motif) action({ action: "avis-signaler", avisId: a.id, motif }, "Avis signalé à Koji."); }}>Signaler</button>}
            </div>
            {a.texte ? <p>{a.texte}</p> : null}
            <small className="muted">{a.auteur}{a.verifie ? " · chantier réalisé avec Koji" : ""}</small>
            {rep[a.id] !== undefined ? (
              <div className="kj2-rep">
                <textarea rows={3} value={rep[a.id]} onChange={(e) => setRep({ ...rep, [a.id]: e.target.value })} aria-label="Votre réponse" />
                <div className="kj2-acts"><button type="button" className="btn btn-sec" onClick={() => setRep({ ...rep, [a.id]: a.proposee })}>Proposer avec Koji</button><button type="button" className="btn btn-main" disabled={!rep[a.id]?.trim()} onClick={async () => { await action({ action: "avis-repondre", avisId: a.id, texte: rep[a.id] }, "Réponse publiée."); setRep({ ...rep, [a.id]: undefined }); }}>Publier la réponse</button></div>
              </div>
            ) : a.reponse ? <div className="kj2-rep-t"><b>Votre réponse</b><p>{a.reponse}</p><button type="button" className="link" onClick={() => setRep({ ...rep, [a.id]: a.reponse })}>Modifier</button></div> : <button type="button" className="link" onClick={() => setRep({ ...rep, [a.id]: "" })}>Répondre</button>}
          </div>
        )) : <div className="card"><p className="muted">Pas encore d'avis. Ils arrivent après la réception d'un chantier fait dans Koji.</p></div>}
      </div>
    </div>
  );
}

export default function KojiPage() {
  const params = useParams();
  const router = useRouter();
  const onglet = ONGLETS.some(([id]) => id === params?.onglet?.[0]) ? params.onglet[0] : "profil";
  const [d, setD] = useState(null);
  const [site, setSite] = useState(null);
  const [urls, setUrls] = useState({});
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [nonPubliees, setNonPubliees] = useState(0);
  const [apercu, setApercu] = useState("tel");
  const [busy, setBusy] = useState(false);
  const minuteur = useRef(null);
  const enAttente = useRef({});
  const charger = async () => {
    const x = await apiGet("/api/kojipage");
    setD(x); setSite(x.site); setUrls(x.urls || {}); setNonPubliees(x.nonPubliees || 0);
    return x;
  };
  useEffect(() => { charger().catch((e) => setErreur(e.message)); }, []);
  useEffect(() => { if (message) { const t = setTimeout(() => setMessage(""), 5000); return () => clearTimeout(t); } return undefined; }, [message]);

  function maj(champs) {
    setSite((s) => {
      const n = { ...s, ...champs };
      enAttente.current = { ...enAttente.current, ...champs };
      clearTimeout(minuteur.current);
      minuteur.current = setTimeout(() => {
        const corps = enAttente.current;
        enAttente.current = {};
        apiSend("/api/kojipage", corps, "PATCH").then((r) => { setNonPubliees(r.nonPubliees || 0); setD((x) => ({ ...x, completude: r.completude })); }).catch((e) => setErreur(e.message));
      }, 600);
      return n;
    });
  }
  async function publier() {
    setBusy(true); setErreur("");
    try { clearTimeout(minuteur.current); enAttente.current = {}; await apiSend("/api/kojipage", { ...site }, "PATCH"); await apiSend("/api/kojipage", { action: "publier" }); await charger(); setMessage("Modifications publiées."); } catch (e) { setErreur(e.message); }
    setBusy(false);
  }
  const k = d ? {
    visites: d.visites.total, evolution: d.visites.evolution, demandes: d.demandes.mois, nouvelles: d.demandes.nouvelles, delai: d.delai, avis: d.avisStats
  } : null;
  const couleurHex = useMemo(() => (d && site ? (d.couleurs.find((c) => c.id === (d.offre.couleur ? site.couleur : "marine")) || d.couleurs[0]).hex : "#0B1530"), [d, site]);

  if (!d || !site) return <Shell variant="pro">{erreur ? <p className="err" role="alert">{erreur}</p> : <p className="muted">Chargement…</p>}</Shell>;
  const adresse = d.url.replace(/^https?:\/\//, "");
  return (
    <Shell variant="pro">
      <div className="kj2">
        <div className="head">
          <div className="stack">
            <small className="muted">{adresse} · {d.enLigne ? `en ligne depuis le ${dateCourte(d.enLigneDepuis)}` : "pas encore en ligne"}{nonPubliees ? ` · ${nonPubliees} modification${nonPubliees > 1 ? "s" : ""} non publiée${nonPubliees > 1 ? "s" : ""}` : ""}</small>
            <h1>KojiPage</h1>
          </div>
          <div className="acts">
            <a className="btn btn-sec" href={`/site/${site.slug}${d.enLigne ? "" : "?apercu=1"}`} target="_blank" rel="noreferrer">Voir ma page</a>
            <button type="button" className="btn btn-sec" onClick={() => { navigator.clipboard?.writeText(d.url); setMessage("Lien copié."); }}>Copier le lien</button>
            <button type="button" className="btn btn-main" disabled={busy || (d.enLigne && !nonPubliees)} onClick={publier}>{busy ? "Publication…" : d.enLigne ? "Publier les modifications" : "Mettre en ligne"}</button>
          </div>
        </div>
        {erreur ? <p className="err" role="alert">{erreur} <button type="button" className="link" onClick={() => setErreur("")}>Fermer</button></p> : null}
        {message ? <p className="kj2-ok" role="status">{message}</p> : null}
        {d.offre.niveau === "essentielle" ? <p className="kj2-alerte">Offre Start : KojiPage essentielle (5 photos, sans avis ni demandes directes). <Link className="link" href="/parametres/abonnement">Passer à Pro</Link></p> : null}
        <div className="kp-kpis kj2-kpis">
          <div className="kp-kpi"><div className="l">Visites · 30 jours</div><div className="v">{k.visites}</div><div className="muted">{k.evolution == null ? "premier mois" : `${k.evolution >= 0 ? "+" : ""}${k.evolution} % sur le mois précédent`}</div></div>
          <Link className="kp-kpi" href="/kojipage/demandes"><div className="l">Demandes reçues</div><div className="v">{k.demandes}</div><div className="muted">{k.nouvelles ? `dont ${k.nouvelles} nouvelle${k.nouvelles > 1 ? "s" : ""}` : "sur 30 jours"}</div></Link>
          <div className="kp-kpi"><div className="l">Délai de réponse</div><div className="v">{delaiTexte(k.delai)}</div><div className="muted">moyenne sur 30 jours</div></div>
          <Link className="kp-kpi" href="/kojipage/avis"><div className="l">Avis</div><div className="v">{k.avis.nombre ? fmtNote(k.avis.moyenne) : "—"}</div><div className="muted">{k.avis.nombre} avis vérifié{k.avis.nombre > 1 ? "s" : ""}</div></Link>
        </div>
        <div className="tbar">
          <nav className="wtabs" aria-label="KojiPage">
            {ONGLETS.map(([id, l]) => {
              const n = id === "realisations" ? (site.realisations || []).length : id === "prestations" ? (site.prestations || []).length : id === "avis" ? d.avisStats.nombre : id === "demandes" ? d.demandes.nouvelles : 0;
              return <Link key={id} href={id === "profil" ? "/kojipage" : `/kojipage/${id}`} className={onglet === id ? "on" : ""} aria-current={onglet === id ? "page" : undefined}>{l}{n ? <span>{n}</span> : null}</Link>;
            })}
          </nav>
        </div>
        {["profil", "realisations", "prestations", "reglages"].includes(onglet) ? (
          <div className="kj2-grid">
            {onglet === "profil" ? <Profil d={d} site={site} maj={maj} urls={urls} setUrls={setUrls} setErreur={setErreur} /> : null}
            {onglet === "realisations" ? <Realisations d={d} site={site} maj={maj} urls={urls} setUrls={setUrls} setErreur={setErreur} setMessage={setMessage} recharger={charger} /> : null}
            {onglet === "prestations" ? <Prestations d={d} site={site} maj={maj} /> : null}
            {onglet === "reglages" ? <OngletReglages d={d} site={site} maj={maj} setErreur={setErreur} setMessage={setMessage} recharger={charger} couleurHex={couleurHex} /> : null}
            <aside className="kj2-side">
              <div className="kj2-side-h"><b>Aperçu</b><div className="kj2-seg small">{[["tel", "Téléphone"], ["ordi", "Ordinateur"]].map(([id, l]) => <button type="button" key={id} className={apercu === id ? "on" : ""} onClick={() => setApercu(id)}>{l}</button>)}</div></div>
              <Apercu site={site} urls={urls} couleur={couleurHex} logo={d.logo} avisStats={d.avisStats} verifie={d.verifications.sceau} decennale={d.verifications.items.find((i) => i.id === "decennale")?.ok} mode={apercu} />
              <small className="muted">Les modifications apparaissent ici avant publication.</small>
            </aside>
          </div>
        ) : null}
        {onglet === "avis" ? <Avis d={d} setErreur={setErreur} setMessage={setMessage} recharger={charger} /> : null}
        {onglet === "demandes" ? <OngletDemandes offre={d.offre} setErreur={setErreur} setMessage={setMessage} onChange={() => charger().catch(() => null)} router={router} /> : null}
        {onglet === "carte" ? <OngletCarte d={d} site={site} maj={maj} urls={urls} couleurHex={couleurHex} setMessage={setMessage} /> : null}
      </div>
    </Shell>
  );
}
