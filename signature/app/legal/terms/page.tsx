import { redirect } from "next/navigation";

// Les conditions de Koji sont sur le site principal (26 nov. 2026).
export default function TermsPage() {
  redirect("https://getkoji.io/legal/conditions-professionnels");
}
