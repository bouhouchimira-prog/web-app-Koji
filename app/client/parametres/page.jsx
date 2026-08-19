"use client";

import { ClientTopbar } from "../../../components/ClientTopbar";
import { SettingsPanel } from "../../../components/SettingsPanel";
import { useLocale } from "../../../lib/i18n";

export default function ClientParametresPage() {
  const { L } = useLocale();

  return (
    <main className="client-space">
      <ClientTopbar showBack backHref="/client" />

      <div className="ct-welcome">
        <strong>{L.settings.title}</strong>
      </div>

      <SettingsPanel accountType="particulier" />
    </main>
  );
}
