import { redirect } from "next/navigation";
import UrgencesPro from "../UrgencesPro";

// Urgences côté artisan (maquette PRO-17) : /urgences. Les anciennes
// sous-adresses renvoient vers la page (ou vers l'intervention rapide).
export default async function Page({ params }) {
  const { rest } = await params;
  if (rest?.length) redirect(rest[0] === "intervention-rapide" ? "/interventions/rapide/nouvelle" : "/urgences");
  return <UrgencesPro />;
}
