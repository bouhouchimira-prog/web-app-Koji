"use client";

import { useEffect } from "react";
import { readStoredUser } from "../../lib/client-api";

// Ancienne adresse de la page Tarifs (24 oct.). Depuis la refonte :
// - un visiteur sans compte va sur la page Tarifs publique (/entreprise/tarifs,
//   maquette SITE-03) ;
// - une entreprise connectée va sur « Abonnement et jetons »
//   (/parametres/abonnement, maquette PRO-15.3), qui porte le choix de
//   l'offre et le paiement Stripe. Cette adresse reste parce que la fin
//   d'essai, les outils verrouillés et le retour d'un paiement annulé y
//   renvoient encore (components/Shell.jsx, app/api/billing/checkout).
export default function AbonnementPage() {
  useEffect(() => {
    const suite = window.location.search || "";
    window.location.replace(readStoredUser() ? `/parametres/abonnement${suite}` : "/entreprise/tarifs");
  }, []);
  return null;
}
