import './globals.css'

export const metadata = {
  title: 'Worker - Koji',
  description: 'Plateforme ouvriers Koji',
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
