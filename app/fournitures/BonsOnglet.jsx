"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiSend } from "../../lib/client-api";
import { ETATS_BON, totalLigne } from "../../lib/fournitures-bons";
import { nombre } from "../../lib/fournitures-pro";
import { aujourdhui, euro, jour, jourLong, nb, qte } from "./commun";

// Onglet Bons de commande (maquette PRO-07.6) : liste, un bon (envoi,
// PDF, duplication, reste, pointage de livraison, facture reçue).
const TON = { brouillon: "off", envoye: "wait", partiel: "wait", livre: "ok", annule: "off" };
const qteLigne = (l) => (l.paquets > 0 && l.contenance && l.contenance !== 1 ? `${l.paquets} ${l.uniteCond}${l.paquets > 1 && !/s$/.test(l.uniteCond || "") ? "s" : ""} · ${qte(l.quantite, l.unit)}` : qte(l.quantite, l.unit));
const heure = (iso) => (iso ? new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(new Date(iso)).replace(":", " h ") : "");

function Envoi({ bon, onClose, onDone }) {
  const [to, setTo] = useState(bon.supplierEmail || "");
  const [canal, setCanal] = useState(bon.supplierEmail ? "email" : "manuel");
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState("");
  async function envoyer() {
    setBusy(true);
    setErreur("");
    try {
      const { bon: maj } = await apiSend("/api/fournitures/bons", { id: bon.id, action: "envoyer", canal, to, confirme: true }, "PATCH");
      onDone(maj, canal === "email" ? `Bon ${maj.numeroKoji || maj.numero} envoyé à ${to}.` : `Bon ${maj.numero} noté comme passé.`);
    } catch (e) { setErreur(e.message); setBusy(false); }
  }
  return (
    <>
      <div className="env-scrim" onClick={busy ? undefined : onClose} />
      <section className="env-panel" role="dialog" aria-modal="true" aria-label="Envoyer le bon">
        <div className="env-h"><h2>Envoyer le bon · {bon.numero}</h2><button type="button" className="link" onClick={onClose}>Fermer</button></div>
        <div className="kp-seg" role="group" aria-label="Canal">
          <button type="button" className={canal === "email" ? "on" : ""} aria-pressed={canal === "email"} onClick={() => setCanal("email")}>Par e-mail, PDF joint</button>
          <button type="button" className={canal === "manuel" ? "on" : ""} aria-pressed={canal === "manuel"} onClick={() => setCanal("manuel")}>Déjà passée (comptoir, téléphone)</button>
        </div>
        {canal === "email" ? <label className="ed">E-mail du fournisseur<input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="commandes@fournisseur.fr" /></label> : null}
        <div className="fx-sum"><span>{bon.supplierName}{bon.livraisonLe ? ` · livraison ${jourLong(bon.livraisonLe)}` : ""}</span><b>{bon.lignes.length} ligne{bon.lignes.length > 1 ? "s" : ""}</b></div>
        <p className="notice" role="note"><b>Vous commandez pour {euro(bon.totaux.ht)} HT.</b> Un bon de commande engage l'entreprise ; les conditions de vente du fournisseur s'appliquent.</p>
        {erreur ? <p className="err" role="alert">{erreur}</p> : null}
        <div className="env-act">
          <button type="button" className="btn btn-sec" onClick={onClose} disabled={busy}>Annuler</button>
          <button type="button" className="btn btn-main" onClick={envoyer} disabled={busy || (canal === "email" && !to.trim())}>{busy ? "Envoi…" : canal === "email" ? "Envoyer le bon" : "Noter comme passée"}</button>
        </div>
      </section>
    </>
  );
}

function Pointer({ bon, onClose, onDone }) {
  const [livre, setLivre] = useState(() => Object.fromEntries(bon.lignes.map((l) => [l.id, String(l.livre || 0)])));
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState("");
  async function valider() {
    setBusy(true);
    try {
      const { bon: maj } = await apiSend("/api/fournitures/bons", { id: bon.id, action: "pointer", lignes: bon.lignes.map((l) => ({ id: l.id, livre: nombre(livre[l.id]) })) }, "PATCH");
      onDone(maj, `Livraison pointée : ${ETATS_BON[maj.etat].toLowerCase()}.`);
    } catch (e) { setErreur(e.message); setBusy(false); }
  }
  return (
    <>
      <div className="env-scrim" onClick={busy ? undefined : onClose} />
      <section className="env-panel" role="dialog" aria-modal="true" aria-label="Pointer une livraison">
        <div className="env-h"><h2>Pointer une livraison · {bon.numero}</h2><button type="button" className="link" onClick={onClose}>Fermer</button></div>
        <p className="fx-note">Quantités reçues au total. Pour lire le bon de livraison en photo et préparer une réclamation : <Link className="link" href={`/fournitures/livraison?bon=${bon.id}`}>Réception avec photo</Link>.</p>
        {bon.lignes.map((l) => (
          <div className="fx-row" key={l.id}>
            <span className="t"><b>{l.name}</b><small>commandé {qte(l.quantite, l.unit)}</small></span>
            <span style={{ display: "flex", gap: 6 }}>
              <button type="button" className="link" onClick={() => setLivre((x) => ({ ...x, [l.id]: String(l.quantite) }))}>tout</button>
              <input type="number" min="0" max={l.quantite} step="0.01" value={livre[l.id]} onChange={(e) => setLivre((x) => ({ ...x, [l.id]: e.target.value }))} aria-label={`Reçu pour ${l.name}`} style={{ width: 90, height: 34, padding: "0 8px", border: "1px solid var(--btn)", borderRadius: 2, font: "inherit", textAlign: "right" }} />
            </span>
          </div>
        ))}
        {erreur ? <p className="err" role="alert">{erreur}</p> : null}
        <div className="env-act">
          <button type="button" className="btn btn-sec" onClick={onClose} disabled={busy}>Annuler</button>
          <button type="button" className="btn btn-main" onClick={valider} disabled={busy}>{busy ? "…" : "Enregistrer la livraison"}</button>
        </div>
      </section>
    </>
  );
}

function Facture({ bon, onClose, onDone }) {
  const [numero, setNumero] = useState("");
  const [montant, setMontant] = useState("");
  const [date, setDate] = useState(aujourdhui());
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState("");
  async function valider() {
    setBusy(true);
    try {
      const { bon: maj } = await apiSend("/api/fournitures/bons", { id: bon.id, action: "facture", numero, montantHt: nombre(montant), date }, "PATCH");
      onDone(maj, Math.abs(maj.facture.ecartHt) >= 0.01 ? `Facture rapprochée : écart de ${euro(maj.facture.ecartHt)} à vérifier.` : "Facture rapprochée : conforme au bon.");
    } catch (e) { setErreur(e.message); setBusy(false); }
  }
  return (
    <>
      <div className="env-scrim" onClick={busy ? undefined : onClose} />
      <section className="env-panel" role="dialog" aria-modal="true" aria-label="Facture reçue">
        <div className="env-h"><h2>Facture reçue · {bon.numero}</h2><button type="button" className="link" onClick={onClose}>Fermer</button></div>
        <div className="fx-grid2">
          <label className="ed">Numéro de facture<input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="LP-88412" /></label>
          <label className="ed">Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="ed">Montant HT<input type="number" min="0" step="0.01" value={montant} onChange={(e) => setMontant(e.target.value)} /></label>
          <div className="ed">Bon<div className="selv">{euro(bon.totaux.ht)} HT</div></div>
        </div>
        {nombre(montant) > 0 ? <div className="fx-sum"><span>Écart avec le bon</span><b>{euro(nombre(montant) - bon.totaux.ht)}</b></div> : null}
        {erreur ? <p className="err" role="alert">{erreur}</p> : null}
        <div className="env-act">
          <button type="button" className="btn btn-sec" onClick={onClose} disabled={busy}>Annuler</button>
          <button type="button" className="btn btn-main" onClick={valider} disabled={busy || !(nombre(montant) > 0)}>{busy ? "…" : "Rapprocher"}</button>
        </div>
      </section>
    </>
  );
}

function DetailBon({ bon, onBack, onChange, setMessage }) {
  const [panneau, setPanneau] = useState("");
  const [busy, setBusy] = useState("");
  const reste = bon.lignes.filter((l) => (l.livre || 0) < l.quantite - 1e-9);
  const derniere = bon.livraisons?.[0];

  async function action(nom) {
    setBusy(nom);
    try {
      const r = await apiSend("/api/fournitures/bons", { id: bon.id, action: nom }, "PATCH");
      if (nom === "annuler") { setMessage(r.supprime ? `Brouillon ${bon.numero} supprimé.` : `Bon ${bon.numero} annulé.`); onChange(r.bon, r.supprime ? bon.id : ""); if (r.supprime) onBack(); }
      else { onChange(r.origine, ""); onChange(r.bon, ""); setMessage(nom === "reste" ? `Reste du bon ${bon.numero} : brouillon ${r.bon.numero} créé.` : `Copie ${r.bon.numero} créée en brouillon.`); }
    } catch (e) { setMessage(e.message); }
    setBusy("");
  }
  const fini = (maj, msg) => { setPanneau(""); onChange(maj, ""); setMessage(msg); };

  return (
    <>
      <div className="head" style={{ marginTop: 0 }}>
        <div className="stack">
          <span className="eyebrow"><button type="button" className="link" onClick={onBack}>Bons de commande</button></span>
          <h2 style={{ margin: 0 }}>{bon.numero} · {bon.supplierName}</h2>
        </div>
        <div className="hact">
          <a className="btn btn-sec" href={`/api/fournitures/bons/pdf?id=${bon.id}`} target="_blank" rel="noreferrer">PDF</a>
          <button type="button" className="btn btn-sec" disabled={Boolean(busy)} onClick={() => action("dupliquer")}>Dupliquer</button>
          {bon.etat === "partiel" && !bon.resteRenvoye ? <button type="button" className="btn btn-sec" disabled={Boolean(busy)} onClick={() => action("reste")}>Renvoyer le reste</button> : null}
          {bon.etat === "brouillon" ? <button type="button" className="btn btn-main" onClick={() => setPanneau("envoi")}>Envoyer le bon</button> : null}
        </div>
      </div>
      <div className="fp-layout">
        <div className="fx-bc">
          <div className="fx-bc-h">
            <div><div className="sm">Bon de commande</div><h3 style={{ margin: "2px 0" }}>{bon.numeroKoji || bon.numero}</h3>
              <div className="fx-note">{bon.supplierName}{bon.envoyeLe ? ` · envoyé le ${jour(bon.envoyeLe)} ${heure(bon.envoyeLe)}${bon.envoyeA ? ` · par e-mail à ${bon.envoyeA}` : " · passé hors e-mail"}` : " · brouillon, pas encore envoyé"}</div>
            </div>
            <span className={`fx-etat ${TON[bon.etat]}`}>{ETATS_BON[bon.etat]}</span>
          </div>
          <div className="fx-grid3">
            <div><div className="sm">Chantier</div><b>{bon.projectTitle || "—"}{bon.lot ? ` · ${bon.lot}` : ""}</b></div>
            <div><div className="sm">Livraison</div><b>{bon.livraisonAdresse ? "sur chantier" : "—"}</b><div className="fx-note">{[bon.livraisonAdresse, bon.livraisonLe ? `${jourLong(bon.livraisonLe)}${bon.livraisonHeure ? ` avant ${bon.livraisonHeure}` : ""}` : ""].filter(Boolean).join(" · ")}</div></div>
            <div><div className="sm">Référence client</div><b>{bon.compteFournisseur ? `compte ${bon.compteFournisseur}` : "—"}</b>{bon.codePartenaire ? <div className="fx-note">code partenaire {bon.codePartenaire}</div> : null}</div>
          </div>
          <div className="tbl">
            <table>
              <thead><tr><th>Désignation</th><th className="r">Qté</th><th className="r">PU HT</th><th className="r">Total HT</th><th>Livré</th></tr></thead>
              <tbody>
                {bon.lignes.map((l) => (
                  <tr key={l.id}>
                    <td><div className="n2">{l.name}</div>{l.ref ? <div className="sm">réf. {l.ref}</div> : null}</td>
                    <td className="r">{qteLigne(l)}</td>
                    <td className="r">{euro(l.prixHt)}</td>
                    <td className="r b">{euro(totalLigne(l))}</td>
                    <td>{bon.etat === "brouillon" ? "—" : (l.livre || 0) >= l.quantite - 1e-9 ? "oui" : (l.livre || 0) > 0 ? `${nb(l.livre)} / ${nb(l.quantite)}` : "reste"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ac-amt">
            <div><span>Total HT</span><b>{euro(bon.totaux.ht)}</b></div>
            <div><span>TVA 20 %</span><b>{euro(bon.totaux.tva)}</b></div>
            <div><span>Total TTC</span><b>{euro(bon.totaux.ttc)}</b></div>
          </div>
        </div>
        <aside className="ob-detail">
          <div className="ob-sec">
            <div className="lab">Livraison</div>
            {derniere ? <div className="kv"><span>Livré le {jour(derniere.date)}</span><b>{bon.lignes.length - reste.length} ligne{bon.lignes.length - reste.length > 1 ? "s" : ""} sur {bon.lignes.length}</b></div> : <p className="fx-note">{bon.etat === "brouillon" ? "Le bon n'est pas encore envoyé." : "Rien de reçu pour l'instant."}</p>}
            {reste.length && bon.etat !== "brouillon" ? <div className="kv"><span>Reste à livrer</span><b>{reste.length} ligne{reste.length > 1 ? "s" : ""}{bon.resteRenvoye ? ` · relancé (${bon.resteRenvoye})` : ""}</b></div> : null}
            {bon.etat !== "brouillon" && bon.etat !== "annule" ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Link className="btn btn-sec" href={`/fournitures/livraison?bon=${bon.id}`}>Réception avec photo</Link>
                <button type="button" className="btn btn-sec" onClick={() => setPanneau("pointer")}>Pointer une livraison</button>
              </div>
            ) : null}
          </div>
          <div className="ob-sec">
            <div className="lab">Facture reçue</div>
            {bon.facture ? (
              <>
                <div className="kv"><span>Facture {bon.facture.numero || ""}</span><b>{euro(bon.facture.montantHt)} HT</b></div>
                <div className="kv"><span>{jour(bon.facture.date)}</span><b className={Math.abs(bon.facture.ecartHt) >= 0.01 ? "fx-warn" : "fx-ok"}>{Math.abs(bon.facture.ecartHt) >= 0.01 ? `${bon.facture.ecartHt > 0 ? "+" : ""}${euro(bon.facture.ecartHt)} par rapport au bon` : "conforme au bon"}</b></div>
              </>
            ) : <p className="fx-note">Aucune facture rapprochée.</p>}
            {bon.etat !== "brouillon" && bon.etat !== "annule" ? <button type="button" className="link" onClick={() => setPanneau("facture")}>{bon.facture ? "Modifier la facture" : "Rapprocher la facture"}</button> : null}
          </div>
          {bon.etat === "brouillon" || bon.etat === "envoye" ? <button type="button" className="link" disabled={Boolean(busy)} onClick={() => action("annuler")}>{bon.etat === "brouillon" ? "Supprimer le brouillon" : "Annuler le bon"}</button> : null}
        </aside>
      </div>
      {panneau === "envoi" ? <Envoi bon={bon} onClose={() => setPanneau("")} onDone={fini} /> : null}
      {panneau === "pointer" ? <Pointer bon={bon} onClose={() => setPanneau("")} onDone={fini} /> : null}
      {panneau === "facture" ? <Facture bon={bon} onClose={() => setPanneau("")} onDone={fini} /> : null}
    </>
  );
}

export function BonsOnglet() {
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState(() => (typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("ok") || ""));
  const [selId, setSelId] = useState(() => (typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("bon") || ""));

  useEffect(() => { apiGet("/api/fournitures/bons").then(setData).catch((e) => setErreur(e.message)); }, []);

  function ouvrir(id) {
    setSelId(id);
    const p = new URLSearchParams(window.location.search);
    if (id) p.set("bon", id); else p.delete("bon");
    window.history.replaceState(null, "", `/fournitures?${p}`);
  }
  function maj(bon, supprime) {
    setData((d) => {
      if (!d) return d;
      if (supprime) return { ...d, bons: d.bons.filter((b) => b.id !== supprime) };
      if (!bon) return d;
      const existe = d.bons.some((b) => b.id === bon.id);
      return { ...d, bons: existe ? d.bons.map((b) => (b.id === bon.id ? bon : b)) : [bon, ...d.bons] };
    });
  }

  const bon = data?.bons.find((b) => b.id === selId);
  const c = data?.chiffres;
  if (erreur) return <p className="err" role="alert">{erreur}</p>;
  if (!data) return <p className="muted">Chargement…</p>;
  if (bon) return <>{message ? <p className="notice" role="status">{message}</p> : null}<DetailBon bon={bon} onBack={() => ouvrir("")} onChange={maj} setMessage={setMessage} /></>;

  return (
    <>
      {message ? <p className="notice" role="status">{message}</p> : null}
      <div className="fp-layout">
        <div className="tbl">
          {data.bons.length === 0 ? <div className="empty">Aucun bon de commande. Ouvrez les fournitures d'un chantier et « Préparer les commandes » : Koji regroupe par fournisseur.</div> : (
            <table>
              <thead><tr><th>Bon</th><th>Fournisseur</th><th>Chantier · lot</th><th>Envoyé le</th><th className="r">Montant</th><th>État</th><th aria-label="Action" /></tr></thead>
              <tbody>
                {data.bons.map((b) => (
                  <tr key={b.id} onClick={() => ouvrir(b.id)}>
                    <td className="n">{b.numero}</td>
                    <td>{b.supplierName}{b.partenaireId ? <> <span className="fx-badge">Partenaire Koji</span></> : null}</td>
                    <td className="sm2">{[b.projectTitle, b.lot].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="sm2">{b.envoyeLe ? jour(b.envoyeLe) : "—"}</td>
                    <td className="r">{euro(b.totaux.ht)} HT</td>
                    <td><span className={`fx-etat ${TON[b.etat]}`}>{ETATS_BON[b.etat]}</span></td>
                    <td className="r"><button type="button" className="btn btn-sec" onClick={(e) => { e.stopPropagation(); ouvrir(b.id); }}>Ouvrir</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {data.anciennes?.length ? <p className="fx-note" style={{ padding: "10px 12px" }}>{data.anciennes.length} commande{data.anciennes.length > 1 ? "s" : ""} d'avant les bons numérotés ({euro(data.anciennes.reduce((s, x) => s + x.montantHt, 0))} HT) restent dans vos données.</p> : null}
        </div>
        <aside className="ob-detail">
          <div className="ob-sec">
            <div className="lab">Comment un bon se crée</div>
            <p className="fx-note">Depuis les fournitures d'un chantier : vous cochez ce qu'il faut commander, Koji regroupe par fournisseur.</p>
            <p className="fx-note">Prix : votre prix négocié s'il existe, sinon le prix du partenaire Koji.</p>
            <p className="fx-note">Envoi par e-mail ; le bon est numéroté et daté. À la livraison, vous pointez ce qui est arrivé ; la facture reçue se rapproche du bon.</p>
          </div>
          <div className="ob-sec">
            <div className="lab">Ce mois</div>
            <div className="kv"><span>Bons envoyés</span><b>{c.envoyes} · {euro(c.envoyesHt)} HT</b></div>
            <div className="kv"><span>En attente de livraison</span><b>{c.attente}{c.attenteFournisseurs.length ? ` · ${c.attenteFournisseurs.slice(0, 2).join(", ")}` : ""}</b></div>
            <div className="kv"><span>Écarts facture / bon</span><b>{c.ecarts}{c.ecarts ? ` · ${c.ecartsHt > 0 ? "+ " : ""}${euro(c.ecartsHt)} à vérifier` : ""}</b></div>
          </div>
        </aside>
      </div>
    </>
  );
}
