import "./globals.css";
import { I18nProvider } from "../lib/i18n";

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

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
