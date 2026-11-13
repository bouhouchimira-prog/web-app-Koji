import { DM_Sans } from "../app/fonts";
import { AuthBrandPanel } from "./AuthBrandPanel";
import "./entreprise-login.css";

// Gabarit des écrans de compte Koji Pro (maquettes PRO-00 et PRO-00.1) :
// panneau graphite à gauche, formulaire sur fond blanc à droite. Sur
// téléphone, le panneau devient un bandeau graphite en haut (mot-symbole et
// phrase de marque), puis le formulaire.
export function EntrepriseAuthLayout({ children, aside = null }) {
  return (
    <div className={`ea ${DM_Sans.variable}`}>
      <AuthBrandPanel profile="entreprise" />
      <main className="ea-form">
        <div className="ea-in">
          {aside ? <div className="ea-aside">{aside}</div> : null}
          {children}
        </div>
      </main>
    </div>
  );
}
