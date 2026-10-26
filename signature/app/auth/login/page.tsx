// Page retiree (26 oct, demande d'Amira) : plus de systeme de connexion par
// Identifiant/Mot de passe — l'acces se fait uniquement par lien direct
// (?quoteId=...), verifie cote SQL par get_quote_for_client. Fichier laisse
// vide plutot que supprime pour ne rien casser si une ancienne URL y pointe
// encore.
export default function LoginPage() {
  return <div className="min-h-screen bg-background" />;
}
