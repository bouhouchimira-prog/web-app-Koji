import { redirect } from "next/navigation";

// Ex-sous-pages de démonstration du 31 oct. : les filtres sont dans le calendrier.
export default function Page() {
  redirect("/calendrier");
}
