"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Shell } from "../../components/Shell";
import { apiGet, apiSend } from "../../lib/client-api";
import { fichierPourEnvoi } from "../../lib/fichier-client";
import { DepensesTabs, SOURCE, euro, jourCourt } from "./DepensesTabs";
import "../fournitures/fournitures.css";
import "./depenses.css";

// Dépenses : pièces à ranger (maquette PRO-09). Photo d'un ticket ou
// facture PDF lue par Koji, chantier proposé (articles prévus au devis,
// numéro de bon de commande), doublons signalés, « Ranger les N sûres ».
// Commandes Koji rangées d'office. Rien n'est rangé sans un clic.
const VIDE = { fournisseur: "", date: new Date().toISOString().slice(0, 10), numero: "", ht: "", tva: "", categorie: "Fournitures", type: "ticket" };
const nb = (v) => Number(String(v ?? "").replace(",", ".")) || 0;

function Panneau({ piece, data, onFermer, onFait, setErreur }) {
  const manuel = !piece;
  const prop = piece?.proposition || null;
  const [f, setF] = useState(() => (piece ? { fournisseur: piece.fournisseur, date: piece.date, numero: piece.numero, ht: String(piece.ht).replace(".", ","), tva: String(piece.tva).replace(".", ","), categorie: piece.categorie, type: piece.type } : VIDE));
  const [dest, setDest] = useState(() => (prop?.fraisGeneraux ? "fg" : prop?.projectId || ""));
  const [lot, setLot] = useState(prop?.lot || "");
  const [busy, setBusy] = useState(false);
  const chantier = data.chantiers.find((c) => c.projectId === dest);
  const ttc = Math.round((nb(f.ht) + nb(f.tva)) * 100) / 100;
  const choix = [
    ...(prop && !prop.fraisGeneraux ? [{ id: prop.projectId, titre: prop.title, detail: prop.raison }] : []),
    ...(prop?.autres || []).map((a) => ({ id: a.projectId, titre: a.title, detail: a.raison })),
    { id: "fg", titre: "Frais généraux", detail: prop?.fraisGeneraux ? prop.raison : "carburant, assurance, outillage : aucun chantier" }
  ];
  const autres = data.chantiers.filter((c) => !choix.some((x) => x.id === c.projectId));
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function ranger() {
    if (!dest) { setErreur("Choisissez le chantier, ou « Frais généraux »."); return; }
    setBusy(true);
    try {
      const cible = dest === "fg" ? { fraisGeneraux: true } : { projectId: dest, lot };
      if (manuel) {
        await apiSend("/api/depenses", { manuel: { ...f, ...cible } });
        onFait("Pièce enregistrée.");
      } else {
        const change = ["fournisseur", "date", "numero", "categorie"].some((k) => String(f[k] ?? "") !== String(piece[k] ?? "")) || nb(f.ht) !== piece.ht || nb(f.tva) !== piece.tva;
        if (change) await apiSend("/api/depenses", { action: "modifier", id: piece.id, ...f, ht: nb(f.ht), tva: nb(f.tva) }, "PATCH");
        await apiSend("/api/depenses", { action: "ranger", id: piece.id, categorie: f.categorie, ...cible }, "PATCH");
        onFait(`Rangée dans ${dest === "fg" ? "Frais généraux" : chantier?.title}.`);
      }
    } catch (e) { setErreur(e.message); setBusy(false); }
  }

  async function action(a, msg) {
    setBusy(true);
    try { await apiSend("/api/depenses", { action: a, id: piece.id }, "PATCH"); onFait(msg); } catch (e) { setErreur(e.message); setBusy(false); }
  }

  const doublon = piece?.doublonDe ? data.toutes.find((x) => x.id === piece.doublonDe) : null;
  return (
    <aside className="dp-pan" aria-label="Pièce">
      <div className="dp-ph">
        <div>
          <span className="eyebrow">{manuel ? "Saisie à la main" : `${SOURCE[piece.source] || "pièce"} · ${jourCourt(piece.date)}`}</span>
          <h2>{manuel ? "Nouvelle pièce" : `${piece.fournisseur || "Pièce"} · ${euro(piece.ttc)} TTC`}</h2>
        </div>
        <button type="button" className="link" onClick={onFermer}>Fermer</button>
      </div>
      {piece?.fichier ? (piece.fichier.type === "application/pdf"
        ? <iframe className="dp-vue pdf" title="Facture" src={`/api/depenses?fichier=${piece.id}`} />
        : <a href={`/api/depenses?fichier=${piece.id}`} target="_blank" rel="noreferrer"><img className="dp-vue" alt={`Pièce ${piece.fournisseur}`} src={`/api/depenses?fichier=${piece.id}`} /></a>) : null}
      {piece?.illisible ? <p className="err" role="alert">Pièce difficile à lire : vérifiez les montants.</p> : null}
      {piece?.lignes?.length ? (
        <div className="dp-lignes">{piece.lignes.slice(0, 12).map((l, i) => <div key={i}><span>{l.designation}</span><span>{l.quantite ?? ""}</span><span>{l.montantHt != null ? euro(l.montantHt) : ""}</span></div>)}</div>
      ) : null}
      {doublon ? (
        <div className="dp-al"><div><strong>Doublon possible</strong><small>{doublon.fournisseur} du {jourCourt(doublon.date)}, même montant{doublon.statut === "rangee" ? ", déjà rangée" : ""}.</small></div>
          <button type="button" className="link" disabled={busy} onClick={() => action("garder", "Les deux pièces sont gardées.")}>Garder les deux</button>
        </div>
      ) : null}
      <div className="dp-ex">
        <span className="lab">{manuel ? "La pièce" : "Lu par Koji"}</span>
        <div className="dp-f"><label htmlFor="dp-fo">Fournisseur</label><input id="dp-fo" value={f.fournisseur} onChange={set("fournisseur")} /></div>
        <div className="dp-f2">
          <div className="dp-f"><label htmlFor="dp-da">Date</label><input id="dp-da" type="date" value={f.date} onChange={set("date")} /></div>
          <div className="dp-f"><label htmlFor="dp-nu">N° de facture</label><input id="dp-nu" value={f.numero} onChange={set("numero")} /></div>
        </div>
        <div className="dp-f3">
          <div className="dp-f"><label htmlFor="dp-ht">HT</label><input id="dp-ht" inputMode="decimal" value={f.ht} onChange={set("ht")} /></div>
          <div className="dp-f"><label htmlFor="dp-tv">{piece?.autoliquidation ? "TVA · autoliquidée" : `TVA${piece?.tauxTva ? ` ${String(piece.tauxTva).replace(".", ",")} %` : ""}`}</label><input id="dp-tv" inputMode="decimal" value={f.tva} onChange={set("tva")} /></div>
          <div className="dp-f"><label>TTC</label><input value={euro(ttc)} readOnly tabIndex={-1} /></div>
        </div>
        <div className="dp-f2">
          <div className="dp-f"><label htmlFor="dp-ca">Catégorie</label><select id="dp-ca" value={f.categorie} onChange={set("categorie")}>{data.categories.map((c) => <option key={c}>{c}</option>)}</select></div>
          {manuel ? <div className="dp-f"><label htmlFor="dp-ty">Pièce</label><select id="dp-ty" value={f.type} onChange={set("type")}><option value="ticket">Ticket</option><option value="facture">Facture</option></select></div> : null}
        </div>
      </div>
      <div className="dp-sug">
        <span className="lab">Ranger dans</span>
        {choix.map((c, i) => (
          <button type="button" key={c.id} className={`dp-so${dest === c.id ? " on" : ""}`} onClick={() => { setDest(c.id); if (c.id !== prop?.projectId) setLot(""); else setLot(prop?.lot || ""); }}>
            <span><strong>{c.titre}{i === 0 && prop && !manuel ? " · proposé par Koji" : ""}</strong><small>{c.detail}</small></span>
          </button>
        ))}
        {autres.length ? (
          <div className="dp-f"><label htmlFor="dp-ch">Autre chantier</label>
            <select id="dp-ch" value={autres.some((c) => c.projectId === dest) ? dest : ""} onChange={(e) => { setDest(e.target.value); setLot(""); }}>
              <option value="">Choisir…</option>{autres.map((c) => <option key={c.projectId} value={c.projectId}>{c.title}</option>)}
            </select>
          </div>
        ) : null}
        {chantier?.lots?.length ? (
          <div className="dp-f"><label htmlFor="dp-lo">Lot · pour le coût par lot</label>
            <select id="dp-lo" value={lot} onChange={(e) => setLot(e.target.value)}><option value="">Sans lot</option>{chantier.lots.map((l) => <option key={l}>{l}</option>)}</select>
          </div>
        ) : null}
      </div>
      <div className="dp-pf">
        {!manuel ? <button type="button" className="link" disabled={busy} onClick={() => action("supprimer", "Pièce supprimée.")}>Supprimer</button> : <span />}
        <button type="button" className="btn btn-main" disabled={busy || !dest || (manuel && !(nb(f.ht) > 0))} onClick={ranger}>{busy ? "…" : manuel ? "Enregistrer" : "Ranger"}</button>
      </div>
    </aside>
  );
}

export default function Depenses() {
  const [data, setData] = useState(null);
  const [toutes, setToutes] = useState([]);
  const [sel, setSel] = useState("");
  const [depot, setDepot] = useState("");
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");
  const [email, setEmail] = useState("");

  async function charger(selection) {
    const d = await apiGet("/api/depenses");
    setData(d);
    setToutes([...d.aRanger, ...d.recues]);
    if (selection !== undefined) setSel(selection);
    return d;
  }
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("piece") || "";
    charger(id).catch((e) => setErreur(e.message));
  }, []);

  async function deposer(event) {
    const files = [...(event.target.files || [])].slice(0, 10);
    event.target.value = "";
    setErreur("");
    let dernier = "";
    for (const [i, file] of files.entries()) {
      setDepot(`Koji lit ${file.name} (${i + 1}/${files.length})…`);
      try {
        const r = await apiSend("/api/depenses", { nom: file.name, data: await fichierPourEnvoi(file) });
        dernier = r.pieceId;
        setData(r);
        setToutes([...r.aRanger, ...r.recues]);
      } catch (e) { setErreur(e.message); }
    }
    setDepot("");
    if (dernier) setSel(dernier);
  }

  async function rapide(p) {
    setErreur("");
    try {
      const prop = p.proposition;
      const r = await apiSend("/api/depenses", { action: "ranger", id: p.id, ...(prop.fraisGeneraux ? { fraisGeneraux: true } : { projectId: prop.projectId, lot: prop.lot }) }, "PATCH");
      setData(r); setToutes([...r.aRanger, ...r.recues]);
      setMessage(`${p.fournisseur} rangée dans ${prop.fraisGeneraux ? "Frais généraux" : prop.title}.`);
      if (sel === p.id) setSel("");
    } catch (e) { setErreur(e.message); }
  }

  async function reglages(corps, ok) {
    setErreur("");
    try { const r = await apiSend("/api/depenses", { action: "reglages", ...corps }, "PATCH"); setData(r); setMessage(ok); } catch (e) { setErreur(e.message); }
  }

  const piece = useMemo(() => toutes.find((p) => p.id === sel) || null, [toutes, sel]);
  const r = data?.reglages || {};

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack"><span className="eyebrow">Vos factures et tickets, rangés par chantier</span><h1>Dépenses</h1></div>
        <div className="hact">
          <button type="button" className="btn btn-sec" onClick={() => setSel("manuel")}>Saisir à la main</button>
          <label className="btn btn-sec">{depot ? "Lecture…" : "Photo d'un ticket"}<input type="file" accept="image/*,application/pdf" multiple hidden disabled={Boolean(depot)} onChange={deposer} /></label>
        </div>
      </div>
      <DepensesTabs current="ranger" counts={{ ranger: data?.aRanger.length, recues: data?.recues.length }} />
      <div className="dp-in" aria-label="Comment les pièces arrivent">
        <span>Photo d'un ticket</span><span>Facture PDF déposée</span><span>Commandes Koji rangées d'office</span>
        <span className="off" title="Pas encore disponible">Transfert par e-mail : bientôt</span>
        <span className="off" title="Plateforme agréée à choisir">Factures électroniques : plateforme à choisir</span>
      </div>
      {depot ? <p className="notice" role="status">{depot}</p> : null}
      {message ? <p className="notice" role="status">{message}</p> : null}
      {erreur ? <p className="err" role="alert">{erreur}</p> : null}
      {!data ? <p className="muted">Chargement…</p> : (
        <div className="dp-split">
          <div className="dp-lc">
            <section className="card">
              <div className="card-h"><h2>À ranger</h2>{data.sures ? <button type="button" className="btn btn-main" onClick={async () => { try { const r2 = await apiSend("/api/depenses", { action: "rangerSures" }, "PATCH"); setData(r2); setToutes([...r2.aRanger, ...r2.recues]); setMessage(`${data.sures} pièce${data.sures > 1 ? "s" : ""} rangée${data.sures > 1 ? "s" : ""}.`); } catch (e) { setErreur(e.message); } }}>Ranger les {data.sures > 1 ? `${data.sures} sûres` : "1 sûre"}</button> : null}</div>
              {data.aRanger.length === 0 ? <div className="empty">Rien à ranger. Prenez en photo un ticket ou déposez une facture PDF : Koji la lit et propose le chantier.</div> : data.aRanger.map((p) => {
                const prop = p.proposition;
                const d = p.doublonDe ? toutes.find((x) => x.id === p.doublonDe) : null;
                return (
                  <div key={p.id} className={`dp-rg${sel === p.id ? " on" : ""}${p.doublonDe ? " dup" : ""}`} onClick={() => setSel(p.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") setSel(p.id); }}>
                    <div className="a"><strong>{p.fournisseur || "Pièce"}</strong><small>{jourCourt(p.date)} · {SOURCE[p.source] || p.source}</small></div>
                    <b className="mt">{euro(p.ttc)}</b>
                    <div className="c">
                      <span className="lab">{p.doublonDe ? "Attention" : prop ? "Koji propose" : "À choisir"}</span>
                      <strong>{prop?.fraisGeneraux ? "Frais généraux" : prop?.title || "Aucun chantier évident"}</strong>
                      <small>{p.doublonDe ? `doublon possible avec celle du ${jourCourt(d?.date)}` : prop?.raison || p.lignes?.[0]?.designation || p.categorie}</small>
                    </div>
                    {p.doublonDe || !prop ? <button type="button" className="link" onClick={(e) => { e.stopPropagation(); setSel(p.id); }}>{p.doublonDe ? "Vérifier" : "Choisir"}</button>
                      : <button type="button" className="btn btn-sec" onClick={(e) => { e.stopPropagation(); rapide(p); }}>Ranger</button>}
                  </div>
                );
              })}
              <div className="dp-done">Déjà rangées ce mois : {data.rangeesMois.nombre} pièce{data.rangeesMois.nombre > 1 ? "s" : ""} · {euro(data.rangeesMois.ht)} HT · <Link className="link" href="/depenses/chantiers">Voir le coût des chantiers</Link></div>
            </section>
            <section className="card" style={{ padding: "4px 20px" }}>
              <button type="button" className={`dp-tg${r.envoiAuto ? " on" : ""}`} aria-pressed={Boolean(r.envoiAuto)} disabled={!data.business || !r.comptableEmail} onClick={() => reglages({ envoiAuto: !r.envoiAuto }, r.envoiAuto ? "Envoi automatique arrêté." : "Envoi automatique activé, le 5 de chaque mois.")}>
                <span>Envoyer chaque mois mes pièces rangées à mon comptable<small>{!data.business ? "offre Business · " : ""}le 5 du mois · {r.comptableEmail || "adresse à indiquer"} · journaux, relevé par chantier et justificatifs</small></span><i><b /></i>
              </button>
              {data.business && !r.comptableEmail ? (
                <form className="dp-f2" style={{ paddingBottom: 12 }} onSubmit={(e) => { e.preventDefault(); reglages({ comptableEmail: email }, "Adresse du comptable enregistrée."); }}>
                  <div className="dp-f"><label htmlFor="dp-cpt">E-mail du comptable</label><input id="dp-cpt" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                  <button type="submit" className="btn btn-sec" style={{ alignSelf: "end" }} disabled={!email}>Enregistrer</button>
                </form>
              ) : null}
              {!data.business ? <p className="fx-note" style={{ paddingBottom: 12 }}>L'envoi au comptable fait partie de l'offre Business. <Link className="link" href="/parametres/abonnement">Voir les offres</Link></p> : null}
            </section>
          </div>
          {sel ? <Panneau key={sel} piece={sel === "manuel" ? null : piece} data={{ ...data, toutes }} setErreur={setErreur} onFermer={() => setSel("")} onFait={async (m) => { setMessage(m); setSel(""); await charger(); }} /> : (
            <aside className="dp-pan"><span className="eyebrow">Une pièce</span><p className="fx-note" style={{ margin: 0 }}>Touchez une pièce pour la voir, corriger ce que Koji a lu et choisir son chantier. Koji compare les articles aux fournitures prévues dans vos devis et aux numéros de vos bons de commande.</p></aside>
          )}
        </div>
      )}
    </Shell>
  );
}
