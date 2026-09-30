"use client";

import { ClientTopbar } from "../../../components/ClientTopbar";
import { SettingsPanel } from "../../../components/SettingsPanel";
import { useLocale } from "../../../lib/i18n";
import "../client-home.css";

// Paramètres du particulier (refonte UX, septembre 2026). Le panneau
// SettingsPanel est partagé avec l'espace entreprise et n'est pas modifié :
// son apparence est ajustée ici seulement (classe .kc-settings, dans
// client-home.css).

export default function ClientParametresPage() {
  const { L } = useLocale();

  return (
    <main className="client-space">
      <ClientTopbar showBack backHref="/client/profil" />

      <div className="kc kc-settings">
        <div className="kc-page-head">
          <h1 className="kc-page-title">{L.settings.title}</h1>
        </div>
        <SettingsPanel accountType="particulier" />
      </div>
    </main>
  );
}
