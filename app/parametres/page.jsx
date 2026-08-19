"use client";

import { Shell } from "../../components/Shell";
import { SettingsPanel } from "../../components/SettingsPanel";
import { useLocale } from "../../lib/i18n";

export default function ParametresPage() {
  const { L } = useLocale();

  return (
    <Shell>
      <div className="profile-layout">
        <header className="profile-header">
          <h1>{L.settings.title}</h1>
        </header>
        <SettingsPanel accountType="entreprise" variant="cards" />
      </div>
    </Shell>
  );
}
