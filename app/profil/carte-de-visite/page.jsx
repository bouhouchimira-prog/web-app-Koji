import { redirect } from "next/navigation";

// La carte de visite est un onglet de la KojiPage (maquette PRO-13.4).
export default function Page() {
  redirect("/kojipage/carte");
}
