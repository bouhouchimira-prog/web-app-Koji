import { redirect } from "next/navigation";

// « Comptabilité » devient « Dépenses » (maquette PRO-09, décision ABL du
// 30 oct. : Koji range les pièces, il ne tient pas la comptabilité).
export default function Page() {
  redirect("/depenses");
}
