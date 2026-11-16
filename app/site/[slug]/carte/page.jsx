import { CarteRecue } from "./CarteRecue";

// Carte de visite reçue, vue client (maquette PRO-13.4).
export const metadata = { title: "Carte de visite", robots: { index: false, follow: false } };

export default async function CartePage({ params }) {
  const { slug } = await params;
  return <CarteRecue slug={slug} />;
}
