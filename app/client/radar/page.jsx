import { redirect } from "next/navigation";

// « Mes demandes » a rejoint « Mes projets » (maquette CLI-01) : une seule
// liste pour les chantiers, les demandes publiées et les brouillons.
export default function AnciennesDemandes() {
  redirect("/client");
}
