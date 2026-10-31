"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shell } from "../../../components/Shell";

export default function LanguePage() {
  const router = useRouter();
  const [language, setLanguage] = useState("fr");

  return (
    <Shell>
      <div className="head">
        <button className="link" onClick={() => router.back()}>← Retour</button>
        <h1>Langue et traduction</h1>
      </div>

      <div className="card">
        <div className="card-h"><h2>Langue de l'interface</h2></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { code: "fr", label: "Français" },
            { code: "en", label: "English" },
            { code: "es", label: "Español" },
            { code: "de", label: "Deutsch" }
          ].map((lang) => (
            <label key={lang.code} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input type="radio" checked={language === lang.code} onChange={() => setLanguage(lang.code)} style={{ width: 18, height: 18 }} />
              <span>{lang.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h2>Traduction KojiPage</h2></div>
        <p style={{ fontSize: 14, color: "var(--grey)", marginBottom: 12 }}>Traduire votre page publique dans d'autres langues pour atteindre plus de clients.</p>
        <button className="btn btn-sec">🌐 Gérer les traductions</button>
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
