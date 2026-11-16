"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Shell } from "../../components/Shell";
import { apiGet, apiSend } from "../../lib/client-api";
import { filtrerFils } from "../../lib/messages-pro";
import "./messages.css";

// Messages (maquette PRO-12) : une seule messagerie. Liste avec filtres
// Tous / Non lus / Clients / Pros et recherche ; fil avec le contexte du
// chantier en étiquettes, bulles, Koji qui propose de reporter une
// information (l'artisan valide), réponses enregistrées, panneau Détails.
const Plus = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;
const Info = () => <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></svg>;
const Envoyer = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 16-2-7z" /></svg>;
const Doc = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l5 5v13H7zM14 3v5h5" /></svg>;

function Fil({ cle, onLu, onRetour }) {
  const [d, setD] = useState(null);
  const [erreur, setErreur] = useState("");
  const [texte, setTexte] = useState("");
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState(false);
  const [toutes, setToutes] = useState(false);
  const fin = useRef(null);
  // Traduction (PRO-15.1) : messages reçus dans la langue de l'artisan,
  // messages envoyés en français avec aperçu de ce que lira le client.
  const [trad, setTrad] = useState({});
  const [originaux, setOriginaux] = useState({});
  const [apercu, setApercu] = useState(null);
  const charger = () => apiGet(`/api/messages?fil=${encodeURIComponent(cle)}`).then((x) => { setD(x); onLu(); }).catch((e) => setErreur(e.message));
  useEffect(() => { setD(null); setDetails(false); charger(); }, [cle]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { fin.current?.scrollIntoView({ block: "end" }); }, [d]);
  const langue = d?.langue && d.langue.langue !== "fr" ? d.langue : null;
  useEffect(() => {
    if (!langue?.entrant || !d) return;
    const recus = d.jours.flatMap((j) => j.messages).filter((m) => !m.entreprise && m.texte && !trad[m.texte]).map((m) => m.texte);
    if (!recus.length) return;
    apiSend("/api/traduire", { textes: recus, vers: langue.langue, depuis: "fr", genre: "message" })
      .then((x) => setTrad((t) => ({ ...t, ...Object.fromEntries(recus.map((o, i) => [o, x.traductions[i]])) })))
      .catch(() => null);
  }, [d, langue?.langue, langue?.entrant]); // eslint-disable-line react-hooks/exhaustive-deps

  async function envoyer(dejaTraduit = "") {
    let t = texte.trim();
    if (!t || !d) return;
    setBusy(true); setErreur("");
    try {
      if (langue?.sortant && !dejaTraduit) {
        const x = await apiSend("/api/traduire", { textes: [t], vers: "fr", depuis: langue.langue, genre: "message" });
        if (langue.apercu) { setApercu({ original: t, traduit: x.traductions[0] }); setBusy(false); return; }
        t = x.traductions[0] || t;
      } else if (dejaTraduit) t = dejaTraduit;
      setApercu(null);
      if (d.fil.echangeId) await apiSend("/api/reseau", { action: "message", echangeId: d.fil.echangeId, text: t });
      else if (d.fil.leadId) await apiSend("/api/kojipage/demandes", { action: "repondre", id: d.fil.leadId, texte: t });
      else if (d.fil.quoteId) await apiSend(`/api/quotes/${d.fil.quoteId}/messages`, { texte: t });
      else await apiSend(`/api/marketplace/offres/${d.fil.offreId}/messages`, { message: t });
      setTexte("");
      await charger();
    } catch (e) { setErreur(e.message); }
    setBusy(false);
  }
  async function suggestion(decision) {
    try { await apiSend("/api/messages", { action: "suggestion", fil: cle, decision }, "PATCH"); await charger(); } catch (e) { setErreur(e.message); }
  }
  async function enregistrerReponse() {
    if (!texte.trim()) return;
    try { const r = await apiSend("/api/messages", { action: "reponse", texte }, "PATCH"); setD((x) => ({ ...x, reponses: r.reponses })); } catch (e) { setErreur(e.message); }
  }

  if (erreur && !d) return <section className="m2-th"><p className="err" role="alert">{erreur}</p></section>;
  if (!d) return <section className="m2-th"><p className="muted" style={{ padding: 20 }}>Chargement…</p></section>;
  const c = d.contexte || {};
  const s = d.suggestion;
  const rapides = [...(s?.reponses || []), ...(d.reponses || [])];
  return (
    <>
      <section className="m2-th">
        <button type="button" className="link m2-back" onClick={onRetour}>← Messages</button>
        <header className="m2-thh">
          <div className="m2-who"><strong>{d.fil.titre}</strong><small>{[d.fil.echangeId ? "pro" : d.fil.leadId ? "demande KojiPage" : d.fil.quoteId ? "client" : "demande Radar", d.fil.sousTitre].filter(Boolean).join(" · ")}</small></div>
          {c.projectId ? <Link className="link" href={`/chantiers?project=${c.projectId}`}>Ouvrir le chantier</Link> : d.fil.offreId ? <Link className="link" href={`/marketplace/${d.fil.offreId}`}>Ouvrir la demande</Link> : d.fil.leadId ? <Link className="link" href={`/kojipage/demandes?id=${d.fil.leadId}`}>Ouvrir la demande</Link> : d.fil.echangeId ? <Link className="link" href={`/reseau-pro?tab=echanges&e=${d.fil.echangeId}`}>Ouvrir dans le Réseau pro</Link> : null}
          <button type="button" className={`m2-ib${details ? " on" : ""}`} title="Détails" aria-pressed={details} onClick={() => setDetails((x) => !x)}><Info /></button>
        </header>
        {c.etiquettes?.length ? <div className="m2-ctx">{c.etiquettes.map((e) => <span key={e.texte} className={e.alerte ? "warn" : ""}>{e.texte}</span>)}</div> : null}
        <div className="m2-msgs" aria-live="polite">
          {d.jours.length === 0 ? <p className="m2-day">Pas encore de message : écrivez le premier.</p> : d.jours.map((j) => (
            <div key={j.jour} style={{ display: "contents" }}>
              <div className="m2-day">{j.titre}</div>
              {j.messages.map((m) => {
                const traduit = !m.entreprise && langue?.entrant ? trad[m.texte] : "";
                const voir = langue?.original || originaux[m.id];
                return (
                  <div key={m.id} className={`m2-m ${m.entreprise ? "me" : "th"}`}>
                    <div className="m2-b" dir="auto">{traduit && traduit !== m.texte ? traduit : m.texte}{traduit && traduit !== m.texte && voir ? <span className="m2-orig">Original en français : {m.texte}</span> : null}</div>
                    <small>{m.heure}{traduit && traduit !== m.texte ? <> · traduit du français · <button type="button" className="m2-lien" onClick={() => setOriginaux((o) => ({ ...o, [m.id]: !o[m.id] }))}>{voir ? "masquer l'original" : "voir l'original"}</button></> : null}</small>
                  </div>
                );
              })}
            </div>
          ))}
          <div ref={fin} />
        </div>
        <div className="m2-foot">
          {s && s.etat === "propose" ? (
            <div className="m2-koji">
              <span><b>Koji</b> · {s.resume}</span>
              <button type="button" className="link" onClick={() => suggestion("appliquer")}>{s.action === "livraison" ? "Mettre à jour" : "Noter sur la fiche"}</button>
              <button type="button" className="m2-dis" onClick={() => suggestion("ignorer")}>Ignorer</button>
            </div>
          ) : null}
          {rapides.length ? (
            <div className="m2-sug">
              {(toutes ? rapides : rapides.slice(0, 3)).map((r) => <button type="button" key={r} onClick={() => setTexte(r)}>{r}</button>)}
              {rapides.length > 3 ? <button type="button" className="more" onClick={() => setToutes((x) => !x)}>{toutes ? "Moins" : "Réponses enregistrées"}</button> : null}
            </div>
          ) : null}
          {erreur ? <p className="err" role="alert">{erreur}</p> : null}
          {apercu ? (
            <div className="m2-koji m2-apercu">
              <span>Le client va lire : « {apercu.traduit} »</span>
              <button type="button" className="link" disabled={busy} onClick={() => envoyer(apercu.traduit)}>Envoyer</button>
              <button type="button" className="m2-dis" onClick={() => { setTexte(apercu.traduit); setApercu(null); }}>Corriger la traduction</button>
            </div>
          ) : null}
          <div className="m2-cmp">
            <textarea value={texte} onChange={(e) => setTexte(e.target.value)} placeholder={`Écrire à ${d.fil.titre}`} aria-label={`Écrire à ${d.fil.titre}`} onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) envoyer(); }} dir="auto" />
            {texte.trim() ? <button type="button" className="m2-dis" title="Garder comme réponse enregistrée" onClick={enregistrerReponse}>Garder</button> : null}
            <button type="button" className="m2-ib send" title="Envoyer" disabled={busy || !texte.trim()} onClick={() => envoyer()}><Envoyer /></button>
          </div>
        </div>
      </section>
      {details ? (
        <aside className="m2-pan" aria-label="Détails">
          <div className="m2-ph"><strong>Détails</strong><button type="button" className="link" onClick={() => setDetails(false)}>Fermer</button></div>
          <div className="m2-sec">
            <span className="lab">{d.fil.quoteId ? "Chantier" : "Demande"}</span>
            {(c.details || []).map(([k, v]) => <div className="kv" key={k}><span>{k}</span><b>{v}</b></div>)}
            {c.adresse ? <div className="kv"><span>Adresse</span><b>{c.adresse}</b></div> : null}
          </div>
          <div className="m2-sec"><span className="lab">Dans ce fil</span><p>{c.dansCeFil}</p></div>
          <div className="m2-sec">
            <span className="lab">Documents · {(c.documents || []).length}</span>
            {(c.documents || []).map((x) => <Link key={x.titre} className="m2-dl" href={x.lien}><Doc />{x.titre}</Link>)}
          </div>
        </aside>
      ) : null}
    </>
  );
}

export default function Messages() {
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState("");
  const [sel, setSel] = useState("");
  const [filtre, setFiltre] = useState("tous");
  const [q, setQ] = useState("");
  const [nouveau, setNouveau] = useState(null);
  const charger = () => apiGet("/api/messages").then(setData).catch((e) => setErreur(e.message));
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("fil")) setSel(p.get("fil"));
    charger();
  }, []);
  const fils = useMemo(() => (data ? filtrerFils(data.fils, { filtre, q }) : []), [data, filtre, q]);
  const k = data?.compteurs;

  return (
    <Shell variant="pro">
      {erreur ? <p className="err" role="alert">{erreur}</p> : null}
      <div className={`m2-grid${sel ? " sel" : ""}`}>
        <div className="m2-list">
          <div className="m2-lh">
            <div className="m2-top"><h1>Messages</h1><button type="button" className="m2-new" title="Nouveau message" onClick={() => apiGet("/api/messages?nouveau=1").then((x) => setNouveau(x.clients)).catch((e) => setErreur(e.message))}><Plus /></button></div>
            <input className="m2-srch" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher" aria-label="Rechercher un nom, un chantier ou un mot" />
            <div className="m2-seg" role="tablist">
              {[["tous", "Tous"], ["nonlus", `Non lus${k?.filsNonLus ? ` ${k.filsNonLus}` : ""}`], ["clients", "Clients"], ["pros", "Pros"]].map(([id, l]) => <button type="button" key={id} role="tab" aria-selected={filtre === id} className={filtre === id ? "on" : ""} onClick={() => setFiltre(id)}>{l}</button>)}
            </div>
          </div>
          {nouveau ? (
            <div className="m2-items">
              <p className="m2-vide">Écrire à un client dont le devis est envoyé ou signé :</p>
              {nouveau.length === 0 ? <p className="m2-vide">Tous vos clients ont déjà un fil.</p> : nouveau.map((x) => (
                <button type="button" key={x.quoteId} className="m2-cv" onClick={() => { setSel(`devis:${x.quoteId}`); setNouveau(null); }}>
                  <span className="m2-av">+</span><div className="m2-t"><div className="m2-h"><strong>{x.titre}</strong></div><span className="m2-c">{x.sousTitre}</span></div>
                </button>
              ))}
              <button type="button" className="link" style={{ margin: 16 }} onClick={() => setNouveau(null)}>Retour aux conversations</button>
            </div>
          ) : (
            <div className="m2-items">
              {!data ? <p className="m2-vide">Chargement…</p> : fils.length === 0 ? (
                <p className="m2-vide">{filtre === "pros" ? "Pas encore d'échange avec un pro. Répondez à un besoin ou contactez un pro dans le Réseau pro." : data.fils.length ? "Aucune conversation ne correspond." : "Pas encore de conversation. Vos clients vous écrivent depuis leur devis ; les demandes du Radar arrivent ici aussi."}</p>
              ) : fils.map((f) => (
                <button type="button" key={f.cle} className={`m2-cv${sel === f.cle ? " on" : ""}${f.nonLus ? " un" : ""}`} onClick={() => setSel(f.cle)}>
                  <span className="m2-av">{f.initiales}</span>
                  <div className="m2-t">
                    <div className="m2-h"><strong>{f.titre}</strong><small>{f.dernier?.quand}</small></div>
                    <span className="m2-x">{f.dernier?.entreprise ? "Vous : " : ""}{f.dernier?.texte}</span>
                    <span className="m2-c">{f.sousTitre}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        {sel ? <Fil key={sel} cle={sel} onLu={charger} onRetour={() => setSel("")} /> : <section className="m2-th"><p className="m2-vide" style={{ padding: 24 }}>Choisissez une conversation.</p></section>}
      </div>
    </Shell>
  );
}
