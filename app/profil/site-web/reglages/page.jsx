"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shell } from "../../../../components/Shell";

export default function ReglagesPage() {
  const router = useRouter();
  const [settings, setSettings] = useState({
    acceptDemandes: true,
    notifyEmail: true,
    showPrice: false,
    visibility: "public"
  });

  return (
    <Shell>
      <div className="head">
        <button className="link" onClick={() => router.back()}>← Retour</button>
        <h1>Réglages KojiPage</h1>
      </div>

      <div className="card">
        <div className="card-h"><h2>Visibilité et demandes</h2></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={settings.acceptDemandes} onChange={(e) => setSettings({...settings, acceptDemandes: e.target.checked})} style={{ width: 18, height: 18 }} />
            <span>Accepter les demandes de clients</span>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={settings.notifyEmail} onChange={(e) => setSettings({...settings, notifyEmail: e.target.checked})} style={{ width: 18, height: 18 }} />
            <span>Notifier par email</span>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={settings.showPrice} onChange={(e) => setSettings({...settings, showPrice: e.target.checked})} style={{ width: 18, height: 18 }} />
            <span>Afficher mes prix publiquement</span>
          </label>
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h2>Accès à la page</h2></div>
        <label>
          <span>Visibilité</span>
          <select value={settings.visibility} onChange={(e) => setSettings({...settings, visibility: e.target.value})}>
            <option value="public">Publique (accessible à tous)</option>
            <option value="restricted">Restreinte (lien uniquement)</option>
            <option value="private">Privée (brouillon)</option>
          </select>
        </label>
      </div>

      <div className="card">
        <div className="ed-act">
          <button className="btn btn-sec" onClick={() => router.back()}>Annuler</button>
          <button className="btn btn-main">✓ Enregistrer</button>
        </div>
      </div>
    </Shell>
  );
}
