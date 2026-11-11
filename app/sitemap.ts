import type { MetadataRoute } from "next";

// Genere sitemap.xml automatiquement (convention Next.js App Router :
// app/sitemap.ts -> /sitemap.xml). N'inclut QUE des pages publiques,
// accessibles sans connexion, et qui font sens pour le referencement
// (pas de page transactionnelle a usage unique).
//
// Verifie une par une (aucun import de components/Shell, ClientTopbar,
// getAuth ou getVerifiedUserId dans ces fichiers = pas de garde-fou de
// connexion) :
// - "/", "/login", "/signup" : entrees principales de l'app (Koji /
//   Koji Pro), deja repliees sur une seule page (voir components/
//   EntrepriseLogin.jsx).
// - "/worker" et "/signature/login" : portails de connexion publics pour
//   les deux autres profils (ouvrier, client qui signe un devis).
// - "/legal", "/aide" : pages de contenu public (mentions legales, aide).
//
// Volontairement exclues meme si non authentifiees : "/forgot-password",
// "/activate", "/set-password" (utilitaires a usage unique, sans interet
// pour le referencement) et "/signature/[token]" (une URL unique par
// devis/client, jamais une page generique a indexer).
const PUBLIC_ROUTES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  // Page d'accueil des entreprises (SITE-01) : c'est elle qui porte le
  // contenu, la racine ne fait que choisir entre les deux univers.
  { path: "/entreprise", changeFrequency: "weekly", priority: 0.9 },
  // Page Tarifs (SITE-03).
  { path: "/entreprise/tarifs", changeFrequency: "monthly", priority: 0.8 },
  // Pages Métiers (SITE-04) : une par métier dont le contenu est écrit.
  { path: "/entreprise/metiers/plombier", changeFrequency: "monthly", priority: 0.7 },
  // Contact et démonstration (SITE-06), À propos (SITE-07).
  { path: "/entreprise/contact", changeFrequency: "yearly", priority: 0.5 },
  { path: "/a-propos", changeFrequency: "yearly", priority: 0.4 },
  // Page d'accueil des particuliers (SITE-02).
  { path: "/particulier", changeFrequency: "weekly", priority: 0.9 },
  { path: "/login", changeFrequency: "monthly", priority: 0.8 },
  { path: "/signup", changeFrequency: "monthly", priority: 0.8 },
  { path: "/worker", changeFrequency: "monthly", priority: 0.5 },
  { path: "/signature/login", changeFrequency: "monthly", priority: 0.5 },
  { path: "/legal", changeFrequency: "yearly", priority: 0.3 },
  { path: "/aide", changeFrequency: "monthly", priority: 0.5 }
];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://web-app-koji.vercel.app").replace(/\/$/, "");
  const lastModified = new Date();

  return PUBLIC_ROUTES.map((route) => ({
    url: `${baseUrl}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority
  }));
}
