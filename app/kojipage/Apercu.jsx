"use client";

// Aperçu de la KojiPage (maquette PRO-13, colonne de droite) : la version
// non publiée, au gabarit Koji, à la couleur du bandeau.
const fmtNote = (n) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n || 0);
const initiales = (nom = "") => { const m = String(nom || "K").split(/\s+/).filter(Boolean); return (/^[A-Z]{2,}$/.test(m[0] || "") ? m[0].slice(0, 2) : m.slice(0, 2).map((x) => x[0]).join("")).toUpperCase(); };

export function libellePrixCourt(p = {}) {
  if (p.prixType === "devis" || !p.prix) return "sur devis";
  const n = new Intl.NumberFormat("fr-FR").format(p.prix).replace(/ /g, " ");
  return p.prixType === "m2" ? `à partir de ${n} € TTC / m²` : `à partir de ${n} € TTC`;
}

export function Apercu({ site = {}, urls = {}, couleur = "#0B1530", logo = "", avisStats = {}, verifie = false, decennale = false, mode = "tel" }) {
  const reals = (site.realisations || []).filter((r) => !r.statut || r.statut === "publiee").slice(0, mode === "tel" ? 2 : 3);
  const sections = site.sections || {};
  const photo = (r, phase) => {
    const liste = phase === "avant" ? (r.avant?.length ? r.avant : (r.photos || []).slice(0, 1)) : (r.apres?.length ? r.apres : (r.photos || []).slice(1));
    return urls[liste[0]] || "";
  };
  return (
    <div className={`kj2-pv ${mode}`} style={{ "--bandeau": couleur }}>
      <div className="kj2-pv-top">
        <span className="kj2-pv-lg">{logo ? <img src={logo} alt="" /> : initiales(site.title)}</span>
        <b>{site.title || "Votre entreprise"}</b>
      </div>
      <div className="kj2-pv-hero">
        <small>{site.tagline || "Votre accroche"}</small>
        <h3>{site.title || "Votre entreprise"}</h3>
        {site.contactName ? (
          <div className="kj2-pv-who">
            {urls[site.contactPhotoDataUrl] ? <img src={urls[site.contactPhotoDataUrl]} alt="" /> : <span>{initiales(site.contactName)}</span>}
            <p><b>{site.contactName}</b> dirigeant</p>
          </div>
        ) : null}
        <div className="kj2-pv-badges">
          {verifie ? <em>Vérifié par Koji</em> : null}
          {avisStats.nombre ? <em>{fmtNote(avisStats.moyenne)} · {avisStats.nombre} avis</em> : null}
          {decennale ? <em>Décennale vérifiée</em> : null}
        </div>
      </div>
      {sections.realisations !== false && reals.length ? (
        <div className="kj2-pv-sec">
          <div className="kj2-pv-h"><b>Réalisations</b><small>Voir les {(site.realisations || []).filter((r) => !r.statut || r.statut === "publiee").length}</small></div>
          <div className="kj2-pv-reals">
            {reals.map((r) => (
              <div key={r.id} className="kj2-pv-real">
                <div className="kj2-pv-ph"><span style={photo(r, "avant") ? { backgroundImage: `url(${photo(r, "avant")})` } : null}><i>Avant</i></span><span style={photo(r, "apres") ? { backgroundImage: `url(${photo(r, "apres")})` } : null}><i>Après</i></span></div>
                <b>{r.name}</b><small>{[r.lieu, r.duree].filter(Boolean).join(" · ")}</small>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {sections.prestations !== false && (site.prestations || []).length ? (
        <div className="kj2-pv-sec">
          <div className="kj2-pv-h"><b>Prestations</b></div>
          {(site.prestations || []).slice(0, 3).map((p) => (
            <div key={p.id} className="kj2-pv-pr"><span><b>{p.nom}</b><small>{p.delai}</small></span><em>{libellePrixCourt(p)}</em></div>
          ))}
        </div>
      ) : null}
      {sections.formulaire !== false ? <div className="kj2-pv-cta">Demander un devis</div> : null}
    </div>
  );
}
