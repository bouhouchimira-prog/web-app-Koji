"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiSend } from "../../lib/client-api";
import { estOuvre, finApres, joursOccupes, jourLong, lendemainOuvre, premierOuvre } from "../../lib/calendrier-pro";
import { fixText } from "../../lib/text";

// Planifier un lot (maquette PRO-11.2) : Koji propose le premier créneau
// (après le lot précédent, intervenant libre), affiche les disponibilités
// de la semaine, calcule la fin en jours ouvrés et peut prévenir
// l'intervenant. Fiche d'un rendez-vous (PRO-11.4).
const auj = () => new Date().toISOString().slice(0, 10);
const plus = (j, n) => new Date(Date.parse(`${j}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const lundi = (j) => { const d = new Date(`${j}T12:00:00Z`); return plus(j, -((d.getUTCDay() + 6) % 7)); };
const CRENEAUX = { journee: "Journée", matin: "Matin", apresmidi: "Après-midi" };

export function LotPanneau({ lot = null, chantiers = [], workers = [], taches = [], documents = [], onFermer, onFait }) {
  const [projectId, setProjectId] = useState(lot?.projectId || chantiers[0]?.projectId || "");
  const [nomLot, setNomLot] = useState(lot?.lot || "");
  const [workerId, setWorkerId] = useState(lot?.workerIds?.[0] || "");
  const [effectif, setEffectif] = useState(1);
  const [jours, setJours] = useState(lot?.jours || 1);
  const [debut, setDebut] = useState("");
  const [creneau, setCreneau] = useState("journee");
  const [prevenir, setPrevenir] = useState(true);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState("");
  const chantier = chantiers.find((c) => c.projectId === projectId);
  const apres = lot && lot.projectId === projectId && lot.lot === nomLot ? lot.apres : "";

  // Proposition : premier créneau libre après le lot précédent.
  useEffect(() => {
    let vivant = true;
    apiSend("/api/calendrier", { action: "proposer", workerIds: workerId ? [workerId] : [], jours, apres: apres || auj() })
      .then((r) => { if (vivant && r.creneau) setDebut(r.creneau.debut); })
      .catch(() => {});
    return () => { vivant = false; };
  }, [workerId, jours, apres]);

  const fin = debut ? finApres(debut, jours) : "";
  const semaine = useMemo(() => {
    const base = lundi(debut || auj());
    const occ = workerId ? joursOccupes(taches, workerId) : new Set();
    return Array.from({ length: 5 }, (_, i) => plus(base, i)).map((d) => ({ d, ferie: !estOuvre(d), occupe: occ.has(d), propose: debut && d >= debut && d <= fin }));
  }, [debut, fin, workerId, taches]);
  const worker = workers.find((w) => w.id === workerId);
  const docs = documents.filter((d) => d.workerId === workerId);

  async function planifier() {
    if (!projectId || !nomLot || !debut) { setErreur("Choisissez le chantier, le lot et la date."); return; }
    setBusy(true); setErreur("");
    try {
      const r = await apiSend("/api/calendrier", { action: "planifier-lot", projectId, lot: nomLot, workerIds: workerId ? [workerId] : [], effectif, debut, jours, creneau, prevenir });
      onFait(`${nomLot} planifié du ${jourLong(r.debut)} au ${jourLong(r.fin)}${r.prevenus?.length ? ` · ${r.prevenus.join(", ")} prévenu` : ""}.`);
    } catch (e) { setErreur(e.message); setBusy(false); }
  }

  return (
    <div className="k-lot">
      <div className="fgrid">
        <label className="full">Chantier
          <select value={projectId} onChange={(e) => { setProjectId(e.target.value); setNomLot(""); }}>
            {chantiers.map((c) => <option key={c.projectId} value={c.projectId}>{fixText(c.title)}</option>)}
          </select>
        </label>
        <label className="full">Lot
          <select value={nomLot} onChange={(e) => setNomLot(e.target.value)}>
            <option value="">Choisir…</option>
            {(chantier?.lots || []).map((l) => <option key={l}>{fixText(l)}</option>)}
          </select>
        </label>
        <label>Intervenant
          <select value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
            <option value="">À attribuer</option>
            {workers.map((w) => <option key={w.id} value={w.id}>{fixText(w.name)}{w.type === "Sous-traitant" ? " · sous-traitant" : ""}</option>)}
          </select>
        </label>
        <label>Effectif<input type="number" min="1" max="20" value={effectif} onChange={(e) => setEffectif(Math.max(1, Number(e.target.value) || 1))} /></label>
      </div>
      {debut ? <p className="k-prop">Premier créneau possible : <b>{jourLong(debut)}</b>{[lot?.lotPrecedent && apres ? ` Le lot précédent (${fixText(lot.lotPrecedent)}) se termine avant` : "", worker ? ` ${fixText(worker.name)} est libre ce jour-là` : ""].filter(Boolean).map((x) => `${x}.`).join("")}</p> : null}
      <div className="k-dispo" aria-label="Disponibilités de la semaine">
        {semaine.map((j) => <span key={j.d} className={j.ferie ? "fe" : j.propose ? "pr" : j.occupe ? "oc" : ""}><b>{jourLong(j.d).split(" ").slice(0, 2).join(" ")}</b>{j.ferie ? "férié" : j.propose ? "proposé" : j.occupe ? "occupé" : "libre"}</span>)}
      </div>
      <div className="fgrid">
        <label>Début<input type="date" value={debut} onChange={(e) => setDebut(e.target.value ? premierOuvre(e.target.value) : "")} /></label>
        <label>Durée · jours ouvrés<input type="number" min="1" max="120" value={jours} onChange={(e) => setJours(Math.max(1, Number(e.target.value) || 1))} /></label>
      </div>
      <div className="kp-seg" role="group" aria-label="Créneau">{Object.entries(CRENEAUX).map(([k, l]) => <button type="button" key={k} className={creneau === k ? "on" : ""} onClick={() => setCreneau(k)}>{l}</button>)}</div>
      {fin ? <p className="fx-note">Fin calculée : {jourLong(fin)} · week-ends et fériés exclus.</p> : null}
      {docs.map((d) => <div className="k-warn" key={d.doc}><b>{fixText(d.worker)} : {d.texte}</b><span>{d.nom} : exigible pour tout contrat de 5 000 € HT ou plus, puis tous les 6 mois.</span><Link className="link" href={`/contacts?id=${d.contactId}`}>Demander {d.doc === "urssaf" ? "l'attestation" : "le document"}</Link></div>)}
      <label className="chk"><input type="checkbox" checked={prevenir} onChange={(e) => setPrevenir(e.target.checked)} disabled={!worker} />Prévenir {worker ? fixText(worker.name) : "l'intervenant"} par e-mail, avec l'adresse du chantier</label>
      {erreur ? <p className="err" role="alert">{erreur}</p> : null}
      <div className="pm-act">
        <button type="button" className="btn btn-sec" onClick={onFermer}>Annuler</button>
        <button type="button" className="btn btn-main" disabled={busy || !nomLot || !debut} onClick={planifier}>{busy ? "…" : "Planifier le lot"}</button>
      </div>
    </div>
  );
}

export function PlanifierPanneau({ lot, onglet: ongletInitial = "lot", onFermer, onRdv, onAbsence, ...props }) {
  const [onglet, setOnglet] = useState(lot ? "lot" : ongletInitial);
  return (
    <div className="env-panel k-plan" role="dialog" aria-label="Planifier">
      <div className="card-h"><h2>Planifier</h2><button type="button" className="link" onClick={onFermer}>Fermer</button></div>
      <div className="kp-seg" role="tablist">
        {[["lot", "Lot de chantier"], ["rdv", "Rendez-vous"], ["livraison", "Livraison"], ["absence", "Absence"]].map(([k, l]) => <button type="button" key={k} role="tab" aria-selected={onglet === k} className={onglet === k ? "on" : ""} onClick={() => setOnglet(k)}>{l}</button>)}
      </div>
      {onglet === "lot" ? <LotPanneau lot={lot} onFermer={onFermer} {...props} /> : null}
      {onglet === "rdv" ? <div className="k-lot"><p className="fx-note">Visite, réunion de chantier, rendez-vous du Radar : date, heure, chantier et participants.</p><button type="button" className="btn btn-main" onClick={onRdv}>Créer le rendez-vous</button></div> : null}
      {onglet === "livraison" ? <div className="k-lot"><p className="fx-note">Les livraisons viennent des bons de commande : la date et le lieu se règlent sur le bon, et s'affichent ici seuls.</p><Link className="btn btn-main" href="/fournitures?onglet=bons">Ouvrir les bons de commande</Link></div> : null}
      {onglet === "absence" ? <div className="k-lot"><p className="fx-note">Congé, formation, arrêt : l'intervenant n'est pas proposé ces jours-là.</p><button type="button" className="btn btn-main" onClick={onAbsence}>Noter une absence</button></div> : null}
    </div>
  );
}

// Fiche d'un rendez-vous (PRO-11.4) : quand, où, chantier, qui ; Déplacer,
// Annuler, préparer la visite.
export function FicheEvenement({ event, chantiers = [], onFermer, onModifier, onAnnuler }) {
  const d = new Date(event.startAt);
  const f = new Date(event.endAt || event.startAt);
  const heure = (x) => x.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }).replace(":", " h ").replace(" h 00", " h");
  const chantier = chantiers.find((c) => c.projectId === event.projectId);
  const visite = /visite|devis|radar/i.test(`${event.eventType} ${event.title}`);
  return (
    <div className="pmodal-bg" onClick={onFermer}>
      <div className="pmodal k-fiche" role="dialog" aria-modal="true" aria-label={event.title} onClick={(e) => e.stopPropagation()}>
        <span className="eyebrow">Calendrier · {d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</span>
        <div className="card-h"><h2>{fixText(event.title || "Rendez-vous")}</h2><button type="button" className="link" onClick={onFermer}>Fermer</button></div>
        <div className="kv"><span>Quand</span><b>{event.allDay ? d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) : `${d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} · ${heure(d)} – ${heure(f)}`}</b></div>
        <div className="kv"><span>Où</span><b>{fixText(event.address || chantier?.address || "—")}</b></div>
        <div className="kv"><span>Chantier</span><b>{fixText(chantier?.title || event.projectTitle || "—")}</b></div>
        <div className="kv"><span>Client</span><b>{fixText(event.clientName || "—")}</b></div>
        {event.notes ? <div className="kv"><span>Notes</span><b>{fixText(event.notes)}</b></div> : null}
        {visite ? (
          <div className="k-avant">
            <span className="lab">Avant la visite</span>
            <div className="kv"><span>Relire la demande du client</span><b>{event.projectId ? <Link className="link" href={`/chantiers?project=${event.projectId}`}>ouvrir le chantier</Link> : "—"}</b></div>
            <div className="kv"><span>Mode visite, même sans réseau</span><b>dans l'app Koji Pro</b></div>
            {event.address ? <div className="kv"><span>Itinéraire</span><b><a className="link" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(event.address)}`} target="_blank" rel="noreferrer">ouvrir</a></b></div> : null}
            <p className="fx-note">Après la visite, Koji propose de passer au devis guidé.</p>
          </div>
        ) : null}
        <div className="pm-act">
          <button type="button" className="btn btn-sec" onClick={onModifier}>Déplacer</button>
          <button type="button" className="btn btn-sec k-del" onClick={onAnnuler}>Annuler le rendez-vous</button>
          {visite ? <Link className="btn btn-main" href="/devis?new=1&mode=ia">Préparer le devis guidé</Link> : null}
        </div>
      </div>
    </div>
  );
}

export { lendemainOuvre };
