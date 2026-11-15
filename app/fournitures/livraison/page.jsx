"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Shell } from "../../../components/Shell";
import { apiGet, apiSend } from "../../../lib/client-api";
import { ETATS_LIVRAISON, plusJoursOuvres, texteReclamation } from "../../../lib/fournitures-bons";
import { nombre } from "../../../lib/fournitures-pro";
import { FournituresTabs } from "../FournituresTabs";
import { Thumb, aujourdhui, jour, lireImage, nb } from "../commun";
import "../fournitures.css";

// Réception des livraisons (maquette PRO-07.5) : une photo du bon suffit ;
// Koji le lit, le compare au bon de commande, signale manquants et casse et
// prépare la réclamation. Tout reste vérifiable avant l'envoi.
const TON = { conforme: "ok", manquant: "late", partiel: "wait", casse: "late", en_plus: "off" };

function Livraison() {
  const router = useRouter();
  const params = useSearchParams();
  const bonId = params.get("bon") || "";
  const [bon, setBon] = useState(null);
  const [erreur, setErreur] = useState("");
  const [photo, setPhoto] = useState("");
  const [lecture, setLecture] = useState(null);
  const [ecarts, setEcarts] = useState([]);
  const [defauts, setDefauts] = useState([]);
  const [texte, setTexte] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    apiGet("/api/fournitures/bons").then((d) => {
      const b = d.bons.find((x) => x.id === bonId);
      if (!b) setErreur("Bon introuvable.");
      else { setBon(b); setTo(b.supplierEmail || ""); }
    }).catch((e) => setErreur(e.message));
  }, [bonId]);

  useEffect(() => {
    if (!lecture) return;
    setTexte(texteReclamation({ numeroBl: lecture.numeroBl, date: lecture.date, ecarts, dateLimite: plusJoursOuvres(lecture.date, 2) }));
  }, [ecarts, lecture]);

  async function prendre(event) {
    const f = event.target.files?.[0];
    event.target.value = "";
    if (!f) return;
    setErreur("");
    try {
      const p = await lireImage(f, 1800);
      setPhoto(p);
      setBusy("lecture");
      const r = await apiSend("/api/fournitures/livraisons", { bonId, photo: p });
      setLecture(r);
      setEcarts(r.ecarts);
    } catch (e) { setErreur(e.message); }
    setBusy("");
  }

  async function photoDefaut(event) {
    const f = event.target.files?.[0];
    event.target.value = "";
    if (!f) return;
    try { const p = await lireImage(f, 1200); setDefauts((d) => [...d, p].slice(0, 4)); } catch (e) { setErreur(e.message); }
  }

  const majEcart = (i, patch) => setEcarts((xs) => xs.map((x, j) => {
    if (j !== i) return x;
    const n = { ...x, ...patch };
    if (patch.livre != null && n.etat !== "casse") n.etat = !(n.livre > 0) ? "manquant" : n.livre < n.commande - 1e-9 ? "partiel" : "conforme";
    return n;
  }));

  const problemes = ecarts.filter((e) => ["manquant", "partiel", "casse"].includes(e.etat));

  async function valider(reclamer) {
    setBusy(reclamer ? "reclamer" : "valider");
    setErreur("");
    try {
      const r = await apiSend("/api/fournitures/livraisons", {
        bonId, numeroBl: lecture?.numeroBl || "", date: lecture?.date || aujourdhui(), ecarts, photoBl: photo.length < 900000 ? photo : "", photosDefaut: defauts, reclamer, texte, to
      }, "PATCH");
      router.push(`/fournitures?tab=bons&bon=${bonId}&ok=${encodeURIComponent(r.message)}`);
    } catch (e) { setErreur(e.message); setBusy(""); }
  }

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow"><Link className="link" href="/fournitures?tab=bons">Fournitures</Link>{bon?.projectTitle ? ` · ${bon.projectTitle}` : ""}</span>
          <h1>{bon ? `Livraison ${bon.supplierName}${lecture?.date ? ` du ${jour(lecture.date)}` : ""}` : "Réception d'une livraison"}</h1>
          <span className="muted">À la livraison, une photo du bon suffit : Koji le lit, le compare au bon de commande, signale manquants et casse, et prépare la réclamation au fournisseur.</span>
        </div>
        <div className="hact">
          {lecture && problemes.length ? <button type="button" className="btn btn-main" disabled={Boolean(busy) || !to.trim()} onClick={() => valider(true)}>{busy === "reclamer" ? "Envoi…" : `Envoyer la réclamation à ${bon?.supplierName}`}</button> : null}
        </div>
      </div>
      <FournituresTabs current="bons" />
      {erreur ? <p className="err" role="alert">{erreur}</p> : null}
      {!bon ? null : (
        <div className="fp-layout">
          <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
            {!lecture ? (
              <section className="card">
                <div className="card-h"><h2>Bon {bon.numero} · {bon.lignes.length} ligne{bon.lignes.length > 1 ? "s" : ""}</h2></div>
                <p className="fx-note">Prenez le bon de livraison en photo, bien à plat. Koji compare chaque ligne au bon de commande.</p>
                <label className="btn btn-main" style={{ alignSelf: "flex-start" }}>{busy === "lecture" ? "Lecture du bon…" : "Photo du bon de livraison"}<input type="file" accept="image/*" capture="environment" hidden disabled={busy === "lecture"} onChange={prendre} /></label>
                <p className="fx-note">Sans photo : <Link className="link" href={`/fournitures?tab=bons&bon=${bon.id}`}>pointer la livraison à la main</Link>.</p>
              </section>
            ) : (
              <section className="card">
                <div className="card-h"><h2>Contrôle du bon de livraison {lecture.numeroBl}</h2><span className="sm2">lu par Koji sur la photo · à vérifier</span></div>
                <div className="tbl">
                  <table>
                    <thead><tr><th>Article</th><th className="r">Commandé</th><th className="r">Livré</th><th>État</th></tr></thead>
                    <tbody>
                      {ecarts.map((e, i) => (
                        <tr key={`${e.ligneId}-${i}`}>
                          <td><div className="n2">{e.name}</div>{e.etat === "casse" ? <input value={e.defaut} onChange={(x) => majEcart(i, { defaut: x.target.value })} placeholder="un coin cassé" aria-label={`Défaut de ${e.name}`} style={{ marginTop: 4, height: 30, padding: "0 6px", border: "1px solid var(--btn)", borderRadius: 2, font: "inherit", width: "100%" }} /> : null}</td>
                          <td className="r">{e.commande ? nb(e.commande) : "—"}</td>
                          <td className="r"><input type="number" min="0" step="0.01" value={e.livre} onChange={(x) => majEcart(i, { livre: nombre(x.target.value) })} aria-label={`Livré pour ${e.name}`} style={{ width: 70, height: 30, padding: "0 6px", border: "1px solid var(--btn)", borderRadius: 2, font: "inherit", textAlign: "right" }} /></td>
                          <td>
                            {e.etat === "en_plus" ? <span className="fx-etat off">non commandé</span> : (
                              <select value={e.etat} onChange={(x) => majEcart(i, { etat: x.target.value })} aria-label={`État de ${e.name}`} className={`fx-etat ${TON[e.etat]}`}>
                                {["conforme", "partiel", "manquant", "casse"].map((k) => <option key={k} value={k}>{ETATS_LIVRAISON[k]}</option>)}
                              </select>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!problemes.length ? (
                  <div className="env-act"><button type="button" className="btn btn-main" disabled={Boolean(busy)} onClick={() => valider(false)}>{busy ? "…" : "Livraison conforme · enregistrer"}</button></div>
                ) : null}
              </section>
            )}
            {lecture && problemes.length ? (
              <section className="card">
                <div className="card-h"><h2>Réclamation préparée</h2></div>
                <label className="ed">À<input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="e-mail du fournisseur" /></label>
                <label className="ed">Message<textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={5} /></label>
                {ecarts.some((e) => e.etat === "casse") ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    {defauts.map((p, i) => <Thumb key={i} src={p} size={56} />)}
                    <label className="btn btn-sec">Photo du défaut<input type="file" accept="image/*" capture="environment" hidden onChange={photoDefaut} /></label>
                  </div>
                ) : null}
                <p className="fx-note">Le chantier est prévenu : pose décalée si besoin. Réserves au transporteur : à porter sur le bon et confirmer dans les 3 jours.</p>
                <div className="env-act">
                  <button type="button" className="btn btn-sec" disabled={Boolean(busy)} onClick={() => valider(false)}>Enregistrer sans réclamer</button>
                  <button type="button" className="btn btn-main" disabled={Boolean(busy) || !to.trim()} onClick={() => valider(true)}>{busy === "reclamer" ? "Envoi…" : "Envoyer la réclamation"}</button>
                </div>
              </section>
            ) : null}
          </div>
          <aside className="ob-detail">
            <div className="ob-sec">
              <div className="lab">Photo du bon</div>
              {photo ? <img className="fx-photo" src={photo} alt="Bon de livraison" /> : <p className="fx-note">Pas encore de photo.</p>}
              {photo ? <label className="link">Reprendre la photo<input type="file" accept="image/*" capture="environment" hidden onChange={prendre} /></label> : null}
            </div>
            <div className="ob-sec">
              <div className="lab">Bon de commande</div>
              <div className="kv"><span>{bon.numero}</span><b>{bon.supplierName}</b></div>
              {bon.livraisonLe ? <div className="kv"><span>Livraison prévue</span><b>{jour(bon.livraisonLe)}</b></div> : null}
            </div>
          </aside>
        </div>
      )}
    </Shell>
  );
}

export default function Page() {
  return <Suspense fallback={null}><Livraison /></Suspense>;
}
