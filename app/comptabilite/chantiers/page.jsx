import { redirect } from "next/navigation";

// Coût des chantiers : déplacé dans Dépenses (maquette PRO-09.1).
export default function Page() {
  redirect("/depenses/chantiers");
}
