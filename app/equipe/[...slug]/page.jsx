import { redirect } from "next/navigation";

// Ex-sous-pages de démonstration du 31 oct. : renvoie vers la page réelle.
export default function Page() {
  redirect("/equipe");
}
