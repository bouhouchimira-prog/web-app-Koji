import { redirect } from "next/navigation";

// Ex-sous-pages de démonstration du 31 oct. : renvoie vers la section réelle.
const TARGETS = { "devis-factures": "/profil?tab=devis", notifications: "/parametres" };

export default async function Page({ params }) {
  const { rest } = await params;
  redirect(TARGETS[rest[0]] || "/profil");
}
