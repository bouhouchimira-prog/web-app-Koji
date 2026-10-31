"use client";

import { ProAccountNav } from "../../components/ProAccountNav";
import { Shell } from "../../components/Shell";
import { SettingsPanel } from "../../components/SettingsPanel";

export default function ParametresPage() {
  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow">Profil et compte</span>
          <h1>Préférences et compte</h1>
          <span className="muted">Langue, apparence, aide et données de votre compte.</span>
        </div>
      </div>
      <div className="pf-g">
        <ProAccountNav current="preferences" />
        <div className="pf-c">
          <SettingsPanel accountType="entreprise" variant="pro" />
        </div>
      </div>
    </Shell>
  );
}
