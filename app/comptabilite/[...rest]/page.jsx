import { redirect } from "next/navigation";

// Ex-sous-pages de démonstration du 31 oct. : renvoie vers Dépenses.
export default async function Page({ params }) {
  const { rest } = await params;
  redirect(rest[0] === "cout-chantier" ? "/depenses/chantiers" : "/depenses");
}
