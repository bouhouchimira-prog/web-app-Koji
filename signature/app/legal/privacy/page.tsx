import { redirect } from "next/navigation";

// La politique de confidentialité de Koji est sur le site principal (26 nov. 2026).
export default function PrivacyPage() {
  redirect("https://getkoji.io/legal/confidentialite");
}
