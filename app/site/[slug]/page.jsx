import { readDb } from "../../../lib/db";
import { SitePublic } from "./SitePublic";

// KojiPage publique (maquette PRO-13.2) : titre et description pour les
// moteurs de recherche (titre, ville, métiers) ; une page non indexable
// (Réglages) ou pas encore en ligne n'est pas référencée.
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const db = await readDb().catch(() => null);
  const site = (db?.companySites || []).find((s) => s.slug === slug);
  if (!site?.published) return { title: "KojiPage", robots: { index: false, follow: false } };
  const c = { ...site, ...(site.publie || {}) };
  const metiers = (c.specialties || []).slice(0, 3).join(", ");
  return {
    title: `${c.title || "Entreprise"}${c.tagline ? `, ${c.tagline.charAt(0).toLowerCase()}${c.tagline.slice(1)}` : metiers ? `, ${metiers.toLowerCase()}` : ""}`,
    description: (c.presentationText || `${c.title} : réalisations, prestations, avis et demande de devis.`).slice(0, 160),
    robots: site.indexable === false ? { index: false, follow: false } : { index: true, follow: true }
  };
}

export default async function SitePage({ params }) {
  const { slug } = await params;
  return <SitePublic slug={slug} />;
}
