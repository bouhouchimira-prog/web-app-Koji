import { ParticulierLanding } from "./ParticulierLanding";

// getkoji.io/particulier : page d'accueil des particuliers (maquette SITE-02).
export const metadata = {
  title: "Koji — Vos travaux, un prix juste, des entreprises vérifiées",
  description: "Décrivez vos travaux en cinq minutes, avec des photos. Koji transmet votre projet à des entreprises vérifiées près de chez vous. Gratuit, sans engagement."
};

export default function ParticulierPage() {
  return <ParticulierLanding />;
}
