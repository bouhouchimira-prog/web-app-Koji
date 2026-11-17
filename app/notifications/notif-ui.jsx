"use client";

// Icônes des catégories de notification (maquette PRO-23), en trait, sans
// couleur : le jaune n'apparaît jamais dans la liste.
const TRACES = {
  devis: "M6 3h9l4 4v14H6zM9 12h7M9 16h5",
  paiement: "M3 7h18v10H3zM3 11h18M7 15h3",
  radar: "M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  message: "M4 5h16v11H9l-5 4z",
  rdv: "M5 5h14v15H5zM5 9h14M9 3v4M15 3v4",
  equipe: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3 3-5 6-5s6 2 6 5M14 15c3 0 8 1 8 5",
  reserve: "M12 3l9 16H3zM12 10v4M12 17h.01",
  avis: "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z",
  document: "M6 3h9l4 4v14H6zM14 3v5h5",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7h.01"
};

export function IconeNotif({ categorie }) {
  return <span className="nt-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d={TRACES[categorie] || TRACES.info} /></svg></span>;
}
