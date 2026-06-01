import "./globals.css";

export const metadata = {
  title: "Koji Pro",
  description: "Gestion de devis, chantiers et planning renovation"
};

export const viewport = {
  themeColor: "#1D74FF",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
