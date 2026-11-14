"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { RadarMap } from "../../components/RadarMap";
import { RechargeJetons } from "../../components/RechargeJetons";
import { apiGet } from "../../lib/client-api";
import { estNouveau, prixCourt, prixPartiel, publication, titreCourt, villeSeule } from "../../lib/radar-display";

// Radar des chantiers (maquette PRO-04 v3) : la carte et la liste des
// chantiers de la zone et des métiers de l'entreprise, avec pour chacun
// le prix à ses prix, le coût en jetons et les places (3 au plus). Le
// solde de jetons est en tête ; la fiche ouvre le positionnement.

const TABS = [
  { id: "tous", label: "Tous" },
  { id: "nouveaux", label: "Nouveaux" },
  { id: "pris", label: "Mes positions" }
];
const TRIS = [
  { id: "recent", label: "Plus récents" },
  { id: "distance", label: "Distance" },
  { id: "montant", label: "Montant" },
  { id: "jetons", label: "Jetons" }
];

const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs || `${un}s` : un}`;
const km = (d) => (d == null ? "" : `${String(d).replace(".", ",")} km`);

function Statut({ offre }) {
  const p = offre.maPosition;
  if (p && !p.termine) return <span className={p.etat === "rdv" ? "kj-st" : "tag tag-b"}>{p.etat === "rdv" ? "RDV confirmé" : "Position prise"}</span>;
  if (offre.places?.complet) return <span className="tag tag-o dim">Complet</span>;
  if (estNouveau(offre.createdAt)) return <span className="tag tag-e">Nouveau</span>;
  return <span className="sm2">À étudier</span>;
}

export default function MarketplacePage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("tous");
  const [tri, setTri] = useState("recent");
  const [query, setQuery] = useState("");
  const [choisi, setChoisi] = useState("");
  const [recharge, setRecharge] = useState(false);
  const [plusTard, setPlusTard] = useState(false);
  const [paye, setPaye] = useState(false);

  useEffect(() => {
    setPaye(new URLSearchParams(window.location.search).get("jetons") === "ok");
    try { setPlusTard(window.localStorage.getItem("koji-radar-premier-usage") === "vu"); } catch { /* sans stockage */ }
    apiGet("/api/marketplace/offres").then(setData).catch(() => setData({ offres: [] }));
  }, []);

  const offres = data?.offres || [];
  const loading = !data;
  const pris = (o) => Boolean(o.maPosition && !o.maPosition.termine);
  const counts = useMemo(() => ({
    tous: offres.length,
    nouveaux: offres.filter((o) => estNouveau(o.createdAt)).length,
    pris: offres.filter(pris).length
  }), [offres]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const cmp = {
      recent: (a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
      distance: (a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999),
      montant: (a, b) => Number(b.prixRecommande?.ttc || 0) - Number(a.prixRecommande?.ttc || 0),
      jetons: (a, b) => (a.jetons || 0) - (b.jetons || 0)
    }[tri];
    return offres
      .filter((o) => tab === "tous" || (tab === "nouveaux" ? estNouveau(o.createdAt) : pris(o)))
      .filter((o) => !needle || [o.description, o.metier, o.address].some((v) => String(v || "").toLowerCase().includes(needle)))
      .sort(cmp);
  }, [offres, tab, tri, query]);

  const points = rows
    .filter((o) => o.position)
    .map((o) => ({ id: o.id, lat: o.position.lat, lon: o.position.lon, label: o.prixRecommande?.ttc ? prixCourt(o.prixRecommande) : pluriel(o.jetons || 0, "jeton"), taken: pris(o) }));
  const solde = data?.jetons?.solde ?? 0;
  const zone = data?.zone;
  const zoneLabel = zone ? `${zone.ville || "Votre zone"} et ${zone.radiusKm} km autour` : "";
  const eyebrow = loading ? "Chargement…" : [
    `${pluriel(offres.length, "chantier")}${zoneLabel ? ` · ${zoneLabel}` : " dans votre zone"}`,
    `${pluriel(solde, "jeton disponible", "jetons disponibles")}`,
    data?.jetons?.reserves ? `${data.jetons.reserves} réservé${data.jetons.reserves > 1 ? "s" : ""}` : ""
  ].filter(Boolean).join(" · ");

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow">{eyebrow}</span>
          <h1>Radar des chantiers</h1>
        </div>
        <div className="acts">
          <button type="button" className="btn btn-sec" onClick={() => setRecharge(true)}>Recharger</button>
          <Link href="/profil" className="btn btn-sec">Ma zone et mes métiers</Link>
          <Link href="/marketplace/positions" className="btn btn-main">Mes positions</Link>
        </div>
      </div>

      {paye ? <p className="notice" role="status">Paiement reçu : vos jetons sont ajoutés dès que Stripe le confirme (quelques secondes).</p> : null}

      {data?.premierUsage && !plusTard ? (
        <section className="card rd-pos" style={{ marginBottom: 16 }}>
          <div className="card-h"><h2>Premier usage</h2></div>
          <div className="rx-steps">
            <div><b>1</b><span>Vérifiez votre zone et vos métiers</span><small>{[zoneLabel, (data.metiers || []).join(", ").toLowerCase()].filter(Boolean).join(" · ") || "à régler dans votre profil"}</small></div>
            <div><b>2</b><span>Choisissez un chantier sur la carte</span><small>Votre prix, calculé avec votre bibliothèque, et le coût en jetons</small></div>
            <div><b>3</b><span>Positionnez-vous</span><small>Jetons débités seulement si le client confirme un rendez-vous</small></div>
          </div>
          <div className="rx-mf">
            <button type="button" className="link" onClick={() => { setPlusTard(true); try { window.localStorage.setItem("koji-radar-premier-usage", "vu"); } catch { /* sans stockage */ } }}>Plus tard</button>
            <Link className="btn btn-sec" href="/profil">Ma zone et mes métiers</Link>
          </div>
        </section>
      ) : null}

      {points.length ? (
        <div className="rd-map">
          <RadarMap
            points={points}
            selectedId={choisi}
            onSelect={(id) => (choisi === id ? router.push(`/marketplace/${id}`) : setChoisi(id))}
            zone={zone}
            caption={zoneLabel ? `${zoneLabel} · ${pluriel(offres.length, "chantier")}` : pluriel(offres.length, "chantier")}
            legende={{ nouveaux: counts.nouveaux, prises: counts.pris }}
          />
        </div>
      ) : null}

      <div className="tbar">
        <div className="wtabs" role="tablist" aria-label="Filtrer les chantiers">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
              {t.label} <span>{counts[t.id]}</span>
            </button>
          ))}
        </div>
        <label className="kp-sort">
          Trier
          <select value={tri} onChange={(e) => setTri(e.target.value)}>{TRIS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
        </label>
        <label className="search search-wide">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4.5-4.5" /></svg>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Métier, ville, travaux" aria-label="Rechercher un chantier" />
        </label>
      </div>

      {rows.length === 0 ? (
        <div className="tbl">
          <div className="empty">
            {loading ? "Chargement…" : query.trim() ? "Aucun chantier ne correspond à cette recherche." : tab === "tous"
              ? <><strong>Aucun chantier pour vos métiers dans votre zone</strong><br />Koji vous prévient dès qu'un chantier correspond. <Link className="link" href="/profil">Élargir la zone ou changer mes métiers</Link></>
              : "Aucun chantier dans cet onglet."}
          </div>
        </div>
      ) : (
        <>
          <div className="tbl has-cards">
            <table>
              <thead>
                <tr>
                  <th>Chantier</th>
                  <th className="r">Votre prix</th>
                  <th>Lieu</th>
                  <th className="r">Jetons</th>
                  <th>Places</th>
                  <th>Statut</th>
                  <th aria-label="Action" />
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id} className={choisi === o.id ? "sel" : ""} onClick={() => router.push(`/marketplace/${o.id}`)}>
                    <td className="n">
                      <Link href={`/marketplace/${o.id}`} className="rd-row-link">{titreCourt(o.description)}</Link>
                      <div className="sm">{[o.metier || "Métier non précisé", publication(o.createdAt)].join(" · ")}</div>
                    </td>
                    <td className="r"><b>{prixCourt(o.prixRecommande)}</b>{prixPartiel(o.prixRecommande) ? <div className="sm">partiel</div> : null}</td>
                    <td>{[villeSeule(o.address), km(o.distanceKm)].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="r">{o.maPosition && !o.maPosition.termine ? o.maPosition.jetons?.texte?.split(" · ")[0] : o.jetons}</td>
                    <td>{o.places ? `${o.places.prises} / ${o.places.max}` : "—"}</td>
                    <td><Statut offre={o} /></td>
                    <td className="r"><Link href={`/marketplace/${o.id}`} className="btn btn-sec">Voir</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mlist">
            {rows.map((o) => (
              <Link href={`/marketplace/${o.id}`} className="m-card" key={o.id}>
                <div className="top2">
                  <div>
                    <div className="nm">{titreCourt(o.description)}</div>
                    <div className="meta">{[villeSeule(o.address), km(o.distanceKm), publication(o.createdAt)].filter(Boolean).join(" · ")}</div>
                  </div>
                  <Statut offre={o} />
                </div>
                <div className="line">{[`Votre prix ${prixCourt(o.prixRecommande)}`, pluriel(o.jetons || 0, "jeton"), o.places ? `${o.places.prises} position${o.places.prises > 1 ? "s" : ""} sur ${o.places.max}` : ""].filter(Boolean).join(" · ")}</div>
              </Link>
            ))}
          </div>
        </>
      )}

      <p className="foot-note">Jetons réservés au positionnement, débités seulement si le client confirme un rendez-vous, rendus sinon. Trois entreprises au plus par chantier. L'adresse exacte et les coordonnées du client restent masquées jusqu'au rendez-vous confirmé.</p>

      {recharge ? <RechargeJetons jetons={data?.jetons} onClose={() => setRecharge(false)} /> : null}
    </Shell>
  );
}
