import { redirect } from "next/navigation";

// Urgences pas encore construites ; l'intervention rapide existe déjà dans Interventions.
export default async function Page({ params }) {
  const { rest } = await params;
  redirect(rest?.[0] === "intervention-rapide" ? "/interventions?new=1" : "/");
}
