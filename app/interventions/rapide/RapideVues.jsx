"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiGet, apiSend } from "../../../lib/client-api";
import { euros2, heureParis, messagePrix, prixValides, totalLignes } from "../../../lib/intervention-rapide";

// Écrans de l'intervention rapide (maquette PRO-17.1). Données :
// /api/interventions/rapide.
const smsLien = (tel, texte) => `sms:${String(tel || "").replace(/[^\d+]/g, "")}${texte ? `?&body=${encodeURIComponent(texte)}` : ""}`;
const telLien = (tel) => `tel:${String(tel || "").replace(/[^\d+]/g, "")}`;
const ETAPES_LABEL = { creee: "créée", acceptee: "prix acceptés", en_route: "en route", sur_place: "sur place", devis_signe: "devis signé", terminee: "terminée", annulee: "annulée" };
const hh = (iso) => heureParis(iso);

function MesPrix({ prix, entreprise, onSave, setErreur }) {
  const [p, setP] = useState({ deplacement: prix?.deplacement || "", demiHeure: prix?.demiHeure || "" });
  const [busy, setBusy] = useState(false);
  async function enregistrer() {
    setBusy(true);
    try { const r = await apiSend("/api/interventions/rapide", { action: "prix", ...p }); onSave(r.prix); } catch (e) { setErreur(e.message); }
    setBusy(false);
  }
  return (
    <div className="card">
      <div className="card-h"><h2>Mes prix d'intervention</h2></div>
      <div className="ir-2">
        <div className="ir-f"><label htmlFor="ir-dep">Déplacement et 1re demi-heure (€ TTC)</label><input id="ir-dep" inputMode="decimal" value={p.deplacement} onChange={(e) => setP({ ...p, deplacement: e.target.value })} /></div>
        <div className="ir-f"><label htmlFor="ir-dh">Demi-heure suivante (€ TTC)</label><input id="ir-dh" inputMode="decimal" value={p.demiHeure} onChange={(e) => setP({ ...p, demiHeure: e.target.value })} /></div>
      </div>
      {prixValides({ deplacement: Number(String(p.deplacement).replace(",", ".")), demiHeure: Number(String(p.demiHeure).replace(",", ".")) }) ? <div className="ir-msg">« {messagePrix({ entreprise, prix: { deplacement: Number(String(p.deplacement).replace(",", ".")), demiHeure: Number(String(p.demiHeure).replace(",", ".")) } })} »</div> : null}
      <div className="eq-act" style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}><button type="button" className="btn btn-sec" disabled={busy} onClick={enregistrer}>Enregistrer mes prix</button></div>
    </div>
  );
}

export function Liste({ setErreur }) {
  const [d, setD] = useState(null);
  useEffect(() => { apiGet("/api/interventions/rapide").then(setD).catch((e) => setErreur(e.message)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return <p className="muted">Chargement…</p>;
  return (
    <>
      <div className="head">
        <div className="stack"><span className="eyebrow">un client vous appelle directement</span><h1>Interventions rapides</h1></div>
        <Link className="btn btn-main" href="/interventions/rapide/nouvelle">Nouvelle intervention</Link>
      </div>
      <div className="card">
        {d.interventions.length ? d.interventions.map((i) => (
          <Link key={i.id} href={`/interventions/rapide/${i.id}`} className="ir-row">
            <div><strong>{i.client}{i.probleme ? ` · ${i.probleme}` : ""}</strong><small>{i.site} · {new Date(i.createdAt).toLocaleDateString("fr-FR")}</small></div>
            <span className="sm2">{i.total ? `${euros2(i.total)} · ` : ""}{ETAPES_LABEL[i.etape]}</span>
          </Link>
        )) : <p className="muted">Aucune intervention rapide pour l'instant. Quand un client vous appelle pour un dépannage, créez-la ici : ses prix partent par écrit, puis devis avant travaux, facture et paiement.</p>}
      </div>
      <MesPrix prix={d.prix} entreprise={d.entreprise} onSave={(prix) => setD({ ...d, prix })} setErreur={setErreur} />
      <Link className="link" href="/interventions" style={{ alignSelf: "flex-start" }}>Rapports d'intervention</Link>
    </>
  );
}

export function Nouvelle({ setErreur }) {
  const router = useRouter();
  const [d, setD] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [f, setF] = useState({ client: "", contactId: "", telephone: "", email: "", adresse: "", acces: "", probleme: "", urgence: "maintenant", envoyerPrix: true });
  const [busy, setBusy] = useState(false);
  const [cree, setCree] = useState(null);
  useEffect(() => {
    apiGet("/api/interventions/rapide").then(setD).catch((e) => setErreur(e.message));
    apiGet("/api/contacts").then((r) => setContacts((r.contacts || []).filter((c) => !c.archived))).catch(() => null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return <p className="muted">Chargement…</p>;
  const nomDe = (c) => c.companyName || [c.firstName, c.lastName].filter(Boolean).join(" ");
  function choisirClient(nom) {
    const c = contacts.find((x) => nomDe(x) === nom);
    setF(c ? { ...f, client: nom, contactId: c.id, telephone: c.phone || f.telephone, email: c.email || f.email, adresse: [c.address, c.postalCode, c.city].filter(Boolean).join(" ") || f.adresse, acces: [c.floor, c.accessCode ? `code ${c.accessCode}` : "", c.accessInstructions].filter(Boolean).join(" · ") || f.acces } : { ...f, client: nom, contactId: "" });
  }
  async function creer() {
    setBusy(true);
    try { const r = await apiSend("/api/interventions/rapide", { action: "creer", ...f }); setCree(r); } catch (e) { setErreur(e.message); }
    setBusy(false);
  }
  if (cree) {
    const i = cree.intervention;
    return (
      <>
        <div className="head"><div className="stack"><span className="eyebrow">{i.reference}</span><h1>Prix à envoyer</h1></div></div>
        <div className="card">
          {cree.message ? (
            <>
              <p className="eq-p2" style={{ marginTop: 0 }}>{cree.envoyeParEmail ? `Envoyé par e-mail à ${i.email}. ` : ""}Envoyez aussi ce message par SMS : {i.client} confirme les prix en un geste, et cette confirmation écrite vaut information préalable sur le prix.</p>
              <div className="ir-msg">{cree.message}</div>
              <div className="ir-acts" style={{ marginTop: 12 }}>
                {i.telephone ? <a className="btn btn-main" href={smsLien(i.telephone, cree.message)}>Envoyer par SMS</a> : null}
                <button type="button" className="btn btn-sec" onClick={() => navigator.clipboard?.writeText(cree.message)}>Copier le message</button>
              </div>
            </>
          ) : <p className="muted">Intervention créée sans envoi de prix.</p>}
        </div>
        <button type="button" className="btn btn-main ir-big" onClick={() => router.push(`/interventions/rapide/${i.id}`)}>Ouvrir l'intervention</button>
      </>
    );
  }
  const exemple = messagePrix({ entreprise: d.entreprise, prix: d.prix });
  return (
    <>
      <div className="head"><div className="stack"><span className="eyebrow">un client vous appelle</span><h1>Nouvelle intervention</h1></div></div>
      <div className="card">
        <div className="ir-2">
          <div className="ir-f"><label htmlFor="ir-cl">Client</label><input id="ir-cl" list="ir-contacts" value={f.client} onChange={(e) => choisirClient(e.target.value)} placeholder="Mme Lefèvre" autoFocus /><datalist id="ir-contacts">{contacts.map((c) => <option key={c.id} value={nomDe(c)} />)}</datalist><small className="sm2">{f.contactId ? "fiche contact existante" : f.client ? "nouvelle fiche contact" : ""}</small></div>
          <div className="ir-f"><label htmlFor="ir-tel">Téléphone</label><input id="ir-tel" type="tel" value={f.telephone} onChange={(e) => setF({ ...f, telephone: e.target.value })} /></div>
          <div className="ir-f"><label htmlFor="ir-ad">Adresse</label><input id="ir-ad" value={f.adresse} onChange={(e) => setF({ ...f, adresse: e.target.value })} /></div>
          <div className="ir-f"><label htmlFor="ir-ac">Accès (étage, code)</label><input id="ir-ac" value={f.acces} onChange={(e) => setF({ ...f, acces: e.target.value })} placeholder="3e gauche · code 4521B" /></div>
        </div>
        <div className="ir-f"><label htmlFor="ir-pb">Le problème</label><textarea id="ir-pb" value={f.probleme} onChange={(e) => setF({ ...f, probleme: e.target.value })} placeholder="Fuite sous l'évier, elle a coupé l'eau" /></div>
        <div className="ir-f"><label htmlFor="ir-em">E-mail (facultatif)</label><input id="ir-em" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <span className="sm2">Urgence</span>
        <div className="ir-seg" style={{ margin: "4px 0 12px" }}>
          <button type="button" className={f.urgence === "maintenant" ? "on" : ""} onClick={() => setF({ ...f, urgence: "maintenant" })}>Oui, ce matin</button>
          <button type="button" className={f.urgence === "planifier" ? "on" : ""} onClick={() => setF({ ...f, urgence: "planifier" })}>Non, à planifier</button>
        </div>
        {f.urgence === "planifier" ? <p className="ir-note">Devis signé au domicile : 14 jours de rétractation et aucun acompte avant 7 jours.</p> : null}
        <label className="sm2" style={{ display: "flex", gap: 8, alignItems: "center", margin: "12px 0 6px" }}><input type="checkbox" checked={f.envoyerPrix} onChange={(e) => setF({ ...f, envoyerPrix: e.target.checked })} /> Envoyer mes prix au client</label>
        {f.envoyerPrix ? (exemple ? <div className="ir-msg">« {exemple} »</div> : <p className="ir-note">Indiquez d'abord vos prix d'intervention sur la page <Link className="link" href="/interventions/rapide">Interventions rapides</Link>.</p>) : null}
      </div>
      <button type="button" className="btn btn-main ir-big" disabled={busy || !f.client.trim() || (f.envoyerPrix && !exemple)} onClick={creer}>{busy ? "Création…" : "Créer et partir"}</button>
    </>
  );
}

function Signature({ onChange }) {
  const ref = useRef(null);
  const dessin = useRef(false);
  const vide = useRef(true);
  useEffect(() => {
    const c = ref.current;
    const r = c.getBoundingClientRect();
    c.width = r.width;
    c.height = r.height;
    const ctx = c.getContext("2d");
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#171B1E";
  }, []);
  const pos = (e) => { const r = ref.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  return (
    <>
      <canvas
        ref={ref}
        className="ir-sig"
        aria-label="Signature du client"
        onPointerDown={(e) => { dessin.current = true; const ctx = ref.current.getContext("2d"); ctx.beginPath(); ctx.moveTo(...pos(e)); ref.current.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { if (!dessin.current) return; const ctx = ref.current.getContext("2d"); ctx.lineTo(...pos(e)); ctx.stroke(); vide.current = false; }}
        onPointerUp={() => { dessin.current = false; if (!vide.current) onChange(ref.current.toDataURL("image/png")); }}
      />
      <button type="button" className="link" style={{ alignSelf: "flex-start" }} onClick={() => { const c = ref.current; c.getContext("2d").clearRect(0, 0, c.width, c.height); vide.current = true; onChange(""); }}>Effacer</button>
    </>
  );
}

function Lignes({ titre, lignes, setLignes }) {
  return (
    <>
      <span className="sm2" style={{ fontWeight: 700 }}>{titre}</span>
      {lignes.map((l, k) => (
        <div key={k} className="ir-l">
          <input aria-label="Ligne" value={l.label} onChange={(e) => setLignes(lignes.map((x, j) => (j === k ? { ...x, label: e.target.value } : x)))} />
          <input aria-label="Montant TTC" className="r" inputMode="decimal" value={l.ttc} onChange={(e) => setLignes(lignes.map((x, j) => (j === k ? { ...x, ttc: e.target.value } : x)))} />
          <button type="button" aria-label="Retirer" onClick={() => setLignes(lignes.filter((_, j) => j !== k))}>×</button>
        </div>
      ))}
      <button type="button" className="link" style={{ alignSelf: "flex-start", marginBottom: 8 }} onClick={() => setLignes([...lignes, { label: "", ttc: "" }])}>Ajouter une ligne</button>
    </>
  );
}

export function Suivi({ id, setErreur, setMessage }) {
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState("");
  const [minutes, setMinutes] = useState("20");
  const [lignes, setLignes] = useState(null);
  const [enPlus, setEnPlus] = useState([]);
  const [pieces, setPieces] = useState("");
  const [signature, setSignature] = useState("");
  const [moyen, setMoyen] = useState("terminal");
  const [email, setEmail] = useState("");
  const fichier = useRef(null);
  const phase = useRef("avant");
  const charger = () => apiGet(`/api/interventions/rapide?id=${encodeURIComponent(id)}`).then((r) => {
    setD(r);
    const dv = r.intervention.devis || {};
    setLignes((x) => x ?? (dv.lignes?.length ? dv.lignes : r.intervention.prix ? [{ label: "Déplacement et 1re demi-heure", ttc: r.intervention.prix.deplacement }] : [{ label: "", ttc: "" }]));
    setEnPlus((x) => (x.length ? x : dv.enPlus || []));
    setPieces((x) => x || dv.pieces || "");
    setEmail((x) => x || r.intervention.email || "");
    // Urgence Koji (PRO-17) : le temps de trajet annoncé au client.
    if (r.intervention.minutesAnnoncees) setMinutes((x) => (x === "20" ? String(r.intervention.minutesAnnoncees) : x));
  }).catch((e) => setErreur(e.message));
  useEffect(() => { charger(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return <p className="muted">Chargement…</p>;
  const i = d.intervention;
  async function agir(corps, ok) {
    setBusy(corps.action);
    try { const r = await apiSend("/api/interventions/rapide", { id, ...corps }); setD({ ...d, intervention: r.intervention }); if (ok) setMessage(ok); } catch (e) { setErreur(e.message); }
    setBusy("");
  }
  async function envoyerPhoto(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy("photo");
    try {
      const form = new FormData();
      form.append("id", id);
      form.append("phase", phase.current);
      form.append("file", f);
      const r = await fetch("/api/interventions/rapide", { method: "POST", body: form, credentials: "same-origin" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Envoi impossible.");
      setD({ ...d, intervention: j.intervention });
    } catch (er) { setErreur(er.message); }
    setBusy("");
  }
  const lignesNet = (ls) => ls.map((l) => ({ label: l.label, ttc: Number(String(l.ttc).replace(",", ".")) || 0 }));
  const etapes = [
    ["acceptee", "Confirmée par le client", i.accepteLe ? `${hh(i.accepteLe)} · prix accepté par écrit` : i.prixEnvoyeLe ? "prix envoyés, en attente" : "prix non envoyés"],
    ["en_route", "En route", i.enRouteLe ? `parti à ${hh(i.enRouteLe)} · arrivée vers ${i.arriveeVers}` : ""],
    ["sur_place", "Sur place", i.arriveLe ? hh(i.arriveLe) : ""],
    ["devis_signe", "Devis avant travaux signé", i.devis?.signeLe ? `${hh(i.devis.signeLe)} · ${euros2(i.total)}` : ""],
    ["terminee", "Terminée et facturée", i.facture ? `${i.facture.numero} · ${i.facture.statut === "Payee" ? "payée" : "à encaisser"}` : ""]
  ];
  const ordre = ["creee", "acceptee", "en_route", "sur_place", "devis_signe", "terminee"];
  const rang = ordre.indexOf(i.etape);
  return (
    <>
      <div className="head">
        <div className="stack"><span className="eyebrow">{i.reference} · {i.urgenceId ? "urgence Koji, prix confirmé par le client" : i.urgence === "maintenant" ? "urgence" : "à planifier"}</span><h1>{i.client}</h1><span className="muted">{i.probleme}</span></div>
      </div>
      <div className="card">
        <b>{i.site}</b>
        {i.acces ? <p className="sm2" style={{ margin: "2px 0 0" }}>{i.acces}</p> : null}
        <div className="ir-acts" style={{ marginTop: 12 }}>
          {i.telephone ? <a className="btn btn-sec" href={telLien(i.telephone)}>Appeler</a> : null}
          {i.telephone ? <a className="btn btn-sec" href={smsLien(i.telephone, "")}>Message</a> : null}
          {i.site ? <a className="btn btn-sec" href={i.itineraire} target="_blank" rel="noreferrer">Itinéraire</a> : null}
        </div>
      </div>
      <div className="card ir-et">
        {etapes.map(([cle, label, detail], k) => (
          <div key={cle} className={ordre.indexOf(cle) <= rang ? "ok" : ordre.indexOf(cle) === rang + 1 ? "on" : ""}>
            <i>{ordre.indexOf(cle) <= rang ? "✓" : k + 1}</i>
            <span><strong>{label}</strong>{detail ? <small>{detail}</small> : null}</span>
          </div>
        ))}
      </div>
      {i.etape === "annulee" ? <p className="ir-note">Intervention annulée.</p> : null}
      {!i.prixEnvoyeLe || i.accepteLe || i.etape === "annulee" ? null : (
        <div className="card">
          <p className="sm2" style={{ marginTop: 0 }}>Lien de confirmation des prix pour le client :</p>
          <div className="ir-msg">{i.lienClient}</div>
          <div className="ir-acts" style={{ marginTop: 10 }}>{i.telephone ? <a className="btn btn-sec" href={smsLien(i.telephone, messagePrix({ entreprise: d.entreprise, prix: i.prix || {}, lien: i.lienClient }))}>Renvoyer par SMS</a> : null}</div>
        </div>
      )}
      {["creee", "acceptee"].includes(i.etape) ? (
        <div className="card">
          <div className="ir-f"><label htmlFor="ir-min">Temps de trajet (minutes)</label><input id="ir-min" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} /></div>
          <button type="button" className="btn btn-main ir-big" disabled={busy === "en-route"} onClick={() => agir({ action: "en-route", minutes: Number(minutes) || 20 })}>Je pars</button>
        </div>
      ) : null}
      {i.etape === "en_route" ? <button type="button" className="btn btn-main ir-big" disabled={busy === "arrive"} onClick={() => agir({ action: "arrive" })}>Je suis arrivé</button> : null}
      {i.etape === "sur_place" && lignes ? (
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-h"><h2>Devis avant travaux</h2></div>
          <Lignes titre={i.urgence === "maintenant" ? "Urgence · le strict nécessaire" : "Travaux"} lignes={lignes} setLignes={setLignes} />
          <div className="ir-tot"><span>Total TTC</span><span>{euros2(totalLignes(lignesNet(lignes)))}</span></div>
          <p className="ir-note">{i.mention}</p>
          <Lignes titre="Proposé en plus · devis séparé" lignes={enPlus} setLignes={setEnPlus} />
          {enPlus.length ? <p className="ir-note">{i.mentionEnPlus}</p> : null}
          <span className="sm2" style={{ marginTop: 8 }}>Pièces remplacées</span>
          <div className="ir-seg" style={{ margin: "4px 0 12px" }}>
            {Object.entries(d.pieces).map(([k, l]) => <button key={k} type="button" className={pieces === k ? "on" : ""} onClick={() => setPieces(k)}>{l}</button>)}
          </div>
          <span className="sm2">Signature de {i.client}</span>
          <Signature onChange={setSignature} />
          <button type="button" className="btn btn-main ir-big" style={{ marginTop: 12 }} disabled={busy === "signer" || !signature} onClick={() => agir({ action: "signer", lignes: lignesNet(lignes), enPlus: lignesNet(enPlus), pieces, signature, signataire: i.client }, "Devis signé.")}>Faire signer le client</button>
        </div>
      ) : null}
      {["devis_signe", "terminee"].includes(i.etape) ? (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="card-h"><h2>{i.etape === "terminee" ? "Terminée" : "Terminer"}</h2></div>
          <input ref={fichier} type="file" accept="image/*" capture="environment" hidden onChange={envoyerPhoto} />
          <div className="ir-ph">{i.photos.map((p) => <figure key={p.id}><img src={p.url} alt="" /><figcaption>{hh(p.takenAt)} · {p.phase === "avant" ? "Avant" : "Après"}</figcaption></figure>)}</div>
          <div className="ir-acts">
            <button type="button" className="btn btn-sec" disabled={busy === "photo"} onClick={() => { phase.current = "avant"; fichier.current?.click(); }}>Photo avant</button>
            <button type="button" className="btn btn-sec" disabled={busy === "photo"} onClick={() => { phase.current = "apres"; fichier.current?.click(); }}>Photo après</button>
          </div>
          {i.facture ? (
            <>
              <p className="eq-p2" style={{ margin: 0 }}>Facture <b>{i.facture.numero}</b> · {euros2(i.facture.montant)} · {i.facture.statut === "Payee" ? `payée (${d.moyens[i.paiement?.moyen] || ""})` : "à encaisser"}{i.facture.envoyeeLe ? " · envoyée" : ""}</p>
              <a className="link" href={`/api/invoices/pdf?id=${i.facture.id}`} target="_blank" rel="noreferrer" style={{ alignSelf: "flex-start" }}>Voir la facture (PDF)</a>
              <div className="ir-f"><label htmlFor="ir-mail">E-mail du client</label><input id="ir-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <button type="button" className="btn btn-main" disabled={busy === "envoyer-facture" || !email} onClick={() => agir({ action: "envoyer-facture", to: email }, "Facture envoyée.")}>{i.facture.envoyeeLe ? "Renvoyer la facture" : "Envoyer la facture"}</button>
            </>
          ) : (
            <>
              <span className="sm2">Payé par</span>
              <div className="ir-seg">{[...Object.entries(d.moyens), ["", "Pas encore"]].map(([k, l]) => <button key={k || "non"} type="button" className={moyen === k ? "on" : ""} onClick={() => setMoyen(k)}>{l}</button>)}</div>
              <p className="sm2" style={{ margin: 0 }}>Paiement dans Koji : prévu dans une version suivante.</p>
              <button type="button" className="btn btn-main ir-big" disabled={busy === "terminer"} onClick={() => agir({ action: "terminer", moyen }, "Facture créée.")}>{moyen ? "Encaissé, créer la facture" : "Créer la facture"}</button>
            </>
          )}
          {i.totalEnPlus ? (
            <div className="ir-note">Proposé en plus : {i.devis.enPlus.map((l) => l.label).join(", ")} · {euros2(i.totalEnPlus)}. {i.devisSepareId ? <Link className="link" href={`/devis?id=${i.devisSepareId}`}>Ouvrir le devis séparé</Link> : <Link className="link" href={`/devis?new=1&intervention=${i.id}`}>Préparer le devis séparé</Link>}</div>
          ) : null}
        </div>
      ) : null}
      {!i.invoiceId && i.etape !== "annulee" ? <button type="button" className="link" style={{ alignSelf: "flex-start" }} onClick={() => { if (window.confirm("Annuler cette intervention ?")) agir({ action: "annuler" }); }}>Annuler l'intervention</button> : null}
    </>
  );
}
