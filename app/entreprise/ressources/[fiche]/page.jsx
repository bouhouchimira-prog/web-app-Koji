import { notFound } from "next/navigation";
import { FICHES, RESSOURCES_LANCEES } from "../ressources-data";
import { RessourceArticle } from "../RessourcesPages";

// getkoji.io/entreprise/ressources/<fiche> : une page par fiche rédigée.
function ficheRedigee(slug) {
  return FICHES.find((fiche) => fiche.slug === slug && fiche.article) || null;
}

export function generateStaticParams() {
  return FICHES.filter((fiche) => fiche.article).map((fiche) => ({ fiche: fiche.slug }));
}

export async function generateMetadata({ params }) {
  const { fiche: slug } = await params;
  const fiche = ficheRedigee(slug);
  if (!fiche) return {};
  return {
    title: `${fiche.titre} — Koji`,
    description: fiche.resume,
    robots: RESSOURCES_LANCEES ? undefined : { index: false, follow: false }
  };
}

export default async function Page({ params }) {
  const { fiche: slug } = await params;
  const fiche = ficheRedigee(slug);
  if (!fiche) notFound();
  return <RessourceArticle fiche={fiche} />;
}
