import { redirect } from "next/navigation";

// getkoji.io/particulier = page d'accueil des particuliers (maquette
// SITE-02), à construire. En attendant, la porte d'entrée (SITE-00) y mène
// et le particulier arrive sur l'entrée Koji actuelle.
export default function Page() {
  redirect("/login?type=particulier");
}
