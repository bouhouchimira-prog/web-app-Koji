"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiGet } from "../../lib/client-api";
import { estNouveau, publication, titreCourt, villeSeule } from "../../lib/radar-display";
import { useApi } from "../../lib/use-api";

// Radar des chantiers, maquette PRO-04 (DA Koji Pro, 30 oct) : liste des
// chantiers publiés dans la zone et les métiers de l'entreprise. Pas de
// carte : l'API ne transmet volontairement que la ville (adresse masquée
// jusqu'au rendez-vous confirmé).

const TABS = [
  { id: "tous", label: "Tous" },
  { id: "nouveaux", label: "Nouveaux" },
  { id: "pris", label: "Positions prises" }
];

function plural(n, one, many) {
  return `${n} ${n > 1 ? many || `${one}s` : one}`;
}

function Status({ taken, fresh }) {
  if (taken) return <span className="tag tag-b">Position prise</span>;
  if (fresh) return <span className="tag tag-e">Nouveau</span>;
  return <span className="sm2">À étudier</span>;
}

export default function MarketplacePage() {
  const router = useRouter();
  const { data: offres, loading } = useApi("/api/marketplace/offres", "offres");
  const [positions, setPositions] = useState({});
  const [tab, setTab] = useState("tous");
  const [query, setQuery] = useState("");
  const requested = useRef(new Set());

  useEffect(() => {
    offres.forEach((offre) => {
      if (requested.current.has(offre.id)) return;
      requested.current.add(offre.id);
      apiGet(`/api/marketplace/offres/${offre.id}/positionner`)
        .then((data) => setPositions((current) => ({ ...current, [offre.id]: Boolean(data.positionnee) })))
        .catch(() => {});
    });
  }, [offres]);

  const counts = useMemo(() => ({
    tous: offres.length,
    nouveaux: offres.filter((offre) => estNouveau(offre.createdAt)).length,
    pris: offres.filter((offre) => positions[offre.id]).length
  }), [offres, positions]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return offres
      .filter((offre) => tab === "tous" || (tab === "nouveaux" ? estNouveau(offre.createdAt) : positions[offre.id]))
      .filter((offre) => !needle || [offre.description, offre.metier, offre.address].some((v) => String(v || "").toLowerCase().includes(needle)));
  }, [offres, positions, tab, query]);

  const eyebrow = [
    `${plural(offres.length, "chantier")} dans votre zone`,
    counts.nouveaux ? plural(counts.nouveaux, "nouveau", "nouveaux") : null,
    counts.pris ? plural(counts.pris, "position prise", "positions prises") : null
  ].filter(Boolean).join(" · ");

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow">{loading ? "Chargement…" : eyebrow}</span>
          <h1>Radar des chantiers</h1>
        </div>
        <div className="acts">
          <Link href="/profil" className="btn btn-sec">Ma zone et mes métiers</Link>
        </div>
      </div>

      <div className="tbar">
        <div className="wtabs" role="tablist" aria-label="Filtrer les chantiers">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
              {t.label} <span>{counts[t.id]}</span>
            </button>
          ))}
        </div>
        <label className="search search-wide">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4.5-4.5" /></svg>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Métier, ville, travaux" aria-label="Rechercher un chantier" />
        </label>
      </div>

      {rows.length === 0 ? (
        <div className="tbl">
          <div className="empty">
            {loading ? "Chargement…" : query.trim() ? "Aucun chantier ne correspond à cette recherche." : tab === "tous" ? "Aucun chantier publié dans votre zone pour l'instant." : "Aucun chantier dans cet onglet."}
          </div>
        </div>
      ) : (
        <>
          <div className="tbl has-cards">
            <table>
              <thead>
                <tr>
                  <th>Chantier</th>
                  <th>Ville</th>
                  <th>Publication</th>
                  <th className="r">Photos</th>
                  <th>Statut</th>
                  <th aria-label="Action" />
                </tr>
              </thead>
              <tbody>
                {rows.map((offre) => (
                  <tr key={offre.id} onClick={() => router.push(`/marketplace/${offre.id}`)}>
                    <td className="n">
                      <Link href={`/marketplace/${offre.id}`} className="rd-row-link">{titreCourt(offre.description)}</Link>
                      <div className="sm">{offre.metier || "Métier non précisé"}{offre.delaiEstimeJours ? ` · ${plural(offre.delaiEstimeJours, "jour")} estimés` : ""}</div>
                    </td>
                    <td>{villeSeule(offre.address) || "—"}</td>
                    <td className="sm2">{publication(offre.createdAt)}</td>
                    <td className="r">{offre.photosCount || 0}</td>
                    <td><Status taken={positions[offre.id]} fresh={estNouveau(offre.createdAt)} /></td>
                    <td className="r"><Link href={`/marketplace/${offre.id}`} className="btn btn-sec">Voir</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mlist">
            {rows.map((offre) => (
              <Link href={`/marketplace/${offre.id}`} className="m-card" key={offre.id}>
                <div className="top2">
                  <div>
                    <div className="nm">{titreCourt(offre.description)}</div>
                    <div className="meta">{[offre.metier, villeSeule(offre.address)].filter(Boolean).join(" · ")}</div>
                  </div>
                  <Status taken={positions[offre.id]} fresh={estNouveau(offre.createdAt)} />
                </div>
                <div className="line">{[publication(offre.createdAt), plural(offre.photosCount || 0, "photo")].filter(Boolean).join(" · ")}</div>
              </Link>
            ))}
          </div>
        </>
      )}

      <p className="foot-note">Le Radar montre les chantiers publiés dans votre zone et vos métiers, réglables dans votre profil. L'adresse exacte et les coordonnées du client restent masquées jusqu'à un rendez-vous confirmé.</p>
    </Shell>
  );
}
