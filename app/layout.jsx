import "./globals.css";
import { I18nProvider } from "../lib/i18n";
import { AUTH_LINK_REDIRECT_SOURCE } from "../lib/auth-link-redirect";

export const metadata = {
  title: "Koji Pro",
  description: "Gestion de devis, chantiers et planning renovation"
};

export const viewport = {
  themeColor: "#1D74FF",
  width: "device-width",
  initialScale: 1
};

// Runs before hydration so the page never paints light and then flips to
// dark a frame later (localStorage isn't available during SSR).
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("koji-theme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

// Liens « Mot de passe oublié » envoyés par Supabase (apps installées avant le
// 12 nov) : ils demandaient koji://reset-password, adresse refusée par
// Supabase, qui renvoie alors vers l'accueil de getkoji.io avec la session
// dans l'URL (#access_token=…&type=recovery). L'accueil l'ignorait : le
// testeur tombait sur la landing. On l'envoie sur /set-password, qui sait
// déjà utiliser ce jeton. Lien expiré ou déjà utilisé (#error_code=…) sur
// l'accueil : page « Mot de passe oublié » pour en demander un nouveau.
// Logique testée dans lib/auth-link-redirect.js.
const AUTH_LINK_SCRIPT = `(function(){try{${AUTH_LINK_REDIRECT_SOURCE}var c=cibleLienAuth(location.pathname,location.hash);if(c)location.replace(c);}catch(e){}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: AUTH_LINK_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
