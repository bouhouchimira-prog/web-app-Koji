import { redirect } from "next/navigation";

// Ex-sous-pages de démonstration du 31 oct. : renvoie vers la Bibliothèque.
export default async function Page({ params }) {
  const { famille } = await params;
  redirect(`/bibliotheque-ouvrages/${encodeURIComponent(famille)}`);
}
