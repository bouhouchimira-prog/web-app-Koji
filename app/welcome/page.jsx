"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthBrandPanel } from "../../components/AuthBrandPanel";

export default function WelcomePage() {
  const [selected, setSelected] = useState("entreprise");

  return (
    <main className="auth-screen welcome-screen">
      <AuthBrandPanel welcome />

      <section className="auth-panel welcome-panel">
        <div className="grid">
          <button
            className={`panel auth-choice-card ${selected === "entreprise" ? "is-selected" : ""}`}
            onClick={() => setSelected("entreprise")}
            style={{ textAlign: "left" }}
          >
            <h2>Profil entreprise</h2>
            <p className="muted">Pour les artisans et entreprises du batiment.</p>
          </button>
          <button
            className={`panel auth-choice-card ${selected === "particulier" ? "is-selected" : ""}`}
            onClick={() => setSelected("particulier")}
            style={{ textAlign: "left" }}
          >
            <h2>Profil particulier</h2>
            <p className="muted">Pour les particuliers qui suivent leurs chantiers et documents.</p>
          </button>
        </div>
        <div className="actions welcome-actions" style={{ marginTop: 22 }}>
          <Link className="button blue" href={`/login?type=${selected}`}>Connexion</Link>
          <Link className="button secondary" href={`/signup?type=${selected}`}>Creer un compte</Link>
        </div>
      </section>
    </main>
  );
}
