import { notFound } from "next/navigation";
import { CONTENU } from "../metiers-data";
import { MetierPage } from "../MetierPage";

// getkoji.io/entreprise/metiers/<métier> (maquette SITE-04). Une page n'existe
// que pour les métiers dont le contenu est écrit (metiers-data.js) ; les
// autres répondent 404.
export function generateStaticParams() {
  return Object.keys(CONTENU).map((metier) => ({ metier }));
}

export async function generateMetadata({ params }) {
  const { metier } = await params;
  const contenu = CONTENU[metier];
  return contenu ? contenu.seo : {};
}

export default async function Page({ params }) {
  const { metier } = await params;
  const contenu = CONTENU[metier];
  if (!contenu) notFound();
  return <MetierPage slug={metier} contenu={contenu} />;
}
