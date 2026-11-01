import { redirect } from "next/navigation";

// Ex-sous-pages de démonstration du 31 oct. : renvoie vers l'éditeur réel.
export default async function Page({ params }) {
  const { slug } = await params;
  redirect(`/devis?id=${encodeURIComponent(slug[0])}`);
}
