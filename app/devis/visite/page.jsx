"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Shell } from "../../../components/Shell";
import { apiGet } from "../../../lib/client-api";
import { constat, dureeVisite, propositions, quantitesCalculees, texteCote, nombre } from "../../../lib/visite-mode";

// Compte rendu de visite (maquette PRO-03.8, ordinateur) : photos, quantités
// calculées avec leur formule, cotes, vérifications, notes dictées, puis
// « Démarrer le devis guidé » prérempli depuis la visite.
const PARIS = { timeZone: "Europe/Paris" };
const heure = (iso) => (iso ? new Intl.DateTimeFormat("fr-FR", { ...PARIS, hour: "2-digit", minute: "2-digit" }).format(new Date(iso)).replace(":", " h ") : "");
const horodatage = (iso) => (iso ? `${new Intl.DateTimeFormat("fr-FR", { ...PARIS, day: "2-digit", month: "2-digit" }).format(new Date(iso))} ${new Intl.DateTimeFormat("fr-FR", { ...PARIS, hour: "2-digit", minute: "2-digit" }).format(new Date(iso))}` : "");
const jourVisite = (iso) => (iso ? new Intl.DateTimeFormat("fr-FR", { ...PARIS, weekday: "long", day: "numeric", month: "short" }).format(new Date(iso)) : "");

function CompteRendu() {
  const id = useSearchParams().get("id") || "";
  const [visite, setVisite] = useState(null);
  const [erreur, setErreur] = useState("");
  const [tout, setTout] = useState(false);
  const [pieceId, setPieceId] = useState("");

  useEffect(() => {
    if (!id) return;
    apiGet(`/api/visites?id=${encodeURIComponent(id)}`)
      .then((r) => setVisite(r.visite))
      .catch((e) => setErreur(e.message || "Visite introuvable."));
  }, [id]);

  if (erreur || !id) {
    return (
      <Shell variant="pro">
        <div className="head"><div className="stack"><span className="eyebrow">Devis</span><h1>Compte rendu de visite</h1></div></div>
        <p className="notice">{erreur || "Visite introuvable."}</p>
      </Shell>
    );
  }
  if (!visite) {
    return <Shell variant="pro"><p className="muted">Chargement…</p></Shell>;
  }

  const pieces = visite.pieces || [];
  const piece = pieces.find((p) => p.id === pieceId) || pieces[0] || { nom: "Pièce", cotes: [], points: [], notes: [], photos: [] };
  const photos = pieces.flatMap((p) => p.photos || []).filter((p) => p.url).sort((a, b) => String(a.le).localeCompare(String(b.le)));
  const quantites = quantitesCalculees(piece, visite.demande);
  const decisions = visite.propositions || {};
  const props = propositions(piece.points, piece.nom);
  const verifs = (piece.points || []).filter((p) => p.reponse);
  const debut = visite.debut ? `${jourVisite(visite.debut)}, ${heure(visite.debut)}${visite.fin ? ` à ${heure(visite.fin)}` : ""}` : "";
  const eyebrow = ["Devis", visite.client, visite.adresse, debut ? `visite du ${debut}` : ""].filter(Boolean).join(" · ");
  const lienDevis = visite.quoteId ? `/devis?id=${visite.quoteId}` : `/devis?new=1&mode=ia&visite=${visite.id}`;

  return (
    <Shell variant="pro">
      <div className="vi">
        <div className="head">
          <div className="stack">
            <span className="eyebrow">{eyebrow}</span>
            <h1>Compte rendu de visite · {piece.nom}</h1>
          </div>
          <div className="hact">
            {visite.resumeEnvoyeLe ? <span className="btn btn-sec" aria-disabled="true">Résumé envoyé à {visite.client || "votre client"}</span> : null}
            <Link className="btn btn-main" href={lienDevis}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              {visite.quoteId ? "Ouvrir le devis" : "Démarrer le devis guidé"}
            </Link>
          </div>
        </div>

        {pieces.length > 1 ? (
          <div className="wtabs" role="tablist" aria-label="Pièces visitées">
            {pieces.map((p) => (
              <button key={p.id} type="button" role="tab" aria-selected={p.id === piece.id} className={p.id === piece.id ? "on" : ""} onClick={() => setPieceId(p.id)}>{p.nom}</button>
            ))}
          </div>
        ) : null}

        <p className="muted vi-meta">
          {[visite.fin && visite.debut ? `Visite de ${dureeVisite(visite.debut, visite.fin)}` : "Visite en cours",
            visite.recuLe ? `reçue le ${horodatage(visite.recuLe)}` : "",
            visite.ecartSecondes != null && Math.abs(visite.ecartSecondes) > 120 ? `heure du téléphone décalée de ${Math.round(Math.abs(visite.ecartSecondes) / 60)} min` : visite.recuLe ? "heure vérifiée" : ""]
            .filter(Boolean).join(" · ")}
        </p>

        <div className="vi-g">
          <div className="stack" style={{ gap: 20 }}>
            <div className="card">
              <div className="card-h">
                <h2>Photos<span className="kcnt">{photos.length}</span></h2>
                {photos.length > 6 ? <button type="button" className="link" onClick={() => setTout((v) => !v)}>{tout ? "Réduire" : "Tout voir"}</button> : null}
              </div>
              {photos.length ? (
                <div className="vi-wps">
                  {(tout ? photos : photos.slice(0, 6)).map((p) => (
                    <a className="vi-wp" key={p.id} href={p.url} target="_blank" rel="noreferrer">
                      <img src={p.url} alt={`Photo du ${horodatage(p.le)}`} loading="lazy" />
                      <span className="ph-st">{horodatage(p.le)}</span>
                    </a>
                  ))}
                </div>
              ) : <p className="muted">Pas encore de photo reçue.</p>}
            </div>

            <div className="card">
              <div className="card-h"><h2>Quantités calculées</h2><span className="sm2">reprises dans le Devis guidé</span></div>
              {quantites.length ? (
                <table className="vs-t">
                  <tbody>
                    {quantites.map((q) => (
                      <tr key={q.id}>
                        <td><b>{q.libelle}</b><small>{q.formule}</small></td>
                        <td className="num"><b>{nombre(q.valeur)} {q.unite}</b></td>
                        <td className="sm2">depuis les cotes</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="muted">Longueur, largeur et hauteur de la pièce donnent le sol et les murs.</p>}
            </div>
          </div>

          <div className="stack" style={{ gap: 20 }}>
            <div className="card">
              <div className="card-h"><h2>Cotes<span className="kcnt">{(piece.cotes || []).length}</span></h2></div>
              {(piece.cotes || []).map((c) => (
                <div className="kv" key={c.id || c.libelle}><span>{c.libelle || "Cote"}</span><b>{texteCote(c)}</b></div>
              ))}
              {!(piece.cotes || []).length ? <p className="muted">Aucune cote.</p> : null}
            </div>

            <div className="card">
              <div className="card-h"><h2>Vérifications<span className="kcnt">{verifs.length}</span></h2></div>
              {verifs.map((p) => {
                const prop = props.find((x) => x.pointId === p.id);
                const decision = prop ? decisions[prop.id] : "";
                return (
                  <div className={`vi-wck${prop ? " w" : ""}`} key={p.id}>
                    {prop ? <span>!</span> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>}
                    <div>
                      <b>{p.court || p.libelle}</b>
                      <small>
                        {[p.reponse, p.detail].filter(Boolean).join(", ")}
                        {prop ? ` → ${decision === "acceptee" ? `${prop.court} proposé${prop.option ? " en option" : ""}` : decision === "refusee" ? `${prop.court} non proposé` : `${prop.court} à décider`}` : ""}
                      </small>
                    </div>
                  </div>
                );
              })}
              {!verifs.length ? <p className="muted">Aucune vérification faite.</p> : null}
              {(piece.points || []).filter((p) => !p.reponse).map((p) => (
                <div className="vi-wck" key={p.id}><span>·</span><div><b>{p.court || p.libelle}</b><small>pas vérifié</small></div></div>
              ))}
            </div>

            <div className="card">
              <div className="card-h"><h2>Notes dictées<span className="kcnt">{(piece.notes || []).length}</span></h2></div>
              {(piece.notes || []).map((n, i) => (
                <div className="vs-q" key={n.id || i} style={i ? { marginTop: 8 } : undefined}>
                  « {n.texte} »
                  <small>{[heure(n.le), n.lot ? `ajoutée au lot ${n.lot}` : "dictée pendant la visite"].filter(Boolean).join(" · ")}</small>
                </div>
              ))}
              {!(piece.notes || []).length ? <p className="muted">Aucune note.</p> : null}
            </div>
          </div>
        </div>
        {visite.demande ? (
          <div className="card">
            <div className="card-h"><h2>Ce que le client a décrit</h2></div>
            <p>{visite.demande}</p>
            {verifs.length ? <p className="muted">Points vus : {verifs.map((p) => constat(p)).filter(Boolean).join(", ")}.</p> : null}
          </div>
        ) : null}
      </div>
    </Shell>
  );
}

export default function VisitePage() {
  return (
    <Suspense fallback={null}>
      <CompteRendu />
    </Suspense>
  );
}
