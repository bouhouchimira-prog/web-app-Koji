import { RESSOURCES_LANCEES } from "./ressources-data";
import { RessourcesListe } from "./RessourcesPages";

// getkoji.io/entreprise/ressources (maquette SITE-05). Non indexée tant que
// la rubrique n'est pas lancée (voir ressources-data.js).
export const metadata = {
  title: "Ressources Koji — règles, TVA, devis et factures pour les artisans",
  description: "Des fiches courtes sur les règles du bâtiment : facture électronique, TVA, mentions du devis, facturation par étapes, sous-traitance, rétractation.",
  robots: RESSOURCES_LANCEES ? undefined : { index: false, follow: false }
};

export default function Page() {
  return <RessourcesListe />;
}
