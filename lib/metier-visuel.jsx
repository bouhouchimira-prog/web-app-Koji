// Pictogramme et couleur par metier (6 oct) — extrait de app/page.jsx (tableau
// de bord entreprise, ou ce systeme a ete construit en premier pour les
// vignettes d'offres du marketplace) pour etre reutilise aussi cote
// particulier (app/client/page.jsx, liste "Mes demandes") sans dupliquer le
// code ni importer depuis un fichier de page.
export const METIERS_VISUEL = [
  { match: /plomb|chauffe|sanitaire/i, color: "#2f6fb5", icon: <path d="M12 2.5s6.5 7.2 6.5 11.8a6.5 6.5 0 0 1-13 0C5.5 9.7 12 2.5 12 2.5z" /> },
  { match: /[ée]lectri/i, color: "#d99a1e", icon: <path d="M13 2 4 14h7l-1 8 9-12h-7z" /> },
  { match: /serrur/i, color: "#6b5bb5", icon: <><circle cx="8" cy="12" r="4" /><path d="M12 12h9M18 12v3M21 12v2" /></> },
  { match: /peint/i, color: "#c0567a", icon: <><rect x="3" y="3" width="15" height="6" rx="1" /><path d="M18 6h2v5h-9v3M10 14h2v7h-2z" /></> },
  { match: /carrel|fa[iï]ence/i, color: "#1f8a7a", icon: <><rect x="3" y="3" width="8" height="8" /><rect x="13" y="3" width="8" height="8" /><rect x="3" y="13" width="8" height="8" /><rect x="13" y="13" width="8" height="8" /></> },
  { match: /ma[çc]on|b[ée]ton|gros/i, color: "#a0673a", icon: <><rect x="2" y="4" width="20" height="16" /><path d="M2 10h20M2 16h20M12 4v6M7 10v6M17 10v6M12 16v4" /></> },
  { match: /menuis|bois/i, color: "#8a6a3a", icon: <><path d="M3 21 14 10" /><path d="m13 5 6 6-3 3-6-6z" /></> }
];
export const METIER_VISUEL_DEFAUT = { color: "#172549", icon: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z" /> };

export function metierVisuel(metier) {
  return METIERS_VISUEL.find((m) => m.match.test(String(metier || ""))) || METIER_VISUEL_DEFAUT;
}
