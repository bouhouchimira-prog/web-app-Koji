import { redirect } from "next/navigation";

// Les clients sont dans le carnet unique de Contacts (maquette PRO-10).
export default function Page() {
  redirect("/contacts");
}
