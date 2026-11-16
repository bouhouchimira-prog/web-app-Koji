"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Shell } from "../../components/Shell";
import { apiGet, apiSend } from "../../lib/client-api";
import { fichierPourEnvoi } from "../../lib/fichier-client";
import "../fournitures/fournitures.css";
import "./contacts.css";

// Contacts (maquettes PRO-10 à 10.3) : carnet unique (clients,
// sous-traitants, fournisseurs, prescripteurs), liste dense « à faire
// d'abord », fiche avec une seule action jaune, argent du client, documents
// de vigilance des sous-traitants, blocs selon le type, historique rempli
// seul, note d'appel à la voix ou au clavier, ajout par carte de visite,
// SIREN, fichier ou contacts du téléphone.
const euro = (n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n) || 0);
const euro0 = (n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(n) || 0);
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const jourCourt = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || "")); return m ? `${Number(m[3])} ${MOIS[Number(m[2]) - 1]}` : ""; };
const quand = (iso) => (String(iso).slice(0, 10) === new Date().toISOString().slice(0, 10) ? "Aujourd'hui" : jourCourt(iso));
const AV = { client: "cli", prospect: "cli", sous_traitant: "st", fournisseur: "fo", architecte: "pr" };
const TYPES = { client: "Client", sous_traitant: "Sous-traitant", fournisseur: "Fournisseur", architecte: "Prescripteur", prospect: "Prospect", donneur_ordre: "Donneur d'ordre", autre: "Autre" };
const FILTRES = { tout: "Tout", messages: "Messages", appels: "Appels et notes", documents: "Documents" };
const TON_DOC = { ok: "", echeance: "wait", manquant: "late", expire: "late" };
const IcoCheck = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>;
const tel = (p) => String(p || "").replace(/[^\d+]/g, "");

function Liste({ data, sel, onSel, onAjouter }) {
  const [q, setQ] = useState("");
  const [onglet, setOnglet] = useState("tous");
  const [tri, setTri] = useState("afaire");
  const [type, setType] = useState("");
  const liste = useMemo(() => {
    const t = q.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    let l = data.contacts.filter((c) => (onglet === "tous" || (onglet === "afaire" && c.aFaire) || (onglet === "clients" && !c.pro) || (onglet === "pros" && c.pro)) && (!type || c.type === type));
    if (t) l = l.filter((c) => `${c.nom} ${c.telephone} ${c.email} ${c.sousTitre}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s/g, "").includes(t.replace(/\s/g, "")));
    return [...l].sort((a, b) => tri === "nom" ? a.nom.localeCompare(b.nom, "fr") : tri === "recent" ? String(b.dernier).localeCompare(String(a.dernier)) : (b.aFaire - a.aFaire) || Boolean(b.flag) - Boolean(a.flag) || String(b.dernier).localeCompare(String(a.dernier)));
  }, [data, q, onglet, tri, type]);
  const k = data.compteurs;
  return (
    <div className="ct-list">
      <div className="ct-lh">
        <div className="ct-top"><h1>Contacts</h1><button type="button" className="btn btn-main ct-add" onClick={onAjouter}>Ajouter</button></div>
        <label className="ct-srch"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, téléphone, SIREN, chantier" aria-label="Rechercher un contact" /></label>
        <div className="ct-seg" role="tablist">
          {[["tous", `Tous ${k.tous}`], ["afaire", `À faire ${k.aFaire}`], ["clients", `Clients ${k.clients}`], ["pros", `Pros ${k.pros}`]].map(([id, l]) => <button type="button" key={id} role="tab" aria-selected={onglet === id} className={onglet === id ? "on" : ""} onClick={() => setOnglet(id)}>{l}</button>)}
        </div>
      </div>
      <div className="ct-sub">
        <label>Trier : <select value={tri} onChange={(e) => setTri(e.target.value)}><option value="afaire">à faire d'abord</option><option value="recent">plus récents</option><option value="nom">nom</option></select></label>
        <label>Type : <select value={type} onChange={(e) => setType(e.target.value)}><option value="">tous</option>{Object.entries(TYPES).map(([v, l]) => <option key={v} value={v}>{l.toLowerCase()}</option>)}</select></label>
      </div>
      <div className="ct-items">
        {liste.length === 0 ? <p className="ct-vide">{data.contacts.length ? "Aucun contact ne correspond." : "Votre carnet est vide : les clients de vos devis y arrivent seuls. Ajoutez vos sous-traitants et fournisseurs."}</p> : liste.map((c) => (
          <button type="button" key={c.id} className={`ct-li2${sel === c.id ? " on" : ""}`} onClick={() => onSel(c.id)}>
            <span className={`ct-av ${AV[c.type] || "cli"}`}>{c.initiales}</span>
            <div className="b">
              <div className="l1"><strong>{c.nom}</strong><small>{jourCourt(c.dernier)}</small></div>
              <div className="l2"><small>{c.sousTitre}</small>{c.flag ? <span className={`ct-todo${c.aFaire ? " late" : ""}`}>{c.flag}</span> : null}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Note({ id, onFait }) {
  const [t, setT] = useState("");
  const [ecoute, setEcoute] = useState(false);
  const dicte = useRef(false);
  const reco = useRef(null);
  function micro() {
    const R = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
    if (!R) return;
    if (ecoute) { reco.current?.stop(); return; }
    const r = new R();
    r.lang = "fr-FR";
    r.interimResults = false;
    r.onresult = (e) => { dicte.current = true; setT((x) => `${x} ${[...e.results].map((x2) => x2[0].transcript).join(" ")}`.trim()); };
    r.onend = () => setEcoute(false);
    reco.current = r;
    setEcoute(true);
    r.start();
  }
  async function noter(kind) {
    if (!t.trim()) return;
    await apiSend("/api/contacts/carnet", { action: "noter", id, texte: t, kind, dictee: dicte.current }, "PATCH");
    setT(""); dicte.current = false;
    onFait();
  }
  const peutDicter = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
  return (
    <div className="ct-note">
      <input value={t} onChange={(e) => setT(e.target.value)} placeholder={peutDicter ? "Noter un appel ou une info, à la voix ou au clavier…" : "Noter un appel ou une info…"} aria-label="Noter un appel ou une info" onKeyDown={(e) => { if (e.key === "Enter") noter("note"); }} />
      {peutDicter ? <button type="button" className="link" onClick={micro} aria-pressed={ecoute}>{ecoute ? "Arrêter" : "Dicter"}</button> : null}
      {t.trim() ? <><button type="button" className="link" onClick={() => noter("appel")}>Appel</button><button type="button" className="link" onClick={() => noter("note")}>Note</button><button type="button" className="link" title="Devient la prochaine action de la fiche" onClick={async () => { await apiSend("/api/contacts/carnet", { action: "prochaine", id, label: t }, "PATCH"); setT(""); onFait(); }}>À faire</button></> : null}
    </div>
  );
}

function Edition({ fiche, onFermer, onFait }) {
  const c = fiche.contact;
  const [f, setF] = useState(() => ({
    type: c.type || "particulier", roles: c.roles?.length ? c.roles : ["client"], genreClient: c.genreClient || "", firstName: c.firstName || "", lastName: c.lastName || "", companyName: c.companyName || "", contactPerson: c.contactPerson || "",
    phone: c.phone || "", email: c.email || "", siret: c.siret || "", address: c.address || "", accessCode: c.accessCode || "", floor: c.floor || "", metier: c.metier || "", preferences: c.preferences || "", disponibilite: c.disponibilite || "",
    facturation: { identique: c.facturation?.identique !== false, adresse: c.facturation?.adresse || "", email: c.facturation?.email || "", commande: c.facturation?.commande || "" },
    syndic: { gestionnaire: "", conseil: "", vote: "", paiement: "", acces: "", documents: "", ...(c.syndic || {}) },
    fournisseur: { compte: "", remises: "", paiement: "", franco: "", commercial: "", ...(c.fournisseurInfo || {}) },
    prescripteur: { remerciement: "", preference: "", ...(c.prescripteurInfo || {}) },
    chantiersApportes: c.chantiersApportes || []
  }));
  const [erreur, setErreur] = useState("");
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const setIn = (g, k) => (e) => setF((x) => ({ ...x, [g]: { ...x[g], [k]: e.target.value } }));
  const role = f.roles[0];
  async function enregistrer() {
    try { await apiSend("/api/contacts/carnet", { id: c.id, ...f }, "PATCH"); onFait("Fiche enregistrée."); } catch (e) { setErreur(e.message); }
  }
  const champ = (label, k, props = {}) => <label className="ed">{label}<input value={f[k]} onChange={set(k)} {...props} /></label>;
  const champIn = (g, label, k) => <label className="ed">{label}<input value={f[g][k]} onChange={setIn(g, k)} /></label>;
  return (
    <div className="env-panel ct-ed" role="dialog" aria-label="Modifier le contact">
      <div className="ct-edh"><h2>Modifier la fiche</h2><button type="button" className="link" onClick={onFermer}>Fermer</button></div>
      {erreur ? <p className="err" role="alert">{erreur}</p> : null}
      <div className="ct-edg">
        <label className="ed">Type<select value={role} onChange={(e) => setF((x) => ({ ...x, roles: [e.target.value] }))}>{Object.entries(TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="ed">Personne ou entreprise<select value={f.type} onChange={set("type")}><option value="particulier">Particulier</option><option value="societe">Entreprise</option></select></label>
        {role === "client" ? <label className="ed">Client<select value={f.genreClient} onChange={set("genreClient")}><option value="">selon le type</option><option value="particulier">particulier</option><option value="entreprise">entreprise</option><option value="syndic">syndic</option></select></label> : null}
        {f.type === "societe" ? champ("Raison sociale", "companyName") : <>{champ("Prénom", "firstName")}{champ("Nom", "lastName")}</>}
        {f.type === "societe" ? champ("Contact · fonction", "contactPerson") : null}
        {champ("Téléphone", "phone", { inputMode: "tel" })}
        {champ("E-mail", "email", { type: "email" })}
        {f.type === "societe" ? champ("SIRET", "siret") : null}
        {role !== "client" ? champ("Activité, métier", "metier") : null}
        {champ(role === "client" ? "Adresse du chantier" : "Adresse", "address")}
        {role === "client" ? <>{champ("Code d'accès", "accessCode")}{champ("Étage, ascenseur", "floor")}{champ("Préférences de contact", "preferences", { placeholder: "préfère les messages, après 18 h" })}</> : null}
        {role === "sous_traitant" ? champ("Disponibilité", "disponibilite", { placeholder: "à partir du 16 nov." }) : null}
      </div>
      {role === "client" ? (
        <fieldset className="ct-fs"><legend>Facturation</legend>
          <label className="ck2"><input type="checkbox" checked={f.facturation.identique} onChange={(e) => setF((x) => ({ ...x, facturation: { ...x.facturation, identique: e.target.checked } }))} /> identique au chantier</label>
          <div className="ct-edg">{!f.facturation.identique ? champIn("facturation", "Adresse de facturation", "adresse") : null}{champIn("facturation", "E-mail de la comptabilité", "email")}{champIn("facturation", "N° de commande à rappeler", "commande")}</div>
        </fieldset>
      ) : null}
      {role === "client" && f.genreClient === "syndic" ? <fieldset className="ct-fs"><legend>Syndic</legend><div className="ct-edg">{champIn("syndic", "Gestionnaire", "gestionnaire")}{champIn("syndic", "Conseil syndical", "conseil")}{champIn("syndic", "Vote des travaux (AG, résolution)", "vote")}{champIn("syndic", "Paiement (appels de fonds)", "paiement")}{champIn("syndic", "Accès", "acces")}{champIn("syndic", "Documents reçus", "documents")}</div></fieldset> : null}
      {role === "fournisseur" ? <fieldset className="ct-fs"><legend>Fournisseur</legend><div className="ct-edg">{champIn("fournisseur", "N° de compte pro", "compte")}{champIn("fournisseur", "Remises négociées", "remises")}{champIn("fournisseur", "Paiement", "paiement")}{champIn("fournisseur", "Franco de port", "franco")}{champIn("fournisseur", "Commercial", "commercial")}</div></fieldset> : null}
      {role === "architecte" ? (
        <fieldset className="ct-fs"><legend>Prescripteur</legend>
          <div className="ct-edg">{champIn("prescripteur", "Remerciement, commission", "remerciement")}{champIn("prescripteur", "Préférence", "preference")}</div>
          <div className="ct-chips">{fiche.tousChantiers.map((ch) => { const on = f.chantiersApportes.includes(ch.projectId); return <button type="button" key={ch.projectId} className={`ob-chip${on ? " on" : ""}`} aria-pressed={on} onClick={() => setF((x) => ({ ...x, chantiersApportes: on ? x.chantiersApportes.filter((p) => p !== ch.projectId) : [...x.chantiersApportes, ch.projectId] }))}>{ch.title}</button>; })}</div>
        </fieldset>
      ) : null}
      <div className="ct-edf"><button type="button" className="btn btn-sec" onClick={onFermer}>Annuler</button><button type="button" className="btn btn-main" onClick={enregistrer}>Enregistrer</button></div>
    </div>
  );
}

function Fiche({ id, onRetour, onChange }) {
  const [fiche, setFiche] = useState(null);
  const [erreur, setErreur] = useState("");
  const [filtre, setFiltre] = useState("tout");
  const [edition, setEdition] = useState(false);
  const [message, setMessage] = useState("");
  const [personne, setPersonne] = useState(null);
  const [affecter, setAffecter] = useState("");
  const charger = () => apiGet(`/api/contacts/carnet?id=${encodeURIComponent(id)}`).then((d) => setFiche(d.fiche)).catch((e) => setErreur(e.message));
  useEffect(() => { setFiche(null); setMessage(""); charger(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (erreur) return <section className="ct-f"><p className="err" role="alert">{erreur}</p></section>;
  if (!fiche) return <section className="ct-f"><p className="muted">Chargement…</p></section>;
  const c = fiche.contact;
  const a = fiche.action;
  const recharger = async (m) => { setMessage(m || ""); await charger(); onChange(); };
  async function demander() {
    try {
      const r = await apiSend("/api/contacts/carnet", { action: "demander", id: c.id, docs: a?.doc ? [a.doc] : undefined });
      await recharger(r.envoye ? `Demande envoyée à ${c.email}.` : `Pas d'e-mail sur la fiche : envoyez ce lien au sous-traitant : ${r.lien}`);
    } catch (e) { setErreur(e.message); }
  }
  async function act(corps, ok, methode = "POST") { try { await apiSend("/api/contacts/carnet", corps, methode); await recharger(ok); } catch (e) { setMessage(e.message); } }
  const actionBtn = a ? (
    a.cle === "relancer" ? <Link className="btn btn-main" href={`/facturation?relancer=${a.invoiceId}`}>{a.label}</Link>
      : a.cle === "vigilance" ? <button type="button" className="btn btn-main" onClick={demander}>{a.label}</button>
        : <button type="button" className="btn btn-main" onClick={() => act({ action: "prochaine", id: c.id, label: "" }, "Fait.", "PATCH")}>Fait</button>
  ) : null;
  const hist = fiche.historique.filter((h) => filtre === "tout" || h.type === filtre);
  const depuis = c.createdAt ? `depuis le ${jourCourt(c.createdAt)} ${String(c.createdAt).slice(0, 4)}` : "";
  const origine = c.source === "devis" ? "arrivé par un devis" : c.source === "kojipage" ? "arrivé par votre KojiPage" : "";
  const pers = Array.isArray(c.personnes) ? c.personnes : [];
  const v = fiche.vigilance;

  return (
    <section className="ct-f">
      <button type="button" className="link ct-back" onClick={onRetour}>← Contacts</button>
      <div className="ct-fh">
        <span className={`ct-av big ${AV[fiche.type] || "cli"}`}>{fiche.initiales}</span>
        <div className="t">
          <span className="eyebrow">{[fiche.typeLabel, fiche.genre, fiche.type === "sous_traitant" ? c.metier : "", depuis, origine, c.siret ? `SIRET ${c.siret}` : ""].filter(Boolean).join(" · ")}</span>
          <h2>{fiche.nom}</h2>
          <small>{[c.contactPerson, c.phone, c.email].filter(Boolean).join(" · ") || "Aucune coordonnée"}</small>
        </div>
        <div className="ct-acts">
          <a className="ct-ab" href={c.phone ? `tel:${tel(c.phone)}` : undefined} aria-disabled={!c.phone}>Appeler</a>
          <a className="ct-ab" href={c.phone ? `sms:${tel(c.phone)}` : c.email ? `mailto:${c.email}` : undefined} aria-disabled={!c.phone && !c.email}>Message</a>
          <a className="ct-ab" href={c.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}` : undefined} target="_blank" rel="noreferrer" aria-disabled={!c.address}>Itinéraire</a>
        </div>
      </div>
      {message ? <p className="notice" role="status">{message}</p> : null}
      {a ? (
        <div className="ct-next">
          <div>
            <strong>{fiche.vigilance?.bloquant && a.cle === "vigilance" ? `${fiche.vigilance.bloquant.nom} manquante : sous-traitant non affectable aux chantiers` : a.texte || a.label}</strong>
            {fiche.vigilance?.bloquant && a.cle === "vigilance" ? <small>{euro0(fiche.pro?.cumulAnnee)} HT confiés en {new Date().getFullYear()} · au-delà de 5 000 € HT, l'attestation est exigée tous les 6 mois, sinon vous êtes solidaire de ses dettes sociales</small> : c.preferences ? <small>{c.preferences}</small> : null}
          </div>
          {actionBtn}
        </div>
      ) : null}

      {fiche.argent ? (
        <div className="ct-strip">
          <div><span>Signé HT</span><b>{euro(fiche.argent.signeHt)}</b></div>
          <div><span>Facturé TTC</span><b>{euro(fiche.argent.factureTtc)}</b></div>
          <div><span>Payé</span><b>{euro(fiche.argent.paye)}</b></div>
          <div className={fiche.argent.retard > 0 ? "ko" : ""}><span>En retard</span><b>{euro(fiche.argent.retard)}</b></div>
        </div>
      ) : null}

      {fiche.type === "sous_traitant" && v ? (
        <>
          <div className="card ct-docs">
              <div className="card-h"><h2>Documents de vigilance</h2><button type="button" className="link" onClick={demander}>Demander</button></div>
              <small className="sm2">Koji lit les dates et prévient un mois avant l'échéance.</small>
              {v.docs.map((d) => (
                <div key={d.cle} className={`ct-doc${d.texte.startsWith("non concerné") ? " na" : ""}`}>
                  <div><strong>{d.nom}</strong><small>{d.aide}</small>{d.aVerifier ? <small>déposé par le sous-traitant, à vérifier{d.lu?.activites ? ` · activités : ${d.lu.activites}` : ""}</small> : null}</div>
                  <span className={`fx-etat ${TON_DOC[d.etat]}`}>{d.texte}</span>
                  {d.recu ? <a className="link" href={`/api/contacts/carnet?id=${c.id}&document=${d.cle}`} target="_blank" rel="noreferrer">Voir</a> : null}
                  {d.aVerifier ? <button type="button" className="link" onClick={() => act({ action: "document", id: c.id, doc: d.cle }, "Document vérifié.")}>Valider</button> : null}
                  {d.facultatif && d.etat === "manquant" ? <button type="button" className="link" onClick={() => act({ action: "document", id: c.id, doc: d.cle, nonConcerne: true }, "Noté : non concerné.")}>Non concerné</button> : null}
                </div>
              ))}
          </div>
          <div className="ct-g3">
            <div className="card">
              <div className="card-h"><h2>Prix constatés</h2></div>
              {fiche.pro?.prix?.length ? fiche.pro.prix.map((p) => <div className="kv" key={p.designation}><span>{p.designation}</span><b>{euro(p.prixHt)}{p.unite ? `/${p.unite}` : ""} HT</b></div>) : <small className="sm2">Lus sur ses factures rangées dans Dépenses : aucune ligne avec quantité pour l'instant.</small>}
              <div className="card-h" style={{ marginTop: 14 }}><h2>Suivi interne</h2></div>
              <div className="kv"><span>Chantiers ensemble</span><b>{fiche.pro?.chantiers.length || 0}</b></div>
              <div className="kv"><span>Disponible</span><b>{c.disponibilite || "—"}</b></div>
              <small className="sm2">Visible par votre entreprise seulement.</small>
            </div>
            <div className="card">
              <div className="card-h"><h2>Chantiers et montants</h2></div>
              {(fiche.pro?.chantiers || []).map((ch) => <div className="kv" key={ch.projectId}><span>{ch.title}{ch.lot ? ` · ${ch.lot}` : ""}</span><b>{euro0(ch.ht)} HT</b></div>)}
              <div className="kv"><span>Cumul {new Date().getFullYear()}</span><b>{euro0(fiche.pro?.cumulAnnee)} HT</b></div>
              {fiche.pro?.autoliquidation ? <div className="kv"><span>TVA</span><b>autoliquidation · facture sans TVA</b></div> : null}
              {(fiche.contrats || []).map((k) => <a className="kv" key={k.id} href={`/reseau-pro/contrat?id=${k.id}`}><span>Contrat · {k.lot || k.chantier}</span><b>{k.etat}</b></a>)}
              <div className="ct-aff">
                <select value={affecter} onChange={(e) => setAffecter(e.target.value)} aria-label="Chantier"><option value="">Affecter à un chantier…</option>{fiche.tousChantiers.map((ch) => <option key={ch.projectId} value={ch.projectId}>{ch.title}</option>)}</select>
                <button type="button" className="btn btn-sec" disabled={!affecter} onClick={() => act({ action: "affecter", id: c.id, projectId: affecter }, "Affecté au chantier.")}>Affecter</button>
                <button type="button" className="btn btn-sec" disabled={!affecter} onClick={async () => { try { const r = await apiSend("/api/sous-traitance", { action: "preparer", contactId: c.id, projectId: affecter, lot: c.metier ? `lot ${c.metier}` : "" }); window.location.href = `/reseau-pro/contrat?id=${r.id}`; } catch (e) { setErreur(e.message); } }}>Préparer le contrat</button>
              </div>
              <small className="sm2">Contrat de sous-traitance et acceptation par le client : avec le Réseau pro.</small>
            </div>
          </div>
        </>
      ) : null}

      {fiche.type === "client" && fiche.genre !== "syndic" ? (
        <div className="ct-g3">
          <div className="card">
            <div className="card-h"><h2>Adresses</h2></div>
            <div className="kv"><span>Chantier</span><b>{c.address || fiche.projets[0]?.address || "—"}</b></div>
            <div className="kv"><span>Facturation</span><b>{c.facturation?.identique === false ? c.facturation.adresse || "—" : "identique au chantier"}</b></div>
            {c.facturation?.email ? <div className="kv"><span>Comptabilité</span><b>{c.facturation.email}</b></div> : null}
            {c.facturation?.commande ? <div className="kv"><span>N° de commande</span><b>{c.facturation.commande}</b></div> : null}
            <div className="kv"><span>Accès</span><b>{[c.accessCode ? `code ${c.accessCode}` : "", c.floor].filter(Boolean).join(" · ") || "—"}</b></div>
            <small className="sm2" style={{ display: "block", marginTop: 8 }}>Code visible par les comptes affectés au chantier.</small>
          </div>
          <div className="card">
            <div className="card-h"><h2>Personnes</h2></div>
            {pers.length === 0 ? <small className="sm2">Qui signe et paie, qui est sur place : ajoutez les personnes de ce contact.</small> : pers.map((p) => <div className="ct-pp" key={p.id}><span className="ct-av sm cli">{(p.nom.split(" ").map((x) => x[0]).join("").slice(0, 2) || "?").toUpperCase()}</span><div><strong>{p.nom}</strong><small>{[p.role, p.telephone].filter(Boolean).join(" · ")}</small></div></div>)}
            {personne ? (
              <form className="ct-pform" onSubmit={(e) => { e.preventDefault(); act({ id: c.id, personnes: [...pers, personne] }, "Personne ajoutée.", "PATCH"); setPersonne(null); }}>
                <input value={personne.nom} onChange={(e) => setPersonne({ ...personne, nom: e.target.value })} placeholder="Nom" required />
                <input value={personne.role} onChange={(e) => setPersonne({ ...personne, role: e.target.value })} placeholder="conjoint · présent aux livraisons" />
                <input value={personne.telephone} onChange={(e) => setPersonne({ ...personne, telephone: e.target.value })} placeholder="Téléphone" />
                <button type="submit" className="btn btn-sec">Ajouter</button>
              </form>
            ) : <button type="button" className="link" style={{ alignSelf: "flex-start", fontSize: 12, marginTop: 6 }} onClick={() => setPersonne({ nom: "", role: "", telephone: "" })}>Ajouter une personne</button>}
          </div>
          <div className="card">
            <div className="card-h"><h2>Pièces</h2></div>
            {fiche.devis.length === 0 ? <small className="sm2">Aucun devis pour l'instant.</small> : fiche.devis.slice(0, 3).map((d) => <div className="kv" key={d.id}><span>{d.signe ? "Devis signé" : "Devis"}</span><b className={d.signe ? "ct-ok" : ""}>{d.signe ? <IcoCheck /> : null}{d.numero}</b></div>)}
            {fiche.devis.some((d) => d.signe && Number(d.tva) < 20) ? <div className="kv"><span>TVA {String(fiche.devis.find((d) => d.signe && Number(d.tva) < 20).tva).replace(".", ",")} %</span><b>mention à la signature</b></div> : null}
            <div className="kv"><span>Photos de visite</span><b>{fiche.photosVisite || "—"}</b></div>
            <div className="kv"><span>Avis KojiPage</span><b>à demander en fin de chantier</b></div>
          </div>
        </div>
      ) : null}

      {fiche.genre === "syndic" ? (
        <div className="ct-tg">
          {[["Gestionnaire", c.syndic?.gestionnaire], ["Conseil syndical", c.syndic?.conseil], ["Vote des travaux", c.syndic?.vote], ["Paiement", c.syndic?.paiement], ["Accès", c.syndic?.acces], ["Documents", c.syndic?.documents]].map(([l, v2]) => <div className="ct-mini" key={l}><div className="kv"><span>{l}</span><b>{v2 || "à renseigner"}</b></div></div>)}
          <p className="fx-note">Pas de démarrage sans PV d'AG et ordre de service.</p>
        </div>
      ) : null}

      {fiche.type === "fournisseur" ? (
        <div className="ct-tg">
          {[["Compte pro", c.fournisseurInfo?.compte], ["Remise négociée", c.fournisseurInfo?.remises], ["Paiement", c.fournisseurInfo?.paiement], ["Franco de port", c.fournisseurInfo?.franco], ["Commercial", c.fournisseurInfo?.commercial], [`Commandes ${new Date().getFullYear()}`, fiche.fournisseur ? `${fiche.fournisseur.commandes} · ${euro0(fiche.fournisseur.commandesHt)} HT` : "—"]].map(([l, v2]) => <div className="ct-mini" key={l}><div className="kv"><span>{l}</span><b>{v2 || "à renseigner"}</b></div></div>)}
          <Link className="btn btn-sec" href="/fournitures?onglet=bons">Nouvelle commande</Link>
        </div>
      ) : null}

      {fiche.type === "architecte" ? (
        <div className="ct-tg">
          <div className="ct-mini"><div className="kv"><span>Chantiers apportés</span><b>{fiche.apportes.length ? `${fiche.apportes.length} · ${fiche.apportes.map((x) => x.title).join(", ")}` : "aucun"}</b></div></div>
          <div className="ct-mini"><div className="kv"><span>Montant signé</span><b>{euro0(fiche.apportes.reduce((s, x) => s + x.signeHt, 0))} HT</b></div></div>
          <div className="ct-mini"><div className="kv"><span>Dernier échange</span><b>{jourCourt(fiche.dernier) || "—"}</b></div></div>
          <div className="ct-mini"><div className="kv"><span>Remerciement</span><b>{c.prescripteurInfo?.remerciement || "aucune commission convenue"}</b></div></div>
          <div className="ct-mini"><div className="kv"><span>Préférence</span><b>{c.prescripteurInfo?.preference || "—"}</b></div></div>
          <p className="fx-note">Toute commission d'apport doit être convenue par écrit et facturée.</p>
        </div>
      ) : null}

      <div className="card ct-tl">
        <div className="card-h"><h2>Historique</h2>
          <div className="kp-seg" role="group" aria-label="Filtre">{Object.entries(FILTRES).map(([k, l]) => <button type="button" key={k} className={filtre === k ? "on" : ""} aria-pressed={filtre === k} onClick={() => setFiltre(k)}>{l}</button>)}</div>
        </div>
        <Note id={c.id} onFait={() => recharger("Noté.")} />
        {hist.length === 0 ? <small className="sm2">Rien pour l'instant : devis, factures, visites et notes s'ajoutent seuls.</small> : hist.map((h) => <div className="ct-ev" key={h.id}><span className="d">{quand(h.quand)}</span><span className="s">{h.titre}</span><span className="x">{h.texte}</span></div>)}
      </div>

      <div className="ct-foot">
        <button type="button" className="btn btn-sec" onClick={() => setEdition(true)}>Modifier la fiche</button>
        {fiche.type === "client" && c.email ? <button type="button" className="link" onClick={async () => { try { await apiSend("/api/contacts", { id: c.id, action: c.linkedUserId ? "resetCredentials" : "createAccess" }, "PATCH"); setMessage("Accès Koji Client envoyé."); } catch (e) { setMessage(e.message); } }}>{c.linkedUserId ? "Renvoyer l'accès Koji Client" : "Créer l'accès Koji Client"}</button> : null}
        <button type="button" className="link" onClick={async () => { try { await apiSend("/api/contacts", { id: c.id, action: "archive" }, "PATCH"); onChange(); onRetour(); } catch (e) { setMessage(e.message); } }}>Archiver</button>
      </div>
      {edition ? <Edition fiche={fiche} onFermer={() => setEdition(false)} onFait={async (m) => { setEdition(false); await recharger(m); }} /> : null}
    </section>
  );
}

const VIDE = { type: "societe", roles: ["sous_traitant"], companyName: "", contactPerson: "", firstName: "", lastName: "", phone: "", email: "", siret: "", address: "", metier: "" };

function Ajouter({ onFermer, onCree }) {
  const [src, setSrc] = useState("carte");
  const [f, setF] = useState(VIDE);
  const [lu, setLu] = useState(null);
  const [dup, setDup] = useState(null);
  const [choix, setChoix] = useState("completer");
  const [busy, setBusy] = useState("");
  const [erreur, setErreur] = useState("");
  const [siren, setSiren] = useState("");
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const pickerDispo = typeof navigator !== "undefined" && "contacts" in navigator && "select" in (navigator.contacts || {});

  async function carte(e) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    setBusy("Koji lit la carte…"); setErreur("");
    try {
      const r = await apiSend("/api/contacts/carnet", { action: "carte", data: await fichierPourEnvoi(file, { cote: 1600 }) });
      setF({ ...VIDE, ...r.proposition }); setLu(r); setDup(r.doublon); setChoix(r.doublon ? "completer" : "creer");
    } catch (er) { setErreur(er.message); }
    setBusy("");
  }
  async function annuaire() {
    setBusy("Recherche dans l'annuaire…"); setErreur("");
    try {
      const r = await apiSend("/api/contacts/carnet", { action: "siren", siren });
      setF((x) => ({ ...x, type: "societe", companyName: r.fiche.raisonSociale, siret: r.fiche.siret || r.fiche.siren, address: [r.fiche.addressLine1, r.fiche.postalCode, r.fiche.city].filter(Boolean).join(" "), activite: r.fiche.activite }));
      setLu({ annuaire: true, proposition: r.fiche });
      setDup(r.doublon ? { id: r.doublon, nom: r.fiche.raisonSociale, par: "même SIREN" } : null);
    } catch (er) { setErreur(er.message); }
    setBusy("");
  }
  async function fichier(e) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    setBusy("Import…"); setErreur("");
    try { const r = await apiSend("/api/contacts/carnet", { action: "csv", texte: await file.text() }); onCree(`${r.crees} contact${r.crees > 1 ? "s" : ""} ajouté${r.crees > 1 ? "s" : ""}${r.doublons ? `, ${r.doublons} déjà dans le carnet` : ""}.`); } catch (er) { setErreur(er.message); }
    setBusy("");
  }
  async function telephone() {
    try {
      const [p] = await navigator.contacts.select(["name", "tel", "email"], { multiple: false });
      if (p) setF((x) => ({ ...x, type: "particulier", lastName: p.name?.[0] || "", phone: p.tel?.[0] || "", email: p.email?.[0] || "" }));
    } catch { /* annulé */ }
  }
  async function enregistrer() {
    setErreur("");
    try {
      const r = await apiSend("/api/contacts/carnet", { ...f, source: src, ...(dup && choix === "completer" ? { completer: dup.id } : {}), forcer: choix === "creer" });
      onCree(dup && choix === "completer" ? "Fiche existante complétée." : "Contact ajouté.", r.id);
    } catch (er) { setErreur(er.message); }
  }
  const role = f.roles[0];
  return (
    <div className="env-panel ct-pan" role="dialog" aria-label="Ajouter un contact">
      <div className="ct-edh"><h2>Ajouter un contact</h2><button type="button" className="link" onClick={onFermer}>Fermer</button></div>
      <div className="ct-src">
        <label className={src === "carte" ? "on" : ""} onClick={() => setSrc("carte")}><b>Carte de visite</b><small>photo, lue par Koji</small><input type="file" accept="image/*,application/pdf" capture="environment" hidden onChange={carte} /></label>
        <button type="button" className={src === "tel" ? "on" : ""} disabled={!pickerDispo} onClick={() => { setSrc("tel"); telephone(); }}><b>Téléphone</b><small>{pickerDispo ? "depuis vos contacts" : "sur le téléphone, dans l'app"}</small></button>
        <label className={src === "fichier" ? "on" : ""} onClick={() => setSrc("fichier")}><b>Fichier</b><small>Excel enregistré en CSV</small><input type="file" accept=".csv,text/csv" hidden onChange={fichier} /></label>
        <button type="button" className={src === "siren" ? "on" : ""} onClick={() => setSrc("siren")}><b>SIREN</b><small>fiche remplie seule</small></button>
      </div>
      {src === "siren" ? <form className="ct-aff" onSubmit={(e) => { e.preventDefault(); annuaire(); }}><input value={siren} onChange={(e) => setSiren(e.target.value)} inputMode="numeric" placeholder="SIREN ou SIRET" aria-label="SIREN" /><button type="submit" className="btn btn-sec" disabled={siren.replace(/\D/g, "").length < 9}>Rechercher</button></form> : null}
      {src === "fichier" ? <p className="fx-note">Première ligne : Nom ; Prénom ; Entreprise ; Téléphone ; E-mail ; Type (client, sous-traitant, fournisseur…). Les contacts déjà dans le carnet sont ignorés.</p> : null}
      {busy ? <p className="notice" role="status">{busy}</p> : null}
      {erreur ? <p className="err" role="alert">{erreur}</p> : null}
      {lu ? <span className="eyebrow">{lu.annuaire ? "Lu par Koji, complété par l'annuaire des entreprises" : "Lu par Koji"}</span> : null}
      <div className="ct-edg">
        <label className="ed">Type<select value={role} onChange={(e) => setF((x) => ({ ...x, roles: [e.target.value] }))}>{Object.entries(TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="ed">Personne ou entreprise<select value={f.type} onChange={set("type")}><option value="societe">Entreprise</option><option value="particulier">Particulier</option></select></label>
        {f.type === "societe" ? <><label className="ed">Entreprise<input value={f.companyName} onChange={set("companyName")} /></label><label className="ed">Contact<input value={f.contactPerson} onChange={set("contactPerson")} placeholder="Prénom Nom · fonction" /></label></> : <><label className="ed">Prénom<input value={f.firstName} onChange={set("firstName")} /></label><label className="ed">Nom<input value={f.lastName} onChange={set("lastName")} /></label></>}
        <label className="ed">Téléphone<input value={f.phone} onChange={set("phone")} inputMode="tel" /></label>
        <label className="ed">E-mail<input type="email" value={f.email} onChange={set("email")} /></label>
        {f.type === "societe" ? <label className="ed">SIRET<input value={f.siret} onChange={set("siret")} /></label> : null}
        {role !== "client" ? <label className="ed">Activité<input value={f.metier} onChange={set("metier")} placeholder={f.activite ? `code ${f.activite}` : "électricité"} /></label> : null}
        <label className="ed">Adresse<input value={f.address} onChange={set("address")} /></label>
      </div>
      {lu?.proposition?.actif === false ? <p className="err">L'annuaire indique un établissement fermé.</p> : null}
      {dup ? (
        <div className="ct-dup">
          <div><strong>Ce contact existe déjà : {dup.nom}</strong><small>{dup.par}{dup.createdAt ? ` · créé le ${jourCourt(dup.createdAt)}` : ""}{dup.manque?.length ? ` · ${dup.manque.map((m) => ({ phone: "téléphone", email: "e-mail", siret: "SIRET" })[m]).join(", ")} absent` : ""}</small></div>
          <div className="kp-seg" role="group"><button type="button" className={choix === "completer" ? "on" : ""} onClick={() => setChoix("completer")}>Compléter la fiche existante</button><button type="button" className={choix === "creer" ? "on" : ""} onClick={() => setChoix("creer")}>Créer quand même</button></div>
        </div>
      ) : null}
      {role === "sous_traitant" ? <p className="fx-note">Pour un sous-traitant, Koji demandera ensuite attestation URSSAF · Kbis · décennale · RC pro.</p> : null}
      <div className="ct-edf"><button type="button" className="btn btn-sec" onClick={onFermer}>Annuler</button><button type="button" className="btn btn-main" disabled={Boolean(busy)} onClick={enregistrer}>{dup && choix === "completer" ? "Compléter la fiche" : "Enregistrer"}</button></div>
    </div>
  );
}

export default function Contacts() {
  const [data, setData] = useState(null);
  const [sel, setSel] = useState("");
  const [ajout, setAjout] = useState(false);
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");
  const charger = () => apiGet("/api/contacts/carnet").then(setData).catch((e) => setErreur(e.message));
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("id")) setSel(p.get("id"));
    if (p.get("ajouter") === "1") setAjout(true);
    charger();
  }, []);
  return (
    <Shell variant="pro">
      {erreur ? <p className="err" role="alert">{erreur}</p> : null}
      {message ? <p className="notice ct-msg" role="status">{message}</p> : null}
      {!data ? <p className="muted">Chargement…</p> : (
        <div className={`ct-grid${sel ? " has-sel" : ""}`}>
          <Liste data={data} sel={sel} onSel={setSel} onAjouter={() => setAjout(true)} />
          {sel ? <Fiche key={sel} id={sel} onRetour={() => setSel("")} onChange={charger} /> : <section className="ct-f ct-f-vide"><p className="muted">Choisissez un contact. Les clients de vos devis arrivent seuls dans le carnet.</p></section>}
        </div>
      )}
      {ajout ? <Ajouter onFermer={() => setAjout(false)} onCree={async (m, id) => { setAjout(false); setMessage(m); await charger(); if (id) setSel(id); }} /> : null}
    </Shell>
  );
}
