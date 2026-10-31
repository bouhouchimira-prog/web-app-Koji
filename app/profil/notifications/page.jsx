"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shell } from "../../../components/Shell";

export default function NotificationsPage() {
  const router = useRouter();
  const [prefs, setPrefs] = useState({
    demandes: true,
    messages: true,
    paiements: true,
    mails: true,
    sms: false
  });

  return (
    <Shell>
      <div className="head">
        <button className="link" onClick={() => router.back()}>← Retour</button>
        <h1>Notifications et compte</h1>
      </div>

      <div className="card">
        <div className="card-h"><h2>Préférences de notifications</h2></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { key: "demandes", label: "Nouvelles demandes de clients" },
            { key: "messages", label: "Messages reçus" },
            { key: "paiements", label: "Paiements reçus" },
            { key: "mails", label: "Notifications par email" },
            { key: "sms", label: "Notifications par SMS" }
          ].map((pref) => (
            <label key={pref.key} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={prefs[pref.key]} onChange={(e) => setPrefs({...prefs, [pref.key]: e.target.checked})} style={{ width: 18, height: 18 }} />
              <span>{pref.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h2>Sécurité du compte</h2></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button className="btn btn-sec">🔐 Changer le mot de passe</button>
          <button className="btn btn-sec">📱 Ajouter l'authentification 2FA</button>
          <button className="btn btn-sec">🚪 Gérer les sessions actives</button>
        </div>
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
