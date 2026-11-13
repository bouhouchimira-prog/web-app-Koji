import { redirect } from "next/navigation";

// PRO-01.2 (décision 1 · A) : la page Chiffre d'affaires est remplacée par
// les chiffres du mois de l'accueil (Facturé HT · Encaissé · Reste à encaisser).
export default function Page() {
  redirect("/");
}
