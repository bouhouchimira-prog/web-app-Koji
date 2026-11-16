import { redirect } from "next/navigation";
import familles from "../../../data/ouvrage-families.json";

// Ancienne page par famille : la Bibliothèque (maquette PRO-08) filtre les
// familles sur la même page.
export default async function Page({ params }) {
  const { famille } = await params;
  const nom = decodeURIComponent(famille || "");
  const code = familles.find((f) => f.name === nom || f.code === nom.toUpperCase())?.code || "";
  redirect(`/bibliotheque-ouvrages${code ? `?famille=${code}` : ""}`);
}
