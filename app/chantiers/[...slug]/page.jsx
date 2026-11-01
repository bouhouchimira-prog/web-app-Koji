import { redirect } from "next/navigation";

// Ex-sous-pages de démonstration du 31 oct. : renvoie vers la fiche chantier réelle.
export default async function Page({ params }) {
  const { slug } = await params;
  redirect(`/chantiers?project=${encodeURIComponent(slug[0])}`);
}
