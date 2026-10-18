import { EntrepriseLanding } from "../../components/EntrepriseLanding";

// Page marketing publique "Koji Pro" pour les entreprises du BTP (18 oct) —
// accessible sans connexion, contrairement a tout le reste de /app qui
// exige un compte. Voir components/EntrepriseLanding.jsx pour le detail.
export default function EntreprisePage() {
  return <EntrepriseLanding />;
}
